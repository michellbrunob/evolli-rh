import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { PrismaClient } from "@prisma/client";
import cookieParser from "cookie-parser";
import request from "supertest";
import { GenericContainer, StartedTestContainer, Wait } from "testcontainers";
import { AppModule } from "../src/app.module";
import { ArmazenamentoEmMemoria } from "../src/pessoas/foto-colaborador/armazenamento-de-objetos";
import { ARMAZENAMENTO_DE_DOCUMENTOS } from "../src/pessoas/documentos-colaborador/armazenamento-de-documentos";
import {
  VERIFICADOR_DE_ARQUIVOS,
  VerificadorFalso,
} from "../src/pessoas/documentos-colaborador/verificador-de-arquivos";
import { AllExceptionsFilter } from "../src/common/filters/http-exception.filter";
import { requestIdMiddleware } from "../src/common/request-id";
import { aplicarLimiteDoCorpo } from "../src/common/corpo-json";
import {
  hojeEmSaoPaulo,
  somarDias,
  somarMeses,
} from "../src/pessoas/ausencias/calculo-ausencias";
import {
  ITENS_NR1,
  ROTULOS_DA_ESCALA,
} from "../src/pesquisas/modelos/copsoq/definicao";
import {
  ROTULOS_DA_CONCORDANCIA,
  ROTULOS_DA_FREQUENCIA,
} from "../src/pesquisas/modelos/isfb/definicao";
import {
  camposObrigatoriosAdmissao,
  lotacaoMinima,
} from "./admissao-obrigatoria";

/**
 * T216 — Pesquisas: as rotas autenticadas (`/v1/pesquisas`, a aba da ficha)
 * e a página pública (`/v1/publico/pesquisas/:token`). PostgreSQL real e
 * efêmero (Testcontainers), migrations do zero.
 *
 * **Todos os dados são sintéticos.** Domínio reservado `example.test`; CPFs
 * gerados pela regra dos dígitos verificadores, sem relação com ninguém.
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
const SENHA_PADRAO = "Pesquisas!Sinteticas#2026";
/** O nascimento que `camposObrigatoriosAdmissao` grava. */
const NASCIMENTO = "1990-01-15";

const HOJE = hojeEmSaoPaulo();
const ADMISSAO = somarMeses(HOJE, -6);

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

