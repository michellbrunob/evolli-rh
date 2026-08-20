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
 * Etapa 1 — Fatia 1: Núcleo Organizacional Interno (ADR 0006, Baseline V1).
 * Integração real com PostgreSQL efêmero (Testcontainers), mesmo padrão das
 * Fatias 3 e 4. Requer Docker. Todos os dados são técnicos/sintéticos —
 * nenhum dado real de RH, nenhum dado pessoal.
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

const SENHA_PADRAO = "Estrutura!Org2026#Teste";

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

describe("Núcleo Organizacional Interno (e2e)", () => {
  let container: StartedTestContainer;
  let appUrl: string;
  let migratorUrl: string;
  let app: INestApplication;

  // `admin` = admin_tecnico do bootstrap, mantido só para PROVAR negação
  // (CG-RBAC-01: convergido para bootstrap/histórico). `master` = master_tecnico
  // semeado (único acesso global standing, ADR 0012) — faz todo o setup e as
  // operações organizacionais.
  let admin: Credencial;
  let master: Credencial;
  let rhA: Credencial;
  let rhB: Credencial;
  let dpA: Credencial;
  let financeiroA: Credencial;
  let colaboradorA: Credencial;

  let empresaA: string;
  let empresaB: string;

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
    const prisma = new PrismaClient({ datasources: { db: { url: appUrl } } });
    try {
      const passwordHash = await new PasswordHashService().hash(SENHA_PADRAO);
      await prisma.accessUser.create({
        data: { email, passwordHash, role: "master_tecnico", status: "active" },
      });
    } finally {
      await prisma.$disconnect();
    }
    return login(email, SENHA_PADRAO);
  }

  async function criarUsuario(
    email: string,
    role: string,
    companyId: string | undefined,
  ): Promise<Credencial> {
    await agent()
      .post("/v1/users")
      .set("Cookie", master.cookie)
      .set("x-csrf-token", master.csrfToken)
      .send({
        email,
        password: SENHA_PADRAO,
        role,
        ...(companyId ? { companyId } : {}),
      })
      .expect(201);
    return login(email, SENHA_PADRAO);
  }

  /** POST autenticado com CSRF. */
  function post(rota: string, cred: Credencial) {
    return agent()
      .post(rota)
      .set("Cookie", cred.cookie)
      .set("x-csrf-token", cred.csrfToken);
  }

  function patch(rota: string, cred: Credencial) {
    return agent()
      .patch(rota)
      .set("Cookie", cred.cookie)
      .set("x-csrf-token", cred.csrfToken);
  }

  function get(rota: string, cred: Credencial) {
    return agent().get(rota).set("Cookie", cred.cookie);
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
    // Pre-condicao de infraestrutura da Fatia 2: a migration exige
    // btree_gist. Provisionada aqui pelo papel ADMINISTRADOR do container
    // efemero — nunca por evolli_migrator, que por desenho da ADR 0002 nao
    // tem CREATE na base. Ver infra/postgres/README.md.
    await runInfraScript(container, "04_extensions.sql", []);

    migratorUrl = `postgresql://evolli_migrator:${MIGRATOR_PASSWORD}@${host}:${port}/${ADMIN_DB}?schema=app`;
    appUrl = `postgresql://evolli_app:${APP_PASSWORD}@${host}:${port}/${ADMIN_DB}?schema=app`;

    // A migration do Núcleo Organizacional é aplicada aqui, do zero, junto
    // com as anteriores — nenhum script manual adicional é executado.
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

    const adminEmail = "admin.org@example.test";
    expect(
      runBootstrap({
        DATABASE_URL: appUrl,
        ADMIN_BOOTSTRAP_EMAIL: adminEmail,
        ADMIN_BOOTSTRAP_PASSWORD: SENHA_PADRAO,
      }).status,
    ).toBe(0);

    admin = await login(adminEmail, SENHA_PADRAO);
    // Operador global (setup + estrutura) — admin_tecnico não opera mais por rota.
    master = await seedMaster("master.org@example.test");

    // Bootstrap administrativo: o admin sem empresa atribuída cria a
    // primeira empresa (RI-2 / Emenda 1 da ADR 0005).
    const respostaA = await post("/v1/empresas", master)
      .send({ codigo: "EMPA", nome: "Empresa A" })
      .expect(201);
    empresaA = respostaA.body.id;

    const respostaB = await post("/v1/empresas", master)
      .send({ codigo: "EMPB", nome: "Empresa B" })
      .expect(201);
    empresaB = respostaB.body.id;

    rhA = await criarUsuario("rh.a@example.test", "rh", empresaA);
    rhB = await criarUsuario("rh.b@example.test", "rh", empresaB);
    dpA = await criarUsuario("dp.a@example.test", "dp", empresaA);
    financeiroA = await criarUsuario(
      "fin.a@example.test",
      "financeiro",
      empresaA,
    );
    colaboradorA = await criarUsuario(
      "colab.a@example.test",
      "colaborador",
      empresaA,
    );
  });

  afterAll(async () => {
    await app?.close();
    await container?.stop();
  });

  describe("setup por master_tecnico e negação do admin_tecnico (CG-RBAC-01)", () => {
    it("o master_tecnico (não o admin_tecnico) criou a primeira empresa", () => {
      expect(empresaA).toEqual(expect.any(String));
      expect(empresaB).toEqual(expect.any(String));
    });

    it("admin_tecnico é NEGADO na estrutura organizacional; o master a opera", async () => {
      // Convergência: o admin_tecnico do bootstrap deixou de criar/ler empresa
      // por rota (403); o único acesso global standing é o master_tecnico.
      await post("/v1/empresas", admin)
        .send({ codigo: "ADMNEG", nome: "Nao Deve Criar" })
        .expect(403);
      await get("/v1/empresas", admin).expect(403);
      await get("/v1/empresas", master).expect(200);
    });

    it("cada uso de escopo amplo gera evento de auditoria com o escopo efetivo", async () => {
      const prisma = new PrismaClient({ datasources: { db: { url: appUrl } } });
      try {
        const eventos = await prisma.auditEvent.findMany({
          where: { action: "organizacao_empresa_criada" },
        });
        expect(eventos.length).toBeGreaterThanOrEqual(2);
        // Escopo do evento é a empresa afetada, não a do ator (que é nula).
        expect(eventos.map((e) => e.companyId)).toEqual(
          expect.arrayContaining([empresaA, empresaB]),
        );
        // As empresas foram criadas pelo master_tecnico (setup).
        expect(eventos.every((e) => e.actorRole === "master_tecnico")).toBe(
          true,
        );
      } finally {
        await prisma.$disconnect();
      }
    });
  });

  describe("fluxo CRUD permitido", () => {
    let departamentoId: string;
    let unidadeId: string;

    it("rh cria a estrutura completa da própria empresa", async () => {
      const unidade = await post("/v1/unidades-organizacionais", rhA)
        .send({ empresaId: empresaA, codigo: "MATRIZ", nome: "Matriz" })
        .expect(201);
      unidadeId = unidade.body.id;

      const departamento = await post("/v1/departamentos", rhA)
        .send({ empresaId: empresaA, codigo: "FIN", nome: "Financeiro" })
        .expect(201);
      departamentoId = departamento.body.id;
      // Departamento pertence à empresa, não à unidade (Baseline V1, item 1).
      expect(departamento.body.empresaId).toBe(empresaA);
      expect(departamento.body).not.toHaveProperty("unidadeOrganizacionalId");

      const area = await post("/v1/areas", rhA)
        .send({ departamentoId, codigo: "CONTAS", nome: "Contas a Pagar" })
        .expect(201);
      // Área é subdivisão do departamento e não carrega empresaId próprio.
      expect(area.body.departamentoId).toBe(departamentoId);
      expect(area.body).not.toHaveProperty("empresaId");

      const equipe = await post("/v1/equipes", rhA)
        .send({
          departamentoId,
          unidadeOrganizacionalId: unidadeId,
          codigo: "SQUAD1",
          nome: "Squad 1",
        })
        .expect(201);
      // empresaId é derivado do departamento, nunca informado pelo cliente.
      expect(equipe.body.empresaId).toBe(empresaA);

      await post("/v1/cargos", rhA)
        .send({ empresaId: empresaA, codigo: "ANALISTA", nome: "Analista" })
        .expect(201);

      await post("/v1/centros-de-custo", rhA)
        .send({ empresaId: empresaA, codigo: "CC100", nome: "Centro 100" })
        .expect(201);
    });

    it("lista, detalha e atualiza o nome", async () => {
      const lista = await get("/v1/departamentos", rhA).expect(200);
      expect(lista.body.total).toBeGreaterThanOrEqual(1);
      expect(lista.body).toHaveProperty("pagina");
      expect(lista.body).toHaveProperty("tamanhoPagina");

      await get(`/v1/departamentos/${departamentoId}`, rhA).expect(200);

      const atualizado = await patch(`/v1/departamentos/${departamentoId}`, rhA)
        .send({ nome: "Financeiro e Controladoria" })
        .expect(200);
      expect(atualizado.body.nome).toBe("Financeiro e Controladoria");
      expect(atualizado.body.codigo).toBe("FIN");
    });

    it("recusa código duplicado no mesmo escopo (409)", async () => {
      await post("/v1/departamentos", rhA)
        .send({ empresaId: empresaA, codigo: "FIN", nome: "Duplicado" })
        .expect(409);
    });

    it("aceita o mesmo código em empresa diferente (catálogo por empresa)", async () => {
      await post("/v1/departamentos", rhB)
        .send({ empresaId: empresaB, codigo: "FIN", nome: "Financeiro B" })
        .expect(201);
    });

    it("recusa código com acento, espaço ou minúscula", async () => {
      for (const codigo of ["ÁREA", "COM ESPACO", "minusculo", "COM-HIFEN"]) {
        await post("/v1/cargos", rhA)
          .send({ empresaId: empresaA, codigo, nome: "Teste" })
          .expect(400);
      }
    });
  });

  describe("isolamento entre empresas (IDOR/BOLA)", () => {
    let departamentoDaEmpresaA: string;

    beforeAll(async () => {
      const resposta = await post("/v1/departamentos", rhA)
        .send({ empresaId: empresaA, codigo: "RH", nome: "Recursos Humanos" })
        .expect(201);
      departamentoDaEmpresaA = resposta.body.id;
    });

    it("detalhe de outra empresa responde 404, nunca 403 nem 200", async () => {
      const resposta = await get(
        `/v1/departamentos/${departamentoDaEmpresaA}`,
        rhB,
      ).expect(404);
      expect(resposta.body.status_code).toBe(404);
    });

    it("atualização de outra empresa responde 404", async () => {
      await patch(`/v1/departamentos/${departamentoDaEmpresaA}`, rhB)
        .send({ nome: "Sequestrado" })
        .expect(404);
    });

    it("inativação de outra empresa responde 404", async () => {
      await post(`/v1/departamentos/${departamentoDaEmpresaA}/inativar`, rhB)
        .send()
        .expect(404);
    });

    it("listagem nunca vaza entidade de outra empresa", async () => {
      const lista = await get("/v1/departamentos", rhB).expect(200);
      const ids = (lista.body.itens as Array<{ id: string }>).map((d) => d.id);
      expect(ids).not.toContain(departamentoDaEmpresaA);
    });

    it("filtro explícito por outra empresa devolve página vazia, não erro", async () => {
      const lista = await get(
        `/v1/departamentos?empresaId=${empresaA}`,
        rhB,
      ).expect(200);
      expect(lista.body.total).toBe(0);
      expect(lista.body.itens).toEqual([]);
    });

    it("criar sob empresa de terceiro responde 404", async () => {
      await post("/v1/departamentos", rhB)
        .send({ empresaId: empresaA, codigo: "INVASOR", nome: "Invasor" })
        .expect(404);
    });

    it("equipe não referencia departamento de outra empresa", async () => {
      await post("/v1/equipes", rhB)
        .send({
          departamentoId: departamentoDaEmpresaA,
          codigo: "CRUZADA",
          nome: "Cruzada",
        })
        .expect(404);
    });

    it("a tentativa negada é registrada na trilha", async () => {
      const prisma = new PrismaClient({ datasources: { db: { url: appUrl } } });
      try {
        const negados = await prisma.auditEvent.findMany({
          where: { action: "authorization_denied" },
        });
        // O guard identifica o recurso organizacional em vez de rotular tudo
        // como access_user.
        expect(
          negados.some((e) =>
            [
              "empresa",
              "unidade_organizacional",
              "departamento",
              "area",
              "equipe",
              "cargo",
              "centro_custo",
            ].includes(e.resource),
          ),
        ).toBe(true);
      } finally {
        await prisma.$disconnect();
      }
    });
  });

  describe("negação por padrão conforme a matriz aprovada (spec §8)", () => {
    it("colaborador não acessa nenhum recurso organizacional", async () => {
      for (const rota of [
        "/v1/empresas",
        "/v1/unidades-organizacionais",
        "/v1/departamentos",
        "/v1/areas",
        "/v1/equipes",
        "/v1/cargos",
        "/v1/centros-de-custo",
      ]) {
        await get(rota, colaboradorA).expect(403);
      }
    });

    it("dp lê, mas nunca escreve", async () => {
      await get("/v1/departamentos", dpA).expect(200);
      await post("/v1/departamentos", dpA)
        .send({ empresaId: empresaA, codigo: "DPNEW", nome: "Tentativa" })
        .expect(403);
    });

    it("financeiro lê centro_custo, mas não os demais recursos", async () => {
      await get("/v1/centros-de-custo", financeiroA).expect(200);
      await get("/v1/departamentos", financeiroA).expect(403);
      await post("/v1/centros-de-custo", financeiroA)
        .send({ empresaId: empresaA, codigo: "CCFIN", nome: "Tentativa" })
        .expect(403);
    });

    it("rh não cria empresa (fora de 'própria empresa')", async () => {
      await post("/v1/empresas", rhA)
        .send({ codigo: "EMPC", nome: "Empresa C" })
        .expect(403);
    });

    it("mutação sem CSRF é recusada", async () => {
      await agent()
        .post("/v1/departamentos")
        .set("Cookie", rhA.cookie)
        .send({ empresaId: empresaA, codigo: "SEMCSRF", nome: "Sem CSRF" })
        .expect(403);
    });

    it("sem sessão, tudo é 401", async () => {
      await agent().get("/v1/departamentos").expect(401);
    });
  });

  describe("integridade e inativação (R-INA-1..3, Baseline V1 item 7)", () => {
    let empresaC: string;
    let departamentoC: string;

    beforeAll(async () => {
      const empresa = await post("/v1/empresas", master)
        .send({ codigo: "EMPC", nome: "Empresa C" })
        .expect(201);
      empresaC = empresa.body.id;

      const departamento = await post("/v1/departamentos", master)
        .send({ empresaId: empresaC, codigo: "OPS", nome: "Operacoes" })
        .expect(201);
      departamentoC = departamento.body.id;
    });

    it("bloqueia inativação de departamento com área ativa — sem cascata", async () => {
      const area = await post("/v1/areas", master)
        .send({ departamentoId: departamentoC, codigo: "SUB", nome: "Sub" })
        .expect(201);

      await post(`/v1/departamentos/${departamentoC}/inativar`, master)
        .send()
        .expect(409);

      // A área continua ativa: nada foi inativado em cascata.
      const conferencia = await get(`/v1/areas/${area.body.id}`, master).expect(
        200,
      );
      expect(conferencia.body.status).toBe("ativo");

      // Inativando a área primeiro, o departamento passa a poder ser inativado.
      await post(`/v1/areas/${area.body.id}/inativar`, master)
        .send()
        .expect(201);
      await post(`/v1/departamentos/${departamentoC}/inativar`, master)
        .send()
        .expect(201);
    });

    it("bloqueia criação de filho sob pai inativo (R-INA-3)", async () => {
      await post("/v1/areas", master)
        .send({
          departamentoId: departamentoC,
          codigo: "TARDIA",
          nome: "Tardia",
        })
        .expect(422);
    });

    it("bloqueia inativação de empresa com filho ativo", async () => {
      await post("/v1/cargos", master)
        .send({ empresaId: empresaC, codigo: "OPER", nome: "Operador" })
        .expect(201);

      await post(`/v1/empresas/${empresaC}/inativar`, master)
        .send()
        .expect(409);
    });

    it("recusa inativar duas vezes", async () => {
      await post(`/v1/departamentos/${departamentoC}/inativar`, master)
        .send()
        .expect(409);
    });

    it("não permite alterar codigo nem empresa via PATCH", async () => {
      await patch(`/v1/departamentos/${departamentoC}`, master)
        .send({ nome: "Novo", codigo: "OUTRO" })
        .expect(400);
      await patch(`/v1/departamentos/${departamentoC}`, master)
        .send({ nome: "Novo", empresaId: empresaA })
        .expect(400);
    });
  });

  describe("reativação auditada (R-INA-5)", () => {
    let empresaD: string;
    let departamentoD: string;
    let areaD: string;

    beforeAll(async () => {
      const empresa = await post("/v1/empresas", master)
        .send({ codigo: "EMPD", nome: "Empresa D" })
        .expect(201);
      empresaD = empresa.body.id;

      const departamento = await post("/v1/departamentos", master)
        .send({ empresaId: empresaD, codigo: "LOG", nome: "Logistica" })
        .expect(201);
      departamentoD = departamento.body.id;

      const area = await post("/v1/areas", master)
        .send({
          departamentoId: departamentoD,
          codigo: "EXPED",
          nome: "Expedicao",
        })
        .expect(201);
      areaD = area.body.id;
    });

    it("reativa um nó inativo e volta o status para ativo", async () => {
      await post(`/v1/areas/${areaD}/inativar`, master).send().expect(201);
      const inativa = await get(`/v1/areas/${areaD}`, master).expect(200);
      expect(inativa.body.status).toBe("inativo");

      const reativada = await post(`/v1/areas/${areaD}/reativar`, master)
        .send()
        .expect(201);
      expect(reativada.body.status).toBe("ativo");
      // Não reclassifica: continua no mesmo departamento, com o mesmo código.
      expect(reativada.body.departamentoId).toBe(departamentoD);
      expect(reativada.body.codigo).toBe("EXPED");
    });

    it("gera o evento organizacao.area.reativada com o escopo correto", async () => {
      const prisma = new PrismaClient({ datasources: { db: { url: appUrl } } });
      try {
        const eventos = await prisma.auditEvent.findMany({
          where: { action: "organizacao_area_reativada", resourceId: areaD },
        });
        expect(eventos.length).toBeGreaterThanOrEqual(1);
        expect(eventos[0]?.resource).toBe("area");
        expect(eventos[0]?.result).toBe("success");
        // Escopo do evento é a empresa da entidade afetada.
        expect(eventos[0]?.companyId).toBe(empresaD);

        // O valor persistido segue a convenção aprovada em português.
        const [linha] = await prisma.$queryRawUnsafe<Array<{ action: string }>>(
          `SELECT action::text AS action FROM app.audit_event WHERE id = '${eventos[0]!.id}'`,
        );
        expect(linha?.action).toBe("organizacao.area.reativada");
      } finally {
        await prisma.$disconnect();
      }
    });

    it("recusa reativar o que já está ativo (409)", async () => {
      await post(`/v1/areas/${areaD}/reativar`, master).send().expect(409);
    });

    it("recusa reativar sob pai inativo (422) e não altera o filho", async () => {
      await post(`/v1/areas/${areaD}/inativar`, master).send().expect(201);
      await post(`/v1/departamentos/${departamentoD}/inativar`, master)
        .send()
        .expect(201);

      await post(`/v1/areas/${areaD}/reativar`, master).send().expect(422);

      const conferencia = await get(`/v1/areas/${areaD}`, master).expect(200);
      expect(conferencia.body.status).toBe("inativo");
    });

    it("reativado o pai, o filho volta a poder ser reativado", async () => {
      await post(`/v1/departamentos/${departamentoD}/reativar`, master)
        .send()
        .expect(201);
      await post(`/v1/areas/${areaD}/reativar`, master).send().expect(201);
    });

    it("reativar entidade de outra empresa responde 404", async () => {
      const departamentoB = await post("/v1/departamentos", rhB)
        .send({ empresaId: empresaB, codigo: "TMP", nome: "Temporario" })
        .expect(201);
      await post(`/v1/departamentos/${departamentoB.body.id}/inativar`, rhB)
        .send()
        .expect(201);

      // rhA não alcança entidade da empresa B — nem para reativar.
      await post(`/v1/departamentos/${departamentoB.body.id}/reativar`, rhA)
        .send()
        .expect(404);

      // E o objeto continua inativo: nada foi alterado pela tentativa.
      const conferencia = await get(
        `/v1/departamentos/${departamentoB.body.id}`,
        rhB,
      ).expect(200);
      expect(conferencia.body.status).toBe("inativo");
    });

    it("papel sem manage não reativa", async () => {
      // Cargo é folha: inativar não esbarra em R-INA-2, o que mantém este
      // teste focado só na autorização.
      const cargo = await post("/v1/cargos", master)
        .send({ empresaId: empresaD, codigo: "SEMMANAGE", nome: "Sem Manage" })
        .expect(201);
      await post(`/v1/cargos/${cargo.body.id}/inativar`, master)
        .send()
        .expect(201);

      await post(`/v1/cargos/${cargo.body.id}/reativar`, dpA)
        .send()
        .expect(403);
      await post(`/v1/cargos/${cargo.body.id}/reativar`, colaboradorA)
        .send()
        .expect(403);

      await post(`/v1/cargos/${cargo.body.id}/reativar`, master)
        .send()
        .expect(201);
    });

    it("reativação exige CSRF", async () => {
      const cargo = await post("/v1/cargos", master)
        .send({ empresaId: empresaD, codigo: "SEMCSRF2", nome: "Sem CSRF" })
        .expect(201);
      await post(`/v1/cargos/${cargo.body.id}/inativar`, master)
        .send()
        .expect(201);

      await agent()
        .post(`/v1/cargos/${cargo.body.id}/reativar`)
        .set("Cookie", master.cookie)
        .send()
        .expect(403);

      await post(`/v1/cargos/${cargo.body.id}/reativar`, master)
        .send()
        .expect(201);
    });

    it("reativação em cada uma das sete entidades", async () => {
      const unidade = await post("/v1/unidades-organizacionais", master)
        .send({ empresaId: empresaD, codigo: "FILIAL", nome: "Filial" })
        .expect(201);
      const equipe = await post("/v1/equipes", master)
        .send({
          departamentoId: departamentoD,
          unidadeOrganizacionalId: unidade.body.id,
          codigo: "TIME1",
          nome: "Time 1",
        })
        .expect(201);
      const cargo = await post("/v1/cargos", master)
        .send({ empresaId: empresaD, codigo: "AUX", nome: "Auxiliar" })
        .expect(201);
      const centroCusto = await post("/v1/centros-de-custo", master)
        .send({ empresaId: empresaD, codigo: "CC900", nome: "Centro 900" })
        .expect(201);

      // A ordem importa e é ela mesma uma prova de R-INA-2: inativa-se de
      // baixo para cima (equipe antes da unidade que ela referencia) e
      // reativa-se de cima para baixo (unidade antes da equipe). Fazer o
      // contrário é recusado pelo próprio serviço.
      const inativarNaOrdem: Array<[string, string]> = [
        ["equipes", equipe.body.id],
        ["unidades-organizacionais", unidade.body.id],
        ["areas", areaD],
        ["cargos", cargo.body.id],
        ["centros-de-custo", centroCusto.body.id],
      ];
      for (const [recurso, id] of inativarNaOrdem) {
        await post(`/v1/${recurso}/${id}/inativar`, master).send().expect(201);
      }

      const reativarNaOrdem = [...inativarNaOrdem].reverse();
      for (const [recurso, id] of reativarNaOrdem) {
        const reativado = await post(`/v1/${recurso}/${id}/reativar`, master)
          .send()
          .expect(201);
        expect(reativado.body.status).toBe("ativo");
      }

      // Empresa fecha a lista das sete: sem pai a validar.
      const empresaE = await post("/v1/empresas", master)
        .send({ codigo: "EMPE", nome: "Empresa E" })
        .expect(201);
      await post(`/v1/empresas/${empresaE.body.id}/inativar`, master)
        .send()
        .expect(201);
      const empresaReativada = await post(
        `/v1/empresas/${empresaE.body.id}/reativar`,
        master,
      )
        .send()
        .expect(201);
      expect(empresaReativada.body.status).toBe("ativo");
    });

    it("equipe só reativa se departamento E unidade estiverem ativos", async () => {
      const unidade = await post("/v1/unidades-organizacionais", master)
        .send({ empresaId: empresaD, codigo: "FILIAL2", nome: "Filial 2" })
        .expect(201);
      const equipe = await post("/v1/equipes", master)
        .send({
          departamentoId: departamentoD,
          unidadeOrganizacionalId: unidade.body.id,
          codigo: "TIME2",
          nome: "Time 2",
        })
        .expect(201);

      await post(`/v1/equipes/${equipe.body.id}/inativar`, master)
        .send()
        .expect(201);
      await post(
        `/v1/unidades-organizacionais/${unidade.body.id}/inativar`,
        master,
      )
        .send()
        .expect(201);

      // Departamento ativo, unidade inativa: recusado.
      await post(`/v1/equipes/${equipe.body.id}/reativar`, master)
        .send()
        .expect(422);

      await post(
        `/v1/unidades-organizacionais/${unidade.body.id}/reativar`,
        master,
      )
        .send()
        .expect(201);
      await post(`/v1/equipes/${equipe.body.id}/reativar`, master)
        .send()
        .expect(201);
    });

    it("INSERT revogado em audit_event impede a reativação (atomicidade)", async () => {
      const cargo = await post("/v1/cargos", master)
        .send({ empresaId: empresaD, codigo: "ROLLBK2", nome: "Rollback 2" })
        .expect(201);
      await post(`/v1/cargos/${cargo.body.id}/inativar`, master)
        .send()
        .expect(201);

      const migrator = new PrismaClient({
        datasources: { db: { url: migratorUrl } },
      });
      try {
        await migrator.$executeRawUnsafe(
          "REVOKE INSERT ON TABLE app.audit_event FROM evolli_app",
        );
        await post(`/v1/cargos/${cargo.body.id}/reativar`, master)
          .send()
          .expect(500);
      } finally {
        await migrator.$executeRawUnsafe(
          "GRANT INSERT ON TABLE app.audit_event TO evolli_app",
        );
        await migrator.$disconnect();
      }

      // A reativação não persistiu: o cargo continua inativo.
      const conferencia = await get(
        `/v1/cargos/${cargo.body.id}`,
        master,
      ).expect(200);
      expect(conferencia.body.status).toBe("inativo");
    });

    it("reativação não é exclusão física disfarçada: nenhuma linha some", async () => {
      const prisma = new PrismaClient({ datasources: { db: { url: appUrl } } });
      try {
        const area = await prisma.area.findUnique({ where: { id: areaD } });
        expect(area).not.toBeNull();
      } finally {
        await prisma.$disconnect();
      }

      await agent()
        .delete(`/v1/areas/${areaD}/reativar`)
        .set("Cookie", master.cookie)
        .set("x-csrf-token", master.csrfToken)
        .expect(404);
    });
  });

  describe("ausência de exclusão física (spec R6)", () => {
    it("nenhuma rota DELETE existe em entidade organizacional", async () => {
      for (const rota of [
        `/v1/empresas/${empresaA}`,
        "/v1/unidades-organizacionais",
        "/v1/departamentos",
        "/v1/areas",
        "/v1/equipes",
        "/v1/cargos",
        "/v1/centros-de-custo",
      ]) {
        await agent()
          .delete(rota)
          .set("Cookie", master.cookie)
          .set("x-csrf-token", master.csrfToken)
          .expect(404);
      }
    });
  });

  describe("garantia de banco: FK composta impede referência cruzando empresa (R5)", () => {
    it("evolli_app não consegue inserir equipe com departamento de outra empresa", async () => {
      const prisma = new PrismaClient({ datasources: { db: { url: appUrl } } });
      try {
        const departamentoB = await prisma.departamento.findFirstOrThrow({
          where: { empresaId: empresaB },
        });

        // Contorna deliberadamente a validação de aplicação para provar que a
        // restrição existe no banco, não apenas no service.
        await expect(
          prisma.$executeRawUnsafe(
            `INSERT INTO app.equipe (id, empresa_id, departamento_id, codigo, nome, status, criado_em, atualizado_em)
             VALUES ('11111111-1111-1111-1111-111111111111', '${empresaA}', '${departamentoB.id}', 'FRAUDE', 'Fraude', 'ativo', NOW(), NOW())`,
          ),
        ).rejects.toThrow();
      } finally {
        await prisma.$disconnect();
      }
    });
  });

  describe("atomicidade real: falha da auditoria impede a mutação (ADR 0004 §2)", () => {
    async function comAuditoriaBloqueada<T>(fn: () => Promise<T>): Promise<T> {
      const migrator = new PrismaClient({
        datasources: { db: { url: migratorUrl } },
      });
      try {
        await migrator.$executeRawUnsafe(
          "REVOKE INSERT ON TABLE app.audit_event FROM evolli_app",
        );
        return await fn();
      } finally {
        await migrator.$executeRawUnsafe(
          "GRANT INSERT ON TABLE app.audit_event TO evolli_app",
        );
        await migrator.$disconnect();
      }
    }

    it("criação não persiste quando o evento não pode ser gravado", async () => {
      await comAuditoriaBloqueada(async () => {
        await post("/v1/cargos", rhA)
          .send({ empresaId: empresaA, codigo: "ROLLBACK", nome: "Rollback" })
          .expect(500);
      });

      const prisma = new PrismaClient({ datasources: { db: { url: appUrl } } });
      try {
        const cargo = await prisma.cargo.findFirst({
          where: { codigo: "ROLLBACK" },
        });
        expect(cargo).toBeNull();
      } finally {
        await prisma.$disconnect();
      }
    });

    it("inativação não persiste quando o evento não pode ser gravado", async () => {
      const criado = await post("/v1/cargos", rhA)
        .send({ empresaId: empresaA, codigo: "ATOMICO", nome: "Atomico" })
        .expect(201);

      await comAuditoriaBloqueada(async () => {
        await post(`/v1/cargos/${criado.body.id}/inativar`, rhA)
          .send()
          .expect(500);
      });

      const conferencia = await get(`/v1/cargos/${criado.body.id}`, rhA).expect(
        200,
      );
      expect(conferencia.body.status).toBe("ativo");
    });

    it("consulta de escopo amplo não retorna 200 sem o evento correspondente", async () => {
      await comAuditoriaBloqueada(async () => {
        // Ator de escopo global: a consulta é auditada de forma fail-safe.
        await get("/v1/departamentos", master).expect(500);
        // Ator escopado não gera evento de consulta e segue respondendo.
        await get("/v1/departamentos", rhA).expect(200);
      });
    });
  });

  describe("privilégios de banco preservados", () => {
    let appClient: PrismaClient;

    beforeAll(() => {
      appClient = new PrismaClient({ datasources: { db: { url: appUrl } } });
    });

    afterAll(async () => {
      await appClient.$disconnect();
    });

    it("evolli_app não tem DDL: criar tabela falha", async () => {
      await expect(
        appClient.$executeRawUnsafe("CREATE TABLE app.tentativa_ddl (id TEXT)"),
      ).rejects.toThrow();
    });

    it("evolli_app não altera nem apaga a trilha de auditoria", async () => {
      await expect(
        appClient.$executeRawUnsafe(
          "UPDATE app.audit_event SET result = 'success'",
        ),
      ).rejects.toThrow();
      await expect(
        appClient.$executeRawUnsafe("DELETE FROM app.audit_event"),
      ).rejects.toThrow();
    });

    it("evolli_app faz DML normal nas tabelas organizacionais", async () => {
      // Diferente de audit_event, os nós organizacionais são mutáveis: a
      // proibição de exclusão física vem da ausência de rota, não de
      // privilégio, porque inativar exige UPDATE.
      const total = await appClient.empresa.count();
      expect(total).toBeGreaterThan(0);
    });
  });

  describe("minimização: nenhum segredo na trilha nem na resposta", () => {
    it("eventos organizacionais não carregam valor antes/depois nem segredo", async () => {
      const prisma = new PrismaClient({ datasources: { db: { url: appUrl } } });
      try {
        const eventos = await prisma.auditEvent.findMany({
          where: { resource: { in: ["departamento", "cargo", "empresa"] } },
          take: 50,
        });
        expect(eventos.length).toBeGreaterThan(0);
        for (const evento of eventos) {
          const serializado = JSON.stringify(evento).toLowerCase();
          for (const proibido of [
            "password",
            "senha",
            "token",
            "cookie",
            "csrf",
            SENHA_PADRAO.toLowerCase(),
          ]) {
            expect(serializado).not.toContain(proibido);
          }
        }
      } finally {
        await prisma.$disconnect();
      }
    });

    it("erro não vaza detalhe interno", async () => {
      const resposta = await get(
        "/v1/departamentos/00000000-0000-0000-0000-000000000000",
        rhA,
      ).expect(404);
      expect(Object.keys(resposta.body).sort()).toEqual([
        "message",
        "request_id",
        "status_code",
        "timestamp",
      ]);
      expect(JSON.stringify(resposta.body)).not.toMatch(/prisma|sql|select/i);
    });
  });
});
