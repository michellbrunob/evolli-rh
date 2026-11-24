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
import {
  camposObrigatoriosAdmissao,
  lotacaoMinima,
} from "./admissao-obrigatoria";

/**
 * T215 — conferência do CPF enquanto o RH digita no Novo colaborador:
 * `POST /v1/colaboradores/cpf-em-uso` com o CPF no corpo. Responde só
 * `{ emUso }`, na empresa ativa, sem gravar nada. PostgreSQL real e efêmero
 * (Testcontainers), migrations do zero.
 *
 * **Todos os dados são sintéticos.** CPFs gerados (dígitos verificadores
 * válidos) e domínio reservado `example.test`.
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
const SENHA_PADRAO = "CpfEmUso!Sintetico#2026";

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

/** CPFs sintéticos com dígitos verificadores válidos. */
const CPF_1 = "52998224725";
const CPF_2 = "11144477735";
const CPF_3 = "39053344705";

describe("T215 — CPF já cadastrado, conferido ao digitar (e2e)", () => {
  let container: StartedTestContainer;
  let app: INestApplication;
  let prisma: PrismaClient;
  let appUrl: string;

  let master: Credencial;
  let rhA: Credencial;
  let dpA: Credencial;
  let rhB: Credencial;
  let empresaA: string;
  let empresaB: string;
  let outros: Credencial[] = [];

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


  async function criarUsuarioDireto(
    email: string,
    role: string,
    companyId: string | null,
  ): Promise<Credencial> {
    const { PasswordHashService } =
      await import("../src/auth/password/password-hash.service");
    await prisma.accessUser.create({
      data: {
        email,
        passwordHash: await new PasswordHashService().hash(SENHA_PADRAO),
        role: role as never,
        companyId,
        status: "active",
      },
    });
    return login(email);
  }

  async function admitir(
    cred: Credencial,
    empresaId: string,
    cpf: string,
  ): Promise<string> {
    const obrigatorios = camposObrigatoriosAdmissao();
    const lotacao = await lotacaoMinima(appUrl, empresaId);
    const r = await post("/v1/colaboradores", cred)
      .send({
        ...obrigatorios,
        ...lotacao,
        perfilPessoal: { ...obrigatorios.perfilPessoal, cpf },
        nome: `Pessoa Cpf ${cpf.slice(0, 3)}`,
        empresaId,
        tipo: "clt",
        dataAdmissao: "2024-01-05",
        motivoCodigo: "admissao_inicial",
      })
      .expect(201);
    return r.body.id as string;
  }

  const ROTA = "/v1/colaboradores/cpf-em-uso";

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
        email: "master.cpf@example.test",
        passwordHash: await new PasswordHashService().hash(SENHA_PADRAO),
        role: "master_tecnico",
        status: "active",
      },
    });
    master = await login("master.cpf@example.test");
    const empresa = async (codigo: string) =>
      (
        await post("/v1/empresas", master)
          .send({ codigo, nome: `Empresa ${codigo}` })
          .expect(201)
      ).body.id as string;
    empresaA = await empresa("CPFA");
    empresaB = await empresa("CPFB");
    rhA = await criarUsuarioDireto("rh.cpfa@example.test", "rh", empresaA);
    dpA = await criarUsuarioDireto("dp.cpfa@example.test", "dp", empresaA);
    rhB = await criarUsuarioDireto("rh.cpfb@example.test", "rh", empresaB);
    outros = [];
    for (const papel of [
      "gestor",
      "colaborador",
      "financeiro",
      "auditor",
      "dpo",
    ]) {
      outros.push(
        await criarUsuarioDireto(`${papel}.cpfa@example.test`, papel, empresaA),
      );
    }
  });

  afterAll(async () => {
    await app?.close();
    await prisma?.$disconnect();
    await container?.stop();
  });

  it("livre antes, em uso depois da admissão; aceita a máscara; nada gravado pela consulta", async () => {
    const antes = await prisma.auditEvent.count();
    await post(ROTA, rhA)
      .send({ cpf: CPF_1 })
      .expect(200)
      .expect({ emUso: false });
    await post(ROTA, rhA)
      .send({ cpf: "529.982.247-25" })
      .expect(200)
      .expect({ emUso: false });
    // A consulta não grava trilha nem pessoa.
    expect(await prisma.auditEvent.count()).toBe(antes);
    expect(await prisma.perfilPessoalColaborador.count()).toBe(0);

    const id = await admitir(rhA, empresaA, CPF_1);
    await post(ROTA, rhA)
      .send({ cpf: "529.982.247-25" })
      .expect(200)
      .expect({ emUso: true });
    // Na edição da ficha, a própria pessoa não conta.
    await post(ROTA, rhA)
      .send({ cpf: CPF_1, ignorarColaboradorId: id })
      .expect(200)
      .expect({ emUso: false });
    // A trilha nunca leva o CPF.
    const trilha = await prisma.auditEvent.findMany();
    expect(JSON.stringify(trilha)).not.toContain(CPF_1);
  });

  it("CPF inválido, ausente ou campo a mais: 400", async () => {
    for (const corpo of [
      {},
      { cpf: "" },
      { cpf: "52998224724" },
      { cpf: "11111111111" },
      { cpf: "1234" },
      { cpf: 52998224725 },
      { cpf: CPF_2, ignorarColaboradorId: "nao-e-uuid" },
      { cpf: CPF_2, nome: "Pessoa" },
    ]) {
      await post(ROTA, rhA).send(corpo).expect(400);
    }
  });

  it("só a empresa ativa conta: o CPF de outra empresa não aparece", async () => {
    await admitir(rhB, empresaB, CPF_3);
    await post(ROTA, rhB)
      .send({ cpf: CPF_3 })
      .expect(200)
      .expect({ emUso: true });
    await post(ROTA, rhA)
      .send({ cpf: CPF_3 })
      .expect(200)
      .expect({ emUso: false });
    // E o da empresa A não aparece para a B.
    await post(ROTA, rhB)
      .send({ cpf: CPF_1 })
      .expect(200)
      .expect({ emUso: false });
  });

  it("DP também confere; master, demais papéis, sem sessão e sem CSRF não", async () => {
    await post(ROTA, dpA)
      .send({ cpf: CPF_1 })
      .expect(200)
      .expect({ emUso: true });
    await post(ROTA, master).send({ cpf: CPF_1 }).expect(403);
    for (const cred of outros) {
      await post(ROTA, cred).send({ cpf: CPF_1 }).expect(403);
    }
    await agent().post(ROTA).send({ cpf: CPF_1 }).expect(401);
    await agent()
      .post(ROTA)
      .set("Cookie", rhA.cookie)
      .send({ cpf: CPF_1 })
      .expect(403);
  });
});
