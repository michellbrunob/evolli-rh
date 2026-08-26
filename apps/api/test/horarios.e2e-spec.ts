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
 * T038 — Cadastros: Tabelas de Horario e vinculo historico ao colaborador.
 * PostgreSQL real e efemero (Testcontainers), migration aplicada do zero.
 *
 * **Todos os dados sao sinteticos.** Nomes obviamente ficticios, dominio
 * reservado `example.test`, matriculas arbitrarias, horarios inventados.
 * Nenhum dado real de pessoa, CPF, arquivo ou imagem, em nenhuma hipotese.
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
const TS_NODE_REGISTER = require.resolve("ts-node/register/transpile-only");

const ADMIN_USER = "admin_test";
const ADMIN_PASSWORD = "admin_test_pw";
const ADMIN_DB = "evolli_test";
const MIGRATOR_PASSWORD = "migrator_test_pw";
const APP_PASSWORD = "app_test_pw";

const SENHA_PADRAO = "Horarios!Cadastro2026#Teste";
const ADMISSAO = "2026-01-05";

/** Grade semanal sintetica de referencia (44h: seg-qui 9h, sex 8h). */
const GRADE_44H = [
  { dia: "segunda", inicio: "08:00", fim: "12:00" },
  { dia: "segunda", inicio: "13:00", fim: "18:00" },
  { dia: "terca", inicio: "08:00", fim: "12:00" },
  { dia: "terca", inicio: "13:00", fim: "18:00" },
  { dia: "quarta", inicio: "08:00", fim: "12:00" },
  { dia: "quarta", inicio: "13:00", fim: "18:00" },
  { dia: "quinta", inicio: "08:00", fim: "12:00" },
  { dia: "quinta", inicio: "13:00", fim: "18:00" },
  { dia: "sexta", inicio: "08:00", fim: "12:00" },
  { dia: "sexta", inicio: "13:00", fim: "17:00" },
];

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

