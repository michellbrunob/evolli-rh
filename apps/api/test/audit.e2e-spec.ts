import { execFileSync } from "node:child_process";
import { join } from "node:path";
import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { AccessRole, PrismaClient } from "@prisma/client";
import cookieParser from "cookie-parser";
import request from "supertest";
import { GenericContainer, StartedTestContainer, Wait } from "testcontainers";
import { AppModule } from "../src/app.module";
import { AllExceptionsFilter } from "../src/common/filters/http-exception.filter";
import { requestIdMiddleware } from "../src/common/request-id";

/**
 * Etapa 0 — Fatia 4: auditoria formal e rastreabilidade (ADR 0004).
 * Integração real com PostgreSQL efêmero (Testcontainers), mesmo padrão de
 * `identity.e2e-spec.ts` (Fatia 3). Requer Docker disponível. Todos os
 * dados usados são técnicos/sintéticos — nenhum dado real de RH.
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

describe("Auditoria formal e rastreabilidade (e2e)", () => {
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

    // Nenhum script manual adicional — o REVOKE UPDATE/DELETE de evolli_app
    // em audit_event é parte da própria migration (ADR 0004 §1). Este
    // banco só passou por 01/02 (papéis/schema) e o `migrate deploy` acima;
    // `03_audit_grants.sql` (runbook auxiliar) nunca roda neste teste — os
    // testes de privilégio abaixo provam a garantia real, não a do script.
    process.env.DATABASE_URL = appUrl;
  });

  afterAll(async () => {
    await container.stop();
  });

  describe("privilégio de banco: append-only real (ADR 0004 §1)", () => {
    let appClient: PrismaClient;
    const seededEventId = "11111111-1111-1111-1111-111111111111";

    beforeAll(async () => {
      appClient = new PrismaClient({ datasources: { db: { url: appUrl } } });
      // evolli_app grava (INSERT) — controle positivo: se isto falhar, os
      // testes de UPDATE/DELETE abaixo não provariam nada.
      await appClient.$executeRawUnsafe(
        `INSERT INTO app.audit_event
           (id, occurred_at, actor_type, actor_system_id, action, resource, result, request_id, created_at)
         VALUES
           ('${seededEventId}', now(), 'system', 'e2e-seed', 'login_succeeded', 'access_user', 'success', 'req-priv-test', now())`,
      );
    });

    afterAll(async () => {
      await appClient.$disconnect();
    });

    it("evolli_app consegue SELECT em audit_event (controle positivo)", async () => {
      const rows = await appClient.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT id FROM app.audit_event WHERE id = '${seededEventId}'`,
      );
      expect(rows).toHaveLength(1);
    });

    it("evolli_app NÃO consegue UPDATE em audit_event", async () => {
      await expect(
        appClient.$executeRawUnsafe(
          `UPDATE app.audit_event SET result = 'failure' WHERE id = '${seededEventId}'`,
        ),
      ).rejects.toThrow(/permission denied/i);
    });

    it("evolli_app NÃO consegue DELETE em audit_event", async () => {
      await expect(
        appClient.$executeRawUnsafe(
          `DELETE FROM app.audit_event WHERE id = '${seededEventId}'`,
        ),
      ).rejects.toThrow(/permission denied/i);
    });
  });

  describe("fluxo via API: persistência, consulta, RBAC, correlação", () => {
    let app: INestApplication;
    const agent = () => request(app.getHttpServer());
    const adminEmail = "admin@evolli.test";
    const adminPassword = "uma-passphrase-de-bootstrap-bem-longa-audit";
    // `adminCookie` = admin_tecnico do bootstrap, mantido só para PROVAR que
    // NÃO lê mais a trilha (CG-RBAC-01). `masterCookie` = master_tecnico
    // semeado, que agora lê a trilha e provisiona os usuários de teste.
    let adminCookie: string;
    let adminCsrfToken: string;
    let adminUserId: string;
    let masterCookie: string;
    let masterCsrfToken: string;

    async function login(
      email: string,
      password: string,
      requestId?: string,
    ): Promise<{ cookie: string; csrfToken: string; requestId: string }> {
      const req = agent().post("/v1/auth/login");
      if (requestId) {
        req.set("x-request-id", requestId);
      }
      const response = await req.send({ email, password }).expect(200);

      const cookies = response.headers["set-cookie"] as unknown as string[];
      const sessionCookie = cookies
        .find((c) => c.startsWith("evolli_session="))!
        .split(";")[0]!;
      return {
        cookie: sessionCookie,
        csrfToken: response.body.csrfToken,
        requestId: response.headers["x-request-id"] as string,
      };
    }

    async function createUserWithRole(
      role: AccessRole,
      email: string,
      password: string,
    ): Promise<void> {
      await agent()
        .post("/v1/users")
        .set("Cookie", masterCookie)
        .set("x-csrf-token", masterCsrfToken)
        .send({ email, password, role, companyId: "empresa-auditoria" })
        .expect(201);
    }

    beforeAll(async () => {
      app = await buildApp();

      const bootstrap = runBootstrap({
        DATABASE_URL: appUrl,
        ADMIN_BOOTSTRAP_EMAIL: adminEmail,
        ADMIN_BOOTSTRAP_PASSWORD: adminPassword,
      });
      expect(bootstrap.status).toBe(0);

      const admin = await login(adminEmail, adminPassword);
      adminCookie = admin.cookie;
      adminCsrfToken = admin.csrfToken;

      // Master semeado: único acesso global standing (ADR 0012). Lê a trilha e
      // provisiona os usuários de teste — o admin_tecnico não faz mais isso.
      const masterEmail = "master.audit@evolli.test";
      const masterPassword = "uma-passphrase-de-master-audit-bem-longa";
      const prisma = new PrismaClient({ datasources: { db: { url: appUrl } } });
      try {
        const adminUser = await prisma.accessUser.findUniqueOrThrow({
          where: { email: adminEmail },
        });
        adminUserId = adminUser.id;

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
      } finally {
        await prisma.$disconnect();
      }

      const masterCred = await login(masterEmail, masterPassword);
      masterCookie = masterCred.cookie;
      masterCsrfToken = masterCred.csrfToken;
    });

    afterAll(async () => {
      await app.close();
    });

    it("login bem-sucedido gera evento de auditoria persistido e consultável", async () => {
      const response = await agent()
        .get("/v1/audit/events")
        .query({ action: "login_succeeded", actorUserId: adminUserId })
        .set("Cookie", masterCookie)
        .expect(200);

      expect(response.body.total).toBeGreaterThanOrEqual(1);
      expect(response.body.items.length).toBeGreaterThanOrEqual(1);
      const event = response.body.items[0];
      expect(event).toMatchObject({
        action: "login_succeeded",
        actorType: "user",
        actorUserId: adminUserId,
        actorRole: "admin_tecnico",
        result: "success",
      });
    });

    it("GET /v1/audit/events/:id retorna o detalhe do evento", async () => {
      const list = await agent()
        .get("/v1/audit/events")
        .query({ action: "login_succeeded", actorUserId: adminUserId })
        .set("Cookie", masterCookie)
        .expect(200);

      const eventId = list.body.items[0].id;

      const detail = await agent()
        .get(`/v1/audit/events/${eventId}`)
        .set("Cookie", masterCookie)
        .expect(200);

      expect(detail.body.id).toBe(eventId);
    });

    it("GET /v1/audit/events/:id com id inexistente retorna 404 genérico", async () => {
      const response = await agent()
        .get("/v1/audit/events/00000000-0000-0000-0000-000000000000")
        .set("Cookie", masterCookie)
        .expect(404);

      expect(response.body).toEqual({
        status_code: 404,
        message: "Recurso não encontrado.",
        request_id: expect.any(String),
        timestamp: expect.any(String),
      });
    });

    it("toda consulta bem-sucedida à trilha gera, ela mesma, um novo evento (audit_log_read)", async () => {
      await agent()
        .get("/v1/audit/events")
        .set("Cookie", masterCookie)
        .expect(200);

      // O leitor da trilha agora é o master_tecnico (CG-RBAC-01): filtra-se pela
      // ação, não pelo ator antigo (admin_tecnico deixou de ler a trilha).
      const response = await agent()
        .get("/v1/audit/events")
        .query({ action: "audit_log_read" })
        .set("Cookie", masterCookie)
        .expect(200);

      expect(response.body.total).toBeGreaterThanOrEqual(1);
    });

    it("correlação por request_id: evento de login carrega o mesmo request_id da resposta HTTP", async () => {
      const customRequestId = "e2e-correlacao-login-001";
      const auditorCredentials = {
        email: "correlacao@empresa-auditoria.test",
        password: "senha-de-correlacao-bem-longa",
      };
      await createUserWithRole(
        "auditor",
        auditorCredentials.email,
        auditorCredentials.password,
      );

      const loginResult = await login(
        auditorCredentials.email,
        auditorCredentials.password,
        customRequestId,
      );
      expect(loginResult.requestId).toBe(customRequestId);

      const prisma = new PrismaClient({ datasources: { db: { url: appUrl } } });
      try {
        const events = await prisma.auditEvent.findMany({
          where: { requestId: customRequestId, action: "login_succeeded" },
        });
        expect(events).toHaveLength(1);
        expect(events[0]?.requestId).toBe(customRequestId);
      } finally {
        await prisma.$disconnect();
      }
    });

    it("RBAC negativo: RH, DP, gestor, financeiro e colaborador não leem a trilha (403)", async () => {
      const deniedRoles: Array<[AccessRole, string]> = [
        ["rh", "rh-auditoria@empresa-auditoria.test"],
        ["dp", "dp-auditoria@empresa-auditoria.test"],
        ["gestor", "gestor-auditoria@empresa-auditoria.test"],
        ["financeiro", "financeiro-auditoria@empresa-auditoria.test"],
        ["colaborador", "colaborador-auditoria@empresa-auditoria.test"],
      ];

      for (const [role, email] of deniedRoles) {
        const password = `senha-bem-longa-para-${role}-auditoria`;
        await createUserWithRole(role, email, password);
        const session = await login(email, password);

        await agent()
          .get("/v1/audit/events")
          .set("Cookie", session.cookie)
          .expect(403);
      }
    });

    it("negação de leitura da trilha gera, ela mesma, evento authorization_denied", async () => {
      const email = "negacao-auditoria@empresa-auditoria.test";
      const password = "senha-bem-longa-para-negacao-auditoria";
      await createUserWithRole("colaborador", email, password);
      const session = await login(email, password);

      await agent()
        .get("/v1/audit/events")
        .set("Cookie", session.cookie)
        .expect(403);

      const prisma = new PrismaClient({ datasources: { db: { url: appUrl } } });
      try {
        const user = await prisma.accessUser.findUniqueOrThrow({
          where: { email },
        });
        const denied = await prisma.auditEvent.findMany({
          where: { action: "authorization_denied", actorUserId: user.id },
        });
        expect(denied.length).toBeGreaterThanOrEqual(1);
        expect(denied[0]?.result).toBe("denied");
      } finally {
        await prisma.$disconnect();
      }
    });

    it("RBAC positivo: auditor e dpo leem a trilha (200)", async () => {
      const dpoEmail = "dpo-auditoria@empresa-auditoria.test";
      const dpoPassword = "senha-bem-longa-para-dpo-auditoria";
      await createUserWithRole("dpo", dpoEmail, dpoPassword);
      const dpoSession = await login(dpoEmail, dpoPassword);

      await agent()
        .get("/v1/audit/events")
        .set("Cookie", dpoSession.cookie)
        .expect(200);
    });

    it("RBAC positivo: master_tecnico lê a trilha; admin_tecnico NÃO (CG-RBAC-01)", async () => {
      // master_tecnico é o único acesso global standing e lê a trilha (T030);
      // admin_tecnico convergiu para bootstrap/histórico e deixou de lê-la.
      await agent()
        .get("/v1/audit/events")
        .set("Cookie", masterCookie)
        .expect(200);
      await agent()
        .get("/v1/audit/events")
        .set("Cookie", adminCookie)
        .expect(403);
    });

    it("sem sessão, GET /v1/audit/events retorna 401 genérico", async () => {
      await agent().get("/v1/audit/events").expect(401);
    });

    it("nenhuma rota de alteração/exclusão de evento existe (PATCH/PUT/DELETE → 404)", async () => {
      const list = await agent()
        .get("/v1/audit/events")
        .set("Cookie", masterCookie)
        .expect(200);
      const anyEventId = list.body.items[0].id;

      await agent()
        .patch(`/v1/audit/events/${anyEventId}`)
        .set("Cookie", masterCookie)
        .set("x-csrf-token", masterCsrfToken)
        .send({ result: "failure" })
        .expect(404);

      await agent()
        .delete(`/v1/audit/events/${anyEventId}`)
        .set("Cookie", masterCookie)
        .set("x-csrf-token", masterCsrfToken)
        .expect(404);

      await agent()
        .put("/v1/audit/events")
        .set("Cookie", masterCookie)
        .set("x-csrf-token", masterCsrfToken)
        .send({})
        .expect(404);
    });

    it("nenhum evento nem resposta contém senha, hash, token, cookie ou segredo em claro", async () => {
      const response = await agent()
        .get("/v1/audit/events")
        .query({ pageSize: 100 })
        .set("Cookie", masterCookie)
        .expect(200);

      const bodyAsText = JSON.stringify(response.body);
      expect(bodyAsText).not.toContain(adminPassword);
      expect(bodyAsText).not.toMatch(/argon2/i);
      expect(bodyAsText).not.toMatch(/password_hash/i);
      expect(bodyAsText).not.toMatch(/token_hash/i);
      expect(bodyAsText).not.toMatch(/csrf_token/i);
      expect(bodyAsText).not.toContain(adminCsrfToken);
      expect(bodyAsText).not.toMatch(/evolli_session=/);

      const prisma = new PrismaClient({ datasources: { db: { url: appUrl } } });
      try {
        const events = await prisma.auditEvent.findMany({ take: 200 });
        const dump = JSON.stringify(events);
        expect(dump).not.toContain(adminPassword);
        expect(dump).not.toMatch(/argon2/i);
        expect(dump).not.toContain(adminCsrfToken);
      } finally {
        await prisma.$disconnect();
      }
    });

    it("nenhuma resposta de erro deste módulo contém stack trace ou detalhe interno", async () => {
      const response = await agent()
        .get("/v1/audit/events/id-invalido-nao-uuid")
        .set("Cookie", masterCookie);

      const bodyAsText = JSON.stringify(response.body);
      expect(bodyAsText).not.toMatch(/at .*\.ts:\d+/);
      expect(response.body).not.toHaveProperty("stack");
    });

    describe("atomicidade: rollback real quando o evento não pode ser persistido (ADR 0004 §2)", () => {
      async function withAuditInsertBlocked<T>(
        fn: () => Promise<T>,
      ): Promise<T> {
        const migratorClient = new PrismaClient({
          datasources: { db: { url: migratorUrl } },
        });
        try {
          await migratorClient.$executeRawUnsafe(
            "REVOKE INSERT ON TABLE app.audit_event FROM evolli_app",
          );
          return await fn();
        } finally {
          await migratorClient.$executeRawUnsafe(
            "GRANT INSERT ON TABLE app.audit_event TO evolli_app",
          );
          await migratorClient.$disconnect();
        }
      }

      it("login: se login_succeeded não puder ser gravado, nenhuma sessão é criada e nenhum cookie é emitido", async () => {
        const email = "rollback-login@empresa-auditoria.test";
        const password = "senha-bem-longa-para-rollback-login";
        await createUserWithRole("colaborador", email, password);

        const prisma = new PrismaClient({
          datasources: { db: { url: appUrl } },
        });
        try {
          const before = await prisma.accessSession.count({
            where: { user: { email } },
          });

          const response = await withAuditInsertBlocked(() =>
            agent().post("/v1/auth/login").send({ email, password }),
          );

          expect(response.status).toBe(500);
          expect(response.headers["set-cookie"]).toBeUndefined();

          const after = await prisma.accessSession.count({
            where: { user: { email } },
          });
          expect(after).toBe(before);
        } finally {
          await prisma.$disconnect();
        }
      });

      it("desativação de usuário: se os eventos não puderem ser gravados, o usuário permanece ativo e as sessões não são revogadas", async () => {
        const email = "rollback-disable@empresa-auditoria.test";
        const password = "senha-bem-longa-para-rollback-disable";
        await createUserWithRole("colaborador", email, password);

        const prisma = new PrismaClient({
          datasources: { db: { url: appUrl } },
        });
        try {
          const target = await prisma.accessUser.findUniqueOrThrow({
            where: { email },
          });
          const targetSession = await login(email, password);

          const response = await withAuditInsertBlocked(() =>
            agent()
              .post(`/v1/users/${target.id}/disable`)
              .set("Cookie", masterCookie)
              .set("x-csrf-token", masterCsrfToken),
          );

          expect(response.status).toBe(500);

          const stillActive = await prisma.accessUser.findUniqueOrThrow({
            where: { id: target.id },
          });
          expect(stillActive.status).toBe("active");

          // A própria sessão do usuário-alvo, criada acima, precisa
          // continuar válida — a revogação em massa não pode ter ocorrido.
          await agent()
            .get("/v1/users/me")
            .set("Cookie", targetSession.cookie)
            .expect(200);
        } finally {
          await prisma.$disconnect();
        }
      });

      it("consulta à trilha: se audit_log_read não puder ser gravado, a consulta não retorna 200", async () => {
        const response = await withAuditInsertBlocked(() =>
          agent().get("/v1/audit/events").set("Cookie", masterCookie),
        );

        expect(response.status).toBe(500);
        expect(response.body).toEqual({
          status_code: 500,
          message: expect.any(String),
          request_id: expect.any(String),
          timestamp: expect.any(String),
        });
        expect(JSON.stringify(response.body)).not.toMatch(/at .*\.ts:\d+/);
      });
    });
  });
});
