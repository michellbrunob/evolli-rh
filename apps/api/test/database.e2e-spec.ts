import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { INestApplication, VersioningType } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { GenericContainer, StartedTestContainer, Wait } from "testcontainers";
import { AppModule } from "../src/app.module";
import { AllExceptionsFilter } from "../src/common/filters/http-exception.filter";
import { requestIdMiddleware } from "../src/common/request-id";

/**
 * Testes reais de integração com PostgreSQL efêmero (Testcontainers).
 * Requer Docker disponível — se o Docker não conseguir subir o container,
 * este arquivo falha em `beforeAll`, não silenciosamente.
 */

jest.setTimeout(180_000);

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

describe("PostgreSQL — papéis, migrations e readiness (e2e)", () => {
  let container: StartedTestContainer;
  let migratorUrl: string;
  let appUrl: string;

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

    // Provisiona os papéis exatamente com os scripts de infra/postgres/,
    // os mesmos usados em desenvolvimento local e (futuramente) homologação.
    await runInfraScript(container, "01_create_roles.sql", [
      "-v",
      `migrator_password=${MIGRATOR_PASSWORD}`,
      "-v",
      `app_password=${APP_PASSWORD}`,
    ]);
    await runInfraScript(container, "02_schema_and_grants.sql", []);

    migratorUrl = `postgresql://evolli_migrator:${MIGRATOR_PASSWORD}@${host}:${port}/${ADMIN_DB}?schema=app`;
    appUrl = `postgresql://evolli_app:${APP_PASSWORD}@${host}:${port}/${ADMIN_DB}?schema=app`;

    // Aplica as migrations do zero com o usuário migrator — mesma ferramenta
    // (Prisma Migrate) e mesmo schema.prisma usados em produção.
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
  });

  afterAll(async () => {
    await container.stop();
  });

  it("prisma migrate deploy aplica a migration técnica do zero e registra o histórico", async () => {
    const admin = new PrismaClient({
      datasources: { db: { url: migratorUrl } },
    });
    try {
      const rows = await admin.$queryRaw<
        Array<{ count: bigint }>
      >`SELECT count(*)::bigint AS count FROM app._prisma_migrations`;
      expect(Number(rows[0]?.count ?? 0)).toBeGreaterThan(0);
    } finally {
      await admin.$disconnect();
    }
  });

  it("evolli_app não consegue executar DDL (CREATE/ALTER/DROP) no schema app", async () => {
    const appClient = new PrismaClient({
      datasources: { db: { url: appUrl } },
    });
    try {
      await expect(
        appClient.$executeRawUnsafe("CREATE TABLE app.deve_falhar (id int)"),
      ).rejects.toThrow();

      await expect(
        appClient.$executeRawUnsafe(
          "ALTER TABLE app._prisma_migrations ADD COLUMN deve_falhar int",
        ),
      ).rejects.toThrow();

      await expect(
        appClient.$executeRawUnsafe("DROP TABLE app._prisma_migrations"),
      ).rejects.toThrow();
    } finally {
      await appClient.$disconnect();
    }
  });

  describe("com banco disponível", () => {
    let app: INestApplication;

    beforeAll(async () => {
      process.env.DATABASE_URL = appUrl;

      const moduleRef: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

      app = moduleRef.createNestApplication();
      app.use(requestIdMiddleware);
      app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });
      app.useGlobalFilters(new AllExceptionsFilter());
      await app.init();
    });

    afterAll(async () => {
      await app.close();
    });

    it("GET /v1/health/ready retorna sucesso quando o banco está disponível", async () => {
      const response = await request(app.getHttpServer())
        .get("/v1/health/ready")
        .expect(200);

      expect(response.body).toEqual({
        status: "ok",
        timestamp: expect.any(String),
      });
    });

    it("GET /v1/health não consulta o banco (regressão da Fatia 1)", async () => {
      const response = await request(app.getHttpServer())
        .get("/v1/health")
        .expect(200);

      expect(response.body).toEqual({
        status: "ok",
        version: expect.any(String),
        timestamp: expect.any(String),
      });
    });
  });

  describe("com banco indisponível", () => {
    let app: INestApplication;

    beforeAll(async () => {
      // Porta 1 não tem nada escutando — simula banco indisponível sem
      // depender de derrubar o container (mantém o teste anterior isolado).
      process.env.DATABASE_URL =
        "postgresql://evolli_app:senha-teste@127.0.0.1:1/evolli_test?schema=app&connect_timeout=1&pool_timeout=1";

      const moduleRef: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

      app = moduleRef.createNestApplication();
      app.use(requestIdMiddleware);
      app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });
      app.useGlobalFilters(new AllExceptionsFilter());
      await app.init();
    });

    afterAll(async () => {
      await app.close();
      process.env.DATABASE_URL = appUrl;
    });

    it("GET /v1/health/ready retorna 503 sem detalhe interno quando o banco está indisponível", async () => {
      const response = await request(app.getHttpServer())
        .get("/v1/health/ready")
        .expect(503);

      expect(response.body).toEqual({
        status_code: 503,
        message: "Serviço temporariamente indisponível.",
        request_id: expect.any(String),
        timestamp: expect.any(String),
      });

      const bodyAsText = JSON.stringify(response.body);
      expect(bodyAsText).not.toContain("127.0.0.1");
      expect(bodyAsText).not.toContain("evolli_app");
      expect(bodyAsText).not.toContain("senha-teste");
      expect(bodyAsText).not.toContain("ECONNREFUSED");
      expect(bodyAsText).not.toContain("prisma");
    });
  });
});
