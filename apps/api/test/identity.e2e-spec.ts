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
import request from "supertest";
import { GenericContainer, StartedTestContainer, Wait } from "testcontainers";
import { AppModule } from "../src/app.module";
import { AllExceptionsFilter } from "../src/common/filters/http-exception.filter";
import { requestIdMiddleware } from "../src/common/request-id";
import { setupOpenApi } from "../src/openapi/openapi";
import { hashOpaqueToken } from "../src/auth/crypto/opaque-token.util";

/**
 * Etapa 0 — Fatia 3: identidade, sessão e autorização. Integração real com
 * PostgreSQL efêmero (Testcontainers) — mesmo padrão de `database.e2e-spec.ts`
 * (Fatia 2). Requer Docker disponível.
 *
 * MFA (TOTP) foi adiado para a próxima fatia de segurança (ADR 0003) — este
 * arquivo cobre apenas o escopo da entrega executiva: login direto por
 * e-mail/senha, sessão, CSRF, RBAC/ABAC, rate limiting e enumeração.
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
    // Pre-condicao de infraestrutura da Fatia 2: a migration exige
    // btree_gist. Provisionada aqui pelo papel ADMINISTRADOR do container
    // efemero — nunca por evolli_migrator, que por desenho da ADR 0002 nao
    // tem CREATE na base. Ver infra/postgres/README.md.
    await runInfraScript(container, "04_extensions.sql", []);

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
  });

  afterAll(async () => {
    await container.stop();
  });

  describe("bootstrap do administrador técnico", () => {
    it("cria o admin_tecnico quando as variáveis estão no processo e nenhum admin existe", () => {
      const result = runBootstrap({
        DATABASE_URL: appUrl,
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
      const result = runBootstrap({ DATABASE_URL: appUrl });
      expect(result.status).not.toBe(0);
      expect(result.output).toMatch(/ADMIN_BOOTSTRAP_EMAIL/);
    });
  });

  describe("fluxo completo: login, sessão, CSRF", () => {
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

    it("login com credenciais válidas emite sessão + csrfToken diretamente", async () => {
      const response = await agent()
        .post("/v1/auth/login")
        .send({ email: adminEmail, password: adminPassword })
        .expect(200);

      expect(response.body.csrfToken).toEqual(expect.any(String));
      expect(response.headers["set-cookie"]).toBeDefined();

      const setCookieHeader = response.headers["set-cookie"];
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
      adminCsrfToken = response.body.csrfToken;
    });

    it("sessão dá acesso a GET /v1/users/me sem dado sensível", async () => {
      const response = await agent()
        .get("/v1/users/me")
        .set("Cookie", adminCookie)
        .expect(200);

      expect(response.body).toMatchObject({
        email: adminEmail,
        role: "admin_tecnico",
      });
      expect(response.body).not.toHaveProperty("passwordHash");

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
      const response = await agent()
        .post("/v1/auth/login")
        .send({ email: "nao-existe@evolli.test", password: "qualquer" });

      const text = JSON.stringify(response.body);
      expect(text).not.toMatch(/argon2/i);
      expect(text).not.toContain(adminPassword);
      expect(text).not.toMatch(/at .*\.ts:\d+/);
      expect(response.body).not.toHaveProperty("stack");
    });
  });

  describe("GET /v1/auth/csrf: emissão por rotação (ADR 0009 §4)", () => {
    let app: INestApplication;
    let prisma: PrismaClient;
    const agent = () => request(app.getHttpServer());
    const adminEmail = "admin@evolli.test";
    const adminPassword = "uma-passphrase-de-bootstrap-bem-longa";

    let cookie: string;
    let loginCsrfToken: string;
    let firstToken: string;
    let secondToken: string;

    beforeAll(async () => {
      app = await buildApp();
      prisma = new PrismaClient({ datasources: { db: { url: appUrl } } });

      const response = await agent()
        .post("/v1/auth/login")
        .send({ email: adminEmail, password: adminPassword })
        .expect(200);

      const cookies = response.headers["set-cookie"] as unknown as string[];
      cookie = cookies
        .find((c) => c.startsWith("evolli_session="))!
        .split(";")[0]!;
      loginCsrfToken = response.body.csrfToken;
    });

    afterAll(async () => {
      await prisma.$disconnect();
      await app.close();
    });

    it("sessão válida recebe token novo, só o token no corpo, com Cache-Control: no-store", async () => {
      const response = await agent()
        .get("/v1/auth/csrf")
        .set("Cookie", cookie)
        .expect(200);

      expect(response.headers["cache-control"]).toBe("no-store");
      // corpo contém exclusivamente o token (ADR 0009 §3)
      expect(Object.keys(response.body)).toEqual(["csrfToken"]);
      expect(response.body.csrfToken).toEqual(expect.any(String));
      // é rotação, não leitura: o token do login já não é o token corrente
      expect(response.body.csrfToken).not.toBe(loginCsrfToken);

      firstToken = response.body.csrfToken;
    });

    it("GET não exige token CSRF e duas chamadas sequenciais devolvem tokens diferentes", async () => {
      // nenhum header x-csrf-token é enviado aqui — GET não é mutação
      const response = await agent()
        .get("/v1/auth/csrf")
        .set("Cookie", cookie)
        .expect(200);

      expect(response.body.csrfToken).not.toBe(firstToken);
      expect(response.body.csrfToken).not.toBe(loginCsrfToken);

      secondToken = response.body.csrfToken;
    });

    it("token anterior à rotação é recusado com 403 em mutação protegida", async () => {
      const response = await agent()
        .post("/v1/users")
        .set("Cookie", cookie)
        .set("x-csrf-token", firstToken)
        .send({
          email: "nao-deve-ser-criado@evolli.test",
          password: "senha-que-nunca-sera-usada-bem-longa",
          role: "colaborador",
          companyId: "empresa-a",
        })
        .expect(403);

      expect(response.body.message).toBe("Acesso negado.");
      // a mutação foi bloqueada antes de qualquer efeito
      expect(
        await prisma.accessUser.findUnique({
          where: { email: "nao-deve-ser-criado@evolli.test" },
        }),
      ).toBeNull();

      // o token emitido no login também caducou nas rotações anteriores
      await agent()
        .post("/v1/users")
        .set("Cookie", cookie)
        .set("x-csrf-token", loginCsrfToken)
        .send({
          email: "tambem-nao-criado@evolli.test",
          password: "senha-que-nunca-sera-usada-bem-longa",
          role: "colaborador",
          companyId: "empresa-a",
        })
        .expect(403);
    });

    it("token corrente autoriza mutação protegida", async () => {
      await agent()
        .post("/v1/users")
        .set("Cookie", cookie)
        .set("x-csrf-token", secondToken)
        .send({
          email: "criado-com-token-rotacionado@evolli.test",
          password: "senha-do-usuario-de-teste-bem-longa",
          role: "colaborador",
          companyId: "empresa-a",
        })
        .expect(201);
    });

    it("sem cookie de sessão, responde 401 genérico sem detalhe interno", async () => {
      const response = await agent().get("/v1/auth/csrf").expect(401);

      expect(response.body).toEqual({
        status_code: 401,
        message: "Não autorizado.",
        request_id: expect.any(String),
        timestamp: expect.any(String),
      });
    });

    it("cookie de sessão inválido também responde 401 genérico", async () => {
      const response = await agent()
        .get("/v1/auth/csrf")
        .set("Cookie", "evolli_session=sessao-que-nao-existe")
        .expect(401);

      expect(response.body.message).toBe("Não autorizado.");
      expect(response.body).not.toHaveProperty("csrfToken");
      expect(response.body).not.toHaveProperty("stack");
    });

    it("sessão revogada não emite token novo (401), e a rotação não a ressuscita", async () => {
      const login = await agent()
        .post("/v1/auth/login")
        .send({ email: adminEmail, password: adminPassword })
        .expect(200);

      const descartavelCookie = (
        login.headers["set-cookie"] as unknown as string[]
      )
        .find((c) => c.startsWith("evolli_session="))!
        .split(";")[0]!;

      // logout revoga exatamente esta sessão, sem tocar na sessão principal
      await agent()
        .post("/v1/auth/logout")
        .set("Cookie", descartavelCookie)
        .set("x-csrf-token", login.body.csrfToken)
        .expect(204);

      await agent()
        .get("/v1/auth/csrf")
        .set("Cookie", descartavelCookie)
        .expect(401);

      // a sessão principal continua íntegra e ainda rotaciona
      await agent().get("/v1/auth/csrf").set("Cookie", cookie).expect(200);
    });

    it("token bruto não aparece no banco, na auditoria nem em log capturado", async () => {
      const written: string[] = [];
      const originalWrite = process.stdout.write.bind(process.stdout);
      jest
        .spyOn(process.stdout, "write")
        .mockImplementation((chunk: unknown, ...rest: unknown[]) => {
          written.push(String(chunk));
          return (originalWrite as unknown as (...args: unknown[]) => boolean)(
            chunk,
            ...rest,
          );
        });

      let emitido: string;
      try {
        const response = await agent()
          .get("/v1/auth/csrf")
          .set("Cookie", cookie)
          .expect(200);
        emitido = response.body.csrfToken;
      } finally {
        jest.restoreAllMocks();
      }

      // nenhuma linha de log carrega o token bruto
      expect(written.join("")).not.toContain(emitido);

      // o banco guarda só o hash — nunca o valor bruto, em nenhuma coluna
      const sessoes = await prisma.accessSession.findMany();
      expect(JSON.stringify(sessoes)).not.toContain(emitido);
      const corrente = sessoes.find(
        (s) => s.csrfTokenHash === hashOpaqueToken(emitido),
      );
      expect(corrente).toBeDefined();

      // a trilha de auditoria não registra o token nem o seu hash
      const eventos = await prisma.auditEvent.findMany();
      const trilha = JSON.stringify(eventos);
      expect(trilha).not.toContain(emitido);
      expect(trilha).not.toContain(corrente!.csrfTokenHash);
    });

    it("OpenAPI declara o endpoint sem token de exemplo e sem esquema de autenticação enganoso", async () => {
      const documentApp = await buildApp();
      try {
        const document = setupOpenApi(documentApp, "0.0.0-test");
        const operation = document.paths["/v1/auth/csrf"]?.get;

        expect(operation).toBeDefined();
        const serializado = JSON.stringify(operation);
        const resposta = JSON.parse(serializado) as {
          responses: Record<
            string,
            {
              content?: Record<string, { schema?: Record<string, unknown> }>;
            }
          >;
          security?: unknown;
        };

        expect(
          resposta.responses["200"]?.content?.["application/json"]?.schema,
        ).toMatchObject({
          type: "object",
          properties: { csrfToken: { type: "string" } },
        });
        expect(resposta.responses["401"]).toBeDefined();

        // nenhum exemplo de token — nem real, nem plausível
        expect(serializado).not.toMatch(/"example"/);
        expect(serializado).not.toContain(secondToken);

        // o documento não declara esquema de autenticação nenhum; declarar um
        // que não corresponda ao cookie de sessão seria enganoso (DP-W-11
        // segue pendente, ADR 0009).
        expect(document.components?.securitySchemes).toBeUndefined();
        expect(resposta.security).toBeUndefined();
      } finally {
        await documentApp.close();
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
    let colaboradorCompanyAId: string;

    async function login(
      email: string,
      password: string,
    ): Promise<{ cookie: string; csrfToken: string }> {
      const response = await agent()
        .post("/v1/auth/login")
        .send({ email, password })
        .expect(200);

      const cookies = response.headers["set-cookie"] as unknown as string[];
      const sessionCookie = cookies
        .find((c) => c.startsWith("evolli_session="))!
        .split(";")[0]!;
      return { cookie: sessionCookie, csrfToken: response.body.csrfToken };
    }

    beforeAll(async () => {
      app = await buildApp();
      prisma = new PrismaClient({ datasources: { db: { url: appUrl } } });

      // Reautentica como admin (sessão anterior foi revogada no describe
      // anterior) só para provisionar os usuários de teste via API real.
      const admin = await login(
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

      // Alvo legítimo na MESMA empresa do RH (empresa-a): o RH pode alterar o
      // papel deste usuário. Usado para provar que, mesmo com autorização
      // válida sobre o alvo, o escopo permanece imutável (T029).
      const colaboradorA = await agent()
        .post("/v1/users")
        .set("Cookie", admin.cookie)
        .set("x-csrf-token", admin.csrfToken)
        .send({
          email: "colaborador@empresa-a.test",
          password: "senha-do-colaborador-a-bem-longa",
          role: "colaborador",
          companyId: "empresa-a",
        })
        .expect(201);
      colaboradorCompanyAId = colaboradorA.body.id;

      const rh = await login(rhEmail, "senha-do-rh-empresa-a-bem-longa");
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

    describe("T029 — escopo de empresa é imutável em PATCH /:id/role", () => {
      async function escopoDoAlvoA() {
        const alvo = await prisma.accessUser.findUniqueOrThrow({
          where: { id: colaboradorCompanyAId },
        });
        return {
          role: alvo.role,
          companyId: alvo.companyId,
          unitId: alvo.unitId,
          teamId: alvo.teamId,
        };
      }

      it("recusa transferir usuário da própria empresa para outra empresa; empresa original permanece", async () => {
        const antes = await escopoDoAlvoA();
        expect(antes.companyId).toBe("empresa-a");

        // Autorização sobre o alvo é válida (mesma empresa do RH); a recusa vem
        // da validação de entrada, não do guard — 400, nunca aceitar.
        await agent()
          .patch(`/v1/users/${colaboradorCompanyAId}/role`)
          .set("Cookie", rhCookie)
          .set("x-csrf-token", rhCsrfToken)
          .send({ role: "dp", companyId: "empresa-b" })
          .expect(400);

        expect(await escopoDoAlvoA()).toEqual(antes);
      });

      it("recusa remover o companyId (companyId nulo no corpo); empresa original permanece", async () => {
        const antes = await escopoDoAlvoA();

        await agent()
          .patch(`/v1/users/${colaboradorCompanyAId}/role`)
          .set("Cookie", rhCookie)
          .set("x-csrf-token", rhCsrfToken)
          .send({ role: "dp", companyId: null })
          .expect(400);

        expect(await escopoDoAlvoA()).toEqual(antes);
      });

      it("recusa alterar unitId; escopo original permanece", async () => {
        const antes = await escopoDoAlvoA();

        await agent()
          .patch(`/v1/users/${colaboradorCompanyAId}/role`)
          .set("Cookie", rhCookie)
          .set("x-csrf-token", rhCsrfToken)
          .send({ role: "dp", unitId: "unidade-x" })
          .expect(400);

        expect(await escopoDoAlvoA()).toEqual(antes);
      });

      it("recusa alterar teamId; escopo original permanece", async () => {
        const antes = await escopoDoAlvoA();

        await agent()
          .patch(`/v1/users/${colaboradorCompanyAId}/role`)
          .set("Cookie", rhCookie)
          .set("x-csrf-token", rhCsrfToken)
          .send({ role: "dp", teamId: "equipe-x" })
          .expect(400);

        expect(await escopoDoAlvoA()).toEqual(antes);
      });

      it("RH da empresa A não altera papel de usuário da empresa B, mesmo sem enviar escopo (403)", async () => {
        await agent()
          .patch(`/v1/users/${colaboradorCompanyBId}/role`)
          .set("Cookie", rhCookie)
          .set("x-csrf-token", rhCsrfToken)
          .send({ role: "dp" })
          .expect(403);

        const alvoB = await prisma.accessUser.findUniqueOrThrow({
          where: { id: colaboradorCompanyBId },
        });
        expect(alvoB.role).toBe("colaborador");
        expect(alvoB.companyId).toBe("empresa-b");
      });

      it("altera apenas o papel (sem campos de escopo) e preserva a empresa original", async () => {
        const response = await agent()
          .patch(`/v1/users/${colaboradorCompanyAId}/role`)
          .set("Cookie", rhCookie)
          .set("x-csrf-token", rhCsrfToken)
          .send({ role: "dp" })
          .expect(200);

        // Papel mudou; escopo intacto.
        expect(response.body.role).toBe("dp");
        expect(response.body.companyId).toBe("empresa-a");
        expect(response.body.unitId).toBeNull();
        expect(response.body.teamId).toBeNull();

        const depois = await escopoDoAlvoA();
        expect(depois).toEqual({
          role: "dp",
          companyId: "empresa-a",
          unitId: null,
          teamId: null,
        });
      });

      it("nenhuma resposta expõe dado sensível além do necessário", async () => {
        // Resposta de sucesso: projeção segura, sem segredo de credencial.
        const ok = await agent()
          .patch(`/v1/users/${colaboradorCompanyAId}/role`)
          .set("Cookie", rhCookie)
          .set("x-csrf-token", rhCsrfToken)
          .send({ role: "gestor" })
          .expect(200);
        expect(Object.keys(ok.body).sort()).toEqual([
          "companyId",
          "createdAt",
          "email",
          "id",
          "role",
          "status",
          "teamId",
          "unitId",
        ]);
        expect(ok.body).not.toHaveProperty("passwordHash");
        expect(JSON.stringify(ok.body)).not.toMatch(/senha|password|hash/i);

        // Resposta de erro de validação: envelope genérico, sem vazar
        // credencial, stack, SQL nem nome de tabela.
        const erro = await agent()
          .patch(`/v1/users/${colaboradorCompanyAId}/role`)
          .set("Cookie", rhCookie)
          .set("x-csrf-token", rhCsrfToken)
          .send({ role: "dp", companyId: "empresa-b" })
          .expect(400);
        const serializado = JSON.stringify(erro.body);
        expect(serializado).not.toMatch(/passwordHash|senha|argon2/i);
        expect(serializado).not.toMatch(/select |from |where |prisma/i);
        expect(serializado).not.toMatch(/\bat .+\.ts:\d+/);
      });
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
      expect(afterWindow.body.csrfToken).toEqual(expect.any(String));
    });
  });
});
