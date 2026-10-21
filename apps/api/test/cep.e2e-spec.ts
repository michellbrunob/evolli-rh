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
import { CEP_LIMITE_CONSULTAS } from "../src/cep/cep.service";
import {
  FORNECEDOR_CEP,
  FornecedorCep,
  ResultadoFornecedorCep,
} from "../src/cep/cep.types";

/**
 * T178 — rota interna de consulta de CEP (`GET /v1/cep/:cep`), com o
 * fornecedor trocado por um FALSO: nenhum teste sai para a rede.
 *
 * Prova: só quem admite (`rh`, `dp`) consulta; o navegador recebe só a
 * sugestão; o fornecedor recebe **só o CEP** — nem nome, nem e-mail, nem
 * empresa, nem usuário —; CEP fora da forma nunca chega a ele; inexistente,
 * indisponível e limite têm resposta própria; e nada é gravado no banco.
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
const SENHA_PADRAO = "Cep!Assistido#2026";

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

/** Fornecedor falso: registra o que recebe e responde o que o teste mandar. */
class FornecedorFalso implements FornecedorCep {
  readonly nome = "falso";
  recebidos: unknown[][] = [];
  proxima: ResultadoFornecedorCep = { tipo: "inexistente" };

  consultar(...args: unknown[]): Promise<ResultadoFornecedorCep> {
    this.recebidos.push(args);
    return Promise.resolve(this.proxima);
  }
}

describe("CEP — preenchimento assistido (T178, e2e)", () => {
  let container: StartedTestContainer;
  let app: INestApplication;
  let prisma: PrismaClient;
  const fornecedor = new FornecedorFalso();

  let master: Credencial;
  let rhA: Credencial;
  let rhB: Credencial;
  let dpA: Credencial;
  let gestorA: Credencial;
  let colaboradorA: Credencial;

  const agent = () => request(app.getHttpServer());

  async function login(email: string, senha: string): Promise<Credencial> {
    const response = await agent()
      .post("/v1/auth/login")
      .send({ email, password: senha })
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
  const consultar = (cep: string, cred: Credencial) =>
    agent().get(`/v1/cep/${cep}`).set("Cookie", cred.cookie);

  async function criarUsuario(
    email: string,
    role: string,
    companyId: string,
  ): Promise<Credencial> {
    await post("/v1/users", master)
      .send({ email, password: SENHA_PADRAO, role, companyId })
      .expect(201);
    return login(email, SENHA_PADRAO);
  }

  const encontrado: ResultadoFornecedorCep = {
    tipo: "encontrado",
    endereco: {
      cep: "30140071",
      logradouro: "Avenida Sintetica",
      bairro: "Bairro Sintetico",
      cidade: "Cidade Sintetica",
      uf: "MG",
      estado: "Minas Gerais",
    },
  };

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
    const appUrl = `postgresql://evolli_app:${APP_PASSWORD}@${host}:${port}/${ADMIN_DB}?schema=app`;
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
    })
      .overrideProvider(FORNECEDOR_CEP)
      .useValue(fornecedor)
      .compile();
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
        email: "master.cep@example.test",
        passwordHash: await new PasswordHashService().hash(SENHA_PADRAO),
        role: "master_tecnico",
        status: "active",
      },
    });
    master = await login("master.cep@example.test", SENHA_PADRAO);
    const empresa = async (codigo: string) =>
      (
        await post("/v1/empresas", master)
          .send({ codigo, nome: `Empresa ${codigo}` })
          .expect(201)
      ).body.id as string;
    const empresaA = await empresa("CEPA");
    const empresaB = await empresa("CEPB");
    rhA = await criarUsuario("rh.cepa@example.test", "rh", empresaA);
    rhB = await criarUsuario("rh.cepb@example.test", "rh", empresaB);
    dpA = await criarUsuario("dp.cepa@example.test", "dp", empresaA);
    gestorA = await criarUsuario(
      "gestor.cepa@example.test",
      "gestor",
      empresaA,
    );
    colaboradorA = await criarUsuario(
      "colab.cepa@example.test",
      "colaborador",
      empresaA,
    );
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    await app?.close();
    await container?.stop();
  });

  beforeEach(() => {
    fornecedor.recebidos = [];
    fornecedor.proxima = encontrado;
  });

  it("rh consulta: 200 com a sugestão, no-store, e o fornecedor recebe SÓ o CEP", async () => {
    const r = await consultar("30140071", rhA).expect(200);
    expect(r.body).toEqual({
      cep: "30140071",
      logradouro: "Avenida Sintetica",
      bairro: "Bairro Sintetico",
      cidade: "Cidade Sintetica",
      uf: "MG",
      estado: "Minas Gerais",
    });
    expect(r.headers["cache-control"]).toBe("no-store");
    expect(fornecedor.recebidos).toEqual([["30140071"]]);
  });

  it("dp e rh de outra empresa também consultam; cada um manda só o CEP", async () => {
    await consultar("30140071", dpA).expect(200);
    await consultar("01001000", rhB).expect(200);
    expect(fornecedor.recebidos).toEqual([["30140071"], ["01001000"]]);
  });

  it.each([
    ["master_tecnico (não admite)", () => master],
    ["gestor", () => gestorA],
    ["colaborador", () => colaboradorA],
  ])("%s não consulta, e nada chega ao fornecedor", async (_papel, cred) => {
    const r = await consultar("30140071", cred());
    expect([403, 404]).toContain(r.status);
    expect(fornecedor.recebidos).toEqual([]);
  });

  it("sem sessão: 401, e nada chega ao fornecedor", async () => {
    await agent().get("/v1/cep/30140071").expect(401);
    expect(fornecedor.recebidos).toEqual([]);
  });

  it.each(["3014007", "301400711", "30140-071", "abcdefgh", "3014007a"])(
    "CEP fora da forma (%s): 400 e o fornecedor não é chamado",
    async (cep) => {
      await consultar(encodeURIComponent(cep), rhA).expect(400);
      expect(fornecedor.recebidos).toEqual([]);
    },
  );

  it("CEP inexistente: 404", async () => {
    fornecedor.proxima = { tipo: "inexistente" };
    await consultar("99999999", rhA).expect(404);
  });

  it.each(["timeout", "falha"] as const)(
    "fornecedor indisponível (%s): 503",
    async (motivo) => {
      fornecedor.proxima = { tipo: "indisponivel", motivo };
      await consultar("30140071", rhA).expect(503);
    },
  );

  it("nada é gravado no banco: nem cache de endereço, nem trilha com valores", async () => {
    const antes = await prisma.auditEvent.count();
    await consultar("30140071", rhA).expect(200);
    expect(await prisma.auditEvent.count()).toBe(antes);
    const enderecos = await prisma.enderecoColaborador.count();
    expect(enderecos).toBe(0);
  });

  it("limite por usuário: passado o limite, 429 sem chamar o fornecedor", async () => {
    const rhLimite = await criarUsuario(
      "rh.limite@example.test",
      "rh",
      (
        await prisma.accessUser.findFirstOrThrow({
          where: { email: "rh.cepa@example.test" },
        })
      ).companyId!,
    );
    for (let i = 0; i < CEP_LIMITE_CONSULTAS; i += 1) {
      await consultar("30140071", rhLimite).expect(200);
    }
    fornecedor.recebidos = [];
    await consultar("30140071", rhLimite).expect(429);
    expect(fornecedor.recebidos).toEqual([]);
    // A cota é por usuário: outro rh segue consultando.
    await consultar("30140071", rhB).expect(200);
  });
});
