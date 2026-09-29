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
 * T139 — Central de Solicitações de Pessoas (fundação backend).
 * PostgreSQL real e efêmero (Testcontainers), migration aplicada do zero.
 *
 * **Todos os dados são sintéticos.** Nenhum nome, CPF, atestado, conteúdo
 * clínico ou dado real — os tipos são rótulos técnicos do catálogo aprovado
 * (`PD-SOL-01`), nunca informação de saúde.
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

const SENHA_PADRAO = "Solicitacoes!Pessoas2026#Teste";
const ADMISSAO = "2026-01-05";

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

/**
 * Chaves que NUNCA podem aparecer numa resposta da Central: anexo/conteúdo
 * seguem bloqueados pelos portões documentais, e dado clínico não é coletado
 * nem para `atestado` (`PD-SOL-05`).
 */
const CHAVES_PROIBIDAS = [
  "anexo",
  "anexos",
  "arquivo",
  "file",
  "conteudo",
  "content",
  "bytes",
  "base64",
  "url",
  "uri",
  "bucket",
  "chave",
  "key",
  "hash",
  "mime",
  "path",
  "caminho",
  "tamanho",
  "size",
  "storage",
  "downloadurl",
  "assinatura",
  "diagnostico",
  "cid",
  "descricaoclinica",
  "descricao_clinica",
  "observacao",
  "observacoes",
  "justificativatexto",
  "prazo",
  "vencimento",
  "sla",
];

function assertSemConteudo(corpo: Record<string, unknown>): void {
  const chaves = Object.keys(corpo).map((k) => k.toLowerCase());
  for (const proibida of CHAVES_PROIBIDAS) {
    expect(chaves).not.toContain(proibida);
  }
}

