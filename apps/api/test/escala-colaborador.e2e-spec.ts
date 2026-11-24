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
 * T215 — Escala do colaborador (aba Escala da ficha): o padrão de escala
 * (modelo, turno, turno da noite, folga semanal, dias de trabalho, início do
 * ciclo) com vigência. `GET/POST /v1/colaboradores/:id/escalas` e
 * `POST /v1/colaboradores/:id/escalas/:escalaId/encerrar`. PostgreSQL real e
 * efêmero (Testcontainers), migrations do zero.
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
const SENHA_PADRAO = "EscalaColaborador!Sintetico#2026";
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

interface Escalas {
  colaboradorId: string;
  empresaId: string;
  vinculo: { dataAdmissao: string; situacao: string };
  escalaDoCadastro: string | null;
  escalas: Escala[];
}

const ANO = Number(HOJE.slice(0, 4));
const ADMISSAO = `${ANO - 2}-01-05`;
const D1 = `${ANO - 1}-02-02`;
const D2 = `${ANO - 1}-06-01`;
const D3 = `${ANO - 1}-09-01`;

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

describe("T215 — escala do colaborador (e2e)", () => {
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
  let turnoNoiteA: string;
  let turnoInativoA: string;
  let turnoB: string;

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

  let sequencia = 0;
  async function admitir(
    escala?: string,
  ): Promise<{ id: string; vinculoId: string }> {
    sequencia += 1;
    const obrigatorios = camposObrigatoriosAdmissao();
    const lotacao = await lotacaoMinima(appUrl, empresaA);
    const r = await post("/v1/colaboradores", rhA)
      .send({
        ...obrigatorios,
        ...lotacao,
        nome: `Pessoa Escala ${sequencia}`,
        empresaId: empresaA,
        tipo: "clt",
        dataAdmissao: ADMISSAO,
        motivoCodigo: "admissao_inicial",
        contrato: {
          ...obrigatorios.contrato,
          ...(escala ? { escala } : {}),
        },
      })
      .expect(201);
    await post(`/v1/movimentacoes/${r.body.movimentacao.id}/efetivar`, rhA)
      .send()
      .expect(201);
    return { id: r.body.id as string, vinculoId: r.body.vinculo.id as string };
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

  async function escalas(id: string, cred: Credencial = rhA) {
    return (await get(rota(id), cred).expect(200)).body as Escalas;
  }

  function definir(id: string, corpo: Record<string, unknown>, cred = rhA) {
    return post(rota(id), cred).send(corpo);
  }

  function encerrar(
    id: string,
    escalaId: string,
    vigenciaFim: string,
    cred = rhA,
  ) {
    return post(`${rota(id)}/${escalaId}/encerrar`, cred).send({ vigenciaFim });
  }

  async function trilha(resourceId: string) {
    return prisma.auditEvent.findMany({
      where: { resourceId },
      orderBy: { occurredAt: "asc" },
    });
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
        email: "master.escala@example.test",
        passwordHash: await new PasswordHashService().hash(SENHA_PADRAO),
        role: "master_tecnico",
        status: "active",
      },
    });
    master = await login("master.escala@example.test");
    const empresa = async (codigo: string) =>
      (
        await post("/v1/empresas", master)
          .send({ codigo, nome: `Empresa ${codigo}` })
          .expect(201)
      ).body.id as string;
    empresaA = await empresa("ESCA");
    empresaB = await empresa("ESCB");
    rhA = await criarUsuarioDireto("rh.esca@example.test", "rh", empresaA);
    dpA = await criarUsuarioDireto("dp.esca@example.test", "dp", empresaA);
    rhB = await criarUsuarioDireto("rh.escb@example.test", "rh", empresaB);
    outros = [];
    for (const papel of [
      "gestor",
      "colaborador",
      "financeiro",
      "auditor",
      "dpo",
    ]) {
      outros.push(
        await criarUsuarioDireto(`${papel}.esca@example.test`, papel, empresaA),
      );
    }
    turnoA = await criarTurno(rhA, "Comercial Sintetico", "COM_ESC");
    turnoNoiteA = await criarTurno(rhA, "Noite Sintetica", "NOI_ESC");
    turnoInativoA = await criarTurno(rhA, "Antigo Sintetico", "ANT_ESC");
    await post(`/v1/horarios/${turnoInativoA}/desativar`, rhA)
      .send()
      .expect((r) => expect([200, 201]).toContain(r.status));
    turnoB = await criarTurno(rhB, "Comercial B", "COM_ESB");
  });

  afterAll(async () => {
    await app?.close();
    await prisma?.$disconnect();
    await container?.stop();
  });

  it("sem escala: lista vazia, com a escala do cadastro e a admissão", async () => {
    const p = await admitir("6x1");
    const e = await escalas(p.id);
    expect(e).toMatchObject({
      colaboradorId: p.id,
      empresaId: empresaA,
      vinculo: { dataAdmissao: ADMISSAO },
      escalaDoCadastro: "6x1",
      escalas: [],
    });
  });

  it("define 5x2 com turno: vigência aberta, turno com a grade, e a trilha só com ids", async () => {
    const p = await admitir();
    const r = await definir(p.id, {
      modelo: "5x2",
      tabelaHorarioId: turnoA,
      vigenciaInicio: D1,
    }).expect(201);
    const e = r.body as Escalas;
    expect(e.escalas).toHaveLength(1);
    expect(e.escalas[0]).toMatchObject({
      modelo: "5x2",
      turno: {
        id: turnoA,
        nome: "Comercial Sintetico",
        ativo: true,
        periodos: GRADE_COMERCIAL,
      },
      turnoNoite: null,
      folgaSemanal: null,
      diasTrabalho: [],
      inicioCiclo: null,
      vigenciaInicio: D1,
      vigenciaFim: null,
    });
    const eventos = await trilha(e.escalas[0]!.id);
    expect(eventos.map((x) => x.action)).toContain("pessoas_escala_definida");
    // T215 — o turno passa a contar a pessoa em "Em uso".
    const turno = await get(`/v1/horarios/${turnoA}`, rhA).expect(200);
    expect(turno.body.emUso).toBeGreaterThanOrEqual(1);
    const texto = JSON.stringify(eventos);
    expect(texto).not.toContain("5x2");
    expect(texto).not.toContain("Comercial");
    expect(texto).not.toContain("Pessoa Escala");
  });

  it("sem turno fixo, 6x1 com folga, outra com dias, 12x36 com turno da noite e ciclo", async () => {
    const p = await admitir();
    await definir(p.id, {
      modelo: "6x1",
      tabelaHorarioId: null,
      folgaSemanal: 3,
      vigenciaInicio: D1,
    }).expect(201);
    await definir(p.id, {
      modelo: "outra",
      tabelaHorarioId: turnoA,
      diasTrabalho: [5, 1, 3],
      vigenciaInicio: D2,
    }).expect(201);
    const r = await definir(p.id, {
      modelo: "12x36",
      tabelaHorarioId: turnoA,
      turnoNoiteId: turnoNoiteA,
      inicioCiclo: D3,
      vigenciaInicio: D3,
    }).expect(201);
    const [plantao, outra, seis] = (r.body as Escalas).escalas;
    expect(plantao).toMatchObject({
      modelo: "12x36",
      turnoNoite: { id: turnoNoiteA },
      inicioCiclo: D3,
      vigenciaFim: null,
    });
    expect(outra).toMatchObject({
      modelo: "outra",
      diasTrabalho: [1, 3, 5],
      vigenciaInicio: D2,
      vigenciaFim: D3,
    });
    expect(seis).toMatchObject({
      modelo: "6x1",
      turno: null,
      folgaSemanal: 3,
      vigenciaFim: D2,
    });
  });

  it("regras do padrão e da vigência: 422 no campo, sem valor, e nada gravado", async () => {
    const p = await admitir();
    const casos: [Record<string, unknown>, string, string][] = [
      [{ modelo: "6x1", vigenciaInicio: D1 }, "folgaSemanal", "obrigatorio"],
      [{ modelo: "outra", vigenciaInicio: D1 }, "diasTrabalho", "obrigatorio"],
      [{ modelo: "4x2", vigenciaInicio: D1 }, "inicioCiclo", "obrigatorio"],
      [
        {
          modelo: "24x48",
          inicioCiclo: D1,
          turnoNoiteId: turnoNoiteA,
          vigenciaInicio: D1,
        },
        "turnoNoiteId",
        "nao_se_aplica",
      ],
      [
        { modelo: "5x2", vigenciaInicio: `${ANO - 2}-01-04` },
        "vigenciaInicio",
        "antes_da_admissao",
      ],
      [
        { modelo: "5x2", tabelaHorarioId: turnoInativoA, vigenciaInicio: D1 },
        "tabelaHorarioId",
        "indisponivel",
      ],
      [
        { modelo: "5x2", tabelaHorarioId: turnoB, vigenciaInicio: D1 },
        "tabelaHorarioId",
        "indisponivel",
      ],
    ];
    for (const [corpo, campo, motivo] of casos) {
      const r = await definir(p.id, corpo).expect(422);
      expect(r.body.erros).toEqual([{ campo, motivo }]);
    }
    await definir(p.id, { modelo: "9x9", vigenciaInicio: D1 }).expect(400);
    expect((await escalas(p.id)).escalas).toEqual([]);
  });

  it("troca: começa depois da atual e muda algo; a anterior termina no novo início", async () => {
    const p = await admitir();
    await definir(p.id, { modelo: "5x2", vigenciaInicio: D2 }).expect(201);
    const antes = await definir(p.id, {
      modelo: "4x3",
      vigenciaInicio: D1,
    }).expect(422);
    expect(antes.body.erros).toEqual([
      { campo: "vigenciaInicio", motivo: "fora_de_ordem" },
    ]);
    const igual = await definir(p.id, {
      modelo: "5x2",
      vigenciaInicio: D3,
    }).expect(422);
    expect(igual.body.erros).toEqual([
      { campo: "modelo", motivo: "igual_a_vigente" },
    ]);
    expect((await escalas(p.id)).escalas).toHaveLength(1);
    // Na mesma data de início, o padrão aberto é substituído (correção).
    const corrigida = (
      await definir(p.id, { modelo: "4x3", vigenciaInicio: D2 }).expect(201)
    ).body as Escalas;
    expect(corrigida.escalas).toHaveLength(1);
    expect(corrigida.escalas[0]).toMatchObject({
      modelo: "4x3",
      vigenciaInicio: D2,
      vigenciaFim: null,
      definidaPor: null,
    });
    expect(corrigida.escalas[0]!.definidaEm).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("encerrar: o primeiro dia sem a escala; já encerrada e fim fora de ordem dão 422; e não se sobrepõe depois", async () => {
    const p = await admitir();
    const e = (
      await definir(p.id, { modelo: "5x2", vigenciaInicio: D1 }).expect(201)
    ).body as Escalas;
    const id = e.escalas[0]!.id;
    const fora = await encerrar(p.id, id, D1).expect(422);
    expect(fora.body.erros).toEqual([
      { campo: "vigenciaFim", motivo: "fora_de_ordem" },
    ]);
    const ok = (await encerrar(p.id, id, D3).expect(201)).body as Escalas;
    expect(ok.escalas[0]).toMatchObject({ id, vigenciaFim: D3 });
    const de_novo = await encerrar(p.id, id, D3).expect(422);
    expect(de_novo.body.erros).toEqual([
      { campo: "vigenciaFim", motivo: "ja_encerrada" },
    ]);
    const cruza = await definir(p.id, {
      modelo: "6x1",
      folgaSemanal: 7,
      vigenciaInicio: D2,
    }).expect(409);
    expect(cruza.body.erros).toEqual([
      { campo: "vigenciaInicio", motivo: "sobreposta" },
    ]);
    await definir(p.id, {
      modelo: "6x1",
      folgaSemanal: 7,
      vigenciaInicio: D3,
    }).expect(201);
    expect((await trilha(id)).map((x) => x.action)).toContain(
      "pessoas_escala_encerrada",
    );
  });

  it("DP define e encerra; o master só lê; os demais papéis não leem nem gravam", async () => {
    const p = await admitir();
    const e = (
      await definir(p.id, { modelo: "5x2", vigenciaInicio: D1 }, dpA).expect(
        201,
      )
    ).body as Escalas;
    await encerrar(p.id, e.escalas[0]!.id, D2, dpA).expect(201);
    // Sem empresa ativa, o master não lê; com ela, só lê.
    await get(rota(p.id), master).expect(403);
    const masterEmA = await criarUsuarioDireto(
      "master.esca.a@example.test",
      "master_tecnico",
      null,
    );
    await post("/v1/auth/contexto/empresa", masterEmA)
      .send({ empresaId: empresaA })
      .expect(200);
    expect((await escalas(p.id, masterEmA)).escalas).toHaveLength(1);
    await definir(
      p.id,
      { modelo: "4x3", vigenciaInicio: D3 },
      masterEmA,
    ).expect(403);
    for (const cred of outros) {
      const leitura = await get(rota(p.id), cred);
      expect([403, 404]).toContain(leitura.status);
      expect(JSON.stringify(leitura.body)).not.toContain("5x2");
      const gravacao = await definir(
        p.id,
        { modelo: "4x3", vigenciaInicio: D3 },
        cred,
      );
      expect([403, 404]).toContain(gravacao.status);
    }
    expect((await escalas(p.id)).escalas).toHaveLength(1);
  });

  it("outra empresa: 404 ao ler, definir e encerrar, sem revelar nada", async () => {
    const p = await admitir();
    const e = (
      await definir(p.id, { modelo: "5x2", vigenciaInicio: D1 }).expect(201)
    ).body as Escalas;
    const leitura = await get(rota(p.id), rhB).expect(404);
    expect(JSON.stringify(leitura.body)).not.toContain("Pessoa Escala");
    await definir(p.id, { modelo: "4x3", vigenciaInicio: D3 }, rhB).expect(404);
    await encerrar(p.id, e.escalas[0]!.id, D3, rhB).expect(404);
    expect((await escalas(p.id)).escalas[0]!.vigenciaFim).toBeNull();
  });

  it("desligado: só leitura (409 ao gravar)", async () => {
    const p = await admitir();
    await prisma.vinculoFuncional.update({
      where: { id: p.vinculoId },
      data: {
        situacao: "encerrado",
        dataDesligamento: new Date(`${HOJE}T00:00:00Z`),
      },
    });
    await get(rota(p.id), rhA).expect(200);
    await definir(p.id, { modelo: "5x2", vigenciaInicio: D1 }).expect(409);
  });
});