/** CPF sintético com os dígitos verificadores certos. */
let sequenciaCpf = 0;
function cpfSintetico(): string {
  sequenciaCpf += 1;
  const base = String(310_000_000 + sequenciaCpf * 7).padStart(9, "0");
  const dv = (s: string, peso: number) => {
    let soma = 0;
    for (const ch of s) soma += Number(ch) * peso--;
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  const d1 = dv(base, 10);
  const d2 = dv(`${base}${d1}`, 11);
  return `${base}${d1}${d2}`;
}

const formatarCpf = (c: string) =>
  `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}`;

interface Credencial {
  cookie: string;
  csrfToken: string;
}

interface Pessoa {
  id: string;
  nome: string;
  cpf: string;
}

/** A estrutura usada na maior parte da suíte. */
function estrutura() {
  return [
    {
      id: "s-geral",
      titulo: "Geral",
      descricao: null,
      perguntas: [
        {
          id: "gosta",
          tipo: "sim_nao",
          texto: "Você recomendaria trabalhar aqui?",
          rotulo: null,
          descricao: null,
          obrigatoria: true,
          config: { respostaBoa: "sim" },
          condicao: null,
        },
        {
          id: "porque",
          tipo: "paragrafo",
          texto: "O que precisa melhorar?",
          rotulo: null,
          descricao: null,
          obrigatoria: true,
          config: {},
          condicao: { perguntaId: "gosta", opcaoId: "nao" },
        },
        {
          id: "clima",
          tipo: "concordancia",
          texto: "O ambiente de trabalho é respeitoso.",
          rotulo: "Respeito",
          descricao: null,
          obrigatoria: true,
          config: {},
          condicao: null,
        },
      ],
    },
    {
      id: "s-nota",
      titulo: null,
      descricao: null,
      perguntas: [
        {
          id: "enps",
          tipo: "nota_0_10",
          texto: "De 0 a 10, quanto recomendaria a empresa?",
          rotulo: null,
          descricao: null,
          obrigatoria: false,
          config: { enps: true },
          condicao: null,
        },
        {
          id: "comentario",
          tipo: "texto_curto",
          texto: "Comentário",
          rotulo: null,
          descricao: null,
          obrigatoria: false,
          config: {},
          condicao: null,
        },
      ],
    },
  ];
}

describe("T216 — Pesquisas (e2e)", () => {
  let container: StartedTestContainer;
  let app: INestApplication;
  let prisma: PrismaClient;
  let appUrl: string;
  let migratorUrl: string;

  let master: Credencial;
  let masterA: Credencial;
  let rhA: Credencial;
  let dpA: Credencial;
  let rhB: Credencial;
  let empresaA: string;
  let empresaB: string;
  const outrosPapeis: [string, Credencial][] = [];

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

  function put(rota: string, cred: Credencial) {
    return agent()
      .put(rota)
      .set("Cookie", cred.cookie)
      .set("x-csrf-token", cred.csrfToken);
  }

  function del(rota: string, cred: Credencial) {
    return agent()
      .delete(rota)
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

  async function criarDireto(
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

  const armazenamento = new ArmazenamentoEmMemoria();

  let sequencia = 0;
  /** Admite e efetiva pela API; grava um CPF sintético no perfil. */
  async function admitir(
    cred: Credencial,
    empresaId: string,
    departamentoId?: string,
    centroCustoId?: string,
  ): Promise<Pessoa> {
    sequencia += 1;
    const nome = `Pessoa Pesquisa ${String.fromCharCode(65 + (sequencia % 26))}${sequencia}`;
    const r = await post("/v1/colaboradores", cred)
      .send({
        ...camposObrigatoriosAdmissao(),
        ...(await lotacaoMinima(appUrl, empresaId)),
        ...(departamentoId ? { departamentoId } : {}),
        ...(centroCustoId ? { centroCustoId } : {}),
        nome,
        empresaId,
        tipo: "clt",
        dataAdmissao: ADMISSAO,
        motivoCodigo: "admissao_inicial",
      })
      .expect(201);
    await post(`/v1/movimentacoes/${r.body.movimentacao.id}/efetivar`, cred)
      .send()
      .expect(201);
    const cpf = cpfSintetico();
    const atualizado = await prisma.perfilPessoalColaborador.updateMany({
      where: { colaboradorId: r.body.id, empresaId },
      data: { cpf },
    });
    expect(atualizado.count).toBe(1);
    return { id: r.body.id as string, nome, cpf };
  }

  function corpo(extra: Record<string, unknown> = {}) {
    return {
      nome: "Pesquisa de clima sintética",
      boasVindas: "Leva poucos minutos.",
      modelo: "pulso",
      identificacao: "identificada",
      secoes: estrutura(),
      participantes: { todos: false, colaboradorIds: [] as string[] },
      encerraEm: null,
      minimoPorGrupo: 3,
      ...extra,
    };
  }

  async function criarPesquisa(
    extra: Record<string, unknown> = {},
    cred: Credencial = rhA,
  ) {
    const r = await post("/v1/pesquisas", cred).send(corpo(extra)).expect(201);
    return r.body as {
      id: string;
      status: string;
      link: string | null;
      participantes: number;
    };
  }

  async function publicada(extra: Record<string, unknown> = {}) {
    const p = await criarPesquisa(extra);
    const r = await post(`/v1/pesquisas/${p.id}/publicar`, rhA)
      .send()
      .expect(200);
    const token = (r.body.link as string).replace("#/p/", "");
    return { id: p.id, token, detalhe: r.body };
  }

  const publico = (token: string, sufixo = "") =>
    `/v1/publico/pesquisas/${token}${sufixo}`;

  function identificar(token: string, pessoa: Pessoa) {
    return agent()
      .post(publico(token, "/identificar"))
      .send({ cpf: formatarCpf(pessoa.cpf), dataNascimento: NASCIMENTO });
  }

  const RESPOSTAS_BOAS = [
    { perguntaId: "gosta", valor: "nao" },
    { perguntaId: "porque", valor: "Mais reuniões curtas." },
    { perguntaId: "clima", valor: 4 },
    { perguntaId: "enps", valor: 9 },
    { perguntaId: "comentario", valor: "Tudo certo." },
  ];

  async function responderComo(
    token: string,
    pessoa: Pessoa,
    respostas: unknown[] = RESPOSTAS_BOAS,
  ) {
    const id = await identificar(token, pessoa).expect(200);
    await agent()
      .post(publico(token, "/respostas"))
      .send({ passe: id.body.passe, respostas })
      .expect(201);
  }

  const trilha = (resourceId: string) =>
    prisma.auditEvent.findMany({
      where: { resourceId },
      orderBy: { occurredAt: "asc" },
    });

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

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ARMAZENAMENTO_DE_DOCUMENTOS)
      .useValue(armazenamento)
      .overrideProvider(VERIFICADOR_DE_ARQUIVOS)
      .useValue(new VerificadorFalso())
      .compile();
    const expressApp =
      moduleRef.createNestApplication<NestExpressApplication>();
    // O mesmo limite do bootstrap (src/main.ts).
    aplicarLimiteDoCorpo(expressApp);
    app = expressApp;
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

    master = await criarDireto(
      "master.pesquisas@example.test",
      "master_tecnico",
      null,
    );
    const empresa = async (codigo: string) =>
      (
        await post("/v1/empresas", master)
          .send({ codigo, nome: `Empresa ${codigo}` })
          .expect(201)
      ).body.id as string;
    empresaA = await empresa("PESA");
    empresaB = await empresa("PESB");
    rhA = await criarUsuario("rh.pesa@example.test", "rh", empresaA);
    dpA = await criarUsuario("dp.pesa@example.test", "dp", empresaA);
    rhB = await criarUsuario("rh.pesb@example.test", "rh", empresaB);
    for (const papel of [
      "gestor",
      "financeiro",
      "colaborador",
      "auditor",
      "dpo",
      "admin_tecnico",
    ]) {
      outrosPapeis.push([
        papel,
        await criarDireto(`${papel}.pesa@example.test`, papel, empresaA),
      ]);
    }
    masterA = await criarDireto(
      "master.pesquisas.a@example.test",
      "master_tecnico",
      null,
    );
    await post("/v1/auth/contexto/empresa", masterA)
      .send({ empresaId: empresaA })
      .expect(200);
  });

  afterAll(async () => {
    await app?.close();
    await prisma?.$disconnect();
    await container?.stop();
  });

  // -----------------------------------------------------------------------
  describe("migration", () => {
    it("o schema bate com as migrations (sem diferença)", () => {
      const saida = execFileSync(
        process.execPath,
        [
          PRISMA_CLI,
          "migrate",
          "diff",
          "--from-url",
          migratorUrl,
          "--to-schema-datamodel",
          "prisma/schema.prisma",
          "--exit-code",
        ],
        {
          cwd: API_ROOT,
          env: {
            ...process.env,
            DATABASE_URL: migratorUrl,
            MIGRATE_DATABASE_URL: migratorUrl,
          },
          stdio: "pipe",
          encoding: "utf8",
        },
      );
      expect(saida).toContain("No difference detected");
    });

    it("prazo: coluna com hora; a conversão das datas antigas dá 23:59 de Brasília", async () => {
      const coluna = await prisma.$queryRaw<{ tipo: string }[]>`
        SELECT data_type AS tipo FROM information_schema.columns
         WHERE table_schema = 'app' AND table_name = 'pesquisa'
           AND column_name = 'encerra_em'`;
      expect(coluna[0]!.tipo).toBe("timestamp without time zone");
      // A mesma expressão do USING da migration.
      const convertido = await prisma.$queryRaw<{ instante: Date }[]>`
        SELECT (('2026-12-01'::date)::timestamp + interval '23 hours 59 minutes')
                 AT TIME ZONE 'America/Sao_Paulo' AT TIME ZONE 'UTC' AS instante`;
      expect(convertido[0]!.instante.toISOString()).toBe(
        "2026-12-02T02:59:00.000Z",
      );
    });

    it("privilégios mínimos: resposta imutável e pesquisa sem DELETE", async () => {
      const linhas = await prisma.$queryRaw<
        { tabela: string; privilegio: string; pode: boolean }[]
      >`
        SELECT t.tabela, p.privilegio,
               has_table_privilege('evolli_app', 'app.' || t.tabela, p.privilegio) AS pode
          FROM (VALUES ('pesquisa'), ('pesquisa_resposta'), ('pesquisa_participante'),
                       ('pesquisa_passe'), ('pesquisa_tentativa')) AS t(tabela),
               (VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')) AS p(privilegio)`;
      const pode = (t: string, p: string) =>
        linhas.find((l) => l.tabela === t && l.privilegio === p)!.pode;
      expect(pode("pesquisa", "DELETE")).toBe(false);
      expect(pode("pesquisa", "UPDATE")).toBe(true);
      expect(pode("pesquisa_resposta", "INSERT")).toBe(true);
      expect(pode("pesquisa_resposta", "UPDATE")).toBe(false);
      expect(pode("pesquisa_resposta", "DELETE")).toBe(false);
      expect(pode("pesquisa_participante", "DELETE")).toBe(true);
      expect(pode("pesquisa_passe", "DELETE")).toBe(true);
    });

    it("o banco recusa pessoa na resposta confidencial ou anônima", async () => {
      const pessoa = await admitir(rhA, empresaA);
      for (const identificacao of ["confidencial", "anonima"] as const) {
        const p = await criarPesquisa({ identificacao });
        await expect(
          prisma.pesquisaResposta.create({
            data: {
              pesquisaId: p.id,
              empresaId: empresaA,
              colaboradorId: pessoa.id,
              valores: [],
              respondidaEm: new Date(),
            },
          }),
        ).rejects.toThrow();
      }
      const ident = await criarPesquisa();
      await expect(
        prisma.pesquisaResposta.create({
          data: {
            pesquisaId: ident.id,
            empresaId: empresaA,
            departamentoId: randomUUID(),
            valores: [],
            respondidaEm: new Date(),
          },
        }),
      ).rejects.toThrow();
    });
  });

  // -----------------------------------------------------------------------
  describe("acesso", () => {
    it.each([
      "gestor",
      "financeiro",
      "colaborador",
      "auditor",
      "dpo",
      "admin_tecnico",
    ])(
      "%s: 403 na lista, na criação, nas respostas e na ficha",
      async (papel) => {
        const cred = outrosPapeis.find(([p]) => p === papel)![1];
        const id = randomUUID();
        await get("/v1/pesquisas", cred).expect(403);
        await post("/v1/pesquisas", cred).send(corpo()).expect(403);
        await get(`/v1/pesquisas/${id}/respostas`, cred).expect(403);
        await get(`/v1/colaboradores/${id}/pesquisas`, cred).expect(403);
      },
    );

    it("rh e dp criam, leem e alteram", async () => {
      const p = await criarPesquisa({}, dpA);
      const r = await get(`/v1/pesquisas/${p.id}`, rhA).expect(200);
      expect(r.headers["cache-control"]).toBe("no-store");
      await put(`/v1/pesquisas/${p.id}`, dpA)
        .send(corpo({ nome: "Renomeada pelo DP" }))
        .expect(200);
    });

    it("master técnico: sem empresa ativa, 403; com ela, só lê (nunca as respostas com a pessoa)", async () => {
      const p = await criarPesquisa();
      await get("/v1/pesquisas", master).expect(403);
      await get("/v1/pesquisas", masterA).expect(200);
      await get(`/v1/pesquisas/${p.id}`, masterA).expect(200);
      await get(`/v1/pesquisas/${p.id}/resultados`, masterA).expect(200);
      await post("/v1/pesquisas", masterA).send(corpo()).expect(403);
      await put(`/v1/pesquisas/${p.id}`, masterA).send(corpo()).expect(403);
      await post(`/v1/pesquisas/${p.id}/publicar`, masterA).send().expect(403);
      await del(`/v1/pesquisas/${p.id}`, masterA).expect(403);
      await get(`/v1/pesquisas/${p.id}/respostas`, masterA).expect(403);
      const pessoa = await admitir(rhA, empresaA);
      await get(`/v1/colaboradores/${pessoa.id}/pesquisas`, masterA).expect(
        403,
      );
    });

    it("sem CSRF, a escrita é recusada", async () => {
      await agent()
        .post("/v1/pesquisas")
        .set("Cookie", rhA.cookie)
        .send(corpo())
        .expect(403);
    });

    it("isolamento: outra empresa responde 404 (pesquisa e ficha) e não vê na lista", async () => {
      const p = await criarPesquisa();
      await get(`/v1/pesquisas/${p.id}`, rhB).expect(404);
      await put(`/v1/pesquisas/${p.id}`, rhB).send(corpo()).expect(404);
      await post(`/v1/pesquisas/${p.id}/publicar`, rhB).send().expect(404);
      await post(`/v1/pesquisas/${p.id}/status`, rhB)
        .send({ status: "cancelada" })
        .expect(404);
      await post(`/v1/pesquisas/${p.id}/duplicar`, rhB).send().expect(404);
      await del(`/v1/pesquisas/${p.id}`, rhB).expect(404);
      await get(`/v1/pesquisas/${p.id}/resultados`, rhB).expect(404);
      await get(`/v1/pesquisas/${p.id}/respostas`, rhB).expect(404);
      const lista = await get("/v1/pesquisas", rhB).expect(200);
      expect(lista.body.itens.map((i: { id: string }) => i.id)).not.toContain(
        p.id,
      );
      const pessoa = await admitir(rhA, empresaA);
      await get(`/v1/colaboradores/${pessoa.id}/pesquisas`, rhB).expect(404);
      // Participante de outra empresa não entra.
      await post("/v1/pesquisas", rhB)
        .send(
          corpo({
            participantes: { todos: false, colaboradorIds: [pessoa.id] },
          }),
        )
        .expect(422);
      const negado = await prisma.auditEvent.findFirst({
        where: { resourceId: p.id, result: "denied" },
      });
      expect(negado).not.toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  describe("candidatos (Escolher pessoas)", () => {
    const gestorDoTime = () => outrosPapeis.find(([p]) => p === "gestor")![1];

    it("ativos da empresa com cargo, departamento, centro de custo e unidade; filtros e busca", async () => {
      const lot = await lotacaoMinima(appUrl, empresaA);
      const centro = await prisma.centroCusto.create({
        data: {
          empresaId: empresaA,
          codigo: "T216_CAND_CC",
          nome: "Centro Candidatos Sintetico",
        },
      });
      const comCentro = await admitir(rhA, empresaA, undefined, centro.id);
      const r = await get(
        `/v1/pesquisas/candidatos?centroCustoId=${centro.id}`,
        rhA,
      ).expect(200);
      expect(r.headers["cache-control"]).toBe("no-store");
      expect(r.body).toEqual({
        itens: [
          {
            colaboradorId: comCentro.id,
            nome: comCentro.nome,
            cargo: "Cargo T179 Sintetico",
            departamento: "Departamento T179 Sintetico",
            centroCusto: "Centro Candidatos Sintetico",
            unidade: "Unidade T179 Sintetica",
          },
        ],
        pagina: 1,
        tamanhoPagina: 20,
        total: 1,
      });
      // Busca pelo nome (sem diferenciar maiúsculas) e os outros filtros.
      const busca = await get(
        `/v1/pesquisas/candidatos?busca=${encodeURIComponent(comCentro.nome.toLowerCase())}`,
        rhA,
      ).expect(200);
      expect(
        busca.body.itens.map((x: { colaboradorId: string }) => x.colaboradorId),
      ).toEqual([comCentro.id]);
      const porUnidade = await get(
        `/v1/pesquisas/candidatos?unidadeId=${lot.unidadeOrganizacionalId}&departamentoId=${lot.departamentoId}&tamanhoPagina=2`,
        rhA,
      ).expect(200);
      expect(porUnidade.body.itens).toHaveLength(2);
      expect(porUnidade.body.total).toBeGreaterThan(2);
      // Sem filtro: só ativos da empresa ativa, sem ninguém de fora.
      const todos = await get(
        "/v1/pesquisas/candidatos?tamanhoPagina=100",
        rhA,
      ).expect(200);
      expect(todos.body.total).toBe(
        await prisma.vinculoFuncional.count({
          where: { empresaId: empresaA, situacao: "ativo" },
        }),
      );
      // "Todo o time": o total e por departamento, sem baixar a lista.
      const time = await get("/v1/pesquisas/candidatos/contagem", rhA).expect(
        200,
      );
      expect(time.headers["cache-control"]).toBe("no-store");
      expect(time.body.total).toBe(todos.body.total);
      expect(
        time.body.departamentos.reduce(
          (a: number, d: { quantidade: number }) => a + d.quantidade,
          0,
        ),
      ).toBe(time.body.total);
      expect(time.body.departamentos).toContainEqual({
        departamentoId: lot.departamentoId,
        departamento: "Departamento T179 Sintetico",
        quantidade: todos.body.itens.filter(
          (x: { departamento: string }) =>
            x.departamento === "Departamento T179 Sintetico",
        ).length,
      });
      await get("/v1/pesquisas/candidatos/contagem", gestorDoTime()).expect(
        403,
      );
      const deB = await get("/v1/pesquisas/candidatos", rhB).expect(200);
      expect(
        deB.body.itens.map((x: { colaboradorId: string }) => x.colaboradorId),
      ).not.toContain(comCentro.id);
      // Permissão de leitura da pesquisa: master lê; gestor não.
      await get("/v1/pesquisas/candidatos", masterA).expect(200);
      const gestor = gestorDoTime();
      await get("/v1/pesquisas/candidatos", gestor).expect(403);
      await get("/v1/pesquisas/candidatos?centroCustoId=x", rhA).expect(400);
    });
  });

  // -----------------------------------------------------------------------
  describe("ciclo completo (identificada)", () => {
    let a: Pessoa;
    let b: Pessoa;
    let id: string;
    let token: string;

    beforeAll(async () => {
      a = await admitir(rhA, empresaA);
      b = await admitir(rhA, empresaA);
    });

    it("cria como rascunho, sem link; o link ainda não abre", async () => {
      const p = await criarPesquisa({
        participantes: { todos: false, colaboradorIds: [a.id, b.id] },
      });
      id = p.id;
      expect(p).toMatchObject({
        status: "rascunho",
        link: null,
        participantes: 2,
      });
      const linha = await prisma.pesquisa.findUniqueOrThrow({ where: { id } });
      expect(linha.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
      const r = await agent().get(publico(linha.token)).expect(200);
      expect(r.body).toEqual({ indisponivel: "inexistente" });
      const det = await get(`/v1/pesquisas/${id}`, rhA).expect(200);
      expect(det.body.participantesLista).toHaveLength(2);
      expect(det.body.participantesLista[0]).toMatchObject({
        respondeu: false,
        departamento: "Departamento T179 Sintetico",
      });
      expect(det.body.secoes).toEqual(estrutura());
    });

    it("publica: fica ativa e o link abre a estrutura, sem participantes", async () => {
      const r = await post(`/v1/pesquisas/${id}/publicar`, rhA)
        .send()
        .expect(200);
      expect(r.body.status).toBe("ativa");
      expect(r.body.publicadaEm).not.toBeNull();
      token = (r.body.link as string).replace("#/p/", "");
      const pub = await agent().get(publico(token)).expect(200);
      expect(pub.body).toEqual({
        empresa: "Empresa PESA",
        nome: "Pesquisa de clima sintética",
        boasVindas: "Leva poucos minutos.",
        modelo: "pulso",
        identificacao: "identificada",
        totalPerguntas: 5,
        minutosEstimados: 3,
        secoes: estrutura(),
        grupos: [],
      });
      expect(JSON.stringify(pub.body)).not.toContain(a.id);
    });

    it("identificação: erro genérico; certo devolve o passe e o primeiro nome", async () => {
      const errado = await agent()
        .post(publico(token, "/identificar"))
        .send({ cpf: formatarCpf(a.cpf), dataNascimento: "1990-01-16" })
        .expect(401);
      expect(errado.body.message).toBe("Não autorizado.");
      // Pessoa da empresa que não é participante: o mesmo erro.
      const fora = await admitir(rhA, empresaA);
      await identificar(token, fora).expect(401);
      const r = await identificar(token, a).expect(200);
      expect(r.body.primeiroNome).toBe("Pessoa");
      expect(r.body.passe).toMatch(/^[A-Za-z0-9_-]{43}$/);
      const gravado = await prisma.pesquisaPasse.findFirstOrThrow({
        where: { pesquisaId: id },
      });
      expect(gravado.hash).not.toBe(r.body.passe);
      expect(gravado.expiraEm.getTime() - Date.now()).toBeGreaterThan(
        115 * 60_000,
      );
    });

    it("resposta: passe exigido; 422 por pergunta; 201; o passe não serve de novo", async () => {
      await agent()
        .post(publico(token, "/respostas"))
        .send({ respostas: RESPOSTAS_BOAS })
        .expect(401);
      const { body } = await identificar(token, a).expect(200);
      const ruim = await agent()
        .post(publico(token, "/respostas"))
        .send({
          passe: body.passe,
          respostas: [
            { perguntaId: "gosta", valor: "nao" },
            { perguntaId: "clima", valor: 9 },
          ],
        })
        .expect(422);
      expect(ruim.body.erros).toEqual([
        { campo: "porque", motivo: "obrigatorio" },
        { campo: "clima", motivo: "invalido" },
      ]);
      await agent()
        .post(publico(token, "/respostas"))
        .send({ passe: body.passe, respostas: RESPOSTAS_BOAS })
        .expect(201, { ok: true });
      await agent()
        .post(publico(token, "/respostas"))
        .send({ passe: body.passe, respostas: RESPOSTAS_BOAS })
        .expect(401);
      // Já respondeu: identificar de novo é 409.
      await identificar(token, a).expect(409);
      // Os passes da pessoa saíram.
      expect(
        await prisma.pesquisaPasse.count({ where: { pesquisaId: id } }),
      ).toBe(0);
    });

    it("a resposta guarda a pessoa (identificada) e a trilha não leva conteúdo", async () => {
      const resposta = await prisma.pesquisaResposta.findFirstOrThrow({
        where: { pesquisaId: id },
      });
      expect(resposta.colaboradorId).toBe(a.id);
      expect(resposta.departamentoId).toBeNull();
      const eventos = await trilha(id);
      expect(eventos.map((e) => e.action)).toEqual(
        expect.arrayContaining([
          "pesquisas_pesquisa_criada",
          "pesquisas_pesquisa_publicada",
          "pesquisas_resposta_recebida",
        ]),
      );
      const recebida = eventos.find(
        (e) => e.action === "pesquisas_resposta_recebida",
      )!;
      expect(recebida).toMatchObject({
        actorType: "system",
        companyId: empresaA,
        ip: null,
        resource: "pesquisa",
      });
    });

    it("resultados agregados, com o autor dos textos (identificada)", async () => {
      await responderComo(token, b, [
        { perguntaId: "gosta", valor: "sim" },
        { perguntaId: "porque", valor: "escondida: descartada" },
        { perguntaId: "clima", valor: 2 },
        { perguntaId: "enps", valor: 3 },
      ]);
      const r = await get(`/v1/pesquisas/${id}/resultados`, rhA).expect(200);
      expect(r.body).toMatchObject({
        pesquisaId: id,
        respostas: 2,
        participantes: 2,
        filtro: { departamentoId: null, visivel: true },
      });
      const porId = Object.fromEntries(
        r.body.perguntas.map((p: { perguntaId: string }) => [p.perguntaId, p]),
      );
      expect(porId.gosta).toMatchObject({ sim: 1, nao: 1, viram: 2 });
      expect(porId.porque).toMatchObject({
        respondidas: 1,
        viram: 1,
        textos: [{ texto: "Mais reuniões curtas.", autor: a.nome }],
      });
      expect(porId.clima).toMatchObject({
        media: 3,
        favoravel: 50,
        faixas: { baixa: 1, media: 0, alta: 1 },
      });
      expect(porId.enps).toMatchObject({
        enps: {
          promotores: 1,
          neutros: 0,
          detratores: 1,
          indice: 0,
          zona: "aperfeicoamento",
        },
      });
      // Só a concordância é de escala (o eNPS fica fora): 3 de 5 → 6 de 10.
      expect(r.body.indicadores).toEqual({
        mediaGeral: 6,
        perguntasDeEscala: 1,
        maiorMedia: { perguntaId: "clima", media: 6 },
        menorMedia: { perguntaId: "clima", media: 6 },
        enps: {
          indice: 0,
          zona: "aperfeicoamento",
          promotores: 1,
          neutros: 0,
          detratores: 1,
        },
      });
      expect(r.body.recortes).toEqual([
        "departamento",
        "centroCusto",
        "unidade",
      ]);
      // O master lê o agregado, sem a pessoa.
      const m = await get(`/v1/pesquisas/${id}/resultados`, masterA).expect(
        200,
      );
      const porque = m.body.perguntas.find(
        (p: { perguntaId: string }) => p.perguntaId === "porque",
      );
      expect(porque.textos).toEqual([
        { texto: "Mais reuniões curtas.", autor: null },
      ]);
      const lista = await get(`/v1/pesquisas/${id}`, rhA).expect(200);
      expect(
        lista.body.participantesLista.map(
          (x: { respondeu: boolean }) => x.respondeu,
        ),
      ).toEqual([true, true]);
    });

    it("respostas individuais (auditado) e a aba da ficha", async () => {
      const antes = await prisma.auditEvent.count({
        where: { action: "pesquisas_respostas_consultadas" },
      });
      const r = await get(`/v1/pesquisas/${id}/respostas`, dpA).expect(200);
      // Da mais recente para a mais antiga; #1 continua sendo a primeira.
      expect(r.body).toEqual([
        {
          id: expect.any(String),
          numero: 2,
          colaboradorId: b.id,
          nome: b.nome,
          departamento: "Departamento T179 Sintetico",
          respondidaEm: expect.any(String),
          media: 4,
          grupos: [],
        },
        {
          id: expect.any(String),
          numero: 1,
          colaboradorId: a.id,
          nome: a.nome,
          departamento: "Departamento T179 Sintetico",
          respondidaEm: expect.any(String),
          media: 8,
          grupos: [],
        },
      ]);
      const [segunda, primeira] = r.body as { id: string }[];
      const det = await get(
        `/v1/pesquisas/${id}/respostas/${primeira!.id}`,
        rhA,
      ).expect(200);
      expect(det.body).toMatchObject({
        id: primeira!.id,
        numero: 1,
        // Anterior/próxima na ordem de exibição.
        anteriorId: segunda!.id,
        proximaId: null,
        posicao: 2,
        total: 2,
        nome: a.nome,
        valores: [
          { perguntaId: "gosta", valor: "nao", mediaTime: null },
          {
            perguntaId: "porque",
            valor: "Mais reuniões curtas.",
            mediaTime: null,
          },
          { perguntaId: "clima", valor: 4, mediaTime: 3 },
          { perguntaId: "enps", valor: 9, mediaTime: 6 },
          { perguntaId: "comentario", valor: "Tudo certo.", mediaTime: null },
        ],
        indicadores: {
          media: 8,
          mediaTime: 6,
          recomendacao: 9,
          enpsTime: 0,
          maior: { perguntaId: "clima", valor: 4 },
          menor: { perguntaId: "clima", valor: 4 },
        },
      });
      const ultima = await get(
        `/v1/pesquisas/${id}/respostas/${segunda!.id}`,
        rhA,
      ).expect(200);
      expect(ultima.body).toMatchObject({
        numero: 2,
        anteriorId: null,
        proximaId: primeira!.id,
        posicao: 1,
      });
      // Resposta de outra pesquisa (ou inexistente): 404; o master não lê.
      await get(`/v1/pesquisas/${id}/respostas/${randomUUID()}`, rhA).expect(
        404,
      );
      await get(
        `/v1/pesquisas/${id}/respostas/${primeira!.id}`,
        masterA,
      ).expect(403);
      const ficha = await get(
        `/v1/colaboradores/${a.id}/pesquisas`,
        rhA,
      ).expect(200);
      expect(ficha.body).toEqual([
        {
          respostaId: primeira!.id,
          pesquisaId: id,
          nome: "Pesquisa de clima sintética",
          modelo: "pulso",
          respondidaEm: expect.any(String),
          secoes: estrutura(),
          valores: RESPOSTAS_BOAS,
        },
      ]);
      const depois = await prisma.auditEvent.findMany({
        where: { action: "pesquisas_respostas_consultadas" },
        orderBy: { occurredAt: "asc" },
      });
      // Lista, 2 detalhes e a ficha (o 404 não chega a ler).
      expect(depois.length - antes).toBe(4);
      expect(depois.map((e) => e.resourceId)).toEqual(
        expect.arrayContaining([id, a.id, primeira!.id, segunda!.id]),
      );
      expect(depois.every((e) => e.resource === "resposta_pesquisa")).toBe(
        true,
      );
    });

    it("edição depois das respostas: perguntas e identificação travadas; nome, prazo e inclusão livres", async () => {
      const base = corpo({
        participantes: { todos: false, colaboradorIds: [a.id, b.id] },
      });
      const mudouPergunta = estrutura();
      mudouPergunta[0]!.perguntas[2]!.texto = "Outro texto";
      const r409 = await put(`/v1/pesquisas/${id}`, rhA)
        .send({ ...base, secoes: mudouPergunta })
        .expect(409);
      expect(r409.body.erros).toEqual([
        { campo: "secoes", motivo: "com_respostas" },
      ]);
      const r422 = await put(`/v1/pesquisas/${id}`, rhA)
        .send({ ...base, identificacao: "anonima" })
        .expect(422);
      expect(r422.body.erros).toEqual([
        { campo: "identificacao", motivo: "nao_editavel" },
      ]);
      // Quem respondeu não sai.
      await put(`/v1/pesquisas/${id}`, rhA)
        .send({
          ...base,
          participantes: { todos: false, colaboradorIds: [a.id] },
        })
        .expect(409);
      const c = await admitir(rhA, empresaA);
      const ok = await put(`/v1/pesquisas/${id}`, rhA)
        .send({
          ...base,
          nome: "Clima renomeada",
          boasVindas: "Novas boas-vindas.",
          encerraEm: `${somarDias(HOJE, 10)}T18:30`,
          minimoPorGrupo: 5,
          participantes: { todos: false, colaboradorIds: [a.id, b.id, c.id] },
        })
        .expect(200);
      expect(ok.body).toMatchObject({
        nome: "Clima renomeada",
        boasVindas: "Novas boas-vindas.",
        // Data e hora de Brasília, em ISO com o fuso.
        encerraEm: `${somarDias(HOJE, 10)}T18:30:00-03:00`,
        minimoPorGrupo: 5,
        participantes: 3,
        participantesTotal: 3,
        responderam: 2,
        pendentes: 1,
        respostas: 2,
        temRespostas: true,
        status: "ativa",
      });
      const linha = await prisma.pesquisa.findUniqueOrThrow({ where: { id } });
      expect(linha.encerraEm!.toISOString()).toBe(
        `${somarDias(HOJE, 10)}T21:30:00.000Z`,
      );
      // Só a data (formato antigo): até 23:59.
      const soData = await put(`/v1/pesquisas/${id}`, rhA)
        .send({
          ...base,
          encerraEm: somarDias(HOJE, 11),
          participantes: { todos: false, colaboradorIds: [a.id, b.id, c.id] },
        })
        .expect(200);
      expect(soData.body.encerraEm).toBe(
        `${somarDias(HOJE, 11)}T23:59:00-03:00`,
      );
      // Pausada também edita (nome e inclusão), com as mesmas travas.
      await post(`/v1/pesquisas/${id}/status`, rhA)
        .send({ status: "pausada" })
        .expect(200);
      const d = await admitir(rhA, empresaA);
      const pausada = await put(`/v1/pesquisas/${id}`, rhA)
        .send({
          ...base,
          nome: "Clima pausada",
          participantes: {
            todos: false,
            colaboradorIds: [a.id, b.id, c.id, d.id],
          },
        })
        .expect(200);
      expect(pausada.body).toMatchObject({
        nome: "Clima pausada",
        status: "pausada",
        participantesTotal: 4,
        responderam: 2,
        pendentes: 2,
      });
      await put(`/v1/pesquisas/${id}`, rhA)
        .send({
          ...base,
          participantes: { todos: false, colaboradorIds: [b.id, c.id, d.id] },
        })
        .expect(409);
      await put(`/v1/pesquisas/${id}`, rhA)
        .send({ ...base, secoes: mudouPergunta })
        .expect(409);
      await post(`/v1/pesquisas/${id}/status`, rhA)
        .send({ status: "ativa" })
        .expect(200);
      // Quem não respondeu pode sair.
      await put(`/v1/pesquisas/${id}`, rhA)
        .send({
          ...base,
          participantes: { todos: false, colaboradorIds: [a.id, b.id] },
        })
        .expect(200);
      const eventos = await trilha(id);
      expect(
        eventos.filter((e) => e.action === "pesquisas_pesquisa_alterada"),
      ).toHaveLength(4);
    });
  });

  // -----------------------------------------------------------------------
  describe("confidencial", () => {
    it("valida a pessoa, mas a resposta não guarda quem respondeu", async () => {
      const a = await admitir(rhA, empresaA);
      const b = await admitir(rhA, empresaA);
      const c = await admitir(rhA, empresaA);
      const ativos = await prisma.vinculoFuncional.count({
        where: { empresaId: empresaA, situacao: "ativo" },
      });
      const rascunho = await criarPesquisa({
        identificacao: "confidencial",
        participantes: { todos: true },
      });
      expect(rascunho.participantes).toBe(ativos);
      const r = await post(`/v1/pesquisas/${rascunho.id}/publicar`, rhA)
        .send()
        .expect(200);
      expect(r.body.todos).toBe(true);
      expect(r.body.participantes).toBe(ativos);
      const token = (r.body.link as string).replace("#/p/", "");

      await responderComo(token, a);
      await identificar(token, a).expect(409);

      const respostas = await prisma.pesquisaResposta.findMany({
        where: { pesquisaId: rascunho.id },
      });
      expect(respostas).toHaveLength(1);
      expect(respostas[0]!.colaboradorId).toBeNull();
      expect(respostas[0]!.departamentoId).not.toBeNull();
      expect(respostas[0]!.unidadeId).not.toBeNull();
      expect(respostas[0]!.centroCustoId).toBeNull();
      // Só o dia: nada de horário na resposta nem no participante.
      expect(respostas[0]!.respondidaEm.toISOString()).toBe(
        `${HOJE}T00:00:00.000Z`,
      );
      const participante = await prisma.pesquisaParticipante.findFirstOrThrow({
        where: { pesquisaId: rascunho.id, colaboradorId: a.id },
      });
      expect(participante.respondeuEm!.toISOString()).toBe(
        `${HOJE}T00:00:00.000Z`,
      );
      expect(
        await prisma.pesquisaPasse.count({
          where: { pesquisaId: rascunho.id },
        }),
      ).toBe(0);

      // O RH vê só true/false na lista e o agregado, nunca a pessoa.
      const det = await get(`/v1/pesquisas/${rascunho.id}`, rhA).expect(200);
      const linha = det.body.participantesLista.find(
        (x: { colaboradorId: string }) => x.colaboradorId === a.id,
      );
      expect(linha.respondeu).toBe(true);
      await get(`/v1/pesquisas/${rascunho.id}/respostas`, rhA).expect(404);

      // Abaixo do mínimo (3), nem a visão geral mostra números: com uma
      // resposta e a lista de quem respondeu, o agregado seria a pessoa.
      const resultados = () =>
        get(`/v1/pesquisas/${rascunho.id}/resultados`, rhA).expect(200);
      const poucas = await resultados();
      expect(poucas.body).toMatchObject({
        respostas: 1,
        participantes: ativos,
        filtro: { departamentoId: null, visivel: false },
        perguntas: [],
      });
      await responderComo(token, b);
      expect((await resultados()).body.filtro.visivel).toBe(false);
      await responderComo(token, c);
      const res = await resultados();
      expect(res.body.filtro).toMatchObject({
        departamentoId: null,
        visivel: true,
      });
      const porque = res.body.perguntas.find(
        (p: { perguntaId: string }) => p.perguntaId === "porque",
      );
      expect(porque.textos).toEqual([
        { texto: "Mais reuniões curtas.", autor: null },
        { texto: "Mais reuniões curtas.", autor: null },
        { texto: "Mais reuniões curtas.", autor: null },
      ]);
      const ficha = await get(
        `/v1/colaboradores/${a.id}/pesquisas`,
        rhA,
      ).expect(200);
      expect(ficha.body).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  describe("participantes identificáveis pelo link", () => {
    it("avisa quem não tem CPF ou nascimento no perfil, sem expor os dados", async () => {
      const completo = await admitir(rhA, empresaA);
      const semCpf = await admitir(rhA, empresaA);
      const semNascimento = await admitir(rhA, empresaA);
      await prisma.perfilPessoalColaborador.updateMany({
        where: { colaboradorId: semCpf.id, empresaId: empresaA },
        data: { cpf: null },
      });
      await prisma.perfilPessoalColaborador.updateMany({
        where: { colaboradorId: semNascimento.id, empresaId: empresaA },
        data: { dataNascimento: null },
      });
      const ids = [completo.id, semCpf.id, semNascimento.id];
      const marcas = (
        lista: { colaboradorId: string; identificavel: boolean }[],
      ) =>
        Object.fromEntries(
          lista.map((x) => [x.colaboradorId, x.identificavel]),
        );

      for (const identificacao of ["identificada", "confidencial"] as const) {
        const p = await criarPesquisa({
          identificacao,
          participantes: { todos: false, colaboradorIds: ids },
        });
        const r = await get(`/v1/pesquisas/${p.id}`, rhA).expect(200);
        expect(r.body.naoIdentificaveis).toBe(2);
        expect(marcas(r.body.participantesLista)).toEqual({
          [completo.id]: true,
          [semCpf.id]: false,
          [semNascimento.id]: false,
        });
        const texto = JSON.stringify(r.body);
        expect(texto).not.toContain(completo.cpf);
        expect(texto).not.toContain(NASCIMENTO);
        expect(r.body.participantesLista[0]).not.toHaveProperty("cpf");
      }
      // Quem não é identificável de fato não entra pelo link.
      const { token } = await publicada({
        participantes: { todos: false, colaboradorIds: ids },
      });
      await identificar(token, semNascimento).expect(401);
      await identificar(token, completo).expect(200);

      // Publicar com NINGUÉM identificável: 422 até a confirmação.
      const ninguem = await criarPesquisa({
        participantes: {
          todos: false,
          colaboradorIds: [semCpf.id, semNascimento.id],
        },
      });
      const recusa = await post(`/v1/pesquisas/${ninguem.id}/publicar`, rhA)
        .send()
        .expect(422);
      expect(recusa.body.erros).toEqual([
        { campo: "participantes", motivo: "ninguem_identificavel" },
      ]);
      await post(`/v1/pesquisas/${ninguem.id}/publicar`, rhA)
        .send({ confirmarSemIdentificaveis: false })
        .expect(422);
      const confirmada = await post(`/v1/pesquisas/${ninguem.id}/publicar`, rhA)
        .send({ confirmarSemIdentificaveis: true })
        .expect(200);
      expect(confirmada.body.status).toBe("ativa");

      const anonima = await criarPesquisa({
        identificacao: "anonima",
        participantes: { todos: false, colaboradorIds: ids },
      });
      const r = await get(`/v1/pesquisas/${anonima.id}`, rhA).expect(200);
      expect(r.body.naoIdentificaveis).toBe(0);
      expect(
        r.body.participantesLista.every(
          (x: { identificavel: boolean }) => x.identificavel,
        ),
      ).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  describe("anônima", () => {
    it("sem participantes, com separação por grupo; nada liga a pessoa", async () => {
      const lot = await lotacaoMinima(appUrl, empresaA);
      const a = await admitir(rhA, empresaA);
      const rascunho = await criarPesquisa({
        identificacao: "anonima",
        separarPor: ["departamento", "unidade"],
        // Ignorados na anônima.
        participantes: { todos: false, colaboradorIds: [a.id] },
      });
      expect(rascunho).toMatchObject({ participantes: null });
      const det0 = await get(`/v1/pesquisas/${rascunho.id}`, rhA).expect(200);
      expect(det0.body).toMatchObject({
        participantes: null,
        participantesLista: [],
        naoIdentificaveis: 0,
        separarPor: ["departamento", "unidade"],
      });
      // Publica sem participante nenhum.
      const pub = await post(`/v1/pesquisas/${rascunho.id}/publicar`, rhA)
        .send()
        .expect(200);
      const id = rascunho.id;
      const token = (pub.body.link as string).replace("#/p/", "");
      expect(
        await prisma.pesquisaParticipante.count({ where: { pesquisaId: id } }),
      ).toBe(0);

      const abertura = await agent().get(publico(token)).expect(200);
      expect(
        abertura.body.grupos.map((g: { campo: string; rotulo: string }) => [
          g.campo,
          g.rotulo,
        ]),
      ).toEqual([
        ["departamento", "Departamento"],
        ["unidade", "Unidade"],
      ]);
      expect(abertura.body.grupos[0].opcoes).toContainEqual({
        id: lot.departamentoId,
        nome: "Departamento T179 Sintetico",
      });
      await identificar(token, a).expect(404);

      // Grupo fora da pesquisa ou inexistente: 422; "não informar", ok.
      for (const grupos of [
        { centroCusto: randomUUID() },
        { departamento: randomUUID() },
        { qualquer: null },
      ]) {
        const r = await agent()
          .post(publico(token, "/respostas"))
          .send({ grupos, respostas: RESPOSTAS_BOAS })
          .expect(422);
        expect(r.body.erros).toEqual([{ campo: "grupos", motivo: "invalido" }]);
      }
      for (const grupos of [
        { departamento: lot.departamentoId, unidade: null },
        { departamento: lot.departamentoId },
        undefined,
      ]) {
        await agent()
          .post(publico(token, "/respostas"))
          .send({ grupos, respostas: RESPOSTAS_BOAS })
          .expect(201);
      }
      const respostas = await prisma.pesquisaResposta.findMany({
        where: { pesquisaId: id },
      });
      expect(respostas).toHaveLength(3);
      expect(respostas.every((r) => r.colaboradorId === null)).toBe(true);
      expect(
        respostas.filter((r) => r.departamentoId === lot.departamentoId),
      ).toHaveLength(2);
      expect(respostas.every((r) => r.unidadeId === null)).toBe(true);

      // Resultados: sem participantes; recortes = os da separação, com o
      // mínimo por grupo (3).
      const res = await get(`/v1/pesquisas/${id}/resultados`, rhA).expect(200);
      expect(res.body).toMatchObject({
        participantes: null,
        respostas: 3,
        recortes: ["departamento", "unidade"],
        filtro: { departamentoId: null, visivel: true },
      });
      expect(res.body.perguntas).toHaveLength(5);
      expect(res.body.grupos.departamento).toEqual([
        {
          id: lot.departamentoId,
          nome: "Departamento T179 Sintetico",
          respostas: 2,
          visivel: false,
          oculto: "minimo",
        },
      ]);
      const recorte = await get(
        `/v1/pesquisas/${id}/resultados?campo=departamento&grupoId=${lot.departamentoId}`,
        rhA,
      ).expect(200);
      expect(recorte.body.filtro).toEqual({
        campo: "departamento",
        grupoId: lot.departamentoId,
        departamentoId: lot.departamentoId,
        respostas: 2,
        visivel: false,
      });
      expect(recorte.body.perguntas).toEqual([]);
      await get(`/v1/pesquisas/${id}/analises?campo=centroCusto`, rhA).expect(
        422,
      );
      const analises = await get(
        `/v1/pesquisas/${id}/analises?campo=departamento`,
        rhA,
      ).expect(200);
      expect(analises.body.linhas[1]).toMatchObject({
        grupoId: lot.departamentoId,
        visivel: false,
        media: null,
      });

      // Respostas individuais numeradas, sem pessoa.
      const lista = await get(`/v1/pesquisas/${id}/respostas`, rhA).expect(200);
      // Da mais recente para a mais antiga.
      expect(lista.body.map((x: { numero: number }) => x.numero)).toEqual([
        3, 2, 1,
      ]);
      expect(
        lista.body.every(
          (x: {
            nome: unknown;
            colaboradorId: unknown;
            departamento: unknown;
          }) =>
            x.nome === null &&
            x.colaboradorId === null &&
            x.departamento === null,
        ),
      ).toBe(true);
      const meio = await get(
        `/v1/pesquisas/${id}/respostas/${lista.body[1].id}`,
        rhA,
      ).expect(200);
      expect(meio.body).toMatchObject({
        numero: 2,
        posicao: 2,
        total: 3,
        anteriorId: lista.body[0].id,
        proximaId: lista.body[2].id,
        nome: null,
        // O grupo escolhido, com a mesma regra de ocultação.
        grupos: [
          { campo: "departamento", grupo: null, oculto: "minimo" },
          { campo: "unidade", grupo: null, oculto: null },
        ],
        // Na anônima não há como ligar a pessoa às pesquisas anteriores.
        indicadores: { mediaUltimosPulsos: null },
      });
    });

    it("lista de respostas: o grupo escolhido ou 'oculto' (mínimo e proteção do menor)", async () => {
      const lot = await lotacaoMinima(appUrl, empresaA);
      const outro = await prisma.departamento.create({
        data: {
          empresaId: empresaA,
          codigo: "T216_ANON_DEP",
          nome: "Departamento Anonimo Sintetico",
        },
      });
      const { id, token } = await publicada({
        identificacao: "anonima",
        separarPor: ["departamento"],
      });
      const enviar = (departamento: string | null) =>
        agent()
          .post(publico(token, "/respostas"))
          .send({ grupos: { departamento }, respostas: RESPOSTAS_BOAS })
          .expect(201);
      for (let i = 0; i < 3; i += 1) await enviar(lot.departamentoId);
      await enviar(outro.id);
      const grupoDe = async () =>
        (await get(`/v1/pesquisas/${id}/respostas`, rhA).expect(200)).body.map(
          (x: { numero: number; grupos: unknown[] }) => [x.numero, x.grupos],
        );
      // 3 e 1, ninguém sem grupo: o de 3 protege o de 1.
      expect(await grupoDe()).toEqual([
        [4, [{ campo: "departamento", grupo: null, oculto: "minimo" }]],
        [
          3,
          [
            {
              campo: "departamento",
              grupo: null,
              oculto: "protege_grupo_menor",
            },
          ],
        ],
        [
          2,
          [
            {
              campo: "departamento",
              grupo: null,
              oculto: "protege_grupo_menor",
            },
          ],
        ],
        [
          1,
          [
            {
              campo: "departamento",
              grupo: null,
              oculto: "protege_grupo_menor",
            },
          ],
        ],
      ]);
      const filtrado = await get(
        `/v1/pesquisas/${id}/resultados?campo=departamento&grupoId=${lot.departamentoId}`,
        rhA,
      ).expect(200);
      expect(filtrado.body.filtro).toMatchObject({
        respostas: 3,
        visivel: false,
      });
      // Uma resposta sem grupo: o de 1 já não pode ser deduzido; o de 3
      // aparece (na lista e nos resultados), o de 1 continua oculto.
      await enviar(null);
      const depois = await grupoDe();
      expect(depois[0]).toEqual([
        5,
        [{ campo: "departamento", grupo: null, oculto: null }],
      ]);
      expect(depois[1]).toEqual([
        4,
        [{ campo: "departamento", grupo: null, oculto: "minimo" }],
      ]);
      expect(depois[2]).toEqual([
        3,
        [
          {
            campo: "departamento",
            grupo: "Departamento T179 Sintetico",
            oculto: null,
          },
        ],
      ]);
      const visivel = await get(
        `/v1/pesquisas/${id}/resultados?campo=departamento&grupoId=${lot.departamentoId}`,
        rhA,
      ).expect(200);
      expect(visivel.body.filtro).toMatchObject({
        respostas: 3,
        visivel: true,
      });
      expect(visivel.body.perguntas).toHaveLength(5);
    });

    it("separar por: só na anônima, até 2 campos, sem repetir", async () => {
      const r = await post("/v1/pesquisas", rhA)
        .send(corpo({ separarPor: ["departamento"] }))
        .expect(422);
      expect(r.body.erros).toEqual([
        { campo: "separarPor", motivo: "nao_se_aplica" },
      ]);
      const tres = await post("/v1/pesquisas", rhA)
        .send(
          corpo({
            identificacao: "anonima",
            separarPor: ["departamento", "centroCusto", "unidade"],
          }),
        )
        .expect(422);
      expect(tres.body.erros).toEqual([
        { campo: "separarPor", motivo: "limite" },
      ]);
      const repetido = await post("/v1/pesquisas", rhA)
        .send(
          corpo({
            identificacao: "anonima",
            separarPor: ["unidade", "unidade"],
          }),
        )
        .expect(422);
      expect(repetido.body.erros).toEqual([
        { campo: "separarPor", motivo: "invalido" },
      ]);
      await post("/v1/pesquisas", rhA)
        .send(corpo({ identificacao: "anonima", separarPor: ["cargo"] }))
        .expect(400);
    });
  });

  // -----------------------------------------------------------------------
  describe("limite de tentativas", () => {
    it("5 erradas por IP e pesquisa em 15 minutos; a 6ª é 429, mesmo certa", async () => {
      const a = await admitir(rhA, empresaA);
      const { id, token } = await publicada({
        identificacao: "confidencial",
        participantes: { todos: false, colaboradorIds: [a.id] },
      });
      for (let i = 0; i < 5; i += 1) {
        await agent()
          .post(publico(token, "/identificar"))
          .send({ cpf: "000.000.000-00", dataNascimento: NASCIMENTO })
          .expect(401);
      }
      await identificar(token, a).expect(429);
      // Não guarda o CPF nem a data tentados.
      const tentativas = await prisma.pesquisaTentativa.findMany({
        where: { pesquisaId: id },
      });
      expect(tentativas).toHaveLength(5);
      expect(Object.keys(tentativas[0]!).sort()).toEqual(
        ["criadaEm", "id", "ip", "pesquisaId"].sort(),
      );
      // Outra pesquisa não herda o limite.
      const outra = await publicada({
        identificacao: "confidencial",
        participantes: { todos: false, colaboradorIds: [a.id] },
      });
      await identificar(outra.token, a).expect(200);
      // Janela vencida: volta a aceitar.
      await prisma.pesquisaTentativa.updateMany({
        where: { pesquisaId: id },
        data: { criadaEm: new Date(Date.now() - 16 * 60_000) },
      });
      await identificar(token, a).expect(200);
    });
  });

  // -----------------------------------------------------------------------
  describe("mínimo por grupo (recorte por departamento)", () => {
    it("grupo abaixo do mínimo não mostra números", async () => {
      const lot = await lotacaoMinima(appUrl, empresaA);
      const outroDep = await prisma.departamento.create({
        data: {
          empresaId: empresaA,
          codigo: "T216_DEP",
          nome: "Departamento T216 Sintetico",
        },
      });
      const centro = await prisma.centroCusto.create({
        data: {
          empresaId: empresaA,
          codigo: "T216_CC",
          nome: "Centro T216 Sintetico",
        },
      });
      const grandes = [
        await admitir(rhA, empresaA, undefined, centro.id),
        await admitir(rhA, empresaA, undefined, centro.id),
        await admitir(rhA, empresaA, undefined, centro.id),
      ];
      const pequeno = await admitir(rhA, empresaA, outroDep.id);
      const todos = [...grandes, pequeno];
      const { id, token } = await publicada({
        modelo: "pulso",
        participantes: { todos: false, colaboradorIds: todos.map((p) => p.id) },
      });
      for (const p of todos) await responderComo(token, p);

      const geral = await get(`/v1/pesquisas/${id}/resultados`, rhA).expect(
        200,
      );
      // Só dois departamentos e ninguém sem departamento: o total menos o
      // maior daria o menor. O maior fica oculto para protegê-lo.
      expect(geral.body.departamentos).toEqual([
        {
          id: lot.departamentoId,
          nome: "Departamento T179 Sintetico",
          respostas: 3,
          visivel: false,
          oculto: "protege_grupo_menor",
        },
        {
          id: outroDep.id,
          nome: "Departamento T216 Sintetico",
          respostas: 1,
          visivel: false,
          oculto: "minimo",
        },
      ]);
      const abaixo = await get(
        `/v1/pesquisas/${id}/resultados?departamentoId=${outroDep.id}`,
        rhA,
      ).expect(200);
      expect(abaixo.body.filtro).toEqual({
        campo: "departamento",
        grupoId: outroDep.id,
        departamentoId: outroDep.id,
        respostas: 1,
        visivel: false,
      });
      expect(abaixo.body.perguntas).toEqual([]);
      const acima = await get(
        `/v1/pesquisas/${id}/resultados?departamentoId=${lot.departamentoId}`,
        rhA,
      ).expect(200);
      // Acima do mínimo, mas protegendo o menor: sem números.
      expect(acima.body.filtro).toMatchObject({ respostas: 3, visivel: false });
      expect(acima.body.perguntas).toEqual([]);

      // Centro de custo, pela lotação vigente (identificada).
      // Um centro só, e uma pessoa sem centro: nada a proteger.
      expect(geral.body.grupos.centroCusto).toEqual([
        {
          id: centro.id,
          nome: "Centro T216 Sintetico",
          respostas: 3,
          visivel: true,
          oculto: null,
        },
      ]);
      const porCentro = await get(
        `/v1/pesquisas/${id}/resultados?campo=centroCusto&grupoId=${centro.id}`,
        rhA,
      ).expect(200);
      expect(porCentro.body.filtro).toEqual({
        campo: "centroCusto",
        grupoId: centro.id,
        departamentoId: null,
        respostas: 3,
        visivel: true,
      });
      expect(porCentro.body.indicadores.mediaGeral).toBe(8);

      // Análises: o mapa (clima 4 de 5 → 8 de 10) e a evolução do modelo.
      const mapa = await get(
        `/v1/pesquisas/${id}/analises?campo=departamento`,
        rhA,
      ).expect(200);
      expect(mapa.body).toEqual({
        campo: "departamento",
        colunas: [{ perguntaId: "clima", rotulo: "Respeito" }],
        linhas: [
          {
            grupoId: null,
            nome: "Toda a empresa",
            respostas: 4,
            visivel: true,
            oculto: null,
            media: 8,
            medias: [8],
          },
          {
            grupoId: lot.departamentoId,
            nome: "Departamento T179 Sintetico",
            respostas: 3,
            visivel: false,
            oculto: "protege_grupo_menor",
            media: null,
            medias: [null],
          },
          {
            grupoId: outroDep.id,
            nome: "Departamento T216 Sintetico",
            respostas: 1,
            visivel: false,
            oculto: "minimo",
            media: null,
            medias: [null],
          },
        ],
        // Os pulsos de testes anteriores da mesma empresa também entram;
        // esta pesquisa, a mais recente, fecha a lista.
        evolucao: expect.any(Array),
      });
      expect(mapa.body.evolucao.at(-1)).toEqual({
        pesquisaId: id,
        nome: "Pesquisa de clima sintética",
        publicadaEm: expect.any(String),
        mediaGeral: 8,
      });
      await get(`/v1/pesquisas/${id}/analises`, rhA).expect(400);
      // Um pulso publicado sem resposta não entra na evolução.
      await publicada({
        modelo: "pulso",
        nome: "Pulso sem respostas",
        participantes: {
          todos: false,
          colaboradorIds: grandes.map((p) => p.id),
        },
      });
      // Segundo pulso: a evolução traz os dois, o mais antigo primeiro.
      const segundo = await publicada({
        modelo: "pulso",
        nome: "Pulso seguinte",
        participantes: {
          todos: false,
          colaboradorIds: grandes.map((p) => p.id),
        },
      });
      for (const p of grandes) {
        await responderComo(segundo.token, p, [
          { perguntaId: "gosta", valor: "sim" },
          { perguntaId: "clima", valor: 2 },
        ]);
      }
      const evolucao = await get(
        `/v1/pesquisas/${segundo.id}/analises?campo=unidade`,
        rhA,
      ).expect(200);
      expect(
        evolucao.body.evolucao
          .slice(-2)
          .map((e: { pesquisaId: string; mediaGeral: number }) => [
            e.pesquisaId,
            e.mediaGeral,
          ]),
      ).toEqual([
        [id, 8],
        [segundo.id, 4],
      ]);

      // Resultado individual: a média da MESMA pessoa nos pulsos anteriores
      // (só na identificada; o primeiro pulso não tem anterior).
      const listaDoSegundo = await get(
        `/v1/pesquisas/${segundo.id}/respostas`,
        rhA,
      ).expect(200);
      const respostaDoSegundo = listaDoSegundo.body.find(
        (x: { colaboradorId: string }) => x.colaboradorId === grandes[0]!.id,
      );
      const detalheDoSegundo = await get(
        `/v1/pesquisas/${segundo.id}/respostas/${respostaDoSegundo.id}`,
        rhA,
      ).expect(200);
      expect(detalheDoSegundo.body.indicadores).toMatchObject({
        media: 4,
        mediaUltimosPulsos: 8,
      });
      const listaDoPrimeiro = await get(
        `/v1/pesquisas/${id}/respostas`,
        rhA,
      ).expect(200);
      const respostaDoPrimeiro = listaDoPrimeiro.body.find(
        (x: { colaboradorId: string }) => x.colaboradorId === grandes[0]!.id,
      );
      const detalheDoPrimeiro = await get(
        `/v1/pesquisas/${id}/respostas/${respostaDoPrimeiro.id}`,
        rhA,
      ).expect(200);
      expect(detalheDoPrimeiro.body.indicadores.mediaUltimosPulsos).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  describe("status e transições", () => {
    it("publicar exige pergunta e participante", async () => {
      const vazia = await criarPesquisa({
        secoes: [{ id: "s", titulo: null, descricao: null, perguntas: [] }],
      });
      const r = await post(`/v1/pesquisas/${vazia.id}/publicar`, rhA)
        .send()
        .expect(422);
      expect(r.body.erros).toEqual([
        { campo: "secoes", motivo: "obrigatorio" },
        { campo: "participantes", motivo: "obrigatorio" },
      ]);
    });

    it("transições válidas e inválidas (409); pausada e cancelada não aceitam resposta", async () => {
      const a = await admitir(rhA, empresaA);
      const rascunho = await criarPesquisa({
        participantes: { todos: false, colaboradorIds: [a.id] },
      });
      await post(`/v1/pesquisas/${rascunho.id}/status`, rhA)
        .send({ status: "ativa" })
        .expect(409);
      const pub = await post(`/v1/pesquisas/${rascunho.id}/publicar`, rhA)
        .send()
        .expect(200);
      const token = (pub.body.link as string).replace("#/p/", "");
      await post(`/v1/pesquisas/${rascunho.id}/publicar`, rhA)
        .send()
        .expect(409);
      await post(`/v1/pesquisas/${rascunho.id}/status`, rhA)
        .send({ status: "ativa" })
        .expect(409);
      await post(`/v1/pesquisas/${rascunho.id}/status`, rhA)
        .send({ status: "pausada" })
        .expect(200);
      expect((await agent().get(publico(token)).expect(200)).body).toEqual({
        indisponivel: "pausada",
      });
      await identificar(token, a).expect(410);
      await agent()
        .post(publico(token, "/respostas"))
        .send({ respostas: RESPOSTAS_BOAS })
        .expect(410);
      await post(`/v1/pesquisas/${rascunho.id}/status`, rhA)
        .send({ status: "ativa" })
        .expect(200);
      await post(`/v1/pesquisas/${rascunho.id}/status`, rhA)
        .send({ status: "cancelada" })
        .expect(200);
      expect((await agent().get(publico(token)).expect(200)).body).toEqual({
        indisponivel: "cancelada",
      });
      await post(`/v1/pesquisas/${rascunho.id}/status`, rhA)
        .send({ status: "ativa" })
        .expect(409);
      await put(`/v1/pesquisas/${rascunho.id}`, rhA).send(corpo()).expect(409);
      await post(`/v1/pesquisas/${rascunho.id}/status`, rhA)
        .send({ status: "qualquer" })
        .expect(400);
      const eventos = await trilha(rascunho.id);
      expect(
        eventos.filter(
          (e) => e.action === "pesquisas_pesquisa_status_alterado",
        ),
      ).toHaveLength(3);
    });

    it("prazo vencido conta como finalizada (lista, detalhe, link e edição)", async () => {
      const a = await admitir(rhA, empresaA);
      const { id, token } = await publicada({
        encerraEm: `${somarDias(HOJE, 1)}T09:00`,
        participantes: { todos: false, colaboradorIds: [a.id] },
      });
      expect(
        (await get(`/v1/pesquisas/${id}`, rhA).expect(200)).body.status,
      ).toBe("ativa");
      // O vencimento é pelo instante: um minuto atrás já encerrou.
      await prisma.pesquisa.update({
        where: { id },
        data: { encerraEm: new Date(Date.now() - 60_000) },
      });
      expect(
        (await get(`/v1/pesquisas/${id}`, rhA).expect(200)).body.status,
      ).toBe("finalizada");
      const finalizadas = await get(
        "/v1/pesquisas?status=finalizada",
        rhA,
      ).expect(200);
      expect(finalizadas.body.itens.map((i: { id: string }) => i.id)).toContain(
        id,
      );
      expect((await agent().get(publico(token)).expect(200)).body).toEqual({
        indisponivel: "encerrada",
      });
      // Finalizada edita, mas tirar (ou mudar) o encerramento a reabriria.
      const travado = await put(`/v1/pesquisas/${id}`, rhA)
        .send(
          corpo({ participantes: { todos: false, colaboradorIds: [a.id] } }),
        )
        .expect(422);
      expect(travado.body.erros).toEqual([
        { campo: "encerraEm", motivo: "nao_editavel" },
      ]);
      await post(`/v1/pesquisas/${id}/status`, rhA)
        .send({ status: "pausada" })
        .expect(409);
    });

    it("finalizada à mão: o link diz 'finalizada' (não 'encerrada')", async () => {
      const a = await admitir(rhA, empresaA);
      const { id, token } = await publicada({
        participantes: { todos: false, colaboradorIds: [a.id] },
      });
      await post(`/v1/pesquisas/${id}/status`, rhA)
        .send({ status: "finalizada" })
        .expect(200);
      expect((await agent().get(publico(token)).expect(200)).body).toEqual({
        indisponivel: "finalizada",
      });
      await identificar(token, a).expect(410);
      // A finalizada continua editável (nome), sem voltar a aceitar respostas.
      const editada = await put(`/v1/pesquisas/${id}`, rhA)
        .send(
          corpo({
            nome: "Finalizada renomeada",
            participantes: { todos: false, colaboradorIds: [a.id] },
          }),
        )
        .expect(200);
      expect(editada.body.nome).toBe("Finalizada renomeada");
      expect(editada.body.status).toBe("finalizada");
      await identificar(token, a).expect(410);
    });

    it("prazo com hora: no passado (mesmo de hoje) é 422; formato errado é 400", async () => {
      const passado = new Date(Date.now() - 2 * 60 * 60_000);
      const brasilia = new Date(passado.getTime() - 3 * 60 * 60_000)
        .toISOString()
        .slice(0, 16);
      const r = await post("/v1/pesquisas", rhA)
        .send(corpo({ encerraEm: brasilia }))
        .expect(422);
      expect(r.body.erros).toEqual([
        { campo: "encerraEm", motivo: "invalido" },
      ]);
      await post("/v1/pesquisas", rhA)
        .send(corpo({ encerraEm: `${somarDias(HOJE, 3)}T25:00` }))
        .expect(422);
      await post("/v1/pesquisas", rhA)
        .send(corpo({ encerraEm: `${somarDias(HOJE, 3)} 10:00` }))
        .expect(400);
    });

    it("prazo no passado e estrutura inválida: 422 por campo", async () => {
      const r = await post("/v1/pesquisas", rhA)
        .send(corpo({ encerraEm: somarDias(HOJE, -1) }))
        .expect(422);
      expect(r.body.erros).toEqual([
        { campo: "encerraEm", motivo: "invalido" },
      ]);
      const secoes = estrutura();
      secoes[0]!.perguntas[0]!.texto = "";
      const e = await post("/v1/pesquisas", rhA)
        .send(corpo({ secoes, nome: "x".repeat(121) }))
        .expect(422);
      expect(e.body.erros).toEqual([
        { campo: "nome", motivo: "limite" },
        { campo: "gosta", motivo: "obrigatorio" },
      ]);
      await post("/v1/pesquisas", rhA)
        .send(corpo({ minimoPorGrupo: 2 }))
        .expect(400);
    });
  });

  // -----------------------------------------------------------------------
  describe("modelos com cálculo próprio (metodologia fixa)", () => {
    /** As 21 afirmações da TAD (escala de 1 a 7), na ordem. */
    function estruturaTad(maximo = 7) {
      return [
        {
          id: "s-tad",
          titulo: null,
          descricao: null,
          perguntas: Array.from({ length: 21 }, (_, i) => {
            const chave = `tad_${String(i + 1).padStart(2, "0")}`;
            return {
              id: `q-${chave}`,
              chave,
              tipo: "escala",
              texto: `Afirmação ${i + 1}`,
              descricao: null,
              obrigatoria: true,
              config: { minimo: 1, maximo },
              condicao: null,
            };
          }),
        },
      ];
    }

    it("TAD: a estrutura é conferida; o resultado do time e da pessoa saem da API", async () => {
      // Pergunta livre num modelo fixo: 422 estrutura_do_modelo.
      const livre = await post("/v1/pesquisas", rhA)
        .send(corpo({ modelo: "tad" }))
        .expect(422);
      expect(livre.body.erros).toEqual([
        { campo: "secoes", motivo: "estrutura_do_modelo" },
      ]);
      // Escala errada: 422 também.
      await post("/v1/pesquisas", rhA)
        .send(corpo({ modelo: "tad", secoes: estruturaTad(5) }))
        .expect(422);
      // A estrutura do modelo: 201, com a chave de cada item guardada.
      const criada = await post("/v1/pesquisas", rhA)
        .send(
          corpo({
            modelo: "tad",
            identificacao: "anonima",
            secoes: estruturaTad(),
          }),
        )
        .expect(201);
      expect(criada.body.secoes[0].perguntas[2]).toMatchObject({
        id: "q-tad_03",
        chave: "tad_03",
      });
      const pub = await post(`/v1/pesquisas/${criada.body.id}/publicar`, rhA)
        .send()
        .expect(200);
      const token = (pub.body.link as string).replace("#/p/", "");
      // Tudo 7: invertidas viram 1 → 4,43 · 4,00 · 4,75 e geral 4,39.
      await agent()
        .post(publico(token, "/respostas"))
        .send({
          respostas: Array.from({ length: 21 }, (_, i) => ({
            perguntaId: `q-tad_${String(i + 1).padStart(2, "0")}`,
            valor: 7,
          })),
        })
        .expect(201);
      const res = await get(
        `/v1/pesquisas/${criada.body.id}/resultados`,
        rhA,
      ).expect(200);
      expect(res.body.modelo).toMatchObject({
        modelo: "tad",
        respondentes: 1,
        geral: 4.39,
        nivel: "moderado",
      });
      expect(
        res.body.modelo.pilares.map((p: { score: number }) => p.score),
      ).toEqual([4.43, 4, 4.75]);
      const lista = await get(
        `/v1/pesquisas/${criada.body.id}/respostas`,
        rhA,
      ).expect(200);
      const uma = await get(
        `/v1/pesquisas/${criada.body.id}/respostas/${lista.body[0].id}`,
        rhA,
      ).expect(200);
      expect(uma.body.modelo).toMatchObject({ modelo: "tad", geral: 4.39 });
      // O time ao lado da pessoa e o número da resposta na régua da TAD.
      expect(uma.body.modelo.time).toEqual({
        geral: 4.39,
        pilares: [4.43, 4, 4.75],
      });
      expect(lista.body[0].resumoDoModelo).toEqual({
        modelo: "tad",
        valor: 4.39,
        nivel: "moderado",
      });
      // Modelo sem cálculo próprio: `modelo` nulo.
      const pulso = await post("/v1/pesquisas", rhA).send(corpo()).expect(201);
      const resPulso = await get(
        `/v1/pesquisas/${pulso.body.id}/resultados`,
        rhA,
      ).expect(200);
      expect(resPulso.body.modelo).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  describe("pesquisa grande (limite do corpo JSON)", () => {
    it("60 perguntas × 20 opções × 150 caracteres: 201", async () => {
      const opcoes = Array.from({ length: 20 }, (_, i) => ({
        id: `o${i}`,
        texto: `${i} `.padEnd(150, "x"),
      }));
      const perguntas = Array.from({ length: 60 }, (_, i) => ({
        id: `grande-${i}`,
        tipo: "multipla_escolha",
        texto: `Pergunta grande ${i}`,
        descricao: null,
        obrigatoria: false,
        config: { opcoes, outro: true },
        condicao: null,
      }));
      const secoes = [
        {
          id: "s1",
          titulo: null,
          descricao: null,
          perguntas: perguntas.slice(0, 30),
        },
        {
          id: "s2",
          titulo: null,
          descricao: null,
          perguntas: perguntas.slice(30),
        },
      ];
      const corpoGrande = corpo({ secoes });
      // Acima do padrão do Express (100 KB).
      expect(JSON.stringify(corpoGrande).length).toBeGreaterThan(150_000);
      const r = await post("/v1/pesquisas", rhA).send(corpoGrande).expect(201);
      expect(r.body.secoes[1].perguntas).toHaveLength(30);
      expect(r.body.secoes[1].perguntas[29].config.opcoes).toHaveLength(20);
    });
  });

  // -----------------------------------------------------------------------
  describe("lista, duplicar e excluir", () => {
    it("lista com contagens por status e filtro", async () => {
      const r = await get("/v1/pesquisas?tamanhoPagina=2", rhA).expect(200);
      expect(r.body.itens).toHaveLength(2);
      expect(r.body.pagina).toBe(1);
      const c = r.body.contagens;
      expect(c.todas).toBe(r.body.total);
      expect(
        c.rascunho + c.ativa + c.pausada + c.finalizada + c.cancelada,
      ).toBe(c.todas);
      const rascunhos = await get("/v1/pesquisas?status=rascunho", rhA).expect(
        200,
      );
      expect(rascunhos.body.total).toBe(c.rascunho);
      expect(
        rascunhos.body.itens.every(
          (i: { status: string }) => i.status === "rascunho",
        ),
      ).toBe(true);
    });

    it("duplicar: a cópia nasce ativa, com link novo, na mesma empresa", async () => {
      const a = await admitir(rhA, empresaA);
      const prazo = `${somarDias(HOJE, 5)}T17:00`;
      const { id, token } = await publicada({
        identificacao: "confidencial",
        encerraEm: prazo,
        participantes: { todos: false, colaboradorIds: [a.id] },
      });
      const r = await post(`/v1/pesquisas/${id}/duplicar`, rhA)
        .send({})
        .expect(201);
      expect(r.body).toMatchObject({
        nome: "Pesquisa de clima sintética (cópia)",
        identificacao: "confidencial",
        status: "ativa",
        participantes: 1,
        participantesTotal: 1,
        responderam: 0,
        pendentes: 1,
        respostas: 0,
        encerraEm: `${prazo}:00-03:00`,
        secoes: estrutura(),
      });
      expect(r.body.id).not.toBe(id);
      expect(r.body.publicadaEm).not.toBeNull();
      expect(r.body.link).toMatch(/^#\/p\/[A-Za-z0-9_-]{43}$/);
      expect(r.body.link).not.toBe(`#/p/${token}`);
      // O link da cópia já funciona.
      const tokenCopia = (r.body.link as string).replace("#/p/", "");
      await agent().get(publico(tokenCopia)).expect(200);
      await identificar(tokenCopia, a).expect(200);
      const eventos = await trilha(r.body.id);
      expect(eventos.map((e) => e.action)).toEqual([
        "pesquisas_pesquisa_duplicada",
      ]);
      expect(eventos[0]!.companyId).toBe(empresaA);
    });

    it("duplicar: prazo vencido vira sem prazo; anônima sem participantes", async () => {
      const { id } = await publicada({
        identificacao: "anonima",
        separarPor: ["unidade"],
      });
      await prisma.pesquisa.update({
        where: { id },
        data: { encerraEm: new Date(Date.now() - 60_000) },
      });
      const r = await post(`/v1/pesquisas/${id}/duplicar`, rhA)
        .send()
        .expect(201);
      expect(r.body).toMatchObject({
        status: "ativa",
        encerraEm: null,
        participantes: null,
        participantesTotal: null,
        responderam: null,
        pendentes: null,
        separarPor: ["unidade"],
      });
    });

    it("duplicar em outra empresa: só se a conta a acessa; participantes = o time ativo dela", async () => {
      const a = await admitir(rhA, empresaA);
      const { id } = await publicada({
        participantes: { todos: false, colaboradorIds: [a.id] },
      });
      // Sem acesso à empresa de destino: 403.
      await post(`/v1/pesquisas/${id}/duplicar`, rhA)
        .send({ empresaId: empresaB })
        .expect(403);
      await post(`/v1/pesquisas/${id}/duplicar`, dpA)
        .send({ empresaId: empresaB })
        .expect(403);
      await post(`/v1/pesquisas/${id}/duplicar`, rhA)
        .send({ empresaId: "x" })
        .expect(400);

      // Conta de RH com acesso às duas empresas.
      const rhMulti = await criarUsuario(
        "rh.multi.pesquisas@example.test",
        "rh",
        empresaA,
      );
      const conta = await prisma.accessUser.findFirstOrThrow({
        where: { email: "rh.multi.pesquisas@example.test" },
      });
      const concedente = await prisma.accessUser.findFirstOrThrow({
        where: { email: "master.pesquisas@example.test" },
      });
      await prisma.accessUserEmpresa.create({
        data: {
          userId: conta.id,
          empresaId: empresaB,
          concedidoPorUserId: concedente.id,
        },
      });
      const deB = [await admitir(rhB, empresaB), await admitir(rhB, empresaB)];
      const r = await post(`/v1/pesquisas/${id}/duplicar`, rhMulti)
        .send({ empresaId: empresaB })
        .expect(201);
      expect(r.body).toMatchObject({
        status: "ativa",
        participantes: deB.length,
      });
      expect(
        r.body.participantesLista
          .map((x: { colaboradorId: string }) => x.colaboradorId)
          .sort(),
      ).toEqual(deB.map((x) => x.id).sort());
      // A cópia é da empresa B: o RH de B a vê; o de A, não.
      await get(`/v1/pesquisas/${r.body.id}`, rhB).expect(200);
      await get(`/v1/pesquisas/${r.body.id}`, rhA).expect(404);
      const eventos = await trilha(r.body.id);
      expect(eventos[0]).toMatchObject({
        action: "pesquisas_pesquisa_duplicada",
        companyId: empresaB,
      });
    });

    it("excluir é lógico: some de tudo; o registro e a trilha ficam", async () => {
      const a = await admitir(rhA, empresaA);
      const { id, token } = await publicada({
        participantes: { todos: false, colaboradorIds: [a.id] },
      });
      await del(`/v1/pesquisas/${id}`, rhA).expect(204);
      await get(`/v1/pesquisas/${id}`, rhA).expect(404);
      await get(`/v1/pesquisas/${id}/resultados`, rhA).expect(404);
      await del(`/v1/pesquisas/${id}`, rhA).expect(404);
      const lista = await get("/v1/pesquisas?tamanhoPagina=100", rhA).expect(
        200,
      );
      expect(lista.body.itens.map((i: { id: string }) => i.id)).not.toContain(
        id,
      );
      expect((await agent().get(publico(token)).expect(200)).body).toEqual({
        indisponivel: "inexistente",
      });
      await identificar(token, a).expect(404);
      const linha = await prisma.pesquisa.findUniqueOrThrow({ where: { id } });
      expect(linha.excluidaEm).not.toBeNull();
      expect((await trilha(id)).map((e) => e.action)).toContain(
        "pesquisas_pesquisa_excluida",
      );
    });
  });

  // -----------------------------------------------------------------------
  describe("Perfil comportamental (DISC)", () => {
    /** 28 blocos de 4 frases, uma por fator. */
    function blocosDisc() {
      return [
        {
          id: "s-disc",
          titulo: null,
          descricao: null,
          perguntas: Array.from({ length: 28 }, (_, i) => ({
            id: `b${i + 1}`,
            chave: `disc_${String(i + 1).padStart(2, "0")}`,
            tipo: "escolha_forcada",
            texto: "Qual frase combina mais com você?",
            rotulo: null,
            descricao: null,
            obrigatoria: true,
            config: {
              opcoes: ["D", "I", "S", "C"].map((fator) => ({
                id: `b${i + 1}-${fator}`,
                texto: `Frase sintética ${fator}`,
                fator,
              })),
            },
            condicao: null,
          })),
        },
      ];
    }

    const escolhas = (fatores: string) =>
      [...fatores].map((f, i) => ({
        perguntaId: `b${i + 1}`,
        valor: { opcao: `b${i + 1}-${f}` },
      }));

    const I17 = `${"I".repeat(17)}${"D".repeat(6)}SSSCC`;
    const S18 = `${"S".repeat(18)}${"C".repeat(7)}DDD`;
    const DC = `${"D".repeat(14)}${"C".repeat(14)}`;

    it("estrutura: 28 blocos válidos; o bloco não entra em outro modelo", async () => {
      const faltando = blocosDisc();
      faltando[0]!.perguntas.pop();
      const r1 = await post("/v1/pesquisas", rhA)
        .send(corpo({ modelo: "disc", secoes: faltando }))
        .expect(422);
      expect(r1.body.erros).toEqual([
        { campo: "secoes", motivo: "estrutura_do_modelo" },
      ]);

      const fatorRepetido = blocosDisc();
      fatorRepetido[0]!.perguntas[0]!.config.opcoes[3]!.fator = "D";
      const r2 = await post("/v1/pesquisas", rhA)
        .send(corpo({ modelo: "disc", secoes: fatorRepetido }))
        .expect(422);
      expect(r2.body.erros).toContainEqual({ campo: "b1", motivo: "invalido" });

      const r3 = await post("/v1/pesquisas", rhA)
        .send(corpo({ modelo: "personalizada", secoes: blocosDisc() }))
        .expect(422);
      expect(r3.body.erros).toContainEqual({
        campo: "b1",
        motivo: "nao_se_aplica",
      });

      // Outro modelo: o resultado DISC não se aplica.
      const outra = await criarPesquisa();
      const r4 = await get(
        `/v1/pesquisas/${outra.id}/perfil-comportamental`,
        rhA,
      ).expect(422);
      expect(r4.body.erros).toEqual([
        { campo: "modelo", motivo: "nao_se_aplica" },
      ]);
    });

    it("anônima: resposta pelo link, o time e as pessoas numeradas", async () => {
      const { id, token } = await publicada({
        modelo: "disc",
        identificacao: "anonima",
        secoes: blocosDisc(),
      });
      const abertura = await agent().get(publico(token)).expect(200);
      expect(abertura.body.totalPerguntas).toBe(28);
      expect(
        abertura.body.secoes[0].perguntas[0].config.opcoes.map(
          (o: { fator: string }) => o.fator,
        ),
      ).toEqual(["D", "I", "S", "C"]);

      // Frase de outro bloco e bloco faltando: 422 por pergunta.
      const r = await agent()
        .post(publico(token, "/respostas"))
        .send({
          respostas: [
            { perguntaId: "b1", valor: { opcao: "b2-D" } },
            ...escolhas(I17).slice(1, 27),
          ],
        })
        .expect(422);
      expect(r.body.erros).toEqual([
        { campo: "b1", motivo: "invalido" },
        { campo: "b28", motivo: "obrigatorio" },
      ]);

      for (const f of [I17, S18, DC]) {
        await agent()
          .post(publico(token, "/respostas"))
          .send({ respostas: escolhas(f) })
          .expect(201);
      }
      const antes = await prisma.auditEvent.count({
        where: { action: "pesquisas_respostas_consultadas", resourceId: id },
      });
      const res = await get(
        `/v1/pesquisas/${id}/perfil-comportamental`,
        rhA,
      ).expect(200);
      expect(res.headers["cache-control"]).toBe("no-store");
      expect(res.body).toMatchObject({
        pesquisaId: id,
        respostas: 3,
        totalDePessoas: 3,
        porPredominante: { D: 1, I: 1, S: 1, C: 0 },
        diversidade: { score: 79, faixa: "equilibrado", ausentes: ["C"] },
        lacunas: ["C"],
        filtro: { campo: null, respostas: 3, visivel: true },
      });
      expect(res.body.perfil.percentuais).toEqual({
        D: 27,
        I: 20,
        S: 25,
        C: 27,
      });
      expect(res.body.perfil.classe).toEqual({
        tipo: "tri",
        fatores: ["D", "C", "S"],
        codigo: "DCS",
        intensidade: "equilibrado",
      });
      const pessoas = res.body.pessoas as {
        numero: number;
        nome: string | null;
        perfil: { predominante: string };
      }[];
      expect(
        pessoas.map((p) => [p.numero, p.nome, p.perfil.predominante]),
      ).toEqual([
        [1, null, "I"],
        [2, null, "S"],
        [3, null, "D"],
      ]);
      expect(
        await prisma.auditEvent.count({
          where: { action: "pesquisas_respostas_consultadas", resourceId: id },
        }),
      ).toBe(antes + 1);

      // O master lê o time, sem as pessoas.
      const doMaster = await get(
        `/v1/pesquisas/${id}/perfil-comportamental`,
        masterA,
      ).expect(200);
      expect(doMaster.body.totalDePessoas).toBe(3);
      expect(doMaster.body.pessoas).toEqual([]);

      // Os resultados comuns contam as frases de cada bloco.
      const geral = await get(`/v1/pesquisas/${id}/resultados`, rhA).expect(
        200,
      );
      expect(geral.body.perguntas[0]).toMatchObject({
        tipo: "escolha_forcada",
        respondidas: 3,
      });
    });

    it("identificada: as pessoas com o nome; confidencial: nunca", async () => {
      const a = await admitir(rhA, empresaA);
      const { id, token } = await publicada({
        modelo: "disc",
        secoes: blocosDisc(),
        participantes: { todos: false, colaboradorIds: [a.id] },
      });
      await responderComo(token, a, escolhas(S18));
      const res = await get(
        `/v1/pesquisas/${id}/perfil-comportamental`,
        rhA,
      ).expect(200);
      expect(res.body.pessoas).toHaveLength(1);
      expect(res.body.pessoas[0]).toMatchObject({
        numero: 1,
        nome: a.nome,
        perfil: {
          predominante: "S",
          classe: { tipo: "mono", codigo: "S", intensidade: "puro" },
        },
      });

      const b = await admitir(rhA, empresaA);
      const conf = await publicada({
        modelo: "disc",
        identificacao: "confidencial",
        secoes: blocosDisc(),
        participantes: { todos: false, colaboradorIds: [b.id] },
      });
      await responderComo(conf.token, b, escolhas(DC));
      const r = await get(
        `/v1/pesquisas/${conf.id}/perfil-comportamental`,
        rhA,
      ).expect(200);
      // Abaixo do mínimo na confidencial: nada aparece.
      expect(r.body).toMatchObject({
        respostas: 1,
        totalDePessoas: 0,
        perfil: null,
        pessoas: [],
        filtro: { visivel: false },
      });
      // Outra empresa: 404.
      await get(`/v1/pesquisas/${conf.id}/perfil-comportamental`, rhB).expect(
        404,
      );
    });
  });

  // -----------------------------------------------------------------------
  describe("modelos com metodologia própria (NR-1 e saúde financeira)", () => {
    /** As 76 escalas da NR-1, com a chave do item e o id da tela. */
    function secoesNr1(semUma = false) {
      const itens = semUma ? ITENS_NR1.slice(1) : ITENS_NR1;
      return [
        {
          id: "s-nr1",
          titulo: null,
          descricao: null,
          perguntas: itens.map((i) => ({
            id: `q-${i.id}`,
            chave: i.id,
            tipo: "escala",
            texto: `Enunciado sintético ${i.id}`,
            descricao: null,
            obrigatoria: true,
            config: {
              minimo: 1,
              maximo: 5,
              rotulos: [...ROTULOS_DA_ESCALA[i.escala]],
            },
            condicao: null,
          })),
        },
      ];
    }

    /** As 18 perguntas da saúde financeira (ids de opção gerados). */
    function secoesIsfb(comAuto = true) {
      const escala = (c: string, rotulos: readonly string[], obrig = true) => ({
        id: `q-${c}`,
        chave: c,
        tipo: "escala",
        texto: `Enunciado ${c}`,
        descricao: null,
        obrigatoria: obrig,
        config: {
          minimo: 0,
          maximo: 4,
          rotulos: [...rotulos],
          somenteRotulos: true,
        },
        condicao: null,
      });
      const escolha = (c: string, tipo: string, n: number, obrig: boolean) => ({
        id: `q-${c}`,
        chave: c,
        tipo,
        texto: `Enunciado ${c}`,
        descricao: null,
        obrigatoria: obrig,
        config: {
          opcoes: Array.from({ length: n }, (_, i) => ({
            id: `${c}-o${i}`,
            texto: `Opção ${i + 1}`,
          })),
          outro: false,
        },
        condicao: null,
      });
      return [
        {
          id: "s-isfb",
          titulo: null,
          descricao: null,
          perguntas: [
            escolha("Q1", "escolha_unica", 5, true),
            ...[
              "Q2",
              "Q3",
              "Q4",
              "Q5",
              "Q6",
              "Q7",
              "Q8",
              "Q9",
              "Q10",
              "Q11",
              "Q12",
            ].map((c) => escala(c, ROTULOS_DA_CONCORDANCIA)),
            escolha("Q13", "multipla_escolha", 14, false),
            escolha("Q14", "escolha_unica", 7, true),
            escolha("Q15", "escolha_unica", 6, true),
            ...(comAuto
              ? ["O1", "O2", "O3"].map((c) =>
                  escala(c, ROTULOS_DA_FREQUENCIA, false),
                )
              : []),
          ],
        },
      ];
    }

    const respostasNr1 = (
      padrao: number,
      ajustes: Record<string, number> = {},
    ) =>
      ITENS_NR1.map((i) => ({
        perguntaId: `q-${i.id}`,
        valor: ajustes[i.id] ?? padrao,
      }));

    it("NR-1: estrutura conferida pela chave; resultado, individual e acompanhamento", async () => {
      // Item faltando: 422 estrutura_do_modelo.
      const falta = await post("/v1/pesquisas", rhA)
        .send(corpo({ modelo: "copsoq", secoes: secoesNr1(true) }))
        .expect(422);
      expect(falta.body.erros).toEqual([
        { campo: "secoes", motivo: "estrutura_do_modelo" },
      ]);
      const { id, token } = await publicada({
        modelo: "copsoq",
        identificacao: "anonima",
        secoes: secoesNr1(),
      });
      const ajustes = { Q1: 5, Q2: 5, Q3: 5 };
      for (const respostas of [
        respostasNr1(3, { ...ajustes, Q73: 2 }),
        respostasNr1(3, ajustes),
        respostasNr1(3),
      ]) {
        await agent()
          .post(publico(token, "/respostas"))
          .send({ respostas })
          .expect(201);
      }
      // Fora de 1 a 5: recusado (76 respostas cabem no envio).
      await agent()
        .post(publico(token, "/respostas"))
        .send({ respostas: respostasNr1(6) })
        .expect(422);

      const r = await get(`/v1/pesquisas/${id}/resultados`, rhA).expect(200);
      expect(r.body.modelo).toMatchObject({ modelo: "copsoq", respostas: 3 });
      expect(r.body.modelo.dimensoes).toHaveLength(29);
      expect(r.body.modelo.dimensoes[0]).toMatchObject({
        id: "exigencias_quantitativas",
        escore: 4.33,
        distribuicao: { risco: 2, intermediario: 1, favoravel: 0 },
        severidade: 4,
        prevalencia: 3,
        nivel: "critico",
      });
      // Anônima: contagens abaixo do mínimo somem (sigilo).
      expect(r.body.modelo.ofensivos.tipos[0]).toMatchObject({
        id: "Q73",
        raramente: null,
        asVezes: null,
        frequentementeOuSempre: 0,
        relataram: 3,
      });

      const lista = await get(`/v1/pesquisas/${id}/respostas`, rhA).expect(200);
      const ultima = await get(
        `/v1/pesquisas/${id}/respostas/${lista.body[0].id}`,
        rhA,
      ).expect(200);
      expect(ultima.body.modelo.dimensoes[0]).toMatchObject({
        id: "exigencias_quantitativas",
        escore: 3,
        prevalencia: 2,
        escoreDoTime: 4.33,
        comparacao: "abaixo",
      });

      // Acompanhamento: a 1ª etapa conclui com a 1ª resposta (anônima).
      const a0 = await get(
        `/v1/pesquisas/${id}/modelo/acompanhamento`,
        rhA,
      ).expect(200);
      expect(a0.body.etapas).toHaveLength(7);
      expect(a0.body).toMatchObject({ concluidas: 1, proxima: "plano" });
      expect(a0.body.revisarEm).toMatch(/^\d{4}-\d{2}$/);
      const etapas = (concluir: boolean, marcar: boolean) => [
        {
          id: "comunicar",
          itens: [marcar, false, false],
          evidencias: null,
          concluida: concluir,
        },
      ];
      const medida = {
        id: "m1",
        dimensaoId: "exigencias_quantitativas",
        titulo: "Rever a distribuição das tarefas",
        descricao: null,
        controle: "administrativo",
        responsavel: "Coordenação",
        prazo: "2027-03-31",
        indicador: "Horas extras por mês",
        situacao: "planejada",
      };
      const semMarca = await put(
        `/v1/pesquisas/${id}/modelo/acompanhamento`,
        rhA,
      )
        .send({ etapas: etapas(true, false), plano: [], profissionalSst: {} })
        .expect(422);
      expect(semMarca.body.erros).toEqual([
        { campo: "etapas.comunicar", motivo: "obrigatorio" },
      ]);
      const invalida = await put(
        `/v1/pesquisas/${id}/modelo/acompanhamento`,
        rhA,
      )
        .send({
          etapas: [],
          plano: [{ ...medida, controle: "outro" }],
          profissionalSst: {},
        })
        .expect(422);
      expect(invalida.body.erros).toEqual([
        { campo: "plano.m1", motivo: "invalido" },
      ]);
      const a1 = await put(`/v1/pesquisas/${id}/modelo/acompanhamento`, dpA)
        .send({
          etapas: etapas(true, true),
          plano: [medida],
          profissionalSst: { nome: "Profissional Sintético", registro: "123" },
        })
        .expect(200);
      expect(a1.body).toMatchObject({
        concluidas: 3,
        proxima: "validar",
        plano: [medida],
      });
      const concluidaEm = a1.body.etapas[2].concluidaEm as string;
      expect(concluidaEm).toEqual(expect.any(String));
      await put(`/v1/pesquisas/${id}/modelo/acompanhamento`, masterA)
        .send({ etapas: [], plano: [], profissionalSst: {} })
        .expect(403);
      const a2 = await put(`/v1/pesquisas/${id}/modelo/acompanhamento`, rhA)
        .send({
          etapas: etapas(true, true),
          plano: [medida],
          profissionalSst: {},
        })
        .expect(200);
      expect(a2.body.etapas[2].concluidaEm).toBe(concluidaEm);
      expect(
        (await trilha(id)).filter(
          (e) => e.action === "pesquisas_pesquisa_alterada",
        ),
      ).toHaveLength(2);
      await get(`/v1/pesquisas/${id}/modelo/acompanhamento`, rhB).expect(404);
    });

    it("saúde financeira: autopercepção opcional; nota pela posição das opções", async () => {
      await post("/v1/pesquisas", rhA)
        .send(
          corpo({
            modelo: "isfb",
            identificacao: "anonima",
            secoes: secoesIsfb(false),
          }),
        )
        .expect(201);
      const { id, token } = await publicada({
        modelo: "isfb",
        identificacao: "anonima",
        secoes: secoesIsfb(),
      });
      const escalas = [
        "Q2",
        "Q3",
        "Q4",
        "Q5",
        "Q6",
        "Q7",
        "Q8",
        "Q9",
        "Q10",
        "Q11",
        "Q12",
      ];
      const respostas: { perguntaId: string; valor: unknown }[] = [
        { perguntaId: "q-Q1", valor: { opcao: "Q1-o2" } },
        ...escalas.map((c) => ({ perguntaId: `q-${c}`, valor: 2 })),
        {
          perguntaId: "q-Q13",
          valor: { opcoes: ["Q13-o0", "Q13-o1", "Q13-o3"] },
        },
        { perguntaId: "q-Q14", valor: { opcao: "Q14-o2" } },
        { perguntaId: "q-Q15", valor: { opcao: "Q15-o3" } },
        { perguntaId: "q-O1", valor: 3 },
        { perguntaId: "q-O2", valor: 3 },
        { perguntaId: "q-O3", valor: 3 },
      ];
      await agent()
        .post(publico(token, "/respostas"))
        .send({ respostas })
        .expect(201);
      await agent()
        .post(publico(token, "/respostas"))
        .send({
          respostas: respostas.filter(
            (x) => !["q-O1", "q-O2", "q-O3", "q-Q13"].includes(x.perguntaId),
          ),
        })
        .expect(201);
      const r = await get(`/v1/pesquisas/${id}/resultados`, rhA).expect(200);
      expect(r.body.modelo).toMatchObject({
        modelo: "isfb",
        pessoas: 2,
        isfb: 56,
        faixa: "baixa",
        diferencaDoBrasil: -0.7,
        mediaDoBrasil: 56.7,
        comAutopercepcao: 1,
      });
      expect(r.body.modelo.produtos.poupanca.quantidade).toBe(1);
      const lista = await get(`/v1/pesquisas/${id}/respostas`, rhA).expect(200);
      const primeira = await get(
        `/v1/pesquisas/${id}/respostas/${lista.body[1].id}`,
        rhA,
      ).expect(200);
      expect(primeira.body.modelo).toMatchObject({
        modelo: "isfb",
        isfb: 56,
        autopercepcao: 80,
        abertura: "sabem_que_precisam",
        isfbDoTime: 56,
      });
      // Sem acompanhamento da NR-1 em outro modelo.
      await get(`/v1/pesquisas/${id}/modelo/acompanhamento`, rhA).expect(404);
    });
  });
});