describe("Central de Solicitações de Pessoas — fundação backend (e2e)", () => {
  let container: StartedTestContainer;
  let appUrl: string;
  let migratorUrl: string;
  let app: INestApplication;

  let master: Credencial;
  let rhA: Credencial;
  let rhB: Credencial;
  let dpA: Credencial;
  let gestorA: Credencial;
  let colaboradorUserA: Credencial;

  let empresaA: string;
  let empresaB: string;
  let vinculoA1: string;
  let vinculoB1: string;

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

  /** Admite um colaborador e devolve o id do VÍNCULO (sujeito da solicitação). */
  async function admitirComVinculo(
    cred: Credencial,
    empresaId: string,
    departamentoId: string,
    matricula: string,
  ): Promise<string> {
    const colaborador = await post("/v1/colaboradores", cred)
      .send({
        nome: "Pessoa Sintetica Solicitacoes",
        empresaId,
        matricula,
        tipo: "clt",
        dataAdmissao: ADMISSAO,
        motivoCodigo: "admissao_inicial",
        departamentoId,
      })
      .expect(201);

    const vinculos = await get(
      `/v1/colaboradores/${colaborador.body.id}/vinculos`,
      cred,
    ).expect(200);

    return vinculos.body[0].id as string;
  }

  async function registrar(
    cred: Credencial,
    empresaId: string,
    vinculoId: string,
    extra: Record<string, unknown> = {},
  ): Promise<string> {
    const resp = await post("/v1/solicitacoes-pessoas", cred)
      .send({
        empresaId,
        vinculoId,
        tipo: "ferias",
        motivo: "periodo_ferias",
        ...extra,
      })
      .expect(201);
    return resp.body.id as string;
  }

  function transicionar(
    cred: Credencial,
    solicitacaoId: string,
    acao: string,
    motivo?: string,
  ) {
    return post(
      `/v1/solicitacoes-pessoas/${solicitacaoId}/transicoes`,
      cred,
    ).send({ acao, ...(motivo ? { motivo } : {}) });
  }

  /** Leva uma solicitação nova até a situação pedida. */
  async function levarAte(situacao: string): Promise<string> {
    const id = await registrar(rhA, empresaA, vinculoA1);
    if (situacao === "rascunho") return id;

    await transicionar(rhA, id, "enviar").expect(201);
    if (situacao === "enviada") return id;

    await transicionar(rhA, id, "iniciar_revisao").expect(201);
    if (situacao === "em_revisao_rh") return id;

    if (situacao === "aguardando_informacao") {
      await transicionar(rhA, id, "aguardar_informacao").expect(201);
      return id;
    }
    if (situacao === "encaminhada_para_operacao_rh") {
      await transicionar(rhA, id, "encaminhar_para_operacao").expect(201);
      return id;
    }
    if (situacao === "recusada") {
      await transicionar(rhA, id, "recusar", "duplicidade").expect(201);
      return id;
    }
    throw new Error(`situacao nao suportada no helper: ${situacao}`);
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

    expect(
      runBootstrap({
        DATABASE_URL: appUrl,
        ADMIN_BOOTSTRAP_EMAIL: "admin.sol@example.test",
        ADMIN_BOOTSTRAP_PASSWORD: SENHA_PADRAO,
      }).status,
    ).toBe(0);

    master = await seedMaster("master.sol@example.test");

    empresaA = (
      await post("/v1/empresas", master)
        .send({ codigo: "SOLA", nome: "Empresa Sol A" })
        .expect(201)
    ).body.id;
    empresaB = (
      await post("/v1/empresas", master)
        .send({ codigo: "SOLB", nome: "Empresa Sol B" })
        .expect(201)
    ).body.id;

    const departamentoA = (
      await post("/v1/departamentos", master)
        .send({ empresaId: empresaA, codigo: "SDEPA", nome: "Dep Sol A" })
        .expect(201)
    ).body.id;
    const departamentoB = (
      await post("/v1/departamentos", master)
        .send({ empresaId: empresaB, codigo: "SDEPB", nome: "Dep Sol B" })
        .expect(201)
    ).body.id;

    rhA = await criarUsuario("rh.sa@example.test", "rh", empresaA);
    rhB = await criarUsuario("rh.sb@example.test", "rh", empresaB);
    dpA = await criarUsuario("dp.sa@example.test", "dp", empresaA);
    gestorA = await criarUsuario("gestor.sa@example.test", "gestor", empresaA);
    colaboradorUserA = await criarUsuario(
      "colab.sa@example.test",
      "colaborador",
      empresaA,
    );

    vinculoA1 = await admitirComVinculo(
      rhA,
      empresaA,
      departamentoA,
      "SOL-A-0001",
    );
    vinculoB1 = await admitirComVinculo(
      rhB,
      empresaB,
      departamentoB,
      "SOL-B-0001",
    );
  });

  afterAll(async () => {
    await app?.close();
    await container?.stop();
  });

  // -------------------------------------------------------------------------
  // Registro e releitura
  // -------------------------------------------------------------------------

  describe("registro e releitura", () => {
    it("rh registra solicitação em rascunho e relê pelo detalhe", async () => {
      const criada = await post("/v1/solicitacoes-pessoas", rhA)
        .send({
          empresaId: empresaA,
          vinculoId: vinculoA1,
          tipo: "contestacao_ajuste_ponto",
          motivo: "divergencia_marcacao",
          periodoReferencia: "2026-08-10",
        })
        .expect(201);

      expect(criada.body.situacao).toBe("rascunho");
      expect(criada.body.empresaId).toBe(empresaA);
      expect(criada.body.vinculoId).toBe(vinculoA1);
      assertSemConteudo(criada.body);

      const detalhe = await get(
        `/v1/solicitacoes-pessoas/${criada.body.id}`,
        rhA,
      ).expect(200);
      expect(detalhe.body.id).toBe(criada.body.id);
      expect(detalhe.body.situacao).toBe("rascunho");
    });

    it("aceita os seis tipos do catálogo aprovado e recusa `documento`", async () => {
      for (const tipo of [
        "contestacao_ajuste_ponto",
        "ausencia",
        "ferias",
        "atualizacao_cadastral",
        "atestado",
        "beneficios",
      ]) {
        await post("/v1/solicitacoes-pessoas", rhA)
          .send({
            empresaId: empresaA,
            vinculoId: vinculoA1,
            tipo,
            motivo: "outro_controlado",
          })
          .expect(201);
      }

      // Saiu do catálogo (`PD-SOL-01`): segue em solicitacoes-documento.
      await post("/v1/solicitacoes-pessoas", rhA)
        .send({
          empresaId: empresaA,
          vinculoId: vinculoA1,
          tipo: "documento",
          motivo: "outro_controlado",
        })
        .expect(400);
    });

    it("atestado não aceita nenhum campo clínico nem anexo", async () => {
      const resp = await post("/v1/solicitacoes-pessoas", rhA)
        .send({
          empresaId: empresaA,
          vinculoId: vinculoA1,
          tipo: "atestado",
          motivo: "atestado_apresentado",
        })
        .expect(201);
      assertSemConteudo(resp.body);

      // `forbidNonWhitelisted` rejeita qualquer tentativa de contrabandear
      // conteúdo clínico ou anexo pelo corpo.
      for (const campo of [
        { cid: "A00" },
        { diagnostico: "texto" },
        { anexo: "arquivo.pdf" },
        { observacao: "texto livre" },
      ]) {
        await post("/v1/solicitacoes-pessoas", rhA)
          .send({
            empresaId: empresaA,
            vinculoId: vinculoA1,
            tipo: "atestado",
            motivo: "atestado_apresentado",
            ...campo,
          })
          .expect(400);
      }
    });

    it("rejeita dia de referência inexistente no calendário", async () => {
      await post("/v1/solicitacoes-pessoas", rhA)
        .send({
          empresaId: empresaA,
          vinculoId: vinculoA1,
          tipo: "contestacao_ajuste_ponto",
          motivo: "divergencia_marcacao",
          periodoReferencia: "2026-02-30",
        })
        .expect(422);
    });

    it("não aceita situação vinda do cliente: a máquina de estados começa do início", async () => {
      await post("/v1/solicitacoes-pessoas", rhA)
        .send({
          empresaId: empresaA,
          vinculoId: vinculoA1,
          tipo: "ferias",
          motivo: "periodo_ferias",
          situacao: "encaminhada_para_operacao_rh",
        })
        .expect(400);
    });
  });

  // -------------------------------------------------------------------------
  // Listagem, filtros e paginação
  // -------------------------------------------------------------------------

  describe("listagem, filtros e paginação", () => {
    it("lista só a própria empresa e respeita paginação", async () => {
      const pagina = await get(
        "/v1/solicitacoes-pessoas?pagina=1&tamanhoPagina=2",
        rhA,
      ).expect(200);

      expect(pagina.body.itens.length).toBeLessThanOrEqual(2);
      expect(pagina.body.pagina).toBe(1);
      expect(pagina.body.tamanhoPagina).toBe(2);
      expect(pagina.body.total).toBeGreaterThan(0);
      for (const item of pagina.body.itens) {
        expect(item.empresaId).toBe(empresaA);
        assertSemConteudo(item);
      }
    });

    it("filtra por tipo, situação e vínculo", async () => {
      const porTipo = await get(
        `/v1/solicitacoes-pessoas?tipo=atestado&vinculoId=${vinculoA1}`,
        rhA,
      ).expect(200);
      for (const item of porTipo.body.itens) {
        expect(item.tipo).toBe("atestado");
        expect(item.vinculoId).toBe(vinculoA1);
      }

      const porSituacao = await get(
        "/v1/solicitacoes-pessoas?situacao=rascunho",
        rhA,
      ).expect(200);
      for (const item of porSituacao.body.itens) {
        expect(item.situacao).toBe("rascunho");
      }
    });

    it("rejeita filtro fora do catálogo", async () => {
      await get("/v1/solicitacoes-pessoas?tipo=documento", rhA).expect(400);
      await get("/v1/solicitacoes-pessoas?situacao=encerrada", rhA).expect(400);
    });
  });

  // -------------------------------------------------------------------------
  // Ciclo de estados
  // -------------------------------------------------------------------------

  describe("ciclo completo das transições aprovadas", () => {
    it("percorre rascunho → enviada → revisão → aguardando → revisão → encaminhada", async () => {
      const id = await registrar(rhA, empresaA, vinculoA1);

      const enviada = await transicionar(rhA, id, "enviar").expect(201);
      expect(enviada.body.situacao).toBe("enviada");
      expect(enviada.body.enviadaEm).not.toBeNull();

      const revisao = await transicionar(rhA, id, "iniciar_revisao").expect(
        201,
      );
      expect(revisao.body.situacao).toBe("em_revisao_rh");
      expect(revisao.body.primeiraRevisaoEm).not.toBeNull();

      const aguardando = await transicionar(
        rhA,
        id,
        "aguardar_informacao",
      ).expect(201);
      expect(aguardando.body.situacao).toBe("aguardando_informacao");

      const retomada = await transicionar(rhA, id, "retomar_revisao").expect(
        201,
      );
      expect(retomada.body.situacao).toBe("em_revisao_rh");

      const encaminhada = await transicionar(
        rhA,
        id,
        "encaminhar_para_operacao",
      ).expect(201);
      expect(encaminhada.body.situacao).toBe("encaminhada_para_operacao_rh");
    });

    it("rejeita transição fora de ordem", async () => {
      const id = await levarAte("rascunho");
      // Encaminhar exige estar em revisão.
      await transicionar(rhA, id, "encaminhar_para_operacao").expect(422);
      // Retomar exige estar aguardando informação.
      await transicionar(rhA, id, "retomar_revisao").expect(422);

      const detalhe = await get(`/v1/solicitacoes-pessoas/${id}`, rhA).expect(
        200,
      );
      expect(detalhe.body.situacao).toBe("rascunho");
    });

    it("rejeita ação fora do catálogo de transições", async () => {
      const id = await levarAte("rascunho");
      await transicionar(rhA, id, "criar").expect(400);
      await transicionar(rhA, id, "encerrar").expect(400);
    });
  });

  // -------------------------------------------------------------------------
  // Cancelamento e reabertura — PD-SOL-03
  // -------------------------------------------------------------------------

  describe("cancelamento e reabertura (PD-SOL-03)", () => {
    it("cancela em rascunho e em enviada — antes de em_revisao_rh", async () => {
      for (const situacao of ["rascunho", "enviada"]) {
        const id = await levarAte(situacao);
        const resp = await transicionar(rhA, id, "cancelar").expect(201);
        expect(resp.body.situacao).toBe("cancelada");
      }
    });

    it("NÃO cancela depois de em_revisao_rh", async () => {
      const id = await levarAte("em_revisao_rh");
      await transicionar(rhA, id, "cancelar").expect(422);

      const detalhe = await get(`/v1/solicitacoes-pessoas/${id}`, rhA).expect(
        200,
      );
      expect(detalhe.body.situacao).toBe("em_revisao_rh");
    });

    it("NÃO cancela em aguardando_informacao — transição revogada pela decisão", async () => {
      const id = await levarAte("aguardando_informacao");
      await transicionar(rhA, id, "cancelar").expect(422);
    });

    it("reabre recusada, exigindo justificativa codificada", async () => {
      const id = await levarAte("recusada");

      // Sem motivo a reabertura é recusada: PD-SOL-03 exige justificativa.
      await transicionar(rhA, id, "reabrir").expect(422);

      const reaberta = await transicionar(
        rhA,
        id,
        "reabrir",
        "reanalise_administrativa",
      ).expect(201);
      expect(reaberta.body.situacao).toBe("em_revisao_rh");
    });

    it("reabre encaminhada_para_operacao_rh, o estado que 'encerrada' designa", async () => {
      const id = await levarAte("encaminhada_para_operacao_rh");
      const reaberta = await transicionar(
        rhA,
        id,
        "reabrir",
        "correcao_de_registro",
      ).expect(201);
      expect(reaberta.body.situacao).toBe("em_revisao_rh");
    });

    it("NÃO reabre cancelada — exige nova solicitação", async () => {
      const id = await levarAte("rascunho");
      await transicionar(rhA, id, "cancelar").expect(201);
      await transicionar(rhA, id, "reabrir", "correcao_de_registro").expect(
        422,
      );

      const detalhe = await get(`/v1/solicitacoes-pessoas/${id}`, rhA).expect(
        200,
      );
      expect(detalhe.body.situacao).toBe("cancelada");
    });

    it("recusar exige motivo codificado", async () => {
      const id = await levarAte("em_revisao_rh");
      await transicionar(rhA, id, "recusar").expect(422);
      await transicionar(
        rhA,
        id,
        "recusar",
        "fora_do_escopo_da_central",
      ).expect(201);
    });
  });

  // -------------------------------------------------------------------------
  // Histórico
  // -------------------------------------------------------------------------

  describe("histórico auditável", () => {
    it("preserva todos os eventos em ordem, inclusive após reabertura", async () => {
      const id = await levarAte("recusada");
      await transicionar(rhA, id, "reabrir", "reanalise_administrativa").expect(
        201,
      );

      const historico = await get(
        `/v1/solicitacoes-pessoas/${id}/historico`,
        rhA,
      ).expect(200);

      expect(historico.body.map((e: { acao: string }) => e.acao)).toEqual([
        "criar",
        "enviar",
        "iniciar_revisao",
        "recusar",
        "reabrir",
      ]);

      const criacao = historico.body[0];
      expect(criacao.situacaoDe).toBeNull();
      expect(criacao.situacaoPara).toBe("rascunho");

      const reabertura = historico.body[4];
      expect(reabertura.situacaoDe).toBe("recusada");
      expect(reabertura.situacaoPara).toBe("em_revisao_rh");
      expect(reabertura.motivo).toBe("reanalise_administrativa");

      for (const evento of historico.body) {
        assertSemConteudo(evento);
      }
    });

    it("o histórico de uma solicitação nunca vaza eventos de outra", async () => {
      const primeira = await levarAte("enviada");
      const segunda = await levarAte("enviada");

      const historico = await get(
        `/v1/solicitacoes-pessoas/${primeira}/historico`,
        rhA,
      ).expect(200);

      for (const evento of historico.body) {
        expect(evento.solicitacaoId).toBe(primeira);
        expect(evento.solicitacaoId).not.toBe(segunda);
      }
    });
  });

  // -------------------------------------------------------------------------
  // CSRF
  // -------------------------------------------------------------------------

  describe("CSRF nas mutações", () => {
    it("recusa registro sem token CSRF", async () => {
      await agent()
        .post("/v1/solicitacoes-pessoas")
        .set("Cookie", rhA.cookie)
        .send({
          empresaId: empresaA,
          vinculoId: vinculoA1,
          tipo: "ferias",
          motivo: "periodo_ferias",
        })
        .expect(403);
    });

    it("recusa transição sem token CSRF, sem alterar o estado", async () => {
      const id = await levarAte("rascunho");

      await agent()
        .post(`/v1/solicitacoes-pessoas/${id}/transicoes`)
        .set("Cookie", rhA.cookie)
        .send({ acao: "enviar" })
        .expect(403);

      const detalhe = await get(`/v1/solicitacoes-pessoas/${id}`, rhA).expect(
        200,
      );
      expect(detalhe.body.situacao).toBe("rascunho");
    });

    it("leitura não exige CSRF", async () => {
      await get("/v1/solicitacoes-pessoas", rhA).expect(200);
    });
  });

  // -------------------------------------------------------------------------
  // RBAC deny-by-default
  // -------------------------------------------------------------------------

  describe("RBAC deny-by-default (PD-SOL-01)", () => {
    for (const papel of ["dp", "gestor", "colaborador"] as const) {
      it(`nega ${papel} em leitura, registro e transição`, async () => {
        const cred =
          papel === "dp"
            ? dpA
            : papel === "gestor"
              ? gestorA
              : colaboradorUserA;

        await get("/v1/solicitacoes-pessoas", cred).expect(403);
        await post("/v1/solicitacoes-pessoas", cred)
          .send({
            empresaId: empresaA,
            vinculoId: vinculoA1,
            tipo: "ferias",
            motivo: "periodo_ferias",
          })
          .expect(403);
      });
    }

    it("master_tecnico lê globalmente mas não muta", async () => {
      const lista = await get("/v1/solicitacoes-pessoas", master).expect(200);
      expect(lista.body.total).toBeGreaterThan(0);

      await post("/v1/solicitacoes-pessoas", master)
        .send({
          empresaId: empresaA,
          vinculoId: vinculoA1,
          tipo: "ferias",
          motivo: "periodo_ferias",
        })
        .expect(403);

      const id = await levarAte("rascunho");
      await transicionar(master, id, "enviar").expect(403);
    });
  });

  // -------------------------------------------------------------------------
  // Isolamento entre empresas
  // -------------------------------------------------------------------------

  describe("IDOR/BOLA entre empresas", () => {
    it("rh de outra empresa recebe 404 no detalhe, nunca 403", async () => {
      const id = await levarAte("rascunho");
      await get(`/v1/solicitacoes-pessoas/${id}`, rhB).expect(404);
    });

    it("rh de outra empresa recebe 404 no histórico", async () => {
      const id = await levarAte("rascunho");
      await get(`/v1/solicitacoes-pessoas/${id}/historico`, rhB).expect(404);
    });

    it("rh de outra empresa recebe 404 ao tentar transicionar", async () => {
      const id = await levarAte("rascunho");
      await transicionar(rhB, id, "enviar").expect(404);

      const detalhe = await get(`/v1/solicitacoes-pessoas/${id}`, rhA).expect(
        200,
      );
      expect(detalhe.body.situacao).toBe("rascunho");
    });

    it("registrar para empresa alheia responde 404, sem criar nada", async () => {
      await post("/v1/solicitacoes-pessoas", rhB)
        .send({
          empresaId: empresaA,
          vinculoId: vinculoA1,
          tipo: "ferias",
          motivo: "periodo_ferias",
        })
        .expect(404);
    });

    it("registrar com vínculo de outra empresa responde 404", async () => {
      await post("/v1/solicitacoes-pessoas", rhA)
        .send({
          empresaId: empresaA,
          vinculoId: vinculoB1,
          tipo: "ferias",
          motivo: "periodo_ferias",
        })
        .expect(404);
    });

    it("listagem com empresaId alheio devolve página vazia, nunca erro", async () => {
      const lista = await get(
        `/v1/solicitacoes-pessoas?empresaId=${empresaB}`,
        rhA,
      ).expect(200);
      expect(lista.body.itens).toEqual([]);
      expect(lista.body.total).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Auditoria e ausência de efeito colateral
  // -------------------------------------------------------------------------

  describe("auditoria e limites de domínio", () => {
    it("registra a trilha das mutações sem dado sensível no evento", async () => {
      const id = await levarAte("rascunho");
      await transicionar(rhA, id, "enviar").expect(201);

      const prisma = new PrismaClient({ datasources: { db: { url: appUrl } } });
      try {
        const eventos = await prisma.auditEvent.findMany({
          where: { resource: "solicitacao_pessoa", resourceId: id },
          orderBy: { occurredAt: "asc" },
        });

        expect(eventos.map((e) => e.action)).toEqual([
          "pessoas_solicitacao_criada",
          "pessoas_solicitacao_enviada",
        ]);

        for (const evento of eventos) {
          expect(evento.companyId).toBe(empresaA);
          expect(evento.result).toBe("success");
          // Nunca o tipo (revelaria saúde por inferência), nunca o vínculo.
          const texto = JSON.stringify(evento).toLowerCase();
          expect(texto).not.toContain("atestado");
          expect(texto).not.toContain(vinculoA1.toLowerCase());
        }
      } finally {
        await prisma.$disconnect();
      }
    });

    it("audita a tentativa negada entre empresas como denied", async () => {
      const id = await levarAte("rascunho");
      await get(`/v1/solicitacoes-pessoas/${id}`, rhB).expect(404);

      const prisma = new PrismaClient({ datasources: { db: { url: appUrl } } });
      try {
        const negado = await prisma.auditEvent.findFirst({
          where: {
            resource: "solicitacao_pessoa",
            resourceId: id,
            result: "denied",
          },
        });
        expect(negado).not.toBeNull();
        expect(negado!.action).toBe("authorization_denied");
      } finally {
        await prisma.$disconnect();
      }
    });

    it("encaminhar não produz efeito em ponto, vínculo ou movimentação", async () => {
      const prisma = new PrismaClient({ datasources: { db: { url: appUrl } } });
      try {
        const antes = {
          eventosPonto: await prisma.eventoPonto.count(),
          ajustes: await prisma.ajustePonto.count(),
          movimentacoes: await prisma.movimentacaoFuncional.count(),
          vinculos: await prisma.vinculoFuncional.count(),
          documentos: await prisma.documentoMetadado.count(),
        };

        await levarAte("encaminhada_para_operacao_rh");

        expect({
          eventosPonto: await prisma.eventoPonto.count(),
          ajustes: await prisma.ajustePonto.count(),
          movimentacoes: await prisma.movimentacaoFuncional.count(),
          vinculos: await prisma.vinculoFuncional.count(),
          documentos: await prisma.documentoMetadado.count(),
        }).toEqual(antes);
      } finally {
        await prisma.$disconnect();
      }
    });

    it("o histórico é append-only no banco: evolli_app não atualiza nem apaga", async () => {
      const id = await levarAte("enviada");
      const prisma = new PrismaClient({ datasources: { db: { url: appUrl } } });
      try {
        const evento = await prisma.solicitacaoPessoaEvento.findFirst({
          where: { solicitacaoId: id },
        });
        expect(evento).not.toBeNull();

        await expect(
          prisma.solicitacaoPessoaEvento.update({
            where: { id: evento!.id },
            data: { motivo: "duplicidade" },
          }),
        ).rejects.toThrow();

        await expect(
          prisma.solicitacaoPessoaEvento.delete({ where: { id: evento!.id } }),
        ).rejects.toThrow();

        // E a própria solicitação não pode ser apagada: correção é evento novo.
        await expect(
          prisma.solicitacaoPessoa.delete({ where: { id } }),
        ).rejects.toThrow();
      } finally {
        await prisma.$disconnect();
      }
    });
  });
});
