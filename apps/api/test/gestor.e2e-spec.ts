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
 * T151 — Gestor consultivo: escopo por equipe, exceção individual e DP-23.
 * PostgreSQL real e efemero (Testcontainers), migration aplicada do zero.
 *
 * O QUE ESTE ARQUIVO PROVA, e por que precisa de banco real: o escopo do
 * gestor é uma decisão de AUTORIZAÇÃO resolvida por vigência de datas e por
 * invariantes que só o PostgreSQL impõe (EXCLUSION CONSTRAINT, FK composta,
 * CONSTRAINT TRIGGER). Testar com ORM mockado provaria apenas que o código
 * chama o que achamos que chama — não que um segundo gestor principal é
 * impossível, nem que duas requisições simultâneas não criam dois.
 *
 * **Todos os dados sao sinteticos.** Nomes obviamente ficticios, dominio
 * reservado `example.test`, matriculas arbitrarias. Nenhum dado real de
 * pessoa, CPF, arquivo ou imagem, em nenhuma hipotese.
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

const SENHA_PADRAO = "Gestor!Consultivo2026#Teste";

/**
 * Linha do tempo sintetica. Todas as datas sao `YYYY-MM-DD` puras: uma hora
 * aqui tornaria a fronteira de um escopo de autorizacao dependente de fuso.
 */
const ADMISSAO = "2026-01-05";
/** Inicio das ligacoes e atribuicoes "permanentes" do cenario base. */
const INICIO_ESCOPO = "2026-02-01";
/** Data de referencia principal das consultas. */
const DATA_REF = "2026-06-15";
/** Antes da transferencia do cenario 5. */
const DATA_REF_ANTES = "2026-05-01";
/** Dia em que a pessoa movel muda de equipe (fim exclusivo, inicio inclusivo). */
const TRANSFERENCIA = "2026-06-01";
/** Hoje em UTC — unica data em que uma revogacao "agora" pode ser observada. */
const HOJE = new Date().toISOString().slice(0, 10);

/**
 * Campos que a projecao fechada (ADR 0015, decisao 7) NAO pode conter. Sao
 * verificados como substring do JSON serializado inteiro, entao todo nome
 * sintetico deste arquivo e escolhido para nao conter nenhum deles.
 */
const CAMPOS_PROIBIDOS = [
  "cpf",
  "salario",
  "remuneracao",
  "documento",
  "diagnostico",
  "cid",
  "email",
  "passwordhash",
  "mfa",
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
  userId: string;
}

/** Pessoa sintetica: o par (cadastro, vinculo) que o escopo de gestor usa. */
interface Pessoa {
  colaboradorId: string;
  vinculoId: string;
}

interface ItemDeEquipe {
  vinculoId: string;
  colaboradorId: string;
  nome: string;
  matricula: string;
}

