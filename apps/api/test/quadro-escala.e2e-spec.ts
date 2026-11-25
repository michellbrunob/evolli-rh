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
import { dataLocalDe } from "../src/ponto/competencia.util";
import {
  camposObrigatoriosAdmissao,
  lotacaoMinima,
} from "./admissao-obrigatoria";

/**
 * T215 — o quadro "Escala de trabalho" (`GET /v1/escala/quadro`): as pessoas
 * da empresa ativa com vínculo no período, a lotação, o gestor, a jornada do
 * contrato e os padrões que tocam o período. PostgreSQL real e efêmero
 * (Testcontainers), migrations do zero.
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
const SENHA_PADRAO = "QuadroEscala!Sintetico#2026";
/** Dia civil de hoje em São Paulo — a regra do servidor. */
const HOJE = dataLocalDe(new Date());

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

interface Turno {
  id: string;
  codigo: string | null;
  nome: string;
  ativo: boolean;
  periodos: { dia: string; inicio: string; fim: string }[];
}

interface Escala {
  id: string;
  modelo: string;
  turno: Turno | null;
  turnoNoite: Turno | null;
  folgaSemanal: number | null;
  diasTrabalho: number[];
  inicioCiclo: string | null;
  vigenciaInicio: string;
  vigenciaFim: string | null;
  definidaEm: string;
  definidaPor: string | null;
}

const ANO = Number(HOJE.slice(0, 4));
const ADMISSAO = `${ANO - 2}-01-05`;

const GRADE_COMERCIAL = [
  "segunda",
  "terca",
  "quarta",
  "quinta",
  "sexta",
].flatMap((dia) => [
  { dia, inicio: "09:00", fim: "12:00" },
  { dia, inicio: "13:00", fim: "18:00" },
]);

