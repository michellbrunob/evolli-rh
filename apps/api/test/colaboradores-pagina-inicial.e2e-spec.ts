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
 * T215 — a página inicial de Colaboradores no desenho da referência:
 * `GET /v1/colaboradores` com a busca ampliada (CPF, e-mail pessoal e id),
 * os campos da linha (CPF, contatos e salário bruto, só para quem os lê) e
 * os indicadores do cartão (admitidos no mês, desligados no ano e a série de
 * ativos). PostgreSQL real e efêmero (Testcontainers), migrations do zero.
 *
 * **Todos os dados são sintéticos.** Domínio reservado `example.test`; CPFs
 * gerados com dígitos verificadores válidos, sem pessoa real.
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
const SENHA_PADRAO = "PaginaInicial!Sintetica#2026";
/** Dia civil de hoje em São Paulo — a regra do servidor. */
const HOJE = dataLocalDe(new Date());
const INICIO_DO_MES = `${HOJE.slice(0, 7)}-01`;
const ADMISSAO_ANTIGA = `${Number(HOJE.slice(0, 4)) - 2}-01-05`;

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

/** CPFs sintéticos, com dígitos verificadores válidos. */
const CPF_ATIVO = "52998224725";
const CPF_DESLIGADO = "11144477735";

interface Credencial {
  cookie: string;
  csrfToken: string;
}

interface ItemListado {
  id: string;
  nome: string;
  situacao: string;
  desativado: boolean;
  cpf?: string | null;
  contatos?: { emailPessoal: string | null; celular: string | null } | null;
  salarioBruto?: string | null;
}

interface Listagem {
  itens: ItemListado[];
  total: number;
  contadores: {
    ativos: number;
    inativos: number;
    emAdmissao: number;
    desligados: number;
    desativados: number;
    total: number;
    ativosPorTipo: Record<string, number>;
    admitidosNoMes: number;
    desligadosNoAno: number;
    serieAtivos: number[];
  };
}

