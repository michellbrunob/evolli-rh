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
import { CAMPOS_OBRIGATORIOS_ADMISSAO } from "./admissao-obrigatoria";

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
        ...CAMPOS_OBRIGATORIOS_ADMISSAO,
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
          "matricula",
          "situacao",
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
          ...CAMPOS_OBRIGATORIOS_ADMISSAO,
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
});