function runBootstrap(env: Record<string, string>): { status: number } {
  try {
    execFileSync(
      process.execPath,
      [
        "-r",
        TS_NODE_REGISTER,
        join(API_ROOT, "src/bootstrap/bootstrap-admin.ts"),
      ],
      { cwd: API_ROOT, env: { ...process.env, ...env }, stdio: "pipe" },
    );
    return { status: 0 };
  } catch (error) {
    return { status: (error as { status: number }).status };
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

describe("Cadastros: Horarios e vinculo ao colaborador (e2e)", () => {
  let container: StartedTestContainer;
  let appUrl: string;
  let migratorUrl: string;
  let app: INestApplication;

  let admin: Credencial;
  let master: Credencial;
  let rhA: Credencial;
  let dpA: Credencial;
  let rhB: Credencial;
  let gestorA: Credencial;
  let financeiroA: Credencial;
  let colaboradorA: Credencial;
  let auditorA: Credencial;
  let dpoA: Credencial;

  let empresaA: string;
  let empresaB: string;
  let departamentoA: string;
  let departamentoB: string;

  let colaboradorAId: string;
  let colaboradorBId: string;

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
    const prisma = new PrismaClient({ datasources: { db: { url: appUrl } } });
    try {
      const passwordHash = await new PasswordHashService().hash(SENHA_PADRAO);
      await prisma.accessUser.create({
        data: { email, passwordHash, role: "master_tecnico", status: "active" },
      });
    } finally {
      await prisma.$disconnect();
    }
    return login(email, SENHA_PADRAO);
  }

  async function seedUsuarioComPapel(
    email: string,
    role: "dpo" | "auditor",
    companyId: string,
  ): Promise<Credencial> {
    const { PasswordHashService } =
      await import("../src/auth/password/password-hash.service");
    const prisma = new PrismaClient({ datasources: { db: { url: appUrl } } });
    try {
      const passwordHash = await new PasswordHashService().hash(SENHA_PADRAO);
      await prisma.accessUser.create({
        data: { email, passwordHash, role, companyId, status: "active" },
      });
    } finally {
      await prisma.$disconnect();
    }
    return login(email, SENHA_PADRAO);
  }

  async function criarUsuario(
    email: string,
    role: string,
    companyId: string | undefined,
  ): Promise<Credencial> {
    await agent()
      .post("/v1/users")
      .set("Cookie", master.cookie)
      .set("x-csrf-token", master.csrfToken)
      .send({
        email,
        password: SENHA_PADRAO,
        role,
        ...(companyId ? { companyId } : {}),
      })
      .expect(201);
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

  /** Admite, efetiva e devolve o id do colaborador (com vinculo funcional ativo). */
  async function admitir(
    cred: Credencial,
    dados: {
      nome: string;
      empresaId: string;
      matricula: string;
      departamentoId: string;
    },
  ): Promise<string> {
    const colaborador = await post("/v1/colaboradores", cred)
      .send({
        nome: dados.nome,
        empresaId: dados.empresaId,
        matricula: dados.matricula,
        tipo: "clt",
        dataAdmissao: ADMISSAO,
        motivoCodigo: "admissao_inicial",
        departamentoId: dados.departamentoId,
      })
      .expect(201);

    const vinculos = await get(
      `/v1/colaboradores/${colaborador.body.id}/vinculos`,
      cred,
    ).expect(200);
    const vinculoId: string = vinculos.body[0].id;
    const linha = await get(
      `/v1/vinculos/${vinculoId}/linha-do-tempo`,
      cred,
    ).expect(200);
    await post(`/v1/movimentacoes/${linha.body[0].id}/efetivar`, cred)
      .send()
      .expect(201);

    return colaborador.body.id;
  }

  async function criarTabela(
    cred: Credencial,
    nome: string,
    periodos: { dia: string; inicio: string; fim: string }[] = GRADE_44H,
  ): Promise<{ id: string; body: Record<string, unknown> }> {
    const resposta = await post("/v1/horarios", cred)
      .send({ nome, periodos })
      .expect(201);
    return { id: resposta.body.id, body: resposta.body };
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

    migratorUrl = `postgresql://evolli_migrator:${MIGRATOR_PASSWORD}@${host}:${port}/${ADMIN_DB}?schema=app`;
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
    app = await buildApp();

    const adminEmail = "admin.horarios@example.test";
    expect(
      runBootstrap({
        DATABASE_URL: appUrl,
        ADMIN_BOOTSTRAP_EMAIL: adminEmail,
        ADMIN_BOOTSTRAP_PASSWORD: SENHA_PADRAO,
      }).status,
    ).toBe(0);
    admin = await login(adminEmail, SENHA_PADRAO);
    master = await seedMaster("master.horarios@example.test");

    const empA = await post("/v1/empresas", master)
      .send({ codigo: "EMP_HOR_A", nome: "Empresa Sintetica Horarios A" })
      .expect(201);
    empresaA = empA.body.id;
    const empB = await post("/v1/empresas", master)
      .send({ codigo: "EMP_HOR_B", nome: "Empresa Sintetica Horarios B" })
      .expect(201);
    empresaB = empB.body.id;

    const depA = await post("/v1/departamentos", master)
      .send({
        codigo: "DEP_HOR_A",
        nome: "Departamento Sintetico A",
        empresaId: empresaA,
      })
      .expect(201);
    departamentoA = depA.body.id;
    const depB = await post("/v1/departamentos", master)
      .send({
        codigo: "DEP_HOR_B",
        nome: "Departamento Sintetico B",
        empresaId: empresaB,
      })
      .expect(201);
    departamentoB = depB.body.id;

    rhA = await criarUsuario("rh.a.horarios@example.test", "rh", empresaA);
    dpA = await criarUsuario("dp.a.horarios@example.test", "dp", empresaA);
    rhB = await criarUsuario("rh.b.horarios@example.test", "rh", empresaB);
    gestorA = await criarUsuario(
      "gestor.a.horarios@example.test",
      "gestor",
      empresaA,
    );
    financeiroA = await criarUsuario(
      "financeiro.a.horarios@example.test",
      "financeiro",
      empresaA,
    );
    colaboradorA = await criarUsuario(
      "colaborador.a.horarios@example.test",
      "colaborador",
      empresaA,
    );
    auditorA = await seedUsuarioComPapel(
      "auditor.a.horarios@example.test",
      "auditor",
      empresaA,
    );
    dpoA = await seedUsuarioComPapel(
      "dpo.a.horarios@example.test",
      "dpo",
      empresaA,
    );

    colaboradorAId = await admitir(rhA, {
      nome: "Pessoa Sintetica Horarios A",
      empresaId: empresaA,
      matricula: "MAT-HOR-A",
      departamentoId: departamentoA,
    });
    colaboradorBId = await admitir(rhB, {
      nome: "Pessoa Sintetica Horarios B",
      empresaId: empresaB,
      matricula: "MAT-HOR-B",
      departamentoId: departamentoB,
    });
  });

  afterAll(async () => {
    await app?.close();
    await container?.stop();
  });

  // -------------------------------------------------------------------------
  describe("RH cadastra e consulta tabelas de horario", () => {
    it("cria uma tabela com periodos e projeta dia/hora legiveis", async () => {
      const { body } = await criarTabela(rhA, "Comercial 44h");
      expect(body.empresaId).toBe(empresaA);
      expect(body.nome).toBe("Comercial 44h");
      expect(body.ativo).toBe(true);
      const periodos = body.periodos as {
        dia: string;
        inicio: string;
        fim: string;
      }[];
      expect(periodos).toContainEqual({
        dia: "segunda",
        inicio: "08:00",
        fim: "12:00",
      });
      expect(periodos).toContainEqual({
        dia: "sexta",
        inicio: "13:00",
        fim: "17:00",
      });
      // Sabado e domingo sem periodo (sem jornada inicial).
      expect(periodos.some((p) => p.dia === "sabado")).toBe(false);
      expect(periodos.some((p) => p.dia === "domingo")).toBe(false);
    });

    it("aceita tabela sem periodos (sem jornada prevista)", async () => {
      const { body } = await criarTabela(rhA, "Sem jornada", []);
      expect(body.periodos).toEqual([]);
    });

    it("rejeita periodos sobrepostos no mesmo dia (422)", async () => {
      await post("/v1/horarios", rhA)
        .send({
          nome: "Invalida",
          periodos: [
            { dia: "segunda", inicio: "08:00", fim: "12:00" },
            { dia: "segunda", inicio: "11:00", fim: "15:00" },
          ],
        })
        .expect(422);
    });

    it("rejeita hora fora do formato HH:MM (400)", async () => {
      await post("/v1/horarios", rhA)
        .send({
          nome: "X",
          periodos: [{ dia: "segunda", inicio: "8h", fim: "12:00" }],
        })
        .expect(400);
    });

    it("rejeita campo nao declarado no corpo (400)", async () => {
      await post("/v1/horarios", rhA)
        .send({ nome: "X", periodos: [], empresaId: empresaB })
        .expect(400);
    });

    it("desativa e reativa (logico, sem exclusao fisica)", async () => {
      const { id } = await criarTabela(rhA, "Para desativar");
      const desativada = await post(`/v1/horarios/${id}/desativar`, rhA)
        .send()
        .expect(201);
      expect(desativada.body.ativo).toBe(false);
      const reativada = await post(`/v1/horarios/${id}/reativar`, rhA)
        .send()
        .expect(201);
      expect(reativada.body.ativo).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  describe("RH vincula tabela a colaborador com vigencia", () => {
    it("cria vinculo aberto e o projeta com datas ISO", async () => {
      const { id: tabelaId } = await criarTabela(rhA, "Vinculavel 1");
      const resp = await post("/v1/horarios/vinculos", rhA)
        .send({
          colaboradorId: colaboradorAId,
          tabelaHorarioId: tabelaId,
          vigenciaInicio: "2026-02-01",
        })
        .expect(201);
      expect(resp.body.empresaId).toBe(empresaA);
      expect(resp.body.colaboradorId).toBe(colaboradorAId);
      expect(resp.body.vigenciaInicio).toBe("2026-02-01");
      expect(resp.body.vigenciaFim).toBeNull();
    });

    it("bloqueia duas tabelas vigentes para o mesmo colaborador (409)", async () => {
      const { id: t1 } = await criarTabela(rhA, "Conc 1");
      const { id: t2 } = await criarTabela(rhA, "Conc 2");
      const colab = await admitir(rhA, {
        nome: "Pessoa Conc",
        empresaId: empresaA,
        matricula: "MAT-CONC",
        departamentoId: departamentoA,
      });
      await post("/v1/horarios/vinculos", rhA)
        .send({
          colaboradorId: colab,
          tabelaHorarioId: t1,
          vigenciaInicio: "2026-01-01",
        })
        .expect(201);
      // Segundo vinculo aberto para o mesmo colaborador -> conflito.
      await post("/v1/horarios/vinculos", rhA)
        .send({
          colaboradorId: colab,
          tabelaHorarioId: t2,
          vigenciaInicio: "2026-03-01",
        })
        .expect(409);
    });

    it("troca de horario: encerra o aberto e cria o proximo (historico preservado)", async () => {
      const { id: t1 } = await criarTabela(rhA, "Troca 1");
      const { id: t2 } = await criarTabela(rhA, "Troca 2");
      const colab = await admitir(rhA, {
        nome: "Pessoa Troca",
        empresaId: empresaA,
        matricula: "MAT-TROCA",
        departamentoId: departamentoA,
      });
      const v1 = await post("/v1/horarios/vinculos", rhA)
        .send({
          colaboradorId: colab,
          tabelaHorarioId: t1,
          vigenciaInicio: "2026-01-01",
        })
        .expect(201);
      // Encerra em 2026-06-01 e abre o proximo a partir da mesma data (adjacente).
      const encerrado = await post(
        `/v1/horarios/vinculos/${v1.body.id}/encerrar`,
        rhA,
      )
        .send({ vigenciaFim: "2026-06-01" })
        .expect(201);
      expect(encerrado.body.vigenciaFim).toBe("2026-06-01");
      await post("/v1/horarios/vinculos", rhA)
        .send({
          colaboradorId: colab,
          tabelaHorarioId: t2,
          vigenciaInicio: "2026-06-01",
        })
        .expect(201);

      // O historico permanece: dois vinculos para o colaborador.
      const lista = await get(
        `/v1/horarios/vinculos?colaboradorId=${colab}`,
        rhA,
      ).expect(200);
      expect(lista.body.total).toBe(2);
    });

    it("nao vincula tabela desativada (422)", async () => {
      const { id } = await criarTabela(rhA, "Desativada p/ vinculo");
      await post(`/v1/horarios/${id}/desativar`, rhA).send().expect(201);
      const colab = await admitir(rhA, {
        nome: "Pessoa DesatV",
        empresaId: empresaA,
        matricula: "MAT-DESV",
        departamentoId: departamentoA,
      });
      await post("/v1/horarios/vinculos", rhA)
        .send({
          colaboradorId: colab,
          tabelaHorarioId: id,
          vigenciaInicio: "2026-01-01",
        })
        .expect(422);
    });

    it("nao encerra vinculo ja encerrado (422)", async () => {
      const { id } = await criarTabela(rhA, "Enc dupla");
      const colab = await admitir(rhA, {
        nome: "Pessoa EncDupla",
        empresaId: empresaA,
        matricula: "MAT-ENCD",
        departamentoId: departamentoA,
      });
      const v = await post("/v1/horarios/vinculos", rhA)
        .send({
          colaboradorId: colab,
          tabelaHorarioId: id,
          vigenciaInicio: "2026-01-01",
        })
        .expect(201);
      await post(`/v1/horarios/vinculos/${v.body.id}/encerrar`, rhA)
        .send({ vigenciaFim: "2026-06-01" })
        .expect(201);
      await post(`/v1/horarios/vinculos/${v.body.id}/encerrar`, rhA)
        .send({ vigenciaFim: "2026-07-01" })
        .expect(422);
    });
  });

  // -------------------------------------------------------------------------
  describe("isolamento por empresa (IDOR/BOLA)", () => {
    it("rhA nao ve nem opera tabela da empresa B (404)", async () => {
      const { id: tabelaB } = await criarTabela(rhB, "So da B");
      await get(`/v1/horarios/${tabelaB}`, rhA).expect(404);
      await post(`/v1/horarios/${tabelaB}/desativar`, rhA).send().expect(404);
      // rhB ve normalmente.
      await get(`/v1/horarios/${tabelaB}`, rhB).expect(200);
    });

    it("listagem so traz tabelas da propria empresa", async () => {
      await criarTabela(rhB, "Outra da B");
      const lista = await get("/v1/horarios", rhA).expect(200);
      for (const item of lista.body.itens as { empresaId: string }[]) {
        expect(item.empresaId).toBe(empresaA);
      }
    });

    it("rhA nao vincula colaborador da empresa B (404 anti-enumeracao)", async () => {
      const { id: tabelaA } = await criarTabela(rhA, "Alvo cruz");
      await post("/v1/horarios/vinculos", rhA)
        .send({
          colaboradorId: colaboradorBId,
          tabelaHorarioId: tabelaA,
          vigenciaInicio: "2026-01-01",
        })
        .expect(404);
    });

    it("rhA nao vincula usando tabela da empresa B (404)", async () => {
      const { id: tabelaB } = await criarTabela(rhB, "Tabela cruz B");
      await post("/v1/horarios/vinculos", rhA)
        .send({
          colaboradorId: colaboradorAId,
          tabelaHorarioId: tabelaB,
          vigenciaInicio: "2026-01-01",
        })
        .expect(404);
    });
  });

  // -------------------------------------------------------------------------
  describe("autorizacao: so RH opera (T037)", () => {
    it("sem sessao -> 401; com sessao e sem CSRF -> 403", async () => {
      await agent().get("/v1/horarios").expect(401);
      await agent()
        .post("/v1/horarios")
        .set("Cookie", rhA.cookie)
        .send({ nome: "X", periodos: [] })
        .expect(403);
    });

    it("DP e NEGADO (a alcada de horario e exclusiva de RH)", async () => {
      const criar = await post("/v1/horarios", dpA).send({
        nome: "X",
        periodos: [],
      });
      expect([403, 404]).toContain(criar.status);
      expect(criar.status).not.toBe(201);
      const ler = await get("/v1/horarios", dpA);
      expect([403, 404]).toContain(ler.status);
    });

    it("gestor, financeiro, colaborador, auditor e dpo sao negados", async () => {
      for (const cred of [gestorA, financeiroA, colaboradorA, auditorA, dpoA]) {
        const criar = await post("/v1/horarios", cred).send({
          nome: "X",
          periodos: [],
        });
        expect([403, 404]).toContain(criar.status);
        const ler = await get("/v1/horarios", cred);
        expect([403, 404]).toContain(ler.status);
      }
    });

    it("admin_tecnico e negado", async () => {
      const criar = await post("/v1/horarios", admin).send({
        nome: "X",
        periodos: [],
      });
      expect([403, 404]).toContain(criar.status);
    });
  });

  // -------------------------------------------------------------------------
  describe("master_tecnico: leitura global, sem mutacao", () => {
    it("le tabelas de qualquer empresa mas nao cria nem desativa", async () => {
      const { id: tabelaA } = await criarTabela(rhA, "Global A");
      const { id: tabelaB } = await criarTabela(rhB, "Global B");
      // Le as duas.
      await get(`/v1/horarios/${tabelaA}`, master).expect(200);
      await get(`/v1/horarios/${tabelaB}`, master).expect(200);
      // A listagem global cruza empresas.
      const lista = await get("/v1/horarios", master).expect(200);
      const empresas = new Set(
        (lista.body.itens as { empresaId: string }[]).map((i) => i.empresaId),
      );
      expect(empresas.has(empresaA)).toBe(true);
      expect(empresas.has(empresaB)).toBe(true);
      // Nao muta.
      await post("/v1/horarios", master)
        .send({ nome: "X", periodos: [] })
        .expect(403);
      await post(`/v1/horarios/${tabelaA}/desativar`, master)
        .send()
        .expect(403);
      await post("/v1/horarios/vinculos", master)
        .send({
          colaboradorId: colaboradorAId,
          tabelaHorarioId: tabelaA,
          vigenciaInicio: "2026-01-01",
        })
        .expect(403);
    });
  });

  // -------------------------------------------------------------------------
  describe("garantias no banco (nao so no service)", () => {
    it("existe a EXCLUSION de sobreposicao de periodos e ela rejeita interseccao", async () => {
      const migrator = new PrismaClient({
        datasources: { db: { url: migratorUrl } },
      });
      try {
        const def = await migrator.$queryRawUnsafe<{ definicao: string }[]>(
          `SELECT pg_get_constraintdef(oid) AS definicao FROM pg_constraint WHERE conname = 'periodo_horario_sem_sobreposicao'`,
        );
        expect(def).toHaveLength(1);
        expect(def[0]!.definicao).toContain("EXCLUDE USING gist");

        const { id: tabelaId } = await criarTabela(rhA, "DB periodo");
        // Insercao crua de um periodo que intersecta 08:00-12:00 de segunda (dia 1).
        await expect(
          migrator.$executeRawUnsafe(
            `INSERT INTO app.periodo_horario (id, tabela_horario_id, dia_semana, inicio_minuto, fim_minuto, criado_em)
             VALUES (gen_random_uuid()::text, $1, 1, 600, 900, now())`,
            tabelaId,
          ),
        ).rejects.toThrow(/exclusion constraint|23P01/i);
      } finally {
        await migrator.$disconnect();
      }
    });

    it("existe a EXCLUSION de sobreposicao de vigencia e ela rejeita overlap", async () => {
      const migrator = new PrismaClient({
        datasources: { db: { url: migratorUrl } },
      });
      try {
        const def = await migrator.$queryRawUnsafe<{ definicao: string }[]>(
          `SELECT pg_get_constraintdef(oid) AS definicao FROM pg_constraint WHERE conname = 'vinculo_horario_sem_sobreposicao'`,
        );
        expect(def).toHaveLength(1);
        expect(def[0]!.definicao).toContain("EXCLUDE USING gist");
        expect(def[0]!.definicao).toContain("'[)'");

        const { id: tabelaId } = await criarTabela(rhA, "DB vigencia");
        const colab = await admitir(rhA, {
          nome: "Pessoa DBVig",
          empresaId: empresaA,
          matricula: "MAT-DBVIG",
          departamentoId: departamentoA,
        });
        const userId = await migrator.$queryRawUnsafe<{ id: string }[]>(
          `SELECT id FROM app.access_user WHERE email = 'rh.a.horarios@example.test'`,
        );
        const criadoPor = userId[0]!.id;
        const inserir = (de: string, ate: string | null) =>
          migrator.$executeRawUnsafe(
            `INSERT INTO app.vinculo_horario (id, colaborador_id, empresa_id, tabela_horario_id, vigencia_inicio, vigencia_fim, criado_por_user_id, criado_em, atualizado_em)
             VALUES (gen_random_uuid()::text, $1, $2, $3, $4::date, $5::date, $6, now(), now())`,
            colab,
            empresaA,
            tabelaId,
            de,
            ate,
            criadoPor,
          );
        await inserir("2026-01-01", "2026-06-01");
        await expect(inserir("2026-03-01", "2026-09-01")).rejects.toThrow(
          /exclusion constraint|23P01|unique constraint|vigente_unico/i,
        );
      } finally {
        await migrator.$disconnect();
      }
    });

    it("evolli_app nao tem DELETE em tabela_horario nem UPDATE em periodo_horario", async () => {
      const { id: tabelaId } = await criarTabela(rhA, "Privilegio");
      const appClient = new PrismaClient({
        datasources: { db: { url: appUrl } },
      });
      try {
        await expect(
          appClient.$executeRawUnsafe(
            `DELETE FROM app.tabela_horario WHERE id = $1`,
            tabelaId,
          ),
        ).rejects.toThrow(/permission denied/i);
        await expect(
          appClient.$executeRawUnsafe(
            `UPDATE app.periodo_horario SET fim_minuto = 999 WHERE tabela_horario_id = $1`,
            tabelaId,
          ),
        ).rejects.toThrow(/permission denied/i);
      } finally {
        await appClient.$disconnect();
      }
    });

    it("a trigger recusa vinculo de colaborador sem vinculo funcional na empresa", async () => {
      const migrator = new PrismaClient({
        datasources: { db: { url: migratorUrl } },
      });
      try {
        const { id: tabelaId } = await criarTabela(rhA, "Trigger cruz");
        const userId = await migrator.$queryRawUnsafe<{ id: string }[]>(
          `SELECT id FROM app.access_user WHERE email = 'rh.a.horarios@example.test'`,
        );
        // colaboradorBId tem vinculo funcional so na empresa B; usa-lo na
        // empresa A viola a integridade (via CONSTRAINT TRIGGER, no COMMIT).
        await expect(
          migrator.$transaction([
            migrator.$executeRawUnsafe(
              `INSERT INTO app.vinculo_horario (id, colaborador_id, empresa_id, tabela_horario_id, vigencia_inicio, criado_por_user_id, criado_em, atualizado_em)
               VALUES (gen_random_uuid()::text, $1, $2, $3, '2026-01-01'::date, $4, now(), now())`,
              colaboradorBId,
              empresaA,
              tabelaId,
              userId[0]!.id,
            ),
          ]),
        ).rejects.toThrow(/sem vinculo funcional na mesma empresa/i);
      } finally {
        await migrator.$disconnect();
      }
    });
  });

  // -------------------------------------------------------------------------
  describe("auditoria: registra o ato, nunca o conteudo", () => {
    it("registra criacao e consulta sem nome/descricao/hora na trilha", async () => {
      const prisma = new PrismaClient({ datasources: { db: { url: appUrl } } });
      try {
        const { id: tabelaId } = await criarTabela(
          rhA,
          "Auditavel Secreta 08:00",
        );
        await get(`/v1/horarios/${tabelaId}`, rhA).expect(200);

        const criada = await prisma.auditEvent.findFirst({
          where: { action: "horarios_tabela_criada", resourceId: tabelaId },
        });
        expect(criada?.companyId).toBe(empresaA);
        expect(criada?.actorRole).toBe("rh");
        expect(criada?.result).toBe("success");

        const consulta = await prisma.auditEvent.findFirst({
          where: { action: "horarios_consultado", resourceId: tabelaId },
        });
        expect(consulta?.result).toBe("success");

        for (const evento of [criada, consulta]) {
          const serializado = JSON.stringify(evento);
          expect(serializado).not.toContain("Auditavel Secreta");
          expect(serializado).not.toContain("08:00");
        }
      } finally {
        await prisma.$disconnect();
      }
    });

    it("cada tentativa negada por escopo gera evento denied com id tecnico", async () => {
      const prisma = new PrismaClient({ datasources: { db: { url: appUrl } } });
      try {
        const { id: tabelaB } = await criarTabela(rhB, "Denied alvo");
        const antes = await prisma.auditEvent.count({
          where: { action: "authorization_denied", resource: "tabela_horario" },
        });
        await get(`/v1/horarios/${tabelaB}`, rhA).expect(404);
        const depois = await prisma.auditEvent.count({
          where: { action: "authorization_denied", resource: "tabela_horario" },
        });
        expect(depois).toBeGreaterThan(antes);
        const evento = await prisma.auditEvent.findFirst({
          where: {
            action: "authorization_denied",
            resource: "tabela_horario",
            resourceId: tabelaB,
          },
          orderBy: { occurredAt: "desc" },
        });
        expect(evento?.result).toBe("denied");
        expect(evento?.resourceId).toBe(tabelaB);
      } finally {
        await prisma.$disconnect();
      }
    });
  });

  // -------------------------------------------------------------------------
  describe("regressao: fatias anteriores intactas", () => {
    it("master ainda le estrutura organizacional; admin_tecnico segue negado", async () => {
      await get("/v1/empresas", master).expect(200);
      const adminLista = await get("/v1/empresas", admin);
      expect([403, 404]).toContain(adminLista.status);
    });

    it("rhA ainda opera pessoas na propria empresa", async () => {
      await get(`/v1/colaboradores/${colaboradorAId}/vinculos`, rhA).expect(
        200,
      );
    });
  });
});
