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
        ...camposObrigatoriosAdmissao(),
        ...(await lotacaoMinima(appUrl, dados.empresaId)),
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

  /** T182 — o código é obrigatório ao criar e único na empresa. */
  let sequenciaDeCodigo = 0;
  const novoCodigo = () => `JOR_${++sequenciaDeCodigo}`;

  async function criarTabela(
    cred: Credencial,
    nome: string,
    periodos: { dia: string; inicio: string; fim: string }[] = GRADE_44H,
    codigo: string = novoCodigo(),
  ): Promise<{ id: string; body: Record<string, unknown> }> {
    const resposta = await post("/v1/horarios", cred)
      .send({ codigo, nome, periodos })
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
          codigo: novoCodigo(),
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
          codigo: novoCodigo(),
          nome: "X",
          periodos: [{ dia: "segunda", inicio: "8h", fim: "12:00" }],
        })
        .expect(400);
    });

    it("rejeita campo nao declarado no corpo (400)", async () => {
      await post("/v1/horarios", rhA)
        .send({
          codigo: novoCodigo(),
          nome: "X",
          periodos: [],
          empresaId: empresaB,
        })
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

  describe("T112 — fundação web: Pessoas > Horário de trabalho", () => {
    it("lista → cria vínculo → relê por listagem e por detalhe → encerra vigência", async () => {
      const { id: tabelaId } = await criarTabela(rhA, "T112 Vinculavel");
      // Colaborador dedicado (não o `colaboradorAId` compartilhado com o
      // bloco "RH vincula tabela..." acima) — evita 409 por já existir um
      // vínculo de horário aberto naquele colaborador de outro teste.
      const colaboradorId = await admitir(rhA, {
        nome: "Pessoa T112 Ciclo",
        empresaId: empresaA,
        matricula: "MAT-T112-1",
        departamentoId: departamentoA,
      });

      const antes = await get(
        `/v1/horarios/vinculos?colaboradorId=${colaboradorId}`,
        rhA,
      ).expect(200);
      expect(antes.body.total).toBe(0);

      const criado = await post("/v1/horarios/vinculos", rhA)
        .send({
          colaboradorId,
          tabelaHorarioId: tabelaId,
          vigenciaInicio: "2026-08-01",
        })
        .expect(201);
      expect(criado.body.vigenciaFim).toBeNull();

      const lista = await get(
        `/v1/horarios/vinculos?colaboradorId=${colaboradorId}`,
        rhA,
      ).expect(200);
      expect(lista.body.total).toBe(1);

      const detalhe = await get(
        `/v1/horarios/vinculos/${criado.body.id}`,
        rhA,
      ).expect(200);
      expect(detalhe.body.tabelaHorarioId).toBe(tabelaId);
      expect(detalhe.body.vigenciaInicio).toBe("2026-08-01");

      const encerrado = await post(
        `/v1/horarios/vinculos/${criado.body.id}/encerrar`,
        rhA,
      )
        .send({ vigenciaFim: "2026-09-01" })
        .expect(201);
      expect(encerrado.body.vigenciaFim).toBe("2026-09-01");

      const detalheEncerrado = await get(
        `/v1/horarios/vinculos/${criado.body.id}`,
        rhA,
      ).expect(200);
      expect(detalheEncerrado.body.vigenciaFim).toBe("2026-09-01");
    });

    it("IDOR: rhB não acessa nem encerra vínculo de horário de rhA (404 anti-enumeração)", async () => {
      const { id: tabelaId } = await criarTabela(rhA, "T112 IDOR");
      const colaboradorId = await admitir(rhA, {
        nome: "Pessoa T112 IDOR",
        empresaId: empresaA,
        matricula: "MAT-T112-2",
        departamentoId: departamentoA,
      });
      const vinculo = await post("/v1/horarios/vinculos", rhA)
        .send({
          colaboradorId,
          tabelaHorarioId: tabelaId,
          vigenciaInicio: "2026-08-01",
        })
        .expect(201);

      await get(`/v1/horarios/vinculos/${vinculo.body.id}`, rhB).expect(404);
      await post(`/v1/horarios/vinculos/${vinculo.body.id}/encerrar`, rhB)
        .send({ vigenciaFim: "2026-09-01" })
        .expect(404);
    });
  });

  // -------------------------------------------------------------------------

  describe("T114 — leitura de referência de horário (somente leitura)", () => {
    it("lista, por colaboradorId, todos os vínculos de horário que se sobrepõem a uma troca no meio do mês", async () => {
      const colaboradorId = await admitir(rhA, {
        nome: "Pessoa T114 Referencia",
        empresaId: empresaA,
        matricula: "MAT-T114-1",
        departamentoId: departamentoA,
      });
      const { id: tabelaAntiga } = await criarTabela(rhA, "T114 Antiga");
      const { id: tabelaNova } = await criarTabela(rhA, "T114 Nova");

      const vinculoAntigo = await post("/v1/horarios/vinculos", rhA)
        .send({
          colaboradorId,
          tabelaHorarioId: tabelaAntiga,
          vigenciaInicio: "2025-06-01",
        })
        .expect(201);
      await post(`/v1/horarios/vinculos/${vinculoAntigo.body.id}/encerrar`, rhA)
        .send({ vigenciaFim: "2026-03-15" })
        .expect(201);
      await post("/v1/horarios/vinculos", rhA)
        .send({
          colaboradorId,
          tabelaHorarioId: tabelaNova,
          vigenciaInicio: "2026-03-15",
        })
        .expect(201);

      // A tela busca todos os vínculos do colaborador e filtra no cliente os
      // que se sobrepõem à competência escolhida (aqui, 2026-03).
      const lista = await get(
        `/v1/horarios/vinculos?colaboradorId=${colaboradorId}`,
        rhA,
      ).expect(200);
      expect(lista.body.total).toBe(2);
      const tabelasRetornadas = lista.body.itens.map(
        (v: { tabelaHorarioId: string }) => v.tabelaHorarioId,
      );
      expect(tabelasRetornadas).toEqual(
        expect.arrayContaining([tabelaAntiga, tabelaNova]),
      );

      // A tabela de cada vínculo carrega períodos projetados normalmente.
      const detalheTabelaNova = await get(
        `/v1/horarios/${tabelaNova}`,
        rhA,
      ).expect(200);
      expect(Array.isArray(detalheTabelaNova.body.periodos)).toBe(true);
    });

    it("IDOR: filtrar a listagem por colaborador de outra empresa nunca vaza dados — página vazia, nunca 403", async () => {
      // O vínculo de horário existe de fato na empresa B — a página vazia
      // para rhA precisa vir do escopo por empresa, não da ausência de dado.
      const { id: tabelaB } = await criarTabela(rhB, "T114 IDOR Tabela B");
      const vinculoHorarioB = await post("/v1/horarios/vinculos", rhB)
        .send({
          colaboradorId: colaboradorBId,
          tabelaHorarioId: tabelaB,
          vigenciaInicio: "2026-01-01",
        })
        .expect(201);

      // rhB enxerga o próprio vínculo normalmente.
      const listaDeB = await get(
        `/v1/horarios/vinculos?colaboradorId=${colaboradorBId}`,
        rhB,
      ).expect(200);
      expect(listaDeB.body.total).toBe(1);
      expect(listaDeB.body.itens[0].id).toBe(vinculoHorarioB.body.id);

      // rhA, filtrando pelo mesmo colaboradorId de outra empresa, recebe
      // página vazia — nunca 403, nunca o dado de fato de B.
      const semVinculo = await get(
        `/v1/horarios/vinculos?colaboradorId=${colaboradorBId}`,
        rhA,
      ).expect(200);
      expect(semVinculo.body.total).toBe(0);
      expect(semVinculo.body.itens).toEqual([]);
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
        .send({ codigo: novoCodigo(), nome: "X", periodos: [] })
        .expect(403);
    });

    // T182 — o DP CONSULTA as jornadas da propria empresa; criar segue so
    // do RH (T037).
    it("DP nao cria tabela, mas consulta a lista da propria empresa (T182)", async () => {
      const criar = await post("/v1/horarios", dpA).send({
        codigo: novoCodigo(),
        nome: "X",
        periodos: [],
      });
      expect([403, 404]).toContain(criar.status);
      expect(criar.status).not.toBe(201);
      const ler = await get("/v1/horarios", dpA).expect(200);
      for (const item of ler.body.itens as { empresaId: string }[]) {
        expect(item.empresaId).toBe(empresaA);
      }
    });

    it("gestor, financeiro, colaborador, auditor e dpo sao negados", async () => {
      for (const cred of [gestorA, financeiroA, colaboradorA, auditorA, dpoA]) {
        const criar = await post("/v1/horarios", cred).send({
          codigo: novoCodigo(),
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
        codigo: novoCodigo(),
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
        .send({ codigo: novoCodigo(), nome: "X", periodos: [] })
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
  describe("T110 — fundação web: tabelas de horário", () => {
    it("cria tabela e confirma nome e períodos por GET individual", async () => {
      const { id, body } = await criarTabela(rhA, "T110 Comercial (teste)");
      expect(body.nome).toBe("T110 Comercial (teste)");
      expect(body.ativo).toBe(true);

      const detalhe = await get(`/v1/horarios/${id}`, rhA).expect(200);
      expect(detalhe.body.nome).toBe("T110 Comercial (teste)");
      const periodos = detalhe.body.periodos as {
        dia: string;
        inicio: string;
        fim: string;
      }[];
      expect(periodos).toContainEqual({
        dia: "segunda",
        inicio: "08:00",
        fim: "12:00",
      });
    });

    it("ciclo desativar → reativar preserva nome e periodos", async () => {
      const { id } = await criarTabela(rhA, "T110 Ciclo Ativo (teste)");

      const desativada = await post(`/v1/horarios/${id}/desativar`, rhA)
        .send()
        .expect(201);
      expect(desativada.body.ativo).toBe(false);

      const reativada = await post(`/v1/horarios/${id}/reativar`, rhA)
        .send()
        .expect(201);
      expect(reativada.body.ativo).toBe(true);

      const detalhe = await get(`/v1/horarios/${id}`, rhA).expect(200);
      expect(detalhe.body.ativo).toBe(true);
      expect(detalhe.body.nome).toBe("T110 Ciclo Ativo (teste)");
    });

    it("IDOR: rhB não consegue desativar tabela de rhA (404 anti-enumeração)", async () => {
      const { id } = await criarTabela(rhA, "T110 Alvo IDOR (teste)");
      await post(`/v1/horarios/${id}/desativar`, rhB).send().expect(404);
      // rhA ainda vê e opera normalmente.
      await get(`/v1/horarios/${id}`, rhA).expect(200);
    });
  });

  // -------------------------------------------------------------------------
  // T182 — catálogo de Jornadas de trabalho em Estrutura (decisão da
  // proprietária de 2026-10-23): a tabela de horário ganha código único na
  // empresa e edição de nome e código; os períodos seguem imutáveis; o DP
  // consulta; a empresa é sempre a da sessão.
  describe("T182 — jornadas de trabalho: código, edição, busca e consulta do DP", () => {
    function patch(rota: string, cred: Credencial) {
      return agent()
        .patch(rota)
        .set("Cookie", cred.cookie)
        .set("x-csrf-token", cred.csrfToken);
    }

    async function comPrisma<T>(f: (p: PrismaClient) => Promise<T>) {
      const prisma = new PrismaClient({ datasources: { db: { url: appUrl } } });
      try {
        return await f(prisma);
      } finally {
        await prisma.$disconnect();
      }
    }

    const CODIGO_EM_USO = [{ campo: "codigo", motivo: "em_uso" }];

    it("RH cria com código, e a jornada volta com ele na lista e no detalhe", async () => {
      const { id, body } = await criarTabela(
        rhA,
        "Jornada Comercial T182",
        GRADE_44H,
        "COM_T182",
      );
      expect(body).toMatchObject({ codigo: "COM_T182", ativo: true });
      const detalhe = await get(`/v1/horarios/${id}`, rhA).expect(200);
      expect(detalhe.body.codigo).toBe("COM_T182");
      const lista = await get("/v1/horarios?busca=COM_T182", rhA).expect(200);
      expect(lista.body.itens.map((t: { id: string }) => t.id)).toEqual([id]);
    });

    it.each([
      ["sem código", {}],
      ["minúsculas", { codigo: "com_t182" }],
      ["curto", { codigo: "A" }],
      ["com espaço", { codigo: "COM T182" }],
    ])("código inválido (%s): 400 e nada criado", async (_caso, extra) => {
      const nome = `Jornada Invalida ${_caso}`;
      await post("/v1/horarios", rhA)
        .send({ nome, periodos: [], ...extra })
        .expect(400);
      expect(
        await comPrisma((p) => p.tabelaHorario.count({ where: { nome } })),
      ).toBe(0);
    });

    it("código repetido na mesma empresa: 409 no campo, sem eco, e nada criado; outra empresa aceita", async () => {
      await criarTabela(rhA, "Primeira com codigo", [], "DUP_T182");
      const repetido = await post("/v1/horarios", rhA)
        .send({ codigo: "DUP_T182", nome: "Segunda com codigo", periodos: [] })
        .expect(409);
      expect(repetido.body.erros).toEqual(CODIGO_EM_USO);
      expect(JSON.stringify(repetido.body)).not.toContain("DUP_T182");
      expect(JSON.stringify(repetido.body)).not.toContain("Segunda com codigo");
      expect(
        await comPrisma((p) =>
          p.tabelaHorario.count({
            where: { empresaId: empresaA, codigo: "DUP_T182" },
          }),
        ),
      ).toBe(1);
      await criarTabela(rhB, "Mesmo codigo na B", [], "DUP_T182");
    });

    it("RH edita nome e código; os períodos ficam; a trilha tem só o id", async () => {
      const { id, body } = await criarTabela(rhA, "Antes T182", GRADE_44H);
      const r = await patch(`/v1/horarios/${id}`, rhA)
        .send({ codigo: "EDT_T182", nome: "Depois Edicao T182" })
        .expect(200);
      expect(r.body).toMatchObject({
        codigo: "EDT_T182",
        nome: "Depois Edicao T182",
        periodos: body.periodos,
      });
      const eventos = await comPrisma((p) =>
        p.auditEvent.findMany({
          where: { action: "horarios_tabela_editada", resourceId: id },
        }),
      );
      expect(eventos).toHaveLength(1);
      expect(eventos[0]).toMatchObject({
        companyId: empresaA,
        actorRole: "rh",
        result: "success",
      });
      const trilha = JSON.stringify(eventos);
      expect(trilha).not.toContain("EDT_T182");
      expect(trilha).not.toContain("Depois Edicao");
      // Sem mudança real: devolve o gravado e não grava outra trilha.
      await patch(`/v1/horarios/${id}`, rhA)
        .send({ nome: "Depois Edicao T182" })
        .expect(200);
      expect(
        await comPrisma((p) =>
          p.auditEvent.count({
            where: { action: "horarios_tabela_editada", resourceId: id },
          }),
        ),
      ).toBe(1);
    });

    it("editar para um código de outra jornada da empresa: 409 no campo, e nada muda", async () => {
      await criarTabela(rhA, "Dona do codigo", [], "DONA_T182");
      const { id } = await criarTabela(rhA, "Quer o codigo", [], "QUER_T182");
      const r = await patch(`/v1/horarios/${id}`, rhA)
        .send({ codigo: "DONA_T182" })
        .expect(409);
      expect(r.body.erros).toEqual(CODIGO_EM_USO);
      const atual = await get(`/v1/horarios/${id}`, rhA).expect(200);
      expect(atual.body.codigo).toBe("QUER_T182");
    });

    it.each([
      ["períodos", { periodos: [] }],
      ["empresa", { empresaId: "11111111-1111-4111-8111-111111111111" }],
      ["corpo vazio", {}],
      ["nome só com espaços", { nome: "   " }],
    ])(
      "edição com %s: 400, e os períodos seguem imutáveis",
      async (_caso, corpo) => {
        const { id, body } = await criarTabela(rhA, `Imutavel ${_caso}`);
        await patch(`/v1/horarios/${id}`, rhA).send(corpo).expect(400);
        const atual = await get(`/v1/horarios/${id}`, rhA).expect(200);
        expect(atual.body.periodos).toEqual(body.periodos);
        expect(atual.body.nome).toBe(`Imutavel ${_caso}`);
      },
    );

    // `null` não é "não alterar": é recusado antes do serviço. Sem isso, o
    // código seria apagado (ou daria 409 falso contra jornadas antigas sem
    // código) e o nome nulo viraria 500 no Prisma.
    it.each([
      ["codigo: null", { codigo: null }],
      ["nome: null", { nome: null }],
      ["os dois nulos", { codigo: null, nome: null }],
      ["nome válido e codigo: null", { nome: "Outro nome T182", codigo: null }],
    ])(
      "edição com %s: 400, nada muda e nenhuma trilha de edição",
      async (_caso, corpo) => {
        // Uma jornada antiga sem código na mesma empresa: o 409 falso viria
        // dela, se o `null` chegasse à consulta de código em uso.
        await comPrisma(async (p) => {
          const usuario = await p.accessUser.findFirstOrThrow({
            where: { role: "rh", companyId: empresaA },
          });
          await p.tabelaHorario.create({
            data: {
              empresaId: empresaA,
              nome: `Antiga sem codigo nulo ${_caso}`,
              criadoPorUserId: usuario.id,
            },
          });
        });
        const { id, body } = await criarTabela(rhA, `Nulo ${_caso} T182`);
        const r = await patch(`/v1/horarios/${id}`, rhA)
          .send(corpo)
          .expect(400);
        expect(r.body.erros).toBeUndefined();
        const atual = await get(`/v1/horarios/${id}`, rhA).expect(200);
        expect(atual.body).toMatchObject({
          codigo: body.codigo,
          nome: `Nulo ${_caso} T182`,
          periodos: body.periodos,
        });
        expect(
          await comPrisma((p) =>
            p.auditEvent.count({
              where: { action: "horarios_tabela_editada", resourceId: id },
            }),
          ),
        ).toBe(0);
      },
    );

    it("criar com codigo: null continua recusado (400), e nada é criado", async () => {
      const nome = "Criacao codigo nulo T182";
      await post("/v1/horarios", rhA)
        .send({ codigo: null, nome, periodos: [] })
        .expect(400);
      expect(
        await comPrisma((p) => p.tabelaHorario.count({ where: { nome } })),
      ).toBe(0);
    });

    it("campo ausente segue sendo 'não alterar': só o nome muda", async () => {
      const { id, body } = await criarTabela(rhA, "Ausente T182", GRADE_44H);
      const r = await patch(`/v1/horarios/${id}`, rhA)
        .send({ nome: "Ausente Renomeada T182" })
        .expect(200);
      expect(r.body).toMatchObject({
        codigo: body.codigo,
        nome: "Ausente Renomeada T182",
        periodos: body.periodos,
      });
    });

    it("tabela criada antes do código aparece sem código e ganha um pela edição", async () => {
      const antiga = await comPrisma(async (p) => {
        const usuario = await p.accessUser.findFirstOrThrow({
          where: { role: "rh", companyId: empresaA },
        });
        return p.tabelaHorario.create({
          data: {
            empresaId: empresaA,
            nome: "Antiga sem codigo T182",
            criadoPorUserId: usuario.id,
          },
        });
      });
      const lista = await get(
        "/v1/horarios?busca=Antiga sem codigo T182",
        rhA,
      ).expect(200);
      expect(lista.body.itens[0]).toMatchObject({
        id: antiga.id,
        codigo: null,
      });
      const r = await patch(`/v1/horarios/${antiga.id}`, rhA)
        .send({ codigo: "ANTIGA_T182" })
        .expect(200);
      expect(r.body.codigo).toBe("ANTIGA_T182");
    });

    it("busca por nome (sem diferenciar caixa) e por código; curinga vale literalmente", async () => {
      const { id: a } = await criarTabela(
        rhA,
        "Turno Matutino Busca",
        [],
        "MAT_BUSCA",
      );
      const { id: b } = await criarTabela(
        rhA,
        "Turno Noturno Busca",
        [],
        "NOT_BUSCA",
      );
      const porNome = await get(
        "/v1/horarios?busca=matutino busca",
        rhA,
      ).expect(200);
      expect(porNome.body.itens.map((t: { id: string }) => t.id)).toEqual([a]);
      const porCodigo = await get("/v1/horarios?busca=not_busca", rhA).expect(
        200,
      );
      expect(porCodigo.body.itens.map((t: { id: string }) => t.id)).toEqual([
        b,
      ]);
      const curinga = await get("/v1/horarios?busca=%25", rhA).expect(200);
      expect(curinga.body.itens).toEqual([]);
      // Só a empresa da sessão: a B não vê as jornadas da A.
      const daB = await get("/v1/horarios?busca=Busca", rhB).expect(200);
      expect(daB.body.itens).toEqual([]);
    });

    it("DP consulta lista e detalhe da própria empresa, e não cria, edita, inativa nem reativa", async () => {
      const { id } = await criarTabela(
        rhA,
        "Consulta do DP T182",
        [],
        "DP_T182",
      );
      const lista = await get("/v1/horarios?busca=DP_T182", dpA).expect(200);
      expect(lista.body.itens.map((t: { id: string }) => t.id)).toEqual([id]);
      await get(`/v1/horarios/${id}`, dpA).expect(200);
      await patch(`/v1/horarios/${id}`, dpA)
        .send({ nome: "Nao pode" })
        .expect(403);
      await post(`/v1/horarios/${id}/desativar`, dpA).expect(403);
      await post(`/v1/horarios/${id}/reativar`, dpA).expect(403);
      // T183 — o DP passou a CONSULTAR os vínculos de horário da própria
      // empresa (escrita segue negada; ver o bloco da T183).
      await get("/v1/horarios/vinculos", dpA).expect(200);
      const atual = await get(`/v1/horarios/${id}`, rhA).expect(200);
      expect(atual.body).toMatchObject({
        nome: "Consulta do DP T182",
        ativo: true,
      });
    });

    it("jornada de outra empresa: 404 para o RH e para o DP, com a negação na trilha e nada mudado", async () => {
      const { id } = await criarTabela(rhB, "So da B T182", [], "SOB_T182");
      await get(`/v1/horarios/${id}`, dpA).expect(404);
      const r = await patch(`/v1/horarios/${id}`, rhA)
        .send({ nome: "Invasao T182" })
        .expect(404);
      expect(JSON.stringify(r.body)).not.toContain("So da B");
      const negacoes = await comPrisma((p) =>
        p.auditEvent.findMany({
          where: {
            action: "authorization_denied",
            resource: "tabela_horario",
            resourceId: id,
          },
        }),
      );
      expect(negacoes.length).toBeGreaterThanOrEqual(2);
      expect(JSON.stringify(negacoes)).not.toContain("Invasao T182");
      const atual = await get(`/v1/horarios/${id}`, rhB).expect(200);
      expect(atual.body.nome).toBe("So da B T182");
    });

    it.each([
      ["gestor", () => gestorA],
      ["financeiro", () => financeiroA],
      ["colaborador", () => colaboradorA],
      ["master_tecnico", () => master],
    ])("%s não edita jornada (403), e nada muda", async (_papel, cred) => {
      const { id } = await criarTabela(rhA, `Alvo ${_papel} T182`);
      await patch(`/v1/horarios/${id}`, cred())
        .send({ nome: "Nao pode" })
        .expect(403);
      const atual = await get(`/v1/horarios/${id}`, rhA).expect(200);
      expect(atual.body.nome).toBe(`Alvo ${_papel} T182`);
    });

    it("inativar é lógico: a jornada continua listada como inativa, com os mesmos períodos", async () => {
      const { id, body } = await criarTabela(
        rhA,
        "Para inativar T182",
        GRADE_44H,
        "INA_T182",
      );
      await post(`/v1/horarios/${id}/desativar`, rhA).expect(201);
      const inativas = await get(
        "/v1/horarios?ativo=false&busca=INA_T182",
        rhA,
      ).expect(200);
      expect(inativas.body.itens[0]).toMatchObject({
        id,
        ativo: false,
        periodos: body.periodos,
      });
      expect(
        await comPrisma((p) => p.tabelaHorario.count({ where: { id } })),
      ).toBe(1);
    });
  });

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
  // T183 — jornada de trabalho do colaborador, com vigência (decisão de
  // 2026-10-26): o RH atribui, troca e encerra; o DP consulta; a admissão
  // aceita uma jornada opcional; erros por campo sem valor.
  describe("T183 — jornada do colaborador: atribuir, trocar, encerrar e consultar", () => {
    let sequencia = 0;
    const matricula = () => `MAT-T183-${++sequencia}`;

    async function comPrisma<T>(f: (p: PrismaClient) => Promise<T>) {
      const prisma = new PrismaClient({ datasources: { db: { url: appUrl } } });
      try {
        return await f(prisma);
      } finally {
        await prisma.$disconnect();
      }
    }

    async function colaboradorDaA(nome: string): Promise<string> {
      return admitir(rhA, {
        nome,
        empresaId: empresaA,
        matricula: matricula(),
        departamentoId: departamentoA,
      });
    }

    function atribuir(cred: Credencial, corpo: Record<string, unknown>) {
      return post("/v1/horarios/vinculos/atribuicoes", cred).send(corpo);
    }

    async function historico(colaboradorId: string, cred: Credencial = rhA) {
      const r = await get(
        `/v1/horarios/vinculos?colaboradorId=${colaboradorId}`,
        cred,
      ).expect(200);
      return r.body.itens as {
        id: string;
        tabelaHorarioId: string;
        tabela: {
          id: string;
          codigo: string | null;
          nome: string;
          ativo: boolean;
        };
        vigenciaInicio: string;
        vigenciaFim: string | null;
      }[];
    }

    async function trilha(resourceId: string) {
      return comPrisma((p) =>
        p.auditEvent.findMany({
          where: { resourceId },
          orderBy: { occurredAt: "asc" },
        }),
      );
    }

    it("atribui sem jornada vigente: cria a vigência aberta, com a jornada na projeção e só o id na trilha", async () => {
      const { id: jornada } = await criarTabela(
        rhA,
        "Jornada Atribuir T183",
        GRADE_44H,
        "ATR_T183",
      );
      const colab = await colaboradorDaA("Pessoa Sintetica Atribuir");
      const r = await atribuir(rhA, {
        colaboradorId: colab,
        tabelaHorarioId: jornada,
        vigenciaInicio: "2026-02-02",
      }).expect(201);
      expect(r.body).toMatchObject({
        colaboradorId: colab,
        tabelaHorarioId: jornada,
        tabela: {
          id: jornada,
          codigo: "ATR_T183",
          nome: "Jornada Atribuir T183",
          ativo: true,
        },
        vigenciaInicio: "2026-02-02",
        vigenciaFim: null,
      });
      const eventos = await trilha(r.body.id);
      expect(eventos.map((e) => e.action)).toContain("horarios_vinculo_criado");
      const texto = JSON.stringify(eventos);
      expect(texto).not.toContain("ATR_T183");
      expect(texto).not.toContain("Jornada Atribuir");
      expect(texto).not.toContain("Pessoa Sintetica");
    });

    it("troca: encerra a vigente no novo início e cria a nova, adjacentes, numa operação só", async () => {
      const { id: j1 } = await criarTabela(rhA, "Troca A T183");
      const { id: j2 } = await criarTabela(rhA, "Troca B T183");
      const colab = await colaboradorDaA("Pessoa Sintetica Troca");
      const primeira = await atribuir(rhA, {
        colaboradorId: colab,
        tabelaHorarioId: j1,
        vigenciaInicio: "2026-02-01",
      }).expect(201);
      const segunda = await atribuir(rhA, {
        colaboradorId: colab,
        tabelaHorarioId: j2,
        vigenciaInicio: "2026-04-01",
      }).expect(201);
      expect(segunda.body).toMatchObject({
        tabelaHorarioId: j2,
        vigenciaFim: null,
      });

      const itens = await historico(colab);
      expect(itens).toHaveLength(2);
      expect(itens[0]).toMatchObject({
        tabelaHorarioId: j2,
        vigenciaInicio: "2026-04-01",
        vigenciaFim: null,
      });
      expect(itens[1]).toMatchObject({
        id: primeira.body.id,
        tabelaHorarioId: j1,
        vigenciaInicio: "2026-02-01",
        vigenciaFim: "2026-04-01",
      });
      const acoes = (await trilha(primeira.body.id)).map((e) => e.action);
      expect(acoes).toEqual([
        "horarios_vinculo_criado",
        "horarios_vinculo_encerrado",
      ]);
    });

    it("trocar para a mesma jornada vigente: 422 no campo, sem eco, e nada muda", async () => {
      const { id: jornada } = await criarTabela(
        rhA,
        "Mesma T183",
        GRADE_44H,
        "MESMA_T183",
      );
      const colab = await colaboradorDaA("Pessoa Sintetica Mesma");
      await atribuir(rhA, {
        colaboradorId: colab,
        tabelaHorarioId: jornada,
        vigenciaInicio: "2026-02-01",
      }).expect(201);
      const r = await atribuir(rhA, {
        colaboradorId: colab,
        tabelaHorarioId: jornada,
        vigenciaInicio: "2026-05-01",
      }).expect(422);
      expect(r.body.erros).toEqual([
        { campo: "tabelaHorarioId", motivo: "igual_a_vigente" },
      ]);
      expect(JSON.stringify(r.body)).not.toContain("MESMA_T183");
      const itens = await historico(colab);
      expect(itens).toHaveLength(1);
      expect(itens[0]!.vigenciaFim).toBeNull();
    });

    it("novo início que não vem depois do início da vigente: 422 em vigenciaInicio, e nada muda", async () => {
      const { id: j1 } = await criarTabela(rhA, "Ordem A T183");
      const { id: j2 } = await criarTabela(rhA, "Ordem B T183");
      const colab = await colaboradorDaA("Pessoa Sintetica Ordem");
      await atribuir(rhA, {
        colaboradorId: colab,
        tabelaHorarioId: j1,
        vigenciaInicio: "2026-03-01",
      }).expect(201);
      for (const inicio of ["2026-03-01", "2026-02-15"]) {
        const r = await atribuir(rhA, {
          colaboradorId: colab,
          tabelaHorarioId: j2,
          vigenciaInicio: inicio,
        }).expect(422);
        expect(r.body.erros).toEqual([
          { campo: "vigenciaInicio", motivo: "fora_de_ordem" },
        ]);
      }
      const itens = await historico(colab);
      expect(itens).toHaveLength(1);
      expect(itens[0]).toMatchObject({
        tabelaHorarioId: j1,
        vigenciaFim: null,
      });
    });

    it("jornada inativa ou de outra empresa: o mesmo 422 'indisponivel', sem eco, e nada criado", async () => {
      const { id: inativa } = await criarTabela(
        rhA,
        "Inativa T183",
        GRADE_44H,
        "INAT_T183",
      );
      await post(`/v1/horarios/${inativa}/desativar`, rhA).expect(201);
      const { id: daB } = await criarTabela(
        rhB,
        "Da B T183",
        GRADE_44H,
        "DAB_T183",
      );
      const colab = await colaboradorDaA("Pessoa Sintetica Indisponivel");
      for (const tabelaHorarioId of [inativa, daB]) {
        const r = await atribuir(rhA, {
          colaboradorId: colab,
          tabelaHorarioId,
          vigenciaInicio: "2026-02-01",
        }).expect(422);
        expect(r.body.erros).toEqual([
          { campo: "tabelaHorarioId", motivo: "indisponivel" },
        ]);
        const corpo = JSON.stringify(r.body);
        expect(corpo).not.toContain("INAT_T183");
        expect(corpo).not.toContain("DAB_T183");
      }
      expect(await historico(colab)).toEqual([]);
    });

    it("vigência que cruza outra do mesmo colaborador: 409 em vigenciaInicio, e nada criado", async () => {
      const { id: j1 } = await criarTabela(rhA, "Cruza A T183");
      const { id: j2 } = await criarTabela(rhA, "Cruza B T183");
      const colab = await colaboradorDaA("Pessoa Sintetica Cruza");
      await post("/v1/horarios/vinculos", rhA)
        .send({
          colaboradorId: colab,
          tabelaHorarioId: j1,
          vigenciaInicio: "2026-01-10",
          vigenciaFim: "2026-06-01",
        })
        .expect(201);
      const r = await atribuir(rhA, {
        colaboradorId: colab,
        tabelaHorarioId: j2,
        vigenciaInicio: "2026-03-01",
      }).expect(409);
      expect(r.body.erros).toEqual([
        { campo: "vigenciaInicio", motivo: "sobreposta" },
      ]);
      expect(await historico(colab)).toHaveLength(1);
      // Depois do fim da encerrada, a nova cabe.
      await atribuir(rhA, {
        colaboradorId: colab,
        tabelaHorarioId: j2,
        vigenciaInicio: "2026-06-01",
      }).expect(201);
    });

    it("encerrar: o primeiro dia sem a jornada; já encerrada e fim fora de ordem dão 422 no campo", async () => {
      const { id: jornada } = await criarTabela(rhA, "Encerrar T183");
      const colab = await colaboradorDaA("Pessoa Sintetica Encerrar");
      const v = await atribuir(rhA, {
        colaboradorId: colab,
        tabelaHorarioId: jornada,
        vigenciaInicio: "2026-02-01",
      }).expect(201);
      const fora = await post(
        `/v1/horarios/vinculos/${v.body.id}/encerrar`,
        rhA,
      )
        .send({ vigenciaFim: "2026-02-01" })
        .expect(422);
      expect(fora.body.erros).toEqual([
        { campo: "vigenciaFim", motivo: "fora_de_ordem" },
      ]);
      const ok = await post(`/v1/horarios/vinculos/${v.body.id}/encerrar`, rhA)
        .send({ vigenciaFim: "2026-07-01" })
        .expect(201);
      expect(ok.body).toMatchObject({
        vigenciaFim: "2026-07-01",
        tabela: { id: jornada },
      });
      const deNovo = await post(
        `/v1/horarios/vinculos/${v.body.id}/encerrar`,
        rhA,
      )
        .send({ vigenciaFim: "2026-08-01" })
        .expect(422);
      expect(deNovo.body.erros).toEqual([
        { campo: "vigenciaFim", motivo: "ja_encerrada" },
      ]);
    });

    it("o histórico mostra a jornada inativada depois, com a indicação", async () => {
      const { id: jornada } = await criarTabela(rhA, "Inativada Depois T183");
      const colab = await colaboradorDaA("Pessoa Sintetica Historico");
      await atribuir(rhA, {
        colaboradorId: colab,
        tabelaHorarioId: jornada,
        vigenciaInicio: "2026-02-01",
      }).expect(201);
      await post(`/v1/horarios/${jornada}/desativar`, rhA).expect(201);
      const itens = await historico(colab);
      expect(itens[0]!.tabela).toMatchObject({ id: jornada, ativo: false });
    });

    it("DP consulta jornada e histórico da própria empresa, e não atribui, troca nem encerra", async () => {
      const { id: j1 } = await criarTabela(rhA, "DP A T183");
      const { id: j2 } = await criarTabela(rhA, "DP B T183");
      const colab = await colaboradorDaA("Pessoa Sintetica DP");
      const v = await atribuir(rhA, {
        colaboradorId: colab,
        tabelaHorarioId: j1,
        vigenciaInicio: "2026-02-01",
      }).expect(201);
      const itens = await historico(colab, dpA);
      expect(itens.map((i) => i.id)).toEqual([v.body.id]);
      await get(`/v1/horarios/vinculos/${v.body.id}`, dpA).expect(200);
      await atribuir(dpA, {
        colaboradorId: colab,
        tabelaHorarioId: j2,
        vigenciaInicio: "2026-05-01",
      }).expect(403);
      await post(`/v1/horarios/vinculos/${v.body.id}/encerrar`, dpA)
        .send({ vigenciaFim: "2026-05-01" })
        .expect(403);
      await post("/v1/horarios/vinculos", dpA)
        .send({
          colaboradorId: colab,
          tabelaHorarioId: j2,
          vigenciaInicio: "2026-05-01",
        })
        .expect(403);
      const depois = await historico(colab);
      expect(depois).toHaveLength(1);
      expect(depois[0]!.vigenciaFim).toBeNull();
    });

    it("outra empresa: RH da B recebe 404 ao atribuir para colaborador da A, não vê o histórico, e a negação não traz valores", async () => {
      const { id: daB } = await criarTabela(rhB, "Invasao B T183");
      const { id: daA } = await criarTabela(rhA, "Alvo A T183");
      const colab = await colaboradorDaA("Pessoa Sintetica Alvo");
      const v = await atribuir(rhA, {
        colaboradorId: colab,
        tabelaHorarioId: daA,
        vigenciaInicio: "2026-02-01",
      }).expect(201);
      const r = await atribuir(rhB, {
        colaboradorId: colab,
        tabelaHorarioId: daB,
        vigenciaInicio: "2026-05-01",
      }).expect(404);
      expect(JSON.stringify(r.body)).not.toContain("Pessoa Sintetica");
      expect(await historico(colab, rhB)).toEqual([]);
      await get(`/v1/horarios/vinculos/${v.body.id}`, rhB).expect(404);
      await get(`/v1/horarios/vinculos/${v.body.id}`, dpA).expect(200);
      const negacoes = await comPrisma((p) =>
        p.auditEvent.findMany({
          where: { action: "authorization_denied", resourceId: colab },
        }),
      );
      expect(negacoes.length).toBeGreaterThanOrEqual(1);
      expect(JSON.stringify(negacoes)).not.toContain("Pessoa Sintetica");
      expect(await historico(colab)).toHaveLength(1);
    });

    it.each([
      ["gestor", () => gestorA],
      ["financeiro", () => financeiroA],
      ["colaborador", () => colaboradorA],
      ["master_tecnico", () => master],
    ])("%s não atribui jornada (403)", async (_papel, cred) => {
      const { id: jornada } = await criarTabela(rhA, `Papel ${_papel} T183`);
      const colab = await colaboradorDaA(`Pessoa Sintetica Papel ${_papel}`);
      await atribuir(cred(), {
        colaboradorId: colab,
        tabelaHorarioId: jornada,
        vigenciaInicio: "2026-02-01",
      }).expect(403);
      expect(await historico(colab)).toEqual([]);
    });

    it("sem CSRF 403; empresa no corpo, data inválida ou campo nulo 400; nada criado", async () => {
      const { id: jornada } = await criarTabela(rhA, "Contrato T183");
      const colab = await colaboradorDaA("Pessoa Sintetica Contrato");
      await agent()
        .post("/v1/horarios/vinculos/atribuicoes")
        .set("Cookie", rhA.cookie)
        .send({
          colaboradorId: colab,
          tabelaHorarioId: jornada,
          vigenciaInicio: "2026-02-01",
        })
        .expect(403);
      for (const corpo of [
        {
          colaboradorId: colab,
          tabelaHorarioId: jornada,
          vigenciaInicio: "2026-02-01",
          empresaId: empresaB,
        },
        {
          colaboradorId: colab,
          tabelaHorarioId: jornada,
          vigenciaInicio: "2026-02-30",
        },
        {
          colaboradorId: colab,
          tabelaHorarioId: null,
          vigenciaInicio: "2026-02-01",
        },
        { colaboradorId: colab, tabelaHorarioId: jornada },
      ]) {
        await atribuir(rhA, corpo).expect(400);
      }
      expect(await historico(colab)).toEqual([]);
    });

    describe("Nova admissão com jornada opcional", () => {
      function corpoDaAdmissao(
        extra: Record<string, unknown>,
        lotacao: object,
      ) {
        return {
          ...camposObrigatoriosAdmissao(),
          ...lotacao,
          empresaId: empresaA,
          matricula: matricula(),
          tipo: "clt",
          dataAdmissao: ADMISSAO,
          motivoCodigo: "admissao_inicial",
          departamentoId: departamentoA,
          ...extra,
        };
      }

      it("RH admite com jornada: a vigência começa na data de admissão, na mesma transação", async () => {
        const { id: jornada } = await criarTabela(rhA, "Admissao T183");
        const lotacao = await lotacaoMinima(appUrl, empresaA);
        const r = await post("/v1/colaboradores", rhA)
          .send(
            corpoDaAdmissao(
              {
                nome: "Pessoa Sintetica Admitida Jornada",
                tabelaHorarioId: jornada,
              },
              lotacao,
            ),
          )
          .expect(201);
        expect(r.body.jornada).toMatchObject({ tabelaHorarioId: jornada });
        const itens = await historico(r.body.id);
        expect(itens).toHaveLength(1);
        expect(itens[0]).toMatchObject({
          tabelaHorarioId: jornada,
          vigenciaInicio: ADMISSAO,
          vigenciaFim: null,
        });
        const acoes = (await trilha(itens[0]!.id)).map((e) => e.action);
        expect(acoes).toEqual(["horarios_vinculo_criado"]);
      });

      it("sem jornada, a admissão segue igual: jornada nula e nenhuma vigência", async () => {
        const lotacao = await lotacaoMinima(appUrl, empresaA);
        const r = await post("/v1/colaboradores", rhA)
          .send(
            corpoDaAdmissao({ nome: "Pessoa Sintetica Sem Jornada" }, lotacao),
          )
          .expect(201);
        expect(r.body.jornada).toBeNull();
        expect(await historico(r.body.id)).toEqual([]);
      });

      it("jornada inativa ou de outra empresa: 422 no campo, e nada da admissão é gravado", async () => {
        const { id: inativa } = await criarTabela(rhA, "Admissao Inativa T183");
        await post(`/v1/horarios/${inativa}/desativar`, rhA).expect(201);
        const { id: daB } = await criarTabela(rhB, "Admissao Da B T183");
        const lotacao = await lotacaoMinima(appUrl, empresaA);
        for (const [i, tabelaHorarioId] of [inativa, daB].entries()) {
          const nome = `Pessoa Sintetica Recusada ${i}`;
          const r = await post("/v1/colaboradores", rhA)
            .send(corpoDaAdmissao({ nome, tabelaHorarioId }, lotacao))
            .expect(422);
          expect(r.body.erros).toEqual([
            { campo: "tabelaHorarioId", motivo: "indisponivel" },
          ]);
          expect(
            await comPrisma((p) => p.colaborador.count({ where: { nome } })),
          ).toBe(0);
        }
      });

      it("DP admite, mas não envia jornada: com ela, a admissão inteira é negada e nada é gravado", async () => {
        const { id: jornada } = await criarTabela(rhA, "Admissao DP T183");
        const lotacao = await lotacaoMinima(appUrl, empresaA);
        const nome = "Pessoa Sintetica Admissao DP";
        await post("/v1/colaboradores", dpA)
          .send(corpoDaAdmissao({ nome, tabelaHorarioId: jornada }, lotacao))
          .expect(404);
        expect(
          await comPrisma((p) => p.colaborador.count({ where: { nome } })),
        ).toBe(0);
        // Sem jornada, o DP admite normalmente.
        await post("/v1/colaboradores", dpA)
          .send(
            corpoDaAdmissao(
              { nome: "Pessoa Sintetica Admissao DP Sem" },
              lotacao,
            ),
          )
          .expect(201);
      });

      it("idempotência confere também a jornada: mesmo envio é reenvio; outra jornada com a mesma chave é recusada", async () => {
        const { id: j1 } = await criarTabela(rhA, "Idem A T183");
        const { id: j2 } = await criarTabela(rhA, "Idem B T183");
        const lotacao = await lotacaoMinima(appUrl, empresaA);
        const corpo = corpoDaAdmissao(
          { nome: "Pessoa Sintetica Idempotente", tabelaHorarioId: j1 },
          lotacao,
        );
        const chave = "6f3c2a1e-8b7d-4c5e-9f0a-1b2c3d4e5f60";
        const primeira = await post("/v1/colaboradores", rhA)
          .set("idempotency-key", chave)
          .send(corpo)
          .expect(201);
        const reenvio = await post("/v1/colaboradores", rhA)
          .set("idempotency-key", chave)
          .send(corpo);
        expect([200, 201]).toContain(reenvio.status);
        expect(reenvio.body.id).toBe(primeira.body.id);
        expect(reenvio.body.jornada).toMatchObject({ tabelaHorarioId: j1 });
        const outra = await post("/v1/colaboradores", rhA)
          .set("idempotency-key", chave)
          .send({ ...corpo, tabelaHorarioId: j2 })
          .expect(422);
        expect(outra.body.codigo).toBe("idempotencia_conteudo_divergente");
        expect(await historico(primeira.body.id)).toHaveLength(1);
      });
    });
  });

  // T191 — a tabela de vínculos do Horário de trabalho deixa a página única
  // de 100 e o dicionário de 100 colaboradores: cada vínculo traz o próprio
  // colaborador (`id` e `nome`), e a tela pagina de 20 em 20 com filtros por
  // colaborador e por jornada. Mais de 100 vínculos e nomes depois do
  // centésimo, com PostgreSQL real.
  describe("T191 — vínculos de horário com o nome do colaborador, paginados", () => {
    type Item = {
      id: string;
      colaboradorId: string;
      tabelaHorarioId: string;
      colaborador: { id: string; nome: string };
      [campo: string]: unknown;
    };
    const QUANTOS = 105;
    const PREFIXO = "Zz Sintetico Horario T191";
    const nomeDe = new Map<string, string>();
    const idsA: string[] = [];
    const idsB: string[] = [];
    let jornadaUm: string;
    let jornadaDois: string;
    let jornadaB: string;

    /**
     * Colaboradores admitidos e efetivados (vínculo funcional ativo), cada um
     * com uma jornada — pelo caminho real da API, que respeita as travas do
     * banco (colaborador e vínculo nascem juntos).
     */
    async function semear(
      cred: Credencial,
      empresaId: string,
      departamentoId: string,
      quantos: number,
      jornada: (i: number) => string,
      sufixo: string,
      destino: string[],
    ) {
      for (let i = 1; i <= quantos; i++) {
        const nome = `${PREFIXO} ${sufixo} ${String(i).padStart(3, "0")}`;
        const id = await admitir(cred, {
          nome,
          empresaId,
          matricula: `T191-${sufixo}-${i}`,
          departamentoId,
        });
        await post("/v1/horarios/vinculos", cred)
          .send({
            colaboradorId: id,
            tabelaHorarioId: jornada(i),
            vigenciaInicio: "2026-02-01",
          })
          .expect(201);
        nomeDe.set(id, nome);
        destino.push(id);
      }
    }

    async function todasAsPaginas(rota: string, cred: Credencial) {
      const vistos: Item[] = [];
      let total = 0;
      for (let pagina = 1; pagina <= 50; pagina++) {
        const sep = rota.includes("?") ? "&" : "?";
        const r = await get(
          `${rota}${sep}pagina=${pagina}&tamanhoPagina=20`,
          cred,
        ).expect(200);
        total = r.body.total;
        vistos.push(...(r.body.itens as Item[]));
        if ((r.body.itens as Item[]).length < 20) break;
      }
      return { vistos, total };
    }

    beforeAll(async () => {
      jornadaUm = (await criarTabela(rhA, "Jornada T191 Um")).id;
      jornadaDois = (await criarTabela(rhA, "Jornada T191 Dois")).id;
      jornadaB = (await criarTabela(rhB, "Jornada T191 B")).id;
      await semear(
        rhA,
        empresaA,
        departamentoA,
        QUANTOS,
        (i) => (i % 2 === 1 ? jornadaUm : jornadaDois),
        "A",
        idsA,
      );
      await semear(rhB, empresaB, departamentoB, 3, () => jornadaB, "B", idsB);
    });

    it("a empresa tem mais de 100 colaboradores e mais de 100 vínculos de jornada", async () => {
      const colaboradores = await get(
        "/v1/colaboradores?tamanhoPagina=1",
        rhA,
      ).expect(200);
      expect(colaboradores.body.total).toBeGreaterThan(100);
      const vinculos = await get(
        "/v1/horarios/vinculos?tamanhoPagina=1",
        rhA,
      ).expect(200);
      expect(vinculos.body.total).toBeGreaterThan(100);
    });

    it("cada vínculo traz o colaborador só com id e nome, e os campos atuais seguem iguais", async () => {
      const r = await get("/v1/horarios/vinculos?tamanhoPagina=20", rhA).expect(
        200,
      );
      for (const item of r.body.itens as Item[]) {
        expect(Object.keys(item.colaborador).sort()).toEqual(["id", "nome"]);
        expect(item.colaborador.id).toBe(item.colaboradorId);
        expect(Object.keys(item).sort()).toEqual(
          [
            "id",
            "colaboradorId",
            "empresaId",
            "tabelaHorarioId",
            "tabela",
            "colaborador",
            "vigenciaInicio",
            "vigenciaFim",
            "criadoPorUserId",
            "criadoEm",
            "atualizadoEm",
          ].sort(),
        );
      }
    });

    it("de 20 em 20, sem repetir nem pular — e com o nome de todos, inclusive depois do centésimo", async () => {
      const inteira = await get(
        "/v1/horarios/vinculos?tamanhoPagina=100",
        rhA,
      ).expect(200);
      const { vistos, total } = await todasAsPaginas(
        "/v1/horarios/vinculos",
        rhA,
      );
      expect(total).toBe(inteira.body.total);
      expect(vistos).toHaveLength(total);
      expect(new Set(vistos.map((v) => v.id)).size).toBe(total);
      // Os 105 semeados — cujos nomes ficam depois do centésimo em ordem
      // alfabética ("Zz…") — aparecem todos, cada um com o seu nome.
      const porColaborador = new Map(vistos.map((v) => [v.colaboradorId, v]));
      for (const id of idsA) {
        expect(porColaborador.get(id)?.colaborador.nome).toBe(nomeDe.get(id));
      }
      // Nada da outra empresa.
      for (const id of idsB) expect(porColaborador.has(id)).toBe(false);
    });

    it("filtro por jornada, isolado e paginado", async () => {
      const { vistos, total } = await todasAsPaginas(
        `/v1/horarios/vinculos?tabelaHorarioId=${jornadaUm}`,
        rhA,
      );
      const esperados = idsA.filter((_, i) => (i + 1) % 2 === 1);
      expect(total).toBe(esperados.length);
      expect(vistos.map((v) => v.colaboradorId).sort()).toEqual(
        [...esperados].sort(),
      );
      expect(vistos.every((v) => v.tabelaHorarioId === jornadaUm)).toBe(true);
    });

    it("filtros por colaborador e por jornada, combinados", async () => {
      const umDaJornadaUm = idsA[0]!;
      const umDaJornadaDois = idsA[1]!;
      const so = await get(
        `/v1/horarios/vinculos?colaboradorId=${umDaJornadaUm}`,
        rhA,
      ).expect(200);
      expect(so.body.total).toBe(1);
      expect(so.body.itens[0].colaborador.nome).toBe(nomeDe.get(umDaJornadaUm));
      const casa = await get(
        `/v1/horarios/vinculos?colaboradorId=${umDaJornadaUm}&tabelaHorarioId=${jornadaUm}`,
        rhA,
      ).expect(200);
      expect(casa.body.total).toBe(1);
      const naoCasa = await get(
        `/v1/horarios/vinculos?colaboradorId=${umDaJornadaDois}&tabelaHorarioId=${jornadaUm}`,
        rhA,
      ).expect(200);
      expect(naoCasa.body.total).toBe(0);
    });

    it("o detalhe do vínculo também traz o colaborador (id e nome)", async () => {
      const lista = await get(
        `/v1/horarios/vinculos?colaboradorId=${idsA[104]!}`,
        rhA,
      ).expect(200);
      const vinculoId = lista.body.itens[0].id as string;
      const detalhe = await get(
        `/v1/horarios/vinculos/${vinculoId}`,
        rhA,
      ).expect(200);
      expect(detalhe.body.colaborador).toEqual({
        id: idsA[104],
        nome: nomeDe.get(idsA[104]!),
      });
    });

    it("isolamento: B não vê nomes de A; jornada ou vínculo de A não respondem para B", async () => {
      const deB = await todasAsPaginas("/v1/horarios/vinculos", rhB);
      const texto = JSON.stringify(deB.vistos);
      expect(texto).not.toContain(`${PREFIXO} A`);
      for (const id of idsB) {
        expect(deB.vistos.some((v) => v.colaboradorId === id)).toBe(true);
      }
      const jornadaDeA = await get(
        `/v1/horarios/vinculos?tabelaHorarioId=${jornadaUm}`,
        rhB,
      ).expect(200);
      expect(jornadaDeA.body.total).toBe(0);
      const colaboradorDeA = await get(
        `/v1/horarios/vinculos?colaboradorId=${idsA[0]!}`,
        rhB,
      ).expect(200);
      expect(colaboradorDeA.body.total).toBe(0);
      const vinculoDeA = (
        await get(
          `/v1/horarios/vinculos?colaboradorId=${idsA[0]!}`,
          rhA,
        ).expect(200)
      ).body.itens[0].id as string;
      const r = await get(`/v1/horarios/vinculos/${vinculoDeA}`, rhB);
      expect([403, 404]).toContain(r.status);
      expect(JSON.stringify(r.body)).not.toContain(PREFIXO);
    });

    it("master global lê as duas empresas, cada vínculo com o nome certo", async () => {
      const { vistos } = await todasAsPaginas("/v1/horarios/vinculos", master);
      const porColaborador = new Map(vistos.map((v) => [v.colaboradorId, v]));
      for (const id of [...idsA, ...idsB]) {
        expect(porColaborador.get(id)?.colaborador.nome).toBe(nomeDe.get(id));
      }
    });

    it("DP lê o mesmo que o RH", async () => {
      const doRh = await get(
        `/v1/horarios/vinculos?tabelaHorarioId=${jornadaDois}&tamanhoPagina=20`,
        rhA,
      ).expect(200);
      const doDp = await get(
        `/v1/horarios/vinculos?tabelaHorarioId=${jornadaDois}&tamanhoPagina=20`,
        dpA,
      ).expect(200);
      expect(doDp.body).toEqual(doRh.body);
    });

    it("gestor, colaborador, financeiro, auditor e dpo seguem negados, sem nome", async () => {
      for (const cred of [gestorA, colaboradorA, financeiroA, auditorA, dpoA]) {
        const lista = await get(
          `/v1/horarios/vinculos?tabelaHorarioId=${jornadaUm}`,
          cred,
        );
        expect([403, 404]).toContain(lista.status);
        expect(JSON.stringify(lista.body)).not.toContain(PREFIXO);
      }
    });

    // T192 — as duas lacunas de E2E apontadas na revisão final da T191:
    // perfis negados também no DETALHE, e o `master_tecnico` com empresa
    // ativa (não só o global). Mesmos dados semeados acima.
    describe("T192 — detalhe negado e master com empresa ativa", () => {
      let masterEmA: Credencial;

      async function vinculoDe(colaboradorId: string, cred: Credencial) {
        const r = await get(
          `/v1/horarios/vinculos?colaboradorId=${colaboradorId}`,
          cred,
        ).expect(200);
        expect(r.body.total).toBe(1);
        return r.body.itens[0].id as string;
      }

      beforeAll(async () => {
        masterEmA = await seedMaster("master.t192.a@example.test");
        await post("/v1/auth/contexto/empresa", masterEmA)
          .send({ empresaId: empresaA })
          .expect(200);
      });

      it("gestor, colaborador, financeiro, auditor e dpo não leem o detalhe, nem o nome", async () => {
        const vinculoId = await vinculoDe(idsA[0]!, rhA);
        // O detalhe existe e traz o nome para quem pode ler.
        const doRh = await get(
          `/v1/horarios/vinculos/${vinculoId}`,
          rhA,
        ).expect(200);
        expect(doRh.body.colaborador.nome).toBe(nomeDe.get(idsA[0]!));
        for (const cred of [
          gestorA,
          colaboradorA,
          financeiroA,
          auditorA,
          dpoA,
        ]) {
          const r = await get(`/v1/horarios/vinculos/${vinculoId}`, cred);
          expect([403, 404]).toContain(r.status);
          expect(JSON.stringify(r.body)).not.toContain(PREFIXO);
          expect(JSON.stringify(r.body)).not.toContain(idsA[0]!);
        }
      });

      it("master com empresa ativa lista só os vínculos dela, cada um com o nome certo", async () => {
        const { vistos, total } = await todasAsPaginas(
          "/v1/horarios/vinculos",
          masterEmA,
        );
        expect(vistos).toHaveLength(total);
        expect(new Set(vistos.map((v) => v.id)).size).toBe(total);
        expect(vistos.every((v) => v.empresaId === empresaA)).toBe(true);
        const porColaborador = new Map(vistos.map((v) => [v.colaboradorId, v]));
        for (const id of idsA) {
          expect(porColaborador.get(id)?.colaborador.nome).toBe(nomeDe.get(id));
        }
        for (const id of idsB) expect(porColaborador.has(id)).toBe(false);
        expect(JSON.stringify(vistos)).not.toContain(`${PREFIXO} B`);
        // O mesmo que o RH da empresa lê.
        const doRh = await todasAsPaginas("/v1/horarios/vinculos", rhA);
        expect(total).toBe(doRh.total);
      });

      it("master com empresa ativa: filtros e detalhe de outra empresa não respondem", async () => {
        const daJornadaB = await get(
          `/v1/horarios/vinculos?tabelaHorarioId=${jornadaB}`,
          masterEmA,
        ).expect(200);
        expect(daJornadaB.body.total).toBe(0);
        const doColaboradorB = await get(
          `/v1/horarios/vinculos?colaboradorId=${idsB[0]!}`,
          masterEmA,
        ).expect(200);
        expect(doColaboradorB.body.total).toBe(0);

        const vinculoB = await vinculoDe(idsB[0]!, rhB);
        const r = await get(`/v1/horarios/vinculos/${vinculoB}`, masterEmA);
        expect([403, 404]).toContain(r.status);
        expect(JSON.stringify(r.body)).not.toContain(PREFIXO);

        const vinculoA = await vinculoDe(idsA[104]!, rhA);
        const detalhe = await get(
          `/v1/horarios/vinculos/${vinculoA}`,
          masterEmA,
        ).expect(200);
        expect(detalhe.body.colaborador).toEqual({
          id: idsA[104],
          nome: nomeDe.get(idsA[104]!),
        });
      });

      it("master com empresa ativa segue só leitura: não cria vínculo de horário", async () => {
        const r = await post("/v1/horarios/vinculos", masterEmA).send({
          colaboradorId: idsA[0]!,
          tabelaHorarioId: jornadaUm,
          vigenciaInicio: "2027-01-01",
        });
        // Recusa pelo papel (como o master global), não por CSRF.
        expect(r.status).toBe(403);
        expect(JSON.stringify(r.body)).not.toMatch(/csrf/i);
      });
    });
  });
});
