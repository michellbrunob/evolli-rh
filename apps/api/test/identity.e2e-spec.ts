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

      // A mutação protegida deste bloco (criar usuário) exige um operador com
      // capacidade — o master_tecnico (CG-RBAC-01: admin_tecnico não cria mais
      // usuário por rota). Semeado direto (análogo de teste do runbook).
      const masterEmail = "master.csrf@evolli.test";
      const masterPassword = "uma-passphrase-de-master-csrf-bem-longa";
      const { PasswordHashService } =
        await import("../src/auth/password/password-hash.service");
      await prisma.accessUser.create({
        data: {
          email: masterEmail,
          passwordHash: await new PasswordHashService().hash(masterPassword),
          role: "master_tecnico",
          status: "active",
        },
      });

      const response = await agent()
        .post("/v1/auth/login")
        .send({ email: masterEmail, password: masterPassword })
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

      // Provisiona os usuários de teste via API real. O admin_tecnico do
      // bootstrap não cria usuário por rota (CG-RBAC-01, ADR 0012): o operador
      // global é um master_tecnico, semeado direto no banco (análogo de teste do
      // runbook futuro, sujeito a MFA).
      const masterEmail = "master.identity@evolli.test";
      const masterSenha = "uma-passphrase-de-master-bem-longa";
      const { PasswordHashService } =
        await import("../src/auth/password/password-hash.service");
      await prisma.accessUser.create({
        data: {
          email: masterEmail,
          passwordHash: await new PasswordHashService().hash(masterSenha),
          role: "master_tecnico",
          status: "active",
        },
      });
      const master = await login(masterEmail, masterSenha);

      const rhEmail = "rh@empresa-a.test";
      await agent()
        .post("/v1/users")
        .set("Cookie", master.cookie)
        .set("x-csrf-token", master.csrfToken)
        .send({
          email: rhEmail,
          password: "senha-do-rh-empresa-a-bem-longa",
          role: "rh",
          companyId: "empresa-a",
        })
        .expect(201);

      const colaboradorB = await agent()
        .post("/v1/users")
        .set("Cookie", master.cookie)
        .set("x-csrf-token", master.csrfToken)
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
        .set("Cookie", master.cookie)
        .set("x-csrf-token", master.csrfToken)
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

    it("IDOR/BOLA: RH não gerencia conta de outra empresa (404 anti-enumeração, nunca 200 nem 403)", async () => {
      const response = await agent()
        .post(`/v1/users/${colaboradorCompanyBId}/disable`)
        .set("Cookie", rhCookie)
        .set("x-csrf-token", rhCsrfToken)
        .expect(404);

      // Indistinguível de "não existe": nenhuma existência, empresa, e-mail
      // ou papel do alvo é revelado (Constituição, Princípio II).
      expect(response.body).toEqual({
        status_code: 404,
        message: "Recurso não encontrado.",
        request_id: expect.any(String),
        timestamp: expect.any(String),
      });

      // A conta de B permanece intacta.
      const alvoB = await prisma.accessUser.findUniqueOrThrow({
        where: { id: colaboradorCompanyBId },
      });
      expect(alvoB.status).toBe("active");
    });

    it("IDOR/BOLA: RH não altera papel de usuário de outra empresa (404 anti-enumeração, nunca 403)", async () => {
      // Mesmo enviando escopo no corpo, o 404 do guard precede a validação —
      // não se revela sequer que o campo seria rejeitado.
      const response = await agent()
        .patch(`/v1/users/${colaboradorCompanyBId}/role`)
        .set("Cookie", rhCookie)
        .set("x-csrf-token", rhCsrfToken)
        .send({ role: "gestor", companyId: "empresa-b" })
        .expect(404);

      expect(response.body).toEqual({
        status_code: 404,
        message: "Recurso não encontrado.",
        request_id: expect.any(String),
        timestamp: expect.any(String),
      });

      const alvoB = await prisma.accessUser.findUniqueOrThrow({
        where: { id: colaboradorCompanyBId },
      });
      expect(alvoB.role).toBe("colaborador");
      expect(alvoB.companyId).toBe("empresa-b");
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

      it("RH da empresa A não altera usuário da empresa B: 404 anti-enumeração, escopo original permanece", async () => {
        const response = await agent()
          .patch(`/v1/users/${colaboradorCompanyBId}/role`)
          .set("Cookie", rhCookie)
          .set("x-csrf-token", rhCsrfToken)
          .send({ role: "dp" })
          .expect(404);

        // Nenhum metadado do alvo de outra empresa é revelado.
        expect(response.body).toEqual({
          status_code: 404,
          message: "Recurso não encontrado.",
          request_id: expect.any(String),
          timestamp: expect.any(String),
        });

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

  describe("T071 — recuperação de senha: limite específico e anti-enumeração", () => {
    let app: INestApplication;
    const agent = () => request(app.getHttpServer());
    let prisma: PrismaClient;
    const existingEmail = "recuperar-existente@empresa-a.test";

    beforeAll(async () => {
      app = await buildApp();
      prisma = new PrismaClient({ datasources: { db: { url: appUrl } } });

      const { PasswordHashService } =
        await import("../src/auth/password/password-hash.service");
      const passwordHash = await new PasswordHashService().hash(
        "senha-existente-bem-longa-123456",
      );
      await prisma.accessUser.create({
        data: {
          email: existingEmail,
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

    beforeEach(async () => {
      // Isola a janela de cada teste — o limite é por e-mail+IP na janela.
      await prisma.accessLoginAttempt.deleteMany({});
    });

    it("e-mail existente e inexistente respondem igual (202 { status: 'ok' }) — sem enumeração", async () => {
      const existe = await agent()
        .post("/v1/auth/password/forgot")
        .send({ email: existingEmail })
        .expect(202);

      const naoExiste = await agent()
        .post("/v1/auth/password/forgot")
        .send({ email: "nunca-existiu-reset@empresa-a.test" })
        .expect(202);

      expect(existe.body).toEqual({ status: "ok" });
      expect(naoExiste.body).toEqual(existe.body);
    });

    it("bloqueia após 5 solicitações por e-mail+IP — contando TODA solicitação, mesmo sem conta existente", async () => {
      const email = "conta-inexistente-reset@empresa-a.test";

      // As 5 primeiras passam e são tratadas como bem-sucedidas (202) — antes
      // da correção P2, nenhuma delas contava e o limite nunca disparava.
      for (let attempt = 0; attempt < 5; attempt += 1) {
        await agent()
          .post("/v1/auth/password/forgot")
          .send({ email })
          .expect(202);
      }

      const blocked = await agent()
        .post("/v1/auth/password/forgot")
        .send({ email })
        .expect(429);
      expect(blocked.body.message).toMatch(/Muitas requisições/);
    });

    it("bloqueia após 5 solicitações também para e-mail existente, com a mesma resposta pública", async () => {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        await agent()
          .post("/v1/auth/password/forgot")
          .send({ email: existingEmail })
          .expect(202);
      }

      await agent()
        .post("/v1/auth/password/forgot")
        .send({ email: existingEmail })
        .expect(429);
    });

    it("normaliza o e-mail: variações de caixa contam para o mesmo limite", async () => {
      const variacoes = [
        "Reset.Caixa@Empresa-A.test",
        "reset.caixa@empresa-a.test",
        "RESET.CAIXA@empresa-a.test",
        "Reset.Caixa@empresa-a.TEST",
        "rEsEt.cAiXa@EMPRESA-a.test",
      ];

      for (const email of variacoes) {
        await agent()
          .post("/v1/auth/password/forgot")
          .send({ email })
          .expect(202);
      }

      // 6ª — qualquer caixa normaliza para a mesma chave, então é barrada.
      await agent()
        .post("/v1/auth/password/forgot")
        .send({ email: "reset.caixa@empresa-a.test" })
        .expect(429);
    });

    it("não há regressão no limite de login: falha de login e recuperação usam chaves distintas", async () => {
      // 5 solicitações de recuperação para um e-mail esgotam a janela DELE...
      const email = "isolamento-reset@empresa-a.test";
      for (let attempt = 0; attempt < 5; attempt += 1) {
        await agent()
          .post("/v1/auth/password/forgot")
          .send({ email })
          .expect(202);
      }
      await agent()
        .post("/v1/auth/password/forgot")
        .send({ email })
        .expect(429);

      // ...mas NÃO afetam o limite de login do mesmo e-mail: o login usa a
      // chave sem o prefixo `reset:` e conta só falhas. A 1ª tentativa de
      // login ainda responde 401 (credencial), nunca 429.
      await agent()
        .post("/v1/auth/login")
        .send({ email, password: "qualquer-senha-123456789" })
        .expect(401);
    });
  });

  describe("T117 — fundação web: Minha conta > Sessões ativas", () => {
    let app: INestApplication;
    const agent = () => request(app.getHttpServer());
    let prisma: PrismaClient;

    let cookieA: string;
    let csrfTokenA: string;
    let cookieB: string;
    let csrfTokenB: string;
    let sessionIdB: string;

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

      const masterEmail = "master.t117@evolli.test";
      const masterSenha = "uma-passphrase-de-master-t117-bem-longa";
      const { PasswordHashService } =
        await import("../src/auth/password/password-hash.service");
      await prisma.accessUser.create({
        data: {
          email: masterEmail,
          passwordHash: await new PasswordHashService().hash(masterSenha),
          role: "master_tecnico",
          status: "active",
        },
      });
      const master = await login(masterEmail, masterSenha);

      // Dois colaboradores comuns — nenhum dos dois tem qualquer alçada sobre
      // conta alheia (evaluateOtherAccount nega por padrão para este papel).
      const emailA = "colaborador.a@t117.test";
      const senhaA = "senha-do-colaborador-a-t117-bem-longa";
      await agent()
        .post("/v1/users")
        .set("Cookie", master.cookie)
        .set("x-csrf-token", master.csrfToken)
        .send({
          email: emailA,
          password: senhaA,
          role: "colaborador",
          companyId: "empresa-t117",
        })
        .expect(201);

      const emailB = "colaborador.b@t117.test";
      const senhaB = "senha-do-colaborador-b-t117-bem-longa";
      await agent()
        .post("/v1/users")
        .set("Cookie", master.cookie)
        .set("x-csrf-token", master.csrfToken)
        .send({
          email: emailB,
          password: senhaB,
          role: "colaborador",
          companyId: "empresa-t117",
        })
        .expect(201);

      const a = await login(emailA, senhaA);
      cookieA = a.cookie;
      csrfTokenA = a.csrfToken;

      const b = await login(emailB, senhaB);
      cookieB = b.cookie;
      csrfTokenB = b.csrfToken;

      const sessionsB = await agent()
        .get("/v1/auth/sessions")
        .set("Cookie", cookieB)
        .expect(200);
      sessionIdB = sessionsB.body[0].id;
    });

    afterAll(async () => {
      await prisma.$disconnect();
      await app.close();
    });

    it("lista só as sessões da própria conta, com campos seguros (sem token/hash/cookie)", async () => {
      const resposta = await agent()
        .get("/v1/auth/sessions")
        .set("Cookie", cookieA)
        .expect(200);

      expect(resposta.body).toHaveLength(1);
      const sessao = resposta.body[0];
      expect(sessao).toMatchObject({
        id: expect.any(String),
        createdAt: expect.any(String),
        lastSeenAt: expect.any(String),
        expiresAt: expect.any(String),
      });
      expect(sessao).not.toHaveProperty("tokenHash");
      expect(sessao).not.toHaveProperty("csrfTokenHash");
      expect(sessao).not.toHaveProperty("token");
      expect(sessao).not.toHaveProperty("csrfToken");
      // Nunca vaza dado de OUTRO usuário na própria listagem.
      expect(sessao.id).not.toBe(sessionIdB);
    });

    // Roda ANTES do teste que revoga a própria sessão de A: precisa da
    // sessão de A ainda viva para tentar (sem sucesso) revogar a de B.
    it("colaborador não revoga sessão de outro usuário (403 — segue o contrato existente, nunca deixa a sessão alheia vulnerável)", async () => {
      // Um colaborador comum nunca tem a capacidade `other_account`/`manage`
      // (evaluateOtherAccount nega por padrão para este papel — diferente de
      // rh/dp/master_tecnico, que a têm para administrar conta de terceiro
      // dentro do próprio escopo). Este é o contrato JÁ existente do
      // backend, que esta tela nunca exercita: a UI de Sessões ativas só
      // opera com id vindo da própria listagem, nunca com id digitado ou de
      // outra conta.
      await agent()
        .delete(`/v1/auth/sessions/${sessionIdB}`)
        .set("Cookie", cookieA)
        .set("x-csrf-token", csrfTokenA)
        .expect(403);

      // A sessão de B, mesmo alvo da tentativa, continua íntegra.
      await agent().get("/v1/users/me").set("Cookie", cookieB).expect(200);
    });

    it("revogar um id inexistente responde 404, sem detalhe interno", async () => {
      await agent()
        .delete("/v1/auth/sessions/00000000-0000-0000-0000-000000000000")
        .set("Cookie", cookieB)
        .set("x-csrf-token", csrfTokenB)
        .expect(404);

      // A sessão de B usada para a tentativa continua íntegra.
      await agent().get("/v1/users/me").set("Cookie", cookieB).expect(200);
    });

    it("revoga a própria sessão (CSRF obrigatório) e perde acesso imediatamente", async () => {
      const sessionsAntes = await agent()
        .get("/v1/auth/sessions")
        .set("Cookie", cookieA)
        .expect(200);
      const sessionIdA: string = sessionsAntes.body[0].id;

      // Sem CSRF: recusado, sessão continua válida.
      await agent()
        .delete(`/v1/auth/sessions/${sessionIdA}`)
        .set("Cookie", cookieA)
        .expect(403);
      await agent().get("/v1/users/me").set("Cookie", cookieA).expect(200);

      // Com CSRF: revoga de fato.
      await agent()
        .delete(`/v1/auth/sessions/${sessionIdA}`)
        .set("Cookie", cookieA)
        .set("x-csrf-token", csrfTokenA)
        .expect(204);

      // A mesma sessão não dá mais acesso a nada — nem a listar sessões.
      await agent().get("/v1/users/me").set("Cookie", cookieA).expect(401);
      await agent().get("/v1/auth/sessions").set("Cookie", cookieA).expect(401);
    });
  });

  describe("T120 — GET /v1/users: listagem paginada de contas de acesso", () => {
    let app: INestApplication;
    const agent = () => request(app.getHttpServer());
    let prisma: PrismaClient;

    let masterCookie: string;
    let masterCsrfToken: string;
    let rhACookie: string;
    let rhACsrfToken: string;
    let rhAUserId: string;
    let dpACookie: string;
    let dpACsrfToken: string;
    let colaboradorACookie: string;

    let idColaboradorGestorA: string;
    let idColaboradorDesativadoA: string;
    let idColaboradorDesativadoB: string;

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

    async function criarUsuario(
      cookie: string,
      csrfToken: string,
      input: { email: string; role: string; companyId: string },
    ): Promise<string> {
      const response = await agent()
        .post("/v1/users")
        .set("Cookie", cookie)
        .set("x-csrf-token", csrfToken)
        .send({
          email: input.email,
          password: "senha-sintetica-bem-longa-t120",
          role: input.role,
          companyId: input.companyId,
        })
        .expect(201);
      return response.body.id as string;
    }

    beforeAll(async () => {
      app = await buildApp();
      prisma = new PrismaClient({ datasources: { db: { url: appUrl } } });

      const masterEmail = "master.t120@example.test";
      const masterSenha = "uma-passphrase-de-master-t120-bem-longa";
      const { PasswordHashService } =
        await import("../src/auth/password/password-hash.service");
      await prisma.accessUser.create({
        data: {
          email: masterEmail,
          passwordHash: await new PasswordHashService().hash(masterSenha),
          role: "master_tecnico",
          status: "active",
        },
      });
      const master = await login(masterEmail, masterSenha);
      masterCookie = master.cookie;
      masterCsrfToken = master.csrfToken;

      // Empresa A: rh, dp e cinco colaboradores — o suficiente para exercitar
      // paginação keyset com mais de uma página em `limit=2`.
      const rhAEmail = "rh.t120a@example.test";
      await criarUsuario(masterCookie, masterCsrfToken, {
        email: rhAEmail,
        role: "rh",
        companyId: "empresa-t120-a",
      });
      const rhA = await login(rhAEmail, "senha-sintetica-bem-longa-t120");
      rhACookie = rhA.cookie;
      rhACsrfToken = rhA.csrfToken;
      rhAUserId = (
        await prisma.accessUser.findUniqueOrThrow({
          where: { email: rhAEmail },
        })
      ).id;

      const dpAEmail = "dp.t120a@example.test";
      await criarUsuario(masterCookie, masterCsrfToken, {
        email: dpAEmail,
        role: "dp",
        companyId: "empresa-t120-a",
      });
      const dpA = await login(dpAEmail, "senha-sintetica-bem-longa-t120");
      dpACookie = dpA.cookie;
      dpACsrfToken = dpA.csrfToken;

      for (let i = 1; i <= 5; i += 1) {
        await criarUsuario(masterCookie, masterCsrfToken, {
          email: `colaborador${i}.t120a@example.test`,
          role: "colaborador",
          companyId: "empresa-t120-a",
        });
      }

      idColaboradorGestorA = await criarUsuario(masterCookie, masterCsrfToken, {
        email: "gestor.t120a@example.test",
        role: "gestor",
        companyId: "empresa-t120-a",
      });

      const colaboradorA = await login(
        "colaborador1.t120a@example.test",
        "senha-sintetica-bem-longa-t120",
      );
      colaboradorACookie = colaboradorA.cookie;

      // Um colaborador desativado na empresa A, para exercitar o filtro
      // `status` dentro do escopo do rh.
      idColaboradorDesativadoA = await criarUsuario(
        masterCookie,
        masterCsrfToken,
        {
          email: "desativado.t120a@example.test",
          role: "colaborador",
          companyId: "empresa-t120-a",
        },
      );
      await agent()
        .post(`/v1/users/${idColaboradorDesativadoA}/disable`)
        .set("Cookie", masterCookie)
        .set("x-csrf-token", masterCsrfToken)
        .expect(204);

      // Empresa B: um colaborador ativo e um desativado — só para provar que
      // filtro e escopo nunca vazam entre empresas.
      await criarUsuario(masterCookie, masterCsrfToken, {
        email: "colaborador1.t120b@example.test",
        role: "colaborador",
        companyId: "empresa-t120-b",
      });
      idColaboradorDesativadoB = await criarUsuario(
        masterCookie,
        masterCsrfToken,
        {
          email: "desativado.t120b@example.test",
          role: "colaborador",
          companyId: "empresa-t120-b",
        },
      );
      await agent()
        .post(`/v1/users/${idColaboradorDesativadoB}/disable`)
        .set("Cookie", masterCookie)
        .set("x-csrf-token", masterCsrfToken)
        .expect(204);
    });

    afterAll(async () => {
      await prisma.$disconnect();
      await app.close();
    });

    it("master_tecnico lista contas de múltiplas empresas (sem filtro de companyId)", async () => {
      const response = await agent()
        .get("/v1/users?limit=100")
        .set("Cookie", masterCookie)
        .expect(200);

      const empresas = new Set(
        response.body.items.map(
          (item: { companyId: string | null }) => item.companyId,
        ),
      );
      expect(empresas.has("empresa-t120-a")).toBe(true);
      expect(empresas.has("empresa-t120-b")).toBe(true);
    });

    it("master_tecnico filtra por companyId quando enviado", async () => {
      const response = await agent()
        .get("/v1/users?companyId=empresa-t120-b&limit=100")
        .set("Cookie", masterCookie)
        .expect(200);

      const empresas = new Set(
        response.body.items.map(
          (item: { companyId: string | null }) => item.companyId,
        ),
      );
      expect([...empresas]).toEqual(["empresa-t120-b"]);
    });

    it("rh lista somente a própria empresa", async () => {
      const response = await agent()
        .get("/v1/users?limit=100")
        .set("Cookie", rhACookie)
        .expect(200);

      const empresas = new Set(
        response.body.items.map(
          (item: { companyId: string | null }) => item.companyId,
        ),
      );
      expect([...empresas]).toEqual(["empresa-t120-a"]);

      const emails = response.body.items.map(
        (item: { email: string }) => item.email,
      );
      expect(emails).not.toContain("colaborador1.t120b@example.test");
    });

    it("companyId de outra empresa enviado por rh é ignorado (nunca usado como oráculo)", async () => {
      const response = await agent()
        .get("/v1/users?companyId=empresa-t120-b&limit=100")
        .set("Cookie", rhACookie)
        .expect(200);

      const empresas = new Set(
        response.body.items.map(
          (item: { companyId: string | null }) => item.companyId,
        ),
      );
      // Resultado permanece o da PRÓPRIA empresa do rh — nunca da empresa B.
      expect([...empresas]).toEqual(["empresa-t120-a"]);
    });

    it("dp lista somente a própria empresa e continua sem criar ou alterar papel", async () => {
      const response = await agent()
        .get("/v1/users?limit=100")
        .set("Cookie", dpACookie)
        .expect(200);

      const empresas = new Set(
        response.body.items.map(
          (item: { companyId: string | null }) => item.companyId,
        ),
      );
      expect([...empresas]).toEqual(["empresa-t120-a"]);

      // Regressão: dp ganhou LEITURA nesta tarefa — nada de escrita. Continua
      // sem criar conta nem alterar papel (evaluateUserRole inalterado).
      await agent()
        .post("/v1/users")
        .set("Cookie", dpACookie)
        .set("x-csrf-token", dpACsrfToken)
        .send({
          email: "novo.dp-tentativa@example.test",
          password: "senha-sintetica-bem-longa-t120",
          role: "colaborador",
          companyId: "empresa-t120-a",
        })
        .expect(403);

      await agent()
        .patch(`/v1/users/${idColaboradorGestorA}/role`)
        .set("Cookie", dpACookie)
        .set("x-csrf-token", dpACsrfToken)
        .send({ role: "colaborador" })
        .expect(403);
    });

    it("papel sem permissão (colaborador) recebe 403 ao tentar listar", async () => {
      await agent()
        .get("/v1/users")
        .set("Cookie", colaboradorACookie)
        .expect(403);
    });

    it("sem sessão, 401 genérico", async () => {
      await agent().get("/v1/users").expect(401);
    });

    it("filtro status retorna só contas desativadas dentro do escopo — nunca de outra empresa", async () => {
      const response = await agent()
        .get("/v1/users?status=disabled&limit=100")
        .set("Cookie", rhACookie)
        .expect(200);

      const items = response.body.items as Array<{
        id: string;
        status: string;
      }>;
      expect(items.every((item) => item.status === "disabled")).toBe(true);
      const ids = items.map((item) => item.id);
      expect(ids).toContain(idColaboradorDesativadoA);
      expect(ids).not.toContain(idColaboradorDesativadoB);
    });

    it("filtro role retorna só contas do papel pedido dentro do escopo", async () => {
      const response = await agent()
        .get("/v1/users?role=gestor&limit=100")
        .set("Cookie", rhACookie)
        .expect(200);

      const items = response.body.items as Array<{ id: string; role: string }>;
      expect(items.every((item) => item.role === "gestor")).toBe(true);
      expect(items.map((item) => item.id)).toContain(idColaboradorGestorA);
    });

    it("cursor inválido responde 400 genérico, sem detalhe interno", async () => {
      // Construído deterministicamente (mesmo formato do util-spec): base64url
      // de um payload SEM data parseável antes do separador — nunca depende de
      // uma string arbitrária "por sorte" não decodificar em algo válido.
      const cursorInvalido = Buffer.from(
        "nao-e-uma-data|algum-id",
        "utf8",
      ).toString("base64url");

      const response = await agent()
        .get(`/v1/users?cursor=${encodeURIComponent(cursorInvalido)}`)
        .set("Cookie", rhACookie)
        .expect(400);

      expect(response.body).toEqual({
        status_code: 400,
        message: "Requisição inválida.",
        request_id: expect.any(String),
        timestamp: expect.any(String),
      });
    });

    it("paginação keyset: percorre todas as páginas sem duplicar nem pular registros", async () => {
      const idsColetados: string[] = [];
      let cursor: string | null = null;

      do {
        const query: string = cursor
          ? `?limit=2&cursor=${encodeURIComponent(cursor)}`
          : "?limit=2";
        const response: {
          body: { items: { id: string }[]; nextCursor: string | null };
        } = await agent()
          .get(`/v1/users${query}`)
          .set("Cookie", rhACookie)
          .expect(200);

        expect(response.body.items.length).toBeLessThanOrEqual(2);
        idsColetados.push(
          ...response.body.items.map((item: { id: string }) => item.id),
        );
        cursor = response.body.nextCursor;
      } while (cursor !== null);

      // Sem duplicatas.
      expect(new Set(idsColetados).size).toBe(idsColetados.length);

      // Cobre TODAS as contas da empresa A vistas pelo rh (ele mesmo + dp +
      // 5 colaboradores + 1 gestor + 1 desativado) — nenhuma pulada.
      const totalEmpresaA = await prisma.accessUser.count({
        where: { companyId: "empresa-t120-a" },
      });
      expect(idsColetados.length).toBe(totalEmpresaA);
    });

    it("resposta contém exclusivamente a projeção segura (toSafeUser)", async () => {
      const response = await agent()
        .get("/v1/users?limit=1")
        .set("Cookie", rhACookie)
        .expect(200);

      const item = response.body.items[0];
      expect(Object.keys(item).sort()).toEqual([
        "companyId",
        "createdAt",
        "email",
        "id",
        "role",
        "status",
        "teamId",
        "unitId",
      ]);
    });

    it("nenhuma resposta (sucesso ou erro) vaza segredo, SQL ou stack trace", async () => {
      const ok = await agent()
        .get("/v1/users?limit=5")
        .set("Cookie", rhACookie)
        .expect(200);
      const serializadoOk = JSON.stringify(ok.body);
      expect(serializadoOk).not.toMatch(/passwordHash|senha|argon2|hash/i);
      expect(serializadoOk).not.toMatch(/token|cookie|csrf/i);
      expect(serializadoOk).not.toMatch(/userAgent|user-agent/i);

      const cursorInvalido = Buffer.from(
        "nao-e-uma-data|algum-id",
        "utf8",
      ).toString("base64url");
      const erro = await agent()
        .get(`/v1/users?cursor=${encodeURIComponent(cursorInvalido)}`)
        .set("Cookie", rhACookie)
        .expect(400);
      const serializadoErro = JSON.stringify(erro.body);
      expect(serializadoErro).not.toMatch(/select |from |where |prisma/i);
      expect(serializadoErro).not.toMatch(/\bat .+\.ts:\d+/);
    });

    it("consulta gera evento de auditoria (users_listed) sem segredo", async () => {
      const antes = await prisma.auditEvent.count({
        where: { action: "users_listed", actorUserId: rhAUserId },
      });

      await agent()
        .get("/v1/users?limit=1")
        .set("Cookie", rhACookie)
        .expect(200);

      const eventos = await prisma.auditEvent.findMany({
        where: { action: "users_listed", actorUserId: rhAUserId },
        orderBy: { occurredAt: "desc" },
      });

      expect(eventos.length).toBe(antes + 1);
      const ultimo = eventos[0]!;
      expect(ultimo.actorRole).toBe("rh");
      expect(ultimo.companyId).toBe("empresa-t120-a");
      expect(ultimo.result).toBe("success");
      expect(JSON.stringify(ultimo)).not.toMatch(/senha|password|hash|token/i);
    });

    it("regressão: autoelevação, papel privilegiado, autoatendimento e escopo entre empresas continuam bloqueados", async () => {
      // Autoelevação: rh não altera o próprio papel.
      await agent()
        .patch(`/v1/users/${rhAUserId}/role`)
        .set("Cookie", rhACookie)
        .set("x-csrf-token", rhACsrfToken)
        .send({ role: "master_tecnico" })
        .expect(403);

      // Papel privilegiado: rh não cria admin_tecnico.
      await agent()
        .post("/v1/users")
        .set("Cookie", rhACookie)
        .set("x-csrf-token", rhACsrfToken)
        .send({
          email: "tentativa-privilegiada@example.test",
          password: "senha-sintetica-bem-longa-t120",
          role: "admin_tecnico",
          companyId: "empresa-t120-a",
        })
        .expect(403);

      // Alteração da própria conta via other_account: rh não desativa a si
      // mesmo por esta rota (evaluateOtherAccount nega "gerenciar" o próprio
      // usuário, independentemente de ele agora também poder LISTAR contas).
      await agent()
        .post(`/v1/users/${rhAUserId}/disable`)
        .set("Cookie", rhACookie)
        .set("x-csrf-token", rhACsrfToken)
        .expect(403);

      // Escopo entre empresas: rh não desativa conta da empresa B — 404
      // anti-enumeração, nunca 403 (mesmo que a listagem já mostre que ele
      // não vê aquela empresa, a rota de gerenciamento não revela existência).
      const colaboradorB = await prisma.accessUser.findUniqueOrThrow({
        where: { email: "colaborador1.t120b@example.test" },
      });
      const negado = await agent()
        .post(`/v1/users/${colaboradorB.id}/disable`)
        .set("Cookie", rhACookie)
        .set("x-csrf-token", rhACsrfToken)
        .expect(404);
      expect(negado.body).toEqual({
        status_code: 404,
        message: "Recurso não encontrado.",
        request_id: expect.any(String),
        timestamp: expect.any(String),
      });

      const aindaAtiva = await prisma.accessUser.findUniqueOrThrow({
        where: { id: colaboradorB.id },
      });
      expect(aindaAtiva.status).toBe("active");
    });
  });
});
