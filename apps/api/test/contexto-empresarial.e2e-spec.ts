/**
 * T163 — Contexto empresarial ativo e troca segura de empresa (e2e).
 *
 * PostgreSQL real e efêmero (Testcontainers), mesma montagem das demais
 * suítes. Todos os dados são técnicos e sintéticos.
 *
 * A prova central desta suíte não é "a rota responde 200". É **isolamento**:
 * duas empresas distintas, um colaborador em cada, e a demonstração de que
 * trocar o contexto troca o universo inteiro de dados que a sessão enxerga —
 * sem que nada da empresa anterior sobre.
 *
 * As outras três perguntas que a suíte responde:
 *
 * - quem **não** pode trocar não troca, **nem por requisição forjada** com
 *   cookie e CSRF válidos;
 * - autorização **revogada** derruba o contexto de volta ao padrão, e não para
 *   um escopo mais amplo;
 * - duas sessões da mesma conta mantêm contextos **independentes**.
 */
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

const SENHA_PADRAO = "Contexto!Empresa2026#Teste";

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

describe("Contexto empresarial ativo (e2e)", () => {
  let container: StartedTestContainer;
  let appUrl: string;
  let migratorUrl: string;
  let app: INestApplication;
  let prisma: PrismaClient;

  let master: Credencial;
  let rhB: Credencial;
  let rhD: Credencial;
  let dpB: Credencial;
  let gestorB: Credencial;
  let colaboradorB: Credencial;

  /**
   * Duas empresas sintéticas distintas. Os nomes B e D são deliberados: não
   * são "A e B" consecutivos, para que uma troca acidental de variável fique
   * visível na leitura em vez de passar por coincidência de vizinhança.
   */
  let empresaB: string;
  let empresaD: string;

  /** Departamento por empresa — pré-requisito do contrato de admissão. */
  const departamentoDe: Record<string, string> = {};

  /** Um colaborador em cada empresa — a prova de isolamento é sobre eles. */
  const MATRICULA_B = "FUNC-B-0001";
  const MATRICULA_D = "FUNC-D-0001";
  const NOME_B = "Funcionario A da Empresa B";
  const NOME_D = "Funcionario C da Empresa D";
  const NOME_NOVO_EM_D = "Criado No Contexto D";

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

  function post(rota: string, cred: Credencial) {
    return agent()
      .post(rota)
      .set("Cookie", cred.cookie)
      .set("x-csrf-token", cred.csrfToken);
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
    return login(email, SENHA_PADRAO);
  }

  async function criarUsuario(
    email: string,
    role: string,
    companyId: string | undefined,
  ): Promise<Credencial> {
    await post("/v1/users", master)
      .send({
        email,
        password: SENHA_PADRAO,
        role,
        ...(companyId ? { companyId } : {}),
      })
      .expect(201);
    return login(email, SENHA_PADRAO);
  }

  /** Concede autorização de empresa direto no banco — é ato administrativo. */
  async function autorizarEmpresa(email: string, empresaId: string) {
    const user = await prisma.accessUser.findUniqueOrThrow({
      where: { email },
    });
    const concedente = await prisma.accessUser.findFirstOrThrow({
      where: { role: "master_tecnico" },
    });
    await prisma.accessUserEmpresa.upsert({
      where: { userId_empresaId: { userId: user.id, empresaId } },
      create: {
        userId: user.id,
        empresaId,
        concedidoPorUserId: concedente.id,
      },
      update: { revogadoEm: null, revogadoPorUserId: null },
    });
  }

  async function revogarEmpresa(email: string, empresaId: string) {
    const user = await prisma.accessUser.findUniqueOrThrow({
      where: { email },
    });
    const revogador = await prisma.accessUser.findFirstOrThrow({
      where: { role: "master_tecnico" },
    });
    await prisma.accessUserEmpresa.update({
      where: { userId_empresaId: { userId: user.id, empresaId } },
      data: { revogadoEm: new Date(), revogadoPorUserId: revogador.id },
    });
  }

  /**
   * Admite um colaborador NA EMPRESA ATIVA da credencial.
   *
   * `empresaId` vai no corpo porque o contrato da rota exige — e é
   * justamente por isso que esta chamada é uma prova e não só um setup: o
   * service recusa com 404 quando o corpo aponta para empresa diferente do
   * escopo resolvido. Aqui passamos a empresa que esperamos estar ativa, de
   * modo que um contexto errado FALHA em vez de criar no lugar errado.
   */
  async function admitir(
    cred: Credencial,
    empresaId: string,
    matricula: string,
    nome: string,
  ): Promise<string> {
    const departamentoId = departamentoDe[empresaId]!;
    const resposta = await post("/v1/colaboradores", cred)
      .send({
        ...CAMPOS_OBRIGATORIOS_ADMISSAO,
        nome,
        empresaId,
        matricula,
        tipo: "clt",
        dataAdmissao: "2026-01-05",
        motivoCodigo: "admissao_inicial",
        departamentoId,
      })
      .expect(201);
    return resposta.body.id as string;
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
    prisma = new PrismaClient({ datasources: { db: { url: appUrl } } });

    expect(
      runBootstrap({
        DATABASE_URL: appUrl,
        ADMIN_BOOTSTRAP_EMAIL: "admin.ctx@example.test",
        ADMIN_BOOTSTRAP_PASSWORD: SENHA_PADRAO,
      }).status,
    ).toBe(0);

    master = await seedMaster("master.ctx@example.test");

    empresaB = (
      await post("/v1/empresas", master)
        .send({ codigo: "EMPB", nome: "Empresa B" })
        .expect(201)
    ).body.id;
    empresaD = (
      await post("/v1/empresas", master)
        .send({ codigo: "EMPD", nome: "Empresa D" })
        .expect(201)
    ).body.id;

    rhB = await criarUsuario("rh.b@example.test", "rh", empresaB);
    rhD = await criarUsuario("rh.d@example.test", "rh", empresaD);
    dpB = await criarUsuario("dp.b@example.test", "dp", empresaB);
    gestorB = await criarUsuario("gestor.b@example.test", "gestor", empresaB);
    colaboradorB = await criarUsuario(
      "colab.b@example.test",
      "colaborador",
      empresaB,
    );

    // Um departamento por empresa, criado por quem é dali.
    departamentoDe[empresaB] = (
      await post("/v1/departamentos", rhB)
        .send({ empresaId: empresaB, codigo: "DEPB", nome: "Departamento B" })
        .expect(201)
    ).body.id;
    departamentoDe[empresaD] = (
      await post("/v1/departamentos", rhD)
        .send({ empresaId: empresaD, codigo: "DEPD", nome: "Departamento D" })
        .expect(201)
    ).body.id;

    // Um colaborador em cada empresa, admitido por quem é dali.
    await admitir(rhB, empresaB, MATRICULA_B, NOME_B);
    await admitir(rhD, empresaD, MATRICULA_D, NOME_D);
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    await app?.close();
    await container?.stop();
  });

  // -------------------------------------------------------------------------
  // 1. Quem lista, e quem não lista
  // -------------------------------------------------------------------------
  describe("1. a lista de empresas autorizadas", () => {
    it("rh sem concessão vê SÓ a própria empresa", async () => {
      const r = await get("/v1/auth/contexto/empresas", rhB).expect(200);
      expect(r.body.itens.map((e: { codigo: string }) => e.codigo)).toEqual([
        "EMPB",
      ]);
    });

    it("master_tecnico vê todas as empresas ativas — a política existente, explícita", async () => {
      const r = await get("/v1/auth/contexto/empresas", master).expect(200);
      const codigos = r.body.itens.map((e: { codigo: string }) => e.codigo);
      expect(codigos).toEqual(["EMPB", "EMPD"]);
    });

    it.each([
      ["dp", () => dpB],
      ["gestor", () => gestorB],
      ["colaborador", () => colaboradorB],
    ])("%s recebe 403 — e nenhum nome de empresa", async (_papel, cred) => {
      const r = await get("/v1/auth/contexto/empresas", cred()).expect(403);
      // O princípio 10 em prova: nem o corpo do erro cita empresa.
      expect(JSON.stringify(r.body)).not.toContain("EMP");
      expect(JSON.stringify(r.body)).not.toContain("Empresa");
    });

    it("rh com concessão vê as duas, ordenadas", async () => {
      await autorizarEmpresa("rh.b@example.test", empresaD);
      const r = await get("/v1/auth/contexto/empresas", rhB).expect(200);
      expect(r.body.itens.map((e: { codigo: string }) => e.codigo)).toEqual([
        "EMPB",
        "EMPD",
      ]);
    });
  });

  // -------------------------------------------------------------------------
  // 2. A PROVA DE ISOLAMENTO — o coração desta suíte
  // -------------------------------------------------------------------------
  describe("2. trocar de empresa troca o universo de dados", () => {
    it("antes da troca, rh da B vê o funcionário da B e NÃO vê o da D", async () => {
      const r = await get("/v1/colaboradores", rhB).expect(200);
      const nomes = r.body.itens.map((c: { nome: string }) => c.nome);
      expect(nomes).toContain(NOME_B);
      expect(nomes).not.toContain(NOME_D);
      // Nem o nome aparece em lugar nenhum da resposta.
      expect(JSON.stringify(r.body)).not.toContain(NOME_D);
    });

    it("depois de trocar para D, vê o funcionário da D e NÃO vê o da B", async () => {
      await post("/v1/auth/contexto/empresa", rhB)
        .send({ empresaId: empresaD })
        .expect(200);

      const r = await get("/v1/colaboradores", rhB).expect(200);
      const nomes = r.body.itens.map((c: { nome: string }) => c.nome);
      expect(nomes).toContain(NOME_D);
      expect(nomes).not.toContain(NOME_B);
      // Nada da empresa anterior sobra na resposta.
      expect(JSON.stringify(r.body)).not.toContain(NOME_B);
    });

    it("`/users/me` passa a reportar a empresa ATIVA", async () => {
      const r = await get("/v1/users/me", rhB).expect(200);
      expect(r.body.companyId).toBe(empresaD);
      expect(r.body.podeTrocarEmpresa).toBe(true);
    });

    it("a MUTAÇÃO também segue o contexto: o cadastro nasce na empresa ativa", async () => {
      await admitir(rhB, empresaD, "FUNC-D-0002", NOME_NOVO_EM_D);

      // Aparece na D...
      const naD = await get("/v1/colaboradores", rhB).expect(200);
      expect(naD.body.itens.map((c: { nome: string }) => c.nome)).toContain(
        NOME_NOVO_EM_D,
      );

      // ...e não aparece na B, vista por quem é da B.
      const naB = await get("/v1/colaboradores", dpB).expect(200);
      expect(naB.body.itens.map((c: { nome: string }) => c.nome)).not.toContain(
        NOME_NOVO_EM_D,
      );
    });

    it("corpo apontando para OUTRA empresa é recusado com 404, mesmo autorizado nela", async () => {
      // O ator está no contexto D e TEM autorização na B — mas o corpo não
      // amplia escopo: quem decide é o contexto ativo, não o cliente.
      await post("/v1/colaboradores", rhB)
        .send({
          ...CAMPOS_OBRIGATORIOS_ADMISSAO,
          nome: "Nao Deve Nascer",
          empresaId: empresaB,
          matricula: "FUNC-X-0001",
          tipo: "clt",
          dataAdmissao: "2026-01-05",
          motivoCodigo: "admissao_inicial",
          departamentoId: departamentoDe[empresaB],
        })
        .expect(404);
    });

    it("voltar para B restaura exatamente o escopo de B", async () => {
      await post("/v1/auth/contexto/empresa", rhB)
        .send({ empresaId: empresaB })
        .expect(200);

      const r = await get("/v1/colaboradores", rhB).expect(200);
      const nomes = r.body.itens.map((c: { nome: string }) => c.nome);
      expect(nomes).toContain(NOME_B);
      expect(nomes).not.toContain(NOME_D);
    });

    it("master_tecnico troca para D e passa a ver apenas a D", async () => {
      // Sem seleção, o escopo dele é global: enxerga os dois.
      const global = await get("/v1/colaboradores", master).expect(200);
      const todas = global.body.itens.map((c: { nome: string }) => c.nome);
      expect(todas).toContain(NOME_B);
      expect(todas).toContain(NOME_D);

      await post("/v1/auth/contexto/empresa", master)
        .send({ empresaId: empresaD })
        .expect(200);

      const escopado = await get("/v1/colaboradores", master).expect(200);
      const soD = escopado.body.itens.map((c: { nome: string }) => c.nome);
      expect(soD).toContain(NOME_D);
      expect(soD).not.toContain(NOME_B);
    });
  });

  // -------------------------------------------------------------------------
  // 3. Quem não pode trocar não troca — nem forjando a requisição
  // -------------------------------------------------------------------------
  describe("3. a troca recusada", () => {
    it.each([
      ["dp", () => dpB],
      ["gestor", () => gestorB],
      ["colaborador", () => colaboradorB],
    ])(
      "%s com cookie e CSRF válidos ainda recebe 403 ao forjar a troca",
      async (_papel, cred) => {
        await post("/v1/auth/contexto/empresa", cred())
          .send({ empresaId: empresaD })
          .expect(403);
      },
    );

    it("o contexto do gestor NÃO mudou depois da tentativa forjada", async () => {
      const r = await get("/v1/users/me", gestorB).expect(200);
      expect(r.body.companyId).toBe(empresaB);
      expect(r.body.podeTrocarEmpresa).toBe(false);
    });

    it("rh sem concessão para a D recebe 404 — nunca 403", async () => {
      // 403 confirmaria que a empresa D existe. 404 não confirma nada.
      await post("/v1/auth/contexto/empresa", rhD)
        .send({ empresaId: empresaB })
        .expect(404);
    });

    it("empresa inexistente responde o MESMO 404 da não autorizada", async () => {
      await post("/v1/auth/contexto/empresa", rhD)
        .send({ empresaId: "99999999-9999-4999-8999-999999999999" })
        .expect(404);
    });

    it("corpo com campo extra é recusado, não ignorado", async () => {
      await post("/v1/auth/contexto/empresa", rhB)
        .send({ empresaId: empresaB, global: true })
        .expect(400);
    });

    it("sem CSRF a troca não acontece", async () => {
      await agent()
        .post("/v1/auth/contexto/empresa")
        .set("Cookie", rhB.cookie)
        .send({ empresaId: empresaB })
        .expect(403);
    });

    it("`companyId` de query NÃO amplia escopo de quem está escopado", async () => {
      // Princípio 7: escopo nunca vem do cliente.
      const r = await get(`/v1/colaboradores?empresaId=${empresaD}`, rhB);
      // A rota recusa o parâmetro (400) ou o ignora — o que não pode é
      // devolver dado da D para quem está na B.
      if (r.status === 200) {
        expect(JSON.stringify(r.body)).not.toContain(NOME_D);
      } else {
        expect([400, 404]).toContain(r.status);
      }
    });
  });

  // -------------------------------------------------------------------------
  // 4. Revogação: rebaixa, nunca promove
  // -------------------------------------------------------------------------
  describe("4. autorização revogada", () => {
    it("revogar a concessão com a sessão NA empresa derruba o contexto para o padrão", async () => {
      await post("/v1/auth/contexto/empresa", rhB)
        .send({ empresaId: empresaD })
        .expect(200);
      expect((await get("/v1/users/me", rhB).expect(200)).body.companyId).toBe(
        empresaD,
      );

      await revogarEmpresa("rh.b@example.test", empresaD);

      // A PRÓXIMA requisição já opera na empresa da conta — não em escopo
      // global, que seria perda de acesso virando ganho de acesso.
      const depois = await get("/v1/users/me", rhB).expect(200);
      expect(depois.body.companyId).toBe(empresaB);

      const r = await get("/v1/colaboradores", rhB).expect(200);
      const nomes = r.body.itens.map((c: { nome: string }) => c.nome);
      expect(nomes).toContain(NOME_B);
      expect(nomes).not.toContain(NOME_D);
    });

    it("a seleção morta é LIMPA da sessão, não guardada à espera", async () => {
      const sessoes = await prisma.accessSession.findMany({
        where: { user: { email: "rh.b@example.test" }, revokedAt: null },
        select: { empresaAtivaId: true },
      });
      expect(sessoes.every((s) => s.empresaAtivaId === null)).toBe(true);
    });

    it("depois de revogada, a empresa some da lista e a troca volta a dar 404", async () => {
      const lista = await get("/v1/auth/contexto/empresas", rhB).expect(200);
      expect(lista.body.itens.map((e: { codigo: string }) => e.codigo)).toEqual(
        ["EMPB"],
      );
      await post("/v1/auth/contexto/empresa", rhB)
        .send({ empresaId: empresaD })
        .expect(404);
    });
  });

  // -------------------------------------------------------------------------
  // 5. Sessões independentes, e login previsível
  // -------------------------------------------------------------------------
  describe("5. sessões não vazam contexto entre si", () => {
    it("trocar numa sessão NÃO muda o contexto da outra", async () => {
      await autorizarEmpresa("rh.b@example.test", empresaD);

      const sessao1 = await login("rh.b@example.test", SENHA_PADRAO);
      const sessao2 = await login("rh.b@example.test", SENHA_PADRAO);

      await post("/v1/auth/contexto/empresa", sessao1)
        .send({ empresaId: empresaD })
        .expect(200);

      expect(
        (await get("/v1/users/me", sessao1).expect(200)).body.companyId,
      ).toBe(empresaD);
      expect(
        (await get("/v1/users/me", sessao2).expect(200)).body.companyId,
      ).toBe(empresaB);

      // E os dados seguem o contexto de cada uma, não o da última troca.
      const da1 = await get("/v1/colaboradores", sessao1).expect(200);
      const da2 = await get("/v1/colaboradores", sessao2).expect(200);
      expect(JSON.stringify(da1.body)).not.toContain(NOME_B);
      expect(JSON.stringify(da2.body)).not.toContain(NOME_D);
    });

    it("login novo começa SEM seleção — no padrão previsível do papel", async () => {
      const antiga = await login("rh.b@example.test", SENHA_PADRAO);
      await post("/v1/auth/contexto/empresa", antiga)
        .send({ empresaId: empresaD })
        .expect(200);

      const nova = await login("rh.b@example.test", SENHA_PADRAO);
      expect((await get("/v1/users/me", nova).expect(200)).body.companyId).toBe(
        empresaB,
      );
    });

    it("logout leva a seleção embora junto com a sessão", async () => {
      const sessao = await login("rh.b@example.test", SENHA_PADRAO);
      await post("/v1/auth/contexto/empresa", sessao)
        .send({ empresaId: empresaD })
        .expect(200);

      await post("/v1/auth/logout", sessao).expect(204);
      await get("/v1/users/me", sessao).expect(401);

      const depois = await login("rh.b@example.test", SENHA_PADRAO);
      expect(
        (await get("/v1/users/me", depois).expect(200)).body.companyId,
      ).toBe(empresaB);
    });
  });

  // -------------------------------------------------------------------------
  // 6. Auditoria da troca
  // -------------------------------------------------------------------------
  describe("6. a troca deixa trilha, e a trilha não carrega dado sensível", () => {
    it("gera evento com a empresa de destino e o papel do ator", async () => {
      const sessao = await login("rh.b@example.test", SENHA_PADRAO);
      await post("/v1/auth/contexto/empresa", sessao)
        .send({ empresaId: empresaD })
        .expect(200);

      const eventos = await prisma.auditEvent.findMany({
        where: { action: "acesso_contexto_empresa_trocado" },
        orderBy: { occurredAt: "desc" },
        take: 1,
      });
      expect(eventos).toHaveLength(1);
      const evento = eventos[0]!;
      expect(evento.companyId).toBe(empresaD);
      expect(evento.actorRole).toBe("rh");
      expect(evento.resource).toBe("access_session");
      expect(evento.result).toBe("success");
    });

    it("o evento não grava senha, token, cookie nem e-mail", async () => {
      const evento = await prisma.auditEvent.findFirstOrThrow({
        where: { action: "acesso_contexto_empresa_trocado" },
        orderBy: { occurredAt: "desc" },
      });
      const serializado = JSON.stringify(evento);
      expect(serializado).not.toContain(SENHA_PADRAO);
      expect(serializado).not.toContain("rh.b@example.test");
      expect(serializado).not.toContain("evolli_session");
    });

    it("tentativa recusada NÃO gera evento de troca bem-sucedida", async () => {
      const antes = await prisma.auditEvent.count({
        where: { action: "acesso_contexto_empresa_trocado" },
      });
      await post("/v1/auth/contexto/empresa", gestorB)
        .send({ empresaId: empresaD })
        .expect(403);
      await post("/v1/auth/contexto/empresa", rhD)
        .send({ empresaId: empresaB })
        .expect(404);
      const depois = await prisma.auditEvent.count({
        where: { action: "acesso_contexto_empresa_trocado" },
      });
      expect(depois).toBe(antes);
    });
  });

  // -------------------------------------------------------------------------
  // 7. O histórico da autorização é do banco, não da disciplina do service
  // -------------------------------------------------------------------------
  describe("7. a autorização é auditável por construção", () => {
    it("a aplicação NÃO consegue apagar uma concessão", async () => {
      const user = await prisma.accessUser.findUniqueOrThrow({
        where: { email: "rh.b@example.test" },
      });
      await expect(
        prisma.accessUserEmpresa.deleteMany({ where: { userId: user.id } }),
      ).rejects.toThrow();
    });

    it("revogação pela metade é recusada pelo banco", async () => {
      const user = await prisma.accessUser.findUniqueOrThrow({
        where: { email: "rh.b@example.test" },
      });
      await expect(
        prisma.accessUserEmpresa.update({
          where: { userId_empresaId: { userId: user.id, empresaId: empresaD } },
          // Sem `revogadoPorUserId`: uma trilha pela metade não é trilha.
          data: { revogadoEm: new Date(), revogadoPorUserId: null },
        }),
      ).rejects.toThrow();
    });
  });
});
