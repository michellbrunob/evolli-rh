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

  describe("publicar", () => {
    const publicar = (corpo: Record<string, unknown>, cred: Credencial = rhA) =>
      post("/v1/escala/publicar", cred).send(corpo);
    const DIA_SEGUINTE = `${ANO - 1}-03-04`;
    const FORA = `${ANO - 1}-03-10`;

    it("sem mudança no rascunho do período: 422 escala_nada_para_publicar", async () => {
      const r = await publicar({
        inicio: SEMANA_INICIO,
        fim: SEMANA_FIM,
        avisar: false,
      }).expect(422);
      expect(r.body.codigo).toBe("escala_nada_para_publicar");
    });

    it("o rascunho do período vira publicado (novas e alteradas), sai do rascunho e a publicação aparece no quadro", async () => {
      // Já há um publicado (folga) no DIA, do teste do banco.
      await put({ colaboradorId: pessoaA, dia: DIA, tipo: "dsr" }).expect(200);
      await put({
        colaboradorId: pessoaA,
        dia: DIA_SEGUINTE,
        tipo: "trabalho",
        tabelaHorarioId: turnoA,
        periodos: [{ inicio: "09:00", fim: "18:00" }],
        intervaloMinutos: 60,
        observacao: "Abertura",
      }).expect(200);
      // Fora do período: fica no rascunho.
      await put({ colaboradorId: pessoaA, dia: FORA, tipo: "folga" }).expect(
        200,
      );

      const r = await publicar({
        inicio: SEMANA_INICIO,
        fim: SEMANA_FIM,
        avisar: true,
      }).expect(200);
      expect(r.headers["cache-control"]).toBe("no-store");
      expect(r.body).toMatchObject({
        inicio: SEMANA_INICIO,
        fim: SEMANA_FIM,
        novas: 1,
        alteradas: 1,
        pessoas: 1,
        avisar: true,
        publicadaEm: expect.any(String),
      });
      expect(r.body).toHaveProperty("publicadaPor");

      const dias = await diasNoQuadro(pessoaA);
      expect(dias.map((d) => [d.dia, d.camada, d.tipo])).toEqual([
        [DIA, "publicado", "dsr"],
        [DIA_SEGUINTE, "publicado", "trabalho"],
      ]);
      expect(dias[1]).toMatchObject({
        turno: { id: turnoA },
        periodos: [{ inicio: "09:00", fim: "18:00" }],
        intervaloMinutos: 60,
        observacao: "Abertura",
      });
      const q = (await quadro(SEMANA_INICIO, SEMANA_FIM).expect(200)).body as {
        publicacao: { id: string; novas: number } | null;
      };
      expect(q.publicacao).toMatchObject({ id: r.body.id, novas: 1 });
      // O de fora continua no rascunho.
      expect(
        await prisma.escalaDia.count({
          where: { colaboradorId: pessoaA, camada: "rascunho" },
        }),
      ).toBe(1);

      const eventos = await prisma.auditEvent.findMany({
        where: { resourceId: r.body.id },
      });
      expect(eventos.map((e) => e.action)).toEqual([
        "pessoas_escala_publicada",
      ]);
      expect(JSON.stringify(eventos)).not.toContain("Abertura");

      // Publicar de novo, sem mudança: nada a publicar.
      await publicar({
        inicio: SEMANA_INICIO,
        fim: SEMANA_FIM,
        avisar: false,
      }).expect(422);
    });

    it("permissões e escopo: DP publica; outra empresa não toca o rascunho; master e demais negados", async () => {
      await put({ colaboradorId: pessoaA, dia: DIA, tipo: "folga" }).expect(
        200,
      );
      const corpo = { inicio: SEMANA_INICIO, fim: SEMANA_FIM, avisar: false };
      expect((await publicar(corpo, rhB).expect(422)).body.codigo).toBe(
        "escala_nada_para_publicar",
      );
      await publicar(corpo, master).expect(403);
      for (const cred of outros) await publicar(corpo, cred).expect(403);
      await agent()
        .post("/v1/escala/publicar")
        .set("Cookie", rhA.cookie)
        .send(corpo)
        .expect(403);
      const r = await publicar(corpo, dpA).expect(200);
      expect(r.body).toMatchObject({ novas: 0, alteradas: 1, pessoas: 1 });
    });

    it("período inválido e corpo malformado", async () => {
      await publicar({
        inicio: SEMANA_FIM,
        fim: SEMANA_INICIO,
        avisar: false,
      }).expect(422);
      await publicar({
        inicio: `${ANO - 1}-01-01`,
        fim: `${ANO - 1}-03-01`,
        avisar: false,
      }).expect(422);
      await publicar({ inicio: SEMANA_INICIO, fim: SEMANA_FIM }).expect(400);
      await publicar({
        inicio: SEMANA_INICIO,
        fim: SEMANA_FIM,
        avisar: "sim",
      }).expect(400);
    });

    it("o banco: a publicação só se cria", async () => {
      const pub = await prisma.escalaPublicacao.findFirstOrThrow({
        where: { empresaId: empresaA },
      });
      await expect(
        prisma.escalaPublicacao.update({
          where: { id: pub.id },
          data: { novas: 99 },
        }),
      ).rejects.toThrow();
      await expect(
        prisma.escalaPublicacao.delete({ where: { id: pub.id } }),
      ).rejects.toThrow();
    });
  });

  describe("publicar o padrão", () => {
    const INICIO = `${ANO - 1}-06-02`;
    const somar = (dia: string, n: number) => {
      const d = new Date(`${dia}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + n);
      return d.toISOString().slice(0, 10);
    };
    const DIAS = Array.from({ length: 7 }, (_, i) => somar(INICIO, i));
    const FIM = DIAS[6]!;
    /** 1 = segunda … 7 = domingo. */
    const semana = (dia: string) =>
      new Date(`${dia}T00:00:00Z`).getUTCDay() || 7;

    it("os dias que seguem o padrão viram publicados; trocar o padrão depois não muda o publicado", async () => {
      const pessoa = await admitirNomeada("Padrao Publicado Sintetico");
      const folga = semana(DIAS[6]!);
      await post(`/v1/colaboradores/${pessoa}/escalas`, rhA)
        .send({
          modelo: "6x1",
          folgaSemanal: folga,
          tabelaHorarioId: turnoA,
          vigenciaInicio: INICIO,
        })
        .expect(201);
      const corpo = { inicio: INICIO, fim: FIM, avisar: false };

      // Nenhum rascunho: mesmo assim há o que publicar (o padrão).
      const r = await post("/v1/escala/publicar", rhA).send(corpo).expect(200);
      expect(r.body).toMatchObject({ novas: 7, alteradas: 0, pessoas: 1 });

      const publicados = async () =>
        (
          (await quadro(INICIO, FIM).expect(200)).body as {
            pessoas: { colaboradorId: string; dias: DiaGravado[] }[];
          }
        ).pessoas.find((p) => p.colaboradorId === pessoa)?.dias ?? [];
      const antes = await publicados();
      expect(antes.map((d) => [d.dia, d.camada, d.tipo])).toEqual(
        DIAS.map((dia) => [
          dia,
          "publicado",
          semana(dia) === folga ? "dsr" : "trabalho",
        ]),
      );
      expect(antes[0]).toMatchObject({
        turno: { id: turnoA },
        periodos: [
          { inicio: "09:00", fim: "12:00" },
          { inicio: "13:00", fim: "18:00" },
        ],
        intervaloMinutos: 0,
        observacao: null,
      });

      // Trocar o padrão no meio da semana publicada: o publicado fica.
      await post(`/v1/colaboradores/${pessoa}/escalas`, rhA)
        .send({ modelo: "outra", diasTrabalho: [1], vigenciaInicio: DIAS[2] })
        .expect(201);
      expect(await publicados()).toEqual(antes);

      // Tudo publicado e sem rascunho: nada a publicar.
      expect(
        (await post("/v1/escala/publicar", rhA).send(corpo).expect(422)).body
          .codigo,
      ).toBe("escala_nada_para_publicar");
    });
  });

  describe("lote", () => {
    const DIAS_LOTE = [`${ANO - 1}-04-06`, `${ANO - 1}-04-07`];
    const putLote = (dias: Record<string, unknown>[], cred: Credencial = rhA) =>
      agent()
        .put("/v1/escala/dias/lote")
        .set("Cookie", cred.cookie)
        .set("x-csrf-token", cred.csrfToken)
        .send({ dias });
    const limparLote = (
      dias: Record<string, unknown>[],
      cred: Credencial = rhA,
    ) => post("/v1/escala/dias/limpar-lote", cred).send({ dias });
    let pessoaB: string;

    beforeAll(async () => {
      pessoaB = await admitirNomeada("Lote Sintetico Dois");
    });

    it("grava vários dias de várias pessoas de uma vez, com um evento por dia", async () => {
      const antes = await prisma.auditEvent.count({
        where: { action: "pessoas_escala_dia_gravado" },
      });
      const r = await putLote([
        { colaboradorId: pessoaA, dia: DIAS_LOTE[0], tipo: "folga" },
        { colaboradorId: pessoaB, dia: DIAS_LOTE[0], tipo: "dsr" },
        {
          colaboradorId: pessoaB,
          dia: DIAS_LOTE[1],
          tipo: "trabalho",
          tabelaHorarioId: turnoA,
          periodos: [{ inicio: "09:00", fim: "18:00" }],
          intervaloMinutos: 60,
        },
      ]).expect(200);
      expect(
        r.body.dias.map((d: { colaboradorId: string; tipo: string }) => [
          d.colaboradorId,
          d.tipo,
        ]),
      ).toEqual([
        [pessoaA, "folga"],
        [pessoaB, "dsr"],
        [pessoaB, "trabalho"],
      ]);
      expect(
        await prisma.auditEvent.count({
          where: { action: "pessoas_escala_dia_gravado" },
        }),
      ).toBe(antes + 3);
    });

    it("tudo ou nada: um dia fora do vínculo recusa o lote inteiro", async () => {
      const r = await putLote([
        { colaboradorId: pessoaA, dia: DIAS_LOTE[1], tipo: "folga" },
        { colaboradorId: pessoaA, dia: `${ANO - 3}-01-01`, tipo: "folga" },
      ]).expect(422);
      expect(r.body.erros).toEqual([
        { campo: "dia", motivo: "fora_do_vinculo" },
      ]);
      expect(
        await prisma.escalaDia.count({
          where: {
            colaboradorId: pessoaA,
            dia: new Date(`${DIAS_LOTE[1]}T00:00:00.000Z`),
          },
        }),
      ).toBe(0);
      // Cada pessoa no SEU vínculo: a admitida depois não vale pelo da outra.
      const nova = await admitirNomeada("Lote Sintetico Nova", {
        dataAdmissao: DIAS_LOTE[1]!,
      });
      const r2 = await putLote([
        { colaboradorId: pessoaA, dia: DIAS_LOTE[0], tipo: "folga" },
        { colaboradorId: nova, dia: DIAS_LOTE[0], tipo: "folga" },
      ]).expect(422);
      expect(r2.body.erros).toEqual([
        { campo: "dia", motivo: "fora_do_vinculo" },
      ]);
      // Turno de outra empresa em qualquer item (mesmo junto de um válido):
      // o lote inteiro recusado.
      const turnoB = await criarTurno(rhB, "Outro Lote", "OUT_LOT");
      await putLote([
        {
          colaboradorId: pessoaA,
          dia: DIAS_LOTE[1],
          tipo: "trabalho",
          tabelaHorarioId: turnoA,
          periodos: [{ inicio: "09:00", fim: "18:00" }],
        },
        {
          colaboradorId: pessoaB,
          dia: DIAS_LOTE[1],
          tipo: "trabalho",
          tabelaHorarioId: turnoB,
          periodos: [{ inicio: "09:00", fim: "18:00" }],
        },
      ]).expect(422);
    });

    it("limpa vários dias (idempotente) e diz quais tinham rascunho", async () => {
      const r = await limparLote([
        { colaboradorId: pessoaA, dia: DIAS_LOTE[0] },
        { colaboradorId: pessoaB, dia: DIAS_LOTE[0] },
        { colaboradorId: pessoaB, dia: DIAS_LOTE[1] },
        { colaboradorId: pessoaA, dia: DIAS_LOTE[1] },
      ]).expect(200);
      expect(r.body.dias.map((d: { limpo: boolean }) => d.limpo)).toEqual([
        true,
        true,
        true,
        false,
      ]);
      expect(
        await prisma.escalaDia.count({
          where: {
            colaboradorId: { in: [pessoaA, pessoaB] },
            camada: "rascunho",
            dia: { in: DIAS_LOTE.map((d) => new Date(`${d}T00:00:00.000Z`)) },
          },
        }),
      ).toBe(0);
    });

    it("limites e permissões: vazio e acima de 500 são 400; master e demais negados", async () => {
      await putLote([]).expect(400);
      await putLote(
        Array.from({ length: 501 }, () => ({
          colaboradorId: pessoaA,
          dia: DIAS_LOTE[0],
          tipo: "folga",
        })),
      ).expect(400);
      await limparLote([]).expect(400);
      const um = [{ colaboradorId: pessoaA, dia: DIAS_LOTE[0], tipo: "folga" }];
      await putLote(um, master).expect(403);
      for (const cred of outros) await putLote(um, cred).expect(403);
      await putLote(um, dpA).expect(200);
      await limparLote(
        [{ colaboradorId: pessoaA, dia: DIAS_LOTE[0] }],
        dpA,
      ).expect(200);
    });
  });

  describe("regras da escala", () => {
    const putRegras = (
      corpo: Record<string, unknown>,
      cred: Credencial = rhA,
    ) =>
      agent()
        .put("/v1/escala/regras")
        .set("Cookie", cred.cookie)
        .set("x-csrf-token", cred.csrfToken)
        .send(corpo);
    const BASE_REGRAS = {
      inicioTransicao: null,
      semanaComeca: 1,
      convencao: {},
      avisos: {},
      antecedenciaDias: 7,
      avisarPadrao: true,
    };

    it("sem regras salvas: as padrão (transição em 16/12/2026, 12x36 por acordo, noturno desligado)", async () => {
      const r = await get("/v1/escala/regras", rhB).expect(200);
      expect(r.body).toMatchObject({
        personalizadas: false,
        inicioTransicao: "2026-12-16",
        semanaComeca: 1,
        antecedenciaDias: 7,
        avisarPadrao: true,
        feriados: [],
        uf: null,
      });
      // O estado da empresa (para os feriados estaduais).
      await prisma.empresa.update({
        where: { id: empresaB },
        data: { uf: "SP" },
      });
      expect((await get("/v1/escala/regras", rhB).expect(200)).body.uf).toBe(
        "SP",
      );
      await prisma.empresa.update({
        where: { id: empresaB },
        data: { uf: null },
      });
      expect(r.body.convencao).toMatchObject({
        "6x1_autorizada": false,
        "12x36_acordo": true,
        comercio: false,
      });
      expect(r.body.avisos).toMatchObject({
        interjornada: true,
        noturno: false,
        sobreaviso: true,
      });
      expect(Object.keys(r.body.avisos)).toHaveLength(21);
      expect(Object.keys(r.body.convencao)).toHaveLength(8);
    });

    it("salva, mescla com as padrão e o quadro traz as regras; a trilha só com a empresa", async () => {
      const r = await putRegras({
        ...BASE_REGRAS,
        inicioTransicao: "2026-12-15",
        semanaComeca: 7,
        convencao: { "6x1_autorizada": true, comercio: true },
        avisos: { noturno: true, domingo: false },
        antecedenciaDias: 14,
        avisarPadrao: false,
      }).expect(200);
      expect(r.body).toMatchObject({
        personalizadas: true,
        inicioTransicao: "2026-12-15",
        semanaComeca: 7,
        antecedenciaDias: 14,
        avisarPadrao: false,
      });
      expect(r.body.convencao).toMatchObject({
        "6x1_autorizada": true,
        comercio: true,
        "12x36_acordo": true,
      });
      expect(r.body.avisos).toMatchObject({
        noturno: true,
        domingo: false,
        feriado: true,
      });
      const q = (await quadro(SEMANA_INICIO, SEMANA_FIM).expect(200)).body as {
        regras: { inicioTransicao: string };
      };
      expect(q.regras.inicioTransicao).toBe("2026-12-15");
      const eventos = await prisma.auditEvent.findMany({
        where: { action: "pessoas_escala_regras_salvas" },
      });
      expect(eventos).toHaveLength(1);
      expect(JSON.stringify(eventos)).not.toContain("6x1");
      // Voltar a "nulo" devolve o início padrão.
      const r2 = await putRegras(BASE_REGRAS).expect(200);
      expect(r2.body.inicioTransicao).toBe("2026-12-16");
    });

    it("valor gravado que não é verdadeiro/falso cai no padrão ao ler", async () => {
      await putRegras(BASE_REGRAS, rhB).expect(200);
      await prisma.escalaRegras.update({
        where: { empresaId: empresaB },
        data: {
          convencao: { "12x36_acordo": "sim", comercio: true },
          avisos: { noturno: 1 },
        },
      });
      const r = await get("/v1/escala/regras", rhB).expect(200);
      expect(r.body.convencao).toMatchObject({
        "12x36_acordo": true,
        comercio: true,
      });
      expect(r.body.avisos).toMatchObject({ noturno: false });
      await prisma.escalaRegras.delete({ where: { empresaId: empresaB } });
    });

    it("recusa chave desconhecida, valor que não é verdadeiro/falso e formas inválidas", async () => {
      expect(
        (
          await putRegras({
            ...BASE_REGRAS,
            convencao: { inventada: true },
          }).expect(422)
        ).body.erros,
      ).toEqual([{ campo: "convencao", motivo: "invalido" }]);
      expect(
        (
          await putRegras({
            ...BASE_REGRAS,
            avisos: { noturno: "sim" },
          }).expect(422)
        ).body.erros,
      ).toEqual([{ campo: "avisos", motivo: "invalido" }]);
      await putRegras({ ...BASE_REGRAS, semanaComeca: 8 }).expect(400);
      await putRegras({ ...BASE_REGRAS, antecedenciaDias: 4 }).expect(400);
      await putRegras({ ...BASE_REGRAS, inicioTransicao: "15/12/2026" }).expect(
        400,
      );
    });

    it("feriados locais: cria em todas ou em algumas unidades, recusa unidade de outra empresa, edita e arquiva", async () => {
      const unidadeA = (await lotacaoMinima(appUrl, empresaA))
        .unidadeOrganizacionalId;
      const unidadeB = (await lotacaoMinima(appUrl, empresaB))
        .unidadeOrganizacionalId;
      const criar = (corpo: Record<string, unknown>, cred: Credencial = rhA) =>
        post("/v1/escala/feriados", cred).send(corpo);
      const r = await criar({
        data: `${ANO - 1}-03-04`,
        nome: "  Aniversario da cidade sintetica  ",
        tipo: "municipal",
        unidadeIds: [],
      }).expect(201);
      expect(r.body.feriados).toEqual([
        {
          id: expect.any(String),
          data: `${ANO - 1}-03-04`,
          nome: "Aniversario da cidade sintetica",
          tipo: "municipal",
          unidadeIds: [],
        },
      ]);
      await criar({
        data: `${ANO - 1}-03-05`,
        nome: "Ponto sintetico",
        tipo: "ponto_facultativo",
        unidadeIds: [unidadeA],
      }).expect(201);
      expect(
        (
          await criar({
            data: `${ANO - 1}-03-06`,
            nome: "X",
            tipo: "municipal",
            unidadeIds: [unidadeB],
          }).expect(422)
        ).body.erros,
      ).toEqual([{ campo: "unidadeOrganizacionalId", motivo: "indisponivel" }]);
      // Unidade inativa da própria empresa: indisponível.
      const inativa = await prisma.unidadeOrganizacional.create({
        data: {
          empresaId: empresaA,
          codigo: "UNI-INATIVA-SINTETICA",
          nome: "Unidade inativa sintetica",
          status: "inativo",
        },
      });
      expect(
        (
          await criar({
            data: `${ANO - 1}-03-06`,
            nome: "X",
            tipo: "municipal",
            unidadeIds: [inativa.id],
          }).expect(422)
        ).body.erros,
      ).toEqual([{ campo: "unidadeOrganizacionalId", motivo: "indisponivel" }]);
      await criar({
        data: `${ANO - 1}-03-06`,
        nome: "",
        tipo: "municipal",
        unidadeIds: [],
      }).expect(400);
      await criar({
        data: `${ANO - 1}-03-06`,
        nome: "X",
        tipo: "estadual",
        unidadeIds: [],
      }).expect(400);

      // O quadro do período traz os feriados nas regras.
      const q = (await quadro(SEMANA_INICIO, SEMANA_FIM).expect(200)).body as {
        regras: { feriados: { nome: string }[] };
      };
      expect(q.regras.feriados.map((f) => f.nome)).toEqual([
        "Aniversario da cidade sintetica",
        "Ponto sintetico",
      ]);

      const id = r.body.feriados[0].id as string;
      const editar = (corpo: Record<string, unknown>, cred: Credencial = rhA) =>
        agent()
          .patch(`/v1/escala/feriados/${id}`)
          .set("Cookie", cred.cookie)
          .set("x-csrf-token", cred.csrfToken)
          .send(corpo);
      const arquivar = (cred: Credencial = rhA) =>
        post(`/v1/escala/feriados/${id}/arquivar`, cred).send();

      // Editar: data, nome, tipo e unidades; recusa unidade de fora.
      const ed = await editar({
        data: `${ANO - 1}-03-03`,
        nome: " Aniversario editado ",
        tipo: "ponto_facultativo",
        unidadeIds: [unidadeA],
      }).expect(200);
      expect(
        (ed.body.feriados as { id: string }[]).find((f) => f.id === id),
      ).toEqual({
        id,
        data: `${ANO - 1}-03-03`,
        nome: "Aniversario editado",
        tipo: "ponto_facultativo",
        unidadeIds: [unidadeA],
      });
      expect(
        (
          await editar({
            data: `${ANO - 1}-03-03`,
            nome: "X",
            tipo: "municipal",
            unidadeIds: [unidadeB],
          }).expect(422)
        ).body.erros,
      ).toEqual([{ campo: "unidadeOrganizacionalId", motivo: "indisponivel" }]);
      await editar({
        data: "03/03",
        nome: "X",
        tipo: "municipal",
        unidadeIds: [],
      }).expect(400);
      // Outra empresa não edita nem arquiva: 404.
      await editar(
        {
          data: `${ANO - 1}-03-03`,
          nome: "X",
          tipo: "municipal",
          unidadeIds: [],
        },
        rhB,
      ).expect(404);
      await arquivar(rhB).expect(404);

      // Arquivar: sai das regras e do quadro; o registro fica.
      const arq = await arquivar().expect(200);
      expect(arq.body.feriados.map((f: { nome: string }) => f.nome)).toEqual([
        "Ponto sintetico",
      ]);
      const q2 = (await quadro(SEMANA_INICIO, SEMANA_FIM).expect(200)).body as {
        regras: { feriados: { nome: string }[] };
      };
      expect(q2.regras.feriados.map((f) => f.nome)).toEqual([
        "Ponto sintetico",
      ]);
      const linha = await prisma.escalaFeriadoLocal.findUniqueOrThrow({
        where: { id },
      });
      expect(linha.arquivadoEm).not.toBeNull();
      expect(linha.nome).toBe("Aniversario editado");
      // Já arquivado: não arquiva nem edita de novo.
      await arquivar().expect(404);
      await editar({
        data: `${ANO - 1}-03-03`,
        nome: "X",
        tipo: "municipal",
        unidadeIds: [],
      }).expect(404);
      // Não há mais rota de apagar.
      await agent()
        .delete(`/v1/escala/feriados/${id}`)
        .set("Cookie", rhA.cookie)
        .set("x-csrf-token", rhA.csrfToken)
        .expect(404);
      const trilha = await prisma.auditEvent.findMany({
        where: { resourceId: id },
        orderBy: { occurredAt: "asc" },
      });
      expect(trilha.map((e) => e.action)).toEqual([
        "pessoas_escala_feriado_criado",
        "pessoas_escala_feriado_alterado",
        "pessoas_escala_feriado_arquivado",
      ]);
      expect(JSON.stringify(trilha)).not.toContain("Aniversario");
    });

    it("permissões: DP salva; master lê só com empresa ativa (sem ela, 403); demais negados", async () => {
      await get("/v1/escala/regras", dpA).expect(200);
      await putRegras(BASE_REGRAS, dpA).expect(200);
      await get("/v1/escala/regras", master).expect(403);
      await putRegras(BASE_REGRAS, master).expect(403);
      for (const cred of outros) {
        await get("/v1/escala/regras", cred).expect(403);
        await putRegras(BASE_REGRAS, cred).expect(403);
      }
      await agent().get("/v1/escala/regras").expect(401);
    });
  });
  describe("visões salvas do quadro", () => {
    const VISOES = "/v1/escala/visoes";
    const criar = (corpo: Record<string, unknown>, cred: Credencial = rhA) =>
      post(VISOES, cred).send(corpo);
    const patch = (
      id: string,
      corpo: Record<string, unknown>,
      cred: Credencial = rhA,
    ) =>
      agent()
        .patch(`${VISOES}/${id}`)
        .set("Cookie", cred.cookie)
        .set("x-csrf-token", cred.csrfToken)
        .send(corpo);
    const apagar = (id: string, cred: Credencial = rhA) =>
      agent()
        .delete(`${VISOES}/${id}`)
        .set("Cookie", cred.cookie)
        .set("x-csrf-token", cred.csrfToken);
    interface Visao {
      id: string;
      nome: string;
      filtros: Record<string, unknown>;
    }

    it("salva com a forma completa, lista em ordem de nome e só para a própria conta e empresa", async () => {
      const r = await criar({
        nome: "  Sem escala da loja  ",
        filtros: { semEscala: true, departamentos: ["d1", "d1", "d2"] },
      }).expect(201);
      const visoes = r.body.visoes as Visao[];
      expect(visoes).toEqual([
        {
          id: expect.any(String),
          nome: "Sem escala da loja",
          filtros: {
            comAviso: false,
            semEscala: true,
            mudancas: false,
            ausentes: false,
            unidades: [],
            departamentos: ["d1", "d2"],
            tipos: [],
            turnos: [],
            gestores: [],
            cargos: [],
            areas: [],
            centrosCusto: [],
            niveis: [],
            generos: [],
          },
        },
      ]);
      await criar({ nome: "Avisos", filtros: { comAviso: true } }).expect(201);
      expect(
        ((await get(VISOES, rhA).expect(200)).body.visoes as Visao[]).map(
          (v) => v.nome,
        ),
      ).toEqual(["Avisos", "Sem escala da loja"]);
      // Outra conta da mesma empresa e outra empresa não veem.
      expect((await get(VISOES, dpA).expect(200)).body.visoes).toEqual([]);
      expect((await get(VISOES, rhB).expect(200)).body.visoes).toEqual([]);
      // O mesmo nome em outra conta pode.
      await criar({ nome: "Avisos", filtros: { comAviso: true } }, dpA).expect(
        201,
      );
      // Preferência de tela: sem trilha.
      const trilha = await prisma.auditEvent.findMany({
        where: { resourceId: visoes[0]!.id },
      });
      expect(trilha).toEqual([]);
    });

    it("recusa nome repetido (409), filtros vazios, chave desconhecida e forma errada", async () => {
      expect(
        (
          await criar({ nome: "Avisos", filtros: { mudancas: true } }).expect(
            409,
          )
        ).body.erros,
      ).toEqual([{ campo: "nome", motivo: "em_uso" }]);
      expect(
        (await criar({ nome: "Vazia", filtros: {} }).expect(422)).body.erros,
      ).toEqual([{ campo: "filtros", motivo: "obrigatorio" }]);
      for (const filtros of [
        { inventado: true },
        { comAviso: "sim" },
        { cargos: "c1" },
        { cargos: [1] },
        { cargos: [""] },
        { cargos: ["x".repeat(81)] },
      ]) {
        expect(
          (await criar({ nome: "X", filtros }).expect(422)).body.erros,
        ).toEqual([{ campo: "filtros", motivo: "invalido" }]);
      }
      await criar({ nome: "   ", filtros: { comAviso: true } }).expect(400);
      await criar({ nome: "x".repeat(61), filtros: { comAviso: true } }).expect(
        400,
      );
      await criar({ nome: "X", filtros: [] }).expect(400);
    });

    it("renomeia e remove só a própria; nome repetido ao renomear é 409", async () => {
      const lista = (await get(VISOES, rhA).expect(200)).body.visoes as Visao[];
      const avisos = lista.find((v) => v.nome === "Avisos")!;
      expect(
        (await patch(avisos.id, { nome: "Sem escala da loja" }).expect(409))
          .body.erros,
      ).toEqual([{ campo: "nome", motivo: "em_uso" }]);
      const r = await patch(avisos.id, { nome: "Com aviso" }).expect(200);
      expect((r.body.visoes as Visao[]).map((v) => v.nome)).toEqual([
        "Com aviso",
        "Sem escala da loja",
      ]);
      // Outra conta: 404 (não revela que existe).
      await patch(avisos.id, { nome: "Dela" }, dpA).expect(404);
      await apagar(avisos.id, dpA).expect(404);
      await apagar(avisos.id, rhB).expect(404);
      const rem = await apagar(avisos.id).expect(200);
      expect((rem.body.visoes as Visao[]).map((v) => v.nome)).toEqual([
        "Sem escala da loja",
      ]);
      await apagar(avisos.id).expect(404);
      await patch("nao-e-uuid", { nome: "X" }).expect(400);
    });

    it("teto de 30 visões por conta e empresa", async () => {
      const ja = ((await get(VISOES, rhB).expect(200)).body.visoes as Visao[])
        .length;
      for (let i = ja; i < 30; i++) {
        await criar(
          { nome: `Visao ${i}`, filtros: { comAviso: true } },
          rhB,
        ).expect(201);
      }
      expect(
        (
          await criar(
            { nome: "Uma a mais", filtros: { comAviso: true } },
            rhB,
          ).expect(422)
        ).body.erros,
      ).toEqual([{ campo: "nome", motivo: "limite" }]);
      // A lista vem em ordem de nome (não de criação).
      const nomes = (
        (await get(VISOES, rhB).expect(200)).body.visoes as Visao[]
      ).map((v) => v.nome);
      expect(nomes).toHaveLength(30);
      expect(nomes).toEqual(
        [...nomes].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)),
      );
      expect(nomes.slice(0, 3)).toEqual(["Visao 0", "Visao 1", "Visao 10"]);
    });

    it("forma gravada fora do padrão vira filtro vazio ao ler", async () => {
      const r = await criar(
        { nome: "Para estragar", filtros: { comAviso: true } },
        dpA,
      ).expect(201);
      const id = (r.body.visoes as Visao[]).find(
        (v) => v.nome === "Para estragar",
      )!.id;
      await prisma.escalaVisao.update({
        where: { id },
        data: { filtros: { comAviso: "sim" } },
      });
      const v = (
        (await get(VISOES, dpA).expect(200)).body.visoes as Visao[]
      ).find((x) => x.id === id)!;
      expect(v.filtros).toMatchObject({ comAviso: false, cargos: [] });
    });

    it("permissões: master sem empresa ativa 403; demais papéis, sem CSRF e sem sessão negados", async () => {
      await get(VISOES, master).expect(403);
      await criar({ nome: "M", filtros: { comAviso: true } }, master).expect(
        403,
      );
      for (const cred of outros) {
        await get(VISOES, cred).expect(403);
        await criar({ nome: "O", filtros: { comAviso: true } }, cred).expect(
          403,
        );
      }
      await agent()
        .post(VISOES)
        .set("Cookie", rhA.cookie)
        .send({ nome: "Sem CSRF", filtros: { comAviso: true } })
        .expect(403);
      await agent().get(VISOES).expect(401);
    });
  });
});
