import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
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
 * T209 — Aprendiz como tipo de vínculo (fatia mínima, AP-1 a AP-9). PostgreSQL
 * real e efêmero (Testcontainers), migrations aplicadas do zero.
 *
 * Prova: a migration só acrescenta o valor, depois de Estágio; RH e DP admitem
 * Aprendiz pelo fluxo normal, sem campo extra; quem não admite segue negado;
 * filtro, grupos e contadores por tipo com a chave nova, por empresa; master
 * global e escopado; o desligamento de sempre encerra o vínculo. Nenhuma regra
 * legal (prazo, idade, jornada, cota) é aplicada.
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
const SENHA_PADRAO = "Aprendiz!Pessoas#2026";
const ADMISSAO = "2026-01-05";
const DESLIGAMENTO = "2026-05-04";

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

interface ItemListado {
  id: string;
  nome: string;
  situacao: string;
  vinculos: {
    empresaId: string;
    matricula: string;
    situacao: string;
    dataAdmissao: string;
    /** T199 — tipo do vínculo. */
    tipo?: string;
  }[];
}

const MIGRATION_APRENDIZ = join(
  API_ROOT,
  "prisma",
  "migrations",
  "20261113180000_tipo_vinculo_aprendiz",
  "migration.sql",
);

describe("T209 — Aprendiz como tipo de vínculo (e2e)", () => {
  let container: StartedTestContainer;
  let appUrl: string;
  let app: INestApplication;
  let prisma: PrismaClient;

  let master: Credencial;
  let masterA: Credencial;
  let rhA: Credencial;
  let rhB: Credencial;
  let dpA: Credencial;
  let gestorA: Credencial;
  let colaboradorA: Credencial;

  let empresaA: string;
  let empresaB: string;
  let departamentoA: string;
  let departamentoB: string;

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

  async function seedMaster(email: string): Promise<Credencial> {
    const { PasswordHashService } =
      await import("../src/auth/password/password-hash.service");
    const passwordHash = await new PasswordHashService().hash(SENHA_PADRAO);
    await prisma.accessUser.create({
      data: { email, passwordHash, role: "master_tecnico", status: "active" },
    });
    return login(email, SENHA_PADRAO);
  }

  function post(rota: string, cred: Credencial) {
    return agent()
      .post(rota)
      .set("Cookie", cred.cookie)
      .set("x-csrf-token", cred.csrfToken);
  }
  function get(rota: string, cred: Credencial) {
    return agent().get(rota).set("Cookie", cred.cookie);
  }

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

  async function corpoDaAdmissao(
    nome: string,
    matricula: string,
    tipo: string,
    empresaId: string,
    departamentoId: string,
  ) {
    return {
      ...camposObrigatoriosAdmissao(),
      ...(await lotacaoMinima(appUrl, empresaId)),
      nome,
      empresaId,
      matricula,
      tipo,
      dataAdmissao: ADMISSAO,
      motivoCodigo: "admissao_inicial",
      departamentoId,
    };
  }

  /** Admite pela API; com `efetivar`, o vínculo fica ativo. */
  async function admitir(
    cred: Credencial,
    nome: string,
    matricula: string,
    tipo: string,
    empresaId: string,
    departamentoId: string,
    efetivar: boolean,
  ): Promise<{ colaboradorId: string; vinculoId: string; tipo: string }> {
    const r = await post("/v1/colaboradores", cred)
      .send(
        await corpoDaAdmissao(nome, matricula, tipo, empresaId, departamentoId),
      )
      .expect(201);
    if (efetivar) {
      await post(`/v1/movimentacoes/${r.body.movimentacao.id}/efetivar`, cred)
        .send()
        .expect(201);
    }
    return {
      colaboradorId: r.body.id,
      vinculoId: r.body.vinculo.id,
      tipo: r.body.vinculo.tipo,
    };
  }

  async function listar(
    cred: Credencial,
    query: Record<string, string> = {},
  ): Promise<{
    itens: ItemListado[];
    total: number;
    contadores: { ativosPorTipo: Record<string, number> } & Record<
      string,
      unknown
    >;
  }> {
    const qs = new URLSearchParams(query).toString();
    return (
      await get(`/v1/colaboradores${qs ? `?${qs}` : ""}`, cred).expect(200)
    ).body;
  }

  const nomes = (itens: ItemListado[]) => itens.map((i) => i.nome);

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
    app = await buildApp();
    master = await seedMaster("master.aprendiz@example.test");

    const empresa = async (codigo: string, nome: string) =>
      (await post("/v1/empresas", master).send({ codigo, nome }).expect(201))
        .body.id as string;
    empresaA = await empresa("APRA", "Empresa Aprendiz Alfa");
    empresaB = await empresa("APRB", "Empresa Aprendiz Beta");
    const departamento = async (empresaId: string, codigo: string) =>
      (
        await post("/v1/departamentos", master)
          .send({ empresaId, codigo, nome: `Depto ${codigo}` })
          .expect(201)
      ).body.id as string;
    departamentoA = await departamento(empresaA, "DEPAA");
    departamentoB = await departamento(empresaB, "DEPAB");

    rhA = await criarUsuario("rh.apra@example.test", "rh", empresaA);
    rhB = await criarUsuario("rh.aprb@example.test", "rh", empresaB);
    dpA = await criarUsuario("dp.apra@example.test", "dp", empresaA);
    gestorA = await criarUsuario(
      "gestor.apra@example.test",
      "gestor",
      empresaA,
    );
    colaboradorA = await criarUsuario(
      "colab.apra@example.test",
      "colaborador",
      empresaA,
    );
    masterA = await seedMaster("master.apra@example.test");
    await post("/v1/auth/contexto/empresa", masterA)
      .send({ empresaId: empresaA })
      .expect(200);
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    await app?.close();
    await container?.stop();
  });

  describe("migration", () => {
    it("o tipo persistido ganha 'aprendiz' logo depois de 'estagio'", async () => {
      const valores = await prisma.$queryRawUnsafe<{ enumlabel: string }[]>(
        `SELECT e.enumlabel
           FROM pg_enum e
           JOIN pg_type t ON t.oid = e.enumtypid
           JOIN pg_namespace n ON n.oid = t.typnamespace
          WHERE t.typname = 'TipoVinculo' AND n.nspname = 'app'
          ORDER BY e.enumsortorder`,
      );
      expect(valores.map((v) => v.enumlabel)).toEqual([
        "clt",
        "estagio",
        "aprendiz",
        "pj",
        "temporario",
        "outro_controlado",
        "part_time",
        "freelancer",
        "trainee",
      ]);
    });

    it("a migration só acrescenta o valor: nenhum dado existente é tocado", () => {
      const sql = readFileSync(MIGRATION_APRENDIZ, "utf8")
        .split("\n")
        .filter((l) => l.trim() !== "" && !l.trim().startsWith("--"))
        .join("\n")
        .trim();
      expect(sql).toBe(
        `ALTER TYPE "TipoVinculo" ADD VALUE 'aprendiz' AFTER 'estagio';`,
      );
    });
  });

  describe("admissão", () => {
    it("RH e DP admitem Aprendiz pelo fluxo normal, sem campo extra", async () => {
      const porRh = await admitir(
        rhA,
        "Teste Aprendiz Alfa Um",
        "APR-A-001",
        "aprendiz",
        empresaA,
        departamentoA,
        true,
      );
      expect(porRh.tipo).toBe("aprendiz");
      const porDp = await admitir(
        dpA,
        "Teste Aprendiz Alfa Dois",
        "APR-A-002",
        "aprendiz",
        empresaA,
        departamentoA,
        false,
      );
      expect(porDp.tipo).toBe("aprendiz");
      const vinculos = await get(
        `/v1/colaboradores/${porRh.colaboradorId}/vinculos`,
        rhA,
      ).expect(200);
      expect(vinculos.body.map((v: { tipo: string }) => v.tipo)).toEqual([
        "aprendiz",
      ]);
    });

    it("master técnico, gestor e colaborador não admitem Aprendiz", async () => {
      for (const cred of [masterA, gestorA, colaboradorA]) {
        await post("/v1/colaboradores", cred)
          .send(
            await corpoDaAdmissao(
              "Teste Aprendiz Negado",
              "APR-A-NEG",
              "aprendiz",
              empresaA,
              departamentoA,
            ),
          )
          .expect(403);
      }
    });

    it("RH não admite Aprendiz em outra empresa", async () => {
      const r = await post("/v1/colaboradores", rhB).send(
        await corpoDaAdmissao(
          "Teste Aprendiz Outra Empresa",
          "APR-X-001",
          "aprendiz",
          empresaA,
          departamentoA,
        ),
      );
      expect(r.status).toBeGreaterThanOrEqual(400);
      const a = await listar(rhA, { busca: "Outra Empresa" });
      expect(a.itens).toEqual([]);
    });

    it("variações fora do catálogo seguem recusadas", async () => {
      for (const tipo of ["Aprendiz", "aprendizes", "jovem_aprendiz"]) {
        await post("/v1/colaboradores", rhA)
          .send(
            await corpoDaAdmissao(
              "Teste Tipo Invalido",
              "APR-A-INV",
              tipo,
              empresaA,
              departamentoA,
            ),
          )
          .expect(400);
      }
    });
  });

  describe("listagem, filtros e contadores", () => {
    beforeAll(async () => {
      await admitir(
        rhA,
        "Teste Clt Alfa",
        "CLT-A-001",
        "clt",
        empresaA,
        departamentoA,
        true,
      );
      await admitir(
        rhB,
        "Teste Aprendiz Beta Um",
        "APR-B-001",
        "aprendiz",
        empresaB,
        departamentoB,
        true,
      );
    });

    it("o filtro por tipo traz só os Aprendizes da empresa ativa", async () => {
      const todos = await listar(rhA, { tipoVinculo: "aprendiz" });
      expect(nomes(todos.itens)).toEqual([
        "Teste Aprendiz Alfa Dois",
        "Teste Aprendiz Alfa Um",
      ]);
      const ativos = await listar(rhA, {
        grupo: "ativos",
        tipoVinculo: "aprendiz",
      });
      expect(nomes(ativos.itens)).toEqual(["Teste Aprendiz Alfa Um"]);
      const emAdmissao = await listar(rhA, {
        grupo: "em_admissao",
        tipoVinculo: "aprendiz",
      });
      expect(nomes(emAdmissao.itens)).toEqual(["Teste Aprendiz Alfa Dois"]);
      for (const item of todos.itens) {
        for (const v of item.vinculos) {
          expect(v.empresaId).toBe(empresaA);
          expect(v.tipo).toBe("aprendiz");
        }
      }
    });

    it("contadores: Aprendiz conta no próprio tipo, separado por empresa", async () => {
      const a = await listar(rhA);
      expect(a.contadores.ativosPorTipo).toEqual({
        clt: 1,
        estagio: 0,
        aprendiz: 1,
        pj: 0,
        temporario: 0,
        outro_controlado: 0,
        part_time: 0,
        freelancer: 0,
        trainee: 0,
      });
      expect(Object.keys(a.contadores.ativosPorTipo)).toEqual([
        "clt",
        "estagio",
        "aprendiz",
        "pj",
        "temporario",
        "outro_controlado",
        "part_time",
        "freelancer",
        "trainee",
      ]);
      const b = await listar(rhB);
      expect(b.contadores.ativosPorTipo.aprendiz).toBe(1);
      expect(b.contadores.ativosPorTipo.clt).toBe(0);
      const bFiltrada = await listar(rhB, { tipoVinculo: "aprendiz" });
      expect(nomes(bFiltrada.itens)).toEqual(["Teste Aprendiz Beta Um"]);
    });

    it("DP e master técnico da empresa leem o filtro; gestor e colaborador não", async () => {
      for (const cred of [dpA, masterA]) {
        const r = await listar(cred, { tipoVinculo: "aprendiz" });
        expect(nomes(r.itens)).toEqual([
          "Teste Aprendiz Alfa Dois",
          "Teste Aprendiz Alfa Um",
        ]);
      }
      for (const cred of [gestorA, colaboradorA]) {
        await get("/v1/colaboradores?tipoVinculo=aprendiz", cred).expect(403);
      }
    });

    it("o master global vê os Aprendizes das duas empresas, cada um com a sua", async () => {
      const r = await listar(master, { tipoVinculo: "aprendiz" });
      expect(nomes(r.itens)).toEqual([
        "Teste Aprendiz Alfa Dois",
        "Teste Aprendiz Alfa Um",
        "Teste Aprendiz Beta Um",
      ]);
      expect(r.contadores.ativosPorTipo.aprendiz).toBe(2);
    });
  });

  describe("encerramento pelo fluxo existente", () => {
    it("o desligamento de sempre encerra o vínculo de Aprendiz", async () => {
      const pessoa = await admitir(
        rhA,
        "Teste Aprendiz Alfa Desligado",
        "APR-A-003",
        "aprendiz",
        empresaA,
        departamentoA,
        true,
      );
      const m = await post("/v1/movimentacoes", rhA)
        .send({
          vinculoId: pessoa.vinculoId,
          tipo: "desligamento",
          motivoCodigo: "encerramento_de_vinculo",
          vigenciaInicio: DESLIGAMENTO,
        })
        .expect(201);
      await post(`/v1/movimentacoes/${m.body.id}/efetivar`, rhA)
        .send()
        .expect(201);
      const desligados = await listar(rhA, {
        grupo: "desligados",
        tipoVinculo: "aprendiz",
      });
      expect(nomes(desligados.itens)).toEqual([
        "Teste Aprendiz Alfa Desligado",
      ]);
      expect(desligados.itens[0]!.vinculos[0]!.situacao).toBe("encerrado");
    });
  });
});
