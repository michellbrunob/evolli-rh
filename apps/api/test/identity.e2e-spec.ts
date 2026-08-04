import { execFileSync } from "node:child_process";
import { join } from "node:path";
import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { PrismaClient } from "@prisma/client";
import cookieParser from "cookie-parser";
import { authenticator } from "otplib";
import request from "supertest";
import { GenericContainer, StartedTestContainer, Wait } from "testcontainers";
import { AppModule } from "../src/app.module";
import { AllExceptionsFilter } from "../src/common/filters/http-exception.filter";
import { requestIdMiddleware } from "../src/common/request-id";

/**
 * Etapa 0 — Fatia 3: identidade, sessão e autorização. Integração real com
 * PostgreSQL efêmero (Testcontainers) — mesmo padrão de `database.e2e-spec.ts`
 * (Fatia 2). Requer Docker disponível.
 */

jest.setTimeout(300_000);

const API_ROOT = join(__dirname, "..");
const INFRA_POSTGRES_DIR = join(
  __dirname,
  "..",
  "..",
  "..",
  "infra",
  "postgres",
);
const PRISMA_CLI = require.resolve("prisma/build/index.js");
const TS_NODE_REGISTER = require.resolve("ts-node/register/transpile-only");

const ADMIN_USER = "admin_test";
const ADMIN_PASSWORD = "admin_test_pw";
const ADMIN_DB = "evolli_test";
const MIGRATOR_PASSWORD = "migrator_test_pw";
const APP_PASSWORD = "app_test_pw";
const MFA_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");

async function runInfraScript(
  container: StartedTestContainer,
  fileName: string,
  extraArgs: string[],
): Promise<void> {
  const containerPath = `/tmp/${fileName}`;
  await container.copyFilesToContainer([
    { source: join(INFRA_POSTGRES_DIR, fileName), target: containerPath },
  ]);

  const result = await container.exec(
    [
      "psql",
      "-U",
      ADMIN_USER,
      "-d",
      ADMIN_DB,
      "-v",
      "ON_ERROR_STOP=1",
      ...extraArgs,
      "-f",
      containerPath,
    ],
    { env: { PGPASSWORD: ADMIN_PASSWORD } },
  );

  if (result.exitCode !== 0) {
    throw new Error(
      `Falha ao executar ${fileName} no Postgres de teste (exit ${result.exitCode}): ${result.output}`,
    );
  }
}

function runBootstrap(env: Record<string, string>): {
  status: number;
  output: string;
} {
  try {
    const output = execFileSync(
      process.execPath,
      [
        "-r",
        TS_NODE_REGISTER,
        join(API_ROOT, "src/bootstrap/bootstrap-admin.ts"),
      ],
      {
        cwd: API_ROOT,
        env: { ...process.env, ...env },
        stdio: "pipe",
        encoding: "utf8",
      },
    );
    return { status: 0, output };
  } catch (error) {
    const execError = error as {
      status: number;
      stdout: string;
      stderr: string;
    };
    return {
      status: execError.status,
      output: `${execError.stdout ?? ""}${execError.stderr ?? ""}`,
    };
  }
}

// Compartilhado entre describes: guarda o segredo TOTP de cada e-mail já
// enrolado neste arquivo, para permitir login subsequente (mfa/verify) sem
// precisar reenrolar.
const totpSecretByEmail = new Map<string, string>();

function extractTotpSecret(otpauthUri: string): string {
  const match = /[?&]secret=([^&]+)/.exec(otpauthUri);
  if (!match?.[1]) {
    throw new Error("otpauthUri sem secret");
  }
  return match[1];
}

async function buildApp(): Promise<INestApplication> {
  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.use(requestIdMiddleware);
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.init();
  return app;
}

