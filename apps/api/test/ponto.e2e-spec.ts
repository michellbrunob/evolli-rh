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
 * Etapa 3 — Jornada e Ponto Rastreável V1 (ADR 0008, Baseline Jornada V1).
 * PostgreSQL real e efêmero (Testcontainers), migration aplicada do zero.
 *
 * **Todos os dados são sintéticos.** Nomes obviamente fictícios, domínio
 * reservado `example.test`, matrículas arbitrárias, horários inventados.
 * Nenhum dado real de pessoa, em nenhuma hipótese.
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

const SENHA_PADRAO = "Ponto!Jornada2026#Teste";

const ADMISSAO = "2026-01-05";

/**
 * Horários sintéticos. Sufixo `-03:00` explícito: o fuso da competência é
 * `America/Sao_Paulo`, e escrever o offset torna o teste independente do fuso
 * da máquina que o executa.
 */
const ENTRADA = "2026-03-10T08:00:00-03:00";
const SAIDA = "2026-03-10T17:00:00-03:00";
const COMPETENCIA = "2026-03";

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

describe("Jornada e Ponto Rastreavel (e2e)", () => {
  let container: StartedTestContainer;
  let appUrl: string;
  let migratorUrl: string;
  let app: INestApplication;

  let admin: Credencial;
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

  /** Vínculo ativo da empresa A — alvo padrão dos testes. */
  let vinculoA: string;
  /** Vínculo ativo da empresa B — alvo dos testes de isolamento. */
  let vinculoB: string;

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

  async function criarUsuario(
    email: string,
    role: string,
    companyId: string | undefined,
  ): Promise<Credencial> {
    await agent()
      .post("/v1/users")
      .set("Cookie", admin.cookie)
      .set("x-csrf-token", admin.csrfToken)
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

  /** Admite, efetiva e devolve o id do vínculo já `ativo`. */
  async function admitirEEfetivar(
    cred: Credencial,
    dados: {
      nome: string;
      empresaId: string;
      matricula: string;
      departamentoId: string;
      dataAdmissao?: string;
    },
  ): Promise<string> {
    const colaborador = await post("/v1/colaboradores", cred)
      .send({
        nome: dados.nome,
        empresaId: dados.empresaId,
        matricula: dados.matricula,
        tipo: "clt",
        dataAdmissao: dados.dataAdmissao ?? ADMISSAO,
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

    return vinculoId;
  }

  /** Registra uma marcação e devolve o corpo criado. */
  async function registrarPonto(
    cred: Credencial,
    vinculoId: string,
    tipo: string,
    momento: string,
  ) {
    const resposta = await post("/v1/pontos", cred)
      .send({ vinculoId, tipo, momento })
      .expect(201);
    return resposta.body;
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
    // Pré-condição de infraestrutura herdada da Fatia 2 (btree_gist),
    // provisionada pelo papel ADMINISTRADOR — nunca por evolli_migrator.
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

    const adminEmail = "admin.ponto@example.test";
    expect(
      runBootstrap({
        DATABASE_URL: appUrl,
        ADMIN_BOOTSTRAP_EMAIL: adminEmail,
        ADMIN_BOOTSTRAP_PASSWORD: SENHA_PADRAO,
      }).status,
    ).toBe(0);
    admin = await login(adminEmail, SENHA_PADRAO);

    const empA = await post("/v1/empresas", admin)
      .send({ codigo: "EMP_PONTO_A", nome: "Empresa Sintetica Ponto A" })
      .expect(201);
    empresaA = empA.body.id;

    const empB = await post("/v1/empresas", admin)
      .send({ codigo: "EMP_PONTO_B", nome: "Empresa Sintetica Ponto B" })
      .expect(201);
    empresaB = empB.body.id;

    const depA = await post("/v1/departamentos", admin)
      .send({
        codigo: "DEP_PONTO_A",
        nome: "Departamento Sintetico A",
        empresaId: empresaA,
      })
      .expect(201);
    departamentoA = depA.body.id;

    const depB = await post("/v1/departamentos", admin)
      .send({
        codigo: "DEP_PONTO_B",
        nome: "Departamento Sintetico B",
        empresaId: empresaB,
      })
      .expect(201);
    departamentoB = depB.body.id;

    rhA = await criarUsuario("rh.a.ponto@example.test", "rh", empresaA);
    dpA = await criarUsuario("dp.a.ponto@example.test", "dp", empresaA);
    rhB = await criarUsuario("rh.b.ponto@example.test", "rh", empresaB);
    gestorA = await criarUsuario(
      "gestor.a.ponto@example.test",
      "gestor",
      empresaA,
    );
    financeiroA = await criarUsuario(
      "financeiro.a.ponto@example.test",
      "financeiro",
      empresaA,
    );
    colaboradorA = await criarUsuario(
      "colaborador.a.ponto@example.test",
      "colaborador",
      empresaA,
    );
    auditorA = await criarUsuario(
      "auditor.a.ponto@example.test",
      "auditor",
      empresaA,
    );
    dpoA = await criarUsuario("dpo.a.ponto@example.test", "dpo", empresaA);

    vinculoA = await admitirEEfetivar(rhA, {
      nome: "Pessoa Sintetica Ponto A",
      empresaId: empresaA,
      matricula: "MAT-PONTO-A",
      departamentoId: departamentoA,
    });

    vinculoB = await admitirEEfetivar(rhB, {
      nome: "Pessoa Sintetica Ponto B",
      empresaId: empresaB,
      matricula: "MAT-PONTO-B",
      departamentoId: departamentoB,
    });
  });

  afterAll(async () => {
    await app?.close();
    await container?.stop();
  });

  // -------------------------------------------------------------------------
  // Registro manual — a unica origem permitida (Baseline, decisao 3)
  // -------------------------------------------------------------------------

  describe("registro manual de marcacao", () => {
    it("RH registra entrada e a competencia e gravada a partir do momento", async () => {
      const evento = await registrarPonto(rhA, vinculoA, "entrada", ENTRADA);

      expect(evento.tipo).toBe("entrada");
      expect(evento.competencia).toBe(COMPETENCIA);
      expect(evento.vinculoId).toBe(vinculoA);
      expect(evento.efetivo).toEqual({
        tipo: "entrada",
        momento: new Date(ENTRADA).toISOString(),
        anulado: false,
        totalAjustes: 0,
      });
    });

    it("DP tambem registra — a Baseline concede aos dois papeis", async () => {
      const evento = await registrarPonto(dpA, vinculoA, "saida", SAIDA);
      expect(evento.tipo).toBe("saida");
      expect(evento.competencia).toBe(COMPETENCIA);
    });

    it("aceita os quatro tipos do catalogo fechado", async () => {
      for (const [indice, tipo] of [
        "entrada",
        "inicio_pausa",
        "fim_pausa",
        "saida",
      ].entries()) {
        const evento = await registrarPonto(
          rhA,
          vinculoA,
          tipo,
          `2026-03-1${indice + 1}T09:00:00-03:00`,
        );
        expect(evento.tipo).toBe(tipo);
      }
    });

    it("recusa tipo fora do catalogo — o enum e fechado", async () => {
      await post("/v1/pontos", rhA)
        .send({
          vinculoId: vinculoA,
          tipo: "inicio_teletrabalho",
          momento: ENTRADA,
        })
        .expect(400);
    });

    it("recusa campo nao declarado — nenhuma evidencia de origem entra por aqui", async () => {
      // Decisao 3: sem dispositivo, IP, foto, geolocalizacao. `whitelist` +
      // `forbidNonWhitelisted` fazem o DTO recusar, em vez de ignorar em
      // silencio — o que impediria o campo de "entrar por acidente" um dia.
      await post("/v1/pontos", rhA)
        .send({
          vinculoId: vinculoA,
          tipo: "entrada",
          momento: ENTRADA,
          latitude: -23.55,
          longitude: -46.63,
          dispositivo: "catraca-01",
        })
        .expect(400);
    });

    it("a competencia grava o MES LOCAL, nao o UTC", async () => {
      // 2026-04-01T00:30:00-03:00 = 2026-04-01T03:30Z. Local e abril.
      const abril = await registrarPonto(
        rhA,
        vinculoA,
        "entrada",
        "2026-04-01T00:30:00-03:00",
      );
      expect(abril.competencia).toBe("2026-04");

      // 2026-05-01T02:00:00Z = 2026-04-30 23:00 local. Local ainda e ABRIL.
      const viradaUtc = await registrarPonto(
        rhA,
        vinculoA,
        "saida",
        "2026-05-01T02:00:00Z",
      );
      expect(viradaUtc.competencia).toBe("2026-04");
    });
  });

  // -------------------------------------------------------------------------
  // Vigencia do vinculo (decisao aprovada: ativo e encerrado, dentro da janela)
  // -------------------------------------------------------------------------

  describe("vigencia do vinculo", () => {
    it("recusa vinculo PREVISTO — ainda nao admitido", async () => {
      const colaborador = await post("/v1/colaboradores", rhA)
        .send({
          nome: "Pessoa Sintetica Previsto",
          empresaId: empresaA,
          matricula: "MAT-PREV",
          tipo: "clt",
          dataAdmissao: ADMISSAO,
          motivoCodigo: "admissao_inicial",
          departamentoId: departamentoA,
        })
        .expect(201);

      const vinculos = await get(
        `/v1/colaboradores/${colaborador.body.id}/vinculos`,
        rhA,
      ).expect(200);
      expect(vinculos.body[0].situacao).toBe("previsto");

      await post("/v1/pontos", rhA)
        .send({
          vinculoId: vinculos.body[0].id,
          tipo: "entrada",
          momento: ENTRADA,
        })
        .expect(422);
    });

    it("recusa momento anterior a admissao", async () => {
      await post("/v1/pontos", rhA)
        .send({
          vinculoId: vinculoA,
          tipo: "entrada",
          momento: "2026-01-04T08:00:00-03:00",
        })
        .expect(422);
    });

    it("ACEITA vinculo encerrado dentro da vigencia — corrigir o ultimo mes de um desligado", async () => {
      const vinculoEncerrado = await admitirEEfetivar(rhA, {
        nome: "Pessoa Sintetica Desligada",
        empresaId: empresaA,
        matricula: "MAT-DESL",
        departamentoId: departamentoA,
      });

      const desligamento = await post("/v1/movimentacoes", rhA)
        .send({
          vinculoId: vinculoEncerrado,
          tipo: "desligamento",
          motivoCodigo: "encerramento_de_vinculo",
          vigenciaInicio: "2026-03-31",
        })
        .expect(201);
      await post(`/v1/movimentacoes/${desligamento.body.id}/efetivar`, rhA)
        .send()
        .expect(201);

      // Dentro da vigencia: aceito, mesmo com o vinculo ja encerrado.
      const evento = await registrarPonto(
        rhA,
        vinculoEncerrado,
        "entrada",
        "2026-03-30T08:00:00-03:00",
      );
      expect(evento.competencia).toBe("2026-03");

      // Depois do desligamento: recusado.
      await post("/v1/pontos", rhA)
        .send({
          vinculoId: vinculoEncerrado,
          tipo: "entrada",
          momento: "2026-04-02T08:00:00-03:00",
        })
        .expect(422);
    });
  });

  // -------------------------------------------------------------------------
  // Imutabilidade — garantida pelo BANCO, nao pelo service
  // -------------------------------------------------------------------------

  describe("imutabilidade do evento", () => {
    it("evolli_app NAO tem UPDATE nem DELETE em evento_ponto e ajuste_ponto", async () => {
      const prisma = new PrismaClient({ datasources: { db: { url: appUrl } } });
      try {
        const privilegios = await prisma.$queryRawUnsafe<
          { table_name: string; privilege_type: string }[]
        >(
          `SELECT table_name, privilege_type
             FROM information_schema.role_table_grants
            WHERE grantee = 'evolli_app'
              AND table_schema = 'app'
              AND table_name IN ('evento_ponto', 'ajuste_ponto')
            ORDER BY table_name, privilege_type`,
        );

        const porTabela = new Map<string, string[]>();
        for (const linha of privilegios) {
          const atual = porTabela.get(linha.table_name) ?? [];
          atual.push(linha.privilege_type);
          porTabela.set(linha.table_name, atual);
        }

        for (const tabela of ["evento_ponto", "ajuste_ponto"]) {
          const concedidos = (porTabela.get(tabela) ?? []).sort();
          expect(concedidos).toEqual(["INSERT", "SELECT"]);
          expect(concedidos).not.toContain("UPDATE");
          expect(concedidos).not.toContain("DELETE");
        }
      } finally {
        await prisma.$disconnect();
      }
    });

    it("UPDATE direto pelo papel da APLICACAO e recusado pelo banco", async () => {
      const evento = await registrarPonto(
        rhA,
        vinculoA,
        "entrada",
        "2026-03-20T08:00:00-03:00",
      );

      const prisma = new PrismaClient({ datasources: { db: { url: appUrl } } });
      try {
        // Nao e o service que recusa — e o PostgreSQL. Um exploit na API que
        // conseguisse executar SQL arbitrario ainda esbarraria aqui.
        await expect(
          prisma.$executeRawUnsafe(
            `UPDATE app.evento_ponto SET momento = now() WHERE id = $1`,
            evento.id,
          ),
        ).rejects.toThrow(/permission denied/i);
      } finally {
        await prisma.$disconnect();
      }
    });

    it("DELETE direto pelo papel da APLICACAO e recusado pelo banco", async () => {
      const evento = await registrarPonto(
        rhA,
        vinculoA,
        "saida",
        "2026-03-20T17:00:00-03:00",
      );

      const prisma = new PrismaClient({ datasources: { db: { url: appUrl } } });
      try {
        await expect(
          prisma.$executeRawUnsafe(
            `DELETE FROM app.evento_ponto WHERE id = $1`,
            evento.id,
          ),
        ).rejects.toThrow(/permission denied/i);

        // Continua la.
        expect(
          await prisma.eventoPonto.count({ where: { id: evento.id } }),
        ).toBe(1);
      } finally {
        await prisma.$disconnect();
      }
    });

    it("ajuste_ponto tambem e append-only — corrigir um ajuste e registrar outro", async () => {
      const evento = await registrarPonto(
        rhA,
        vinculoA,
        "entrada",
        "2026-03-21T08:00:00-03:00",
      );
      const ajuste = await post(`/v1/pontos/${evento.id}/ajustes`, rhA)
        .send({
          motivoCodigo: "erro_de_digitacao",
          momentoCorrigido: "2026-03-21T08:05:00-03:00",
        })
        .expect(201);

      const prisma = new PrismaClient({ datasources: { db: { url: appUrl } } });
      try {
        await expect(
          prisma.$executeRawUnsafe(
            `UPDATE app.ajuste_ponto SET anula = true WHERE id = $1`,
            ajuste.body.id,
          ),
        ).rejects.toThrow(/permission denied/i);
      } finally {
        await prisma.$disconnect();
      }
    });
  });

  // -------------------------------------------------------------------------
  // Ausencia de DELETE/PATCH na API
  // -------------------------------------------------------------------------

  describe("a API nao expoe alteracao nem exclusao", () => {
    it("nao ha rota DELETE nem PATCH em /v1/pontos", async () => {
      const evento = await registrarPonto(
        rhA,
        vinculoA,
        "entrada",
        "2026-03-22T08:00:00-03:00",
      );

      for (const rota of ["/v1/pontos", `/v1/pontos/${evento.id}`]) {
        await agent()
          .delete(rota)
          .set("Cookie", rhA.cookie)
          .set("x-csrf-token", rhA.csrfToken)
          .expect(404);

        await agent()
          .patch(rota)
          .set("Cookie", rhA.cookie)
          .set("x-csrf-token", rhA.csrfToken)
          .send({ tipo: "saida" })
          .expect(404);

        await agent()
          .put(rota)
          .set("Cookie", rhA.cookie)
          .set("x-csrf-token", rhA.csrfToken)
          .send({ tipo: "saida" })
          .expect(404);
      }
    });

    it("nao ha rota DELETE em ajustes", async () => {
      const evento = await registrarPonto(
        rhA,
        vinculoA,
        "entrada",
        "2026-03-23T08:00:00-03:00",
      );
      await agent()
        .delete(`/v1/pontos/${evento.id}/ajustes`)
        .set("Cookie", rhA.cookie)
        .set("x-csrf-token", rhA.csrfToken)
        .expect(404);
    });
  });

  // -------------------------------------------------------------------------
  // Ajuste rastreavel (decisao 4)
  // -------------------------------------------------------------------------

  describe("correcao por ajuste rastreavel", () => {
    it("corrige o horario sem tocar o registro original", async () => {
      const evento = await registrarPonto(
        rhA,
        vinculoA,
        "entrada",
        "2026-06-01T08:00:00-03:00",
      );
      const corrigido = "2026-06-01T08:07:00-03:00";

      await post(`/v1/pontos/${evento.id}/ajustes`, rhA)
        .send({
          motivoCodigo: "erro_de_digitacao",
          momentoCorrigido: corrigido,
        })
        .expect(201);

      const detalhe = await get(`/v1/pontos/${evento.id}`, rhA).expect(200);

      // O ORIGINAL permanece exatamente como foi gravado...
      expect(detalhe.body.momento).toBe(new Date(evento.momento).toISOString());
      // ...e o efetivo reflete a correcao.
      expect(detalhe.body.efetivo.momento).toBe(
        new Date(corrigido).toISOString(),
      );
      expect(detalhe.body.efetivo.totalAjustes).toBe(1);
      expect(detalhe.body.ajustes).toHaveLength(1);
    });

    it("na cadeia de ajustes, o mais recente vence e todos permanecem visiveis", async () => {
      const evento = await registrarPonto(
        rhA,
        vinculoA,
        "entrada",
        "2026-06-02T08:00:00-03:00",
      );

      await post(`/v1/pontos/${evento.id}/ajustes`, rhA)
        .send({
          motivoCodigo: "erro_de_digitacao",
          momentoCorrigido: "2026-06-02T08:05:00-03:00",
        })
        .expect(201);
      await post(`/v1/pontos/${evento.id}/ajustes`, dpA)
        .send({
          motivoCodigo: "erro_de_digitacao",
          momentoCorrigido: "2026-06-02T08:09:00-03:00",
        })
        .expect(201);

      const detalhe = await get(`/v1/pontos/${evento.id}`, rhA).expect(200);
      expect(detalhe.body.efetivo.momento).toBe(
        new Date("2026-06-02T08:09:00-03:00").toISOString(),
      );
      // Nenhuma linha e omitida: os dois ajustes continuam na trilha.
      expect(detalhe.body.ajustes).toHaveLength(2);
      expect(detalhe.body.efetivo.totalAjustes).toBe(2);
    });

    it("corrige o TIPO da marcacao", async () => {
      const evento = await registrarPonto(
        rhA,
        vinculoA,
        "entrada",
        "2026-06-03T17:00:00-03:00",
      );
      await post(`/v1/pontos/${evento.id}/ajustes`, rhA)
        .send({ motivoCodigo: "erro_de_digitacao", tipoCorrigido: "saida" })
        .expect(201);

      const detalhe = await get(`/v1/pontos/${evento.id}`, rhA).expect(200);
      expect(detalhe.body.tipo).toBe("entrada");
      expect(detalhe.body.efetivo.tipo).toBe("saida");
    });

    it("anula uma marcacao duplicada, e a anulacao e TERMINAL", async () => {
      const evento = await registrarPonto(
        rhA,
        vinculoA,
        "entrada",
        "2026-06-04T08:00:00-03:00",
      );

      await post(`/v1/pontos/${evento.id}/ajustes`, rhA)
        .send({ motivoCodigo: "registro_duplicado", anula: true })
        .expect(201);

      const detalhe = await get(`/v1/pontos/${evento.id}`, rhA).expect(200);
      expect(detalhe.body.efetivo.anulado).toBe(true);

      // Nenhum ajuste posterior e aceito: se a anulacao foi errada, o caminho
      // e registrar um evento NOVO, nao "desanular".
      await post(`/v1/pontos/${evento.id}/ajustes`, rhA)
        .send({
          motivoCodigo: "erro_de_digitacao",
          momentoCorrigido: "2026-06-04T08:30:00-03:00",
        })
        .expect(409);
    });

    it("recusa ajuste sem nenhum efeito — garantido tambem por CHECK no banco", async () => {
      const evento = await registrarPonto(
        rhA,
        vinculoA,
        "entrada",
        "2026-06-05T08:00:00-03:00",
      );
      await post(`/v1/pontos/${evento.id}/ajustes`, rhA)
        .send({ motivoCodigo: "erro_de_digitacao" })
        .expect(422);
    });

    it("recusa ajuste que moveria o evento para outra competencia", async () => {
      const evento = await registrarPonto(
        rhA,
        vinculoA,
        "entrada",
        "2026-06-06T08:00:00-03:00",
      );
      await post(`/v1/pontos/${evento.id}/ajustes`, rhA)
        .send({
          motivoCodigo: "erro_de_digitacao",
          momentoCorrigido: "2026-07-06T08:00:00-03:00",
        })
        .expect(422);
    });

    it("recusa motivo fora do catalogo e qualquer campo de texto livre", async () => {
      const evento = await registrarPonto(
        rhA,
        vinculoA,
        "entrada",
        "2026-06-07T08:00:00-03:00",
      );

      await post(`/v1/pontos/${evento.id}/ajustes`, rhA)
        .send({ motivoCodigo: "atestado_medico", anula: true })
        .expect(400);

      // Decisao 4: nao existe campo de observacao. Enviar um e recusado, nao
      // ignorado — o que impede dado sensivel de entrar sem classificacao.
      await post(`/v1/pontos/${evento.id}/ajustes`, rhA)
        .send({
          motivoCodigo: "erro_de_digitacao",
          anula: true,
          observacao: "colaborador em consulta medica",
        })
        .expect(400);
    });
  });

  // -------------------------------------------------------------------------
  // Competencia (decisao 6) — organiza, nao calcula
  // -------------------------------------------------------------------------

  describe("competencia mensal", () => {
    it("filtra a listagem por competencia", async () => {
      const resposta = await get(
        `/v1/pontos?vinculoId=${vinculoA}&competencia=${COMPETENCIA}`,
        rhA,
      ).expect(200);

      expect(resposta.body.total).toBeGreaterThan(0);
      for (const item of resposta.body.itens) {
        expect(item.competencia).toBe(COMPETENCIA);
      }
    });

    it("recusa competencia em formato invalido", async () => {
      await get(`/v1/pontos?competencia=2026-13`, rhA).expect(400);
      await get(`/v1/pontos?competencia=marco`, rhA).expect(400);
    });

    it("NAO retorna nenhum resultado de calculo — sem saldo, horas ou extras", async () => {
      const resposta = await get(
        `/v1/pontos?vinculoId=${vinculoA}&competencia=${COMPETENCIA}`,
        rhA,
      ).expect(200);

      const serializado = JSON.stringify(resposta.body);
      for (const proibido of [
        "saldo",
        "horasTrabalhadas",
        "horaExtra",
        "bancoDeHoras",
        "adicionalNoturno",
        "dsr",
        "jornadaEsperada",
      ]) {
        expect(serializado).not.toContain(proibido);
      }
    });
  });

  // -------------------------------------------------------------------------
  // Autorizacao (decisao 5)
  // -------------------------------------------------------------------------

  describe("autorizacao: so RH e DP da propria empresa", () => {
    const negados = () => [
      { nome: "admin_tecnico", cred: admin },
      { nome: "gestor", cred: gestorA },
      { nome: "financeiro", cred: financeiroA },
      { nome: "colaborador", cred: colaboradorA },
      { nome: "auditor", cred: auditorA },
      { nome: "dpo", cred: dpoA },
    ];

    it("todos os demais papeis sao negados ao REGISTRAR", async () => {
      for (const { nome, cred } of negados()) {
        const resposta = await post("/v1/pontos", cred).send({
          vinculoId: vinculoA,
          tipo: "entrada",
          momento: "2026-03-25T08:00:00-03:00",
        });
        expect([403, 404]).toContain(resposta.status);
        expect(resposta.status).not.toBe(201);
        // Marca qual papel falhou, se falhar.
        expect({ nome, status: resposta.status }).toEqual({
          nome,
          status: resposta.status,
        });
      }
    });

    it("todos os demais papeis sao negados ao CONSULTAR", async () => {
      for (const { cred } of negados()) {
        const lista = await get(`/v1/pontos`, cred);
        expect([403, 404]).toContain(lista.status);

        const porVinculo = await get(`/v1/vinculos/${vinculoA}/pontos`, cred);
        expect([403, 404]).toContain(porVinculo.status);
      }
    });

    it("admin_tecnico e negado mesmo tendo acesso amplo a estrutura organizacional", async () => {
      // Prova a assimetria deliberada: o mesmo ator que le a estrutura de
      // qualquer empresa nao le ponto de nenhuma.
      await get(`/v1/empresas/${empresaA}`, admin).expect(200);
      const ponto = await get(`/v1/pontos`, admin);
      expect([403, 404]).toContain(ponto.status);
    });

    it("exige sessao valida", async () => {
      await agent().get("/v1/pontos").expect(401);
      await agent()
        .post("/v1/pontos")
        .send({ vinculoId: vinculoA, tipo: "entrada", momento: ENTRADA })
        .expect(401);
    });

    it("exige token CSRF na escrita", async () => {
      await agent()
        .post("/v1/pontos")
        .set("Cookie", rhA.cookie)
        .send({ vinculoId: vinculoA, tipo: "entrada", momento: ENTRADA })
        .expect(403);
    });
  });

  // -------------------------------------------------------------------------
  // IDOR / BOLA e isolamento por empresa
  // -------------------------------------------------------------------------

  describe("isolamento por empresa (IDOR/BOLA)", () => {
    it("RH da empresa A nao registra ponto para vinculo da empresa B — 404, nunca 403", async () => {
      // 404 e nao 403 de proposito: um 403 confirmaria que aquele vinculo
      // existe em outra empresa.
      await post("/v1/pontos", rhA)
        .send({ vinculoId: vinculoB, tipo: "entrada", momento: ENTRADA })
        .expect(404);
    });

    it("RH da empresa A nao le marcacao da empresa B", async () => {
      const eventoB = await registrarPonto(
        rhB,
        vinculoB,
        "entrada",
        "2026-03-26T08:00:00-03:00",
      );

      await get(`/v1/pontos/${eventoB.id}`, rhA).expect(404);
      await get(`/v1/pontos/${eventoB.id}/ajustes`, rhA).expect(404);
      await get(`/v1/vinculos/${vinculoB}/pontos`, rhA).expect(404);
    });

    it("RH da empresa A nao ajusta marcacao da empresa B", async () => {
      const eventoB = await registrarPonto(
        rhB,
        vinculoB,
        "saida",
        "2026-03-26T17:00:00-03:00",
      );

      await post(`/v1/pontos/${eventoB.id}/ajustes`, rhA)
        .send({ motivoCodigo: "registro_indevido", anula: true })
        .expect(404);

      // Nada mudou do outro lado.
      const detalhe = await get(`/v1/pontos/${eventoB.id}`, rhB).expect(200);
      expect(detalhe.body.efetivo.anulado).toBe(false);
    });

    it("a listagem NUNCA inclui marcacao de outra empresa", async () => {
      const resposta = await get(`/v1/pontos?tamanhoPagina=100`, rhA).expect(
        200,
      );
      for (const item of resposta.body.itens) {
        expect(item.empresaId).toBe(empresaA);
      }
      expect(
        resposta.body.itens.some(
          (item: { vinculoId: string }) => item.vinculoId === vinculoB,
        ),
      ).toBe(false);
    });

    it("filtrar explicitamente pelo vinculo de outra empresa devolve pagina vazia", async () => {
      const resposta = await get(
        `/v1/pontos?vinculoId=${vinculoB}`,
        rhA,
      ).expect(200);
      expect(resposta.body.itens).toHaveLength(0);
      expect(resposta.body.total).toBe(0);
    });

    it("cada tentativa cross-company gera evento de negacao na trilha", async () => {
      const prisma = new PrismaClient({ datasources: { db: { url: appUrl } } });
      try {
        const antes = await prisma.auditEvent.count({
          where: { action: "authorization_denied", resource: "evento_ponto" },
        });

        await get(`/v1/vinculos/${vinculoB}/pontos`, rhA).expect(404);

        const depois = await prisma.auditEvent.count({
          where: { action: "authorization_denied", resource: "evento_ponto" },
        });
        expect(depois).toBeGreaterThan(antes);

        // O evento registra o id TECNICO tentado — nunca nome ou matricula.
        const evento = await prisma.auditEvent.findFirst({
          where: { action: "authorization_denied", resource: "evento_ponto" },
          orderBy: { occurredAt: "desc" },
        });
        expect(evento?.result).toBe("denied");
        expect(evento?.resourceId).toBe(vinculoB);
      } finally {
        await prisma.$disconnect();
      }
    });
  });

  // -------------------------------------------------------------------------
  // Auditoria (ADR 0004)
  // -------------------------------------------------------------------------

  describe("auditoria", () => {
    it("registro e ajuste geram evento, sem nome, matricula nem horario", async () => {
      const prisma = new PrismaClient({ datasources: { db: { url: appUrl } } });
      try {
        const evento = await registrarPonto(
          rhA,
          vinculoA,
          "entrada",
          "2026-06-10T08:00:00-03:00",
        );

        const auditRegistro = await prisma.auditEvent.findFirst({
          where: {
            action: "ponto_evento_registrado",
            resourceId: evento.id,
          },
        });
        expect(auditRegistro).not.toBeNull();
        expect(auditRegistro?.companyId).toBe(empresaA);
        expect(auditRegistro?.actorRole).toBe("rh");
        expect(auditRegistro?.result).toBe("success");

        // A trilha nao guarda o conteudo do ato — so o ato. Serializar a linha
        // inteira e procurar o horario/matricula prova que nao vazou por
        // nenhum campo.
        const serializado = JSON.stringify(auditRegistro);
        expect(serializado).not.toContain("MAT-PONTO-A");
        expect(serializado).not.toContain("Pessoa Sintetica");
        expect(serializado).not.toContain("08:00");

        const ajuste = await post(`/v1/pontos/${evento.id}/ajustes`, rhA)
          .send({ motivoCodigo: "registro_indevido", anula: true })
          .expect(201);

        const auditAjuste = await prisma.auditEvent.findFirst({
          where: {
            action: "ponto_ajuste_registrado",
            resourceId: ajuste.body.id,
          },
        });
        expect(auditAjuste).not.toBeNull();
        expect(auditAjuste?.resource).toBe("ajuste_ponto");
      } finally {
        await prisma.$disconnect();
      }
    });

    it("consulta a dado de ponto tambem e auditada", async () => {
      const prisma = new PrismaClient({ datasources: { db: { url: appUrl } } });
      try {
        const antes = await prisma.auditEvent.count({
          where: { action: "ponto_consultado" },
        });
        await get(`/v1/pontos?competencia=${COMPETENCIA}`, rhA).expect(200);
        const depois = await prisma.auditEvent.count({
          where: { action: "ponto_consultado" },
        });
        expect(depois).toBeGreaterThan(antes);
      } finally {
        await prisma.$disconnect();
      }
    });

    it("ATOMICIDADE: se a auditoria falha, a marcacao nao persiste", async () => {
      const migrator = new PrismaClient({
        datasources: { db: { url: migratorUrl } },
      });
      const marcador = "2026-06-15T08:00:00-03:00";
      try {
        await migrator.$executeRawUnsafe(
          "REVOKE INSERT ON TABLE app.audit_event FROM evolli_app",
        );
        await post("/v1/pontos", rhA)
          .send({ vinculoId: vinculoA, tipo: "entrada", momento: marcador })
          .expect(500);
      } finally {
        await migrator.$executeRawUnsafe(
          "GRANT INSERT ON TABLE app.audit_event TO evolli_app",
        );
        await migrator.$disconnect();
      }

      const prisma = new PrismaClient({ datasources: { db: { url: appUrl } } });
      try {
        // Nada persistiu. Uma marcacao gravada sem rastro de quem a gravou
        // seria pior que uma marcacao que falhou.
        expect(
          await prisma.eventoPonto.count({
            where: { momento: new Date(marcador) },
          }),
        ).toBe(0);
      } finally {
        await prisma.$disconnect();
      }
    });

    it("ATOMICIDADE: o mesmo vale para o ajuste", async () => {
      const evento = await registrarPonto(
        rhA,
        vinculoA,
        "entrada",
        "2026-06-16T08:00:00-03:00",
      );

      const migrator = new PrismaClient({
        datasources: { db: { url: migratorUrl } },
      });
      try {
        await migrator.$executeRawUnsafe(
          "REVOKE INSERT ON TABLE app.audit_event FROM evolli_app",
        );
        await post(`/v1/pontos/${evento.id}/ajustes`, rhA)
          .send({ motivoCodigo: "registro_indevido", anula: true })
          .expect(500);
      } finally {
        await migrator.$executeRawUnsafe(
          "GRANT INSERT ON TABLE app.audit_event TO evolli_app",
        );
        await migrator.$disconnect();
      }

      const detalhe = await get(`/v1/pontos/${evento.id}`, rhA).expect(200);
      expect(detalhe.body.ajustes).toHaveLength(0);
      expect(detalhe.body.efetivo.anulado).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Fronteiras: o que esta fatia NAO faz
  // -------------------------------------------------------------------------

  describe("fronteiras da Baseline V1", () => {
    it("nao existe recurso de escala, jornada ou competencia", async () => {
      for (const rota of ["/v1/escalas", "/v1/jornadas", "/v1/competencias"]) {
        await post(rota, rhA).send({}).expect(404);
        await get(rota, rhA).expect(404);
      }
    });

    it("nao existe subrecurso de importacao, apuracao ou fechamento sob /v1/pontos", async () => {
      // Estas colidem com `GET /v1/pontos/:pontoId`, entao o `ParseUUIDPipe`
      // responde 400 antes de qualquer handler — o que basta para provar o
      // ponto: nao ha capacidade por tras desses caminhos. Aceitar 400 ou 404
      // e deliberado; exigir so 404 testaria o roteador, nao a fronteira.
      for (const rota of [
        "/v1/pontos/importacoes",
        "/v1/pontos/importacao-txt",
        "/v1/pontos/apuracoes",
        "/v1/pontos/fechamentos",
      ]) {
        const escrita = await post(rota, rhA).send({});
        expect([400, 404]).toContain(escrita.status);

        const leitura = await get(rota, rhA);
        expect([400, 404]).toContain(leitura.status);
      }
    });

    it("a projecao nao vaza nome nem matricula do colaborador", async () => {
      const resposta = await get(
        `/v1/pontos?vinculoId=${vinculoA}&tamanhoPagina=100`,
        rhA,
      ).expect(200);

      const serializado = JSON.stringify(resposta.body);
      expect(serializado).not.toContain("Pessoa Sintetica");
      expect(serializado).not.toContain("MAT-PONTO-A");
    });
  });

  // -------------------------------------------------------------------------
  // Regressao das fatias anteriores
  // -------------------------------------------------------------------------

  describe("regressao: fatias anteriores intactas", () => {
    it("organizacao continua respondendo, inclusive para admin_tecnico", async () => {
      await get(`/v1/empresas/${empresaA}`, admin).expect(200);
      await get(`/v1/departamentos/${departamentoA}`, admin).expect(200);
    });

    it("pessoas continua respondendo para RH da propria empresa", async () => {
      const lista = await get(`/v1/colaboradores`, rhA).expect(200);
      expect(lista.body.total).toBeGreaterThan(0);
    });

    it("admin_tecnico continua negado em pessoas — nada nesta fatia o reabilitou", async () => {
      const resposta = await get(`/v1/colaboradores`, admin);
      expect([403, 404]).toContain(resposta.status);
    });

    it("a trilha de auditoria continua append-only para evolli_app", async () => {
      const prisma = new PrismaClient({ datasources: { db: { url: appUrl } } });
      try {
        const privilegios = await prisma.$queryRawUnsafe<
          { privilege_type: string }[]
        >(
          `SELECT privilege_type FROM information_schema.role_table_grants
            WHERE grantee='evolli_app' AND table_schema='app'
              AND table_name='audit_event'`,
        );
        const concedidos = privilegios
          .map((linha) => linha.privilege_type)
          .sort();
        expect(concedidos).toEqual(["INSERT", "SELECT"]);
      } finally {
        await prisma.$disconnect();
      }
    });

    it("evolli_migrator continua sem privilegio ampliado", async () => {
      const migrator = new PrismaClient({
        datasources: { db: { url: migratorUrl } },
      });
      try {
        const papel = await migrator.$queryRawUnsafe<
          {
            rolsuper: boolean;
            rolcreatedb: boolean;
            rolcreaterole: boolean;
            rolbypassrls: boolean;
          }[]
        >(
          `SELECT rolsuper, rolcreatedb, rolcreaterole, rolbypassrls
             FROM pg_roles WHERE rolname = 'evolli_migrator'`,
        );
        expect(papel[0]).toEqual({
          rolsuper: false,
          rolcreatedb: false,
          rolcreaterole: false,
          rolbypassrls: false,
        });
      } finally {
        await migrator.$disconnect();
      }
    });
  });
});
