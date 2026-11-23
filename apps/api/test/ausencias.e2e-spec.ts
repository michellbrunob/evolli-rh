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
  hojeEmSaoPaulo,
  somarDias,
  somarMeses,
} from "../src/pessoas/ausencias/calculo-ausencias";
import {
  camposObrigatoriosAdmissao,
  lotacaoMinima,
} from "./admissao-obrigatoria";

/**
 * T215 — Férias e ausências: `GET/POST /v1/ausencias`, a simulação, as
 * decisões (`aprovar`, `recusar`, `cancelar`) e o saldo da ficha
 * (`GET /v1/colaboradores/:id/ferias`). PostgreSQL real e efêmero
 * (Testcontainers), migrations do zero.
 *
 * Datas relativas ao dia civil de São Paulo de hoje (o mesmo do servidor):
 * a admissão é 18 meses atrás, então o primeiro período aquisitivo já
 * terminou e está no prazo de gozo, e o segundo está em aquisição.
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
const SENHA_PADRAO = "Ausencias!Sinteticas#2026";

const HOJE = hojeEmSaoPaulo();
const ADMISSAO = somarMeses(HOJE, -18);
const FIM_DO_PERIODO_1 = somarDias(somarMeses(ADMISSAO, 12), -1);

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

describe("T215 — Férias e ausências (e2e)", () => {
  let container: StartedTestContainer;
  let app: INestApplication;
  let prisma: PrismaClient;
  let appUrl: string;

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

  async function criarMaster(email: string): Promise<Credencial> {
    const { PasswordHashService } =
      await import("../src/auth/password/password-hash.service");
    await prisma.accessUser.create({
      data: {
        email,
        passwordHash: await new PasswordHashService().hash(SENHA_PADRAO),
        role: "master_tecnico",
        status: "active",
      },
    });
    return login(email);
  }

  let sequencia = 0;
  /** Admite pela API (18 meses atrás); `ativo` efetiva a admissão. */
  async function admitir(
    cred: Credencial,
    empresaId: string,
    estado: "ativo" | "previsto" = "ativo",
  ): Promise<{ id: string; nome: string }> {
    sequencia += 1;
    const nome = `Pessoa Ausencia ${String.fromCharCode(65 + (sequencia % 26))}${sequencia}`;
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
    if (estado === "ativo") {
      await post(`/v1/movimentacoes/${r.body.movimentacao.id}/efetivar`, cred)
        .send()
        .expect(201);
    }
    return { id: r.body.id as string, nome };
  }

  const trilha = (ausenciaId: string) =>
    prisma.auditEvent.findMany({
      where: { resourceId: ausenciaId, resource: "ausencia" },
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

    master = await criarMaster("master.ausencias@example.test");
    const empresa = async (codigo: string) =>
      (
        await post("/v1/empresas", master)
          .send({ codigo, nome: `Empresa ${codigo}` })
          .expect(201)
      ).body.id as string;
    empresaA = await empresa("AUSA");
    empresaB = await empresa("AUSB");
    rhA = await criarUsuario("rh.ausa@example.test", "rh", empresaA);
    dpA = await criarUsuario("dp.ausa@example.test", "dp", empresaA);
    rhB = await criarUsuario("rh.ausb@example.test", "rh", empresaB);
    for (const papel of ["gestor", "financeiro", "colaborador"]) {
      outrosPapeis.push([
        papel,
        await criarUsuario(`${papel}.ausa@example.test`, papel, empresaA),
      ]);
    }
    masterA = await criarMaster("master.ausencias.a@example.test");
    await post("/v1/auth/contexto/empresa", masterA)
      .send({ empresaId: empresaA })
      .expect(200);
  });

  afterAll(async () => {
    await app?.close();
    await prisma?.$disconnect();
    await container?.stop();
  });

  describe("migration", () => {
    it("histórico imutável: a aplicação não apaga ausência", async () => {
      const linhas = await prisma.$queryRaw<{ pode: boolean }[]>`
        SELECT has_table_privilege('evolli_app', 'app.ausencia', 'DELETE') AS pode`;
      expect(linhas[0]!.pode).toBe(false);
    });

    it("CHECKs: só o afastamento fica sem volta e tem motivo; venda só nas férias", async () => {
      const { id } = await admitir(rhA, empresaA);
      const vinculo = await prisma.vinculoFuncional.findFirstOrThrow({
        where: { colaboradorId: id },
      });
      const autor = await prisma.accessUser.findFirstOrThrow({
        where: { email: "rh.ausa@example.test" },
      });
      const base = {
        empresaId: empresaA,
        colaboradorId: id,
        vinculoId: vinculo.id,
        registradoPorId: autor.id,
        status: "aprovada" as const,
        inicio: new Date("2030-01-10"),
      };
      await expect(
        prisma.ausencia.create({ data: { ...base, tipo: "day_off" } }),
      ).rejects.toThrow();
      await expect(
        prisma.ausencia.create({
          data: { ...base, tipo: "afastamento", fim: new Date("2030-01-12") },
        }),
      ).rejects.toThrow();
      await expect(
        prisma.ausencia.create({
          data: {
            ...base,
            tipo: "day_off",
            fim: new Date("2030-01-10"),
            diasVendidos: 2,
          },
        }),
      ).rejects.toThrow();
      await expect(
        prisma.ausencia.create({
          data: { ...base, tipo: "day_off", fim: new Date("2030-01-09") },
        }),
      ).rejects.toThrow();
    });
  });

  describe("acesso", () => {
    it.each(["gestor", "financeiro", "colaborador"])(
      "%s: 403 na lista e no registro",
      async (papel) => {
        const cred = outrosPapeis.find(([p]) => p === papel)![1];
        await get("/v1/ausencias", cred).expect(403);
        await post("/v1/ausencias", cred).send({}).expect(403);
      },
    );

    it("master técnico: sem empresa ativa, 403; com ela, só lê", async () => {
      await get("/v1/ausencias", master).expect(403);
      const r = await get("/v1/ausencias", masterA).expect(200);
      expect(r.headers["cache-control"]).toBe("no-store");
      const { id } = await admitir(rhA, empresaA);
      await post("/v1/ausencias", masterA)
        .send({
          colaboradorId: id,
          tipo: "day_off",
          inicio: somarDias(HOJE, 60),
          fim: somarDias(HOJE, 60),
          aprovada: true,
        })
        .expect(403);
    });

    it("sem CSRF, o registro é recusado", async () => {
      await agent()
        .post("/v1/ausencias")
        .set("Cookie", rhA.cookie)
        .send({})
        .expect(403);
    });

    it("outra empresa: colaborador e ausência respondem 404", async () => {
      const { id } = await admitir(rhA, empresaA);
      const r = await post("/v1/ausencias", rhA)
        .send({
          colaboradorId: id,
          tipo: "day_off",
          inicio: somarDias(HOJE, 61),
          fim: somarDias(HOJE, 61),
          aprovada: false,
        })
        .expect(201);
      await post("/v1/ausencias", rhB)
        .send({
          colaboradorId: id,
          tipo: "day_off",
          inicio: somarDias(HOJE, 62),
          fim: somarDias(HOJE, 62),
          aprovada: true,
        })
        .expect(404);
      await post(`/v1/ausencias/${r.body.id}/aprovar`, rhB).send().expect(404);
      await get(`/v1/colaboradores/${id}/ferias`, rhB).expect(404);
      const daB = await get("/v1/ausencias", rhB).expect(200);
      expect(daB.body.itens.map((a: { id: string }) => a.id)).not.toContain(
        r.body.id,
      );
    });
  });

  describe("registro de férias", () => {
    let ana: { id: string; nome: string };
    let anaFerias: string;

    beforeAll(async () => {
      ana = await admitir(rhA, empresaA);
    });

    it("aprovada: 201, dias e período aquisitivo; trilha sem valores", async () => {
      const inicio = somarDias(HOJE, 10);
      const fim = somarDias(inicio, 19);
      const r = await post("/v1/ausencias", rhA)
        .send({
          colaboradorId: ana.id,
          tipo: "ferias",
          inicio,
          fim,
          diasVendidos: 5,
          aprovada: true,
          observacao: "  viagem em família  ",
        })
        .expect(201);
      expect(r.headers["cache-control"]).toBe("no-store");
      expect(r.body).toMatchObject({
        colaborador: { id: ana.id, nome: ana.nome },
        tipo: "ferias",
        inicio,
        fim,
        dias: 20,
        diasVendidos: 5,
        periodoAquisitivo: { inicio: ADMISSAO, fim: FIM_DO_PERIODO_1 },
        status: "aprovada",
        observacao: "viagem em família",
        decididoEm: expect.any(String),
      });
      expect(r.body.diasUteis).toBeGreaterThan(0);
      anaFerias = r.body.id;
      const eventos = await trilha(anaFerias);
      expect(eventos).toHaveLength(1);
      expect(eventos[0]).toMatchObject({
        action: "pessoas_ausencia_registrada",
        companyId: empresaA,
        result: "success",
      });
    });

    it("sobreposição com outra ausência da pessoa: 409 no início", async () => {
      const r = await post("/v1/ausencias", dpA)
        .send({
          colaboradorId: ana.id,
          tipo: "day_off",
          inicio: somarDias(HOJE, 15),
          fim: somarDias(HOJE, 15),
          aprovada: true,
        })
        .expect(409);
      expect(r.body.erros).toEqual([
        { campo: "inicio", motivo: "sobreposicao" },
      ]);
    });

    it("além do saldo: 422 saldo_insuficiente (25 já usados de 30)", async () => {
      const inicio = somarDias(HOJE, 40);
      const r = await post("/v1/ausencias", rhA)
        .send({
          colaboradorId: ana.id,
          tipo: "ferias",
          inicio,
          fim: somarDias(inicio, 5),
          aprovada: true,
        })
        .expect(422);
      expect(r.body.erros).toEqual([
        { campo: "fim", motivo: "saldo_insuficiente" },
      ]);
    });

    it("o saldo da ficha: períodos, atual, próxima e histórico", async () => {
      const r = await get(`/v1/colaboradores/${ana.id}/ferias`, rhA).expect(
        200,
      );
      expect(r.headers["cache-control"]).toBe("no-store");
      expect(r.body.periodos[0]).toMatchObject({
        inicio: ADMISSAO,
        fim: FIM_DO_PERIODO_1,
        direito: 30,
        solicitados: 25,
        disponiveis: 5,
        situacao: "disponivel",
      });
      expect(r.body.periodos[1].situacao).toBe("em_aquisicao");
      expect(r.body.periodoAtual).toBe(0);
      expect(r.body.proximaAusencia.id).toBe(anaFerias);
      expect(r.body.historico.map((a: { id: string }) => a.id)).toEqual([
        anaFerias,
      ]);
    });

    it("cancelar devolve o saldo; nada é apagado", async () => {
      await post(`/v1/ausencias/${anaFerias}/cancelar`, rhA).send().expect(200);
      const r = await get(`/v1/colaboradores/${ana.id}/ferias`, rhA).expect(
        200,
      );
      expect(r.body.periodos[0].disponiveis).toBe(30);
      expect(r.body.historico[0].status).toBe("cancelada");
      expect(await prisma.ausencia.count({ where: { id: anaFerias } })).toBe(1);
    });

    it("simulação: dias, volta, período, saldo, venda e prazo do abono", async () => {
      const inicio = somarDias(HOJE, 10);
      const r = await get("/v1/ausencias/simulacao", rhA)
        .query({
          colaboradorId: ana.id,
          tipo: "ferias",
          inicio,
          fim: somarDias(inicio, 19),
          diasVendidos: "10",
        })
        .expect(200);
      expect(r.body).toMatchObject({
        dias: 20,
        periodo: { inicio: ADMISSAO, fim: FIM_DO_PERIODO_1 },
        saldoAntes: 30,
        saldoDepois: 0,
        maxVendaveis: 10,
        prazoAbono: somarDias(FIM_DO_PERIODO_1, -15),
      });
      expect(r.body.volta > somarDias(inicio, 19)).toBe(true);
      const dayOff = await get("/v1/ausencias/simulacao", rhA)
        .query({ colaboradorId: ana.id, tipo: "day_off", inicio, fim: inicio })
        .expect(200);
      expect(dayOff.body).toMatchObject({
        dias: 1,
        periodo: null,
        saldoAntes: null,
      });
    });
  });

  describe("validação do registro", () => {
    let pessoa: { id: string };
    beforeAll(async () => {
      pessoa = await admitir(rhA, empresaA);
    });

    it.each([
      [
        "volta antes do início",
        { tipo: "day_off", inicio: "2031-02-10", fim: "2031-02-09" },
        [{ campo: "fim", motivo: "fim_antes_do_inicio" }],
      ],
      [
        "afastamento sem motivo",
        { tipo: "afastamento", inicio: "2031-02-10" },
        [{ campo: "motivoAfastamento", motivo: "obrigatorio" }],
      ],
      [
        "venda fora das férias",
        {
          tipo: "day_off",
          inicio: "2031-02-10",
          fim: "2031-02-10",
          diasVendidos: 2,
        },
        [{ campo: "diasVendidos", motivo: "nao_se_aplica" }],
      ],
      [
        "sem data de volta fora do afastamento",
        { tipo: "licenca_medica", inicio: "2031-02-10" },
        [{ campo: "fim", motivo: "obrigatorio" }],
      ],
    ])("%s: 422 por campo", async (_caso, corpo, erros) => {
      const r = await post("/v1/ausencias", rhA)
        .send({ colaboradorId: pessoa.id, aprovada: true, ...corpo })
        .expect(422);
      expect(r.body.erros).toEqual(erros);
    });

    it("venda acima de 10 dias é recusada já na forma (400)", async () => {
      await post("/v1/ausencias", rhA)
        .send({
          colaboradorId: pessoa.id,
          tipo: "ferias",
          inicio: "2031-02-10",
          fim: "2031-02-20",
          diasVendidos: 11,
          aprovada: true,
        })
        .expect(400);
    });

    it("pessoa com admissão ainda não efetivada: 422 no colaborador", async () => {
      const previsto = await admitir(rhA, empresaA, "previsto");
      const r = await post("/v1/ausencias", rhA)
        .send({
          colaboradorId: previsto.id,
          tipo: "day_off",
          inicio: "2031-02-10",
          fim: "2031-02-10",
          aprovada: true,
        })
        .expect(422);
      expect(r.body.erros).toEqual([
        { campo: "colaboradorId", motivo: "indisponivel" },
      ]);
    });
  });

  describe("decisões, filtros e indicadores", () => {
    let bia: { id: string; nome: string };
    let caio: { id: string; nome: string };
    let duda: { id: string; nome: string };
    let eva: { id: string; nome: string };
    let feriasDaBia: string;
    let afastamentoDoCaio: string;
    let faltaDaDuda: string;
    let faltaDaEva: string;

    beforeAll(async () => {
      bia = await admitir(rhA, empresaA);
      caio = await admitir(rhA, empresaA);
      duda = await admitir(rhA, empresaA);
      eva = await admitir(rhA, empresaA);
      feriasDaBia = (
        await post("/v1/ausencias", rhA)
          .send({
            colaboradorId: bia.id,
            tipo: "ferias",
            inicio: HOJE,
            fim: somarDias(HOJE, 9),
            aprovada: true,
          })
          .expect(201)
      ).body.id;
      // Afastamento: sempre aprovado, mesmo pedido como "ainda não".
      const afastamento = await post("/v1/ausencias", rhA)
        .send({
          colaboradorId: caio.id,
          tipo: "afastamento",
          motivoAfastamento: "auxilio_doenca",
          inicio: somarDias(HOJE, -3),
          aprovada: false,
        })
        .expect(201);
      expect(afastamento.body).toMatchObject({
        status: "aprovada",
        fim: null,
        dias: null,
      });
      afastamentoDoCaio = afastamento.body.id;
      faltaDaDuda = (
        await post("/v1/ausencias", rhA)
          .send({
            colaboradorId: duda.id,
            tipo: "falta_justificada",
            inicio: HOJE,
            fim: HOJE,
            aprovada: false,
          })
          .expect(201)
      ).body.id;
      faltaDaEva = (
        await post("/v1/ausencias", dpA)
          .send({
            colaboradorId: eva.id,
            tipo: "falta_sem_justificativa",
            inicio: HOJE,
            fim: HOJE,
            aprovada: false,
          })
          .expect(201)
      ).body.id;
    });

    const listar = (query: Record<string, string> = {}) =>
      get("/v1/ausencias", rhA)
        .query({ tamanhoPagina: "100", ...query })
        .expect(200)
        .then((r) => r.body);
    const ids = (corpo: { itens: { id: string }[] }) =>
      corpo.itens.map((i) => i.id);

    it("indicadores do escopo inteiro", async () => {
      const corpo = await listar();
      expect(corpo.indicadores).toMatchObject({
        emFeriasAgora: 1,
        licencasEAfastamentos: 1,
        faltasEsteMes: 2,
        pendentes: expect.any(Number),
      });
      expect(corpo.indicadores.pendentes).toBeGreaterThanOrEqual(2);
      const daB = await get("/v1/ausencias", rhB).expect(200);
      expect(daB.body.indicadores.faltasEsteMes).toBe(0);
    });

    it("filtros de período, tipo, status e busca", async () => {
      expect(ids(await listar({ periodo: "em_ferias_agora" }))).toEqual([
        feriasDaBia,
      ]);
      expect(ids(await listar({ periodo: "licencas_afastamentos" }))).toEqual([
        afastamentoDoCaio,
      ]);
      expect(ids(await listar({ periodo: "faltas_mes" })).sort()).toEqual(
        [faltaDaDuda, faltaDaEva].sort(),
      );
      expect(ids(await listar({ tipo: "afastamentos" }))).toEqual([
        afastamentoDoCaio,
      ]);
      const aguardando = ids(await listar({ status: "aguardando_voce" }));
      expect(aguardando).toEqual(
        expect.arrayContaining([faltaDaDuda, faltaDaEva]),
      );
      expect(ids(await listar({ busca: duda.nome }))).toEqual([faltaDaDuda]);
      await get("/v1/ausencias", rhA).query({ periodo: "ontem" }).expect(400);
    });

    it("aprovar: aprovada, com trilha; de novo é idempotente; recusar depois é 409", async () => {
      const r = await post(`/v1/ausencias/${faltaDaDuda}/aprovar`, rhA)
        .send()
        .expect(200);
      expect(r.body.status).toBe("aprovada");
      await post(`/v1/ausencias/${faltaDaDuda}/aprovar`, dpA)
        .send()
        .expect(200);
      const eventos = await trilha(faltaDaDuda);
      expect(eventos.map((e) => e.action)).toEqual([
        "pessoas_ausencia_registrada",
        "pessoas_ausencia_aprovada",
      ]);
      await post(`/v1/ausencias/${faltaDaDuda}/recusar`, rhA)
        .send()
        .expect(409);
    });

    it("recusar com motivo; cancelar a recusada é 409", async () => {
      const r = await post(`/v1/ausencias/${faltaDaEva}/recusar`, rhA)
        .send({ motivo: "Sem justificativa apresentada" })
        .expect(200);
      expect(r.body.status).toBe("recusada");
      const linha = await prisma.ausencia.findUniqueOrThrow({
        where: { id: faltaDaEva },
      });
      expect(linha.motivoDecisao).toBe("Sem justificativa apresentada");
      await post(`/v1/ausencias/${faltaDaEva}/cancelar`, rhA)
        .send()
        .expect(409);
    });

    it("master técnico com empresa ativa vê a lista, mas não decide", async () => {
      const corpo = (await get("/v1/ausencias", masterA).expect(200)).body;
      expect(corpo.total).toBeGreaterThan(0);
      await post(`/v1/ausencias/${feriasDaBia}/cancelar`, masterA)
        .send()
        .expect(403);
    });
  });
});