describe("Gestor consultivo: escopo por equipe e administracao pelo RH (e2e)", () => {
  let container: StartedTestContainer;
  let appUrl: string;
  let migratorUrl: string;
  let app: INestApplication;
  let prisma: PrismaClient;

  let master: Credencial;
  let rhA: Credencial;
  let rhB: Credencial;
  let gestorPrincipal: Credencial;
  let gestorSubstituto: Credencial;
  let gestorExcecao: Credencial;
  let gestorVigencia: Credencial;
  let gestorSemLigacao: Credencial;
  let gestorB: Credencial;

  let empresaA: string;
  let empresaB: string;
  let departamentoA: string;
  let departamentoB: string;

  let equipeAlfa: string;
  let equipeBeta: string;
  let equipeFora: string;
  let equipeConcorrencia: string;
  let equipeVigencia: string;
  let equipeAdmin: string;
  let equipeHistorico: string;
  let equipeAuditoria: string;
  let equipeB: string;

  let pessoaGestorPrincipal: Pessoa;
  let pessoaGestorSubstituto: Pessoa;
  let pessoaGestorExcecao: Pessoa;
  let pessoaGestorVigencia: Pessoa;
  let pessoaGestorB: Pessoa;
  let pessoaAlfa: Pessoa;
  let pessoaBeta: Pessoa;
  let pessoaFora: Pessoa;
  let pessoaMovel: Pessoa;
  let pessoaExcecaoPassada: Pessoa;
  let pessoaExcecaoAtual: Pessoa;
  let pessoaVigencia: Pessoa;
  let pessoaEmpresaB: Pessoa;

  const agent = () => request(app.getHttpServer());

  // ---------------------------------------------------------------------
  // Helpers de sessao e de requisicao
  // ---------------------------------------------------------------------

  async function logar(email: string, senha: string): Promise<Credencial> {
    const response = await agent()
      .post("/v1/auth/login")
      .send({ email, password: senha })
      .expect(200);
    const cookies = response.headers["set-cookie"] as unknown as string[];
    const cookie = cookies
      .find((c) => c.startsWith("evolli_session="))!
      .split(";")[0]!;
    const usuario = await prisma.accessUser.findUniqueOrThrow({
      where: { email },
      select: { id: true },
    });
    return { cookie, csrfToken: response.body.csrfToken, userId: usuario.id };
  }

  /** Anexa sessao e token CSRF a uma requisicao de mutacao. */
  function comCsrf(req: request.Test, cred: Credencial): request.Test {
    return req.set("Cookie", cred.cookie).set("x-csrf-token", cred.csrfToken);
  }

  function post(rota: string, cred: Credencial) {
    return comCsrf(agent().post(rota), cred);
  }
  function patch(rota: string, cred: Credencial) {
    return comCsrf(agent().patch(rota), cred);
  }
  function get(rota: string, cred: Credencial) {
    return agent().get(rota).set("Cookie", cred.cookie);
  }

  async function seedMaster(email: string): Promise<Credencial> {
    const { PasswordHashService } =
      await import("../src/auth/password/password-hash.service");
    const passwordHash = await new PasswordHashService().hash(SENHA_PADRAO);
    await prisma.accessUser.create({
      data: { email, passwordHash, role: "master_tecnico", status: "active" },
    });
    return logar(email, SENHA_PADRAO);
  }

  async function criarUsuario(
    email: string,
    role: string,
    companyId: string,
  ): Promise<Credencial> {
    await post("/v1/users", master)
      .send({ email, password: SENHA_PADRAO, role, companyId })
      .expect(201);
    return logar(email, SENHA_PADRAO);
  }

  // ---------------------------------------------------------------------
  // Helpers de cadastro (empresa -> departamento -> equipe -> pessoa)
  // ---------------------------------------------------------------------

  async function criarEquipe(
    codigo: string,
    nome: string,
    departamentoId: string,
  ): Promise<string> {
    const resposta = await post("/v1/equipes", master)
      .send({ codigo, nome, departamentoId })
      .expect(201);
    return resposta.body.id;
  }

  /** Efetiva a movimentacao aberta do vinculo (admissao ou transferencia). */
  async function efetivarAdmissao(
    cred: Credencial,
    vinculoId: string,
  ): Promise<void> {
    const linha = await get(
      `/v1/vinculos/${vinculoId}/linha-do-tempo`,
      cred,
    ).expect(200);
    await post(`/v1/movimentacoes/${linha.body[0].id}/efetivar`, cred)
      .send()
      .expect(201);
  }

  /**
   * Admite e efetiva. A efetivacao importa: so ela cria a ALOCACAO, e e a
   * alocacao vigente — nao o cadastro — que coloca alguem no escopo de um
   * gestor.
   */
  async function criarColaboradorComVinculo(
    cred: Credencial,
    dados: {
      nome: string;
      empresaId: string;
      matricula: string;
      departamentoId: string;
      equipeId?: string;
      dataAdmissao?: string;
    },
  ): Promise<Pessoa> {
    const colaborador = await post("/v1/colaboradores", cred)
      .send({
        nome: dados.nome,
        empresaId: dados.empresaId,
        matricula: dados.matricula,
        tipo: "clt",
        dataAdmissao: dados.dataAdmissao ?? ADMISSAO,
        motivoCodigo: "admissao_inicial",
        departamentoId: dados.departamentoId,
        ...(dados.equipeId ? { equipeId: dados.equipeId } : {}),
      })
      .expect(201);

    const vinculos = await get(
      `/v1/colaboradores/${colaborador.body.id}/vinculos`,
      cred,
    ).expect(200);
    const vinculoId: string = vinculos.body[0].id;
    await efetivarAdmissao(cred, vinculoId);

    return { colaboradorId: colaborador.body.id, vinculoId };
  }

  /** Movimentacao sobre vinculo existente, ja efetivada. */
  async function movimentar(
    cred: Credencial,
    corpo: Record<string, unknown>,
  ): Promise<void> {
    const movimentacao = await post("/v1/movimentacoes", cred)
      .send(corpo)
      .expect(201);
    await post(`/v1/movimentacoes/${movimentacao.body.id}/efetivar`, cred)
      .send()
      .expect(201);
  }

  // ---------------------------------------------------------------------
  // Helpers de administracao e consulta do gestor
  // ---------------------------------------------------------------------

  function ligar(
    cred: Credencial,
    userId: string,
    colaboradorId: string,
    vigenciaInicio = INICIO_ESCOPO,
  ) {
    return post("/v1/gestor/administracao/ligacoes", cred).send({
      userId,
      colaboradorId,
      vigenciaInicio,
    });
  }

  function atribuir(
    cred: Credencial,
    corpo: {
      equipeId: string;
      gestorColaboradorId: string;
      papel: "principal" | "substituto";
      vigenciaInicio?: string;
      vigenciaFim?: string;
    },
  ) {
    return post("/v1/gestor/administracao/atribuicoes", cred).send({
      equipeId: corpo.equipeId,
      gestorColaboradorId: corpo.gestorColaboradorId,
      papel: corpo.papel,
      vigenciaInicio: corpo.vigenciaInicio ?? INICIO_ESCOPO,
      ...(corpo.vigenciaFim ? { vigenciaFim: corpo.vigenciaFim } : {}),
    });
  }

  async function consultarEquipe(
    cred: Credencial,
    dataReferencia: string,
  ): Promise<{ dataReferencia: string; itens: ItemDeEquipe[] }> {
    const resposta = await get(
      `/v1/gestor/equipe?dataReferencia=${dataReferencia}`,
      cred,
    ).expect(200);
    return resposta.body;
  }

  async function vinculosVisiveis(
    cred: Credencial,
    dataReferencia: string,
  ): Promise<string[]> {
    const { itens } = await consultarEquipe(cred, dataReferencia);
    return itens.map((i) => i.vinculoId).sort();
  }

  async function colaboradoresVisiveis(
    cred: Credencial,
    dataReferencia: string,
  ): Promise<string[]> {
    const { itens } = await consultarEquipe(cred, dataReferencia);
    return itens.map((i) => i.colaboradorId).sort();
  }

  // ---------------------------------------------------------------------

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
    prisma = new PrismaClient({ datasources: { db: { url: appUrl } } });
    app = await buildApp();

    const adminEmail = "admin.gestor@example.test";
    expect(
      runBootstrap({
        DATABASE_URL: appUrl,
        ADMIN_BOOTSTRAP_EMAIL: adminEmail,
        ADMIN_BOOTSTRAP_PASSWORD: SENHA_PADRAO,
      }).status,
    ).toBe(0);
    master = await seedMaster("master.gestor@example.test");

    // --- Estrutura ------------------------------------------------------
    empresaA = (
      await post("/v1/empresas", master)
        .send({ codigo: "EMP_GST_UM", nome: "Empresa Sintetica Gestor Um" })
        .expect(201)
    ).body.id;
    empresaB = (
      await post("/v1/empresas", master)
        .send({ codigo: "EMP_GST_DOIS", nome: "Empresa Sintetica Gestor Dois" })
        .expect(201)
    ).body.id;

    departamentoA = (
      await post("/v1/departamentos", master)
        .send({
          empresaId: empresaA,
          codigo: "DEP_GST_UM",
          nome: "Departamento Sintetico Um",
        })
        .expect(201)
    ).body.id;
    departamentoB = (
      await post("/v1/departamentos", master)
        .send({
          empresaId: empresaB,
          codigo: "DEP_GST_DOIS",
          nome: "Departamento Sintetico Dois",
        })
        .expect(201)
    ).body.id;

    equipeAlfa = await criarEquipe(
      "EQP_ALFA",
      "Equipe Sintetica Alfa",
      departamentoA,
    );
    equipeBeta = await criarEquipe(
      "EQP_BETA",
      "Equipe Sintetica Beta",
      departamentoA,
    );
    equipeFora = await criarEquipe(
      "EQP_FORA",
      "Equipe Sintetica Fora",
      departamentoA,
    );
    equipeConcorrencia = await criarEquipe(
      "EQP_CONC",
      "Equipe Sintetica Concorrente",
      departamentoA,
    );
    equipeVigencia = await criarEquipe(
      "EQP_VIG",
      "Equipe Sintetica Vigencia",
      departamentoA,
    );
    equipeAdmin = await criarEquipe(
      "EQP_ADM",
      "Equipe Sintetica Administrada",
      departamentoA,
    );
    equipeHistorico = await criarEquipe(
      "EQP_HIST",
      "Equipe Sintetica Historico",
      departamentoA,
    );
    equipeAuditoria = await criarEquipe(
      "EQP_AUD",
      "Equipe Sintetica Trilha",
      departamentoA,
    );
    equipeB = await criarEquipe(
      "EQP_B_UM",
      "Equipe Sintetica da Outra Empresa",
      departamentoB,
    );

    // --- Contas ---------------------------------------------------------
    rhA = await criarUsuario("rh.um.gestor@example.test", "rh", empresaA);
    rhB = await criarUsuario("rh.dois.gestor@example.test", "rh", empresaB);
    gestorPrincipal = await criarUsuario(
      "gestor.principal@example.test",
      "gestor",
      empresaA,
    );
    gestorSubstituto = await criarUsuario(
      "gestor.substituto@example.test",
      "gestor",
      empresaA,
    );
    gestorExcecao = await criarUsuario(
      "gestor.excecao@example.test",
      "gestor",
      empresaA,
    );
    gestorVigencia = await criarUsuario(
      "gestor.vigencia@example.test",
      "gestor",
      empresaA,
    );
    gestorSemLigacao = await criarUsuario(
      "gestor.sem.ligacao@example.test",
      "gestor",
      empresaA,
    );
    gestorB = await criarUsuario(
      "gestor.outra.empresa@example.test",
      "gestor",
      empresaB,
    );

    // --- Pessoas --------------------------------------------------------
    // As quatro pessoas-gestoras ficam lotadas apenas no departamento: sem
    // equipe, elas nao aparecem na propria consulta, o que mantem os conjuntos
    // comparados nos cenarios 3, 4 e 6 livres de ruido.
    pessoaGestorPrincipal = await criarColaboradorComVinculo(rhA, {
      nome: "Gestora Sintetica Principal",
      empresaId: empresaA,
      matricula: "MAT-GST-PRI",
      departamentoId: departamentoA,
    });
    pessoaGestorSubstituto = await criarColaboradorComVinculo(rhA, {
      nome: "Gestora Sintetica Substituta",
      empresaId: empresaA,
      matricula: "MAT-GST-SUB",
      departamentoId: departamentoA,
    });
    pessoaGestorExcecao = await criarColaboradorComVinculo(rhA, {
      nome: "Gestora Sintetica das Excecoes",
      empresaId: empresaA,
      matricula: "MAT-GST-EXC",
      departamentoId: departamentoA,
    });
    pessoaGestorVigencia = await criarColaboradorComVinculo(rhA, {
      nome: "Gestora Sintetica da Vigencia",
      empresaId: empresaA,
      matricula: "MAT-GST-VIG",
      departamentoId: departamentoA,
    });

    pessoaAlfa = await criarColaboradorComVinculo(rhA, {
      nome: "Pessoa Sintetica Alfa",
      empresaId: empresaA,
      matricula: "MAT-ALFA",
      departamentoId: departamentoA,
      equipeId: equipeAlfa,
    });
    pessoaBeta = await criarColaboradorComVinculo(rhA, {
      nome: "Pessoa Sintetica Beta",
      empresaId: empresaA,
      matricula: "MAT-BETA",
      departamentoId: departamentoA,
      equipeId: equipeBeta,
    });
    pessoaFora = await criarColaboradorComVinculo(rhA, {
      nome: "Pessoa Sintetica de Fora",
      empresaId: empresaA,
      matricula: "MAT-FORA",
      departamentoId: departamentoA,
      equipeId: equipeFora,
    });
    pessoaMovel = await criarColaboradorComVinculo(rhA, {
      nome: "Pessoa Sintetica Movel",
      empresaId: empresaA,
      matricula: "MAT-MOVEL",
      departamentoId: departamentoA,
      equipeId: equipeAlfa,
    });
    pessoaExcecaoPassada = await criarColaboradorComVinculo(rhA, {
      nome: "Pessoa Sintetica da Excecao Passada",
      empresaId: empresaA,
      matricula: "MAT-EXC-PAS",
      departamentoId: departamentoA,
      equipeId: equipeFora,
    });
    pessoaExcecaoAtual = await criarColaboradorComVinculo(rhA, {
      nome: "Pessoa Sintetica da Excecao Atual",
      empresaId: empresaA,
      matricula: "MAT-EXC-ATU",
      departamentoId: departamentoA,
      equipeId: equipeFora,
    });
    pessoaVigencia = await criarColaboradorComVinculo(rhA, {
      nome: "Pessoa Sintetica da Vigencia",
      empresaId: empresaA,
      matricula: "MAT-VIG",
      departamentoId: departamentoA,
      equipeId: equipeVigencia,
    });

    pessoaGestorB = await criarColaboradorComVinculo(rhB, {
      nome: "Gestora Sintetica da Outra Empresa",
      empresaId: empresaB,
      matricula: "MAT-GST-OUT",
      departamentoId: departamentoB,
    });
    pessoaEmpresaB = await criarColaboradorComVinculo(rhB, {
      nome: "Pessoa Sintetica da Outra Empresa",
      empresaId: empresaB,
      matricula: "MAT-OUT",
      departamentoId: departamentoB,
      equipeId: equipeB,
    });

    // --- Escopo base ----------------------------------------------------
    // Ligacoes conta -> pessoa (DP-23). `gestorSemLigacao` fica de fora de
    // proposito: e o controle do cenario 2.
    await ligar(
      rhA,
      gestorPrincipal.userId,
      pessoaGestorPrincipal.colaboradorId,
    ).expect(201);
    await ligar(
      rhA,
      gestorSubstituto.userId,
      pessoaGestorSubstituto.colaboradorId,
    ).expect(201);
    await ligar(
      rhA,
      gestorExcecao.userId,
      pessoaGestorExcecao.colaboradorId,
    ).expect(201);
    await ligar(
      rhA,
      gestorVigencia.userId,
      pessoaGestorVigencia.colaboradorId,
    ).expect(201);
    await ligar(rhB, gestorB.userId, pessoaGestorB.colaboradorId).expect(201);

    // Principal e substituto cobrem EXATAMENTE as mesmas duas equipes: e o que
    // torna o cenario 6 uma comparacao de conjuntos, nao de contagens.
    await atribuir(rhA, {
      equipeId: equipeAlfa,
      gestorColaboradorId: pessoaGestorPrincipal.colaboradorId,
      papel: "principal",
    }).expect(201);
    await atribuir(rhA, {
      equipeId: equipeBeta,
      gestorColaboradorId: pessoaGestorPrincipal.colaboradorId,
      papel: "principal",
    }).expect(201);
    await atribuir(rhA, {
      equipeId: equipeAlfa,
      gestorColaboradorId: pessoaGestorSubstituto.colaboradorId,
      papel: "substituto",
    }).expect(201);
    await atribuir(rhA, {
      equipeId: equipeBeta,
      gestorColaboradorId: pessoaGestorSubstituto.colaboradorId,
      papel: "substituto",
    }).expect(201);

    await atribuir(rhB, {
      equipeId: equipeB,
      gestorColaboradorId: pessoaGestorB.colaboradorId,
      papel: "principal",
    }).expect(201);
  });

  afterAll(async () => {
    await app?.close();
    await prisma?.$disconnect();
    await container?.stop();
  });

  // -------------------------------------------------------------------------
  // 1. Mesma empresa
  // -------------------------------------------------------------------------
  it("1. liga conta a colaborador so dentro da empresa do ator", async () => {
    // Uma ligacao que cruza empresas criaria um escopo de gestor nascido fora
    // da propria empresa — o pior tipo de vazamento, porque nenhuma consulta
    // posterior teria como notar. O 404 (e nao 403) e deliberado: dizer "existe,
    // mas nao e seu" ja entregaria a existencia da pessoa alheia.
    await ligar(
      rhA,
      gestorSemLigacao.userId,
      pessoaEmpresaB.colaboradorId,
    ).expect(404);

    // Porta oposta: conta de outra empresa, pessoa da empresa do ator.
    await ligar(rhA, gestorB.userId, pessoaAlfa.colaboradorId).expect(404);

    // Controle positivo: dentro da empresa, a mesma operacao e aceita.
    const aceita = await ligar(
      rhA,
      gestorSemLigacao.userId,
      pessoaAlfa.colaboradorId,
      "2026-09-01",
    ).expect(201);
    expect(aceita.body.vigenciaInicio).toBe("2026-09-01");
    // Encerra na sequencia para que o cenario 2 continue valendo em DATA_REF
    // (a ligacao comeca depois dele, mas o encerramento deixa o estado limpo).
    await patch(
      `/v1/gestor/administracao/ligacoes/${aceita.body.id}/encerrar`,
      rhA,
    )
      .send({ vigenciaFim: "2026-09-02" })
      .expect(200);
  });

  // -------------------------------------------------------------------------
  // 2. Conta sem colaborador
  // -------------------------------------------------------------------------
  it("2. gestor sem ligacao vigente recebe lista VAZIA, nunca a empresa inteira", async () => {
    // Este e o cenario que separa "filtro de autorizacao" de "vazamento": o
    // modo classico de falha e um `where` que, sem escopo resolvido, deixa de
    // filtrar e devolve tudo. Aqui a resposta correta e o conjunto vazio.
    const corpo = await consultarEquipe(gestorSemLigacao, DATA_REF);
    expect(corpo.itens).toEqual([]);
    expect(corpo.dataReferencia).toBe(DATA_REF);
  });

  // -------------------------------------------------------------------------
  // 3. Multiplas equipes
  // -------------------------------------------------------------------------
  it("3. gestor com duas equipes enxerga gente das duas", async () => {
    // A ADR 0015 (decisao 2) admite varias equipes por gestor. Se a resolucao
    // de escopo parasse na primeira atribuicao encontrada, metade da equipe
    // desapareceria sem erro nenhum — falha silenciosa.
    const visiveis = await colaboradoresVisiveis(gestorPrincipal, DATA_REF);
    expect(visiveis).toContain(pessoaAlfa.colaboradorId);
    expect(visiveis).toContain(pessoaBeta.colaboradorId);
  });

  // -------------------------------------------------------------------------
  // 4. Dentro e fora da equipe
  // -------------------------------------------------------------------------
  it("4. ve quem esta na equipe atribuida e nao ve quem esta fora dela", async () => {
    // A fronteira do escopo e a EQUIPE, nao o departamento: as tres pessoas
    // deste teste compartilham o mesmo departamento de proposito, para que a
    // unica diferenca entre ser visto e nao ser visto seja a equipe.
    const visiveis = await colaboradoresVisiveis(gestorPrincipal, DATA_REF);
    expect(visiveis).toContain(pessoaAlfa.colaboradorId);
    expect(visiveis).not.toContain(pessoaFora.colaboradorId);
    // A propria gestora nao tem equipe: tampouco aparece.
    expect(visiveis).not.toContain(pessoaGestorPrincipal.colaboradorId);
  });

  // -------------------------------------------------------------------------
  // 5. Mudanca de alocacao altera o acesso
  // -------------------------------------------------------------------------
  it("5. mover o colaborador para outra equipe o retira do escopo", async () => {
    // O escopo acompanha a ALOCACAO VIGENTE, nao um retrato tirado na
    // atribuicao. Sem isto, quem muda de area continuaria exposto ao gestor
    // antigo indefinidamente — e o historico diria que estava tudo certo.
    const antesDaMudanca = await colaboradoresVisiveis(
      gestorPrincipal,
      DATA_REF_ANTES,
    );
    expect(antesDaMudanca).toContain(pessoaMovel.colaboradorId);

    await movimentar(rhA, {
      vinculoId: pessoaMovel.vinculoId,
      tipo: "transferencia_organizacional",
      motivoCodigo: "realocacao_interna",
      vigenciaInicio: TRANSFERENCIA,
      departamentoId: departamentoA,
      equipeId: equipeFora,
    });

    // Antes da transferencia a visao historica nao muda: a alocacao anterior
    // continua gravada e continua valendo naquela data.
    expect(
      await colaboradoresVisiveis(gestorPrincipal, DATA_REF_ANTES),
    ).toContain(pessoaMovel.colaboradorId);
    // No dia da transferencia o limite superior e exclusivo: ja vale a nova.
    expect(
      await colaboradoresVisiveis(gestorPrincipal, TRANSFERENCIA),
    ).not.toContain(pessoaMovel.colaboradorId);
    expect(
      await colaboradoresVisiveis(gestorPrincipal, DATA_REF),
    ).not.toContain(pessoaMovel.colaboradorId);
  });

  // -------------------------------------------------------------------------
  // 6. Principal e substituto
  // -------------------------------------------------------------------------
  it("6. principal e substituto enxergam exatamente o mesmo conjunto", async () => {
    // Cobertura que enxerga menos nao cobre (ADR 0015, decisao 4). A diferenca
    // entre os dois papeis e de REGISTRO — quem respondia pela equipe e
    // quando —, nunca de visibilidade.
    const doPrincipal = await vinculosVisiveis(gestorPrincipal, DATA_REF);
    const doSubstituto = await vinculosVisiveis(gestorSubstituto, DATA_REF);
    expect(doSubstituto).toEqual(doPrincipal);
    expect(doPrincipal.length).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // 7. Vigencia futura, atual e encerrada
  // -------------------------------------------------------------------------
  it("7. atribuicao futura nao da acesso, vigente da, e encerrada deixa de dar", async () => {
    // Acesso tem comeco e fim. Uma atribuicao cadastrada com antecedencia nao
    // pode valer antes da hora, e uma encerrada nao pode sobreviver ao proprio
    // fim — e os dois erros sao invisiveis sem consulta datada.
    await atribuir(rhA, {
      equipeId: equipeVigencia,
      gestorColaboradorId: pessoaGestorVigencia.colaboradorId,
      papel: "principal",
      vigenciaInicio: "2026-05-01",
      vigenciaFim: "2026-06-01",
    }).expect(201);

    // Futura: a atribuicao existe no cadastro, mas ainda nao comecou.
    expect(await colaboradoresVisiveis(gestorVigencia, "2026-04-30")).toEqual(
      [],
    );
    // Vigente: inicio inclusivo.
    expect(await colaboradoresVisiveis(gestorVigencia, "2026-05-01")).toEqual([
      pessoaVigencia.colaboradorId,
    ]);
    expect(await colaboradoresVisiveis(gestorVigencia, "2026-05-15")).toEqual([
      pessoaVigencia.colaboradorId,
    ]);
    // Encerrada: fim exclusivo, entao no proprio dia do fim ja nao vale.
    expect(await colaboradoresVisiveis(gestorVigencia, "2026-06-01")).toEqual(
      [],
    );
    expect(await colaboradoresVisiveis(gestorVigencia, DATA_REF)).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // 8. Dois principais vigentes
  // -------------------------------------------------------------------------
  it("8. recusa um SEGUNDO principal vigente na mesma equipe (409)", async () => {
    // O piloto nao admite gestao matricial permanente (ADR 0015, decisao 5).
    // Dois principais simultaneos significariam duas cadeias de
    // responsabilidade sobre as mesmas pessoas, sem criterio de desempate.
    const conflito = await atribuir(rhA, {
      equipeId: equipeAlfa,
      gestorColaboradorId: pessoaFora.colaboradorId,
      papel: "principal",
    }).expect(409);
    // A mensagem e generica de proposito: detalhar qual atribuicao colidiu
    // revelaria a configuracao da equipe a quem perguntou.
    expect(JSON.stringify(conflito.body)).not.toContain(
      pessoaGestorPrincipal.colaboradorId,
    );
  });

  // -------------------------------------------------------------------------
  // 9. Dois substitutos vigentes
  // -------------------------------------------------------------------------
  it("9. recusa um SEGUNDO substituto vigente na mesma equipe (409)", async () => {
    // Mesma invariante do cenario 8, do outro lado do enum: `papel` entra na
    // chave de exclusao, de modo que principal e substituto coexistem, mas
    // dois do mesmo papel nao.
    await atribuir(rhA, {
      equipeId: equipeAlfa,
      gestorColaboradorId: pessoaFora.colaboradorId,
      papel: "substituto",
    }).expect(409);

    // Controle positivo: o papel OPOSTO na mesma equipe ja existe e continua
    // valido — a recusa acima e sobre duplicidade, nao sobre a equipe.
    const atribuicoes = await get(
      `/v1/gestor/administracao/atribuicoes?equipeId=${equipeAlfa}`,
      rhA,
    ).expect(200);
    const vigentes = (
      atribuicoes.body as { papel: string; vigenciaFim: string | null }[]
    ).filter((a) => a.vigenciaFim === null);
    expect(vigentes.map((a) => a.papel).sort()).toEqual([
      "principal",
      "substituto",
    ]);
  });

  // -------------------------------------------------------------------------
  // 10. Concorrencia
  // -------------------------------------------------------------------------
  it("10. duas criacoes simultaneas de principal: exatamente UMA cria", async () => {
    // Checar-antes-de-inserir nao resolve corrida: entre a leitura e a escrita
    // cabe outra transacao. Quem garante aqui e a EXCLUSION CONSTRAINT do
    // banco, e e exatamente isso que este teste exercita — sem ele, a
    // invariante do cenario 8 valeria so em carga baixa.
    const corpo = {
      equipeId: equipeConcorrencia,
      gestorColaboradorId: pessoaFora.colaboradorId,
      papel: "principal",
      vigenciaInicio: INICIO_ESCOPO,
    };

    const respostas = await Promise.all([
      post("/v1/gestor/administracao/atribuicoes", rhA).send(corpo),
      post("/v1/gestor/administracao/atribuicoes", rhA).send(corpo),
    ]);

    expect(respostas.filter((r) => r.status === 201).length).toBe(1);
    expect(respostas.filter((r) => r.status === 409).length).toBe(1);

    // E o banco guarda uma linha so — a prova de que nada passou pelas frestas.
    const gravadas = await prisma.atribuicaoGestorEquipe.count({
      where: { equipeId: equipeConcorrencia },
    });
    expect(gravadas).toBe(1);
  });

  // -------------------------------------------------------------------------
  // 11. Excecao individual
  // -------------------------------------------------------------------------
  it("11. excecao individual: vale no prazo, nao vale fora dele e cai ao ser revogada", async () => {
    // A excecao e o unico caminho para ver alguem FORA da equipe, e por isso
    // precisa ser a coisa mais datada do modulo: prazo obrigatorio, sem
    // renovacao por inercia e revogavel na hora. `gestorExcecao` nao tem
    // nenhuma equipe atribuida — tudo o que ela enxerga vem daqui.
    expect(await colaboradoresVisiveis(gestorExcecao, DATA_REF)).toEqual([]);

    const passada = await post("/v1/gestor/administracao/excecoes", rhA)
      .send({
        gestorColaboradorId: pessoaGestorExcecao.colaboradorId,
        vinculoId: pessoaExcecaoPassada.vinculoId,
        motivoCodigo: "cobertura_de_ausencia",
        justificativa: "Cobertura sintetica de ausencia, apenas para teste.",
        vigenciaInicio: "2026-06-01",
        vigenciaFim: "2026-07-01",
      })
      .expect(201);
    expect(passada.body.vigenciaInicio).toBe("2026-06-01");
    expect(passada.body.vigenciaFim).toBe("2026-07-01");
    expect(passada.body.encerradaEm).toBeNull();

    // Futura: ainda nao comecou.
    expect(await colaboradoresVisiveis(gestorExcecao, "2026-05-31")).toEqual(
      [],
    );
    // Vigente: ve a pessoa de FORA da equipe, e so ela.
    expect(await colaboradoresVisiveis(gestorExcecao, DATA_REF)).toEqual([
      pessoaExcecaoPassada.colaboradorId,
    ]);
    // Expirada: fim exclusivo.
    expect(await colaboradoresVisiveis(gestorExcecao, "2026-07-01")).toEqual(
      [],
    );
    expect(await colaboradoresVisiveis(gestorExcecao, "2026-08-01")).toEqual(
      [],
    );

    // Revogacao: so e observavel numa data em que a excecao AINDA valeria,
    // senao o teste confundiria "revogada" com "expirada".
    const atual = await post("/v1/gestor/administracao/excecoes", rhA)
      .send({
        gestorColaboradorId: pessoaGestorExcecao.colaboradorId,
        vinculoId: pessoaExcecaoAtual.vinculoId,
        motivoCodigo: "apuracao_formal",
        justificativa: "Apuracao sintetica em curso, apenas para teste.",
        vigenciaInicio: "2026-09-01",
        vigenciaFim: "2026-12-01",
      })
      .expect(201);

    expect(await colaboradoresVisiveis(gestorExcecao, HOJE)).toEqual([
      pessoaExcecaoAtual.colaboradorId,
    ]);

    const revogada = await patch(
      `/v1/gestor/administracao/excecoes/${atual.body.id}/encerrar`,
      rhA,
    )
      .send()
      .expect(200);
    expect(revogada.body.encerradaEm).not.toBeNull();
    // O periodo original permanece gravado: revogar encurta o alcance, nao
    // reescreve o que foi concedido.
    expect(revogada.body.vigenciaInicio).toBe("2026-09-01");
    expect(revogada.body.vigenciaFim).toBe("2026-12-01");

    expect(await colaboradoresVisiveis(gestorExcecao, HOJE)).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // 12. Vinculo multiplo
  // -------------------------------------------------------------------------
  it("12. colaborador com dois vinculos: so aparece o da equipe atribuida", async () => {
    // O sujeito do escopo e o VINCULO, nao a pessoa. Uma mesma pessoa pode ter
    // passado por equipes diferentes; tratar "pessoa" como unidade faria o
    // gestor herdar o vinculo errado — e, no limite, um vinculo que nunca
    // esteve sob sua responsabilidade.
    const primeiro = await criarColaboradorComVinculo(rhA, {
      nome: "Pessoa Sintetica de Dois Vinculos",
      empresaId: empresaA,
      matricula: "MAT-DUP-UM",
      departamentoId: departamentoA,
      equipeId: equipeFora,
    });

    // Em 2026-02-01 existe um unico vinculo, ativo, e ele esta FORA da equipe
    // da gestora: invisivel.
    expect(
      await colaboradoresVisiveis(gestorPrincipal, INICIO_ESCOPO),
    ).not.toContain(primeiro.colaboradorId);

    await movimentar(rhA, {
      vinculoId: primeiro.vinculoId,
      tipo: "desligamento",
      motivoCodigo: "encerramento_de_vinculo",
      vigenciaInicio: "2026-03-01",
    });

    const segundoVinculo = (
      await post("/v1/vinculos", rhA)
        .send({
          colaboradorId: primeiro.colaboradorId,
          empresaId: empresaA,
          matricula: "MAT-DUP-DOIS",
          tipo: "clt",
          dataAdmissao: "2026-03-02",
          motivoCodigo: "admissao_inicial",
          departamentoId: departamentoA,
          equipeId: equipeAlfa,
        })
        .expect(201)
    ).body.id as string;
    await efetivarAdmissao(rhA, segundoVinculo);

    const itens = (await consultarEquipe(gestorPrincipal, DATA_REF)).itens;
    const daPessoa = itens.filter(
      (i) => i.colaboradorId === primeiro.colaboradorId,
    );
    expect(daPessoa).toHaveLength(1);
    expect(daPessoa[0]!.vinculoId).toBe(segundoVinculo);
    expect(daPessoa[0]!.matricula).toBe("MAT-DUP-DOIS");
    expect(itens.map((i) => i.vinculoId)).not.toContain(primeiro.vinculoId);
  });

  // -------------------------------------------------------------------------
  // 13. Outra empresa
  // -------------------------------------------------------------------------
  it("13. gestor da empresa A nao enxerga ninguem da empresa B, e vice-versa", async () => {
    // A empresa vem da SESSAO, nunca do cliente, e a consulta repete o filtro
    // de empresa mesmo depois de o escopo ja estar resolvido. Redundancia
    // deliberada: um erro na resolucao nao pode virar leitura entre empresas.
    const daEmpresaA = await colaboradoresVisiveis(gestorPrincipal, DATA_REF);
    expect(daEmpresaA).not.toContain(pessoaEmpresaB.colaboradorId);
    expect(daEmpresaA).not.toContain(pessoaGestorB.colaboradorId);

    const daEmpresaB = await colaboradoresVisiveis(gestorB, DATA_REF);
    expect(daEmpresaB).toEqual([pessoaEmpresaB.colaboradorId]);
    expect(daEmpresaB).not.toContain(pessoaAlfa.colaboradorId);
    expect(daEmpresaB).not.toContain(pessoaBeta.colaboradorId);
  });

  // -------------------------------------------------------------------------
  // 14. Anti-enumeracao
  // -------------------------------------------------------------------------
  it("14. detalhe de vinculo fora do escopo responde 404, nunca 403", async () => {
    // 403 confirmaria que o vinculo existe. A diferenca entre "nao existe" e
    // "existe, mas nao e seu" e exatamente o que a anti-enumeracao precisa
    // esconder — caso contrario um gestor varre identificadores e descobre
    // quem trabalha na empresa, mesmo sem ler nenhum dado.
    const dentro = await get(
      `/v1/gestor/equipe/vinculos/${pessoaAlfa.vinculoId}?dataReferencia=${DATA_REF}`,
      gestorPrincipal,
    ).expect(200);
    expect(dentro.body.vinculoId).toBe(pessoaAlfa.vinculoId);

    // Outra equipe, mesma empresa.
    await get(
      `/v1/gestor/equipe/vinculos/${pessoaFora.vinculoId}?dataReferencia=${DATA_REF}`,
      gestorPrincipal,
    ).expect(404);
    // Outra empresa.
    await get(
      `/v1/gestor/equipe/vinculos/${pessoaEmpresaB.vinculoId}?dataReferencia=${DATA_REF}`,
      gestorPrincipal,
    ).expect(404);
    // Identificador bem formado e inexistente: resposta indistinguivel das
    // duas acima, que e o ponto.
    await get(
      `/v1/gestor/equipe/vinculos/00000000-0000-4000-8000-000000000000?dataReferencia=${DATA_REF}`,
      gestorPrincipal,
    ).expect(404);
  });

  // -------------------------------------------------------------------------
  // 15. Gestor nao muta
  // -------------------------------------------------------------------------
  it("15. gestor nao administra o proprio escopo e nao tem rota de mutacao", async () => {
    // Quem define o escopo nao pode ser quem e escopado por ele. Se o gestor
    // pudesse atribuir a si mesmo mais uma equipe, o controle de acesso seria
    // decorativo. As duas camadas sao verificadas: o RBAC nega o recurso
    // administrativo, e a superficie de consulta simplesmente nao tem verbo
    // de escrita — esconder botao na interface nao e controle de acesso.
    await atribuir(gestorPrincipal, {
      equipeId: equipeFora,
      gestorColaboradorId: pessoaGestorPrincipal.colaboradorId,
      papel: "principal",
    }).expect(403);

    await ligar(
      gestorPrincipal,
      gestorPrincipal.userId,
      pessoaAlfa.colaboradorId,
    ).expect(403);

    await post("/v1/gestor/administracao/excecoes", gestorPrincipal)
      .send({
        gestorColaboradorId: pessoaGestorPrincipal.colaboradorId,
        vinculoId: pessoaFora.vinculoId,
        motivoCodigo: "projeto_temporario",
        justificativa: "Tentativa sintetica de autoconcessao.",
        vigenciaInicio: "2026-06-01",
        vigenciaFim: "2026-07-01",
      })
      .expect(403);

    await get("/v1/gestor/administracao/atribuicoes", gestorPrincipal).expect(
      403,
    );

    // Nao existe mutacao em `/v1/gestor/equipe`: a rota nao esta mapeada.
    await post("/v1/gestor/equipe", gestorPrincipal).send({}).expect(404);
    await patch(
      `/v1/gestor/equipe/vinculos/${pessoaAlfa.vinculoId}`,
      gestorPrincipal,
    )
      .send({})
      .expect(404);
  });

  // -------------------------------------------------------------------------
  // 16. RH autorizado
  // -------------------------------------------------------------------------
  it("16. RH administra o escopo dentro da propria empresa", async () => {
    // Contrapartida do cenario 15: a negacao ao gestor so prova alguma coisa
    // se o ator correto for aceito pela mesma rota.
    const criada = await atribuir(rhA, {
      equipeId: equipeAdmin,
      gestorColaboradorId: pessoaGestorPrincipal.colaboradorId,
      papel: "principal",
    }).expect(201);

    expect(criada.body.equipeId).toBe(equipeAdmin);
    expect(criada.body.papel).toBe("principal");
    expect(criada.body.vigenciaInicio).toBe(INICIO_ESCOPO);
    expect(criada.body.vigenciaFim).toBeNull();

    const listadas = await get(
      `/v1/gestor/administracao/atribuicoes?equipeId=${equipeAdmin}`,
      rhA,
    ).expect(200);
    expect(listadas.body.map((a: { id: string }) => a.id)).toContain(
      criada.body.id,
    );

    const ligacoes = await get("/v1/gestor/administracao/ligacoes", rhA).expect(
      200,
    );
    expect(
      ligacoes.body.map((l: { colaboradorId: string }) => l.colaboradorId),
    ).toContain(pessoaGestorPrincipal.colaboradorId);
  });

  // -------------------------------------------------------------------------
  // 17. RH de outra empresa
  // -------------------------------------------------------------------------
  it("17. RH de outra empresa nao administra a empresa alheia", async () => {
    // A empresa do ator vem da sessao e NUNCA do corpo da requisicao. Se
    // viesse do corpo, bastaria trocar um identificador para administrar o
    // escopo de gestor de outra empresa.
    await atribuir(rhB, {
      equipeId: equipeAdmin,
      gestorColaboradorId: pessoaGestorPrincipal.colaboradorId,
      papel: "substituto",
    }).expect(404);

    await ligar(rhB, gestorPrincipal.userId, pessoaAlfa.colaboradorId).expect(
      404,
    );

    await post("/v1/gestor/administracao/excecoes", rhB)
      .send({
        gestorColaboradorId: pessoaGestorPrincipal.colaboradorId,
        vinculoId: pessoaAlfa.vinculoId,
        motivoCodigo: "transicao_organizacional",
        justificativa: "Tentativa sintetica de alcance entre empresas.",
        vigenciaInicio: "2026-06-01",
        vigenciaFim: "2026-07-01",
      })
      .expect(404);

    // Ler tambem e escopado: a listagem do RH alheio e vazia, nao proibida —
    // a empresa do filtro e sempre a do ator.
    const atribuicoes = await get(
      `/v1/gestor/administracao/atribuicoes?equipeId=${equipeAlfa}`,
      rhB,
    ).expect(200);
    expect(atribuicoes.body).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // 18. Historico imutavel
  // -------------------------------------------------------------------------
  it("18. encerrar uma atribuicao preenche a vigencia e NAO apaga a linha", async () => {
    // "Quem respondia por esta equipe em marco?" e a pergunta que uma
    // auditoria faz. Apagar a atribuicao encerrada responderia "ninguem", que
    // e falso — por isso nao existe rota DELETE e encerrar e sempre preencher
    // `vigencia_fim`.
    const criada = await atribuir(rhA, {
      equipeId: equipeHistorico,
      gestorColaboradorId: pessoaGestorSubstituto.colaboradorId,
      papel: "principal",
    }).expect(201);

    const encerrada = await patch(
      `/v1/gestor/administracao/atribuicoes/${criada.body.id}/encerrar`,
      rhA,
    )
      .send({ vigenciaFim: "2026-08-01" })
      .expect(200);
    expect(encerrada.body.vigenciaFim).toBe("2026-08-01");
    expect(encerrada.body.vigenciaInicio).toBe(INICIO_ESCOPO);

    const listadas = await get(
      `/v1/gestor/administracao/atribuicoes?equipeId=${equipeHistorico}`,
      rhA,
    ).expect(200);
    const historica = (
      listadas.body as { id: string; vigenciaFim: string | null }[]
    ).find((a) => a.id === criada.body.id);
    expect(historica).toBeDefined();
    expect(historica!.vigenciaFim).toBe("2026-08-01");

    // Encerrar duas vezes nao e idempotente nem silencioso: a segunda tentativa
    // nao encontra atribuicao ABERTA para encerrar.
    await patch(
      `/v1/gestor/administracao/atribuicoes/${criada.body.id}/encerrar`,
      rhA,
    )
      .send({ vigenciaFim: "2026-09-01" })
      .expect(404);
  });

  // -------------------------------------------------------------------------
  // 19. Projecao fechada
  // -------------------------------------------------------------------------
  it("19. a consulta do gestor nao devolve nenhum campo fora da projecao", async () => {
    // A decisao 7 fechou o que o gestor ve. Uma projecao aberta ("tudo do
    // vinculo") vazaria por acrescimo futuro: bastaria uma coluna nova no
    // modelo para o gestor passar a ver remuneracao ou dado clinico sem que
    // ninguem tivesse decidido isso.
    const lista = await get(
      `/v1/gestor/equipe?dataReferencia=${DATA_REF}`,
      gestorPrincipal,
    ).expect(200);
    const detalhe = await get(
      `/v1/gestor/equipe/vinculos/${pessoaAlfa.vinculoId}?dataReferencia=${DATA_REF}`,
      gestorPrincipal,
    ).expect(200);

    const serializado = (
      JSON.stringify(lista.body) + JSON.stringify(detalhe.body)
    ).toLowerCase();
    for (const proibido of CAMPOS_PROIBIDOS) {
      expect(serializado).not.toContain(proibido);
    }

    // Projecao fechada tambem pela positiva: acrescentar campo aqui precisa
    // ser decisao, e quebrar este teste e o aviso de que foi tomada.
    const item = lista.body.itens[0];
    expect(Object.keys(item).sort()).toEqual(
      [
        "cargoVigente",
        "colaboradorId",
        "dataAdmissao",
        "dataDesligamento",
        "lotacaoVigente",
        "matricula",
        "nome",
        "situacaoVinculo",
        "tipoVinculo",
        "vinculoId",
      ].sort(),
    );
    // `situacao` do COLABORADOR e agregada de todos os vinculos, inclusive de
    // outras empresas — sairia dela a existencia de vinculo alheio.
    expect(item).not.toHaveProperty("situacao");

    expect(Object.keys(detalhe.body).sort()).toEqual(
      [
        "andamentoSolicitacoes",
        "cargoVigente",
        "colaboradorId",
        "dataAdmissao",
        "dataReferencia",
        "dataDesligamento",
        "horarioVigente",
        "lotacaoVigente",
        "matricula",
        "nome",
        "resumoJornada",
        "situacaoVinculo",
        "tipoVinculo",
        "vinculoId",
      ].sort(),
    );
  });

  // -------------------------------------------------------------------------
  // 20. Auditoria
  // -------------------------------------------------------------------------
  it("20. toda mutacao de atribuicao deixa evento na trilha", async () => {
    // Uma concessao de acesso sem trilha e pior que uma concessao que falhou:
    // a auditoria precisa responder QUEM concedeu a QUEM, e quando. O evento e
    // gravado na MESMA transacao da mutacao, entao trilha e efeito vivem ou
    // morrem juntos.
    const criada = await atribuir(rhA, {
      equipeId: equipeAuditoria,
      gestorColaboradorId: pessoaGestorExcecao.colaboradorId,
      papel: "principal",
    }).expect(201);

    const eventos = await prisma.auditEvent.findMany({
      where: { resourceId: criada.body.id as string },
    });
    expect(eventos).toHaveLength(1);
    expect(eventos[0]!.action).toBe("gestor_atribuicao_criada");
    expect(eventos[0]!.resource).toBe("atribuicao_gestor_equipe");
    expect(eventos[0]!.actorUserId).toBe(rhA.userId);
    expect(eventos[0]!.actorRole).toBe("rh");
    expect(eventos[0]!.companyId).toBe(empresaA);
    expect(eventos[0]!.result).toBe("success");

    // O valor GRAVADO no enum do banco e `gestor.atribuicao.criada` — o nome
    // em TypeScript e so o identificador do cliente Prisma.
    const brutos = await prisma.$queryRawUnsafe<{ action: string }[]>(
      `SELECT "action"::text AS action FROM app.audit_event WHERE resource_id = $1`,
      criada.body.id,
    );
    expect(brutos.map((b) => b.action)).toEqual(["gestor.atribuicao.criada"]);

    // Encerrar tambem audita, com acao propria: "quem tirou o acesso e quando"
    // e tao auditavel quanto "quem deu".
    await patch(
      `/v1/gestor/administracao/atribuicoes/${criada.body.id}/encerrar`,
      rhA,
    )
      .send({ vigenciaFim: "2026-09-01" })
      .expect(200);

    const depois = await prisma.auditEvent.findMany({
      where: { resourceId: criada.body.id as string },
      orderBy: { occurredAt: "asc" },
    });
    expect(depois.map((e) => e.action)).toEqual([
      "gestor_atribuicao_criada",
      "gestor_atribuicao_encerrada",
    ]);
  });
});