describe("T215 — quadro da escala (e2e)", () => {
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
  let turnoA: string;

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

  function get(rota: string, cred: Credencial) {
    return agent().get(rota).set("Cookie", cred.cookie);
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

  async function criarTurno(
    cred: Credencial,
    nome: string,
    codigo: string,
  ): Promise<string> {
    const r = await post("/v1/horarios", cred)
      .send({ codigo, nome, periodos: GRADE_COMERCIAL })
      .expect(201);
    return r.body.id as string;
  }

  const rota = (id: string) => `/v1/colaboradores/${id}/escalas`;

  function definir(id: string, corpo: Record<string, unknown>, cred = rhA) {
    return post(rota(id), cred).send(corpo);
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
        email: "master.quadro@example.test",
        passwordHash: await new PasswordHashService().hash(SENHA_PADRAO),
        role: "master_tecnico",
        status: "active",
      },
    });
    master = await login("master.quadro@example.test");
    const empresa = async (codigo: string) =>
      (
        await post("/v1/empresas", master)
          .send({ codigo, nome: `Empresa ${codigo}` })
          .expect(201)
      ).body.id as string;
    empresaA = await empresa("QUAA");
    empresaB = await empresa("QUAB");
    rhA = await criarUsuarioDireto("rh.quadroa@example.test", "rh", empresaA);
    dpA = await criarUsuarioDireto("dp.quadroa@example.test", "dp", empresaA);
    rhB = await criarUsuarioDireto("rh.quadrob@example.test", "rh", empresaB);
    outros = [];
    for (const papel of [
      "gestor",
      "colaborador",
      "financeiro",
      "auditor",
      "dpo",
    ]) {
      outros.push(
        await criarUsuarioDireto(
          `${papel}.quadroa@example.test`,
          papel,
          empresaA,
        ),
      );
    }
    turnoA = await criarTurno(rhA, "Comercial Sintetico", "COM_ESC");
  });

  afterAll(async () => {
    await app?.close();
    await prisma?.$disconnect();
    await container?.stop();
  });

  interface PessoaDoQuadro {
    colaboradorId: string;
    nome: string;
    tipoVinculo: string;
    situacao: string;
    dataAdmissao: string;
    dataDesligamento: string | null;
    departamento: { id: string; nome: string } | null;
    unidade: { id: string; nome: string } | null;
    cargo: { id: string; nome: string } | null;
    area: { id: string; nome: string } | null;
    centroCusto: { id: string; nome: string } | null;
    gestor: { id: string; nome: string } | null;
    nivel: string | null;
    genero: string | null;
    escalaDoCadastro: string | null;
    jornadaSemanalHoras: number | null;
    escalas: Escala[];
  }

  interface Quadro {
    empresaId: string;
    inicio: string;
    fim: string;
    pessoas: PessoaDoQuadro[];
  }

  /** Uma semana inteira no ano passado (segunda a domingo). */
  const SEMANA_INICIO = `${ANO - 1}-03-02`;
  const SEMANA_FIM = `${ANO - 1}-03-08`;

  const quadro = (inicio: string, fim: string, cred: Credencial = rhA) =>
    get(`/v1/escala/quadro?inicio=${inicio}&fim=${fim}`, cred);

  async function admitirNomeada(
    nome: string,
    extra: {
      dataAdmissao?: string;
      contrato?: Record<string, unknown>;
      perfilPessoal?: Record<string, unknown>;
    } = {},
  ): Promise<string> {
    const obrigatorios = camposObrigatoriosAdmissao();
    const lotacao = await lotacaoMinima(appUrl, empresaA);
    const r = await post("/v1/colaboradores", rhA)
      .send({
        ...obrigatorios,
        ...lotacao,
        nome,
        empresaId: empresaA,
        tipo: "clt",
        dataAdmissao: extra.dataAdmissao ?? ADMISSAO,
        motivoCodigo: "admissao_inicial",
        contrato: { ...obrigatorios.contrato, ...(extra.contrato ?? {}) },
        perfilPessoal: {
          ...obrigatorios.perfilPessoal,
          ...(extra.perfilPessoal ?? {}),
        },
      })
      .expect(201);
    await post(`/v1/movimentacoes/${r.body.movimentacao.id}/efetivar`, rhA)
      .send()
      .expect(201);
    return r.body.id as string;
  }

  it("lista as pessoas da empresa ativa, em ordem de nome, com lotação, contrato e só os padrões do período", async () => {
    const gestor = await admitirNomeada("Quadro Gestora Sintetica");
    const bruna = await admitirNomeada("Quadro Bruna Sintetica", {
      contrato: {
        escala: "5x2",
        jornadaSemanalHoras: 40,
        gestorDiretoId: gestor,
        nivel: "pleno",
      },
      perfilPessoal: { genero: "feminino" },
    });
    const alvaro = await admitirNomeada("Quadro Alvaro Sintetico");

    // Bruna: um padrão que terminou ANTES da semana (fora) e o que vale nela.
    await definir(bruna, {
      modelo: "6x1",
      tabelaHorarioId: turnoA,
      folgaSemanal: 7,
      vigenciaInicio: `${ANO - 1}-01-05`,
    }).expect(201);
    await definir(bruna, {
      modelo: "5x2",
      tabelaHorarioId: turnoA,
      vigenciaInicio: `${ANO - 1}-02-02`,
    }).expect(201);

    const r = await quadro(SEMANA_INICIO, SEMANA_FIM).expect(200);
    expect(r.headers["cache-control"]).toBe("no-store");
    const q = r.body as Quadro;
    expect(q).toMatchObject({
      empresaId: empresaA,
      inicio: SEMANA_INICIO,
      fim: SEMANA_FIM,
    });
    const nomes = q.pessoas.map((p) => p.nome);
    const ordenados = [...nomes].sort((a, b) => a.localeCompare(b, "pt-BR"));
    expect(nomes).toEqual(ordenados);

    const b = q.pessoas.find((p) => p.colaboradorId === bruna)!;
    expect(b).toMatchObject({
      nome: "Quadro Bruna Sintetica",
      tipoVinculo: "clt",
      situacao: "ativo",
      dataAdmissao: ADMISSAO,
      dataDesligamento: null,
      departamento: { nome: "Departamento T179 Sintetico" },
      unidade: { nome: "Unidade T179 Sintetica" },
      cargo: { nome: "Cargo T179 Sintetico" },
      gestor: { id: gestor, nome: "Quadro Gestora Sintetica" },
      escalaDoCadastro: "5x2",
      jornadaSemanalHoras: 40,
      // T215 — o que a gaveta "Filtrar" do quadro usa.
      area: null,
      centroCusto: null,
      nivel: "pleno",
      genero: "feminino",
    });
    expect(b.escalas).toHaveLength(1);
    expect(b.escalas[0]).toMatchObject({
      modelo: "5x2",
      vigenciaInicio: `${ANO - 1}-02-02`,
      vigenciaFim: null,
      turno: {
        id: turnoA,
        periodos: GRADE_COMERCIAL,
        sigla: expect.any(String),
      },
    });

    // Sem padrão: a pessoa entra, sem escalas.
    const a = q.pessoas.find((p) => p.colaboradorId === alvaro)!;
    expect(a.escalas).toEqual([]);
    expect(a.gestor).toBeNull();
    expect(a.nivel).toBeNull();
    expect(a.genero).toBeNull();

    // O padrão encerrado no PRIMEIRO dia da semana não toca a semana.
    const antes = await quadro(`${ANO - 1}-01-26`, `${ANO - 1}-02-01`).expect(
      200,
    );
    const bAntes = (antes.body as Quadro).pessoas.find(
      (p) => p.colaboradorId === bruna,
    )!;
    expect(bAntes.escalas.map((e) => e.modelo)).toEqual(["6x1"]);
    // A semana que começa no dia da troca já não tem o padrão anterior.
    const naTroca = await quadro(`${ANO - 1}-02-02`, `${ANO - 1}-02-08`).expect(
      200,
    );
    const bTroca = (naTroca.body as Quadro).pessoas.find(
      (p) => p.colaboradorId === bruna,
    )!;
    expect(bTroca.escalas.map((e) => e.modelo)).toEqual(["5x2"]);

    // Um mês que cruza a troca traz os dois, do mais novo ao mais antigo.
    const mes = await quadro(`${ANO - 1}-01-26`, `${ANO - 1}-02-22`).expect(
      200,
    );
    const bMes = (mes.body as Quadro).pessoas.find(
      (p) => p.colaboradorId === bruna,
    )!;
    expect(bMes.escalas.map((e) => e.modelo)).toEqual(["5x2", "6x1"]);
  });

  it("fora do período: admitido depois do fim e desligado antes do início não entram", async () => {
    const futura = await admitirNomeada("Quadro Futura Sintetica", {
      dataAdmissao: `${ANO - 1}-03-09`,
    });
    const desligada = await admitirNomeada("Quadro Desligada Sintetica");
    const vinculo = await prisma.vinculoFuncional.findFirstOrThrow({
      where: { colaboradorId: desligada, empresaId: empresaA },
    });
    await prisma.vinculoFuncional.update({
      where: { id: vinculo.id },
      data: {
        situacao: "encerrado",
        dataDesligamento: new Date(`${ANO - 1}-03-01T00:00:00.000Z`),
      },
    });

    const semana = (
      (await quadro(SEMANA_INICIO, SEMANA_FIM).expect(200)).body as Quadro
    ).pessoas.map((p) => p.colaboradorId);
    expect(semana).not.toContain(futura);
    expect(semana).not.toContain(desligada);

    // Desativada na empresa (lixeira do Editar colaborador): fora; reativada
    // (desativação com `reativadoEm`), volta.
    const desativada = await admitirNomeada("Quadro Desativada Sintetica");
    const rhUser = await prisma.accessUser.findFirstOrThrow({
      where: { role: "rh", companyId: empresaA },
    });
    const desativacao = await prisma.desativacaoColaborador.create({
      data: {
        colaboradorId: desativada,
        empresaId: empresaA,
        desativadoPorId: rhUser.id,
      },
    });
    const comDesativada = async () =>
      (
        (await quadro(SEMANA_INICIO, SEMANA_FIM).expect(200)).body as Quadro
      ).pessoas.map((p) => p.colaboradorId);
    expect(await comDesativada()).not.toContain(desativada);
    await prisma.desativacaoColaborador.update({
      where: { id: desativacao.id },
      data: { reativadoEm: new Date(), reativadoPorId: rhUser.id },
    });
    expect(await comDesativada()).toContain(desativada);

    // Desligada no último dia da semana anterior: ainda aparece nela,
    // encerrada, com a data de saída.
    const anterior = (
      (await quadro(`${ANO - 1}-02-23`, SEMANA_INICIO).expect(200))
        .body as Quadro
    ).pessoas.find((p) => p.colaboradorId === desligada);
    expect(anterior).toMatchObject({
      situacao: "encerrado",
      dataDesligamento: `${ANO - 1}-03-01`,
    });
    // A admitida no dia seguinte ao fim entra na semana que a contém.
    const seguinte = (
      (await quadro(`${ANO - 1}-03-09`, `${ANO - 1}-03-15`).expect(200))
        .body as Quadro
    ).pessoas.map((p) => p.colaboradorId);
    expect(seguinte).toContain(futura);
  });

  it("período: invertido ou acima de 42 dias é 422; data malformada é 400; 42 dias passam", async () => {
    const invertido = await quadro(SEMANA_FIM, SEMANA_INICIO).expect(422);
    expect(invertido.body.erros).toEqual([
      { campo: "fim", motivo: "fora_de_ordem" },
    ]);
    const longo = await quadro(`${ANO - 1}-01-01`, `${ANO - 1}-02-12`).expect(
      422,
    );
    expect(longo.body.erros).toEqual([{ campo: "fim", motivo: "invalido" }]);
    await quadro(`${ANO - 1}-01-01`, `${ANO - 1}-02-11`).expect(200);
    await quadro(`${ANO - 1}-02-30`, SEMANA_FIM).expect(400);
    await quadro("ontem", SEMANA_FIM).expect(400);
    await get(`/v1/escala/quadro?inicio=${SEMANA_INICIO}`, rhA).expect(400);
  });

  it("escopo: DP lê; outra empresa não vê; master sem empresa ativa, demais papéis e sem sessão são negados", async () => {
    const dp = (await quadro(SEMANA_INICIO, SEMANA_FIM, dpA).expect(200))
      .body as Quadro;
    expect(dp.empresaId).toBe(empresaA);
    expect(dp.pessoas.length).toBeGreaterThan(0);

    const b = (await quadro(SEMANA_INICIO, SEMANA_FIM, rhB).expect(200))
      .body as Quadro;
    expect(b.empresaId).toBe(empresaB);
    expect(b.pessoas).toEqual([]);

    await quadro(SEMANA_INICIO, SEMANA_FIM, master).expect(403);
    for (const cred of outros) {
      await quadro(SEMANA_INICIO, SEMANA_FIM, cred).expect(403);
    }
    await agent()
      .get(`/v1/escala/quadro?inicio=${SEMANA_INICIO}&fim=${SEMANA_FIM}`)
      .expect(401);
  });

  it("leitura sem trilha de auditoria", async () => {
    const antes = await prisma.auditEvent.count();
    await quadro(SEMANA_INICIO, SEMANA_FIM).expect(200);
    expect(await prisma.auditEvent.count()).toBe(antes);
  });
});
