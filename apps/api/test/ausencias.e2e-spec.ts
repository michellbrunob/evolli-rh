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
import { ArmazenamentoEmMemoria } from "../src/pessoas/foto-colaborador/armazenamento-de-objetos";
import { ARMAZENAMENTO_DE_DOCUMENTOS } from "../src/pessoas/documentos-colaborador/armazenamento-de-documentos";
import {
  ASSINATURA_DE_TESTE_ANTIVIRUS,
  VERIFICADOR_DE_ARQUIVOS,
  VerificadorFalso,
} from "../src/pessoas/documentos-colaborador/verificador-de-arquivos";
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

  async function criarUsuarioDireto(
    email: string,
    role: string,
    companyId: string,
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

  /** O R2 dos testes: em memória, nenhum teste fala com o bucket. */
  const armazenamento = new ArmazenamentoEmMemoria();

  let sequencia = 0;
  /** Admite pela API (18 meses atrás); `ativo` efetiva a admissão. */
  async function admitir(
    cred: Credencial,
    empresaId: string,
    estado: "ativo" | "previsto" = "ativo",
    tipo = "clt",
    dataAdmissao = ADMISSAO,
  ): Promise<{ id: string; nome: string }> {
    sequencia += 1;
    const nome = `Pessoa Ausencia ${String.fromCharCode(65 + (sequencia % 26))}${sequencia}`;
    const r = await post("/v1/colaboradores", cred)
      .send({
        ...camposObrigatoriosAdmissao(),
        ...(await lotacaoMinima(appUrl, empresaId)),
        nome,
        empresaId,
        tipo,
        dataAdmissao,
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
    })
      .overrideProvider(ARMAZENAMENTO_DE_DOCUMENTOS)
      .useValue(armazenamento)
      .overrideProvider(VERIFICADOR_DE_ARQUIVOS)
      .useValue(new VerificadorFalso())
      .compile();
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
        // Direto no banco: a API não deixa criar alguns destes papéis.
        await criarUsuarioDireto(`${papel}.ausa@example.test`, papel, empresaA),
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
        // Como a referência (número da aba): pessoas fora hoje, com a
        // ausência aprovada — a Bia (férias) e o Caio (afastamento); as
        // faltas ainda pendentes não contam.
        ausentesHoje: 2,
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
        .send({ motivo: "Tarde demais" })
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

  describe("regras de férias por vínculo e a ficha", () => {
    const ficha = async (id: string) =>
      (await get(`/v1/colaboradores/${id}/ferias`, rhA).expect(200)).body;

    it("CLT: saldo automático (regra calculada) e o tipo do vínculo", async () => {
      const p = await admitir(rhA, empresaA);
      const f = await ficha(p.id);
      expect(f.regraDeFerias).toBe("calculada");
      expect(f.vinculo).toMatchObject({ tipo: "clt", dataAdmissao: ADMISSAO });
      expect(f.periodos[0]).toMatchObject({ direito: 30 });
    });

    it("Estágio: saldo automático como o CLT", async () => {
      const p = await admitir(rhA, empresaA, "ativo", "estagio");
      const f = await ficha(p.id);
      expect(f.regraDeFerias).toBe("calculada");
      expect(f.periodos[0]).toMatchObject({ direito: 30 });
    });

    it.each(["pj", "freelancer"])(
      "%s: sem férias — a ficha não tem períodos, registrar férias é 422; outras ausências seguem",
      async (tipo) => {
        const p = await admitir(rhA, empresaA, "ativo", tipo);
        const f = await ficha(p.id);
        expect(f).toMatchObject({
          regraDeFerias: "sem_ferias",
          periodos: [],
          periodoAtual: null,
        });
        const inicio = somarDias(HOJE, 60);
        const recusa = await post("/v1/ausencias", rhA)
          .send({
            colaboradorId: p.id,
            tipo: "ferias",
            inicio,
            fim: somarDias(inicio, 9),
            aprovada: true,
          })
          .expect(422);
        expect(recusa.body.erros).toEqual([
          { campo: "tipo", motivo: "nao_se_aplica" },
        ]);
        await post("/v1/ausencias", rhA)
          .send({
            colaboradorId: p.id,
            tipo: "falta_justificada",
            inicio,
            fim: inicio,
            aprovada: true,
          })
          .expect(201);
        const sim = await get("/v1/ausencias/simulacao", rhA)
          .query({
            colaboradorId: p.id,
            tipo: "ferias",
            inicio,
            fim: somarDias(inicio, 9),
          })
          .expect(200);
        expect(sim.body).toMatchObject({
          regraDeFerias: "sem_ferias",
          saldoAntes: null,
          periodo: null,
        });
      },
    );

    it("Aprendiz: sem regra automática — sem períodos; férias entram sem conferir saldo, sem período e sem venda", async () => {
      const p = await admitir(rhA, empresaA, "ativo", "aprendiz");
      const f = await ficha(p.id);
      expect(f).toMatchObject({
        regraDeFerias: "sem_regra",
        periodos: [],
        periodoAtual: null,
      });
      const inicio = somarDias(HOJE, 40);
      const fim = somarDias(inicio, 29);
      const venda = await post("/v1/ausencias", rhA)
        .send({
          colaboradorId: p.id,
          tipo: "ferias",
          inicio,
          fim,
          diasVendidos: 5,
          aprovada: true,
        })
        .expect(422);
      expect(venda.body.erros).toEqual([
        { campo: "diasVendidos", motivo: "nao_se_aplica" },
      ]);
      const r = await post("/v1/ausencias", rhA)
        .send({
          colaboradorId: p.id,
          tipo: "ferias",
          inicio,
          fim,
          aprovada: true,
        })
        .expect(201);
      expect(r.body).toMatchObject({ periodoAquisitivo: null, dias: 30 });
      const sim = await get("/v1/ausencias/simulacao", rhA)
        .query({
          colaboradorId: p.id,
          tipo: "ferias",
          inicio: somarDias(fim, 30),
          fim: somarDias(fim, 39),
        })
        .expect(200);
      expect(sim.body).toMatchObject({
        regraDeFerias: "sem_regra",
        saldoAntes: null,
        maxVendaveis: null,
      });
    });

    it("a consulta da ficha deixa um evento de leitura, sem valores", async () => {
      const p = await admitir(rhA, empresaA);
      const inicio = somarDias(HOJE, 70);
      await post("/v1/ausencias", rhA)
        .send({
          colaboradorId: p.id,
          tipo: "licenca_medica",
          inicio,
          fim: somarDias(inicio, 2),
          aprovada: true,
          observacao: "Observacao Sigilosa Do Teste",
        })
        .expect(201);
      const antes = new Date();
      await ficha(p.id);
      const eventos = await prisma.auditEvent.findMany({
        where: {
          action: "pessoas_ausencia_consultada",
          resourceId: p.id,
          occurredAt: { gte: antes },
        },
      });
      expect(eventos).toHaveLength(1);
      expect(eventos[0]).toMatchObject({
        resource: "ausencia",
        companyId: empresaA,
        result: "success",
      });
      expect(JSON.stringify(eventos)).not.toContain("Sigilosa");
    });

    it("outra empresa: a ficha de férias responde 404, sem revelar a pessoa", async () => {
      const p = await admitir(rhA, empresaA);
      await get(`/v1/colaboradores/${p.id}/ferias`, rhB).expect(404);
    });
  });

  describe("editar e excluir (como a referência)", () => {
    function patch(rota: string, cred: Credencial) {
      return agent()
        .patch(rota)
        .set("Cookie", cred.cookie)
        .set("x-csrf-token", cred.csrfToken);
    }
    function del(rota: string, cred: Credencial) {
      return agent()
        .delete(rota)
        .set("Cookie", cred.cookie)
        .set("x-csrf-token", cred.csrfToken);
    }
    async function registrar(
      colaboradorId: string,
      corpo: Record<string, unknown>,
    ): Promise<string> {
      const r = await post("/v1/ausencias", rhA)
        .send({ colaboradorId, aprovada: true, ...corpo })
        .expect(201);
      return r.body.id as string;
    }

    it("editar: tipo, datas, aprovação e observação; 200 e trilha sem valores", async () => {
      const { id: pessoa } = await admitir(rhA, empresaA);
      const dia = somarDias(HOJE, 70);
      const id = await registrar(pessoa, {
        tipo: "falta_justificada",
        inicio: dia,
        fim: dia,
      });
      const r = await patch(`/v1/ausencias/${id}`, rhA)
        .send({
          tipo: "day_off",
          inicio: somarDias(dia, 1),
          fim: somarDias(dia, 2),
          aprovada: false,
          observacao: "  troca de data  ",
        })
        .expect(200);
      expect(r.headers["cache-control"]).toBe("no-store");
      expect(r.body).toMatchObject({
        id,
        colaborador: { id: pessoa },
        tipo: "day_off",
        inicio: somarDias(dia, 1),
        fim: somarDias(dia, 2),
        dias: 2,
        status: "aguardando_rh",
        observacao: "troca de data",
      });
      const eventos = await trilha(id);
      expect(eventos.map((e) => e.action)).toEqual([
        "pessoas_ausencia_registrada",
        "pessoas_ausencia_alterada",
      ]);
      expect(JSON.stringify(eventos[1])).not.toContain("troca de data");
      // Voltar a "já aprovada" decide de novo, com quem e quando.
      const aprovada = await patch(`/v1/ausencias/${id}`, dpA)
        .send({
          tipo: "day_off",
          inicio: somarDias(dia, 1),
          fim: somarDias(dia, 2),
          aprovada: true,
        })
        .expect(200);
      expect(aprovada.body).toMatchObject({
        status: "aprovada",
        decididoEm: expect.any(String),
        observacao: null,
      });
    });

    it("editar: a própria ausência não conta como sobreposição nem gasta o saldo duas vezes", async () => {
      const { id: pessoa } = await admitir(rhA, empresaA);
      const inicio = somarDias(HOJE, 80);
      const ferias = await registrar(pessoa, {
        tipo: "ferias",
        inicio,
        fim: somarDias(inicio, 19),
      });
      // 20 → 30 dias: cabe no saldo de 30 (os 20 de antes não somam).
      await patch(`/v1/ausencias/${ferias}`, rhA)
        .send({
          tipo: "ferias",
          inicio,
          fim: somarDias(inicio, 29),
          aprovada: true,
        })
        .expect(200);
      // 31 dias: passa do saldo.
      const acima = await patch(`/v1/ausencias/${ferias}`, rhA)
        .send({
          tipo: "ferias",
          inicio,
          fim: somarDias(inicio, 30),
          aprovada: true,
        })
        .expect(422);
      expect(acima.body.erros).toEqual([
        { campo: "fim", motivo: "saldo_insuficiente" },
      ]);
      // Para cima de outra ausência da pessoa: 409.
      const outra = somarDias(inicio, 40);
      await registrar(pessoa, { tipo: "day_off", inicio: outra, fim: outra });
      const sobre = await patch(`/v1/ausencias/${ferias}`, rhA)
        .send({ tipo: "ferias", inicio: outra, fim: outra, aprovada: true })
        .expect(409);
      expect(sobre.body.erros).toEqual([
        { campo: "inicio", motivo: "sobreposicao" },
      ]);
    });

    it("editar cancelada ou recusada: 409; sem CSRF: 403", async () => {
      const { id: pessoa } = await admitir(rhA, empresaA);
      const dia = somarDias(HOJE, 90);
      const id = await registrar(pessoa, {
        tipo: "day_off",
        inicio: dia,
        fim: dia,
      });
      await agent()
        .patch(`/v1/ausencias/${id}`)
        .set("Cookie", rhA.cookie)
        .send({ tipo: "day_off", inicio: dia, fim: dia, aprovada: true })
        .expect(403);
      await post(`/v1/ausencias/${id}/cancelar`, rhA).send().expect(200);
      await patch(`/v1/ausencias/${id}`, rhA)
        .send({ tipo: "day_off", inicio: dia, fim: dia, aprovada: true })
        .expect(409);
    });

    it("excluir: sai do histórico, da lista, da próxima ausência e do saldo; o registro fica marcado no banco", async () => {
      const { id: pessoa } = await admitir(rhA, empresaA);
      const inicio = somarDias(HOJE, 5);
      const ferias = await registrar(pessoa, {
        tipo: "ferias",
        inicio,
        fim: somarDias(inicio, 9),
      });
      await del(`/v1/ausencias/${ferias}`, rhA).expect(204);
      const ficha = await get(`/v1/colaboradores/${pessoa}/ferias`, rhA).expect(
        200,
      );
      expect(ficha.body.historico).toEqual([]);
      expect(ficha.body.proximaAusencia).toBeNull();
      expect(ficha.body.periodos[0].disponiveis).toBe(30);
      const lista = await get(
        `/v1/ausencias?busca=${encodeURIComponent("Pessoa Ausencia")}`,
        rhA,
      ).expect(200);
      expect(lista.body.itens.map((a: { id: string }) => a.id)).not.toContain(
        ferias,
      );
      const linha = await prisma.ausencia.findUnique({ where: { id: ferias } });
      expect(linha?.excluidaEm).toBeInstanceOf(Date);
      expect(linha?.excluidaPorId).toEqual(expect.any(String));
      expect((await trilha(ferias)).map((e) => e.action)).toEqual([
        "pessoas_ausencia_registrada",
        "pessoas_ausencia_excluida",
      ]);
      // O dia ficou livre para outra ausência; a excluída não volta.
      await registrar(pessoa, { tipo: "day_off", inicio, fim: inicio });
      await del(`/v1/ausencias/${ferias}`, rhA).expect(404);
      await patch(`/v1/ausencias/${ferias}`, rhA)
        .send({ tipo: "ferias", inicio, fim: inicio, aprovada: true })
        .expect(404);
      await post(`/v1/ausencias/${ferias}/aprovar`, rhA).send().expect(404);
    });

    it("outra empresa: editar e excluir respondem 404; master técnico: 403", async () => {
      const { id: pessoa } = await admitir(rhA, empresaA);
      const dia = somarDias(HOJE, 100);
      const id = await registrar(pessoa, {
        tipo: "day_off",
        inicio: dia,
        fim: dia,
      });
      await patch(`/v1/ausencias/${id}`, rhB)
        .send({ tipo: "day_off", inicio: dia, fim: dia, aprovada: true })
        .expect(404);
      await del(`/v1/ausencias/${id}`, rhB).expect(404);
      await del(`/v1/ausencias/${id}`, masterA).expect(403);
      const linha = await prisma.ausencia.findUnique({ where: { id } });
      expect(linha?.excluidaEm).toBeNull();
    });
  });

  describe("ajustar período: reinício da contagem (como a referência)", () => {
    function del(rota: string, cred: Credencial) {
      return agent()
        .delete(rota)
        .set("Cookie", cred.cookie)
        .set("x-csrf-token", cred.csrfToken);
    }
    // Admissão há 18 meses: o 2º período está em curso; o reinício cai 3
    // meses depois do início dele (3 meses → 7,5 → 8 dias).
    const INICIO_2 = somarMeses(ADMISSAO, 12);
    const NOVO = somarMeses(ADMISSAO, 15);
    const rota = (id: string) => `/v1/colaboradores/${id}/ferias/reinicios`;
    const ficha = async (id: string) =>
      (await get(`/v1/colaboradores/${id}/ferias`, rhA).expect(200)).body;

    it("simular: os períodos de hoje e como vão ficar, com o calculado", async () => {
      const { id } = await admitir(rhA, empresaA);
      const hoje = await get(`${rota(id)}/simulacao`, rhA).expect(200);
      expect(hoje.headers["cache-control"]).toBe("no-store");
      // O período que a ficha mostra (o 1º, com saldo) e o seguinte.
      expect(
        hoje.body.periodos.map((p: { inicio: string }) => p.inicio),
      ).toEqual([ADMISSAO, INICIO_2]);
      expect(hoje.body.diasCalculados).toBeNull();

      const coletivas = await get(
        `${rota(id)}/simulacao?inicio=${NOVO}&motivo=ferias_coletivas`,
        rhA,
      ).expect(200);
      expect(coletivas.body.diasCalculados).toBe(8);
      const encurtado = coletivas.body.periodos.find(
        (p: { inicio: string }) => p.inicio === INICIO_2,
      );
      expect(encurtado).toMatchObject({
        fim: somarDias(NOVO, -1),
        direito: 8,
        encurtado: { motivo: "ferias_coletivas", novoInicio: NOVO },
      });
      const perda = await get(
        `${rota(id)}/simulacao?inicio=${NOVO}&motivo=perda_direito`,
        rhA,
      ).expect(200);
      expect(
        perda.body.periodos.find(
          (p: { inicio: string }) => p.inicio === INICIO_2,
        ),
      ).toMatchObject({ direito: 0 });
      const informado = await get(
        `${rota(id)}/simulacao?inicio=${NOVO}&motivo=outro&dias=12`,
        rhA,
      ).expect(200);
      expect(
        informado.body.periodos.find(
          (p: { inicio: string }) => p.inicio === INICIO_2,
        ),
      ).toMatchObject({ direito: 12 });
      // Simular não grava nada.
      expect(
        await prisma.reinicioPeriodoAquisitivo.count({
          where: { colaboradorId: id },
        }),
      ).toBe(0);
    });

    it("salvar: 201, a ficha recalcula e lista o reinício; trilha sem valores", async () => {
      const { id } = await admitir(rhA, empresaA);
      const r = await post(rota(id), rhA)
        .send({
          inicio: NOVO,
          motivo: "ferias_coletivas",
          observacao: "  coletiva sintética  ",
        })
        .expect(201);
      expect(r.headers["cache-control"]).toBe("no-store");
      expect(r.body).toEqual({
        id: expect.any(String),
        inicio: NOVO,
        motivo: "ferias_coletivas",
        diasPeriodoAnterior: null,
        observacao: "coletiva sintética",
      });
      const f = await ficha(id);
      expect(f.reinicios).toEqual([r.body]);
      expect(
        f.periodos.map(
          (p: { inicio: string; fim: string; direito: number }) => [
            p.inicio,
            p.fim,
            p.direito,
          ],
        ),
      ).toEqual([
        [ADMISSAO, somarDias(INICIO_2, -1), 30],
        [INICIO_2, somarDias(NOVO, -1), 8],
        [NOVO, somarDias(somarMeses(NOVO, 12), -1), 30],
      ]);
      const eventos = await prisma.auditEvent.findMany({
        where: { resourceId: r.body.id, resource: "reinicio_periodo" },
      });
      expect(eventos.map((e) => e.action)).toEqual([
        "pessoas_periodo_reiniciado",
      ]);
      expect(JSON.stringify(eventos)).not.toContain(NOVO);
      expect(JSON.stringify(eventos)).not.toContain("coletiva");
    });

    it("validação: na admissão ou antes, data repetida, dias e observação fora do limite, sem CSRF", async () => {
      const { id } = await admitir(rhA, empresaA);
      const antes = await post(rota(id), rhA)
        .send({ inicio: ADMISSAO, motivo: "outro" })
        .expect(422);
      expect(antes.body.erros).toEqual([
        { campo: "inicio", motivo: "antes_da_admissao" },
      ]);
      await post(rota(id), rhA)
        .send({ inicio: NOVO, motivo: "outro", diasPeriodoAnterior: 31 })
        .expect(400);
      await post(rota(id), rhA)
        .send({ inicio: NOVO, motivo: "outro", observacao: "x".repeat(301) })
        .expect(400);
      await post(rota(id), rhA)
        .send({ inicio: NOVO, motivo: "ferias_vencidas" })
        .expect(400);
      await agent()
        .post(rota(id))
        .set("Cookie", rhA.cookie)
        .send({ inicio: NOVO, motivo: "outro" })
        .expect(403);
      await post(rota(id), rhA)
        .send({ inicio: NOVO, motivo: "outro" })
        .expect(201);
      const repetida = await post(rota(id), rhA)
        .send({ inicio: NOVO, motivo: "perda_direito" })
        .expect(409);
      expect(repetida.body.erros).toEqual([
        { campo: "inicio", motivo: "ja_existe" },
      ]);
    });

    it("PJ não tem saldo calculado: o reinício é recusado", async () => {
      const { id } = await admitir(rhA, empresaA, "ativo", "pj");
      const r = await post(rota(id), rhA)
        .send({ inicio: NOVO, motivo: "outro" })
        .expect(422);
      expect(r.body.erros).toEqual([
        { campo: "inicio", motivo: "sem_saldo_calculado" },
      ]);
      const simulacao = await get(`${rota(id)}/simulacao`, rhA).expect(200);
      expect(simulacao.body).toEqual({ periodos: [], diasCalculados: null });
    });

    it("férias lançadas que ficariam sem período ou acima do novo direito: 409", async () => {
      const { id } = await admitir(rhA, empresaA);
      // Férias do 1º período (completo), lançadas para depois de hoje.
      const inicioFerias = somarDias(HOJE, 20);
      await post("/v1/ausencias", rhA)
        .send({
          colaboradorId: id,
          tipo: "ferias",
          inicio: inicioFerias,
          fim: somarDias(inicioFerias, 19),
          periodoAquisitivoInicio: ADMISSAO,
          aprovada: true,
        })
        .expect(201);
      // Encurtar o 1º período para 5 dias deixaria 20 dias de férias nele.
      const menor = await post(rota(id), rhA)
        .send({
          inicio: somarMeses(ADMISSAO, 6),
          motivo: "outro",
          diasPeriodoAnterior: 5,
        })
        .expect(409);
      expect(menor.body.erros).toEqual([
        { campo: "diasPeriodoAnterior", motivo: "abaixo_das_ferias" },
      ]);
      // Recomeçar antes do 1º período terminar faz o 2º começar em outra
      // data: as férias lançadas no 1º seguem nele (ele só encurta).
      await post(rota(id), rhA)
        .send({ inicio: NOVO, motivo: "ferias_coletivas" })
        .expect(201);
    });

    it("reinício que tiraria o período de férias já lançadas: 409, e remover também", async () => {
      const { id } = await admitir(rhA, empresaA);
      // Férias no 2º período (termina em ~6 meses), para depois dele.
      const fim2 = somarDias(somarMeses(ADMISSAO, 24), -1);
      const inicioFerias = somarDias(fim2, 10);
      await post("/v1/ausencias", rhA)
        .send({
          colaboradorId: id,
          tipo: "ferias",
          inicio: inicioFerias,
          fim: somarDias(inicioFerias, 9),
          periodoAquisitivoInicio: INICIO_2,
          aprovada: true,
        })
        .expect(201);
      // Recomeçar no meio do 1º período faz o 2º começar em outra data.
      const r = await post(rota(id), rhA)
        .send({ inicio: somarMeses(ADMISSAO, 6), motivo: "outro" })
        .expect(409);
      expect(r.body.erros).toEqual([
        { campo: "inicio", motivo: "ferias_sem_periodo" },
      ]);
      expect(
        await prisma.reinicioPeriodoAquisitivo.count({
          where: { colaboradorId: id },
        }),
      ).toBe(0);
    });

    it("remover: 204, a ficha volta ao cálculo normal; trilha; de novo, 404", async () => {
      const { id } = await admitir(rhA, empresaA);
      const r = await post(rota(id), rhA)
        .send({ inicio: NOVO, motivo: "perda_direito" })
        .expect(201);
      await del(`${rota(id)}/${r.body.id}`, rhA).expect(204);
      const f = await ficha(id);
      expect(f.reinicios).toEqual([]);
      expect(f.periodos.map((p: { direito: number }) => p.direito)).toEqual([
        30, 30,
      ]);
      const linha = await prisma.reinicioPeriodoAquisitivo.findUnique({
        where: { id: r.body.id },
      });
      expect(linha?.removidoEm).toBeInstanceOf(Date);
      expect(linha?.removidoPorId).toEqual(expect.any(String));
      const eventos = await prisma.auditEvent.findMany({
        where: { resourceId: r.body.id, resource: "reinicio_periodo" },
        orderBy: { occurredAt: "asc" },
      });
      expect(eventos.map((e) => e.action)).toEqual([
        "pessoas_periodo_reiniciado",
        "pessoas_periodo_reinicio_removido",
      ]);
      await del(`${rota(id)}/${r.body.id}`, rhA).expect(404);
      // A mesma data pode ser registrada de novo.
      await post(rota(id), rhA)
        .send({ inicio: NOVO, motivo: "outro" })
        .expect(201);
    });

    it("acesso: outra empresa 404; master técnico lê a simulação mas não grava; DP grava", async () => {
      const { id } = await admitir(rhA, empresaA);
      await get(`${rota(id)}/simulacao`, rhB).expect(404);
      await post(rota(id), rhB)
        .send({ inicio: NOVO, motivo: "outro" })
        .expect(404);
      await get(`${rota(id)}/simulacao`, masterA).expect(200);
      await post(rota(id), masterA)
        .send({ inicio: NOVO, motivo: "outro" })
        .expect(403);
      const r = await post(rota(id), dpA)
        .send({ inicio: NOVO, motivo: "outro" })
        .expect(201);
      await del(`${rota(id)}/${r.body.id}`, rhB).expect(404);
      await del(`${rota(id)}/${r.body.id}`, masterA).expect(403);
    });
  });

  describe("responder solicitação (como a referência)", () => {
    async function pendente(
      colaboradorId: string,
      inicio: string,
      fim = inicio,
    ): Promise<string> {
      const r = await post("/v1/ausencias", rhA)
        .send({
          colaboradorId,
          tipo: "day_off",
          inicio,
          fim,
          aprovada: false,
        })
        .expect(201);
      return r.body.id as string;
    }

    it("aprovar com mensagem: guarda a mensagem; acima de 1000 caracteres, 400", async () => {
      const { id: pessoa } = await admitir(rhA, empresaA);
      const dia = somarDias(HOJE, 130);
      const id = await pendente(pessoa, dia);
      await post(`/v1/ausencias/${id}/aprovar`, rhA)
        .send({ mensagem: "x".repeat(1001) })
        .expect(400);
      await post(`/v1/ausencias/${id}/aprovar`, rhA)
        .send({ mensagem: "  Boa folga!  " })
        .expect(200);
      const linha = await prisma.ausencia.findUniqueOrThrow({ where: { id } });
      expect(linha.status).toBe("aprovada");
      expect(linha.motivoDecisao).toBe("Boa folga!");
    });

    it("recusar exige o motivo", async () => {
      const { id: pessoa } = await admitir(rhA, empresaA);
      const id = await pendente(pessoa, somarDias(HOJE, 132));
      await post(`/v1/ausencias/${id}/recusar`, rhA).send().expect(400);
      await post(`/v1/ausencias/${id}/recusar`, rhA)
        .send({ motivo: "   " })
        .expect(400);
      await post(`/v1/ausencias/${id}/recusar`, rhA)
        .send({ motivo: "y".repeat(1001) })
        .expect(400);
      await post(`/v1/ausencias/${id}/recusar`, rhA)
        .send({ motivo: "Equipe já desfalcada nesse dia" })
        .expect(200);
    });

    it("sugerir outras datas: ajuste sugerido, com o novo período e a mensagem; trilha", async () => {
      const { id: pessoa } = await admitir(rhA, empresaA);
      const dia = somarDias(HOJE, 134);
      const id = await pendente(pessoa, dia);
      const r = await post(`/v1/ausencias/${id}/sugerir`, rhA)
        .send({
          inicio: somarDias(dia, 1),
          fim: somarDias(dia, 1),
          mensagem: "  Pode ser no dia seguinte?  ",
        })
        .expect(200);
      expect(r.headers["cache-control"]).toBe("no-store");
      expect(r.body).toMatchObject({
        id,
        status: "ajuste_sugerido",
        inicio: dia,
        sugestao: { inicio: somarDias(dia, 1), fim: somarDias(dia, 1) },
      });
      const linha = await prisma.ausencia.findUniqueOrThrow({ where: { id } });
      expect(linha.motivoDecisao).toBe("Pode ser no dia seguinte?");
      expect(linha.decididoPorId).toEqual(expect.any(String));
      expect((await trilha(id)).map((e) => e.action)).toEqual([
        "pessoas_ausencia_registrada",
        "pessoas_ausencia_ajuste_sugerido",
      ]);
      // Já respondida: sugerir de novo é 409.
      await post(`/v1/ausencias/${id}/sugerir`, rhA)
        .send({ inicio: somarDias(dia, 2), fim: somarDias(dia, 2) })
        .expect(409);
    });

    it("sugerir: datas iguais às pedidas, fim antes do início e sobreposição são recusados", async () => {
      const { id: pessoa } = await admitir(rhA, empresaA);
      const dia = somarDias(HOJE, 140);
      const id = await pendente(pessoa, dia);
      await pendente(pessoa, somarDias(dia, 3));
      const igual = await post(`/v1/ausencias/${id}/sugerir`, rhA)
        .send({ inicio: dia, fim: dia })
        .expect(422);
      expect(igual.body.erros).toEqual([
        { campo: "inicio", motivo: "igual_ao_pedido" },
      ]);
      const invertido = await post(`/v1/ausencias/${id}/sugerir`, rhA)
        .send({ inicio: somarDias(dia, 2), fim: somarDias(dia, 1) })
        .expect(422);
      expect(invertido.body.erros).toEqual([
        { campo: "fim", motivo: "fim_antes_do_inicio" },
      ]);
      const cruzada = await post(`/v1/ausencias/${id}/sugerir`, rhA)
        .send({ inicio: somarDias(dia, 3), fim: somarDias(dia, 3) })
        .expect(409);
      expect(cruzada.body.erros).toEqual([
        { campo: "inicio", motivo: "sobreposicao" },
      ]);
      await post(`/v1/ausencias/${id}/sugerir`, rhA)
        .send({
          inicio: somarDias(dia, 1),
          fim: somarDias(dia, 1),
          mensagem: "z".repeat(1001),
        })
        .expect(400);
    });

    it("sugerir: aprovada é 409; outra empresa 404; master 403; sem CSRF 403", async () => {
      const { id: pessoa } = await admitir(rhA, empresaA);
      const dia = somarDias(HOJE, 150);
      const id = await pendente(pessoa, dia);
      const corpo = { inicio: somarDias(dia, 1), fim: somarDias(dia, 1) };
      await post(`/v1/ausencias/${id}/sugerir`, rhB).send(corpo).expect(404);
      await post(`/v1/ausencias/${id}/sugerir`, masterA)
        .send(corpo)
        .expect(403);
      await agent()
        .post(`/v1/ausencias/${id}/sugerir`)
        .set("Cookie", rhA.cookie)
        .send(corpo)
        .expect(403);
      await post(`/v1/ausencias/${id}/aprovar`, rhA).send().expect(200);
      await post(`/v1/ausencias/${id}/sugerir`, rhA).send(corpo).expect(409);
    });
  });

  describe("regras da CLT e troca de período na simulação (como a referência)", () => {
    // A próxima sexta-feira daqui a pelo menos 10 dias.
    let sexta = somarDias(HOJE, 10);
    while (new Date(`${sexta}T00:00:00Z`).getUTCDay() !== 5) {
      sexta = somarDias(sexta, 1);
    }

    it("férias: avisos (início antes do domingo, menos de 5 dias) e os períodos que podem ser escolhidos", async () => {
      const { id } = await admitir(rhA, empresaA);
      const r = await get(
        `/v1/ausencias/simulacao?colaboradorId=${id}&tipo=ferias&inicio=${sexta}&fim=${somarDias(sexta, 2)}`,
        rhA,
      ).expect(200);
      expect(r.body.avisosClt).toEqual(
        expect.arrayContaining([
          {
            regra: "inicio_antes_de_descanso",
            antesDe: "domingo",
            dia: somarDias(sexta, 2),
          },
          { regra: "minimo_5", dias: 3 },
        ]),
      );
      expect(r.body.periodosDisponiveis).toEqual([
        { inicio: ADMISSAO, fim: FIM_DO_PERIODO_1, disponiveis: 30 },
      ]);
    });

    it("outros tipos: sem avisos nem períodos", async () => {
      const { id } = await admitir(rhA, empresaA);
      const r = await get(
        `/v1/ausencias/simulacao?colaboradorId=${id}&tipo=day_off&inicio=${sexta}&fim=${sexta}`,
        rhA,
      ).expect(200);
      expect(r.body.avisosClt).toEqual([]);
      expect(r.body.periodosDisponiveis).toEqual([]);
    });
  });

  describe("férias coletivas de quem tem menos de 12 meses de casa (CLT art. 140, como a referência)", () => {
    const NOVATO = somarMeses(HOJE, -6);
    const inicio = somarDias(HOJE, 20);
    const fim = somarDias(inicio, 9);
    const simular = (id: string, extra = "") =>
      get(
        `/v1/ausencias/simulacao?colaboradorId=${id}&tipo=ferias&inicio=${inicio}&fim=${fim}${extra}`,
        rhA,
      ).expect(200);

    it("simular: pode ser coletiva; ligada, encurta o período (proporcional) e recomeça no início das férias", async () => {
      const { id } = await admitir(rhA, empresaA, "ativo", "clt", NOVATO);
      const sem = await simular(id);
      expect(sem.body).toMatchObject({ podeSerColetiva: true, coletiva: null });
      expect(sem.body.periodo).toBeNull();
      const com = await simular(id, "&feriasColetivas=true");
      expect(com.body.podeSerColetiva).toBe(true);
      expect(com.body.periodo).toEqual({
        inicio: NOVATO,
        fim: somarDias(inicio, -1),
      });
      expect(com.body.coletiva).toEqual({
        dias: expect.any(Number),
        novoPeriodo: inicio,
      });
      expect(com.body.coletiva.dias).toBeGreaterThan(10);
      expect(com.body.saldoAntes).toBe(com.body.coletiva.dias);
    });

    it("registrar coletiva: cria o reinício (férias coletivas) junto, com trilha", async () => {
      const { id } = await admitir(rhA, empresaA, "ativo", "clt", NOVATO);
      const r = await post("/v1/ausencias", rhA)
        .send({
          colaboradorId: id,
          tipo: "ferias",
          inicio,
          fim,
          feriasColetivas: true,
          aprovada: true,
        })
        .expect(201);
      expect(r.body.periodoAquisitivo).toMatchObject({ inicio: NOVATO });
      const reinicios = await prisma.reinicioPeriodoAquisitivo.findMany({
        where: { colaboradorId: id },
      });
      expect(reinicios).toHaveLength(1);
      expect(reinicios[0]).toMatchObject({
        motivo: "ferias_coletivas",
        diasPeriodoAnterior: null,
      });
      const ficha = (
        await get(`/v1/colaboradores/${id}/ferias`, rhA).expect(200)
      ).body;
      expect(ficha.reinicios).toHaveLength(1);
      const eventos = await prisma.auditEvent.findMany({
        where: { resourceId: reinicios[0]!.id, resource: "reinicio_periodo" },
      });
      expect(eventos.map((e) => e.action)).toEqual([
        "pessoas_periodo_reiniciado",
      ]);
    });

    it("quem já tem 12 meses de casa não tem coletiva por aqui", async () => {
      const { id } = await admitir(rhA, empresaA);
      expect((await simular(id)).body.podeSerColetiva).toBe(false);
      const r = await post("/v1/ausencias", rhA)
        .send({
          colaboradorId: id,
          tipo: "ferias",
          inicio,
          fim,
          feriasColetivas: true,
          aprovada: true,
        })
        .expect(422);
      expect(r.body.erros).toEqual([
        { campo: "feriasColetivas", motivo: "nao_se_aplica" },
      ]);
    });
  });

  describe("políticas de férias (como a referência)", () => {
    function put(rota: string, cred: Credencial) {
      return agent()
        .put(rota)
        .set("Cookie", cred.cookie)
        .set("x-csrf-token", cred.csrfToken);
    }
    const REGRAS = {
      antecedenciaMinimaDias: 30,
      antecedenciaMaximaMeses: null,
      alemDoSaldo: "nao_aceitar",
      duracaoMinimaDias: 10,
      duracaoMaximaDias: null,
      periodosPorAno: 2,
      periodoMaiorDias: null,
      intervaloDias: null,
      inicioNaoAntesDeDescanso: false,
      inicioNaoNoFimDeSemana: false,
      voltaNaoNaSexta: false,
      voltaNaoNaVespera: false,
      bloqueios: [],
      foraAoMesmoTempo: null,
    };
    const APROVACAO = {
      quem: "rh",
      lembreteDias: null,
      foraDaPolitica: "avisar",
    };
    const politica = (extra: Record<string, unknown> = {}) => ({
      nome: "Política sintética",
      tiposVinculo: ["clt"],
      abrangencia: "todos",
      alvos: [],
      valeAPartirDe: HOJE,
      regras: REGRAS,
      aprovacao: APROVACAO,
      ...extra,
    });
    const inicio = somarDias(HOJE, 10);
    const fim = somarDias(inicio, 3);
    const simular = (id: string) =>
      get(
        `/v1/ausencias/simulacao?colaboradorId=${id}&tipo=ferias&inicio=${inicio}&fim=${fim}`,
        rhA,
      ).expect(200);

    it("criar, listar e conferir: a simulação aponta o que não segue; registrar pede o motivo", async () => {
      const { id: pessoa } = await admitir(rhA, empresaA);
      const criada = await post("/v1/politicas-ferias", rhA)
        .send(
          politica({
            nome: "Só a pessoa sintética",
            abrangencia: "algumas",
            alvos: [{ tipo: "pessoa", id: pessoa }],
          }),
        )
        .expect(201);
      expect(criada.headers["cache-control"]).toBe("no-store");
      expect(criada.body).toMatchObject({
        nome: "Só a pessoa sintética",
        ativa: true,
      });
      const eventos = await prisma.auditEvent.findMany({
        where: { resourceId: criada.body.id, resource: "politica_ferias" },
      });
      expect(eventos.map((e) => e.action)).toEqual([
        "pessoas_politica_ferias_criada",
      ]);

      const lista = (await get("/v1/politicas-ferias", rhA).expect(200)).body;
      const linha = lista.politicas.find(
        (p: { id: string }) => p.id === criada.body.id,
      );
      expect(linha).toMatchObject({
        nome: "Só a pessoa sintética",
        ativa: true,
        tiposVinculo: ["clt"],
        abrangencia: "algumas",
        pessoas: 1,
        principaisRegras: {
          primeira: "Antecedência de 30 dias",
          segunda: "Até 2 períodos",
        },
        foraDaPolitica: "avisar",
      });
      expect(lista.semPolitica.total).toEqual(expect.any(Number));
      expect(
        lista.semPolitica.pessoas.some((p: { id: string }) => p.id === pessoa),
      ).toBe(false);

      const s = (await simular(pessoa)).body;
      expect(s.politica).toMatchObject({
        id: criada.body.id,
        nome: "Só a pessoa sintética",
      });
      expect(s.politica.violacoes).toEqual(
        expect.arrayContaining([
          { regra: "antecedencia_minima", dias: 10, minimo: 30 },
          { regra: "duracao_minima", dias: 4, minimo: 10 },
        ]),
      );

      const sem = await post("/v1/ausencias", rhA)
        .send({
          colaboradorId: pessoa,
          tipo: "ferias",
          inicio,
          fim,
          aprovada: true,
        })
        .expect(422);
      expect(sem.body.erros).toEqual([
        { campo: "motivoForaDaPolitica", motivo: "obrigatorio" },
      ]);
      const r = await post("/v1/ausencias", rhA)
        .send({
          colaboradorId: pessoa,
          tipo: "ferias",
          inicio,
          fim,
          aprovada: true,
          motivoForaDaPolitica: "  Combinado com a gestão  ",
        })
        .expect(201);
      const linhaDaAusencia = await prisma.ausencia.findUniqueOrThrow({
        where: { id: r.body.id },
      });
      expect(linhaDaAusencia.politicaFeriasId).toBe(criada.body.id);
      expect(linhaDaAusencia.motivoForaDaPolitica).toBe(
        "Combinado com a gestão",
      );
    });

    it("a mais específica vale: pessoa antes do contrato; desativar e reativar", async () => {
      const { id: escolhida } = await admitir(rhA, empresaA);
      const { id: outra } = await admitir(rhA, empresaA);
      const especifica = await post("/v1/politicas-ferias", rhA)
        .send(
          politica({
            nome: "Específica",
            abrangencia: "algumas",
            alvos: [{ tipo: "pessoa", id: escolhida }],
            regras: {
              ...REGRAS,
              antecedenciaMinimaDias: 5,
              duracaoMinimaDias: null,
              periodosPorAno: null,
            },
          }),
        )
        .expect(201);
      // A geral nasce depois: mesmo assim a específica vale para quem ela cita.
      const geral = await post("/v1/politicas-ferias", rhA)
        .send(politica({ nome: "Geral CLT" }))
        .expect(201);
      expect((await simular(escolhida)).body.politica.id).toBe(
        especifica.body.id,
      );
      expect((await simular(outra)).body.politica.id).toBe(geral.body.id);

      await post(`/v1/politicas-ferias/${especifica.body.id}/desativar`, rhA)
        .send()
        .expect(200);
      expect((await simular(escolhida)).body.politica.id).toBe(geral.body.id);
      const lista = (await get("/v1/politicas-ferias", rhA).expect(200)).body;
      expect(
        lista.politicas.find((p: { id: string }) => p.id === especifica.body.id)
          .ativa,
      ).toBe(false);
      await post(`/v1/politicas-ferias/${especifica.body.id}/reativar`, rhA)
        .send()
        .expect(200);
      expect((await simular(escolhida)).body.politica.id).toBe(
        especifica.body.id,
      );
      // Desativar a geral para não pesar nos outros testes.
      await post(`/v1/politicas-ferias/${geral.body.id}/desativar`, rhA)
        .send()
        .expect(200);
      await post(`/v1/politicas-ferias/${especifica.body.id}/desativar`, rhA)
        .send()
        .expect(200);
    });

    it("alterar, detalhe e validação; outra empresa 404; master só lê", async () => {
      const criada = await post("/v1/politicas-ferias", rhA)
        .send(politica({ nome: "Para alterar", rascunho: true }))
        .expect(201);
      const detalhe = (
        await get(`/v1/politicas-ferias/${criada.body.id}`, rhA).expect(200)
      ).body;
      expect(detalhe).toMatchObject({
        nome: "Para alterar",
        rascunho: true,
        regras: REGRAS,
        aprovacao: APROVACAO,
      });
      await put(`/v1/politicas-ferias/${criada.body.id}`, rhA)
        .send(politica({ nome: "Alterada", rascunho: false }))
        .expect(200);
      const eventos = await prisma.auditEvent.findMany({
        where: { resourceId: criada.body.id, resource: "politica_ferias" },
        orderBy: { occurredAt: "asc" },
      });
      expect(eventos.map((e) => e.action)).toEqual([
        "pessoas_politica_ferias_criada",
        "pessoas_politica_ferias_alterada",
      ]);
      await post("/v1/politicas-ferias", rhA)
        .send(politica({ nome: "" }))
        .expect(400);
      await post("/v1/politicas-ferias", rhA)
        .send(politica({ tiposVinculo: [] }))
        .expect(400);
      const semAlvo = await post("/v1/politicas-ferias", rhA)
        .send(politica({ abrangencia: "algumas", alvos: [] }))
        .expect(422);
      expect(semAlvo.body.erros).toEqual([
        { campo: "alvos", motivo: "obrigatorio" },
      ]);
      await get(`/v1/politicas-ferias/${criada.body.id}`, rhB).expect(404);
      await post(`/v1/politicas-ferias/${criada.body.id}/desativar`, rhB)
        .send()
        .expect(404);
      await get("/v1/politicas-ferias", masterA).expect(200);
      await post("/v1/politicas-ferias", masterA).send(politica()).expect(403);
      await post(`/v1/politicas-ferias/${criada.body.id}/desativar`, rhA)
        .send()
        .expect(200);
    });
  });

  describe("anexo da ausência (atestado ou documento)", () => {
    /** PDF sintético mínimo, com o fim de arquivo. */
    const pdf = (conteudo = "documento sintetico") =>
      Buffer.from(
        `%PDF-1.4\n% ${conteudo}\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n`,
      );

    function enviarAnexo(
      ausenciaId: string,
      bytes: Buffer,
      cred: Credencial = rhA,
      opcoes: { tipo?: string; extensao?: string; conteudo?: string } = {},
    ) {
      return agent()
        .post(`/v1/ausencias/${ausenciaId}/anexo`)
        .set("Cookie", cred.cookie)
        .set("x-csrf-token", cred.csrfToken)
        .set("Content-Type", opcoes.conteudo ?? "application/octet-stream")
        .set("x-evolli-anexo-tipo", opcoes.tipo ?? "application/pdf")
        .set("x-evolli-anexo-extensao", opcoes.extensao ?? "pdf")
        .send(bytes);
    }

    const baixar = (ausenciaId: string, cred: Credencial = rhA) =>
      agent()
        .get(`/v1/ausencias/${ausenciaId}/anexo/arquivo`)
        .set("Cookie", cred.cookie)
        .buffer(true)
        .parse((res, cb) => {
          const partes: Buffer[] = [];
          res.on("data", (c: Buffer) => partes.push(c));
          res.on("end", () => cb(null, Buffer.concat(partes)));
        });

    async function licenca(): Promise<{ colaboradorId: string; id: string }> {
      const p = await admitir(rhA, empresaA);
      const inicio = somarDias(HOJE, 80);
      const r = await post("/v1/ausencias", rhA)
        .send({
          colaboradorId: p.id,
          tipo: "licenca_medica",
          inicio,
          fim: somarDias(inicio, 2),
          aprovada: true,
        })
        .expect(201);
      return { colaboradorId: p.id, id: r.body.id as string };
    }

    const anexos = (ausenciaId: string) =>
      prisma.anexoAusencia.findMany({ where: { ausenciaId } });

    it("envio: 201 com formato e tamanho; aparece na ficha; trilha sem nome nem conteúdo", async () => {
      const a = await licenca();
      const bytes = pdf();
      const r = await enviarAnexo(a.id, bytes).expect(201);
      expect(r.headers["cache-control"]).toBe("no-store");
      expect(r.body.anexo).toMatchObject({
        formato: "pdf",
        tamanhoBytes: bytes.length,
      });
      const ficha = await get(
        `/v1/colaboradores/${a.colaboradorId}/ferias`,
        rhA,
      ).expect(200);
      const item = ficha.body.historico.find(
        (h: { id: string }) => h.id === a.id,
      );
      expect(item.anexo).toMatchObject({
        formato: "pdf",
        tamanhoBytes: bytes.length,
      });
      const linhas = await anexos(a.id);
      expect(linhas).toHaveLength(1);
      expect(armazenamento.objetos.has(linhas[0]!.chaveObjeto)).toBe(true);
      // A chave só tem ids internos.
      expect(linhas[0]!.chaveObjeto).toMatch(
        /^v1\/empresas\/[0-9a-f-]+\/colaboradores\/[0-9a-f-]+\/ausencias\/[0-9a-f-]+\/anexos\/[0-9a-f-]+$/,
      );
      const eventos = await prisma.auditEvent.findMany({
        where: { resourceId: a.id, action: "pessoas_ausencia_anexo_enviado" },
      });
      expect(eventos).toHaveLength(1);
      expect(JSON.stringify(eventos)).not.toContain("sintetico");
      // Um anexo por ausência.
      await enviarAnexo(a.id, pdf("outro")).expect(409);
    });

    it("download: o mesmo arquivo, privado, sem cache, com trilha", async () => {
      const a = await licenca();
      const bytes = pdf("para baixar");
      await enviarAnexo(a.id, bytes).expect(201);
      const r = await baixar(a.id).expect(200);
      expect(Buffer.compare(r.body as Buffer, bytes)).toBe(0);
      expect(r.headers["content-type"]).toBe("application/pdf");
      expect(r.headers["cache-control"]).toBe("private, no-store");
      expect(r.headers["x-content-type-options"]).toBe("nosniff");
      expect(r.headers["content-disposition"]).toBe(
        'attachment; filename="atestado.pdf"',
      );
      const eventos = await prisma.auditEvent.findMany({
        where: { resourceId: a.id, action: "pessoas_ausencia_anexo_baixado" },
      });
      expect(eventos).toHaveLength(1);
    });

    it("o antivírus reprova: 422 e nada é guardado", async () => {
      const a = await licenca();
      const antes = armazenamento.objetos.size;
      const r = await enviarAnexo(
        a.id,
        pdf(ASSINATURA_DE_TESTE_ANTIVIRUS),
      ).expect(422);
      expect(r.body.codigo).toBe("anexo_reprovado_antivirus");
      expect(armazenamento.objetos.size).toBe(antes);
      expect(await anexos(a.id)).toHaveLength(0);
    });

    it.each([
      ["texto com extensão de pdf", Buffer.from("isto nao e pdf"), {}],
      ["pdf declarado como png", pdf(), { tipo: "image/png", extensao: "png" }],
      [
        "formato fora da lista",
        Buffer.from("GIF89a"),
        { tipo: "image/gif", extensao: "gif" },
      ],
    ])("%s: 422 formato inválido, nada guardado", async (_r, bytes, opcoes) => {
      const a = await licenca();
      const r = await enviarAnexo(a.id, bytes, rhA, opcoes).expect(422);
      expect(r.body.codigo).toBe("anexo_formato_invalido");
      expect(await anexos(a.id)).toHaveLength(0);
    });

    it("corpo que não é arquivo binário: 415", async () => {
      const a = await licenca();
      await enviarAnexo(a.id, pdf(), rhA, {
        conteudo: "application/json",
      }).expect(415);
    });

    it("remover: some da ficha e do download, fica no banco; depois pode enviar outro", async () => {
      const a = await licenca();
      await enviarAnexo(a.id, pdf()).expect(201);
      await agent()
        .delete(`/v1/ausencias/${a.id}/anexo`)
        .set("Cookie", rhA.cookie)
        .set("x-csrf-token", rhA.csrfToken)
        .expect(200);
      const ficha = await get(
        `/v1/colaboradores/${a.colaboradorId}/ferias`,
        rhA,
      ).expect(200);
      expect(
        ficha.body.historico.find((h: { id: string }) => h.id === a.id).anexo,
      ).toBeNull();
      await baixar(a.id).expect(404);
      const linhas = await anexos(a.id);
      expect(linhas).toHaveLength(1);
      expect(linhas[0]!.removidoEm).not.toBeNull();
      const eventos = await prisma.auditEvent.findMany({
        where: { resourceId: a.id, action: "pessoas_ausencia_anexo_removido" },
      });
      expect(eventos).toHaveLength(1);
      await enviarAnexo(a.id, pdf("segundo")).expect(201);
    });

    it("ausência cancelada não recebe anexo (409)", async () => {
      const a = await licenca();
      await post(`/v1/ausencias/${a.id}/cancelar`, rhA).send().expect(200);
      await enviarAnexo(a.id, pdf()).expect(409);
    });

    const removerAnexo = (ausenciaId: string, cred: Credencial) =>
      agent()
        .delete(`/v1/ausencias/${ausenciaId}/anexo`)
        .set("Cookie", cred.cookie)
        .set("x-csrf-token", cred.csrfToken);

    const baixados = (ausenciaId: string) =>
      prisma.auditEvent.count({
        where: {
          resourceId: ausenciaId,
          action: "pessoas_ausencia_anexo_baixado",
        },
      });

    it("outra empresa: enviar, baixar e remover respondem 404, sem revelar e sem trilha de download", async () => {
      const a = await licenca();
      await enviarAnexo(a.id, pdf()).expect(201);
      const envio = await enviarAnexo(a.id, pdf(), rhB).expect(404);
      const download = await baixar(a.id, rhB).expect(404);
      const remocao = await removerAnexo(a.id, rhB).expect(404);
      // A mesma resposta de "não existe".
      const inexistente = await baixar(
        "00000000-0000-4000-8000-000000000000",
        rhB,
      ).expect(404);
      // Sem o id da requisição e o instante, que mudam a cada chamada.
      const semId = (corpo: unknown) => {
        const texto = Buffer.isBuffer(corpo)
          ? corpo.toString()
          : JSON.stringify(corpo);
        const resto = JSON.parse(texto) as Record<string, unknown>;
        delete resto["request_id"];
        delete resto["timestamp"];
        return resto;
      };
      expect(semId(download.body)).toEqual(semId(inexistente.body));
      expect(semId(envio.body)).toEqual(semId(remocao.body));
      expect(await baixados(a.id)).toBe(0);
      expect((await anexos(a.id))[0]!.removidoEm).toBeNull();
    });

    it.each([
      "gestor",
      "financeiro",
      "colaborador",
      "auditor",
      "dpo",
      "admin_tecnico",
    ])(
      "%s: não envia, não baixa e não remove (403), sem trilha de download",
      async (papel) => {
        const cred = outrosPapeis.find(([p]) => p === papel)![1];
        const a = await licenca();
        await enviarAnexo(a.id, pdf()).expect(201);
        await enviarAnexo(a.id, pdf(), cred).expect(403);
        await baixar(a.id, cred).expect(403);
        await removerAnexo(a.id, cred).expect(403);
        expect(await baixados(a.id)).toBe(0);
        expect((await anexos(a.id))[0]!.removidoEm).toBeNull();
      },
    );

    it("master técnico: vê a ausência, mas não o anexo — sem metadado, sem download, sem envio nem remoção", async () => {
      const a = await licenca();
      await enviarAnexo(a.id, pdf()).expect(201);
      await baixar(a.id, masterA).expect(403);
      await enviarAnexo(a.id, pdf(), masterA).expect(403);
      await removerAnexo(a.id, masterA).expect(403);
      expect(await baixados(a.id)).toBe(0);
      const ficha = await get(
        `/v1/colaboradores/${a.colaboradorId}/ferias`,
        masterA,
      ).expect(200);
      const item = ficha.body.historico.find(
        (h: { id: string }) => h.id === a.id,
      );
      expect(item).toMatchObject({ id: a.id, status: "aprovada" });
      expect(item.anexo).toBeNull();
      const lista = await get("/v1/ausencias", masterA)
        .query({ tamanhoPagina: 100 })
        .expect(200);
      const naLista = lista.body.itens.find(
        (i: { id: string }) => i.id === a.id,
      );
      expect(naLista.anexo).toBeNull();
      // RH vê o anexo.
      const daRh = await get(
        `/v1/colaboradores/${a.colaboradorId}/ferias`,
        rhA,
      ).expect(200);
      expect(
        daRh.body.historico.find((h: { id: string }) => h.id === a.id).anexo,
      ).toMatchObject({ formato: "pdf" });
    });

    it("DP também envia, baixa e remove", async () => {
      const a = await licenca();
      await enviarAnexo(a.id, pdf(), dpA).expect(201);
      await baixar(a.id, dpA).expect(200);
      await removerAnexo(a.id, dpA).expect(200);
    });

    it("trilha de download só quando o arquivo sai: falha do armazenamento e anexo removido não contam", async () => {
      const a = await licenca();
      await enviarAnexo(a.id, pdf()).expect(201);
      const [linha] = await anexos(a.id);
      const original = armazenamento.falhar;
      armazenamento.falhar = (operacao, chave) =>
        operacao === "ler" && chave === linha!.chaveObjeto;
      try {
        await baixar(a.id).expect(503);
      } finally {
        armazenamento.falhar = original;
      }
      expect(await baixados(a.id)).toBe(0);
      await baixar(a.id).expect(200);
      expect(await baixados(a.id)).toBe(1);
      await removerAnexo(a.id, rhA).expect(200);
      await baixar(a.id).expect(404);
      expect(await baixados(a.id)).toBe(1);
    });

    it("histórico preservado: a aplicação não apaga anexo", async () => {
      const linhas = await prisma.$queryRaw<{ pode: boolean }[]>`
        SELECT has_table_privilege('evolli_app', 'app.anexo_ausencia', 'DELETE') AS pode`;
      expect(linhas[0]!.pode).toBe(false);
    });
  });

  describe("correções da revisão (T215)", () => {
    function patch(rota: string, cred: Credencial) {
      return agent()
        .patch(rota)
        .set("Cookie", cred.cookie)
        .set("x-csrf-token", cred.csrfToken);
    }
    function del(rota: string, cred: Credencial) {
      return agent()
        .delete(rota)
        .set("Cookie", cred.cookie)
        .set("x-csrf-token", cred.csrfToken);
    }
    const REGRAS = {
      antecedenciaMinimaDias: 30,
      antecedenciaMaximaMeses: null,
      alemDoSaldo: "nao_aceitar",
      duracaoMinimaDias: null,
      duracaoMaximaDias: null,
      periodosPorAno: null,
      periodoMaiorDias: null,
      intervaloDias: null,
      inicioNaoAntesDeDescanso: false,
      inicioNaoNoFimDeSemana: false,
      voltaNaoNaSexta: false,
      voltaNaoNaVespera: false,
      bloqueios: [] as unknown[],
      foraAoMesmoTempo: null,
    };
    const politicaDaPessoa = (pessoa: string, extra = {}) => ({
      nome: "Política sintética da revisão",
      tiposVinculo: ["clt"],
      abrangencia: "algumas",
      alvos: [{ tipo: "pessoa", id: pessoa }],
      valeAPartirDe: HOJE,
      regras: REGRAS,
      aprovacao: { quem: "rh", lembreteDias: null, foraDaPolitica: "avisar" },
      ...extra,
    });
    const reiniciosDa = (ausenciaId: string) =>
      prisma.reinicioPeriodoAquisitivo.findMany({
        where: { ausenciaId },
        orderBy: { criadoEm: "asc" },
      });

    describe("férias coletivas: o reinício segue a coletiva", () => {
      const NOVATO = somarMeses(HOJE, -6);
      const inicio = somarDias(HOJE, 20);
      const fim = somarDias(inicio, 9);
      async function coletiva(aprovada = true) {
        const { id } = await admitir(rhA, empresaA, "ativo", "clt", NOVATO);
        const r = await post("/v1/ausencias", rhA)
          .send({
            colaboradorId: id,
            tipo: "ferias",
            inicio,
            fim,
            feriasColetivas: true,
            aprovada,
          })
          .expect(201);
        expect(r.body.feriasColetivas).toBe(true);
        const [reinicio] = await reiniciosDa(r.body.id);
        expect(reinicio).toMatchObject({
          motivo: "ferias_coletivas",
          removidoEm: null,
        });
        return { pessoa: id, ausencia: r.body.id as string };
      }
      const vivos = async (pessoa: string) =>
        (await get(`/v1/colaboradores/${pessoa}/ferias`, rhA).expect(200)).body
          .reinicios;

      it("cancelar desfaz o reinício (lógico, com trilha)", async () => {
        const { pessoa, ausencia } = await coletiva();
        await post(`/v1/ausencias/${ausencia}/cancelar`, rhA)
          .send()
          .expect(200);
        const [reinicio] = await reiniciosDa(ausencia);
        expect(reinicio!.removidoEm).not.toBeNull();
        expect(reinicio!.removidoPorId).toEqual(expect.any(String));
        expect(await vivos(pessoa)).toEqual([]);
        const eventos = await prisma.auditEvent.findMany({
          where: { resourceId: reinicio!.id, resource: "reinicio_periodo" },
          orderBy: { occurredAt: "asc" },
        });
        expect(eventos.map((e) => e.action)).toEqual([
          "pessoas_periodo_reiniciado",
          "pessoas_periodo_reinicio_removido",
        ]);
      });

      it("recusar e excluir também desfazem", async () => {
        const recusada = await coletiva(false);
        await post(`/v1/ausencias/${recusada.ausencia}/recusar`, rhA)
          .send({ motivo: "Coletiva remarcada" })
          .expect(200);
        expect(await vivos(recusada.pessoa)).toEqual([]);
        const excluida = await coletiva();
        await del(`/v1/ausencias/${excluida.ausencia}`, rhA).expect(204);
        expect(await vivos(excluida.pessoa)).toEqual([]);
      });

      it("editar: mudar a data troca o reinício; deixar de ser férias o desfaz", async () => {
        const { pessoa, ausencia } = await coletiva();
        const novoInicio = somarDias(inicio, 5);
        // A simulação da edição usa a nova data, não o reinício antigo.
        const simulada = (
          await get(
            `/v1/ausencias/simulacao?colaboradorId=${pessoa}&tipo=ferias&inicio=${novoInicio}&fim=${somarDias(novoInicio, 9)}&feriasColetivas=true&ignorar=${ausencia}`,
            rhA,
          ).expect(200)
        ).body;
        expect(simulada.periodo).toEqual({
          inicio: NOVATO,
          fim: somarDias(novoInicio, -1),
        });
        expect(simulada.coletiva).toMatchObject({ novoPeriodo: novoInicio });
        const r = await patch(`/v1/ausencias/${ausencia}`, rhA)
          .send({
            tipo: "ferias",
            inicio: novoInicio,
            fim: somarDias(novoInicio, 9),
            feriasColetivas: true,
            aprovada: true,
          })
          .expect(200);
        expect(r.body.feriasColetivas).toBe(true);
        const lista = await reiniciosDa(ausencia);
        expect(lista).toHaveLength(2);
        expect(lista[0]!.removidoEm).not.toBeNull();
        expect(lista[1]!.removidoEm).toBeNull();
        expect(lista[1]!.inicio.toISOString().slice(0, 10)).toBe(novoInicio);
        expect(
          (await vivos(pessoa)).map((x: { inicio: string }) => x.inicio),
        ).toEqual([novoInicio]);
        const dayOff = await patch(`/v1/ausencias/${ausencia}`, rhA)
          .send({
            tipo: "day_off",
            inicio: novoInicio,
            fim: novoInicio,
            aprovada: true,
          })
          .expect(200);
        expect(dayOff.body.feriasColetivas).toBe(false);
        expect(await vivos(pessoa)).toEqual([]);
      });

      it("registrar coletiva confere as férias já lançadas (409 sem período)", async () => {
        const { id } = await admitir(rhA, empresaA, "ativo", "clt", NOVATO);
        // Férias lá na frente, do segundo período (que a coletiva apagaria).
        const segundo = somarMeses(NOVATO, 12);
        const longe = somarDias(somarMeses(NOVATO, 24), 5);
        await post("/v1/ausencias", rhA)
          .send({
            colaboradorId: id,
            tipo: "ferias",
            inicio: longe,
            fim: somarDias(longe, 9),
            periodoAquisitivoInicio: segundo,
            aprovada: true,
          })
          .expect(201);
        const r = await post("/v1/ausencias", rhA)
          .send({
            colaboradorId: id,
            tipo: "ferias",
            inicio,
            fim,
            feriasColetivas: true,
            aprovada: true,
          })
          .expect(409);
        expect(r.body.erros).toEqual([
          { campo: "inicio", motivo: "ferias_sem_periodo" },
        ]);
        expect(
          await prisma.reinicioPeriodoAquisitivo.count({
            where: { colaboradorId: id },
          }),
        ).toBe(0);
      });
    });

    it("editar férias fora da política: aceita o motivo, reavalia e limpa", async () => {
      const { id: pessoa } = await admitir(rhA, empresaA);
      const politica = await post("/v1/politicas-ferias", rhA)
        .send(politicaDaPessoa(pessoa))
        .expect(201);
      const inicio = somarDias(HOJE, 10);
      const r = await post("/v1/ausencias", rhA)
        .send({
          colaboradorId: pessoa,
          tipo: "ferias",
          inicio,
          fim: somarDias(inicio, 14),
          aprovada: true,
          motivoForaDaPolitica: "Combinado com a gestão",
        })
        .expect(201);
      expect(r.body.motivoForaDaPolitica).toBe("Combinado com a gestão");
      const corpo = {
        tipo: "ferias",
        inicio,
        fim: somarDias(inicio, 14),
        aprovada: true,
        feriasColetivas: false,
      };
      const sem = await patch(`/v1/ausencias/${r.body.id}`, rhA)
        .send({ ...corpo, observacao: "Sem motivo" })
        .expect(422);
      expect(sem.body.erros).toEqual([
        { campo: "motivoForaDaPolitica", motivo: "obrigatorio" },
      ]);
      const com = await patch(`/v1/ausencias/${r.body.id}`, rhA)
        .send({ ...corpo, motivoForaDaPolitica: "  Novo motivo  " })
        .expect(200);
      expect(com.body.motivoForaDaPolitica).toBe("Novo motivo");
      let linha = await prisma.ausencia.findUniqueOrThrow({
        where: { id: r.body.id },
      });
      expect(linha.politicaFeriasId).toBe(politica.body.id);
      // Dentro da política (40 dias de antecedência): os campos saem.
      const longe = somarDias(HOJE, 40);
      await patch(`/v1/ausencias/${r.body.id}`, rhA)
        .send({ ...corpo, inicio: longe, fim: somarDias(longe, 14) })
        .expect(200);
      linha = await prisma.ausencia.findUniqueOrThrow({
        where: { id: r.body.id },
      });
      expect(linha.politicaFeriasId).toBeNull();
      expect(linha.motivoForaDaPolitica).toBeNull();
      await post(`/v1/politicas-ferias/${politica.body.id}/desativar`, rhA)
        .send()
        .expect(200);
    });

    it("venda em frações: soma o que o período já vendeu", async () => {
      const { id } = await admitir(rhA, empresaA);
      const a = somarDias(HOJE, 20);
      await post("/v1/ausencias", rhA)
        .send({
          colaboradorId: id,
          tipo: "ferias",
          inicio: a,
          fim: somarDias(a, 4),
          diasVendidos: 6,
          aprovada: true,
        })
        .expect(201);
      const b = somarDias(HOJE, 40);
      const s = (
        await get(
          `/v1/ausencias/simulacao?colaboradorId=${id}&tipo=ferias&inicio=${b}&fim=${somarDias(b, 4)}`,
          rhA,
        ).expect(200)
      ).body;
      expect(s).toMatchObject({ maxVendaveis: 4, vendidosNoPeriodo: 6 });
      const r = await post("/v1/ausencias", rhA)
        .send({
          colaboradorId: id,
          tipo: "ferias",
          inicio: b,
          fim: somarDias(b, 4),
          diasVendidos: 6,
          aprovada: true,
        })
        .expect(422);
      expect(r.body.erros).toEqual([
        { campo: "diasVendidos", motivo: "venda_acima_do_limite" },
      ]);
      await post("/v1/ausencias", rhA)
        .send({
          colaboradorId: id,
          tipo: "ferias",
          inicio: b,
          fim: somarDias(b, 4),
          diasVendidos: 4,
          aprovada: true,
        })
        .expect(201);
    });

    it("período vencido com saldo é agendável, com aviso de pagamento em dobro", async () => {
      const admissao = somarMeses(HOJE, -30);
      const fimDoPrimeiro = somarDias(somarMeses(admissao, 12), -1);
      const prazo = somarMeses(fimDoPrimeiro, 12);
      const { id } = await admitir(rhA, empresaA, "ativo", "clt", admissao);
      const ficha = (
        await get(`/v1/colaboradores/${id}/ferias`, rhA).expect(200)
      ).body;
      expect(ficha.periodos[0]).toMatchObject({
        inicio: admissao,
        situacao: "vencido",
        disponiveis: 30,
      });
      const inicio = somarDias(HOJE, 10);
      const fim = somarDias(inicio, 9);
      const s = (
        await get(
          `/v1/ausencias/simulacao?colaboradorId=${id}&tipo=ferias&inicio=${inicio}&fim=${fim}&periodoAquisitivoInicio=${admissao}`,
          rhA,
        ).expect(200)
      ).body;
      expect(s.periodo).toEqual({ inicio: admissao, fim: fimDoPrimeiro });
      expect(s.avisosClt).toContainEqual({
        regra: "pagamento_em_dobro",
        dias: 10,
        prazoGozo: prazo,
      });
      const r = await post("/v1/ausencias", rhA)
        .send({
          colaboradorId: id,
          tipo: "ferias",
          inicio,
          fim,
          aprovada: true,
        })
        .expect(201);
      expect(r.body.periodoAquisitivo).toEqual({
        inicio: admissao,
        fim: fimDoPrimeiro,
      });
    });

    it("um com 14 dias: a simulação conta os dias vendidos", async () => {
      const { id } = await admitir(rhA, empresaA);
      const inicio = somarDias(HOJE, 20);
      const url = (vendidos: number) =>
        `/v1/ausencias/simulacao?colaboradorId=${id}&tipo=ferias&inicio=${inicio}&fim=${somarDias(inicio, 9)}&diasVendidos=${vendidos}`;
      const sem = (await get(url(0), rhA).expect(200)).body;
      expect(sem.avisosClt).not.toContainEqual({ regra: "um_com_14" });
      const com = (await get(url(10), rhA).expect(200)).body;
      expect(com.avisosClt).toContainEqual({ regra: "um_com_14" });
    });

    it("ajuste sugerido: aprovar é recusado por campo; editar responde à sugestão", async () => {
      const { id: pessoa } = await admitir(rhA, empresaA);
      const dia = somarDias(HOJE, 160);
      const r = await post("/v1/ausencias", rhA)
        .send({
          colaboradorId: pessoa,
          tipo: "day_off",
          inicio: dia,
          fim: dia,
          aprovada: false,
        })
        .expect(201);
      await post(`/v1/ausencias/${r.body.id}/sugerir`, rhA)
        .send({ inicio: somarDias(dia, 1), fim: somarDias(dia, 1) })
        .expect(200);
      const aprovar = await post(`/v1/ausencias/${r.body.id}/aprovar`, rhA)
        .send()
        .expect(422);
      expect(aprovar.body.erros).toEqual([
        { campo: "sugestao", motivo: "aguardando_resposta" },
      ]);
      const linha = await prisma.ausencia.findUniqueOrThrow({
        where: { id: r.body.id },
      });
      expect(linha.status).toBe("ajuste_sugerido");
      const editada = await patch(`/v1/ausencias/${r.body.id}`, rhA)
        .send({
          tipo: "day_off",
          inicio: somarDias(dia, 1),
          fim: somarDias(dia, 1),
          aprovada: true,
        })
        .expect(200);
      expect(editada.body).toMatchObject({
        status: "aprovada",
        sugestao: null,
      });
    });

    it("política: alvo de outra empresa é recusado; nome de outra empresa não aparece", async () => {
      const deB = await admitir(rhB, empresaB);
      const lotacaoB = await lotacaoMinima(appUrl, empresaB);
      const pessoa = await post("/v1/politicas-ferias", rhA)
        .send(politicaDaPessoa(deB.id))
        .expect(422);
      expect(pessoa.body.erros).toEqual([
        { campo: "alvos", motivo: "indisponivel" },
      ]);
      const departamento = await post("/v1/politicas-ferias", rhA)
        .send({
          ...politicaDaPessoa(deB.id),
          alvos: [{ tipo: "departamento", id: lotacaoB.departamentoId }],
        })
        .expect(422);
      expect(departamento.body.erros).toEqual([
        { campo: "alvos", motivo: "indisponivel" },
      ]);
      const unidade = await post("/v1/politicas-ferias", rhA)
        .send({
          ...politicaDaPessoa(deB.id),
          alvos: [{ tipo: "unidade", id: lotacaoB.unidadeOrganizacionalId }],
        })
        .expect(422);
      expect(unidade.body.erros).toEqual([
        { campo: "alvos", motivo: "indisponivel" },
      ]);
      // Gravada antes da correção (direto no banco): o nome não vaza.
      const { id: daA } = await admitir(rhA, empresaA);
      const criada = await post("/v1/politicas-ferias", rhA)
        .send(politicaDaPessoa(daA, { rascunho: true }))
        .expect(201);
      await prisma.politicaFerias.update({
        where: { id: criada.body.id },
        data: { alvos: [{ tipo: "pessoa", id: deB.id }] },
      });
      const detalhe = (
        await get(`/v1/politicas-ferias/${criada.body.id}`, rhA).expect(200)
      ).body;
      expect(detalhe.alvos).toEqual([
        { tipo: "pessoa", id: deB.id, nome: "—" },
      ]);
      expect(JSON.stringify(detalhe)).not.toContain(deB.nome);
      await post(`/v1/politicas-ferias/${criada.body.id}/desativar`, rhA)
        .send()
        .expect(200);
    });

    it("política incoerente: bloqueio invertido e duração mínima acima da máxima", async () => {
      const { id: pessoa } = await admitir(rhA, empresaA);
      const bloqueio = await post("/v1/politicas-ferias", rhA)
        .send(
          politicaDaPessoa(pessoa, {
            regras: {
              ...REGRAS,
              bloqueios: [
                {
                  nome: "Inventário",
                  inicio: "2027-03-10",
                  fim: "2027-03-01",
                  todoAno: false,
                },
              ],
            },
          }),
        )
        .expect(422);
      expect(bloqueio.body.erros).toEqual([
        { campo: "regras.bloqueios", motivo: "fim_antes_do_inicio" },
      ]);
      const duracao = await post("/v1/politicas-ferias", rhA)
        .send(
          politicaDaPessoa(pessoa, {
            regras: { ...REGRAS, duracaoMinimaDias: 20, duracaoMaximaDias: 10 },
          }),
        )
        .expect(422);
      expect(duracao.body.erros).toEqual([
        { campo: "regras.duracaoMaximaDias", motivo: "fora_de_ordem" },
      ]);
    });

    it("antecedência mínima não vale para registro retroativo", async () => {
      const { id: pessoa } = await admitir(rhA, empresaA);
      const politica = await post("/v1/politicas-ferias", rhA)
        .send(politicaDaPessoa(pessoa))
        .expect(201);
      const inicio = somarDias(HOJE, -5);
      const s = (
        await get(
          `/v1/ausencias/simulacao?colaboradorId=${pessoa}&tipo=ferias&inicio=${inicio}&fim=${somarDias(inicio, 14)}`,
          rhA,
        ).expect(200)
      ).body;
      expect(s.politica).toMatchObject({ id: politica.body.id, violacoes: [] });
      await post(`/v1/politicas-ferias/${politica.body.id}/desativar`, rhA)
        .send()
        .expect(200);
    });

    it("fora do vínculo: antes da admissão no registro; vínculo encerrado na edição", async () => {
      const { id: pessoa } = await admitir(rhA, empresaA);
      const antes = await post("/v1/ausencias", rhA)
        .send({
          colaboradorId: pessoa,
          tipo: "day_off",
          inicio: somarDias(ADMISSAO, -3),
          fim: somarDias(ADMISSAO, -3),
          aprovada: true,
        })
        .expect(422);
      expect(antes.body.erros).toEqual([
        { campo: "inicio", motivo: "antes_da_admissao" },
      ]);
      const dia = somarDias(HOJE, -10);
      const r = await post("/v1/ausencias", rhA)
        .send({
          colaboradorId: pessoa,
          tipo: "day_off",
          inicio: dia,
          fim: dia,
          aprovada: true,
        })
        .expect(201);
      const antesNaEdicao = await patch(`/v1/ausencias/${r.body.id}`, rhA)
        .send({
          tipo: "day_off",
          inicio: somarDias(ADMISSAO, -1),
          fim: somarDias(ADMISSAO, -1),
          aprovada: true,
        })
        .expect(422);
      expect(antesNaEdicao.body.erros).toEqual([
        { campo: "inicio", motivo: "antes_da_admissao" },
      ]);
      await prisma.vinculoFuncional.updateMany({
        where: { colaboradorId: pessoa, empresaId: empresaA },
        data: {
          situacao: "encerrado",
          dataDesligamento: new Date(`${somarDias(HOJE, -1)}T00:00:00Z`),
        },
      });
      const encerrado = await patch(`/v1/ausencias/${r.body.id}`, rhA)
        .send({
          tipo: "day_off",
          inicio: dia,
          fim: dia,
          aprovada: true,
          observacao: "x",
        })
        .expect(422);
      expect(encerrado.body.erros).toEqual([
        { campo: "inicio", motivo: "fora_do_vinculo" },
      ]);
    });
  });
});
