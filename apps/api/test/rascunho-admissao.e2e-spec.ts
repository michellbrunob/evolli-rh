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
 * T209 — rascunho da Nova admissão ("Salvar rascunho" persistente).
 * PostgreSQL real e efêmero (Testcontainers), migrations aplicadas do zero.
 *
 * Prova: a migration cria a tabela própria e os dois valores de auditoria;
 * RH e DP salvam, recuperam e descartam o PRÓPRIO rascunho na empresa ativa;
 * cada conta e cada empresa têm o seu; master técnico, gestor e colaborador
 * são negados; só campos do contrato atual entram (CPF recusa tudo); salvar
 * não cria colaborador; a trilha não guarda conteúdo.
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
const SENHA_PADRAO = "Rascunho!Pessoas#2026";
const ROTA = "/v1/admissoes/rascunho";

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

interface Credencial {
  cookie: string;
  csrfToken: string;
}

const DADOS = {
  etapa: 1,
  campos: { nome: "Pessoa Rascunho Sintética", tipo: "clt" },
  perfil: { dataNascimento: "1990-05-15" },
  contatos: { emailPessoal: "pessoa.rascunho@example.test" },
};

describe("T209 — rascunho da Nova admissão (e2e)", () => {
  let container: StartedTestContainer;
  let app: INestApplication;
  let prisma: PrismaClient;

  let master: Credencial;
  let rhA: Credencial;
  let dpA: Credencial;
  let rhB: Credencial;
  let gestorA: Credencial;
  let colaboradorA: Credencial;
  let empresaA: string;
  let empresaB: string;

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

  const get = (cred: Credencial) =>
    agent().get(ROTA).set("Cookie", cred.cookie);
  const put = (cred: Credencial, corpo: unknown) =>
    agent()
      .put(ROTA)
      .set("Cookie", cred.cookie)
      .set("x-csrf-token", cred.csrfToken)
      .send(corpo as object);
  const del = (cred: Credencial) =>
    agent()
      .delete(ROTA)
      .set("Cookie", cred.cookie)
      .set("x-csrf-token", cred.csrfToken);

  async function criarUsuario(
    email: string,
    role: string,
    companyId: string,
  ): Promise<Credencial> {
    await agent()
      .post("/v1/users")
      .set("Cookie", master.cookie)
      .set("x-csrf-token", master.csrfToken)
      .send({ email, password: SENHA_PADRAO, role, companyId })
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
    app = await buildApp();

    const { PasswordHashService } =
      await import("../src/auth/password/password-hash.service");
    const passwordHash = await new PasswordHashService().hash(SENHA_PADRAO);
    await prisma.accessUser.create({
      data: {
        email: "master.rascunho@example.test",
        passwordHash,
        role: "master_tecnico",
        status: "active",
      },
    });
    master = await login("master.rascunho@example.test");

    const empresa = async (codigo: string) =>
      (
        await agent()
          .post("/v1/empresas")
          .set("Cookie", master.cookie)
          .set("x-csrf-token", master.csrfToken)
          .send({ codigo, nome: `Empresa ${codigo}` })
          .expect(201)
      ).body.id as string;
    empresaA = await empresa("RASA");
    empresaB = await empresa("RASB");

    rhA = await criarUsuario("rh.rasa@example.test", "rh", empresaA);
    dpA = await criarUsuario("dp.rasa@example.test", "dp", empresaA);
    rhB = await criarUsuario("rh.rasb@example.test", "rh", empresaB);
    gestorA = await criarUsuario(
      "gestor.rasa@example.test",
      "gestor",
      empresaA,
    );
    colaboradorA = await criarUsuario(
      "colaborador.rasa@example.test",
      "colaborador",
      empresaA,
    );
  });

  afterAll(async () => {
    await app?.close();
    await prisma?.$disconnect();
    await container?.stop();
  });

  it("migration: tabela própria, unicidade por conta e empresa, CHECK e os dois valores de auditoria", async () => {
    const tabela = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*) AS n FROM information_schema.tables
        WHERE table_schema = 'app' AND table_name = 'rascunho_admissao'`,
    );
    expect(Number(tabela[0]!.n)).toBe(1);
    const valores = await prisma.$queryRawUnsafe<{ v: string }[]>(
      `SELECT unnest(enum_range(NULL::"AuditAction"))::text AS v`,
    );
    const nomes = valores.map((x) => x.v);
    expect(nomes).toContain("pessoas.rascunho_admissao.salvo");
    expect(nomes).toContain("pessoas.rascunho_admissao.descartado");
    const indice = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*) AS n FROM pg_indexes
        WHERE schemaname = 'app'
          AND indexname = 'rascunho_admissao_ator_user_id_empresa_id_key'`,
    );
    expect(Number(indice[0]!.n)).toBe(1);
  });

  it("sem rascunho, GET devolve nulo", async () => {
    const r = await get(rhA).expect(200);
    expect(r.body).toEqual({ rascunho: null });
  });

  it("RH salva, recupera e salva de novo (versão sobe); a trilha não guarda conteúdo", async () => {
    const primeiro = await put(rhA, { dados: DADOS }).expect(200);
    expect(primeiro.body.versao).toBe(1);
    const lido = await get(rhA).expect(200);
    expect(lido.body.rascunho.dados).toEqual(DADOS);
    const segundo = await put(rhA, {
      dados: { ...DADOS, etapa: 2 },
    }).expect(200);
    expect(segundo.body.versao).toBe(2);

    const eventos = await prisma.auditEvent.findMany({
      where: { action: "pessoas_rascunho_admissao_salvo" },
    });
    expect(eventos).toHaveLength(2);
    for (const evento of eventos) {
      expect(evento.resource).toBe("rascunho_admissao");
      expect(evento.companyId).toBe(empresaA);
      expect(JSON.stringify(evento)).not.toContain("Pessoa Rascunho");
      expect(JSON.stringify(evento)).not.toContain("1990-05-15");
    }
  });

  it("salvar rascunho não cria colaborador, vínculo nem movimentação", async () => {
    expect(await prisma.colaborador.count()).toBe(0);
    expect(await prisma.vinculoFuncional.count()).toBe(0);
    expect(await prisma.movimentacaoFuncional.count()).toBe(0);
  });

  it("cada conta tem o seu: o DP da mesma empresa não vê o rascunho do RH", async () => {
    expect((await get(dpA).expect(200)).body).toEqual({ rascunho: null });
    await put(dpA, {
      dados: { etapa: 0, campos: { nome: "Outra Pessoa" } },
    }).expect(200);
    expect((await get(rhA).expect(200)).body.rascunho.dados.campos.nome).toBe(
      "Pessoa Rascunho Sintética",
    );
  });

  it("cada empresa tem o seu: o RH da outra empresa não vê nada", async () => {
    expect((await get(rhB).expect(200)).body).toEqual({ rascunho: null });
  });

  it("a mesma conta noutra empresa ativa não recupera o rascunho da anterior", async () => {
    const conta = await prisma.accessUser.findUniqueOrThrow({
      where: { email: "rh.rasa@example.test" },
    });
    await prisma.accessUser.update({
      where: { id: conta.id },
      data: { companyId: empresaB },
    });
    try {
      expect((await get(rhA).expect(200)).body).toEqual({ rascunho: null });
    } finally {
      await prisma.accessUser.update({
        where: { id: conta.id },
        data: { companyId: empresaA },
      });
    }
    expect((await get(rhA).expect(200)).body.rascunho).not.toBeNull();
  });

  it.each([
    ["master técnico", () => master],
    ["gestor", () => gestorA],
    ["colaborador", () => colaboradorA],
  ])("%s não lê nem grava rascunho", async (_papel, cred) => {
    const ler = await get(cred());
    expect([403, 404]).toContain(ler.status);
    const gravar = await put(cred(), { dados: DADOS });
    expect([403, 404]).toContain(gravar.status);
  });

  it("campo fora do contrato (CPF) recusa o rascunho inteiro, sem repetir o valor", async () => {
    const r = await put(rhA, {
      dados: { ...DADOS, perfil: { cpf: "123.456.789-00" } },
    }).expect(400);
    expect(JSON.stringify(r.body)).not.toContain("123.456");
    expect((await get(rhA).expect(200)).body.rascunho.dados.perfil).toEqual(
      DADOS.perfil,
    );
  });

  it("sem CSRF, nada é gravado", async () => {
    await agent()
      .put(ROTA)
      .set("Cookie", rhA.cookie)
      .send({ dados: DADOS })
      .expect(403);
  });

  it("descartar apaga o rascunho e deixa trilha; descartar de novo não falha", async () => {
    await del(rhA).expect(204);
    expect((await get(rhA).expect(200)).body).toEqual({ rascunho: null });
    await del(rhA).expect(204);
    const eventos = await prisma.auditEvent.findMany({
      where: { action: "pessoas_rascunho_admissao_descartado" },
    });
    expect(eventos).toHaveLength(1);
    expect(eventos[0]!.resource).toBe("rascunho_admissao");
  });

  it("o banco recusa dados que não são objeto (CHECK)", async () => {
    const conta = await prisma.accessUser.findUniqueOrThrow({
      where: { email: "rh.rasb@example.test" },
    });
    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO "rascunho_admissao" (id, ator_user_id, empresa_id, dados, atualizado_em)
         VALUES ('00000000-0000-4000-8000-000000000001', $1, $2, '[1]'::jsonb, now())`,
        conta.id,
        empresaB,
      ),
    ).rejects.toThrow();
  });
});