describe("Identidade, sessão e autorização (e2e)", () => {
  let container: StartedTestContainer;
  let appUrl: string;
  let migratorUrl: string;

  beforeAll(async () => {
    container = await new GenericContainer("postgres:16-alpine")
      .withEnvironment({
        POSTGRES_USER: ADMIN_USER,
        POSTGRES_PASSWORD: ADMIN_PASSWORD,
        POSTGRES_DB: ADMIN_DB,
      })
      .withExposedPorts(5432)
      .withWaitStrategy(
        Wait.forLogMessage(/database system is ready to accept connections/, 2),
      )
      .start();

    const host = container.getHost();
    const port = container.getMappedPort(5432);

    await runInfraScript(container, "01_create_roles.sql", [
      "-v",
      `migrator_password=${MIGRATOR_PASSWORD}`,
      "-v",
      `app_password=${APP_PASSWORD}`,
    ]);
    await runInfraScript(container, "02_schema_and_grants.sql", []);

    migratorUrl = `postgresql://evolli_migrator:${MIGRATOR_PASSWORD}@${host}:${port}/${ADMIN_DB}?schema=app`;
    appUrl = `postgresql://evolli_app:${APP_PASSWORD}@${host}:${port}/${ADMIN_DB}?schema=app`;

    // Migrations do zero, mesma ferramenta/schema usados em produção.
    execFileSync(
      process.execPath,
      [PRISMA_CLI, "migrate", "deploy", "--schema=prisma/schema.prisma"],
      {
        cwd: API_ROOT,
        env: {
          ...process.env,
          DATABASE_URL: migratorUrl,
          MIGRATE_DATABASE_URL: migratorUrl,
        },
        stdio: "pipe",
      },
    );

    process.env.DATABASE_URL = appUrl;
    process.env.MFA_ENCRYPTION_KEY = MFA_ENCRYPTION_KEY;
  });

  afterAll(async () => {
    await container.stop();
  });

  describe("bootstrap do administrador técnico", () => {
    it("cria o admin_tecnico quando as variáveis estão no processo e nenhum admin existe", () => {
      const result = runBootstrap({
        DATABASE_URL: appUrl,
        MFA_ENCRYPTION_KEY,
        ADMIN_BOOTSTRAP_EMAIL: "admin@evolli.test",
        ADMIN_BOOTSTRAP_PASSWORD: "uma-passphrase-de-bootstrap-bem-longa",
      });

      expect(result.status).toBe(0);
      expect(result.output).not.toContain(
        "uma-passphrase-de-bootstrap-bem-longa",
      );
    });

    it("falha (sem revelar segredo) se já existir admin_tecnico", () => {
      const result = runBootstrap({
        DATABASE_URL: appUrl,
        MFA_ENCRYPTION_KEY,
        ADMIN_BOOTSTRAP_EMAIL: "admin2@evolli.test",
        ADMIN_BOOTSTRAP_PASSWORD: "outra-passphrase-de-bootstrap-longa",
      });

      expect(result.status).not.toBe(0);
      expect(result.output).toMatch(/já existe/i);
      expect(result.output).not.toContain(
        "outra-passphrase-de-bootstrap-longa",
      );
    });

    it("falha sem revelar nada se as variáveis não estiverem no ambiente do processo", () => {
      const result = runBootstrap({ DATABASE_URL: appUrl, MFA_ENCRYPTION_KEY });
      expect(result.status).not.toBe(0);
      expect(result.output).toMatch(/ADMIN_BOOTSTRAP_EMAIL/);
    });
  });

  describe("fluxo completo: login, MFA obrigatório, sessão, CSRF", () => {
    let app: INestApplication;
    const agent = () => request(app.getHttpServer());
    const adminEmail = "admin@evolli.test";
    const adminPassword = "uma-passphrase-de-bootstrap-bem-longa";
    let adminCookie: string;
    let adminCsrfToken: string;
    let adminSessionId: string;

    beforeAll(async () => {
      app = await buildApp();
    });

    afterAll(async () => {
      await app.close();
    });

    it("GET /v1/health não consulta o banco (regressão)", async () => {
      const response = await agent().get("/v1/health").expect(200);
      expect(response.body).toEqual({
        status: "ok",
        version: expect.any(String),
        timestamp: expect.any(String),
      });
    });

    it("GET /v1/health/ready reporta banco disponível (regressão)", async () => {
      const response = await agent().get("/v1/health/ready").expect(200);
      expect(response.body).toEqual({
        status: "ok",
        timestamp: expect.any(String),
      });
    });

    it("login do admin recém-criado exige enrollment de MFA (primeiro acesso)", async () => {
      const response = await agent()
        .post("/v1/auth/login")
        .send({ email: adminEmail, password: adminPassword })
        .expect(200);

      expect(response.body).toEqual({
        status: "mfa_enrollment_required",
        challengeToken: expect.any(String),
      });
    });

    it("completa enroll + confirm de MFA e recebe sessão + csrfToken + recovery codes", async () => {
      const loginResponse = await agent()
        .post("/v1/auth/login")
        .send({ email: adminEmail, password: adminPassword })
        .expect(200);

      const enrollResponse = await agent()
        .post("/v1/auth/mfa/enroll")
        .send({ challengeToken: loginResponse.body.challengeToken })
        .expect(200);

      const secret = extractTotpSecret(enrollResponse.body.otpauthUri);
      totpSecretByEmail.set(adminEmail, secret);
      const code = authenticator.generate(secret);

      const confirmResponse = await agent()
        .post("/v1/auth/mfa/confirm")
        .send({ challengeToken: enrollResponse.body.challengeToken, code })
        .expect(200);

      expect(confirmResponse.body.csrfToken).toEqual(expect.any(String));
      expect(confirmResponse.body.recoveryCodes).toHaveLength(10);
      expect(confirmResponse.headers["set-cookie"]).toBeDefined();

      const setCookieHeader = confirmResponse.headers["set-cookie"];
      const cookies = Array.isArray(setCookieHeader)
        ? setCookieHeader
        : [setCookieHeader as unknown as string];
      const sessionCookie = cookies.find((c: string) =>
        c.startsWith("evolli_session="),
      );
      expect(sessionCookie).toBeDefined();
      expect(sessionCookie).toContain("HttpOnly");
      // NODE_ENV=test não é "development" — Secure fica ligado (spec §4:
      // "Secure fora de desenvolvimento").
      expect(sessionCookie).toContain("Secure");
      expect(sessionCookie).toContain("SameSite=Lax");

      adminCookie = sessionCookie!.split(";")[0]!;
      adminCsrfToken = confirmResponse.body.csrfToken;
    });

    it("sessão dá acesso a GET /v1/users/me sem dado sensível", async () => {
      const response = await agent()
        .get("/v1/users/me")
        .set("Cookie", adminCookie)
        .expect(200);

      expect(response.body).toMatchObject({
        email: adminEmail,
        role: "admin_tecnico",
        mfaEnabled: true,
      });
      expect(response.body).not.toHaveProperty("passwordHash");
      expect(response.body).not.toHaveProperty("mfaSecretEncrypted");

      const sessions = await agent()
        .get("/v1/auth/sessions")
        .set("Cookie", adminCookie)
        .expect(200);
      expect(sessions.body).toHaveLength(1);
      adminSessionId = sessions.body[0].id;
    });

    it("sem cookie de sessão, GET /v1/users/me retorna 401 genérico", async () => {
      const response = await agent().get("/v1/users/me").expect(401);
      expect(response.body).toEqual({
        status_code: 401,
        message: "Não autorizado.",
        request_id: expect.any(String),
        timestamp: expect.any(String),
      });
    });

    it("CSRF: operação de mudança de estado sem token é rejeitada mesmo com sessão válida", async () => {
      await agent()
        .post("/v1/auth/logout")
        .set("Cookie", adminCookie)
        .expect(403);
    });

    it("CSRF: token errado também é rejeitado", async () => {
      await agent()
        .post("/v1/auth/logout")
        .set("Cookie", adminCookie)
        .set("x-csrf-token", "token-invalido-qualquer")
        .expect(403);
    });

    it("revogação da própria sessão exige CSRF e derruba a sessão", async () => {
      await agent()
        .delete(`/v1/auth/sessions/${adminSessionId}`)
        .set("Cookie", adminCookie)
        .set("x-csrf-token", adminCsrfToken)
        .expect(204);

      await agent().get("/v1/users/me").set("Cookie", adminCookie).expect(401);
    });

    it("nenhuma resposta de erro deste fluxo contém segredo/detalhe interno", async () => {
      const responses = await Promise.all([
        agent()
          .post("/v1/auth/login")
          .send({ email: "nao-existe@evolli.test", password: "qualquer" }),
        agent()
          .post("/v1/auth/mfa/verify")
          .send({ challengeToken: "invalido", code: "000000" }),
      ]);

      for (const response of responses) {
        const text = JSON.stringify(response.body);
        expect(text).not.toMatch(/argon2/i);
        expect(text).not.toContain(adminPassword);
        expect(text).not.toContain(MFA_ENCRYPTION_KEY);
        expect(text).not.toMatch(/at .*\.ts:\d+/);
        expect(response.body).not.toHaveProperty("stack");
      }
    });
  });

  describe("RBAC/ABAC, IDOR/BOLA, autoelevação (multi-usuário)", () => {
    let app: INestApplication;
    const agent = () => request(app.getHttpServer());
    let prisma: PrismaClient;

    let rhCookie: string;
    let rhCsrfToken: string;
    let rhUserId: string;
    let colaboradorCompanyBId: string;

    async function loginAndCompleteMfa(
      email: string,
      password: string,
    ): Promise<{ cookie: string; csrfToken: string }> {
      const loginResponse = await agent()
        .post("/v1/auth/login")
        .send({ email, password })
        .expect(200);

      let challengeToken = loginResponse.body.challengeToken as string;
      let code: string;

      if (loginResponse.body.status === "mfa_enrollment_required") {
        const enrollResponse = await agent()
          .post("/v1/auth/mfa/enroll")
          .send({ challengeToken })
          .expect(200);
        const secret = extractTotpSecret(enrollResponse.body.otpauthUri);
        totpSecretByEmail.set(email, secret);
        challengeToken = enrollResponse.body.challengeToken;
        code = authenticator.generate(secret);

        const confirmResponse = await agent()
          .post("/v1/auth/mfa/confirm")
          .send({ challengeToken, code })
          .expect(200);
        const cookies = confirmResponse.headers[
          "set-cookie"
        ] as unknown as string[];
        const sessionCookie = cookies
          .find((c) => c.startsWith("evolli_session="))!
          .split(";")[0]!;
        return {
          cookie: sessionCookie,
          csrfToken: confirmResponse.body.csrfToken,
        };
      }

      // mfa_verification_required — usuário já tinha MFA configurado (ex.:
      // reautenticando o admin do describe anterior). Usa o segredo TOTP
      // capturado quando o enroll aconteceu.
      const secret = totpSecretByEmail.get(email);
      if (!secret) {
        throw new Error(
          `Teste mal configurado: nenhum segredo TOTP conhecido para ${email}`,
        );
      }
      code = authenticator.generate(secret);

      const verifyResponse = await agent()
        .post("/v1/auth/mfa/verify")
        .send({ challengeToken, code })
        .expect(200);
      const cookies = verifyResponse.headers[
        "set-cookie"
      ] as unknown as string[];
      const sessionCookie = cookies
        .find((c) => c.startsWith("evolli_session="))!
        .split(";")[0]!;
      return {
        cookie: sessionCookie,
        csrfToken: verifyResponse.body.csrfToken,
      };
    }

    beforeAll(async () => {
      app = await buildApp();
      prisma = new PrismaClient({ datasources: { db: { url: appUrl } } });

      // Reautentica como admin (sessão anterior foi revogada no describe
      // anterior) só para provisionar os usuários de teste via API real.
      const admin = await loginAndCompleteMfa(
        "admin@evolli.test",
        "uma-passphrase-de-bootstrap-bem-longa",
      );

      const rhEmail = "rh@empresa-a.test";
      await agent()
        .post("/v1/users")
        .set("Cookie", admin.cookie)
        .set("x-csrf-token", admin.csrfToken)
        .send({
          email: rhEmail,
          password: "senha-do-rh-empresa-a-bem-longa",
          role: "rh",
          companyId: "empresa-a",
        })
        .expect(201);

      const colaboradorB = await agent()
        .post("/v1/users")
        .set("Cookie", admin.cookie)
        .set("x-csrf-token", admin.csrfToken)
        .send({
          email: "colaborador@empresa-b.test",
          password: "senha-do-colaborador-b-bem-longa",
          role: "colaborador",
          companyId: "empresa-b",
        })
        .expect(201);
      colaboradorCompanyBId = colaboradorB.body.id;

      const rh = await loginAndCompleteMfa(
        rhEmail,
        "senha-do-rh-empresa-a-bem-longa",
      );
      rhCookie = rh.cookie;
      rhCsrfToken = rh.csrfToken;

      const rhUser = await prisma.accessUser.findUniqueOrThrow({
        where: { email: rhEmail },
      });
      rhUserId = rhUser.id;
    });

    afterAll(async () => {
      await prisma.$disconnect();
      await app.close();
    });

    it("IDOR/BOLA: RH não gerencia conta de outra empresa (403, nunca 200)", async () => {
      await agent()
        .post(`/v1/users/${colaboradorCompanyBId}/disable`)
        .set("Cookie", rhCookie)
        .set("x-csrf-token", rhCsrfToken)
        .expect(403);
    });

    it("IDOR/BOLA: RH não altera papel de usuário de outra empresa (403)", async () => {
      await agent()
        .patch(`/v1/users/${colaboradorCompanyBId}/role`)
        .set("Cookie", rhCookie)
        .set("x-csrf-token", rhCsrfToken)
        .send({ role: "gestor", companyId: "empresa-b" })
        .expect(403);
    });

    it("autoelevação: RH não altera o próprio papel (403)", async () => {
      await agent()
        .patch(`/v1/users/${rhUserId}/role`)
        .set("Cookie", rhCookie)
        .set("x-csrf-token", rhCsrfToken)
        .send({ role: "admin_tecnico", companyId: "empresa-a" })
        .expect(403);
    });

    it("RH não pode criar usuário admin_tecnico", async () => {
      await agent()
        .post("/v1/users")
        .set("Cookie", rhCookie)
        .set("x-csrf-token", rhCsrfToken)
        .send({
          email: "novo-admin@empresa-a.test",
          password: "senha-bem-longa-qualquer-coisa",
          role: "admin_tecnico",
          companyId: "empresa-a",
        })
        .expect(403);
    });

    it("recurso inexistente retorna 404 genérico, não 200 nem detalhe interno", async () => {
      const response = await agent()
        .post("/v1/users/00000000-0000-0000-0000-000000000000/disable")
        .set("Cookie", rhCookie)
        .set("x-csrf-token", rhCsrfToken)
        .expect(404);

      expect(response.body).toEqual({
        status_code: 404,
        message: "Recurso não encontrado.",
        request_id: expect.any(String),
        timestamp: expect.any(String),
      });
    });
  });

  describe("força bruta e enumeração de usuário", () => {
    let app: INestApplication;
    const agent = () => request(app.getHttpServer());
    let prisma: PrismaClient;
    const targetEmail = "vitima-forca-bruta@empresa-a.test";

    beforeAll(async () => {
      app = await buildApp();
      prisma = new PrismaClient({ datasources: { db: { url: appUrl } } });

      const admin = await request(app.getHttpServer())
        .post("/v1/auth/login")
        .send({
          email: "admin@evolli.test",
          password: "uma-passphrase-de-bootstrap-bem-longa",
        });
      // Login não emite sessão sem MFA — aqui só criamos o usuário-alvo
      // diretamente via Prisma para isolar este describe do fluxo de MFA.
      void admin;

      const { PasswordHashService } =
        await import("../src/auth/password/password-hash.service");
      const passwordHash = await new PasswordHashService().hash(
        "senha-da-vitima-bem-longa-123456",
      );
      await prisma.accessUser.create({
        data: {
          email: targetEmail,
          passwordHash,
          role: "colaborador",
          mfaEnabled: false,
        },
      });
    });

    afterAll(async () => {
      await prisma.accessLoginAttempt.deleteMany({});
      await prisma.$disconnect();
      await app.close();
    });

    it("enumeração: e-mail inexistente e senha errada respondem igual", async () => {
      const nonExistent = await agent()
        .post("/v1/auth/login")
        .send({
          email: "nunca-existiu@empresa-a.test",
          password: "qualquer-coisa-123456",
        })
        .expect(401);

      const wrongPassword = await agent()
        .post("/v1/auth/login")
        .send({ email: targetEmail, password: "senha-errada-123456789012" })
        .expect(401);

      // Mesmo status_code e message (request_id/timestamp variam por
      // requisição, por design — não são sinal de enumeração).
      expect(nonExistent.body.status_code).toBe(wrongPassword.body.status_code);
      expect(nonExistent.body.message).toBe(wrongPassword.body.message);
      expect(nonExistent.body).toMatchObject({
        status_code: 401,
        message: "Não autorizado.",
      });

      // Essas duas tentativas malsucedidas contam para o rate limit deste
      // e-mail — limpa antes do teste de força bruta para não interferir.
      await prisma.accessLoginAttempt.deleteMany({
        where: { emailAttempted: targetEmail.toLowerCase() },
      });
    });

    it("força bruta: bloqueia após 5 tentativas inválidas por e-mail+IP em 15 min, sem bloqueio permanente", async () => {
      await prisma.accessLoginAttempt.deleteMany({
        where: { emailAttempted: targetEmail.toLowerCase() },
      });

      for (let attempt = 0; attempt < 5; attempt += 1) {
        await agent()
          .post("/v1/auth/login")
          .send({
            email: targetEmail,
            password: `senha-errada-tentativa-${attempt}`,
          })
          .expect(401);
      }

      // 6ª tentativa — mesmo com a senha CERTA, é barrada pelo rate limit.
      const blocked = await agent()
        .post("/v1/auth/login")
        .send({
          email: targetEmail,
          password: "senha-da-vitima-bem-longa-123456",
        })
        .expect(429);

      expect(blocked.body.message).toMatch(/Muitas requisições/);

      // Limpa a janela manualmente (não é bloqueio permanente — só a janela
      // de 15 min expira; aqui simulamos a expiração para provar que a
      // conta NÃO fica bloqueada para sempre).
      await prisma.accessLoginAttempt.deleteMany({
        where: { emailAttempted: targetEmail.toLowerCase() },
      });

      const afterWindow = await agent()
        .post("/v1/auth/login")
        .send({
          email: targetEmail,
          password: "senha-da-vitima-bem-longa-123456",
        })
        .expect(200);
      expect(afterWindow.body.status).toBe("mfa_enrollment_required");
    });
  });
});
