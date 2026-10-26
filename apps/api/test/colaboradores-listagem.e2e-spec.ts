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
 * T178 — "Gestão de Pessoas → Colaboradores" como porta principal: a
 * listagem de `GET /v1/colaboradores`. PostgreSQL real e efêmero
 * (Testcontainers), migrations aplicadas do zero.
 *
 * Prova o que a porta principal promete:
 *
 * - só colaboradores da **empresa ativa**, com vínculos só dela;
 * - **situação na empresa**: quem está desligado ou só previsto numa empresa é
 *   "inativo" nela, mesmo ativo em outra — nenhum resíduo de uma empresa na
 *   lista, nos contadores ou na busca da outra;
 * - **busca** por nome (sem diferenciar maiúsculas) e por matrícula (só da
 *   empresa ativa);
 * - **contadores** reais do escopo inteiro, sem filtros nem busca;
 * - empresa vazia, empresa por parâmetro (só interseção), admitido que
 *   aparece, projeção fechada, `master_tecnico` global e escopado, e a
 *   negação a quem não lê colaboradores.
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
const SENHA_PADRAO = "Listagem!Pessoas#2026";
const ADMISSAO = "2026-01-05";
const DESLIGAMENTO = "2026-05-04";

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

interface ItemListado {
  id: string;
  nome: string;
  situacao: string;
  vinculos: {
    empresaId: string;
    matricula: string;
    situacao: string;
    dataAdmissao: string;
  }[];
}

