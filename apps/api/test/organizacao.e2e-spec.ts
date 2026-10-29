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

    it("atualiza o nome do cargo e confirma código imutável (listar → criar → editar → reler)", async () => {
      const criado = await post("/v1/cargos", rhA)
        .send({ empresaId: empresaA, codigo: "COORD", nome: "Coordenador" })
        .expect(201);
      const cargoId = criado.body.id as string;
      expect(criado.body.codigo).toBe("COORD");

      const atualizado = await patch(`/v1/cargos/${cargoId}`, rhA)
        .send({ nome: "Coordenador Pleno" })
        .expect(200);
      expect(atualizado.body.nome).toBe("Coordenador Pleno");
      expect(atualizado.body.codigo).toBe("COORD");

      const releitura = await get(`/v1/cargos/${cargoId}`, rhA).expect(200);
      expect(releitura.body.nome).toBe("Coordenador Pleno");
      expect(releitura.body.codigo).toBe("COORD");

      const lista = await get("/v1/cargos", rhA).expect(200);
      const ids = (lista.body.itens as Array<{ id: string }>).map((c) => c.id);
      expect(ids).toContain(cargoId);
    });

    it("PATCH de cargo de outra empresa responde 404 (isolamento IDOR)", async () => {
      const criado = await post("/v1/cargos", rhA)
        .send({ empresaId: empresaA, codigo: "IDOR_CARGO", nome: "Alvo IDOR" })
        .expect(201);
      const cargoId = criado.body.id as string;

      await patch(`/v1/cargos/${cargoId}`, rhB)
        .send({ nome: "Sequestrado" })
        .expect(404);
    });

    it("departamento: listar → criar → editar → reler (fluxo CRUD autocontido)", async () => {
      const novo = await post("/v1/departamentos", rhA)
        .send({ empresaId: empresaA, codigo: "MKTG", nome: "Marketing" })
        .expect(201);
      const novoId = novo.body.id as string;
      expect(novo.body.codigo).toBe("MKTG");
      expect(novo.body.nome).toBe("Marketing");
      expect(novo.body.empresaId).toBe(empresaA);

      const lista = await get("/v1/departamentos", rhA).expect(200);
      const ids = (lista.body.itens as Array<{ id: string }>).map((d) => d.id);
      expect(ids).toContain(novoId);

      const editado = await patch(`/v1/departamentos/${novoId}`, rhA)
        .send({ nome: "Marketing e Comunicação" })
        .expect(200);
      expect(editado.body.nome).toBe("Marketing e Comunicação");
      expect(editado.body.codigo).toBe("MKTG");

      const releitura = await get(`/v1/departamentos/${novoId}`, rhA).expect(
        200,
      );
      expect(releitura.body.nome).toBe("Marketing e Comunicação");
      expect(releitura.body.codigo).toBe("MKTG");
      expect(releitura.body.empresaId).toBe(empresaA);
    });

    it("IDOR: PATCH de departamento de outra empresa responde 404", async () => {
      const criado = await post("/v1/departamentos", rhA)
        .send({
          empresaId: empresaA,
          codigo: "IDOR_DEP",
          nome: "Alvo IDOR Dep",
        })
        .expect(201);
      const depId = criado.body.id as string;

      await patch(`/v1/departamentos/${depId}`, rhB)
        .send({ nome: "Sequestrado" })
        .expect(404);
    });

    it("area: listar → criar → editar → reler (fluxo CRUD autocontido)", async () => {
      const depResp = await post("/v1/departamentos", rhA)
        .send({
          empresaId: empresaA,
          codigo: "AREA_T107",
          nome: "Dep para Area T107",
        })
        .expect(201);
      const depIdArea = depResp.body.id as string;

      const nova = await post("/v1/areas", rhA)
        .send({
          departamentoId: depIdArea,
          codigo: "CTRL",
          nome: "Controladoria",
        })
        .expect(201);
      const areaId = nova.body.id as string;
      expect(nova.body.codigo).toBe("CTRL");
      expect(nova.body.nome).toBe("Controladoria");
      expect(nova.body.departamentoId).toBe(depIdArea);
      expect(nova.body).not.toHaveProperty("empresaId");

      const lista = await get("/v1/areas", rhA).expect(200);
      const ids = (lista.body.itens as Array<{ id: string }>).map((a) => a.id);
      expect(ids).toContain(areaId);

      const editada = await patch(`/v1/areas/${areaId}`, rhA)
        .send({ nome: "Controladoria e Compliance" })
        .expect(200);
      expect(editada.body.nome).toBe("Controladoria e Compliance");
      expect(editada.body.codigo).toBe("CTRL");
      expect(editada.body.departamentoId).toBe(depIdArea);

      const releitura = await get(`/v1/areas/${areaId}`, rhA).expect(200);
      expect(releitura.body.nome).toBe("Controladoria e Compliance");
      expect(releitura.body.codigo).toBe("CTRL");
      expect(releitura.body.departamentoId).toBe(depIdArea);
    });

    it("IDOR: PATCH de área de outra empresa responde 404", async () => {
      const depResp = await post("/v1/departamentos", rhA)
        .send({
          empresaId: empresaA,
          codigo: "IDOR_AREA_D",
          nome: "Dep IDOR Area",
        })
        .expect(201);
      const criada = await post("/v1/areas", rhA)
        .send({
          departamentoId: depResp.body.id as string,
          codigo: "IDOR_AREA",
          nome: "Alvo IDOR Area",
        })
        .expect(201);

      await patch(`/v1/areas/${criada.body.id as string}`, rhB)
        .send({ nome: "Sequestrado" })
        .expect(404);
    });

    it("equipe: CRUD completo com imutabilidade de código, departamentoId e unidadeOrganizacionalId (T108)", async () => {
      const depResp = await post("/v1/departamentos", rhA)
        .send({
          empresaId: empresaA,
          codigo: "T108_DEP",
          nome: "Dep T108",
        })
        .expect(201);
      const depId = depResp.body.id as string;

      const unidResp = await post("/v1/unidades-organizacionais", rhA)
        .send({ empresaId: empresaA, codigo: "T108_UNID", nome: "Unid T108" })
        .expect(201);
      const unidId = unidResp.body.id as string;

      // Criar sem unidade
      const semUnidade = await post("/v1/equipes", rhA)
        .send({
          departamentoId: depId,
          codigo: "T108_EQ1",
          nome: "Equipe Sem Unidade",
        })
        .expect(201);
      expect(semUnidade.body.codigo).toBe("T108_EQ1");
      expect(semUnidade.body.departamentoId).toBe(depId);
      expect(semUnidade.body.unidadeOrganizacionalId).toBeNull();
      expect(semUnidade.body.empresaId).toBe(empresaA);

      // Criar com unidade
      const comUnidade = await post("/v1/equipes", rhA)
        .send({
          departamentoId: depId,
          unidadeOrganizacionalId: unidId,
          codigo: "T108_EQ2",
          nome: "Equipe Com Unidade",
        })
        .expect(201);
      expect(comUnidade.body.unidadeOrganizacionalId).toBe(unidId);

      // Editar somente o nome
      const equipeId = semUnidade.body.id as string;
      const editada = await patch(`/v1/equipes/${equipeId}`, rhA)
        .send({ nome: "Equipe Sem Unidade Editada" })
        .expect(200);
      expect(editada.body.nome).toBe("Equipe Sem Unidade Editada");
      expect(editada.body.codigo).toBe("T108_EQ1");
      expect(editada.body.departamentoId).toBe(depId);
      expect(editada.body.unidadeOrganizacionalId).toBeNull();

      // Reler confirma imutabilidade
      const releitura = await get(`/v1/equipes/${equipeId}`, rhA).expect(200);
      expect(releitura.body.codigo).toBe("T108_EQ1");
      expect(releitura.body.departamentoId).toBe(depId);
      expect(releitura.body.unidadeOrganizacionalId).toBeNull();
    });

    it("IDOR: PATCH de equipe de outra empresa responde 404 (T108)", async () => {
      const depResp = await post("/v1/departamentos", rhA)
        .send({
          empresaId: empresaA,
          codigo: "IDOR_EQ_D",
          nome: "Dep IDOR Equipe",
        })
        .expect(201);
      const criada = await post("/v1/equipes", rhA)
        .send({
          departamentoId: depResp.body.id as string,
          codigo: "IDOR_EQ",
          nome: "Alvo IDOR Equipe",
        })
        .expect(201);

      await patch(`/v1/equipes/${criada.body.id as string}`, rhB)
        .send({ nome: "Sequestrado" })
        .expect(404);
    });

    it("centro de custo: CRUD completo com imutabilidade de código e empresaId (T109)", async () => {
      const criado = await post("/v1/centros-de-custo", rhA)
        .send({ empresaId: empresaA, codigo: "CC_T109", nome: "Centro T109" })
        .expect(201);
      const ccId = criado.body.id as string;
      expect(criado.body.codigo).toBe("CC_T109");
      expect(criado.body.nome).toBe("Centro T109");
      expect(criado.body.empresaId).toBe(empresaA);

      const lista = await get("/v1/centros-de-custo", rhA).expect(200);
      const ids = (lista.body.itens as Array<{ id: string }>).map((c) => c.id);
      expect(ids).toContain(ccId);

      const editado = await patch(`/v1/centros-de-custo/${ccId}`, rhA)
        .send({ nome: "Centro T109 Editado" })
        .expect(200);
      expect(editado.body.nome).toBe("Centro T109 Editado");
      expect(editado.body.codigo).toBe("CC_T109");
      expect(editado.body.empresaId).toBe(empresaA);

      const releitura = await get(`/v1/centros-de-custo/${ccId}`, rhA).expect(
        200,
      );
      expect(releitura.body.nome).toBe("Centro T109 Editado");
      expect(releitura.body.codigo).toBe("CC_T109");
      expect(releitura.body.empresaId).toBe(empresaA);
    });

    it("IDOR: PATCH de centro de custo de outra empresa responde 404 (T109)", async () => {
      const criado = await post("/v1/centros-de-custo", rhA)
        .send({
          empresaId: empresaA,
          codigo: "IDOR_CC",
          nome: "Alvo IDOR CC",
        })
        .expect(201);

      await patch(`/v1/centros-de-custo/${criado.body.id as string}`, rhB)
        .send({ nome: "Sequestrado" })
        .expect(404);
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
  // -------------------------------------------------------------------------
  // T196 — busca por código ou nome nas referências da lotação (Departamento,
  // Cargo, Unidade e Centro de custo). Empresa própria, com MAIS de 100
  // referências ativas em cada rota, para provar que a busca alcança o que a
  // página máxima (100) não alcança; termos e valores sintéticos.
  // -------------------------------------------------------------------------
  describe("T196 — busca nas referências da lotação", () => {
    const REFERENCIAS = [
      {
        rota: "/v1/departamentos",
        modelo: "departamento",
        recurso: "departamento",
      },
      { rota: "/v1/cargos", modelo: "cargo", recurso: "cargo" },
      {
        rota: "/v1/unidades-organizacionais",
        modelo: "unidadeOrganizacional",
        recurso: "unidade_organizacional",
      },
      {
        rota: "/v1/centros-de-custo",
        modelo: "centroCusto",
        recurso: "centro_custo",
      },
    ] as const;
    /** Nome do 115º item, fora do alcance da página máxima. */
    const NOME_PROFUNDO = "Alvo Profundo Sintetico";
    const TOTAL_ATIVOS = 120;

    let empresaC: string;
    let rhC: Credencial;
    let dpC: Credencial;
    let financeiroC: Credencial;

    const codigo = (i: number) => `R${String(i).padStart(3, "0")}`;

    type Modelo = (typeof REFERENCIAS)[number]["modelo"];
    async function semear(prisma: PrismaClient, modelo: Modelo) {
      const delegado = prisma[modelo] as unknown as {
        createMany: (args: { data: object[] }) => Promise<unknown>;
      };
      await delegado.createMany({
        data: [
          ...Array.from({ length: TOTAL_ATIVOS }, (_, k) => ({
            empresaId: empresaC,
            codigo: codigo(k + 1),
            nome:
              k + 1 === 115 ? NOME_PROFUNDO : `Referencia sintetica ${k + 1}`,
          })),
          {
            empresaId: empresaC,
            codigo: "INATIVA_ALVO",
            nome: "Alvo Profundo Inativo",
            status: "inativo",
          },
          // A outra empresa tem uma referência com o MESMO nome.
          { empresaId: empresaB, codigo: "B_ALVO", nome: NOME_PROFUNDO },
        ],
      });
    }

    async function listar(
      rota: string,
      cred: Credencial,
      query: Record<string, string | number>,
    ) {
      const qs = new URLSearchParams(
        Object.entries(query).map(([k, v]): [string, string] => [k, String(v)]),
      ).toString();
      return (await get(`${rota}?${qs}`, cred).expect(200)).body as {
        itens: {
          codigo: string;
          nome: string;
          empresaId: string;
          status: string;
        }[];
        total: number;
        pagina: number;
        tamanhoPagina: number;
      };
    }

    beforeAll(async () => {
      empresaC = (
        await post("/v1/empresas", master)
          .send({ codigo: "T196C", nome: "Empresa Busca" })
          .expect(201)
      ).body.id as string;
      rhC = await criarUsuario("rh.c@example.test", "rh", empresaC);
      dpC = await criarUsuario("dp.c@example.test", "dp", empresaC);
      financeiroC = await criarUsuario(
        "fin.c@example.test",
        "financeiro",
        empresaC,
      );
      const prisma = new PrismaClient({ datasources: { db: { url: appUrl } } });
      try {
        for (const { modelo } of REFERENCIAS) await semear(prisma, modelo);
      } finally {
        await prisma.$disconnect();
      }
    });

    describe.each(REFERENCIAS)("$rota", ({ rota }) => {
      it("a página máxima (100) não alcança o 115º; a busca pelo nome, sem diferenciar maiúsculas, o encontra", async () => {
        const pagina = await listar(rota, rhC, {
          status: "ativo",
          tamanhoPagina: 100,
        });
        expect(pagina.total).toBe(TOTAL_ATIVOS);
        expect(pagina.itens).toHaveLength(100);
        expect(pagina.itens.map((i) => i.codigo)).not.toContain(codigo(115));

        const achado = await listar(rota, rhC, {
          status: "ativo",
          busca: "alvo PROFUNDO",
        });
        expect(achado.total).toBe(1);
        expect(achado.itens.map((i) => [i.codigo, i.empresaId])).toEqual([
          [codigo(115), empresaC],
        ]);
      });

      it("busca por parte do código, sem diferenciar maiúsculas, na ordem do código", async () => {
        const r = await listar(rota, rhC, { busca: "r11", tamanhoPagina: 20 });
        expect(r.total).toBe(10);
        expect(r.itens.map((i) => i.codigo)).toEqual(
          Array.from({ length: 10 }, (_, k) => codigo(110 + k)),
        );
      });

      it("a busca vem antes da paginação: total filtrado e páginas de 20", async () => {
        const p1 = await listar(rota, rhC, {
          status: "ativo",
          busca: "referencia sintetica",
          tamanhoPagina: 20,
        });
        const p2 = await listar(rota, rhC, {
          status: "ativo",
          busca: "referencia sintetica",
          tamanhoPagina: 20,
          pagina: 2,
        });
        expect(p1.total).toBe(TOTAL_ATIVOS - 1);
        expect(p2.total).toBe(TOTAL_ATIVOS - 1);
        expect(p1.itens.map((i) => i.codigo)).toEqual(
          Array.from({ length: 20 }, (_, k) => codigo(k + 1)),
        );
        expect(p2.itens.map((i) => i.codigo)).toEqual(
          Array.from({ length: 20 }, (_, k) => codigo(k + 21)),
        );
      });

      it("situação segue valendo: inativa só aparece sem o filtro de ativos", async () => {
        expect(
          (await listar(rota, rhC, { status: "ativo", busca: "alvo profundo" }))
            .total,
        ).toBe(1);
        const todos = await listar(rota, rhC, { busca: "alvo profundo" });
        expect(todos.itens.map((i) => i.codigo).sort()).toEqual(
          ["INATIVA_ALVO", codigo(115)].sort(),
        );
      });

      it("termo vazio ou só de espaços é o mesmo que nenhum; curingas não ampliam", async () => {
        const sem = await listar(rota, rhC, {});
        expect((await listar(rota, rhC, { busca: "" })).total).toBe(sem.total);
        expect((await listar(rota, rhC, { busca: "   " })).total).toBe(
          sem.total,
        );
        expect((await listar(rota, rhC, { busca: "%" })).total).toBe(0);
        // "_" vale literalmente: só o código que TEM sublinhado, não todos.
        const sublinhado = await listar(rota, rhC, { busca: "_" });
        expect(sublinhado.itens.map((i) => i.codigo)).toEqual(["INATIVA_ALVO"]);
      });

      it("isolamento: cada empresa só encontra a própria referência, mesmo com o mesmo nome", async () => {
        const b = await listar(rota, rhB, { busca: "alvo profundo" });
        expect(b.itens.map((i) => [i.codigo, i.empresaId])).toEqual([
          ["B_ALVO", empresaB],
        ]);
        const c = await listar(rota, rhC, { busca: "b_alvo" });
        expect(c.total).toBe(0);
        // Pedir a outra empresa pelo filtro: página vazia, nunca a dela.
        const outra = await listar(rota, rhC, {
          empresaId: empresaB,
          busca: "alvo profundo",
        });
        expect(outra).toMatchObject({ itens: [], total: 0 });
      });

      it("termo longo demais ou com caractere de controle: 400, sem repetir o termo", async () => {
        const longo = `${"x".repeat(150)}TERMO-RECUSADO`;
        const r1 = await get(`${rota}?busca=${longo}`, rhC).expect(400);
        expect(JSON.stringify(r1.body)).not.toContain("TERMO-RECUSADO");
        const r2 = await get(
          `${rota}?busca=${encodeURIComponent("ab\u0007CONTROLE")}`,
          rhC,
        ).expect(400);
        expect(JSON.stringify(r2.body)).not.toContain("CONTROLE");
      });

      it("DP lê e busca na própria empresa; colaborador é negado", async () => {
        const r = await listar(rota, dpC, {
          busca: "alvo profundo",
          status: "ativo",
        });
        expect(r.itens.map((i) => i.codigo)).toEqual([codigo(115)]);
        await get(`${rota}?busca=alvo`, colaboradorA).expect(403);
      });
    });

    it("financeiro busca só em Centro de custo; as outras três seguem negadas", async () => {
      const r = await listar("/v1/centros-de-custo", financeiroC, {
        busca: "alvo profundo",
        status: "ativo",
      });
      expect(r.itens.map((i) => i.codigo)).toEqual([codigo(115)]);
      for (const rota of [
        "/v1/departamentos",
        "/v1/cargos",
        "/v1/unidades-organizacionais",
      ]) {
        await get(`${rota}?busca=alvo`, financeiroC).expect(403);
      }
    });

    it("master global: encontra nas duas empresas, a consulta é auditada como sempre e o termo não vai para a trilha", async () => {
      const termo = "alvo profundo sintetico";
      const prisma = new PrismaClient({ datasources: { db: { url: appUrl } } });
      try {
        const antes = new Date();
        for (const { rota, recurso } of REFERENCIAS) {
          const r = await listar(rota, master, {
            busca: termo,
            status: "ativo",
          });
          expect(r.itens.map((i) => i.empresaId).sort()).toEqual(
            [empresaB, empresaC].sort(),
          );
          const eventos = await prisma.auditEvent.findMany({
            where: {
              action: "organizacao_estrutura_consultada",
              resource: recurso,
              createdAt: { gte: antes },
            },
          });
          expect(eventos.length).toBeGreaterThanOrEqual(1);
        }
        const trilha = await prisma.auditEvent.findMany({
          where: { createdAt: { gte: antes } },
        });
        expect(JSON.stringify(trilha).toLowerCase()).not.toContain(
          "alvo profundo",
        );
      } finally {
        await prisma.$disconnect();
      }
    });
  });

  // -------------------------------------------------------------------------
  // T197 — criação inline (sem código) das referências da lotação: o servidor
  // gera o código, recusa nome repetido na empresa e serializa pedidos iguais.
  // Empresa própria; nomes e códigos sintéticos.
  // -------------------------------------------------------------------------
  describe("T197 — criação com código gerado no servidor", () => {
    const TIPOS = [
      {
        rota: "/v1/departamentos",
        modelo: "departamento",
        acao: "organizacao_departamento_criado",
        prefixo: "DEP",
      },
      {
        rota: "/v1/cargos",
        modelo: "cargo",
        acao: "organizacao_cargo_criado",
        prefixo: "CAR",
      },
      {
        rota: "/v1/unidades-organizacionais",
        modelo: "unidadeOrganizacional",
        acao: "organizacao_unidade_organizacional_criada",
        prefixo: "UNI",
      },
      {
        rota: "/v1/centros-de-custo",
        modelo: "centroCusto",
        acao: "organizacao_centro_custo_criado",
        prefixo: "CC",
      },
    ] as const;
    type Modelo = (typeof TIPOS)[number]["modelo"];

    let empresaD: string;
    let rhD: Credencial;
    let dpD: Credencial;
    let financeiroD: Credencial;
    let prisma: PrismaClient;

    interface Delegado {
      count: (args: { where: object }) => Promise<number>;
      findMany: (args: {
        where: object;
      }) => Promise<
        { id: string; codigo: string; nome: string; status: string }[]
      >;
      createMany: (args: { data: object[] }) => Promise<unknown>;
    }
    const delegado = (modelo: Modelo) => prisma[modelo] as unknown as Delegado;
    const contarNome = (modelo: Modelo, empresaId: string, nome: string) =>
      delegado(modelo).count({ where: { empresaId, nome } });

    beforeAll(async () => {
      empresaD = (
        await post("/v1/empresas", master)
          .send({ codigo: "T197D", nome: "Empresa Criacao Inline" })
          .expect(201)
      ).body.id as string;
      rhD = await criarUsuario("rh.d@example.test", "rh", empresaD);
      dpD = await criarUsuario("dp.d@example.test", "dp", empresaD);
      financeiroD = await criarUsuario(
        "fin.d@example.test",
        "financeiro",
        empresaD,
      );
      prisma = new PrismaClient({ datasources: { db: { url: appUrl } } });
    });

    afterAll(async () => {
      await prisma.$disconnect();
    });

    describe.each(TIPOS)("$rota", ({ rota, modelo, acao, prefixo }) => {
      it("RH cria sem código: nome normalizado, código ASCII em maiúsculas, auditoria só com ids", async () => {
        const antes = new Date();
        const r = await post(rota, rhD)
          .send({ empresaId: empresaD, nome: "  Ação   Fiscal Sintética " })
          .expect(201);
        expect(r.body).toMatchObject({
          empresaId: empresaD,
          nome: "Ação Fiscal Sintética",
          codigo: "ACAO_FISCAL_SINTETICA",
          status: "ativo",
        });
        const eventos = await prisma.auditEvent.findMany({
          where: { resourceId: r.body.id as string },
        });
        expect(eventos).toHaveLength(1);
        expect(eventos[0]).toMatchObject({
          action: acao,
          companyId: empresaD,
          result: "success",
        });
        const trilha = JSON.stringify(
          await prisma.auditEvent.findMany({
            where: { createdAt: { gte: antes } },
          }),
        ).toLowerCase();
        expect(trilha).not.toContain("fiscal sint");
        expect(trilha).not.toContain("acao_fiscal");
      });

      it("mesmo nome (maiúsculas e espaços diferentes): 409 nome_em_uso com a existente, sem criar", async () => {
        const r = await post(rota, rhD)
          .send({ empresaId: empresaD, nome: "AÇÃO fiscal   sintética" })
          .expect(409);
        expect(r.body).toMatchObject({
          codigo: "nome_em_uso",
          referencia: {
            codigo: "ACAO_FISCAL_SINTETICA",
            nome: "Ação Fiscal Sintética",
          },
        });
        expect(Object.keys(r.body.referencia as object).sort()).toEqual([
          "codigo",
          "id",
          "nome",
        ]);
        expect(
          await contarNome(modelo, empresaD, "Ação Fiscal Sintética"),
        ).toBe(1);
      });

      it("nome diferente com o mesmo código-base: sufixo _2", async () => {
        const r = await post(rota, rhD)
          .send({ empresaId: empresaD, nome: "Acao Fiscal Sintetica" })
          .expect(201);
        expect(r.body.codigo).toBe("ACAO_FISCAL_SINTETICA_2");
      });

      it("nome só com símbolos: prefixo do tipo, e depois _2", async () => {
        const a = await post(rota, rhD)
          .send({ empresaId: empresaD, nome: "!!!" })
          .expect(201);
        const b = await post(rota, rhD)
          .send({ empresaId: empresaD, nome: "???" })
          .expect(201);
        expect([a.body.codigo, b.body.codigo]).toEqual([
          prefixo,
          `${prefixo}_2`,
        ]);
      });

      it("só existe inativa com o nome: 409 nome_inativo, sem reativar nem criar", async () => {
        await delegado(modelo).createMany({
          data: [
            {
              empresaId: empresaD,
              codigo: "INATIVA_T197",
              nome: "Inativa Sintetica",
              status: "inativo",
            },
          ],
        });
        const r = await post(rota, rhD)
          .send({ empresaId: empresaD, nome: "inativa sintetica" })
          .expect(409);
        expect(r.body).toMatchObject({ codigo: "nome_inativo" });
        expect(r.body).not.toHaveProperty("referencia");
        const todas = await delegado(modelo).findMany({
          where: { empresaId: empresaD, codigo: "INATIVA_T197" },
        });
        expect(todas.map((t) => t.status)).toEqual(["inativo"]);
        expect(
          await delegado(modelo).count({
            where: {
              empresaId: empresaD,
              nome: { equals: "inativa sintetica", mode: "insensitive" },
            },
          }),
        ).toBe(1);
      });

      it("os 50 códigos possíveis ocupados: 409 codigo_indisponivel, sem criar", async () => {
        await delegado(modelo).createMany({
          data: Array.from({ length: 50 }, (_, k) => ({
            empresaId: empresaD,
            codigo: k === 0 ? "LOTADO" : `LOTADO_${k + 1}`,
            nome: `Ocupante ${k + 1}`,
          })),
        });
        const r = await post(rota, rhD)
          .send({ empresaId: empresaD, nome: "Lotado" })
          .expect(409);
        expect(r.body).toMatchObject({ codigo: "codigo_indisponivel" });
        expect(await contarNome(modelo, empresaD, "Lotado")).toBe(0);
      });

      it("dois pedidos simultâneos com o mesmo nome: um registro só", async () => {
        const respostas = await Promise.all(
          [0, 1].map(() =>
            post(rota, rhD).send({
              empresaId: empresaD,
              nome: "Concorrente Sintetico",
            }),
          ),
        );
        expect(respostas.map((r) => r.status).sort()).toEqual([201, 409]);
        const recusa = respostas.find((r) => r.status === 409)!;
        const criada = respostas.find((r) => r.status === 201)!;
        expect(recusa.body).toMatchObject({
          codigo: "nome_em_uso",
          referencia: { id: criada.body.id },
        });
        expect(
          await contarNome(modelo, empresaD, "Concorrente Sintetico"),
        ).toBe(1);
      });

      it("nomes diferentes que geram o mesmo código, ao mesmo tempo: dois registros com códigos distintos", async () => {
        const respostas = await Promise.all(
          ["Paralelo Único", "Paralelo Unico"].map((nome) =>
            post(rota, rhD).send({ empresaId: empresaD, nome }),
          ),
        );
        expect(respostas.map((r) => r.status)).toEqual([201, 201]);
        expect(respostas.map((r) => r.body.codigo).sort()).toEqual([
          "PARALELO_UNICO",
          "PARALELO_UNICO_2",
        ]);
      });

      it("nome só de outra empresa não conta, e a outra empresa nunca aparece", async () => {
        await post(rota, rhB)
          .send({ empresaId: empresaB, codigo: "SO_B_T197", nome: "Somente B" })
          .expect(201);
        const r = await post(rota, rhD)
          .send({ empresaId: empresaD, nome: "Somente B" })
          .expect(201);
        expect(r.body.empresaId).toBe(empresaD);
        const fora = await post(rota, rhD)
          .send({ empresaId: empresaB, nome: "Tentativa Fora" })
          .expect(404);
        expect(JSON.stringify(fora.body)).not.toContain("Somente B");
        expect(await contarNome(modelo, empresaB, "Tentativa Fora")).toBe(0);
      });

      it("DP, financeiro e colaborador: recusados, sem gravar", async () => {
        await post(rota, dpD)
          .send({ empresaId: empresaD, nome: "Escrita Negada" })
          .expect(403);
        await post(rota, financeiroD)
          .send({ empresaId: empresaD, nome: "Escrita Negada" })
          .expect(403);
        await post(rota, colaboradorA)
          .send({ empresaId: empresaA, nome: "Escrita Negada" })
          .expect(403);
        expect(await contarNome(modelo, empresaD, "Escrita Negada")).toBe(0);
        expect(await contarNome(modelo, empresaA, "Escrita Negada")).toBe(0);
      });

      it("sem sessão: 401; sem token CSRF: 403 csrf_invalido; nada gravado", async () => {
        await agent()
          .post(rota)
          .send({ empresaId: empresaD, nome: "Sem Sessao" })
          .expect(401);
        const r = await agent()
          .post(rota)
          .set("Cookie", rhD.cookie)
          .send({ empresaId: empresaD, nome: "Sem Sessao" })
          .expect(403);
        expect(r.body).toMatchObject({ codigo: "csrf_invalido" });
        expect(await contarNome(modelo, empresaD, "Sem Sessao")).toBe(0);
      });

      it("nome vazio, só espaços ou com caractere de controle: 400, sem repetir o nome", async () => {
        for (const nome of ["", "   ", "Nome\u0007CONTROLE"]) {
          const r = await post(rota, rhD)
            .send({ empresaId: empresaD, nome })
            .expect(400);
          expect(JSON.stringify(r.body)).not.toContain("CONTROLE");
        }
        await post(rota, rhD)
          .send({ empresaId: empresaD, nome: "Nome", codigo: "" })
          .expect(400);
      });

      it("caminho manual (com código) segue igual: aceita nome repetido e recusa código em uso", async () => {
        const r = await post(rota, rhD)
          .send({
            empresaId: empresaD,
            codigo: "MANUAL_T197",
            nome: "Ação Fiscal Sintética",
          })
          .expect(201);
        expect(r.body).toMatchObject({
          codigo: "MANUAL_T197",
          nome: "Ação Fiscal Sintética",
        });
        const repetido = await post(rota, rhD)
          .send({ empresaId: empresaD, codigo: "MANUAL_T197", nome: "Outro" })
          .expect(409);
        expect(repetido.body).not.toHaveProperty("codigo");
      });
    });
  });
});
