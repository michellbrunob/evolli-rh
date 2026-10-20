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
import { CAMPOS_OBRIGATORIOS_ADMISSAO } from "./admissao-obrigatoria";

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
 * Linha do tempo sintetica, ANCORADA EM HOJE.
 *
 * Antes estas eram datas fixas (`2026-06-15` etc.) e a consulta recebia
 * `?dataReferencia=`, o que permitia ao teste "viajar no tempo" para exercitar
 * as fronteiras de vigencia. Esse parametro era uma falha de autorizacao — ele
 * deixava o cliente escolher a data em que era autorizado — e foi removido.
 *
 * As fronteiras continuam sendo exercitadas, mas pelo lado certo: o que se
 * move agora e a VIGENCIA dos registros em relacao ao dia corrente, nunca a
 * data da pergunta. Um teste que precise de "atribuicao ja encerrada" cria uma
 * atribuicao que termina ontem, em vez de perguntar sobre ontem.
 *
 * `dataLocalDe` e a mesma funcao que o service usa (`FUSO_COMPETENCIA`,
 * America/Sao_Paulo). Usar `toISOString()` aqui faria o teste discordar do
 * codigo entre 21h e 24h de Brasilia, quando UTC ja virou o dia.
 */
const HOJE = dataLocalDe(new Date());

