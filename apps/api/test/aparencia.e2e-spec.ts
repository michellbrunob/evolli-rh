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

/**
 * T210 — Configurações › Aparência: o tema da PRÓPRIA conta. PostgreSQL real
 * e efêmero (Testcontainers), migrations do zero.
 *
 * Prova: o padrão é `null` (Azul Institucional); a pessoa grava o próprio
 * tema e ele volta em nova sessão; valor fora da lista é 400; sem CSRF é 403;
 * a gravação de uma conta não muda a de outra; todo papel grava o seu; o
 * banco recusa código fora da lista.
 *
 * **Todos os dados são sintéticos.** Domínio reservado `example.test`.
 */

jest.setTimeout(600_000);

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
const SENHA_PADRAO = "Nova!Empresa#Cadastro#2026";

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
      `Falha ao executar ${fileName} (exit ${result.exitCode}): ${result.output}`,
    );
  }
}

interface Credencial {
  cookie: string;
  csrfToken: string;
}

describe("T210 — tema da própria conta (e2e)", () => {
  let container: StartedTestContainer;
  let app: INestApplication;
  let prisma: PrismaClient;
  let appUrl: string;

  let master: Credencial;
  let empresaA: string;

  const agent = () => request(app.getHttpServer());

  async function login(email: string): Promise<Credencial> {
    const response = await agent()
      .post("/v1/auth/login")
      .send({ email, password: SENHA_PADRAO })
      .expect(200);
    const cookies = response.headers["set-cookie"] as unknown as string[];
    const cookie = cookies
      .find((c) => c.startsWith("evolli_session="))!
      .split(";")[0]!;
    return { cookie, csrfToken: response.body.csrfToken };
  }

  function post(rota: string, cred: Credencial) {
    return agent()
      .post(rota)
      .set("Cookie", cred.cookie)
      .set("x-csrf-token", cred.csrfToken);
  }

  function patch(rota: string, cred: Credencial) {
    return agent()
      .patch(rota)
      .set("Cookie", cred.cookie)
      .set("x-csrf-token", cred.csrfToken);
  }

  function get(rota: string, cred: Credencial) {
    return agent().get(rota).set("Cookie", cred.cookie);
  }

  async function criarUsuario(
    email: string,
    role: string,
  ): Promise<Credencial> {
    await post("/v1/users", master)
      .send({ email, password: SENHA_PADRAO, role, companyId: empresaA })
      .expect(201);
    return login(email);
  }

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
    await runInfraScript(container, "04_extensions.sql", []);
    const migratorUrl = `postgresql://evolli_migrator:${MIGRATOR_PASSWORD}@${host}:${port}/${ADMIN_DB}?schema=app`;
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
    process.env.DATABASE_URL = appUrl;
    prisma = new PrismaClient({ datasources: { db: { url: appUrl } } });

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
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

    const { PasswordHashService } =
      await import("../src/auth/password/password-hash.service");
    await prisma.accessUser.create({
      data: {
        email: "master.aparencia@example.test",
        passwordHash: await new PasswordHashService().hash(SENHA_PADRAO),
        role: "master_tecnico",
        status: "active",
      },
    });
    master = await login("master.aparencia@example.test");
    empresaA = (
      await post("/v1/empresas", master)
        .send({ codigo: "APA", nome: "Empresa APA" })
        .expect(201)
    ).body.id as string;
  });

  afterAll(async () => {
    await app?.close();
    await prisma?.$disconnect();
    await container?.stop();
  });

  it("migration: coluna anulável com CHECK nos quatro códigos", async () => {
    const colunas = await prisma.$queryRaw<
      { column_name: string; is_nullable: string }[]
    >`
      SELECT column_name, is_nullable FROM information_schema.columns
      WHERE table_name = 'access_user' AND column_name = 'tema_aparencia'`;
    expect(colunas).toEqual([
      { column_name: "tema_aparencia", is_nullable: "YES" },
    ]);
    await expect(
      prisma.$executeRawUnsafe(
        `UPDATE "access_user" SET "tema_aparencia" = 'roxo' WHERE email = 'master.aparencia@example.test'`,
      ),
    ).rejects.toThrow();
  });

  it("padrão: temaAparencia null em /users/me", async () => {
    const rh = await criarUsuario("rh.aparencia@example.test", "rh");
    const eu = await get("/v1/users/me", rh).expect(200);
    expect(eu.body.temaAparencia).toBeNull();
  });

  it("grava o próprio tema; a resposta é o ator; vale em nova sessão", async () => {
    const dp = await criarUsuario("dp.aparencia@example.test", "dp");
    const r = await patch("/v1/users/me/aparencia", dp)
      .send({ tema: "verde_petroleo" })
      .expect(200);
    expect(r.body.temaAparencia).toBe("verde_petroleo");
    expect(r.body.email).toBe("dp.aparencia@example.test");
    const outraSessao = await login("dp.aparencia@example.test");
    const eu = await get("/v1/users/me", outraSessao).expect(200);
    expect(eu.body.temaAparencia).toBe("verde_petroleo");
  });

  it.each([
    [{ tema: "roxo" }],
    [{ tema: "" }],
    [{ tema: null }],
    [{}],
    [{ tema: "alto_contraste", userId: "outra" }],
  ])("valor inválido %j: 400", async (corpo) => {
    const rh = await login("rh.aparencia@example.test");
    await patch("/v1/users/me/aparencia", rh).send(corpo).expect(400);
  });

  it("sem CSRF: 403; sem sessão: 401", async () => {
    const rh = await login("rh.aparencia@example.test");
    await agent()
      .patch("/v1/users/me/aparencia")
      .set("Cookie", rh.cookie)
      .send({ tema: "evolli_claro" })
      .expect(403);
    await agent()
      .patch("/v1/users/me/aparencia")
      .send({ tema: "evolli_claro" })
      .expect(401);
  });

  it("isolamento: a gravação de uma conta não muda a de outra", async () => {
    const a = await criarUsuario("rh.iso.a@example.test", "rh");
    const b = await criarUsuario("rh.iso.b@example.test", "rh");
    await patch("/v1/users/me/aparencia", a)
      .send({ tema: "alto_contraste" })
      .expect(200);
    expect(
      (await get("/v1/users/me", b).expect(200)).body.temaAparencia,
    ).toBeNull();
    expect((await get("/v1/users/me", a).expect(200)).body.temaAparencia).toBe(
      "alto_contraste",
    );
  });

  it.each([
    "gestor",
    "colaborador",
    "financeiro",
    "auditor",
    "dpo",
    "admin_tecnico",
  ])("%s grava o próprio tema", async (papel) => {
    // Papéis de política global (auditor, dpo, admin técnico) não são
    // criados pela rota de contas: entram direto no banco, como nos outros
    // E2E.
    const email = `${papel}.aparencia@example.test`;
    let cred: Credencial;
    if (["auditor", "dpo", "admin_tecnico"].includes(papel)) {
      const { PasswordHashService } =
        await import("../src/auth/password/password-hash.service");
      await prisma.accessUser.create({
        data: {
          email,
          passwordHash: await new PasswordHashService().hash(SENHA_PADRAO),
          role: papel as "auditor" | "dpo" | "admin_tecnico",
          status: "active",
        },
      });
      cred = await login(email);
    } else {
      cred = await criarUsuario(email, papel);
    }
    const r = await patch("/v1/users/me/aparencia", cred)
      .send({ tema: "evolli_claro" })
      .expect(200);
    expect(r.body.temaAparencia).toBe("evolli_claro");
  });

  it("master técnico (sem empresa) grava o próprio tema", async () => {
    const r = await patch("/v1/users/me/aparencia", master)
      .send({ tema: "azul_institucional" })
      .expect(200);
    expect(r.body.temaAparencia).toBe("azul_institucional");
  });

  it("a troca de tema não gera evento de auditoria", async () => {
    const rh = await login("rh.aparencia@example.test");
    const antes = await prisma.auditEvent.count();
    await patch("/v1/users/me/aparencia", rh)
      .send({ tema: "verde_petroleo" })
      .expect(200);
    expect(await prisma.auditEvent.count()).toBe(antes);
  });
});
