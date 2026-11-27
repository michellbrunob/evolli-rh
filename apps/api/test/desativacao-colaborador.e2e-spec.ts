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
 * T215 — desativar e reativar o colaborador NA EMPRESA (lixeira do "Editar
 * colaborador"): `POST /v1/colaboradores/:colaboradorId/desativar` e
 * `/reativar`. PostgreSQL real e efêmero (Testcontainers), migrations do zero.
 *
 * Prova: a tabela nova (histórico imutável: sem DELETE para a aplicação; uma
 * só desativação vigente por pessoa e empresa; CHECKs); RH e DP desativam e
 * reativam, master técnico e os demais papéis não; outra empresa é 404;
 * CSRF; `no-store`; idempotência sem trilha a mais; o contrato diz o estado;
 * a listagem tira o desativado de Ativos, Em admissão e Desligados (e dos
 * contadores e do filtro de situação), mas o mantém em Todos, marcado; a
 * reativação o devolve. Nada do colaborador é apagado.
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
const SENHA_PADRAO = "Desativacao!Sintetica#2026";
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

interface Credencial {
  cookie: string;
  csrfToken: string;
}

interface ItemListado {
  id: string;
  nome: string;
  situacao: string;
  desativado: boolean;
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
  };
}

describe("T215 — desativar e reativar o colaborador (e2e)", () => {
  let container: StartedTestContainer;
  let app: INestApplication;
  let prisma: PrismaClient;
  let appUrl: string;

  let master: Credencial;
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
  ): Promise<{ id: string; nome: string; vinculoId: string }> {
    sequencia += 1;
    const nome = `Pessoa Desativacao ${String.fromCharCode(65 + (sequencia % 26))}${sequencia}`;
    const r = await post("/v1/colaboradores", cred)
      .send({
        ...camposObrigatoriosAdmissao(),
        ...(await lotacaoMinima(appUrl, empresaId)),
        nome,
        empresaId,
        tipo: "clt",
        dataAdmissao: ADMISSAO,
        motivoCodigo: "admissao_inicial",
      })
      .expect(201);
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
          dataDesligamento: new Date("2026-06-30"),
        },
      });
    }
    return { id: r.body.id as string, nome, vinculoId };
  }

  const rota = (colaboradorId: string, acao: "desativar" | "reativar") =>
    `/v1/colaboradores/${colaboradorId}/${acao}`;

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

  const trilha = (colaboradorId: string) =>
    prisma.auditEvent.findMany({
      where: {
        resourceId: colaboradorId,
        action: {
          in: [
            "pessoas_colaborador_desativado",
            "pessoas_colaborador_reativado",
          ],
        },
      },
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
        email: "master.desativacao@example.test",
        passwordHash: await new PasswordHashService().hash(SENHA_PADRAO),
        role: "master_tecnico",
        status: "active",
      },
    });
    master = await login("master.desativacao@example.test");
    const empresa = async (codigo: string) =>
      (
        await post("/v1/empresas", master)
          .send({ codigo, nome: `Empresa ${codigo}` })
          .expect(201)
      ).body.id as string;
    empresaA = await empresa("DSTA");
    empresaB = await empresa("DSTB");
    rhA = await criarUsuario("rh.dsta@example.test", "rh", empresaA);
    dpA = await criarUsuario("dp.dsta@example.test", "dp", empresaA);
    rhB = await criarUsuario("rh.dstb@example.test", "rh", empresaB);
    for (const papel of ["gestor", "financeiro", "colaborador"]) {
      outrosPapeis.push([
        papel,
        await criarUsuario(`${papel}.dsta@example.test`, papel, empresaA),
      ]);
    }
  });

  afterAll(async () => {
    await app?.close();
    await prisma?.$disconnect();
    await container?.stop();
  });

  describe("migration", () => {
    it("histórico imutável: a aplicação não apaga linha da desativação", async () => {
      const linhas = await prisma.$queryRaw<{ pode: boolean }[]>`
        SELECT has_table_privilege(
          'evolli_app', 'app.desativacao_colaborador', 'DELETE'
        ) AS pode`;
      expect(linhas[0]!.pode).toBe(false);
    });

    it("uma só desativação vigente por pessoa e empresa; reativação coerente", async () => {
      const { id } = await admitir(rhA, empresaA);
      const usuario = await prisma.accessUser.findFirstOrThrow({
        where: { email: "rh.dsta@example.test" },
      });
      await prisma.desativacaoColaborador.create({
        data: {
          colaboradorId: id,
          empresaId: empresaA,
          desativadoPorId: usuario.id,
        },
      });
      await expect(
        prisma.desativacaoColaborador.create({
          data: {
            colaboradorId: id,
            empresaId: empresaA,
            desativadoPorId: usuario.id,
          },
        }),
      ).rejects.toThrow();
      // Reativação só com quem reativou, e nunca antes da desativação.
      await expect(
        prisma.desativacaoColaborador.updateMany({
          where: { colaboradorId: id },
          data: { reativadoEm: new Date() },
        }),
      ).rejects.toThrow();
      await expect(
        prisma.desativacaoColaborador.updateMany({
          where: { colaboradorId: id },
          data: {
            reativadoEm: new Date("2000-01-01"),
            reativadoPorId: usuario.id,
          },
        }),
      ).rejects.toThrow();
    });
  });

  describe("desativar e reativar", () => {
    it.each(["rh", "dp"] as const)(
      "%s desativa: 200, sem cache, trilha sem valores; de novo é idempotente",
      async (papel) => {
        const cred = papel === "rh" ? rhA : dpA;
        const { id } = await admitir(rhA, empresaA);
        const r = await post(rota(id, "desativar"), cred).send().expect(200);
        expect(r.headers["cache-control"]).toBe("no-store");
        expect(r.body).toEqual({
          colaboradorId: id,
          empresaId: empresaA,
          desativado: true,
          desativadoEm: expect.any(String),
        });
        const de_novo = await post(rota(id, "desativar"), cred)
          .send()
          .expect(200);
        expect(de_novo.body.desativadoEm).toBe(r.body.desativadoEm);
        const eventos = await trilha(id);
        expect(eventos).toHaveLength(1);
        expect(eventos[0]).toMatchObject({
          action: "pessoas_colaborador_desativado",
          resource: "colaborador",
          companyId: empresaA,
          result: "success",
        });
        // Nada do colaborador sumiu.
        expect(
          await prisma.colaborador.findUnique({ where: { id } }),
        ).not.toBeNull();
        expect(
          await prisma.vinculoFuncional.count({ where: { colaboradorId: id } }),
        ).toBe(1);
      },
    );

    it("o contrato diz o estado; reativar desfaz, guarda o histórico e é idempotente", async () => {
      const { id } = await admitir(rhA, empresaA);
      const contrato = () =>
        get(`/v1/colaboradores/${id}/contrato`, rhA).expect(200);
      expect((await contrato()).body).toMatchObject({
        desativado: false,
        desativadoEm: null,
      });
      await post(rota(id, "desativar"), rhA).send().expect(200);
      const lido = (await contrato()).body;
      expect(lido.desativado).toBe(true);
      expect(lido.desativadoEm).toEqual(expect.any(String));

      const r = await post(rota(id, "reativar"), rhA).send().expect(200);
      expect(r.headers["cache-control"]).toBe("no-store");
      expect(r.body).toEqual({
        colaboradorId: id,
        empresaId: empresaA,
        desativado: false,
        desativadoEm: null,
      });
      await post(rota(id, "reativar"), rhA).send().expect(200);
      expect((await contrato()).body.desativado).toBe(false);
      expect((await trilha(id)).map((e) => e.action)).toEqual([
        "pessoas_colaborador_desativado",
        "pessoas_colaborador_reativado",
      ]);
      // Desativar de novo abre outra linha; a anterior fica, reativada.
      await post(rota(id, "desativar"), rhA).send().expect(200);
      const historico = await prisma.desativacaoColaborador.findMany({
        where: { colaboradorId: id },
        orderBy: { desativadoEm: "asc" },
      });
      expect(historico).toHaveLength(2);
      expect(historico[0]!.reativadoEm).not.toBeNull();
      expect(historico[1]!.reativadoEm).toBeNull();
    });

    it("master técnico e os demais papéis: 403, nada gravado", async () => {
      const { id } = await admitir(rhA, empresaA);
      for (const cred of [master, ...outrosPapeis.map(([, c]) => c)]) {
        await post(rota(id, "desativar"), cred).send().expect(403);
        await post(rota(id, "reativar"), cred).send().expect(403);
      }
      expect(
        await prisma.desativacaoColaborador.count({
          where: { colaboradorId: id },
        }),
      ).toBe(0);
    });

    it("outra empresa: 404, nada gravado", async () => {
      const { id } = await admitir(rhA, empresaA);
      await post(rota(id, "desativar"), rhB).send().expect(404);
      expect(
        await prisma.desativacaoColaborador.count({
          where: { colaboradorId: id },
        }),
      ).toBe(0);
      await post(rota("99999999-9999-4999-8999-999999999999", "desativar"), rhA)
        .send()
        .expect(404);
    });

    it("sem CSRF: 403, nada gravado", async () => {
      const { id } = await admitir(rhA, empresaA);
      await agent()
        .post(rota(id, "desativar"))
        .set("Cookie", rhA.cookie)
        .send()
        .expect(403);
      expect(
        await prisma.desativacaoColaborador.count({
          where: { colaboradorId: id },
        }),
      ).toBe(0);
    });
  });

  describe("listagem", () => {
    it("o desativado sai de Ativos, Em admissão e Desligados e fica só em Todos, marcado", async () => {
      const ativo = await admitir(rhA, empresaA, "ativo");
      const previsto = await admitir(rhA, empresaA, "previsto");
      const desligado = await admitir(rhA, empresaA, "desligado");
      const controle = await admitir(rhA, empresaA, "ativo");
      const antes = await listar(rhA);

      for (const p of [ativo, previsto, desligado]) {
        await post(rota(p.id, "desativar"), rhA).send().expect(200);
      }
      const desativados = [ativo.id, previsto.id, desligado.id];

      for (const grupo of ["ativos", "em_admissao", "desligados"]) {
        const lista = await listar(rhA, { grupo });
        for (const id of desativados) expect(ids(lista)).not.toContain(id);
      }
      const todos = await listar(rhA);
      for (const id of desativados) {
        const item = todos.itens.find((i) => i.id === id)!;
        expect(item).toMatchObject({ desativado: true, situacao: "inativo" });
      }
      expect(todos.itens.find((i) => i.id === controle.id)).toMatchObject({
        desativado: false,
        situacao: "ativo",
      });
      expect(ids(await listar(rhA, { grupo: "ativos" }))).toContain(
        controle.id,
      );

      // Contadores e o filtro de situação seguem a mesma regra.
      const c = todos.contadores;
      expect(c.ativos).toBe(antes.contadores.ativos - 1);
      expect(c.emAdmissao).toBe(antes.contadores.emAdmissao - 1);
      expect(c.desligados).toBe(antes.contadores.desligados - 1);
      expect(c.desativados).toBe(antes.contadores.desativados + 3);
      expect(c.total).toBe(antes.contadores.total);
      expect(c.ativos + c.emAdmissao + c.desligados + c.desativados).toBe(
        c.total,
      );
      expect(c.inativos).toBe(c.total - c.ativos);
      expect(c.ativosPorTipo.clt).toBe(antes.contadores.ativosPorTipo.clt! - 1);
      expect(ids(await listar(rhA, { situacao: "ativo" }))).not.toContain(
        ativo.id,
      );
      expect(ids(await listar(rhA, { situacao: "inativo" }))).toContain(
        ativo.id,
      );

      // Reativar devolve cada um ao seu grupo.
      await post(rota(ativo.id, "reativar"), rhA).send().expect(200);
      await post(rota(previsto.id, "reativar"), rhA).send().expect(200);
      expect(ids(await listar(rhA, { grupo: "ativos" }))).toContain(ativo.id);
      expect(ids(await listar(rhA, { grupo: "em_admissao" }))).toContain(
        previsto.id,
      );
      const depois = (await listar(rhA)).itens.find((i) => i.id === ativo.id)!;
      expect(depois).toMatchObject({ desativado: false, situacao: "ativo" });
    });

    it("a outra empresa não vê nada da desativação", async () => {
      const deB = await admitir(rhB, empresaB, "ativo");
      const antesB = await listar(rhB, { grupo: "ativos" });
      const deA = await admitir(rhA, empresaA, "ativo");
      await post(rota(deA.id, "desativar"), rhA).send().expect(200);
      const depoisB = await listar(rhB, { grupo: "ativos" });
      expect(ids(depoisB)).toContain(deB.id);
      expect(depoisB.contadores).toEqual(antesB.contadores);
    });
  });
});