/** `YYYY-MM-DD` a N dias de hoje (negativo = passado). */
function dia(deslocamento: number): string {
  const d = new Date(`${HOJE}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + deslocamento);
  return d.toISOString().slice(0, 10);
}

const ADMISSAO = dia(-300);
/** Inicio das ligacoes e atribuicoes "permanentes" do cenario base. */
const INICIO_ESCOPO = dia(-200);
/** Dia em que a pessoa movel muda de equipe (fim exclusivo, inicio inclusivo). */
const TRANSFERENCIA = dia(-30);

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
  /** Atribuicao reaproveitada pela serie 7: criada, encerrada e recriada. */
  let atribuicaoVigencia: string;
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
        ...CAMPOS_OBRIGATORIOS_ADMISSAO,
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

  /**
   * Consulta a equipe no estado VIGENTE. Sem parametro de data, por desenho —
   * ver a nota da linha do tempo no topo do arquivo.
   */
  async function consultarEquipe(
    cred: Credencial,
  ): Promise<{ dataReferencia: string; itens: ItemDeEquipe[] }> {
    const resposta = await get("/v1/gestor/equipe", cred).expect(200);
    return resposta.body;
  }

  async function vinculosVisiveis(cred: Credencial): Promise<string[]> {
    const { itens } = await consultarEquipe(cred);
    return itens.map((i) => i.vinculoId).sort();
  }

  async function colaboradoresVisiveis(cred: Credencial): Promise<string[]> {
    const { itens } = await consultarEquipe(cred);
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
      dia(-20),
    ).expect(201);
    expect(aceita.body.vigenciaInicio).toBe(dia(-20));
    // Encerra na sequencia para que o cenario 2 continue valendo: `gestorSemLigacao`
    // precisa seguir sem ligacao VIGENTE quando aquele teste rodar.
    await patch(
      `/v1/gestor/administracao/ligacoes/${aceita.body.id}/encerrar`,
      rhA,
    )
      .send({ vigenciaFim: dia(-19) })
      .expect(200);
  });

  // -------------------------------------------------------------------------
  // 2. Conta sem colaborador
  // -------------------------------------------------------------------------
  it("2. gestor sem ligacao vigente recebe lista VAZIA, nunca a empresa inteira", async () => {
    // Este e o cenario que separa "filtro de autorizacao" de "vazamento": o
    // modo classico de falha e um `where` que, sem escopo resolvido, deixa de
    // filtrar e devolve tudo. Aqui a resposta correta e o conjunto vazio.
    const corpo = await consultarEquipe(gestorSemLigacao);
    expect(corpo.itens).toEqual([]);
    // A data devolvida e a do SERVIDOR, sempre — e nunca uma escolhida por
    // quem perguntou.
    expect(corpo.dataReferencia).toBe(HOJE);
  });

  // -------------------------------------------------------------------------
  // 3. Multiplas equipes
  // -------------------------------------------------------------------------
  it("3. gestor com duas equipes enxerga gente das duas", async () => {
    // A ADR 0015 (decisao 2) admite varias equipes por gestor. Se a resolucao
    // de escopo parasse na primeira atribuicao encontrada, metade da equipe
    // desapareceria sem erro nenhum — falha silenciosa.
    const visiveis = await colaboradoresVisiveis(gestorPrincipal);
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
    const visiveis = await colaboradoresVisiveis(gestorPrincipal);
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
    const antesDaMudanca = await colaboradoresVisiveis(gestorPrincipal);
    expect(antesDaMudanca).toContain(pessoaMovel.colaboradorId);

    await movimentar(rhA, {
      vinculoId: pessoaMovel.vinculoId,
      tipo: "transferencia_organizacional",
      motivoCodigo: "realocacao_interna",
      vigenciaInicio: TRANSFERENCIA,
      departamentoId: departamentoA,
      equipeId: equipeFora,
    });

    // A transferencia ja esta vigente (comecou ha 30 dias), entao a pessoa
    // sai do escopo AGORA. A alocacao antiga continua gravada — o teste 18
    // prova que nada foi apagado —, mas o acesso segue o estado vigente, e
    // nao ha mais como perguntar "e antes da transferencia?" pela API.
    expect(await colaboradoresVisiveis(gestorPrincipal)).not.toContain(
      pessoaMovel.colaboradorId,
    );

    // A linha anterior continua la, com o fim exclusivo marcado no dia da
    // transferencia: o historico nao foi reescrito para produzir o efeito.
    const alocacoes = await prisma.alocacaoOrganizacional.findMany({
      where: { vinculoId: pessoaMovel.vinculoId },
      orderBy: { vigenteDe: "asc" },
      select: { equipeId: true, vigenteAte: true },
    });
    expect(alocacoes.length).toBeGreaterThanOrEqual(2);
    expect(alocacoes[0]!.vigenteAte?.toISOString().slice(0, 10)).toBe(
      TRANSFERENCIA,
    );
  });

  // -------------------------------------------------------------------------
  // 6. Principal e substituto
  // -------------------------------------------------------------------------
  it("6. principal e substituto enxergam exatamente o mesmo conjunto", async () => {
    // Cobertura que enxerga menos nao cobre (ADR 0015, decisao 4). A diferenca
    // entre os dois papeis e de REGISTRO — quem respondia pela equipe e
    // quando —, nunca de visibilidade.
    const doPrincipal = await vinculosVisiveis(gestorPrincipal);
    const doSubstituto = await vinculosVisiveis(gestorSubstituto);
    expect(doSubstituto).toEqual(doPrincipal);
    expect(doPrincipal.length).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // 7. Vigencia futura, atual e encerrada
  // -------------------------------------------------------------------------
  it("7. atribuicao VIGENTE da acesso", async () => {
    // Controle positivo da serie: sem ele, os tres testes seguintes passariam
    // mesmo se a consulta estivesse sempre vazia por outro motivo.
    const criada = await atribuir(rhA, {
      equipeId: equipeVigencia,
      gestorColaboradorId: pessoaGestorVigencia.colaboradorId,
      papel: "principal",
      vigenciaInicio: dia(-5),
    }).expect(201);
    atribuicaoVigencia = criada.body.id;

    expect(await colaboradoresVisiveis(gestorVigencia)).toEqual([
      pessoaVigencia.colaboradorId,
    ]);
  });

  it("7b. atribuicao ENCERRADA deixa de dar acesso imediatamente", async () => {
    // Fim exclusivo: encerrar com `vigenciaFim = HOJE` tira o acesso hoje
    // mesmo, nao amanha.
    await patch(
      `/v1/gestor/administracao/atribuicoes/${atribuicaoVigencia}/encerrar`,
      rhA,
    )
      .send({ vigenciaFim: HOJE })
      .expect(200);

    expect(await colaboradoresVisiveis(gestorVigencia)).toEqual([]);
  });

  it("7c. o ex-gestor NAO recupera acesso informando data da vigencia antiga", async () => {
    // ESTE e o teste da correcao de B1, e ele falha no SHA anterior.
    //
    // Antes, `escopoDoAtor` resolvia a ligacao e as atribuicoes DO PROPRIO
    // ATOR na data que o cliente mandasse, e `hoje()` era so o padrao — nunca
    // um teto. Bastava a um gestor encerrado pedir
    // `?dataReferencia=<dentro da janela antiga>` para a equipe reaparecer.
    //
    // Hoje a rota nao tem parametro e `forbidNonWhitelisted` recusa o que
    // sobrar. Recusar e melhor que ignorar: um 200 com lista vazia deixaria o
    // cliente concluir que a data foi aceita e que a equipe esvaziou.
    const dentroDaJanelaAntiga = dia(-3);

    await get(
      `/v1/gestor/equipe?dataReferencia=${dentroDaJanelaAntiga}`,
      gestorVigencia,
    ).expect(400);

    await get(
      `/v1/gestor/equipe/vinculos/${pessoaVigencia.vinculoId}?dataReferencia=${dentroDaJanelaAntiga}`,
      gestorVigencia,
    ).expect(400);

    // E, sem parametro nenhum, continua vazio: a recusa acima nao e a unica
    // defesa — mesmo que o parametro passasse, nao ha onde ele entrar.
    expect(await colaboradoresVisiveis(gestorVigencia)).toEqual([]);
  });

  it("7d. atribuicao FUTURA nao antecipa acesso, nem com data futura", async () => {
    // O periodo [dia(10), infinito) nao colide com o ja encerrado
    // [dia(-5), HOJE): a EXCLUSION aceita, e e justamente o caso de um gestor
    // que volta a responder pela equipe mais adiante.
    await atribuir(rhA, {
      equipeId: equipeVigencia,
      gestorColaboradorId: pessoaGestorVigencia.colaboradorId,
      papel: "principal",
      vigenciaInicio: dia(10),
    }).expect(201);

    expect(await colaboradoresVisiveis(gestorVigencia)).toEqual([]);
    await get(
      `/v1/gestor/equipe?dataReferencia=${dia(11)}`,
      gestorVigencia,
    ).expect(400);
  });

  it("7e. nem o SUBSTITUTO encerrado recupera acesso", async () => {
    // A mesma fronteira vale para os dois papeis: um substituto cuja
    // cobertura terminou e um ex-gestor como qualquer outro.
    const criada = await atribuir(rhA, {
      equipeId: equipeVigencia,
      gestorColaboradorId: pessoaGestorVigencia.colaboradorId,
      papel: "substituto",
      vigenciaInicio: dia(-5),
    }).expect(201);

    expect(await colaboradoresVisiveis(gestorVigencia)).toEqual([
      pessoaVigencia.colaboradorId,
    ]);

    await patch(
      `/v1/gestor/administracao/atribuicoes/${criada.body.id}/encerrar`,
      rhA,
    )
      .send({ vigenciaFim: HOJE })
      .expect(200);

    expect(await colaboradoresVisiveis(gestorVigencia)).toEqual([]);
    await get(
      `/v1/gestor/equipe?dataReferencia=${dia(-3)}`,
      gestorVigencia,
    ).expect(400);
  });

  it("7f. encerrar com fim anterior ao inicio e 409, nao 500", async () => {
    // Violacao do CHECK `*_intervalo_coerente`. Escapava como 500 porque
    // `comoConflito` so reconhecia EXCLUSION e UNIQUE — e um 500 aqui diria
    // "defeito do servidor" para o que e um pedido incoerente do cliente.
    const criada = await atribuir(rhA, {
      equipeId: equipeHistorico,
      gestorColaboradorId: pessoaGestorVigencia.colaboradorId,
      papel: "substituto",
      vigenciaInicio: dia(-5),
    }).expect(201);

    const resposta = await patch(
      `/v1/gestor/administracao/atribuicoes/${criada.body.id}/encerrar`,
      rhA,
    )
      .send({ vigenciaFim: dia(-30) })
      .expect(409);

    // E nada de Prisma, PostgreSQL ou SQLSTATE vaza na resposta.
    const texto = JSON.stringify(resposta.body);
    for (const proibido of [
      "Prisma",
      "prisma",
      "23514",
      "constraint",
      "app.",
    ]) {
      expect(texto).not.toContain(proibido);
    }
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

  // T161 — o cenario 10 rodando MUITAS vezes.
  //
  // Uma rodada so nao prova estabilidade: a corrida que derrubou a CI de
  // `main` no squash 0db3d70 aparecia em uma execucao e sumia na seguinte.
  // Repetir em equipes novas, na mesma transacao de carga, e o que separa
  // "passou" de "passa sempre".
  //
  // Foi este cenario que achou a causa: antes da correcao ele reprovava em 2
  // de 8 execucoes, e o SQLSTATE 40P01 (deadlock) aparecia exatamente nas
  // duas que falharam. Depois da repeticao limitada, ele passa — e e a prova
  // de que o perdedor da corrida volta ao caminho normal e recebe 409 pela
  // EXCLUSION, nao por traducao direta de 40P01.
  //
  // Quando um par sai do esperado, a mensagem traz os STATUS e os CORPOS das
  // duas respostas. Sem isso, a falha diz apenas "esperava 1, recebeu 0" e
  // some sem dizer o que o servidor respondeu — foi exatamente o que
  // aconteceu na CI, e custou uma investigacao inteira.
  it("10b. o cenario concorrente se repete estavel: sempre UM 201 e UM 409", async () => {
    const RODADAS = 12;

    for (let rodada = 0; rodada < RODADAS; rodada += 1) {
      const equipe = await criarEquipe(
        `EQP_CONC_R${rodada}`,
        `Equipe Sintetica Concorrente ${rodada}`,
        departamentoA,
      );

      const corpo = {
        equipeId: equipe,
        gestorColaboradorId: pessoaFora.colaboradorId,
        papel: "principal",
        vigenciaInicio: INICIO_ESCOPO,
      };

      const respostas = await Promise.all([
        post("/v1/gestor/administracao/atribuicoes", rhA).send(corpo),
        post("/v1/gestor/administracao/atribuicoes", rhA).send(corpo),
      ]);

      const observado = respostas
        .map((r) => `${r.status} ${JSON.stringify(r.body)}`)
        .join(" | ");
      const criadas = respostas.filter((r) => r.status === 201).length;
      const conflitos = respostas.filter((r) => r.status === 409).length;

      expect(`rodada ${rodada}: ${criadas} criada(s) :: ${observado}`).toBe(
        `rodada ${rodada}: 1 criada(s) :: ${observado}`,
      );
      expect(`rodada ${rodada}: ${conflitos} conflito(s) :: ${observado}`).toBe(
        `rodada ${rodada}: 1 conflito(s) :: ${observado}`,
      );

      const gravadas = await prisma.atribuicaoGestorEquipe.count({
        where: { equipeId: equipe },
      });
      expect(`rodada ${rodada}: ${gravadas} linha(s)`).toBe(
        `rodada ${rodada}: 1 linha(s)`,
      );
    }
  });

  // T161 — o conflito que demora a se resolver.
  //
  // Reproduz o mecanismo exato que derrubou a CI de `main` no squash
  // 0db3d70, e que NAO reproduz em maquina ociosa: a colisao e real, mas o
  // perdedor fica bloqueado no indice GiST esperando o vencedor commitar.
  // Enquanto espera, o relogio da transacao interativa do Prisma corre. Se a
  // espera passar do orcamento, o Prisma aborta com P2028 ANTES de o
  // PostgreSQL chegar a levantar o 23P01 — e um conflito legitimo vira 500.
  //
  // Aqui a contencao e forcada, entao o cenario e deterministico: um
  // escritor segura a chave por mais tempo que o orcamento padrao de 5s.
  //
  // Medido na T161: esta hipotese NAO era a causa da falha de `main` — com
  // 9s de contencao a resposta ja era 409. O cenario fica como guarda: se
  // alguem encurtar o orcamento da transacao, ou puser um `sleep` dentro
  // dela, o conflito legitimo volta a virar 500 e este teste reprova.
  it("10c. conflito que demora a se resolver ainda responde 409, nunca 500", async () => {
    const equipe = await criarEquipe(
      "EQP_CONC_LENTA",
      "Equipe Sintetica Concorrente Lenta",
      departamentoA,
    );

    let liberar: () => void = () => {};
    const segurado = new Promise<void>((resolver) => {
      liberar = resolver;
    });

    // Escritor que vence a corrida e demora a commitar.
    const segurador = prisma.$transaction(
      async (tx) => {
        await tx.atribuicaoGestorEquipe.create({
          data: {
            empresaId: empresaA,
            equipeId: equipe,
            gestorColaboradorId: pessoaFora.colaboradorId,
            papel: "principal",
            vigenciaInicio: new Date(`${INICIO_ESCOPO}T00:00:00.000Z`),
            criadoPorUserId: rhA.userId,
          },
        });
        await segurado;
      },
      { timeout: 120_000, maxWait: 120_000 },
    );

    // Deixa o escritor pegar a chave antes de o perdedor tentar.
    await new Promise((r) => setTimeout(r, 500));

    const pedido = post("/v1/gestor/administracao/atribuicoes", rhA).send({
      equipeId: equipe,
      gestorColaboradorId: pessoaFora.colaboradorId,
      papel: "principal",
      vigenciaInicio: INICIO_ESCOPO,
    });

    // Segura bem alem do orcamento padrao da transacao interativa (5s).
    await new Promise((r) => setTimeout(r, 9_000));
    liberar();
    await segurador;

    const resposta = await pedido;

    // Mensagem com corpo: se voltar a falhar, o relatorio diz o que o
    // servidor respondeu, em vez de so "esperava 409".
    expect(`${resposta.status} ${JSON.stringify(resposta.body)}`).toContain(
      "409",
    );

    const gravadas = await prisma.atribuicaoGestorEquipe.count({
      where: { equipeId: equipe },
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
    expect(await colaboradoresVisiveis(gestorExcecao)).toEqual([]);

    // FUTURA: cadastrada, mas comeca daqui a dez dias.
    const futura = await post("/v1/gestor/administracao/excecoes", rhA)
      .send({
        gestorColaboradorId: pessoaGestorExcecao.colaboradorId,
        vinculoId: pessoaExcecaoPassada.vinculoId,
        motivoCodigo: "cobertura_de_ausencia",
        justificativa: "Cobertura sintetica de ausencia, apenas para teste.",
        vigenciaInicio: dia(10),
        vigenciaFim: dia(40),
      })
      .expect(201);
    expect(futura.body.encerradaEm).toBeNull();
    expect(await colaboradoresVisiveis(gestorExcecao)).toEqual([]);

    // EXPIRADA: o prazo ja passou. Fim exclusivo, entao terminar ontem basta.
    await post("/v1/gestor/administracao/excecoes", rhA)
      .send({
        gestorColaboradorId: pessoaGestorExcecao.colaboradorId,
        vinculoId: pessoaExcecaoPassada.vinculoId,
        motivoCodigo: "projeto_temporario",
        justificativa: "Projeto sintetico ja encerrado, apenas para teste.",
        vigenciaInicio: dia(-40),
        vigenciaFim: dia(-1),
      })
      .expect(201);
    expect(await colaboradoresVisiveis(gestorExcecao)).toEqual([]);

    // VIGENTE: ve a pessoa de FORA da equipe, e so ela.
    const atual = await post("/v1/gestor/administracao/excecoes", rhA)
      .send({
        gestorColaboradorId: pessoaGestorExcecao.colaboradorId,
        vinculoId: pessoaExcecaoAtual.vinculoId,
        motivoCodigo: "apuracao_formal",
        justificativa: "Apuracao sintetica em curso, apenas para teste.",
        vigenciaInicio: dia(-5),
        vigenciaFim: dia(60),
      })
      .expect(201);

    expect(await colaboradoresVisiveis(gestorExcecao)).toEqual([
      pessoaExcecaoAtual.colaboradorId,
    ]);

    // REVOGADA: cai na hora, mesmo faltando prazo.
    const revogada = await patch(
      `/v1/gestor/administracao/excecoes/${atual.body.id}/encerrar`,
      rhA,
    )
      .send()
      .expect(200);
    expect(revogada.body.encerradaEm).not.toBeNull();
    // O periodo original permanece gravado: revogar encurta o alcance, nao
    // reescreve o que foi concedido.
    expect(revogada.body.vigenciaInicio).toBe(dia(-5));
    expect(revogada.body.vigenciaFim).toBe(dia(60));

    expect(await colaboradoresVisiveis(gestorExcecao)).toEqual([]);

    // E a excecao revogada tambem nao volta por data historica.
    await get(
      `/v1/gestor/equipe?dataReferencia=${dia(-2)}`,
      gestorExcecao,
    ).expect(400);
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

    // Enquanto so existe o primeiro vinculo, que esta FORA da equipe da
    // gestora, a pessoa e invisivel.
    expect(await colaboradoresVisiveis(gestorPrincipal)).not.toContain(
      primeiro.colaboradorId,
    );

    await movimentar(rhA, {
      vinculoId: primeiro.vinculoId,
      tipo: "desligamento",
      motivoCodigo: "encerramento_de_vinculo",
      vigenciaInicio: dia(-100),
    });

    const segundoVinculo = (
      await post("/v1/vinculos", rhA)
        .send({
          colaboradorId: primeiro.colaboradorId,
          empresaId: empresaA,
          matricula: "MAT-DUP-DOIS",
          tipo: "clt",
          dataAdmissao: dia(-99),
          motivoCodigo: "admissao_inicial",
          departamentoId: departamentoA,
          equipeId: equipeAlfa,
        })
        .expect(201)
    ).body.id as string;
    await efetivarAdmissao(rhA, segundoVinculo);

    const itens = (await consultarEquipe(gestorPrincipal)).itens;
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
    const daEmpresaA = await colaboradoresVisiveis(gestorPrincipal);
    expect(daEmpresaA).not.toContain(pessoaEmpresaB.colaboradorId);
    expect(daEmpresaA).not.toContain(pessoaGestorB.colaboradorId);

    const daEmpresaB = await colaboradoresVisiveis(gestorB);
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
      `/v1/gestor/equipe/vinculos/${pessoaAlfa.vinculoId}`,
      gestorPrincipal,
    ).expect(200);
    expect(dentro.body.vinculoId).toBe(pessoaAlfa.vinculoId);

    // Outra equipe, mesma empresa.
    await get(
      `/v1/gestor/equipe/vinculos/${pessoaFora.vinculoId}`,
      gestorPrincipal,
    ).expect(404);
    // Outra empresa.
    await get(
      `/v1/gestor/equipe/vinculos/${pessoaEmpresaB.vinculoId}`,
      gestorPrincipal,
    ).expect(404);
    // Identificador bem formado e inexistente: resposta indistinguivel das
    // duas acima, que e o ponto.
    await get(
      `/v1/gestor/equipe/vinculos/00000000-0000-4000-8000-000000000000`,
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
        vigenciaInicio: dia(-5),
        vigenciaFim: dia(25),
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
        vigenciaInicio: dia(-5),
        vigenciaFim: dia(25),
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
      .send({ vigenciaFim: dia(-10) })
      .expect(200);
    expect(encerrada.body.vigenciaFim).toBe(dia(-10));
    expect(encerrada.body.vigenciaInicio).toBe(INICIO_ESCOPO);

    const listadas = await get(
      `/v1/gestor/administracao/atribuicoes?equipeId=${equipeHistorico}`,
      rhA,
    ).expect(200);
    const historica = (
      listadas.body as { id: string; vigenciaFim: string | null }[]
    ).find((a) => a.id === criada.body.id);
    expect(historica).toBeDefined();
    expect(historica!.vigenciaFim).toBe(dia(-10));

    // Encerrar duas vezes nao e idempotente nem silencioso: a segunda tentativa
    // recebe 409.
    //
    // Era 404 antes, e o 404 vinha de uma leitura previa que conferia
    // `vigenciaFim === null` — a mesma leitura que abria o TOCTOU. Agora quem
    // decide e o predicado do `updateMany`, e ele nao distingue "ja estava
    // encerrada" de "outro PATCH chegou primeiro": os dois sao 409, com a
    // mesma mensagem generica. 404 continua reservado ao que o ator nao pode
    // ver (outra empresa, inexistente), que e o caso anti-enumeracao.
    await patch(
      `/v1/gestor/administracao/atribuicoes/${criada.body.id}/encerrar`,
      rhA,
    )
      .send({ vigenciaFim: dia(-9) })
      .expect(409);
  });

  // -------------------------------------------------------------------------
  // 19. Projecao fechada
  // -------------------------------------------------------------------------
  it("19. a consulta do gestor nao devolve nenhum campo fora da projecao", async () => {
    // A decisao 7 fechou o que o gestor ve. Uma projecao aberta ("tudo do
    // vinculo") vazaria por acrescimo futuro: bastaria uma coluna nova no
    // modelo para o gestor passar a ver remuneracao ou dado clinico sem que
    // ninguem tivesse decidido isso.
    const lista = await get(`/v1/gestor/equipe`, gestorPrincipal).expect(200);
    const detalhe = await get(
      `/v1/gestor/equipe/vinculos/${pessoaAlfa.vinculoId}`,
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
      .send({ vigenciaFim: dia(-1) })
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

  // =========================================================================
  // 21-27. Integridade historica garantida pelo BANCO
  //
  // Estes testes falam com o PostgreSQL pelo papel `evolli_app` — o mesmo com
  // que a aplicacao roda. Nao exercitam rota: exercitam a garantia que
  // sobrevive a um service com defeito, a um script de correcao distraido e a
  // um modulo futuro que nao conheca estas regras.
  // =========================================================================
  describe("integridade historica (migration 20261007120000)", () => {
    /** Equipe propria: as anteriores ja tem vigencias que colidiriam. */
    let equipeIntegridade: string;
    let alvo: string;

    beforeAll(async () => {
      equipeIntegridade = await criarEquipe(
        "EQP_INTEG",
        "Equipe Sintetica Integridade",
        departamentoA,
      );
      const criada = await atribuir(rhA, {
        equipeId: equipeIntegridade,
        gestorColaboradorId: pessoaGestorExcecao.colaboradorId,
        papel: "principal",
        vigenciaInicio: dia(-50),
      }).expect(201);
      alvo = criada.body.id;
    });

    it("21. evolli_app NAO consegue DELETE em nenhuma das tres tabelas", async () => {
      // A afirmacao "o historico nao e apagavel" se apoiava em "nao ha rota
      // DELETE" — que protege contra a aplicacao, nao contra o banco. Sem o
      // REVOKE, um `DELETE FROM atribuicao_gestor_equipe` funcionava.
      for (const tabela of [
        "access_user_colaborador",
        "atribuicao_gestor_equipe",
        "excecao_acesso_gestor",
      ]) {
        await expect(
          prisma.$executeRawUnsafe(`DELETE FROM app.${tabela}`),
        ).rejects.toThrow(/permission denied/i);
      }
    });

    it("22. evolli_app CONSEGUE ler e encerrar (controle positivo)", async () => {
      // Sem isto, o teste 21 passaria tambem se o papel tivesse perdido todos
      // os privilegios, ou se as tabelas nao existissem.
      const linhas = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
        "SELECT count(*) AS n FROM app.atribuicao_gestor_equipe",
      );
      expect(Number(linhas[0]!.n)).toBeGreaterThan(0);

      await patch(`/v1/gestor/administracao/atribuicoes/${alvo}/encerrar`, rhA)
        .send({ vigenciaFim: dia(-2) })
        .expect(200);
    });

    it("23. nao se reabre uma atribuicao encerrada, nem por SQL direto", async () => {
      await expect(
        prisma.$executeRawUnsafe(
          `UPDATE app.atribuicao_gestor_equipe SET vigencia_fim = NULL WHERE id = '${alvo}'`,
        ),
      ).rejects.toThrow(/nao admite reabertura/i);

      // E a data gravada tambem nao se reescreve.
      await expect(
        prisma.$executeRawUnsafe(
          `UPDATE app.atribuicao_gestor_equipe SET vigencia_fim = '2099-01-01' WHERE id = '${alvo}'`,
        ),
      ).rejects.toThrow(/nao admite reabertura/i);
    });

    it("24. campos imutaveis recusam reescrita, nas tres tabelas", async () => {
      const tentativas: [string, string][] = [
        [
          "atribuicao_gestor_equipe",
          `UPDATE app.atribuicao_gestor_equipe SET papel = 'substituto' WHERE id = '${alvo}'`,
        ],
        [
          "atribuicao_gestor_equipe",
          `UPDATE app.atribuicao_gestor_equipe SET vigencia_inicio = '2000-01-01' WHERE id = '${alvo}'`,
        ],
        [
          "access_user_colaborador",
          "UPDATE app.access_user_colaborador SET criado_por_user_id = user_id",
        ],
        [
          "excecao_acesso_gestor",
          "UPDATE app.excecao_acesso_gestor SET justificativa = 'reescrita'",
        ],
        [
          "excecao_acesso_gestor",
          "UPDATE app.excecao_acesso_gestor SET vigencia_fim = '2099-01-01'",
        ],
      ];

      for (const [, sql] of tentativas) {
        await expect(prisma.$executeRawUnsafe(sql)).rejects.toThrow(
          /coluna imutavel alterada/i,
        );
      }
    });

    it("25. dois encerramentos CONCORRENTES: exatamente um vence, 409 para o outro", async () => {
      const criada = await atribuir(rhA, {
        equipeId: equipeIntegridade,
        gestorColaboradorId: pessoaGestorExcecao.colaboradorId,
        papel: "substituto",
        vigenciaInicio: dia(-50),
      }).expect(201);
      const id = criada.body.id as string;

      // Disparados juntos, sem await entre eles: e a corrida que o TOCTOU
      // perdia silenciosamente, sobrescrevendo autor e data do vencedor.
      const [a, b] = await Promise.all([
        patch(`/v1/gestor/administracao/atribuicoes/${id}/encerrar`, rhA)
          .send({ vigenciaFim: dia(-3) })
          .then((r) => r.status),
        patch(`/v1/gestor/administracao/atribuicoes/${id}/encerrar`, rhA)
          .send({ vigenciaFim: dia(-1) })
          .then((r) => r.status),
      ]);

      expect([a, b].filter((s) => s === 200)).toHaveLength(1);
      expect([a, b].filter((s) => s === 409)).toHaveLength(1);

      // Um unico evento na trilha: a perdedora reverteu junto com a auditoria.
      const eventos = await prisma.auditEvent.findMany({
        where: { resourceId: id, action: "gestor_atribuicao_encerrada" },
      });
      expect(eventos).toHaveLength(1);

      // E exatamente uma data gravada, coerente com quem venceu.
      const linha = await prisma.atribuicaoGestorEquipe.findUniqueOrThrow({
        where: { id },
        select: { vigenciaFim: true, encerradoPorUserId: true },
      });
      expect(linha.vigenciaFim).not.toBeNull();
      expect(linha.encerradoPorUserId).toBe(rhA.userId);
    });

    it("26. justificativa so com espacos e barrada pelo CHECK, com 409", async () => {
      // O DTO exige `MinLength(5)`, que cinco espacos satisfazem; o service
      // apara a string, e quem recusa e o CHECK do banco. Prova que a
      // validacao nao mora so no DTO — e que o CHECK reconhecido vira 409,
      // nao 500.
      //
      // A regra oposta — erro NAO reconhecido tem de continuar 500 — e
      // provada em `gestor-conflito.spec.ts`, onde cada ramo de traducao e
      // exercitado diretamente. Pela API nao ha como provocar um erro
      // desconhecido sem falsificar o driver, e um teste que so verifica
      // "rejeitou" nao distinguiria 409 de 500.
      const resposta = await post("/v1/gestor/administracao/excecoes", rhA)
        .send({
          gestorColaboradorId: pessoaGestorExcecao.colaboradorId,
          vinculoId: pessoaAlfa.vinculoId,
          motivoCodigo: "apuracao_formal",
          justificativa: "      ",
          vigenciaInicio: dia(-5),
          vigenciaFim: dia(30),
        })
        .expect(409);

      expect(JSON.stringify(resposta.body)).not.toContain("constraint");
    });

    it("27. a resposta de conflito nao cita Prisma, PostgreSQL nem SQLSTATE", async () => {
      const resposta = await patch(
        `/v1/gestor/administracao/atribuicoes/${alvo}/encerrar`,
        rhA,
      )
        .send({ vigenciaFim: dia(-1) })
        .expect(409);

      const texto = JSON.stringify(resposta.body).toLowerCase();
      for (const proibido of [
        "prisma",
        "postgres",
        "23p01",
        "23505",
        "23514",
        "constraint",
        "app.",
        "evolli_app",
      ]) {
        expect(texto).not.toContain(proibido);
      }
    });

    it("28. se a auditoria nao puder ser gravada, a atribuicao NAO e criada", async () => {
      // ADR 0004 §2: toda mutacao audita na MESMA transacao. Uma concessao de
      // acesso registrada sem trilha e pior que uma concessao que falhou —
      // ninguem saberia depois quem deu acesso a quem.
      //
      // Mesmo instrumento de `audit.e2e-spec.ts`: o papel migrator revoga
      // INSERT em `audit_event`, o que faz `AuditService.record` lancar
      // DENTRO da transacao. Nao e simulacao — e a falha real.
      // Equipe exclusiva deste teste: as vigencias dos anteriores colidiriam
      // na EXCLUSION e o 409 mascararia o 500 que se quer observar.
      const equipeRollback = await criarEquipe(
        "EQP_ROLLB",
        "Equipe Sintetica Rollback",
        departamentoA,
      );
      const migrator = new PrismaClient({
        datasources: { db: { url: migratorUrl } },
      });
      const antes = await prisma.atribuicaoGestorEquipe.count({
        where: { equipeId: equipeRollback },
      });

      try {
        await migrator.$executeRawUnsafe(
          "REVOKE INSERT ON TABLE app.audit_event FROM evolli_app",
        );

        await atribuir(rhA, {
          equipeId: equipeRollback,
          gestorColaboradorId: pessoaGestorVigencia.colaboradorId,
          papel: "substituto",
          vigenciaInicio: dia(-40),
        }).expect(500);
      } finally {
        await migrator.$executeRawUnsafe(
          "GRANT INSERT ON TABLE app.audit_event TO evolli_app",
        );
        await migrator.$disconnect();
      }

      const depois = await prisma.atribuicaoGestorEquipe.count({
        where: { equipeId: equipeRollback },
      });
      expect(depois).toBe(antes);

      // Controle positivo: com a auditoria de volta, a MESMA operacao passa.
      // Sem isto, o teste acima passaria tambem se a criacao estivesse
      // quebrada por qualquer outro motivo.
      await atribuir(rhA, {
        equipeId: equipeRollback,
        gestorColaboradorId: pessoaGestorVigencia.colaboradorId,
        papel: "substituto",
        vigenciaInicio: dia(-40),
      }).expect(201);
    });
  });
});