describe("T215 — página inicial de Colaboradores (e2e)", () => {
  let container: StartedTestContainer;
  let app: INestApplication;
  let prisma: PrismaClient;
  let appUrl: string;

  let master: Credencial;
  let rhA: Credencial;
  let dpA: Credencial;
  let rhB: Credencial;
  let gestorA: Credencial;
  let empresaA: string;
  let empresaB: string;
  type Pessoa = Awaited<ReturnType<typeof admitir>>;
  let ativo: Pessoa;
  let desligado: Pessoa;
  let previsto: Pessoa;
  let admitidoNoMes: Pessoa;
  let desativadoNoMes: Pessoa;

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

  async function criarUsuario(
    email: string,
    role: string,
    companyId: string,
  ): Promise<Credencial> {
    await post("/v1/users", master)
      .send({ email, password: SENHA_PADRAO, role, companyId })
      .expect(201);
    return login(email);
  }

  let sequencia = 0;
  /** Admite pela API; `ativo` efetiva a admissão; `desligado` encerra. */
  async function admitir(
    cred: Credencial,
    empresaId: string,
    estado: "ativo" | "previsto" | "desligado" = "ativo",
    opcoes: { cpf?: string; dataAdmissao?: string; salario?: string } = {},
  ): Promise<{
    id: string;
    nome: string;
    vinculoId: string;
    email: string;
  }> {
    sequencia += 1;
    const nome = `Pessoa Pagina ${String.fromCharCode(65 + (sequencia % 26))}${sequencia}`;
    const obrigatorios = camposObrigatoriosAdmissao();
    const r = await post("/v1/colaboradores", cred)
      .send({
        ...obrigatorios,
        perfilPessoal: {
          ...obrigatorios.perfilPessoal,
          ...(opcoes.cpf ? { cpf: opcoes.cpf } : {}),
        },
        ...(await lotacaoMinima(appUrl, empresaId)),
        nome,
        empresaId,
        tipo: "clt",
        dataAdmissao: opcoes.dataAdmissao ?? ADMISSAO_ANTIGA,
        motivoCodigo: "admissao_inicial",
        ...(opcoes.salario
          ? { contrato: { salarioBruto: opcoes.salario } }
          : {}),
      })
      .expect(201);
    const email = obrigatorios.contatos.emailPessoal;
    const vinculoId = r.body.vinculo.id as string;
    if (estado !== "previsto") {
      await post(`/v1/movimentacoes/${r.body.movimentacao.id}/efetivar`, cred)
        .send()
        .expect(201);
    }
    if (estado === "desligado") {
      await prisma.vinculoFuncional.update({
        where: { id: vinculoId },
        data: {
          situacao: "encerrado",
          dataDesligamento: new Date(`${HOJE.slice(0, 4)}-01-02`),
        },
      });
    }
    return { id: r.body.id as string, nome, vinculoId, email };
  }

  async function listar(
    cred: Credencial,
    query: Record<string, string> = {},
  ): Promise<Listagem> {
    const r = await get("/v1/colaboradores", cred)
      .query({ tamanhoPagina: "100", ...query })
      .expect(200);
    return r.body as Listagem;
  }

  const ids = (l: Listagem) => l.itens.map((i) => i.id);

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
        email: "master.pagina@example.test",
        passwordHash: await new PasswordHashService().hash(SENHA_PADRAO),
        role: "master_tecnico",
        status: "active",
      },
    });
    master = await login("master.pagina@example.test");
    const empresa = async (codigo: string) =>
      (
        await post("/v1/empresas", master)
          .send({ codigo, nome: `Empresa ${codigo}` })
          .expect(201)
      ).body.id as string;
    empresaA = await empresa("PGIA");
    empresaB = await empresa("PGIB");
    rhA = await criarUsuario("rh.pgia@example.test", "rh", empresaA);
    dpA = await criarUsuario("dp.pgia@example.test", "dp", empresaA);
    rhB = await criarUsuario("rh.pgib@example.test", "rh", empresaB);
    gestorA = await criarUsuario(
      "gestor.pgia@example.test",
      "gestor",
      empresaA,
    );

    // As pessoas da suíte (empresa A).
    ativo = await admitir(rhA, empresaA, "ativo", {
      cpf: CPF_ATIVO,
      salario: "5000.00",
    });
    desligado = await admitir(rhA, empresaA, "desligado", {
      cpf: CPF_DESLIGADO,
    });
    previsto = await admitir(rhA, empresaA, "previsto");
    admitidoNoMes = await admitir(rhA, empresaA, "ativo", {
      dataAdmissao: INICIO_DO_MES,
    });
    desativadoNoMes = await admitir(rhA, empresaA, "ativo", {
      dataAdmissao: INICIO_DO_MES,
    });
    await post(`/v1/colaboradores/${desativadoNoMes.id}/desativar`, rhA)
      .send()
      .expect(200);
  });

  afterAll(async () => {
    await app?.close();
    await prisma?.$disconnect();
    await container?.stop();
  });

  const item = (l: Listagem, id: string) => l.itens.find((i) => i.id === id);

  describe("campos da linha", () => {
    it.each(["rh", "dp"] as const)(
      "%s lê CPF, contatos e salário bruto do vínculo principal",
      async (papel) => {
        const l = await listar(papel === "rh" ? rhA : dpA);
        expect(item(l, ativo.id)).toMatchObject({
          cpf: CPF_ATIVO,
          contatos: { emailPessoal: ativo.email, celular: "+5511900000000" },
          salarioBruto: "5000.00",
        });
        // Sem contrato gravado: o campo vem, vazio.
        expect(item(l, previsto.id)).toHaveProperty("salarioBruto", null);
        // Sem CPF no perfil: vem, vazio.
        expect(item(l, previsto.id)).toHaveProperty("cpf", null);
      },
    );

    it("desligado: CPF e contatos bloqueados (vêm vazios), como na ficha", async () => {
      const l = await listar(rhA);
      expect(item(l, desligado.id)).toMatchObject({
        cpf: null,
        contatos: null,
      });
    });

    it("master técnico sem empresa ativa: nada de CPF, contatos nem salário (campos ausentes)", async () => {
      const l = await listar(master);
      const linha = item(l, ativo.id)!;
      expect(linha).toBeDefined();
      expect(linha).not.toHaveProperty("cpf");
      expect(linha).not.toHaveProperty("contatos");
      expect(linha).not.toHaveProperty("salarioBruto");
    });

    it("gestor não lista colaboradores (a regra de sempre)", async () => {
      await get("/v1/colaboradores", gestorA).expect(403);
    });

    it("a leitura de CPF e contatos da página deixa a trilha de cada pessoa, sem valores", async () => {
      const antes = new Date();
      await listar(rhA, { grupo: "ativos" });
      const contatos = await prisma.contatoColaboradorEvento.findMany({
        where: {
          colaboradorId: ativo.id,
          acao: "leitura",
          ocorridoEm: { gte: antes },
        },
      });
      expect(contatos).toHaveLength(1);
      expect(contatos[0]).toMatchObject({
        resultado: "valores_devolvidos",
        empresaId: empresaA,
      });
      expect([...contatos[0]!.campos].sort()).toEqual([
        "celular",
        "email_pessoal",
        "telefone",
      ]);
      const dados = await prisma.dadosPessoaisColaboradorEvento.findMany({
        where: {
          colaboradorId: ativo.id,
          acao: "leitura",
          ocorridoEm: { gte: antes },
        },
      });
      expect(dados).toHaveLength(1);
      expect(dados[0]).toMatchObject({
        categoria: "perfil_pessoal",
        resultado: "valores_devolvidos",
        campos: ["cpf"],
      });
      const auditoria = await prisma.auditEvent.findMany({
        where: {
          resourceId: ativo.id,
          occurredAt: { gte: antes },
          action: {
            in: [
              "pessoas_contato_consultado",
              "pessoas_dados_pessoais_consultados",
            ],
          },
        },
      });
      expect(auditoria.map((e) => e.action).sort()).toEqual([
        "pessoas_contato_consultado",
        "pessoas_dados_pessoais_consultados",
      ]);
      // A trilha nunca guarda o valor.
      expect(JSON.stringify(auditoria)).not.toContain(CPF_ATIVO);
    });
  });

  describe("busca", () => {
    const busca = async (cred: Credencial, termo: string) =>
      ids(await listar(cred, { busca: termo }));

    it.each([
      ["CPF com máscara", "529.982.247-25"],
      ["CPF sem máscara", "52998224725"],
      ["prefixo do CPF", "529982"],
    ])("%s acha a pessoa", async (_rotulo, termo) => {
      expect(await busca(rhA, termo)).toEqual([ativo.id]);
    });

    it("e-mail pessoal, sem diferenciar maiúsculas", async () => {
      expect(await busca(rhA, ativo.email.toUpperCase())).toEqual([ativo.id]);
    });

    it("id exato", async () => {
      expect(await busca(dpA, ativo.id)).toEqual([ativo.id]);
    });

    it("o CPF do desligado não é procurado (dado bloqueado)", async () => {
      expect(await busca(rhA, CPF_DESLIGADO)).toEqual([]);
    });

    it("outra empresa não acha pelo CPF nem pelo id", async () => {
      expect(await busca(rhB, CPF_ATIVO)).toEqual([]);
      expect(await busca(rhB, ativo.id)).toEqual([]);
    });

    it("nome e matrícula seguem como antes", async () => {
      expect(await busca(rhA, ativo.nome)).toEqual([ativo.id]);
    });
  });

  describe("indicadores do cartão", () => {
    it("admitidos no mês e desligados no ano, sem quem foi desativado", async () => {
      const { contadores } = await listar(rhA);
      expect(contadores.admitidosNoMes).toBe(1);
      // O admitido no mês está em Ativos; o desativado, não.
      const ativos = ids(await listar(rhA, { grupo: "ativos" }));
      expect(ativos).toContain(admitidoNoMes.id);
      expect(ativos).not.toContain(desativadoNoMes.id);
      expect(contadores.desligadosNoAno).toBe(1);
    });

    it("série de 6 meses: o mês atual é o número de ativos; antes do mês, sem os admitidos agora", async () => {
      const { contadores } = await listar(dpA);
      expect(contadores.serieAtivos).toHaveLength(6);
      expect(contadores.serieAtivos[5]).toBe(contadores.ativos);
      // No fim do mês passado, o admitido neste mês ainda não estava; o
      // desligado em 2 de janeiro já tinha saído (exceto se hoje for janeiro,
      // quando o mês passado é dezembro do ano anterior).
      if (HOJE.slice(5, 7) !== "01") {
        expect(contadores.serieAtivos[4]).toBe(contadores.ativos - 1);
      }
    });

    it("outra empresa não vê os números desta", async () => {
      const { contadores } = await listar(rhB);
      expect(contadores).toMatchObject({
        admitidosNoMes: 0,
        desligadosNoAno: 0,
        serieAtivos: [0, 0, 0, 0, 0, 0],
      });
    });
  });
});
