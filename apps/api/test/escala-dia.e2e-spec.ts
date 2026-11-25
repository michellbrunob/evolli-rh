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
 * T215 — o dia do quadro "Escala de trabalho" no rascunho: `PUT
 * /v1/escala/dias` e `POST /v1/escala/dias/limpar`. PostgreSQL real e efêmero
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

describe("T215 — dia do quadro da escala (e2e)", () => {
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
        email: "master.dia@example.test",
        passwordHash: await new PasswordHashService().hash(SENHA_PADRAO),
        role: "master_tecnico",
        status: "active",
      },
    });
    master = await login("master.dia@example.test");
    const empresa = async (codigo: string) =>
      (
        await post("/v1/empresas", master)
          .send({ codigo, nome: `Empresa ${codigo}` })
          .expect(201)
      ).body.id as string;
    empresaA = await empresa("DIAA");
    empresaB = await empresa("DIAB");
    rhA = await criarUsuarioDireto("rh.diaa@example.test", "rh", empresaA);
    dpA = await criarUsuarioDireto("dp.diaa@example.test", "dp", empresaA);
    rhB = await criarUsuarioDireto("rh.diab@example.test", "rh", empresaB);
    outros = [];
    for (const papel of [
      "gestor",
      "colaborador",
      "financeiro",
      "auditor",
      "dpo",
    ]) {
      outros.push(
        await criarUsuarioDireto(`${papel}.diaa@example.test`, papel, empresaA),
      );
    }
    turnoA = await criarTurno(rhA, "Comercial Sintetico", "COM_ESC");
  });

  afterAll(async () => {
    await app?.close();
    await prisma?.$disconnect();
    await container?.stop();
  });

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

  const DIA = `${ANO - 1}-03-03`;

  interface DiaGravado {
    dia: string;
    camada: string;
    tipo: string;
    turno: { id: string; nome: string } | null;
    periodos: { inicio: string; fim: string }[];
    intervaloMinutos: number;
    sobreaviso: { inicio: string; fim: string }[];
    unidade: { id: string; nome: string } | null;
    observacao: string | null;
  }

  function put(corpo: Record<string, unknown>, cred: Credencial = rhA) {
    return agent()
      .put("/v1/escala/dias")
      .set("Cookie", cred.cookie)
      .set("x-csrf-token", cred.csrfToken)
      .send(corpo);
  }

  const limpar = (corpo: Record<string, unknown>, cred: Credencial = rhA) =>
    post("/v1/escala/dias/limpar", cred).send(corpo);

  async function diasNoQuadro(colaboradorId: string) {
    const r = await quadro(SEMANA_INICIO, SEMANA_FIM).expect(200);
    return (
      (
        r.body as { pessoas: { colaboradorId: string; dias: DiaGravado[] }[] }
      ).pessoas.find((p) => p.colaboradorId === colaboradorId)?.dias ?? []
    );
  }

  let pessoaA: string;
  let unidadeA: string;

  beforeAll(async () => {
    pessoaA = await admitirNomeada("Dia Sintetico Um");
    unidadeA = (await lotacaoMinima(appUrl, empresaA)).unidadeOrganizacionalId;
  });

  it("grava trabalho com turno, sobreaviso, local e observação no rascunho; o quadro traz o dia; a trilha não leva conteúdo", async () => {
    const r = await put({
      colaboradorId: pessoaA,
      dia: DIA,
      tipo: "trabalho",
      tabelaHorarioId: turnoA,
      periodos: [{ inicio: "09:00", fim: "18:00" }],
      intervaloMinutos: 60,
      sobreaviso: [{ inicio: "18:00", fim: "09:00" }],
      unidadeOrganizacionalId: unidadeA,
      observacao: "  Cobre a abertura sintetica  ",
    }).expect(200);
    expect(r.headers["cache-control"]).toBe("no-store");
    expect(r.body).toEqual({
      dia: DIA,
      camada: "rascunho",
      tipo: "trabalho",
      turno: {
        id: turnoA,
        nome: "Comercial Sintetico",
        cor: expect.any(String),
        sigla: expect.any(String),
      },
      periodos: [{ inicio: "09:00", fim: "18:00" }],
      intervaloMinutos: 60,
      sobreaviso: [{ inicio: "18:00", fim: "09:00" }],
      unidade: { id: unidadeA, nome: "Unidade T179 Sintetica" },
      observacao: "Cobre a abertura sintetica",
    });
    expect(await diasNoQuadro(pessoaA)).toEqual([r.body]);

    const linha = await prisma.escalaDia.findFirstOrThrow({
      where: { colaboradorId: pessoaA },
    });
    const eventos = await prisma.auditEvent.findMany({
      where: { resourceId: linha.id },
    });
    expect(eventos.map((e) => e.action)).toEqual([
      "pessoas_escala_dia_gravado",
    ]);
    const texto = JSON.stringify(eventos);
    for (const proibido of [
      "Comercial",
      "sintetica",
      "09:00",
      "Dia Sintetico",
    ]) {
      expect(texto).not.toContain(proibido);
    }
  });

  it("gravar de novo o mesmo dia troca o rascunho (uma linha só); folga limpa turno, períodos e local", async () => {
    const r = await put({
      colaboradorId: pessoaA,
      dia: DIA,
      tipo: "folga",
      observacao: "",
    }).expect(200);
    expect(r.body).toMatchObject({
      tipo: "folga",
      turno: null,
      periodos: [],
      intervaloMinutos: 0,
      sobreaviso: [],
      unidade: null,
      observacao: null,
    });
    expect(
      await prisma.escalaDia.count({ where: { colaboradorId: pessoaA } }),
    ).toBe(1);
    await put({ colaboradorId: pessoaA, dia: DIA, tipo: "dsr" }).expect(200);
    const s = await put({
      colaboradorId: pessoaA,
      dia: DIA,
      tipo: "sobreaviso",
      periodos: [{ inicio: "18:00", fim: "06:00" }],
    }).expect(200);
    expect(s.body).toMatchObject({
      tipo: "sobreaviso",
      periodos: [{ inicio: "18:00", fim: "06:00" }],
    });
  });

  it("limpar desfaz a mudança do dia (volta ao padrão) e é idempotente", async () => {
    const r = await limpar({ colaboradorId: pessoaA, dia: DIA }).expect(200);
    expect(r.body).toEqual({ colaboradorId: pessoaA, dia: DIA, limpo: true });
    expect(await diasNoQuadro(pessoaA)).toEqual([]);
    const de_novo = await limpar({ colaboradorId: pessoaA, dia: DIA }).expect(
      200,
    );
    expect(de_novo.body.limpo).toBe(false);
    const eventos = await prisma.auditEvent.findMany({
      where: { action: "pessoas_escala_dia_limpo" },
    });
    expect(eventos).toHaveLength(1);
  });

  it("recusa a forma errada, o dia fora do vínculo, turno e local indisponíveis", async () => {
    const recusa = async (corpo: Record<string, unknown>, status = 422) =>
      (await put({ colaboradorId: pessoaA, dia: DIA, ...corpo }).expect(status))
        .body;
    expect(
      (
        await recusa({
          tipo: "trabalho",
          periodos: [
            { inicio: "08:00", fim: "12:00" },
            { inicio: "11:00", fim: "15:00" },
          ],
        })
      ).erros,
    ).toEqual([{ campo: "periodos", motivo: "sobreposta" }]);
    expect(
      (await recusa({ tipo: "folga", tabelaHorarioId: turnoA })).erros,
    ).toEqual([{ campo: "tabelaHorarioId", motivo: "nao_se_aplica" }]);
    expect((await recusa({ tipo: "trabalho", periodos: [] })).erros).toEqual([
      { campo: "periodos", motivo: "obrigatorio" },
    ]);

    // Antes da admissão e pessoa de outra empresa: o mesmo motivo.
    expect(
      (
        await put({
          colaboradorId: pessoaA,
          dia: `${ANO - 3}-01-01`,
          tipo: "folga",
        }).expect(422)
      ).body.erros,
    ).toEqual([{ campo: "dia", motivo: "fora_do_vinculo" }]);
    expect(
      (
        await put(
          { colaboradorId: pessoaA, dia: DIA, tipo: "folga" },
          rhB,
        ).expect(422)
      ).body.erros,
    ).toEqual([{ campo: "dia", motivo: "fora_do_vinculo" }]);

    // Turno inativo e turno de outra empresa.
    const inativo = await criarTurno(rhA, "Inativo Dia", "INA_DIA");
    await post(`/v1/horarios/${inativo}/desativar`, rhA)
      .send()
      .expect((x) => expect([200, 201]).toContain(x.status));
    const turnoB = await criarTurno(rhB, "Outro Dia", "OUT_DIA");
    for (const id of [inativo, turnoB]) {
      expect(
        (
          await recusa({
            tipo: "trabalho",
            tabelaHorarioId: id,
            periodos: [{ inicio: "09:00", fim: "18:00" }],
          })
        ).erros,
      ).toEqual([{ campo: "tabelaHorarioId", motivo: "indisponivel" }]);
    }
    // Local de outra empresa.
    const unidadeB = (await lotacaoMinima(appUrl, empresaB))
      .unidadeOrganizacionalId;
    expect(
      (
        await recusa({
          tipo: "sobreaviso",
          periodos: [{ inicio: "18:00", fim: "06:00" }],
          unidadeOrganizacionalId: unidadeB,
        })
      ).erros,
    ).toEqual([{ campo: "unidadeOrganizacionalId", motivo: "indisponivel" }]);

    // Formato: 400 antes da regra.
    await recusa({ tipo: "plantao" }, 400);
    await recusa({ tipo: "folga", observacao: "x".repeat(301) }, 400);
    await recusa(
      { tipo: "trabalho", periodos: [{ inicio: "25:00", fim: "18:00" }] },
      400,
    );
    await recusa({ tipo: "trabalho", intervaloMinutos: 500 }, 400);
    expect(
      await prisma.escalaDia.count({ where: { colaboradorId: pessoaA } }),
    ).toBe(0);
  });

  it("permissões: DP grava; master, demais papéis, sem CSRF e sem sessão são negados", async () => {
    await put({ colaboradorId: pessoaA, dia: DIA, tipo: "folga" }, dpA).expect(
      200,
    );
    await limpar({ colaboradorId: pessoaA, dia: DIA }, dpA).expect(200);
    await put(
      { colaboradorId: pessoaA, dia: DIA, tipo: "folga" },
      master,
    ).expect(403);
    for (const cred of outros) {
      await put(
        { colaboradorId: pessoaA, dia: DIA, tipo: "folga" },
        cred,
      ).expect(403);
    }
    await agent()
      .put("/v1/escala/dias")
      .set("Cookie", rhA.cookie)
      .send({ colaboradorId: pessoaA, dia: DIA, tipo: "folga" })
      .expect(403);
    await agent()
      .put("/v1/escala/dias")
      .send({ colaboradorId: pessoaA, dia: DIA, tipo: "folga" })
      .expect(401);
  });

  it("o banco: o publicado não se apaga e a forma de cada tipo é garantida", async () => {
    const rh = await prisma.accessUser.findFirstOrThrow({
      where: { role: "rh", companyId: empresaA },
    });
    const base = {
      colaboradorId: pessoaA,
      empresaId: empresaA,
      dia: new Date(`${DIA}T00:00:00.000Z`),
      criadoPorUserId: rh.id,
      atualizadoPorUserId: rh.id,
    };
    const publicado = await prisma.escalaDia.create({
      data: { ...base, camada: "publicado", tipo: "folga" },
    });
    await expect(
      prisma.escalaDia.delete({ where: { id: publicado.id } }),
    ).rejects.toThrow();
    await expect(
      prisma.escalaDia.create({
        data: {
          ...base,
          camada: "rascunho",
          tipo: "folga",
          periodos: [{ inicio: "09:00", fim: "18:00" }],
        },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.escalaDia.create({
        data: { ...base, camada: "rascunho", tipo: "trabalho" },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.escalaDia.create({
        data: { ...base, camada: "outra", tipo: "folga" },
      }),
    ).rejects.toThrow();
    // O quadro traz o publicado junto.
    const dias = await diasNoQuadro(pessoaA);
    expect(dias.map((d) => [d.camada, d.tipo])).toEqual([
      ["publicado", "folga"],
    ]);
  });
});