describe("Colaboradores — listagem da porta principal (T178, e2e)", () => {
  let container: StartedTestContainer;
  let appUrl: string;
  let app: INestApplication;
  let prisma: PrismaClient;

  let master: Credencial;
  let masterEscopadoB: Credencial;
  let rhA: Credencial;
  let rhB: Credencial;
  let rhC: Credencial;
  let dpA: Credencial;
  let gestorA: Credencial;
  let colaboradorA: Credencial;

  let empresaA: string;
  let empresaB: string;
  let empresaC: string;
  let departamentoA: string;
  let departamentoB: string;

  let ana: string;
  let bruno: string;
  let carla: string;
  let diego: string;

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
    const passwordHash = await new PasswordHashService().hash(SENHA_PADRAO);
    await prisma.accessUser.create({
      data: { email, passwordHash, role: "master_tecnico", status: "active" },
    });
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

  async function criarUsuario(
    email: string,
    role: string,
    companyId: string,
  ): Promise<Credencial> {
    await post("/v1/users", master)
      .send({ email, password: SENHA_PADRAO, role, companyId })
      .expect(201);
    return login(email, SENHA_PADRAO);
  }

  /** Admite pela API; com `efetivar`, o vínculo fica ativo. */
  async function admitir(
    cred: Credencial,
    dados: {
      nome: string;
      matricula: string;
      empresaId: string;
      departamentoId: string;
    },
    efetivar: boolean,
  ): Promise<{ colaboradorId: string; vinculoId: string }> {
    const r = await post("/v1/colaboradores", cred)
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
    const colaboradorId: string = r.body.id;
    const vinculoId: string = r.body.vinculo.id;
    if (efetivar) {
      await post(`/v1/movimentacoes/${r.body.movimentacao.id}/efetivar`, cred)
        .send()
        .expect(201);
    }
    return { colaboradorId, vinculoId };
  }

  async function listar(
    cred: Credencial,
    query: Record<string, string> = {},
  ): Promise<{
    itens: ItemListado[];
    total: number;
    contadores: { ativos: number; inativos: number };
  }> {
    const qs = new URLSearchParams(query).toString();
    const r = await get(`/v1/colaboradores${qs ? `?${qs}` : ""}`, cred).expect(
      200,
    );
    return r.body;
  }

  const nomes = (itens: ItemListado[]) => itens.map((i) => i.nome);

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
    app = await buildApp();
    master = await seedMaster("master.listagem@example.test");

    const empresa = async (codigo: string, nome: string) =>
      (await post("/v1/empresas", master).send({ codigo, nome }).expect(201))
        .body.id as string;
    empresaA = await empresa("LISTA", "Empresa Listagem Alfa");
    empresaB = await empresa("LISTB", "Empresa Listagem Beta");
    empresaC = await empresa("LISTC", "Empresa Listagem Vazia");
    const departamento = async (empresaId: string, codigo: string) =>
      (
        await post("/v1/departamentos", master)
          .send({ empresaId, codigo, nome: `Depto ${codigo}` })
          .expect(201)
      ).body.id as string;
    departamentoA = await departamento(empresaA, "DEPLA");
    departamentoB = await departamento(empresaB, "DEPLB");

    rhA = await criarUsuario("rh.la@example.test", "rh", empresaA);
    rhB = await criarUsuario("rh.lb@example.test", "rh", empresaB);
    rhC = await criarUsuario("rh.lc@example.test", "rh", empresaC);
    dpA = await criarUsuario("dp.la@example.test", "dp", empresaA);
    gestorA = await criarUsuario("gestor.la@example.test", "gestor", empresaA);
    colaboradorA = await criarUsuario(
      "colab.la@example.test",
      "colaborador",
      empresaA,
    );
    masterEscopadoB = await seedMaster("master.lb@example.test");
    await post("/v1/auth/contexto/empresa", masterEscopadoB)
      .send({ empresaId: empresaB })
      .expect(200);

    // Alfa: Ana ativa (com um segundo vínculo previsto), Bruno só previsto,
    // Carla ativa. Beta: Diego previsto, e Carla com um vínculo PREVISTO —
    // ativa na Alfa, inativa na Beta.
    ana = (
      await admitir(
        rhA,
        {
          nome: "Ana Sintetica Alfa",
          matricula: "MAT-L-ANA",
          empresaId: empresaA,
          departamentoId: departamentoA,
        },
        true,
      )
    ).colaboradorId;
    bruno = (
      await admitir(
        rhA,
        {
          nome: "Bruno Sintetico Alfa",
          matricula: "MAT-L-BRU",
          empresaId: empresaA,
          departamentoId: departamentoA,
        },
        false,
      )
    ).colaboradorId;
    carla = (
      await admitir(
        rhA,
        {
          nome: "Carla Sintetica Multi",
          matricula: "MAT-L-CAR",
          empresaId: empresaA,
          departamentoId: departamentoA,
        },
        true,
      )
    ).colaboradorId;
    diego = (
      await admitir(
        rhB,
        {
          nome: "Diego Sintetico Beta",
          matricula: "MAT-L-DIE",
          empresaId: empresaB,
          departamentoId: departamentoB,
        },
        false,
      )
    ).colaboradorId;

    // A API não cria vínculo em outra empresa para quem já existe: os dois
    // vínculos extras entram direto no banco, PREVISTOS, como nos E2E de
    // contatos e documentos.
    const inserirVinculo = (
      colaboradorId: string,
      empresaId: string,
      matricula: string,
      dataAdmissao: string,
    ) =>
      prisma.$executeRawUnsafe(
        `INSERT INTO app.vinculo_funcional
           (id, colaborador_id, empresa_id, matricula, tipo, situacao,
            data_admissao, criado_em, atualizado_em)
         VALUES (gen_random_uuid()::text, $1, $2, $3, 'clt', 'previsto',
                 $4::date, now(), now())`,
        colaboradorId,
        empresaId,
        matricula,
        dataAdmissao,
      );
    await inserirVinculo(carla, empresaB, "BETA-CARLA-77", "2026-03-02");
    await inserirVinculo(ana, empresaA, "MAT-L-ANA2", "2026-04-01");
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    await app?.close();
    await container?.stop();
  });

  describe("só a empresa ativa", () => {
    it("rh da Alfa: os três da Alfa, com vínculos só dela e contadores reais", async () => {
      const r = await listar(rhA);
      expect(nomes(r.itens)).toEqual([
        "Ana Sintetica Alfa",
        "Bruno Sintetico Alfa",
        "Carla Sintetica Multi",
      ]);
      expect(r.total).toBe(3);
      expect(r.contadores).toEqual({ ativos: 2, inativos: 1 });
      for (const item of r.itens) {
        for (const v of item.vinculos) {
          expect(v.empresaId).toBe(empresaA);
        }
      }
      const porNome = Object.fromEntries(r.itens.map((i) => [i.nome, i]));
      expect(porNome["Ana Sintetica Alfa"]!.situacao).toBe("ativo");
      expect(porNome["Bruno Sintetico Alfa"]!.situacao).toBe("inativo");
      expect(porNome["Carla Sintetica Multi"]!.situacao).toBe("ativo");
      expect(JSON.stringify(r)).not.toContain("BETA-CARLA-77");
      expect(JSON.stringify(r)).not.toContain(empresaB);
    });

    it("vínculo principal primeiro: o ativo, depois o previsto", async () => {
      const r = await listar(rhA, { busca: "Ana" });
      const anaListada = r.itens.find((i) => i.id === ana)!;
      expect(anaListada.vinculos.map((v) => [v.matricula, v.situacao])).toEqual(
        [
          ["MAT-L-ANA", "ativo"],
          ["MAT-L-ANA2", "previsto"],
        ],
      );
      expect(anaListada.vinculos[0]!.dataAdmissao.slice(0, 10)).toBe(ADMISSAO);
    });

    it("rh da Beta: Carla é INATIVA na Beta, mesmo ativa na Alfa — sem resíduo da Alfa", async () => {
      const r = await listar(rhB);
      expect(nomes(r.itens)).toEqual([
        "Carla Sintetica Multi",
        "Diego Sintetico Beta",
      ]);
      expect(r.contadores).toEqual({ ativos: 0, inativos: 2 });
      const carlaNaBeta = r.itens.find((i) => i.id === carla)!;
      expect(carlaNaBeta.situacao).toBe("inativo");
      expect(carlaNaBeta.vinculos.map((v) => v.matricula)).toEqual([
        "BETA-CARLA-77",
      ]);
      const texto = JSON.stringify(r);
      for (const residuo of [
        "MAT-L-CAR",
        "MAT-L-ANA",
        "Ana Sintetica Alfa",
        empresaA,
      ]) {
        expect(texto).not.toContain(residuo);
      }
      // O filtro segue a mesma regra: na Beta, ninguém está ativo.
      expect((await listar(rhB, { situacao: "ativo" })).itens).toEqual([]);
    });

    it("empresa sem colaboradores: lista vazia e contadores zerados", async () => {
      const r = await listar(rhC);
      expect(r).toMatchObject({
        itens: [],
        total: 0,
        contadores: { ativos: 0, inativos: 0 },
      });
    });

    it("empresa por parâmetro é só interseção: outra empresa devolve vazio", async () => {
      const r = await listar(rhA, { empresaId: empresaB });
      expect(r).toMatchObject({
        itens: [],
        total: 0,
        contadores: { ativos: 0, inativos: 0 },
      });
      const propria = await listar(rhA, { empresaId: empresaA });
      expect(propria.total).toBe(3);
    });

    it("dp lê a mesma listagem da própria empresa", async () => {
      const r = await listar(dpA);
      expect(r.total).toBe(3);
      expect(r.contadores).toEqual({ ativos: 2, inativos: 1 });
    });

    it("projeção fechada: só os campos aprovados no item e no vínculo", async () => {
      const r = await listar(rhA, { busca: "Bruno" });
      expect(Object.keys(r.itens[0]!).sort()).toEqual(
        [
          "atualizadoEm",
          "criadoEm",
          "id",
          "nome",
          "situacao",
          "vinculos",
        ].sort(),
      );
      expect(Object.keys(r.itens[0]!.vinculos[0]!).sort()).toEqual(
        [
          "dataAdmissao",
          "dataDesligamento",
          "empresaId",
          "id",
          // T184 — a lotação vigente (cargo e departamento), `null` aqui:
          // o Bruno só tem vínculo previsto.
          "lotacaoVigente",
          "matricula",
          "situacao",
          // T185 — vigências de jornada perto de hoje; vazias aqui: o Bruno
          // só tem vínculo previsto.
          "vigenciasDeJornada",
        ].sort(),
      );
      expect(Object.keys(r).sort()).toEqual(
        ["contadores", "itens", "pagina", "tamanhoPagina", "total"].sort(),
      );
    });
  });

  describe("busca por nome e matrícula", () => {
    it("nome: contém, sem diferenciar maiúsculas", async () => {
      expect(nomes((await listar(rhA, { busca: "ana s" })).itens)).toEqual([
        "Ana Sintetica Alfa",
      ]);
      expect(nomes((await listar(rhA, { busca: "SINTETIC" })).itens)).toEqual([
        "Ana Sintetica Alfa",
        "Bruno Sintetico Alfa",
        "Carla Sintetica Multi",
      ]);
    });

    it("matrícula: contém, inclusive do vínculo que não é o principal", async () => {
      expect(nomes((await listar(rhA, { busca: "l-bru" })).itens)).toEqual([
        "Bruno Sintetico Alfa",
      ]);
      expect(nomes((await listar(rhA, { busca: "ANA2" })).itens)).toEqual([
        "Ana Sintetica Alfa",
      ]);
    });

    it("matrícula de OUTRA empresa não é procurada: nenhum vazamento", async () => {
      expect((await listar(rhA, { busca: "BETA-CARLA" })).itens).toEqual([]);
      expect((await listar(rhB, { busca: "MAT-L-CAR" })).itens).toEqual([]);
      expect(nomes((await listar(rhB, { busca: "BETA-CARLA" })).itens)).toEqual(
        ["Carla Sintetica Multi"],
      );
      expect((await listar(rhB, { busca: "Ana" })).itens).toEqual([]);
    });

    it("busca convive com o filtro e não muda os contadores", async () => {
      const r = await listar(rhA, { busca: "Sintetic", situacao: "inativo" });
      expect(nomes(r.itens)).toEqual(["Bruno Sintetico Alfa"]);
      expect(r.total).toBe(1);
      expect(r.contadores).toEqual({ ativos: 2, inativos: 1 });
    });

    it("busca só de espaços vale como ausente; curingas não ampliam o resultado", async () => {
      expect((await listar(rhA, { busca: "   " })).total).toBe(3);
      expect((await listar(rhA, { busca: "%" })).itens).toEqual([]);
      expect((await listar(rhA, { busca: "_" })).itens).toEqual([]);
    });

    it("busca acima do limite ou com caractere de controle é recusada", async () => {
      await get(`/v1/colaboradores?busca=${"a".repeat(161)}`, rhA).expect(400);
      await get(
        `/v1/colaboradores?busca=${encodeURIComponent("a\u0007b")}`,
        rhA,
      ).expect(400);
    });
  });

  describe("master_tecnico", () => {
    it("sem empresa ativa: leitura global já aprovada, com a situação materializada", async () => {
      const r = await listar(master);
      expect(nomes(r.itens)).toEqual([
        "Ana Sintetica Alfa",
        "Bruno Sintetico Alfa",
        "Carla Sintetica Multi",
        "Diego Sintetico Beta",
      ]);
      expect(r.contadores).toEqual({ ativos: 2, inativos: 2 });
      const carlaGlobal = r.itens.find((i) => i.id === carla)!;
      expect(carlaGlobal.situacao).toBe("ativo");
      expect(carlaGlobal.vinculos.map((v) => v.matricula).sort()).toEqual([
        "BETA-CARLA-77",
        "MAT-L-CAR",
      ]);
    });

    it("com empresa ativa Beta: só a Beta, com a situação na Beta", async () => {
      const r = await listar(masterEscopadoB);
      expect(nomes(r.itens)).toEqual([
        "Carla Sintetica Multi",
        "Diego Sintetico Beta",
      ]);
      expect(r.contadores).toEqual({ ativos: 0, inativos: 2 });
      expect(r.itens.find((i) => i.id === carla)!.situacao).toBe("inativo");
      expect(JSON.stringify(r)).not.toContain("MAT-L-CAR");
    });
  });

  describe("negação", () => {
    it.each([
      ["gestor", () => gestorA],
      ["colaborador", () => colaboradorA],
    ])("%s não lê a listagem", async (_papel, cred) => {
      const r = await get("/v1/colaboradores", cred());
      expect([403, 404]).toContain(r.status);
      expect(JSON.stringify(r.body)).not.toContain("Sintetic");
    });
  });

  describe("depois da admissão", () => {
    it("o admitido aparece na listagem e nos contadores", async () => {
      const antes = await listar(rhA);
      const elisa = await admitir(
        rhA,
        {
          nome: "Elisa Sintetica Nova",
          matricula: "MAT-L-ELI",
          empresaId: empresaA,
          departamentoId: departamentoA,
        },
        false,
      );
      const depois = await listar(rhA, { busca: "Elisa" });
      expect(depois.itens.map((i) => [i.id, i.situacao])).toEqual([
        [elisa.colaboradorId, "inativo"],
      ]);
      expect(depois.itens[0]!.vinculos[0]).toMatchObject({
        matricula: "MAT-L-ELI",
        situacao: "previsto",
      });
      expect(depois.contadores).toEqual({
        ativos: antes.contadores.ativos,
        inativos: antes.contadores.inativos + 1,
      });
    });

    it("desligado na Alfa conta como inativo nela", async () => {
      const r = await post("/v1/colaboradores", rhA)
        .send({
          ...camposObrigatoriosAdmissao(),
          ...(await lotacaoMinima(appUrl, empresaA)),
          nome: "Fabio Sintetico Desligado",
          empresaId: empresaA,
          matricula: "MAT-L-FAB",
          tipo: "clt",
          dataAdmissao: ADMISSAO,
          motivoCodigo: "admissao_inicial",
          departamentoId: departamentoA,
        })
        .expect(201);
      await post(`/v1/movimentacoes/${r.body.movimentacao.id}/efetivar`, rhA)
        .send()
        .expect(201);
      const desligamento = await post("/v1/movimentacoes", rhA)
        .send({
          vinculoId: r.body.vinculo.id,
          tipo: "desligamento",
          motivoCodigo: "encerramento_de_vinculo",
          vigenciaInicio: DESLIGAMENTO,
        })
        .expect(201);
      await post(`/v1/movimentacoes/${desligamento.body.id}/efetivar`, rhA)
        .send()
        .expect(201);
      const lista = await listar(rhA, { busca: "Fabio" });
      expect(lista.itens.map((i) => i.situacao)).toEqual(["inativo"]);
      expect(lista.itens[0]!.vinculos[0]!.situacao).toBe("encerrado");
      expect(
        nomes((await listar(rhA, { situacao: "inativo" })).itens),
      ).toContain("Fabio Sintetico Desligado");
    });
  });

  it("ninguém de outra empresa entra pela listagem de quem foi buscado", async () => {
    // Sanidade do conjunto: Diego (Beta) nunca aparece para a Alfa.
    expect(
      (await listar(rhA, { busca: "Diego" })).itens.map((i) => i.id),
    ).not.toContain(diego);
    expect((await listar(rhA)).itens.map((i) => i.id)).not.toContain(diego);
    expect((await listar(rhA)).itens.map((i) => i.id)).toContain(bruno);
  });

  // T184 — Cargo e Departamento da lotação VIGENTE (a alocação organizacional
  // aberta do vínculo), decisão da proprietária de 2026-10-26: vínculo
  // previsto ou encerrado não tem lotação vigente. Fica no fim de propósito:
  // cria colaborador e não pode mudar as contagens dos blocos de cima.
  describe("T184 — lotação vigente na listagem", () => {
    interface Referencia {
      id: string;
      codigo: string;
      nome: string;
    }
    interface VinculoComLotacao {
      id: string;
      empresaId: string;
      matricula: string | null;
      situacao: string;
      lotacaoVigente: {
        cargo: Referencia | null;
        departamento: Referencia | null;
      } | null;
    }

    async function listarComLotacao(
      cred: Credencial,
      busca: string,
    ): Promise<{ nome: string; vinculos: VinculoComLotacao[] }[]> {
      const r = await get(
        `/v1/colaboradores?busca=${encodeURIComponent(busca)}`,
        cred,
      ).expect(200);
      return r.body.itens;
    }

    async function lotacaoDaAdmissao(empresaId: string) {
      const l = await lotacaoMinima(appUrl, empresaId);
      const cargo = await prisma.cargo.findUniqueOrThrow({
        where: { id: l.cargoId },
        select: { id: true, codigo: true, nome: true },
      });
      return cargo;
    }

    it("ativo: cargo e departamento da alocação aberta, só com id, código e nome", async () => {
      const cargo = await lotacaoDaAdmissao(empresaA);
      const [anaListada] = await listarComLotacao(rhA, "Ana Sintetica");
      const principal = anaListada!.vinculos[0]!;
      expect(principal.situacao).toBe("ativo");
      expect(principal.lotacaoVigente).toEqual({
        cargo,
        departamento: {
          id: departamentoA,
          codigo: "DEPLA",
          nome: "Depto DEPLA",
        },
      });
      expect(Object.keys(principal.lotacaoVigente!).sort()).toEqual([
        "cargo",
        "departamento",
      ]);
      // O segundo vínculo dela, previsto, não tem lotação vigente.
      expect(anaListada!.vinculos[1]).toMatchObject({
        situacao: "previsto",
        lotacaoVigente: null,
      });
    });

    it("previsto (admissão não efetivada): sem lotação vigente, mesmo com destino escolhido", async () => {
      const [brunoListado] = await listarComLotacao(rhA, "Bruno Sintetico");
      expect(brunoListado!.vinculos).toHaveLength(1);
      expect(brunoListado!.vinculos[0]).toMatchObject({
        situacao: "previsto",
        lotacaoVigente: null,
      });
    });

    it("só a empresa ativa: na Beta, a Carla não traz a lotação da Alfa", async () => {
      const cargoA = await lotacaoDaAdmissao(empresaA);
      for (const cred of [rhB, masterEscopadoB]) {
        const itens = await listarComLotacao(cred, "Carla Sintetica");
        expect(itens).toHaveLength(1);
        expect(itens[0]!.vinculos).toHaveLength(1);
        expect(itens[0]!.vinculos[0]).toMatchObject({
          empresaId: empresaB,
          lotacaoVigente: null,
        });
        const texto = JSON.stringify(itens);
        expect(texto).not.toContain(departamentoA);
        expect(texto).not.toContain(cargoA.id);
      }
      // E na Alfa, a lotação dela é a da Alfa.
      const [naAlfa] = await listarComLotacao(rhA, "Carla Sintetica");
      expect(naAlfa!.vinculos[0]!.lotacaoVigente!.departamento!.id).toBe(
        departamentoA,
      );
    });

    it("dp lê o mesmo que o rh; master sem empresa vê cada vínculo com a lotação da própria empresa", async () => {
      const doRh = await listarComLotacao(rhA, "Sintetic");
      const doDp = await listarComLotacao(dpA, "Sintetic");
      expect(doDp).toEqual(doRh);
      const global = await listarComLotacao(master, "Carla Sintetica");
      const vinculos = global[0]!.vinculos;
      expect(vinculos).toHaveLength(2);
      const alfa = vinculos.find((v) => v.empresaId === empresaA)!;
      const beta = vinculos.find((v) => v.empresaId === empresaB)!;
      expect(alfa.lotacaoVigente!.departamento!.id).toBe(departamentoA);
      expect(beta.lotacaoVigente).toBeNull();
    });

    it("troca de lotação: só a aberta aparece; sem cargo na vigente, cargo nulo", async () => {
      const { vinculoId } = await admitir(
        rhA,
        {
          nome: "Eva Sintetica Lotacao",
          matricula: "MAT-L-EVA",
          empresaId: empresaA,
          departamentoId: departamentoA,
        },
        true,
      );
      const outro = (
        await post("/v1/departamentos", master)
          .send({ empresaId: empresaA, codigo: "DEPLA2", nome: "Depto DEPLA2" })
          .expect(201)
      ).body.id as string;
      const vigente = await prisma.alocacaoOrganizacional.findFirstOrThrow({
        where: { vinculoId, vigenteAte: null },
      });
      // Sucessão no banco, numa transação (o vínculo ativo nunca fica sem
      // alocação aberta): a anterior fecha, a nova abre só com departamento.
      await prisma.$transaction([
        prisma.alocacaoOrganizacional.update({
          where: { id: vigente.id },
          data: { vigenteAte: new Date("2026-02-01T00:00:00.000Z") },
        }),
        prisma.alocacaoOrganizacional.create({
          data: {
            vinculoId,
            empresaId: empresaA,
            departamentoId: outro,
            vigenteDe: new Date("2026-02-01T00:00:00.000Z"),
            movimentacaoOrigemId: vigente.movimentacaoOrigemId,
          },
        }),
      ]);
      const [eva] = await listarComLotacao(rhA, "Eva Sintetica");
      expect(eva!.vinculos[0]!.lotacaoVigente).toEqual({
        cargo: null,
        departamento: { id: outro, codigo: "DEPLA2", nome: "Depto DEPLA2" },
      });
    });

    it("busca, contadores e negações seguem iguais com a lotação na projeção", async () => {
      const r = await get("/v1/colaboradores?busca=MAT-L-EVA", rhA).expect(200);
      expect(r.body.itens.map((i: { nome: string }) => i.nome)).toEqual([
        "Eva Sintetica Lotacao",
      ]);
      expect(Object.keys(r.body.contadores).sort()).toEqual([
        "ativos",
        "inativos",
      ]);
      for (const cred of [gestorA, colaboradorA]) {
        const negada = await get("/v1/colaboradores", cred);
        expect([403, 404]).toContain(negada.status);
        expect(JSON.stringify(negada.body)).not.toContain("DEPLA");
      }
    });
  });

  // T185 — jornada de trabalho (T183) na listagem: as vigências perto de hoje
  // do colaborador na empresa do vínculo principal ATIVO; a tela escolhe a de
  // hoje pelo dia civil do navegador (decisões da proprietária de
  // 2026-10-26). Fica no fim: depende dos colaboradores criados acima.
  describe("T185 — jornada de trabalho na listagem", () => {
    interface VigenciaListada {
      vigenciaInicio: string;
      vigenciaFim: string | null;
      jornada: {
        id: string;
        codigo: string | null;
        nome: string;
        ativo: boolean;
      };
    }
    interface VinculoComJornada {
      empresaId: string;
      situacao: string;
      vigenciasDeJornada: VigenciaListada[];
    }

    const UM_DIA = 24 * 60 * 60 * 1000;
    const hojeUtc = new Date(
      new Date().toISOString().slice(0, 10) + "T00:00:00.000Z",
    );
    const dia = (deslocamento: number) =>
      new Date(hojeUtc.getTime() + deslocamento * UM_DIA)
        .toISOString()
        .slice(0, 10);

    let sequencia = 0;
    async function jornada(cred: Credencial, nome: string) {
      const codigo = `T185_${++sequencia}`;
      const r = await post("/v1/horarios", cred)
        .send({ codigo, nome, periodos: [] })
        .expect(201);
      return { id: r.body.id as string, codigo, nome };
    }

    async function atribuir(
      cred: Credencial,
      colaboradorId: string,
      tabelaHorarioId: string,
      vigenciaInicio: string,
    ) {
      const r = await post("/v1/horarios/vinculos/atribuicoes", cred)
        .send({ colaboradorId, tabelaHorarioId, vigenciaInicio })
        .expect(201);
      return r.body.id as string;
    }

    async function vinculosDe(
      cred: Credencial,
      busca: string,
    ): Promise<VinculoComJornada[]> {
      const r = await get(
        `/v1/colaboradores?busca=${encodeURIComponent(busca)}`,
        cred,
      ).expect(200);
      expect(r.body.itens).toHaveLength(1);
      return r.body.itens[0].vinculos;
    }

    async function idDe(busca: string): Promise<string> {
      const r = await get(
        `/v1/colaboradores?busca=${encodeURIComponent(busca)}`,
        rhA,
      ).expect(200);
      return r.body.itens[0].id;
    }

    it("ativo: a vigência de hoje vem com código, nome e situação da jornada, e só ela", async () => {
      const j = await jornada(rhA, "Jornada Eva T185");
      const eva = await idDe("Eva Sintetica");
      await atribuir(rhA, eva, j.id, dia(-10));
      const [principal] = await vinculosDe(rhA, "Eva Sintetica");
      expect(principal!.situacao).toBe("ativo");
      expect(principal!.vigenciasDeJornada).toEqual([
        {
          vigenciaInicio: dia(-10),
          vigenciaFim: null,
          jornada: { id: j.id, codigo: j.codigo, nome: j.nome, ativo: true },
        },
      ]);
    });

    it("previsto: nada de jornada, mesmo com vigência atribuída", async () => {
      const j = await jornada(rhA, "Jornada Bruno T185");
      await atribuir(rhA, bruno, j.id, dia(-5));
      const vinculos = await vinculosDe(rhA, "Bruno Sintetico");
      expect(vinculos[0]).toMatchObject({
        situacao: "previsto",
        vigenciasDeJornada: [],
      });
    });

    it("vínculo ativo e previsto na mesma empresa: só o ativo projeta a jornada (a mesma do colaborador)", async () => {
      const j = await jornada(rhA, "Jornada Ana T185");
      await atribuir(rhA, ana, j.id, dia(-3));
      const vinculos = await vinculosDe(rhA, "Ana Sintetica");
      expect(vinculos[0]!.situacao).toBe("ativo");
      expect(vinculos[0]!.vigenciasDeJornada.map((v) => v.jornada.id)).toEqual([
        j.id,
      ]);
      expect(vinculos[1]).toMatchObject({
        situacao: "previsto",
        vigenciasDeJornada: [],
      });
    });

    it("vigência futura não vem; troca perto de hoje traz as duas para a tela decidir", async () => {
      const futura = await jornada(rhA, "Jornada Futura T185");
      await atribuir(rhA, carla, futura.id, dia(30));
      expect(
        (await vinculosDe(rhA, "Carla Sintetica"))[0]!.vigenciasDeJornada,
      ).toEqual([]);

      // A Ana já tem jornada desde hoje − 3: trocar AMANHÃ deixa a anterior
      // terminando amanhã e a nova começando amanhã — as duas tocam a janela.
      const nova = await jornada(rhA, "Jornada Ana Nova T185");
      await atribuir(rhA, ana, nova.id, dia(1));
      const vigencias = (await vinculosDe(rhA, "Ana Sintetica"))[0]!
        .vigenciasDeJornada;
      expect(vigencias.map((v) => [v.vigenciaInicio, v.vigenciaFim])).toEqual([
        [dia(-3), dia(1)],
        [dia(1), null],
      ]);
    });

    it("jornada inativada continua visível, com ativo falso", async () => {
      const eva = (await vinculosDe(rhA, "Eva Sintetica"))[0]!;
      const jornadaId = eva.vigenciasDeJornada[0]!.jornada.id;
      await post(`/v1/horarios/${jornadaId}/desativar`, rhA).expect(201);
      const depois = (await vinculosDe(rhA, "Eva Sintetica"))[0]!;
      expect(depois.vigenciasDeJornada[0]!.jornada).toMatchObject({
        id: jornadaId,
        ativo: false,
      });
    });

    it("encerrado (desligamento efetivado): nada de jornada, mesmo com vigência atribuída", async () => {
      const j = await jornada(rhA, "Jornada Desligado T185");
      const fabio = await idDe("Fabio Sintetico Desligado");
      await atribuir(rhA, fabio, j.id, dia(-2));
      const vinculos = await vinculosDe(rhA, "Fabio Sintetico Desligado");
      expect(vinculos[0]).toMatchObject({
        situacao: "encerrado",
        vigenciasDeJornada: [],
      });
    });

    it("encerrada no passado não vem", async () => {
      const j = await jornada(rhA, "Jornada Passada T185");
      const { colaboradorId } = await admitir(
        rhA,
        {
          nome: "Gil Sintetico Jornada",
          matricula: "MAT-L-GIL",
          empresaId: empresaA,
          departamentoId: departamentoA,
        },
        true,
      );
      const v = await atribuir(rhA, colaboradorId, j.id, dia(-60));
      await post(`/v1/horarios/vinculos/${v}/encerrar`, rhA)
        .send({ vigenciaFim: dia(-30) })
        .expect(201);
      expect(
        (await vinculosDe(rhA, "Gil Sintetico"))[0]!.vigenciasDeJornada,
      ).toEqual([]);
    });

    it("vínculo previsto na Beta não projeta jornada; DP vê o mesmo que o RH; gestor e colaborador negados", async () => {
      for (const cred of [rhB, masterEscopadoB]) {
        const r = await get(
          `/v1/colaboradores?busca=${encodeURIComponent("Carla Sintetica")}`,
          cred,
        ).expect(200);
        expect(r.body.itens[0].vinculos).toHaveLength(1);
        expect(r.body.itens[0].vinculos[0]).toMatchObject({
          empresaId: empresaB,
          situacao: "previsto",
          vigenciasDeJornada: [],
        });
      }
      const doRh = await get("/v1/colaboradores?busca=Sintetic", rhA).expect(
        200,
      );
      const doDp = await get("/v1/colaboradores?busca=Sintetic", dpA).expect(
        200,
      );
      expect(doDp.body.itens).toEqual(doRh.body.itens);
      for (const cred of [gestorA, colaboradorA]) {
        const negada = await get("/v1/colaboradores", cred);
        expect([403, 404]).toContain(negada.status);
        expect(JSON.stringify(negada.body)).not.toContain("T185_");
      }
    });

    // Isolamento com dado que APARECERIA se vazasse: a mesma pessoa ATIVA na
    // Alfa e na Beta, cada empresa com uma jornada vigente distinta. Se a
    // consulta ou o agrupamento ignorassem a empresa, a jornada de uma
    // empresa surgiria no vínculo da outra.
    it("isolamento: ativa na Alfa e na Beta, cada vínculo só com a jornada da própria empresa", async () => {
      const { colaboradorId: pessoa } = await admitir(
        rhA,
        {
          nome: "Helena Sintetica Duas Empresas",
          matricula: "MAT-L-HEL",
          empresaId: empresaA,
          departamentoId: departamentoA,
        },
        true,
      );

      // A API não admite quem já existe em outra empresa: o vínculo da Beta
      // entra previsto no banco, com uma admissão pendente igual à do Diego
      // (mesma empresa e destinos), e é EFETIVADO pela API — a efetivação
      // cria a lotação, como em qualquer admissão.
      const [inserido] = await prisma.$queryRawUnsafe<{ id: string }[]>(
        `INSERT INTO app.vinculo_funcional
           (id, colaborador_id, empresa_id, matricula, tipo, situacao,
            data_admissao, criado_em, atualizado_em)
         VALUES (gen_random_uuid()::text, $1, $2, 'BETA-HEL-01', 'clt',
                 'previsto', $3::date, now(), now())
         RETURNING id`,
        pessoa,
        empresaB,
        ADMISSAO,
      );
      const vinculoBeta = inserido!.id;
      const modelo = await prisma.movimentacaoFuncional.findFirstOrThrow({
        where: { vinculo: { colaboradorId: diego }, tipo: "admissao" },
      });
      const admissaoBeta = await prisma.movimentacaoFuncional.create({
        data: {
          vinculoId: vinculoBeta,
          empresaId: empresaB,
          tipo: modelo.tipo,
          status: modelo.status,
          motivoCodigo: modelo.motivoCodigo,
          solicitanteUserId: modelo.solicitanteUserId,
          vigenciaInicio: modelo.vigenciaInicio,
          destinoUnidadeOrganizacionalId: modelo.destinoUnidadeOrganizacionalId,
          destinoDepartamentoId: modelo.destinoDepartamentoId,
          destinoAreaId: modelo.destinoAreaId,
          destinoEquipeId: modelo.destinoEquipeId,
          destinoCargoId: modelo.destinoCargoId,
          destinoCentroCustoId: modelo.destinoCentroCustoId,
        },
      });
      await post(`/v1/movimentacoes/${admissaoBeta.id}/efetivar`, rhB)
        .send()
        .expect(201);

      const naAlfa = await jornada(rhA, "Jornada Isolamento Alfa T185");
      const naBeta = await jornada(rhB, "Jornada Isolamento Beta T185");
      await atribuir(rhA, pessoa, naAlfa.id, dia(-5));
      await atribuir(rhB, pessoa, naBeta.id, dia(-5));

      const vazou = (corpo: unknown, de: typeof naAlfa) => {
        const texto = JSON.stringify(corpo);
        return (
          texto.includes(de.id) ||
          texto.includes(de.codigo) ||
          texto.includes(de.nome)
        );
      };
      const daPessoa = async (cred: Credencial) => {
        const r = await get(
          `/v1/colaboradores?busca=${encodeURIComponent("Helena Sintetica")}`,
          cred,
        ).expect(200);
        expect(r.body.itens).toHaveLength(1);
        return r.body as { itens: { vinculos: VinculoComJornada[] }[] };
      };
      const idsDasJornadas = (v: VinculoComJornada) =>
        v.vigenciasDeJornada.map((x) => x.jornada.id);

      // RH com a Alfa ativa: só o vínculo e a jornada da Alfa.
      const doRhA = await daPessoa(rhA);
      expect(doRhA.itens[0]!.vinculos).toHaveLength(1);
      expect(doRhA.itens[0]!.vinculos[0]).toMatchObject({
        empresaId: empresaA,
        situacao: "ativo",
      });
      expect(idsDasJornadas(doRhA.itens[0]!.vinculos[0]!)).toEqual([naAlfa.id]);
      expect(vazou(doRhA, naBeta)).toBe(false);

      // RH e master com a Beta ativa: só o vínculo e a jornada da Beta.
      for (const cred of [rhB, masterEscopadoB]) {
        const corpo = await daPessoa(cred);
        expect(corpo.itens[0]!.vinculos).toHaveLength(1);
        expect(corpo.itens[0]!.vinculos[0]).toMatchObject({
          empresaId: empresaB,
          situacao: "ativo",
        });
        expect(idsDasJornadas(corpo.itens[0]!.vinculos[0]!)).toEqual([
          naBeta.id,
        ]);
        expect(vazou(corpo, naAlfa)).toBe(false);
      }

      // Master sem empresa ativa: os dois vínculos, cada um com a jornada da
      // própria empresa — nunca as duas no mesmo vínculo.
      const global = await daPessoa(master);
      const porEmpresa = new Map(
        global.itens[0]!.vinculos.map((v) => [v.empresaId, v]),
      );
      expect(global.itens[0]!.vinculos).toHaveLength(2);
      expect(idsDasJornadas(porEmpresa.get(empresaA)!)).toEqual([naAlfa.id]);
      expect(idsDasJornadas(porEmpresa.get(empresaB)!)).toEqual([naBeta.id]);
      expect(vazou(porEmpresa.get(empresaA), naBeta)).toBe(false);
      expect(vazou(porEmpresa.get(empresaB), naAlfa)).toBe(false);
    });
  });

  // T186 — os contadores viram filtros na tela; o servidor não muda. Estes
  // testes provam, com PostgreSQL real, o que a tela passa a usar: o filtro
  // de situação por empresa (regra da T178) acontece ANTES da paginação,
  // combina com a busca, não mexe nos contadores e respeita as negações.
  describe("T186 — filtro de situação por empresa", () => {
    const TUDO = { tamanhoPagina: "100" };
    const ids = (itens: ItemListado[]) => itens.map((i) => i.id).sort();
    const temVinculoAtivo = (i: ItemListado) =>
      i.vinculos.some((v) => v.situacao === "ativo");

    it("ativos e inativos somam o escopo e batem com os contadores", async () => {
      const todos = await listar(rhA, TUDO);
      const ativos = await listar(rhA, { ...TUDO, situacao: "ativo" });
      const inativos = await listar(rhA, { ...TUDO, situacao: "inativo" });

      expect(ativos.total).toBe(todos.contadores.ativos);
      expect(inativos.total).toBe(todos.contadores.inativos);
      expect(ativos.total + inativos.total).toBe(todos.total);
      expect(ativos.total).toBeGreaterThan(0);
      expect(inativos.total).toBeGreaterThan(0);

      // A regra da T178 na empresa ativa: ativo é ter vínculo ativo NELA.
      expect(ativos.itens.every((i) => i.situacao === "ativo")).toBe(true);
      expect(ativos.itens.every(temVinculoAtivo)).toBe(true);
      expect(inativos.itens.every((i) => i.situacao === "inativo")).toBe(true);
      expect(inativos.itens.some(temVinculoAtivo)).toBe(false);

      // Os contadores nunca acompanham o filtro.
      for (const r of [ativos, inativos]) {
        expect(r.contadores).toEqual(todos.contadores);
      }
    });

    it("filtra antes de paginar: página a página, só inativos, sem perder ninguém", async () => {
      const inativos = await listar(rhA, { ...TUDO, situacao: "inativo" });
      const vistos: string[] = [];
      for (let pagina = 1; pagina <= inativos.total; pagina++) {
        const r = await listar(rhA, {
          situacao: "inativo",
          tamanhoPagina: "1",
          pagina: String(pagina),
        });
        // Se o filtro viesse depois da paginação, alguma página de tamanho 1
        // traria um ativo ou viria vazia — e o total seria o do escopo.
        expect(r.total).toBe(inativos.total);
        expect(r.itens).toHaveLength(1);
        expect(r.itens[0]!.situacao).toBe("inativo");
        vistos.push(r.itens[0]!.id);
      }
      expect(vistos.sort()).toEqual(ids(inativos.itens));
      const alem = await listar(rhA, {
        situacao: "inativo",
        tamanhoPagina: "1",
        pagina: String(inativos.total + 1),
      });
      expect(alem.itens).toEqual([]);
    });

    it("combina com a busca: o recorte é a interseção, e os contadores não mudam", async () => {
      const todos = await listar(rhA, TUDO);
      const busca = await listar(rhA, { ...TUDO, busca: "Sintetic" });
      for (const situacao of ["ativo", "inativo"] as const) {
        const r = await listar(rhA, { ...TUDO, busca: "Sintetic", situacao });
        expect(ids(r.itens)).toEqual(
          ids(busca.itens.filter((i) => i.situacao === situacao)),
        );
        expect(r.itens.length).toBeGreaterThan(0);
        expect(r.contadores).toEqual(todos.contadores);
      }
      // Busca por matrícula também combina.
      const porMatricula = await listar(rhA, {
        busca: "MAT-L-BRU",
        situacao: "ativo",
      });
      expect(porMatricula.itens).toEqual([]);
      expect(
        nomes(
          (await listar(rhA, { busca: "MAT-L-BRU", situacao: "inativo" }))
            .itens,
        ),
      ).toEqual(["Bruno Sintetico Alfa"]);
    });

    it("situação é por empresa: a Carla é ativa na Alfa e inativa na Beta", async () => {
      const busca = { ...TUDO, busca: "Carla Sintetica" };
      expect(
        ids((await listar(rhA, { ...busca, situacao: "ativo" })).itens),
      ).toEqual([carla]);
      expect(
        (await listar(rhA, { ...busca, situacao: "inativo" })).itens,
      ).toEqual([]);
      for (const cred of [rhB, masterEscopadoB]) {
        expect(
          ids((await listar(cred, { ...busca, situacao: "inativo" })).itens),
        ).toEqual([carla]);
        expect(
          (await listar(cred, { ...busca, situacao: "ativo" })).itens,
        ).toEqual([]);
      }
      // Master sem empresa ativa: a regra global da T178 (situação
      // materializada) — a Carla está ativa em alguma empresa.
      expect(
        ids((await listar(master, { ...busca, situacao: "ativo" })).itens),
      ).toEqual([carla]);
      expect(
        (await listar(master, { ...busca, situacao: "inativo" })).itens,
      ).toEqual([]);
    });

    it("DP vê o mesmo recorte que o RH; master por empresa, o mesmo que o RH da empresa", async () => {
      for (const situacao of ["ativo", "inativo"] as const) {
        expect(await listar(dpA, { ...TUDO, situacao })).toEqual(
          await listar(rhA, { ...TUDO, situacao }),
        );
        expect(await listar(masterEscopadoB, { ...TUDO, situacao })).toEqual(
          await listar(rhB, { ...TUDO, situacao }),
        );
      }
    });

    it("gestor, colaborador e financeiro seguem negados, com ou sem filtro", async () => {
      const financeiroA = await criarUsuario(
        "fin.la@example.test",
        "financeiro",
        empresaA,
      );
      for (const cred of [gestorA, colaboradorA, financeiroA]) {
        for (const situacao of ["ativo", "inativo"]) {
          const negada = await get(
            `/v1/colaboradores?situacao=${situacao}`,
            cred,
          );
          expect([403, 404]).toContain(negada.status);
          expect(JSON.stringify(negada.body)).not.toContain("Sintetic");
        }
      }
    });

    it("situação fora do contrato é recusada, nunca ignorada", async () => {
      await get("/v1/colaboradores?situacao=previsto", rhA).expect(400);
      await get("/v1/colaboradores?situacao=todos", rhA).expect(400);
    });
  });
});
