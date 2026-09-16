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
 * Etapa 1 — Fatia 2: Colaboradores e Vida Funcional (ADR 0007, Baseline V1).
 * PostgreSQL real e efêmero (Testcontainers), migration aplicada do zero.
 *
 * **Todos os dados são sintéticos.** Nomes obviamente fictícios, domínio
 * reservado `example.test` para e-mail de conta técnica, matrículas
 * arbitrárias. Nenhum dado real de pessoa, em nenhuma hipótese.
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

const SENHA_PADRAO = "Pessoas!Vida2026#Teste";

/** Datas fixas e passadas, para efetivação imediata e determinística. */
const ADMISSAO = "2026-01-05";
const TRANSFERENCIA = "2026-03-02";
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

describe("Colaboradores e Vida Funcional (e2e)", () => {
  let container: StartedTestContainer;
  let appUrl: string;
  let migratorUrl: string;
  let app: INestApplication;

  // `admin` = admin_tecnico do bootstrap, mantido apenas para PROVAR negação
  // (CG-RBAC-01: convergido para bootstrap/histórico, sem acesso operacional).
  // `master` = master_tecnico semeado, único acesso global standing, faz todo o
  // setup e as operações organizacionais (ADR 0012).
  let admin: Credencial;
  let master: Credencial;
  let rhA: Credencial;
  let rhB: Credencial;
  let dpA: Credencial;
  let gestorA: Credencial;
  let financeiroA: Credencial;
  let colaboradorA: Credencial;
  let auditorA: Credencial;

  let empresaA: string;
  let empresaB: string;
  let departamentoA: string;
  let departamentoA2: string;
  let cargoA: string;
  let equipeA: string;
  let departamentoB: string;
  let cargoB: string;

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

  // Semeia um usuário de papel NÃO provisionável por rota (`auditor` — CG-DPO-03;
  // `dpo` — CG-DPO-01) direto no banco, só para exercitar a negação de acesso
  // ao domínio; a rota comum recusa esses papéis.
  async function seedUsuarioComPapel(
    email: string,
    role: "auditor" | "dpo",
    companyId: string,
  ): Promise<Credencial> {
    const { PasswordHashService } =
      await import("../src/auth/password/password-hash.service");
    const prisma = new PrismaClient({ datasources: { db: { url: appUrl } } });
    try {
      const passwordHash = await new PasswordHashService().hash(SENHA_PADRAO);
      await prisma.accessUser.create({
        data: { email, passwordHash, role, companyId, status: "active" },
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

  /** Admite e efetiva, devolvendo os identificadores criados. */
  async function admitirEEfetivar(
    cred: Credencial,
    dados: {
      nome: string;
      empresaId: string;
      matricula: string;
      departamentoId: string;
      cargoId?: string;
      dataAdmissao?: string;
    },
  ): Promise<{ colaboradorId: string; vinculoId: string }> {
    const colaborador = await post("/v1/colaboradores", cred)
      .send({
        nome: dados.nome,
        empresaId: dados.empresaId,
        matricula: dados.matricula,
        tipo: "clt",
        dataAdmissao: dados.dataAdmissao ?? ADMISSAO,
        motivoCodigo: "admissao_inicial",
        departamentoId: dados.departamentoId,
        ...(dados.cargoId ? { cargoId: dados.cargoId } : {}),
      })
      .expect(201);

    const vinculos = await get(
      `/v1/colaboradores/${colaborador.body.id}/vinculos`,
      cred,
    ).expect(200);
    const vinculoId: string = vinculos.body[0].id;

    const movimentacoes = await get(
      `/v1/vinculos/${vinculoId}/linha-do-tempo`,
      cred,
    ).expect(200);
    await post(`/v1/movimentacoes/${movimentacoes.body[0].id}/efetivar`, cred)
      .send()
      .expect(201);

    return { colaboradorId: colaborador.body.id, vinculoId };
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

    const adminEmail = "admin.pessoas@example.test";
    expect(
      runBootstrap({
        DATABASE_URL: appUrl,
        ADMIN_BOOTSTRAP_EMAIL: adminEmail,
        ADMIN_BOOTSTRAP_PASSWORD: SENHA_PADRAO,
      }).status,
    ).toBe(0);
    admin = await login(adminEmail, SENHA_PADRAO);
    // Operador global (setup + estrutura) — admin_tecnico não opera mais por rota.
    master = await seedMaster("master.pessoas@example.test");

    empresaA = (
      await post("/v1/empresas", master)
        .send({ codigo: "PESSOAA", nome: "Empresa A" })
        .expect(201)
    ).body.id;
    empresaB = (
      await post("/v1/empresas", master)
        .send({ codigo: "PESSOAB", nome: "Empresa B" })
        .expect(201)
    ).body.id;

    departamentoA = (
      await post("/v1/departamentos", master)
        .send({ empresaId: empresaA, codigo: "DEPA1", nome: "Departamento A1" })
        .expect(201)
    ).body.id;
    departamentoA2 = (
      await post("/v1/departamentos", master)
        .send({ empresaId: empresaA, codigo: "DEPA2", nome: "Departamento A2" })
        .expect(201)
    ).body.id;
    cargoA = (
      await post("/v1/cargos", master)
        .send({ empresaId: empresaA, codigo: "CARGOA1", nome: "Cargo A1" })
        .expect(201)
    ).body.id;
    equipeA = (
      await post("/v1/equipes", master)
        .send({
          departamentoId: departamentoA,
          codigo: "EQPA1",
          nome: "Equipe A1",
        })
        .expect(201)
    ).body.id;

    departamentoB = (
      await post("/v1/departamentos", master)
        .send({ empresaId: empresaB, codigo: "DEPB1", nome: "Departamento B1" })
        .expect(201)
    ).body.id;
    cargoB = (
      await post("/v1/cargos", master)
        .send({ empresaId: empresaB, codigo: "CARGOB1", nome: "Cargo B1" })
        .expect(201)
    ).body.id;

    rhA = await criarUsuario("rh.pa@example.test", "rh", empresaA);
    rhB = await criarUsuario("rh.pb@example.test", "rh", empresaB);
    dpA = await criarUsuario("dp.pa@example.test", "dp", empresaA);
    gestorA = await criarUsuario("gestor.pa@example.test", "gestor", empresaA);
    financeiroA = await criarUsuario(
      "fin.pa@example.test",
      "financeiro",
      empresaA,
    );
    colaboradorA = await criarUsuario(
      "colab.pa@example.test",
      "colaborador",
      empresaA,
    );
    // `auditor` não é provisionável por rota (CG-DPO-03) — semeado direto só
    // para exercitar a negação de acesso a Pessoas.
    auditorA = await seedUsuarioComPapel(
      "auditor.pa@example.test",
      "auditor",
      empresaA,
    );
  });

  afterAll(async () => {
    await app?.close();
    await container?.stop();
  });

  // -------------------------------------------------------------------------

  describe("ciclo funcional completo com dados sintéticos", () => {
    let colaboradorId: string;
    let vinculoId: string;

    it("admite: cria colaborador, vínculo `previsto` e movimentação de admissão", async () => {
      const resposta = await post("/v1/colaboradores", rhA)
        .send({
          nome: "Pessoa Sintetica Um",
          empresaId: empresaA,
          matricula: "MAT-0001",
          tipo: "clt",
          dataAdmissao: ADMISSAO,
          motivoCodigo: "admissao_inicial",
          departamentoId: departamentoA,
          cargoId: cargoA,
        })
        .expect(201);

      colaboradorId = resposta.body.id;
      expect(resposta.body.situacao).toBe("inativo");

      const vinculos = await get(
        `/v1/colaboradores/${colaboradorId}/vinculos`,
        rhA,
      ).expect(200);
      expect(vinculos.body).toHaveLength(1);
      expect(vinculos.body[0].situacao).toBe("previsto");
      expect(vinculos.body[0].matricula).toBe("MAT-0001");
      vinculoId = vinculos.body[0].id;
    });

    it("não cria conta de acesso automaticamente (RS-2)", async () => {
      const prisma = new PrismaClient({ datasources: { db: { url: appUrl } } });
      try {
        const contas = await prisma.accessUser.count({
          where: { companyId: empresaA },
        });
        // Só as contas técnicas criadas no bootstrap do teste — a admissão
        // não acrescentou nenhuma.
        expect(contas).toBe(6);
      } finally {
        await prisma.$disconnect();
      }
    });

    it("antes de efetivar, não há alocação alguma", async () => {
      const alocacoes = await get(
        `/v1/vinculos/${vinculoId}/alocacoes`,
        rhA,
      ).expect(200);
      expect(alocacoes.body).toHaveLength(0);
    });

    it("efetiva a admissão: vínculo vira `ativo` e nasce a primeira alocação", async () => {
      const linha = await get(
        `/v1/vinculos/${vinculoId}/linha-do-tempo`,
        rhA,
      ).expect(200);
      const admissaoId = linha.body[0].id;

      await post(`/v1/movimentacoes/${admissaoId}/efetivar`, rhA)
        .send()
        .expect(201);

      const vinculos = await get(
        `/v1/colaboradores/${colaboradorId}/vinculos`,
        rhA,
      ).expect(200);
      expect(vinculos.body[0].situacao).toBe("ativo");

      const colaborador = await get(
        `/v1/colaboradores/${colaboradorId}`,
        rhA,
      ).expect(200);
      expect(colaborador.body.situacao).toBe("ativo");

      const alocacoes = await get(
        `/v1/vinculos/${vinculoId}/alocacoes`,
        rhA,
      ).expect(200);
      expect(alocacoes.body).toHaveLength(1);
      expect(alocacoes.body[0].departamentoId).toBe(departamentoA);
      expect(alocacoes.body[0].vigenteAte).toBeNull();
    });

    it("transfere: sucessão de alocação, sem sobrescrever a anterior", async () => {
      const movimentacao = await post("/v1/movimentacoes", rhA)
        .send({
          vinculoId,
          tipo: "transferencia_organizacional",
          motivoCodigo: "reestruturacao_organizacional",
          vigenciaInicio: TRANSFERENCIA,
          departamentoId: departamentoA2,
          cargoId: cargoA,
        })
        .expect(201);

      await post(`/v1/movimentacoes/${movimentacao.body.id}/efetivar`, rhA)
        .send()
        .expect(201);

      const alocacoes = await get(
        `/v1/vinculos/${vinculoId}/alocacoes`,
        rhA,
      ).expect(200);

      expect(alocacoes.body).toHaveLength(2);
      // A primeira permanece, agora fechada — nenhuma linha foi reescrita.
      expect(alocacoes.body[0].departamentoId).toBe(departamentoA);
      expect(alocacoes.body[0].vigenteAte).toContain(TRANSFERENCIA);
      expect(alocacoes.body[1].departamentoId).toBe(departamentoA2);
      expect(alocacoes.body[1].vigenteAte).toBeNull();
    });

    it("responde a situação em qualquer data de referência (garantia central)", async () => {
      const antes = await get(
        `/v1/vinculos/${vinculoId}/situacao?dataReferencia=2026-02-01`,
        rhA,
      ).expect(200);
      expect(antes.body.alocacao.departamentoId).toBe(departamentoA);

      // Borda: `vigente_ate` é exclusivo, então no dia da transferência já
      // vale a alocação nova.
      const noDia = await get(
        `/v1/vinculos/${vinculoId}/situacao?dataReferencia=${TRANSFERENCIA}`,
        rhA,
      ).expect(200);
      expect(noDia.body.alocacao.departamentoId).toBe(departamentoA2);

      const depois = await get(
        `/v1/vinculos/${vinculoId}/situacao?dataReferencia=2026-04-01`,
        rhA,
      ).expect(200);
      expect(depois.body.alocacao.departamentoId).toBe(departamentoA2);

      // Antes da admissão não havia alocação — e isso é resposta, não erro.
      const anterior = await get(
        `/v1/vinculos/${vinculoId}/situacao?dataReferencia=2025-12-01`,
        rhA,
      ).expect(200);
      expect(anterior.body.alocacao).toBeNull();
    });

    it("desliga: encerra vínculo e alocação, sem apagar histórico", async () => {
      const movimentacao = await post("/v1/movimentacoes", rhA)
        .send({
          vinculoId,
          tipo: "desligamento",
          motivoCodigo: "encerramento_de_vinculo",
          vigenciaInicio: DESLIGAMENTO,
        })
        .expect(201);

      await post(`/v1/movimentacoes/${movimentacao.body.id}/efetivar`, rhA)
        .send()
        .expect(201);

      const vinculos = await get(
        `/v1/colaboradores/${colaboradorId}/vinculos`,
        rhA,
      ).expect(200);
      expect(vinculos.body[0].situacao).toBe("encerrado");
      expect(vinculos.body[0].dataDesligamento).toContain(DESLIGAMENTO);

      const colaborador = await get(
        `/v1/colaboradores/${colaboradorId}`,
        rhA,
      ).expect(200);
      expect(colaborador.body.situacao).toBe("inativo");

      // Histórico intacto: duas alocações, ambas fechadas.
      const alocacoes = await get(
        `/v1/vinculos/${vinculoId}/alocacoes`,
        rhA,
      ).expect(200);
      expect(alocacoes.body).toHaveLength(2);
      expect(
        alocacoes.body.every(
          (a: { vigenteAte: string | null }) => a.vigenteAte !== null,
        ),
      ).toBe(true);

      // A situação passada continua consultável depois do desligamento.
      const passado = await get(
        `/v1/vinculos/${vinculoId}/situacao?dataReferencia=2026-02-01`,
        rhA,
      ).expect(200);
      expect(passado.body.alocacao.departamentoId).toBe(departamentoA);
    });

    it("readmissão cria vínculo NOVO e não funde históricos", async () => {
      const resposta = await post("/v1/vinculos", rhA)
        .send({
          colaboradorId,
          empresaId: empresaA,
          matricula: "MAT-0001-R",
          tipo: "clt",
          dataAdmissao: "2026-06-01",
          motivoCodigo: "admissao_inicial",
          departamentoId: departamentoA,
        })
        .expect(201);

      const vinculos = await get(
        `/v1/colaboradores/${colaboradorId}/vinculos`,
        rhA,
      ).expect(200);
      expect(vinculos.body).toHaveLength(2);
      expect(resposta.body.id).not.toBe(vinculoId);

      // O vínculo antigo continua encerrado — não foi reaberto.
      const antigo = vinculos.body.find(
        (v: { id: string }) => v.id === vinculoId,
      );
      expect(antigo.situacao).toBe("encerrado");
    });
  });

  // -------------------------------------------------------------------------

  describe("T111 — fundação web: Pessoas > Colaboradores", () => {
    it("admite via web (nome + matrícula + destino), confirma por GET individual e por vínculos", async () => {
      const admissao = await post("/v1/colaboradores", rhA)
        .send({
          nome: "Pessoa Sintetica T111",
          empresaId: empresaA,
          matricula: "MAT-T111",
          tipo: "clt",
          dataAdmissao: ADMISSAO,
          motivoCodigo: "admissao_inicial",
          departamentoId: departamentoA,
        })
        .expect(201);

      const colaboradorId: string = admissao.body.id;
      expect(admissao.body.nome).toBe("Pessoa Sintetica T111");
      expect(admissao.body.situacao).toBe("inativo");

      const detalhe = await get(
        `/v1/colaboradores/${colaboradorId}`,
        rhA,
      ).expect(200);
      expect(detalhe.body.nome).toBe("Pessoa Sintetica T111");

      const vinculos = await get(
        `/v1/colaboradores/${colaboradorId}/vinculos`,
        rhA,
      ).expect(200);
      expect(vinculos.body).toHaveLength(1);
      expect(vinculos.body[0].matricula).toBe("MAT-T111");
      expect(vinculos.body[0].tipo).toBe("clt");
      expect(vinculos.body[0].situacao).toBe("previsto");
    });

    it("retifica o nome pela tela e o valor é refletido no GET individual", async () => {
      const admissao = await post("/v1/colaboradores", rhA)
        .send({
          nome: "Nome Original T111",
          empresaId: empresaA,
          matricula: "MAT-T111-B",
          tipo: "clt",
          dataAdmissao: ADMISSAO,
          motivoCodigo: "admissao_inicial",
          departamentoId: departamentoA,
        })
        .expect(201);
      const colaboradorId: string = admissao.body.id;

      const retificado = await patch(`/v1/colaboradores/${colaboradorId}`, rhA)
        .send({ nome: "Nome Corrigido T111" })
        .expect(200);
      expect(retificado.body.nome).toBe("Nome Corrigido T111");

      const detalhe = await get(
        `/v1/colaboradores/${colaboradorId}`,
        rhA,
      ).expect(200);
      expect(detalhe.body.nome).toBe("Nome Corrigido T111");
    });

    it("IDOR: rhB não acessa colaborador nem vínculos de rhA (404 anti-enumeração)", async () => {
      const admissao = await post("/v1/colaboradores", rhA)
        .send({
          nome: "Pessoa Sintetica T111 IDOR",
          empresaId: empresaA,
          matricula: "MAT-T111-C",
          tipo: "clt",
          dataAdmissao: ADMISSAO,
          motivoCodigo: "admissao_inicial",
          departamentoId: departamentoA,
        })
        .expect(201);
      const colaboradorId: string = admissao.body.id;

      await get(`/v1/colaboradores/${colaboradorId}`, rhB).expect(404);
      await get(`/v1/colaboradores/${colaboradorId}/vinculos`, rhB).expect(404);
      await patch(`/v1/colaboradores/${colaboradorId}`, rhB)
        .send({ nome: "Nome Invasor" })
        .expect(404);
    });
  });

  // -------------------------------------------------------------------------

  describe("garantias de integridade no banco", () => {
    it("recusa matrícula duplicada dentro da empresa", async () => {
      await post("/v1/colaboradores", rhA)
        .send({
          nome: "Pessoa Sintetica Dois",
          empresaId: empresaA,
          matricula: "MAT-0001",
          tipo: "clt",
          dataAdmissao: ADMISSAO,
          motivoCodigo: "admissao_inicial",
          departamentoId: departamentoA,
        })
        .expect(409);
    });

    it("a mesma matrícula é aceita em outra empresa", async () => {
      await post("/v1/colaboradores", rhB)
        .send({
          nome: "Pessoa Sintetica Tres",
          empresaId: empresaB,
          matricula: "MAT-0001",
          tipo: "clt",
          dataAdmissao: ADMISSAO,
          motivoCodigo: "admissao_inicial",
          departamentoId: departamentoB,
        })
        .expect(201);
    });

    it("recusa segundo vínculo ATIVO para o mesmo colaborador e empresa (RI-V6)", async () => {
      const { colaboradorId } = await admitirEEfetivar(rhA, {
        nome: "Pessoa Sintetica Quatro",
        empresaId: empresaA,
        matricula: "MAT-0004",
        departamentoId: departamentoA,
      });

      const segundo = await post("/v1/vinculos", rhA)
        .send({
          colaboradorId,
          empresaId: empresaA,
          matricula: "MAT-0004-B",
          tipo: "pj",
          dataAdmissao: ADMISSAO,
          motivoCodigo: "admissao_inicial",
          departamentoId: departamentoA,
        })
        .expect(201);

      const linha = await get(
        `/v1/vinculos/${segundo.body.id}/linha-do-tempo`,
        rhA,
      ).expect(200);

      // O vínculo `previsto` coexiste; ativá-lo é que colide.
      await post(`/v1/movimentacoes/${linha.body[0].id}/efetivar`, rhA)
        .send()
        .expect(409);
    });

    it("RI-V6 é garantida pelo BANCO: INSERT cru é recusado", async () => {
      const migrator = new PrismaClient({
        datasources: { db: { url: migratorUrl } },
      });
      try {
        const ativo = await migrator.vinculoFuncional.findFirst({
          where: { empresaId: empresaA, situacao: "ativo" },
        });
        expect(ativo).not.toBeNull();

        await expect(
          migrator.$executeRawUnsafe(
            `INSERT INTO app.vinculo_funcional
               (id, colaborador_id, empresa_id, matricula, tipo, situacao,
                data_admissao, criado_em, atualizado_em)
             VALUES (gen_random_uuid()::text, $1, $2, 'CRU-DUP', 'clt', 'ativo',
                     DATE '2026-01-05', now(), now())`,
            ativo!.colaboradorId,
            ativo!.empresaId,
          ),
        ).rejects.toThrow();
      } finally {
        await migrator.$disconnect();
      }
    });

    it("alocação cruzando empresa é recusada pelo BANCO (RI-A1)", async () => {
      const migrator = new PrismaClient({
        datasources: { db: { url: migratorUrl } },
      });
      try {
        const vinculo = await migrator.vinculoFuncional.findFirst({
          where: { empresaId: empresaA, situacao: "ativo" },
        });
        const movimentacao = await migrator.movimentacaoFuncional.findFirst({
          where: { vinculoId: vinculo!.id },
        });

        // departamentoB pertence à empresa B; o vínculo é da empresa A.
        await expect(
          migrator.$executeRawUnsafe(
            `INSERT INTO app.alocacao_organizacional
               (id, vinculo_id, empresa_id, departamento_id, vigente_de,
                movimentacao_origem_id, criado_em)
             VALUES (gen_random_uuid()::text, $1, $2, $3, DATE '2026-09-01', $4, now())`,
            vinculo!.id,
            vinculo!.empresaId,
            departamentoB,
            movimentacao!.id,
          ),
        ).rejects.toThrow();
      } finally {
        await migrator.$disconnect();
      }
    });

    it("segunda alocação ABERTA para o mesmo vínculo é recusada pelo BANCO (RI-A2)", async () => {
      const migrator = new PrismaClient({
        datasources: { db: { url: migratorUrl } },
      });
      try {
        const aberta = await migrator.alocacaoOrganizacional.findFirst({
          where: { vigenteAte: null },
        });
        expect(aberta).not.toBeNull();

        await expect(
          migrator.$executeRawUnsafe(
            `INSERT INTO app.alocacao_organizacional
               (id, vinculo_id, empresa_id, departamento_id, vigente_de,
                movimentacao_origem_id, criado_em)
             VALUES (gen_random_uuid()::text, $1, $2, $3, DATE '2026-11-11', $4, now())`,
            aberta!.vinculoId,
            aberta!.empresaId,
            aberta!.departamentoId,
            aberta!.movimentacaoOrigemId,
          ),
        ).rejects.toThrow();
      } finally {
        await migrator.$disconnect();
      }
    });

    it("recusa alocação em nó organizacional de outra empresa (via API)", async () => {
      await post("/v1/colaboradores", rhA)
        .send({
          nome: "Pessoa Sintetica Cinco",
          empresaId: empresaA,
          matricula: "MAT-0005",
          tipo: "clt",
          dataAdmissao: ADMISSAO,
          motivoCodigo: "admissao_inicial",
          departamentoId: departamentoB,
        })
        .expect(422);
    });

    it("recusa cargo de outra empresa mesmo com departamento correto", async () => {
      // Cada referência é validada isoladamente: acertar o departamento não
      // "libera" as demais.
      await post("/v1/colaboradores", rhA)
        .send({
          nome: "Pessoa Sintetica Cargo Cruzado",
          empresaId: empresaA,
          matricula: "MAT-0005B",
          tipo: "clt",
          dataAdmissao: ADMISSAO,
          motivoCodigo: "admissao_inicial",
          departamentoId: departamentoA,
          cargoId: cargoB,
        })
        .expect(422);
    });

    it("aceita alocação com equipe da mesma empresa", async () => {
      const resposta = await post("/v1/colaboradores", rhA)
        .send({
          nome: "Pessoa Sintetica Equipe",
          empresaId: empresaA,
          matricula: "MAT-0005C",
          tipo: "estagio",
          dataAdmissao: ADMISSAO,
          motivoCodigo: "admissao_inicial",
          departamentoId: departamentoA,
          equipeId: equipeA,
          cargoId: cargoA,
        })
        .expect(201);

      const vinculos = await get(
        `/v1/colaboradores/${resposta.body.id}/vinculos`,
        rhA,
      ).expect(200);
      const linha = await get(
        `/v1/vinculos/${vinculos.body[0].id}/linha-do-tempo`,
        rhA,
      ).expect(200);
      await post(`/v1/movimentacoes/${linha.body[0].id}/efetivar`, rhA)
        .send()
        .expect(201);

      const alocacoes = await get(
        `/v1/vinculos/${vinculos.body[0].id}/alocacoes`,
        rhA,
      ).expect(200);
      expect(alocacoes.body[0].equipeId).toBe(equipeA);
    });

    it("recusa alocação em nó organizacional INATIVO (RI-A3)", async () => {
      const departamentoInativo = (
        await post("/v1/departamentos", master)
          .send({ empresaId: empresaA, codigo: "DEPINA", nome: "Dep Inativo" })
          .expect(201)
      ).body.id;
      await post(`/v1/departamentos/${departamentoInativo}/inativar`, master)
        .send()
        .expect(201);

      await post("/v1/colaboradores", rhA)
        .send({
          nome: "Pessoa Sintetica Seis",
          empresaId: empresaA,
          matricula: "MAT-0006",
          tipo: "clt",
          dataAdmissao: ADMISSAO,
          motivoCodigo: "admissao_inicial",
          departamentoId: departamentoInativo,
        })
        .expect(422);
    });

    it("recusa alocação sem nenhuma referência organizacional", async () => {
      await post("/v1/colaboradores", rhA)
        .send({
          nome: "Pessoa Sintetica Sete",
          empresaId: empresaA,
          matricula: "MAT-0007",
          tipo: "clt",
          dataAdmissao: ADMISSAO,
          motivoCodigo: "admissao_inicial",
        })
        .expect(422);
    });

    it("recusa motivo fora do catálogo controlado e texto livre", async () => {
      await post("/v1/colaboradores", rhA)
        .send({
          nome: "Pessoa Sintetica Oito",
          empresaId: empresaA,
          matricula: "MAT-0008",
          tipo: "clt",
          dataAdmissao: ADMISSAO,
          motivoCodigo: "demissao por justa causa",
          departamentoId: departamentoA,
        })
        .expect(400);
    });

    it("recusa tipo de vínculo fora do catálogo", async () => {
      await post("/v1/colaboradores", rhA)
        .send({
          nome: "Pessoa Sintetica Nove",
          empresaId: empresaA,
          matricula: "MAT-0009",
          tipo: "aprendiz",
          dataAdmissao: ADMISSAO,
          motivoCodigo: "admissao_inicial",
          departamentoId: departamentoA,
        })
        .expect(400);
    });
  });

  // -------------------------------------------------------------------------

  describe("RI-A2: nao sobreposicao de periodos, garantida pelo banco", () => {
    // Todos os INSERTs abaixo sao CRUS, pelo papel de migration: contornam
    // service, DTO, lock de aplicacao e qualquer validacao de codigo. Se
    // passassem, a garantia nao estaria no banco.
    let migrator: PrismaClient;
    let vinculoId: string;
    let empresaId: string;
    let departamentoId: string;
    let movimentacaoId: string;

    /** INSERT cru de alocacao; `ate` nulo = alocacao aberta. */
    async function inserirAlocacao(
      de: string,
      ate: string | null,
    ): Promise<void> {
      await migrator.$executeRawUnsafe(
        `INSERT INTO app.alocacao_organizacional
           (id, vinculo_id, empresa_id, departamento_id, vigente_de,
            vigente_ate, movimentacao_origem_id, criado_em)
         VALUES (gen_random_uuid()::text, $1, $2, $3, $4::date, $5::date, $6, now())`,
        vinculoId,
        empresaId,
        departamentoId,
        de,
        ate,
        movimentacaoId,
      );
    }

    beforeAll(async () => {
      migrator = new PrismaClient({
        datasources: { db: { url: migratorUrl } },
      });

      // Vinculo dedicado, em `previsto`, para nao colidir com o historico dos
      // outros casos nem com a invariante "vinculo ativo exige alocacao".
      const colaborador = await post("/v1/colaboradores", rhA)
        .send({
          nome: "Pessoa Sintetica Intervalo",
          empresaId: empresaA,
          matricula: "MAT-INTV",
          tipo: "clt",
          dataAdmissao: ADMISSAO,
          motivoCodigo: "admissao_inicial",
          departamentoId: departamentoA,
        })
        .expect(201);

      const vinculos = await get(
        `/v1/colaboradores/${colaborador.body.id}/vinculos`,
        rhA,
      ).expect(200);
      vinculoId = vinculos.body[0].id;
      empresaId = empresaA;
      departamentoId = departamentoA;

      const linha = await get(
        `/v1/vinculos/${vinculoId}/linha-do-tempo`,
        rhA,
      ).expect(200);
      movimentacaoId = linha.body[0].id;
    });

    afterAll(async () => {
      await migrator?.$disconnect();
    });

    it("a EXCLUSION CONSTRAINT existe, com daterange [) sobre o vinculo", async () => {
      const linhas = await migrator.$queryRawUnsafe<
        { conname: string; definicao: string }[]
      >(
        `SELECT conname, pg_get_constraintdef(oid) AS definicao
           FROM pg_constraint
          WHERE conname = 'alocacao_organizacional_sem_sobreposicao'`,
      );
      expect(linhas).toHaveLength(1);
      expect(linhas[0]!.definicao).toContain("EXCLUDE USING gist");
      expect(linhas[0]!.definicao).toContain("vinculo_id WITH =");
      expect(linhas[0]!.definicao).toContain("'[)'");
    });

    it("aceita o primeiro periodo fechado", async () => {
      // Se lancar, o teste falha — nao ha assercao a fazer alem de "passou".
      await inserirAlocacao("2026-01-01", "2026-03-01");
    });

    it("aceita periodo ADJACENTE, sem intersecao", async () => {
      // [01-01, 03-01) e [03-01, 05-01) encostam mas nao se sobrepoem — e
      // exatamente o que a sucessao de alocacoes produz.
      await inserirAlocacao("2026-03-01", "2026-05-01");
    });

    it("RECUSA periodo sobreposto", async () => {
      await expect(inserirAlocacao("2026-02-01", "2026-04-01")).rejects.toThrow(
        /exclusion constraint|23P01/i,
      );
    });

    it("RECUSA periodo contido em outro", async () => {
      await expect(inserirAlocacao("2026-01-10", "2026-02-10")).rejects.toThrow(
        /exclusion constraint|23P01/i,
      );
    });

    it("RECUSA periodo que contem outro", async () => {
      await expect(inserirAlocacao("2025-12-01", "2026-06-01")).rejects.toThrow(
        /exclusion constraint|23P01/i,
      );
    });

    it("aceita alocacao ABERTA apos o ultimo periodo fechado", async () => {
      await inserirAlocacao("2026-05-01", null);
    });

    it("alocacao ABERTA bloqueia periodo FECHADO posterior (limite infinito)", async () => {
      // Prova que `vigente_ate IS NULL` e tratado como infinito: um periodo
      // inteiramente no futuro ainda conflita com a alocacao aberta.
      await expect(inserirAlocacao("2027-07-01", "2027-08-01")).rejects.toThrow(
        /exclusion constraint|23P01/i,
      );
    });

    it("alocacao ABERTA bloqueia outra alocacao ABERTA", async () => {
      await expect(inserirAlocacao("2028-01-01", null)).rejects.toThrow(
        // Duas abertas violam a EXCLUSION e tambem o indice unico parcial;
        // qualquer uma das duas recusas serve — nenhuma passa.
        /exclusion constraint|23P01|unique constraint|vigente_unica/i,
      );
    });

    it("o historico final tem exatamente os periodos aceitos, sem sobreposicao", async () => {
      const alocacoes = await migrator.alocacaoOrganizacional.findMany({
        where: { vinculoId },
        orderBy: { vigenteDe: "asc" },
      });
      expect(alocacoes).toHaveLength(3);
      expect(alocacoes[2]!.vigenteAte).toBeNull();
    });
  });

  describe("privilegio do papel de migration nao foi ampliado", () => {
    it("evolli_migrator nao e superuser nem tem CREATEDB/CREATEROLE", async () => {
      const migrator = new PrismaClient({
        datasources: { db: { url: migratorUrl } },
      });
      try {
        const papeis = await migrator.$queryRawUnsafe<
          {
            rolsuper: boolean;
            rolcreatedb: boolean;
            rolcreaterole: boolean;
            rolbypassrls: boolean;
          }[]
        >(
          `SELECT rolsuper, rolcreatedb, rolcreaterole, rolbypassrls
             FROM pg_roles WHERE rolname = 'evolli_migrator'`,
        );
        expect(papeis[0]).toEqual({
          rolsuper: false,
          rolcreatedb: false,
          rolcreaterole: false,
          rolbypassrls: false,
        });
      } finally {
        await migrator.$disconnect();
      }
    });

    it("nem evolli_migrator nem evolli_app tem CREATE na base", async () => {
      const migrator = new PrismaClient({
        datasources: { db: { url: migratorUrl } },
      });
      try {
        const privilegios = await migrator.$queryRawUnsafe<
          { migrator: boolean; app: boolean }[]
        >(
          `SELECT has_database_privilege('evolli_migrator', current_database(), 'CREATE') AS migrator,
                  has_database_privilege('evolli_app', current_database(), 'CREATE') AS app`,
        );
        expect(privilegios[0]).toEqual({ migrator: false, app: false });
      } finally {
        await migrator.$disconnect();
      }
    });

    it("evolli_migrator NAO consegue instalar a extensao — ela e pre-condicao do admin", async () => {
      const migrator = new PrismaClient({
        datasources: { db: { url: migratorUrl } },
      });
      try {
        await expect(
          migrator.$executeRawUnsafe("CREATE EXTENSION IF NOT EXISTS pg_trgm"),
        ).rejects.toThrow(/permission denied/i);
      } finally {
        await migrator.$disconnect();
      }
    });

    it("btree_gist esta instalada — provisionada pelo papel administrativo", async () => {
      const prisma = new PrismaClient({ datasources: { db: { url: appUrl } } });
      try {
        const extensoes = await prisma.$queryRawUnsafe<{ extname: string }[]>(
          `SELECT extname FROM pg_extension WHERE extname = 'btree_gist'`,
        );
        expect(extensoes).toHaveLength(1);
      } finally {
        await prisma.$disconnect();
      }
    });
  });

  describe("admissao atomica: invariantes estruturais", () => {
    it("colaborador orfao e impossivel pelo BANCO, mesmo por INSERT cru", async () => {
      const migrator = new PrismaClient({
        datasources: { db: { url: migratorUrl } },
      });
      try {
        // A trigger e DEFERRABLE INITIALLY DEFERRED: a recusa acontece no
        // COMMIT, nao no INSERT — por isso o teste precisa da transacao
        // inteira, e nao so do comando.
        await expect(
          migrator.$transaction([
            migrator.$executeRawUnsafe(
              `INSERT INTO app.colaborador (id, nome, situacao, criado_em, atualizado_em)
               VALUES (gen_random_uuid()::text, 'Orfao Sintetico', 'inativo', now(), now())`,
            ),
          ]),
        ).rejects.toThrow(/sem vinculo funcional/i);

        const restou = await migrator.colaborador.count({
          where: { nome: "Orfao Sintetico" },
        });
        expect(restou).toBe(0);
      } finally {
        await migrator.$disconnect();
      }
    });

    it("colaborador orfao e impossivel pela API — nao ha rota de cadastro sem vinculo", async () => {
      // A unica rota de criacao e a admissao, e ela exige empresa, matricula,
      // tipo, data e destino organizacional.
      await post("/v1/colaboradores", rhA)
        .send({ nome: "So Nome" })
        .expect(400);

      const prisma = new PrismaClient({ datasources: { db: { url: appUrl } } });
      try {
        const semVinculo = await prisma.colaborador.count({
          where: { vinculos: { none: {} } },
        });
        expect(semVinculo).toBe(0);
      } finally {
        await prisma.$disconnect();
      }
    });

    it("vinculo ATIVO sem alocacao vigente e impossivel pelo BANCO", async () => {
      const migrator = new PrismaClient({
        datasources: { db: { url: migratorUrl } },
      });
      try {
        const previsto = await migrator.vinculoFuncional.findFirst({
          where: { situacao: "previsto" },
        });
        expect(previsto).not.toBeNull();

        // Ativar sem criar alocacao viola a invariante no COMMIT.
        await expect(
          migrator.$transaction([
            migrator.$executeRawUnsafe(
              `UPDATE app.vinculo_funcional SET situacao = 'ativo' WHERE id = $1`,
              previsto!.id,
            ),
          ]),
        ).rejects.toThrow(/sem alocacao organizacional vigente/i);

        const conferencia = await migrator.vinculoFuncional.findUniqueOrThrow({
          where: { id: previsto!.id },
        });
        expect(conferencia.situacao).toBe("previsto");
      } finally {
        await migrator.$disconnect();
      }
    });

    it("fechar a alocacao vigente de um vinculo ATIVO sem sucessora e impossivel", async () => {
      const migrator = new PrismaClient({
        datasources: { db: { url: migratorUrl } },
      });
      try {
        const aberta = await migrator.alocacaoOrganizacional.findFirst({
          where: { vigenteAte: null, vinculo: { situacao: "ativo" } },
        });
        expect(aberta).not.toBeNull();

        await expect(
          migrator.$transaction([
            migrator.$executeRawUnsafe(
              `UPDATE app.alocacao_organizacional SET vigente_ate = DATE '2027-12-31' WHERE id = $1`,
              aberta!.id,
            ),
          ]),
        ).rejects.toThrow(/sem alocacao organizacional vigente/i);
      } finally {
        await migrator.$disconnect();
      }
    });

    // ---------------------------------------------------------------------
    // Cobertura de DELETE e de reaponte de FK.
    //
    // A API nao expoe DELETE em nenhum recurso desta fatia (RI-H1) e nao passa
    // a expor. Estes casos sao defesa em profundidade contra SQL direto,
    // manutencao manual e modulo futuro — o unico caminho por onde a
    // invariante poderia ser quebrada hoje.
    //
    // Todos usam SQL cru pelo papel de migration e sao avaliados no COMMIT:
    // as triggers sao DEFERRABLE INITIALLY DEFERRED, entao a recusa so
    // aparece ao fechar a transacao, nunca no comando isolado.
    // ---------------------------------------------------------------------

    it("DELETE da unica alocacao vigente de vinculo ATIVO e recusado no COMMIT", async () => {
      const migrator = new PrismaClient({
        datasources: { db: { url: migratorUrl } },
      });
      try {
        const aberta = await migrator.alocacaoOrganizacional.findFirst({
          where: { vigenteAte: null, vinculo: { situacao: "ativo" } },
        });
        expect(aberta).not.toBeNull();

        await expect(
          migrator.$transaction([
            migrator.$executeRawUnsafe(
              `DELETE FROM app.alocacao_organizacional WHERE id = $1`,
              aberta!.id,
            ),
          ]),
        ).rejects.toThrow(/sem alocacao organizacional vigente/i);

        // Nada foi removido.
        const conferencia = await migrator.alocacaoOrganizacional.count({
          where: { id: aberta!.id },
        });
        expect(conferencia).toBe(1);
      } finally {
        await migrator.$disconnect();
      }
    });

    it("DELETE do ultimo vinculo de um colaborador e recusado no COMMIT", async () => {
      const migrator = new PrismaClient({
        datasources: { db: { url: migratorUrl } },
      });
      try {
        // Colaborador com exatamente um vinculo, ja encerrado — o unico caso
        // em que as FKs permitiriam chegar ate o DELETE do vinculo.
        const { vinculoId, colaboradorId } = await admitirEEfetivar(rhA, {
          nome: "Pessoa Sintetica Delete Vinculo",
          empresaId: empresaA,
          matricula: "MAT-DELV",
          departamentoId: departamentoA,
        });

        const desligamento = await post("/v1/movimentacoes", rhA)
          .send({
            vinculoId,
            tipo: "desligamento",
            motivoCodigo: "encerramento_de_vinculo",
            vigenciaInicio: DESLIGAMENTO,
          })
          .expect(201);
        await post(`/v1/movimentacoes/${desligamento.body.id}/efetivar`, rhA)
          .send()
          .expect(201);

        // Ordem que satisfaz as FKs: alocacoes -> movimentacoes -> vinculo.
        await expect(
          migrator.$transaction([
            migrator.$executeRawUnsafe(
              `DELETE FROM app.alocacao_organizacional WHERE vinculo_id = $1`,
              vinculoId,
            ),
            migrator.$executeRawUnsafe(
              `DELETE FROM app.movimentacao_funcional WHERE vinculo_id = $1`,
              vinculoId,
            ),
            migrator.$executeRawUnsafe(
              `DELETE FROM app.vinculo_funcional WHERE id = $1`,
              vinculoId,
            ),
          ]),
        ).rejects.toThrow(/colaborador sem vinculo funcional/i);

        // O vinculo e o colaborador continuam la.
        expect(
          await migrator.vinculoFuncional.count({ where: { id: vinculoId } }),
        ).toBe(1);
        expect(
          await migrator.colaborador.count({ where: { id: colaboradorId } }),
        ).toBe(1);
      } finally {
        await migrator.$disconnect();
      }
    });

    it("MOVER alocacao para outro vinculo, deixando o original ATIVO sem alocacao, e recusado", async () => {
      // Esta e a lacuna que um COALESCE(NEW.vinculo_id, OLD.vinculo_id)
      // esconderia: como a coluna e NOT NULL, NEW nunca seria nulo e so o
      // DESTINO seria verificado — a ORIGEM ficaria ativa sem alocacao.
      const migrator = new PrismaClient({
        datasources: { db: { url: migratorUrl } },
      });
      try {
        // Origem: vinculo ATIVO, com alocacao vigente.
        const origem = await admitirEEfetivar(rhA, {
          nome: "Pessoa Sintetica Origem",
          empresaId: empresaA,
          matricula: "MAT-ORIG",
          departamentoId: departamentoA,
        });

        // Destino: vinculo PREVISTO, sem alocacao. Escolhido de proposito —
        // a invariante 2 nao se aplica a ele e nao ha alocacao com que
        // colidir, entao nem a EXCLUSION CONSTRAINT nem a checagem do destino
        // recusariam. Se o teste passar, foi a checagem da ORIGEM que agiu.
        const destinoColaborador = await post("/v1/colaboradores", rhA)
          .send({
            nome: "Pessoa Sintetica Destino",
            empresaId: empresaA,
            matricula: "MAT-DEST",
            tipo: "clt",
            dataAdmissao: ADMISSAO,
            motivoCodigo: "admissao_inicial",
            departamentoId: departamentoA,
          })
          .expect(201);
        const destinoVinculos = await get(
          `/v1/colaboradores/${destinoColaborador.body.id}/vinculos`,
          rhA,
        ).expect(200);
        const destinoId: string = destinoVinculos.body[0].id;
        expect(destinoVinculos.body[0].situacao).toBe("previsto");

        const aberta = await migrator.alocacaoOrganizacional.findFirstOrThrow({
          where: { vinculoId: origem.vinculoId, vigenteAte: null },
        });

        await expect(
          migrator.$transaction([
            migrator.$executeRawUnsafe(
              `UPDATE app.alocacao_organizacional SET vinculo_id = $1 WHERE id = $2`,
              destinoId,
              aberta.id,
            ),
          ]),
        ).rejects.toThrow(/sem alocacao organizacional vigente/i);

        // A origem continua intacta: alocacao no lugar, vinculo ativo.
        const conferencia =
          await migrator.alocacaoOrganizacional.findUniqueOrThrow({
            where: { id: aberta.id },
          });
        expect(conferencia.vinculoId).toBe(origem.vinculoId);
        expect(
          await migrator.alocacaoOrganizacional.count({
            where: { vinculoId: origem.vinculoId, vigenteAte: null },
          }),
        ).toBe(1);
      } finally {
        await migrator.$disconnect();
      }
    });

    it("REAPONTAR vinculo para outro colaborador, deixando o original sem vinculo, e recusado", async () => {
      const migrator = new PrismaClient({
        datasources: { db: { url: migratorUrl } },
      });
      try {
        const origem = await admitirEEfetivar(rhA, {
          nome: "Pessoa Sintetica Reaponte Origem",
          empresaId: empresaA,
          matricula: "MAT-REAP1",
          departamentoId: departamentoA,
        });
        // Destino NAO efetivado de proposito: seu vinculo fica `previsto`,
        // entao mover um vinculo ATIVO para ele nao esbarra em RI-V6 (no
        // maximo um ativo por colaborador+empresa). Se o teste passar, foi a
        // checagem da ORIGEM que agiu, nao a unicidade.
        const destinoColaborador = await post("/v1/colaboradores", rhA)
          .send({
            nome: "Pessoa Sintetica Reaponte Destino",
            empresaId: empresaA,
            matricula: "MAT-REAP2",
            tipo: "clt",
            dataAdmissao: ADMISSAO,
            motivoCodigo: "admissao_inicial",
            departamentoId: departamentoA,
          })
          .expect(201);
        const destino = { colaboradorId: destinoColaborador.body.id };

        // Mover o unico vinculo da origem para o colaborador destino deixaria
        // a origem sem nenhum vinculo — e sem escopo de autorizacao.
        await expect(
          migrator.$transaction([
            migrator.$executeRawUnsafe(
              `UPDATE app.vinculo_funcional SET colaborador_id = $1 WHERE id = $2`,
              destino.colaboradorId,
              origem.vinculoId,
            ),
          ]),
        ).rejects.toThrow(/colaborador sem vinculo funcional/i);

        const conferencia = await migrator.vinculoFuncional.findUniqueOrThrow({
          where: { id: origem.vinculoId },
        });
        expect(conferencia.colaboradorId).toBe(origem.colaboradorId);
      } finally {
        await migrator.$disconnect();
      }
    });

    it("LEGITIMO: encerrar vinculo e fechar alocacao na MESMA transacao e aceito", async () => {
      // O vinculo deixa de estar ativo, entao a invariante 2 nao se aplica
      // mais a ele — e a verificacao diferida no COMMIT e justamente o que
      // permite que a ordem interna da transacao seja livre.
      const migrator = new PrismaClient({
        datasources: { db: { url: migratorUrl } },
      });
      try {
        const { vinculoId } = await admitirEEfetivar(rhA, {
          nome: "Pessoa Sintetica Encerra Junto",
          empresaId: empresaA,
          matricula: "MAT-ENCJ",
          departamentoId: departamentoA,
        });

        await migrator.$transaction([
          migrator.$executeRawUnsafe(
            `UPDATE app.alocacao_organizacional
                SET vigente_ate = DATE '2026-09-01'
              WHERE vinculo_id = $1 AND vigente_ate IS NULL`,
            vinculoId,
          ),
          migrator.$executeRawUnsafe(
            `UPDATE app.vinculo_funcional
                SET situacao = 'encerrado', data_desligamento = DATE '2026-09-01'
              WHERE id = $1`,
            vinculoId,
          ),
        ]);

        const vinculo = await migrator.vinculoFuncional.findUniqueOrThrow({
          where: { id: vinculoId },
        });
        expect(vinculo.situacao).toBe("encerrado");
        expect(
          await migrator.alocacaoOrganizacional.count({
            where: { vinculoId, vigenteAte: null },
          }),
        ).toBe(0);
      } finally {
        await migrator.$disconnect();
      }
    });

    it("as duas invariantes de Pessoas sao cobertas por QUATRO triggers nas tabelas do modulo, todas deferidas", async () => {
      const migrator = new PrismaClient({
        datasources: { db: { url: migratorUrl } },
      });
      try {
        // Escopado as tabelas do modulo Pessoas (colaborador, vinculo_funcional,
        // alocacao_organizacional) E as FUNCOES proprias das duas invariantes
        // desta fatia (assert_colaborador_com_vinculo,
        // assert_vinculo_ativo_com_alocacao). So a tabela nao bastaria: outros
        // modulos podem ter trigger propria sobre `vinculo_funcional` (ex.:
        // Documentos, T008, cuja invariante empresa<->colaborador tambem dispara
        // em UPDATE/DELETE de vinculo_funcional) — o filtro por funcao garante
        // que so as invariantes de Pessoas entram nesta verificacao, mesmo que
        // uma tabela seja compartilhada entre modulos.
        const triggers = await migrator.$queryRawUnsafe<
          {
            tgname: string;
            deferravel: boolean;
            inicialmente_deferida: boolean;
          }[]
        >(
          `SELECT t.tgname,
                  t.tgdeferrable  AS deferravel,
                  t.tginitdeferred AS inicialmente_deferida
             FROM pg_trigger t
             JOIN pg_class c ON c.oid = t.tgrelid
             JOIN pg_namespace n ON n.oid = c.relnamespace
             JOIN pg_proc p ON p.oid = t.tgfoid
            WHERE n.nspname = 'app' AND NOT t.tgisinternal
              AND c.relname IN ('colaborador', 'vinculo_funcional', 'alocacao_organizacional')
              AND p.proname IN ('assert_colaborador_com_vinculo', 'assert_vinculo_ativo_com_alocacao')
            ORDER BY t.tgname`,
        );

        expect(triggers.map((t) => t.tgname)).toEqual([
          "alocacao_alterada_exige_vinculo_com_alocacao",
          "colaborador_exige_vinculo",
          "vinculo_ativo_exige_alocacao",
          "vinculo_removido_exige_colaborador_com_vinculo",
        ]);
        // Sem DEFERRABLE INITIALLY DEFERRED, estados intermediarios legitimos
        // (fechar a vigente antes de abrir a sucessora) seriam recusados.
        for (const t of triggers) {
          expect(t.deferravel).toBe(true);
          expect(t.inicialmente_deferida).toBe(true);
        }
      } finally {
        await migrator.$disconnect();
      }
    });

    it("admissao cria colaborador, vinculo e movimentacao na MESMA transacao", async () => {
      const resposta = await post("/v1/colaboradores", rhA)
        .send({
          nome: "Pessoa Sintetica Atomica",
          empresaId: empresaA,
          matricula: "MAT-ATOM",
          tipo: "clt",
          dataAdmissao: ADMISSAO,
          motivoCodigo: "admissao_inicial",
          departamentoId: departamentoA,
          cargoId: cargoA,
        })
        .expect(201);

      const prisma = new PrismaClient({ datasources: { db: { url: appUrl } } });
      try {
        const colaborador = await prisma.colaborador.findUniqueOrThrow({
          where: { id: resposta.body.id },
          include: { vinculos: { include: { movimentacoes: true } } },
        });
        expect(colaborador.vinculos).toHaveLength(1);
        expect(colaborador.vinculos[0]!.empresaId).toBe(empresaA);
        expect(colaborador.vinculos[0]!.movimentacoes).toHaveLength(1);
        expect(colaborador.vinculos[0]!.movimentacoes[0]!.tipo).toBe(
          "admissao",
        );
      } finally {
        await prisma.$disconnect();
      }
    });

    it("efetivar a admissao cria a alocacao na MESMA transacao da ativacao", async () => {
      const { vinculoId } = await admitirEEfetivar(rhA, {
        nome: "Pessoa Sintetica Atomica Dois",
        empresaId: empresaA,
        matricula: "MAT-ATOM2",
        departamentoId: departamentoA,
      });

      const prisma = new PrismaClient({ datasources: { db: { url: appUrl } } });
      try {
        const vinculo = await prisma.vinculoFuncional.findUniqueOrThrow({
          where: { id: vinculoId },
          include: { alocacoes: true },
        });
        expect(vinculo.situacao).toBe("ativo");
        expect(vinculo.alocacoes).toHaveLength(1);
        expect(vinculo.alocacoes[0]!.vigenteAte).toBeNull();
      } finally {
        await prisma.$disconnect();
      }
    });

    it("falha da auditoria reverte a admissao INTEIRA, sem deixar orfao", async () => {
      const migrator = new PrismaClient({
        datasources: { db: { url: migratorUrl } },
      });
      try {
        await migrator.$executeRawUnsafe(
          "REVOKE INSERT ON TABLE app.audit_event FROM evolli_app",
        );
        await post("/v1/colaboradores", rhA)
          .send({
            nome: "Pessoa Sintetica Atomica Falha",
            empresaId: empresaA,
            matricula: "MAT-ATOMF",
            tipo: "clt",
            dataAdmissao: ADMISSAO,
            motivoCodigo: "admissao_inicial",
            departamentoId: departamentoA,
          })
          .expect(500);
      } finally {
        await migrator.$executeRawUnsafe(
          "GRANT INSERT ON TABLE app.audit_event TO evolli_app",
        );
        await migrator.$disconnect();
      }

      const prisma = new PrismaClient({ datasources: { db: { url: appUrl } } });
      try {
        expect(
          await prisma.colaborador.count({
            where: { nome: "Pessoa Sintetica Atomica Falha" },
          }),
        ).toBe(0);
        expect(
          await prisma.vinculoFuncional.count({
            where: { matricula: "MAT-ATOMF" },
          }),
        ).toBe(0);
        expect(
          await prisma.movimentacaoFuncional.count({
            where: { vinculo: { matricula: "MAT-ATOMF" } },
          }),
        ).toBe(0);
        // E, sobretudo: nenhum colaborador ficou sem vinculo.
        expect(
          await prisma.colaborador.count({ where: { vinculos: { none: {} } } }),
        ).toBe(0);
      } finally {
        await prisma.$disconnect();
      }
    });
  });
  // -------------------------------------------------------------------------

  describe("retificação: corrige o registro sem apagar o histórico", () => {
    it("preserva a movimentação original e cria a correção", async () => {
      const { vinculoId } = await admitirEEfetivar(rhA, {
        nome: "Pessoa Sintetica Dez",
        empresaId: empresaA,
        matricula: "MAT-0010",
        departamentoId: departamentoA,
      });

      const original = await post("/v1/movimentacoes", rhA)
        .send({
          vinculoId,
          tipo: "mudanca_cargo",
          motivoCodigo: "promocao",
          vigenciaInicio: TRANSFERENCIA,
          departamentoId: departamentoA,
          cargoId: cargoA,
        })
        .expect(201);
      await post(`/v1/movimentacoes/${original.body.id}/efetivar`, rhA)
        .send()
        .expect(201);

      const correcao = await post(
        `/v1/movimentacoes/${original.body.id}/retificar`,
        rhA,
      )
        .send({
          motivoCodigo: "correcao_cadastral",
          vigenciaInicio: "2026-04-01",
          departamentoId: departamentoA2,
          cargoId: cargoA,
        })
        .expect(201);

      expect(correcao.body.retificaId).toBe(original.body.id);

      const linha = await get(
        `/v1/vinculos/${vinculoId}/linha-do-tempo`,
        rhA,
      ).expect(200);

      const originalNaLinha = linha.body.find(
        (m: { id: string }) => m.id === original.body.id,
      );
      // A original permanece consultável, marcada como retificada.
      expect(originalNaLinha.status).toBe("retificada");
      expect(
        linha.body.some((m: { id: string }) => m.id === correcao.body.id),
      ).toBe(true);
    });

    it("recusa retificar duas vezes a mesma movimentação", async () => {
      const { vinculoId } = await admitirEEfetivar(rhA, {
        nome: "Pessoa Sintetica Onze",
        empresaId: empresaA,
        matricula: "MAT-0011",
        departamentoId: departamentoA,
      });

      const movimentacao = await post("/v1/movimentacoes", rhA)
        .send({
          vinculoId,
          tipo: "transferencia_organizacional",
          motivoCodigo: "realocacao_interna",
          vigenciaInicio: TRANSFERENCIA,
          departamentoId: departamentoA2,
        })
        .expect(201);
      await post(`/v1/movimentacoes/${movimentacao.body.id}/efetivar`, rhA)
        .send()
        .expect(201);

      await post(`/v1/movimentacoes/${movimentacao.body.id}/retificar`, rhA)
        .send({
          motivoCodigo: "correcao_cadastral",
          vigenciaInicio: "2026-04-02",
          departamentoId: departamentoA,
        })
        .expect(201);

      // Já está `retificada`: a máquina de estados recusa.
      await post(`/v1/movimentacoes/${movimentacao.body.id}/retificar`, rhA)
        .send({
          motivoCodigo: "correcao_cadastral",
          vigenciaInicio: "2026-04-03",
          departamentoId: departamentoA,
        })
        .expect(409);
    });

    it("recusa efetivar duas vezes a mesma movimentação", async () => {
      const { vinculoId } = await admitirEEfetivar(rhA, {
        nome: "Pessoa Sintetica Doze",
        empresaId: empresaA,
        matricula: "MAT-0012",
        departamentoId: departamentoA,
      });

      const linha = await get(
        `/v1/vinculos/${vinculoId}/linha-do-tempo`,
        rhA,
      ).expect(200);
      await post(`/v1/movimentacoes/${linha.body[0].id}/efetivar`, rhA)
        .send()
        .expect(409);
    });

    it("recusa efetivar movimentação programada antes da vigência", async () => {
      const { vinculoId } = await admitirEEfetivar(rhA, {
        nome: "Pessoa Sintetica Treze",
        empresaId: empresaA,
        matricula: "MAT-0013",
        departamentoId: departamentoA,
      });

      const futura = await post("/v1/movimentacoes", rhA)
        .send({
          vinculoId,
          tipo: "transferencia_organizacional",
          motivoCodigo: "realocacao_interna",
          vigenciaInicio: "2099-01-01",
          departamentoId: departamentoA2,
        })
        .expect(201);
      expect(futura.body.status).toBe("programada");

      await post(`/v1/movimentacoes/${futura.body.id}/efetivar`, rhA)
        .send()
        .expect(409);

      // E não projeta estado: a alocação vigente continua a anterior.
      const situacao = await get(
        `/v1/vinculos/${vinculoId}/situacao?dataReferencia=2099-06-01`,
        rhA,
      ).expect(200);
      expect(situacao.body.alocacao.departamentoId).toBe(departamentoA);
    });

    it("cancelamento permanece no histórico (RI-M6)", async () => {
      const { vinculoId } = await admitirEEfetivar(rhA, {
        nome: "Pessoa Sintetica Catorze",
        empresaId: empresaA,
        matricula: "MAT-0014",
        departamentoId: departamentoA,
      });

      const movimentacao = await post("/v1/movimentacoes", rhA)
        .send({
          vinculoId,
          tipo: "transferencia_organizacional",
          motivoCodigo: "realocacao_interna",
          vigenciaInicio: TRANSFERENCIA,
          departamentoId: departamentoA2,
        })
        .expect(201);

      await post(`/v1/movimentacoes/${movimentacao.body.id}/cancelar`, rhA)
        .send()
        .expect(201);

      const linha = await get(
        `/v1/vinculos/${vinculoId}/linha-do-tempo`,
        rhA,
      ).expect(200);
      const cancelada = linha.body.find(
        (m: { id: string }) => m.id === movimentacao.body.id,
      );
      expect(cancelada.status).toBe("cancelada");

      // Terminal: não volta atrás nem efetiva.
      await post(`/v1/movimentacoes/${movimentacao.body.id}/efetivar`, rhA)
        .send()
        .expect(409);
    });
  });

  // -------------------------------------------------------------------------

  describe("autorização: admin_tecnico negado em todo o domínio", () => {
    const ROTAS_LEITURA = ["/v1/colaboradores", "/v1/movimentacoes"];

    it.each(ROTAS_LEITURA)("nega admin_tecnico em GET %s", async (rota) => {
      await get(rota, admin).expect(403);
    });

    it("nega admin_tecnico ao admitir", async () => {
      await post("/v1/colaboradores", admin)
        .send({
          nome: "Pessoa Sintetica Admin",
          empresaId: empresaA,
          matricula: "MAT-ADM",
          tipo: "clt",
          dataAdmissao: ADMISSAO,
          motivoCodigo: "admissao_inicial",
          departamentoId: departamentoA,
        })
        .expect(403);
    });

    it("nega admin_tecnico em detalhe e retificação de colaborador", async () => {
      const { colaboradorId } = await admitirEEfetivar(rhA, {
        nome: "Pessoa Sintetica Quinze",
        empresaId: empresaA,
        matricula: "MAT-0015",
        departamentoId: departamentoA,
      });

      await get(`/v1/colaboradores/${colaboradorId}`, admin).expect(403);
      await patch(`/v1/colaboradores/${colaboradorId}`, admin)
        .send({ nome: "Alterado Pelo Admin" })
        .expect(403);
      await get(`/v1/colaboradores/${colaboradorId}/vinculos`, admin).expect(
        403,
      );
    });

    it("admin_tecnico TAMBÉM é negado na estrutura organizacional (CG-RBAC-01)", async () => {
      // A antiga assimetria acabou: admin_tecnico converge para
      // bootstrap/histórico e é negado também em Organização. O acesso global à
      // estrutura passou ao master_tecnico.
      await get("/v1/empresas", admin).expect(403);
      await get("/v1/departamentos", admin).expect(403);
      // O master (global) continua lendo a estrutura.
      await get("/v1/empresas", master).expect(200);
    });
  });

  describe("autorização: demais papéis negados", () => {
    it.each([
      ["gestor", () => gestorA],
      ["financeiro", () => financeiroA],
      ["colaborador", () => colaboradorA],
      ["auditor", () => auditorA],
    ])("nega %s em leitura e escrita", async (_papel, cred) => {
      await get("/v1/colaboradores", cred()).expect(403);
      await get("/v1/movimentacoes", cred()).expect(403);
      await post("/v1/colaboradores", cred())
        .send({
          nome: "Pessoa Sintetica Negada",
          empresaId: empresaA,
          matricula: "MAT-NEG",
          tipo: "clt",
          dataAdmissao: ADMISSAO,
          motivoCodigo: "admissao_inicial",
          departamentoId: departamentoA,
        })
        .expect(403);
    });

    it("auditor mantém a leitura da trilha de auditoria", async () => {
      await get("/v1/audit/events", auditorA).expect(200);
    });

    it("dp opera dentro da própria empresa (Baseline V1, item 12)", async () => {
      await get("/v1/colaboradores", dpA).expect(200);
      const resposta = await post("/v1/colaboradores", dpA)
        .send({
          nome: "Pessoa Sintetica Dp",
          empresaId: empresaA,
          matricula: "MAT-DP01",
          tipo: "clt",
          dataAdmissao: ADMISSAO,
          motivoCodigo: "admissao_inicial",
          departamentoId: departamentoA,
        })
        .expect(201);
      expect(resposta.body.id).toEqual(expect.any(String));
    });

    it("mutação sem CSRF é recusada", async () => {
      await agent()
        .post("/v1/colaboradores")
        .set("Cookie", rhA.cookie)
        .send({
          nome: "Pessoa Sintetica Sem Csrf",
          empresaId: empresaA,
          matricula: "MAT-CSRF",
          tipo: "clt",
          dataAdmissao: ADMISSAO,
          motivoCodigo: "admissao_inicial",
          departamentoId: departamentoA,
        })
        .expect(403);
    });

    it("requisição sem sessão é recusada", async () => {
      await agent().get("/v1/colaboradores").expect(401);
    });
  });

  // -------------------------------------------------------------------------

  describe("IDOR/BOLA: escopo de empresa", () => {
    let colaboradorA1: string;
    let vinculoA1: string;
    let movimentacaoA1: string;

    beforeAll(async () => {
      const criado = await admitirEEfetivar(rhA, {
        nome: "Pessoa Sintetica Alvo",
        empresaId: empresaA,
        matricula: "MAT-ALVO",
        departamentoId: departamentoA,
      });
      colaboradorA1 = criado.colaboradorId;
      vinculoA1 = criado.vinculoId;

      const linha = await get(
        `/v1/vinculos/${vinculoA1}/linha-do-tempo`,
        rhA,
      ).expect(200);
      movimentacaoA1 = linha.body[0].id;
    });

    it("rh de outra empresa recebe 404 no detalhe — nunca 403", async () => {
      await get(`/v1/colaboradores/${colaboradorA1}`, rhB).expect(404);
    });

    it("rh de outra empresa recebe 404 nos vínculos e alocações", async () => {
      await get(`/v1/colaboradores/${colaboradorA1}/vinculos`, rhB).expect(404);
      await get(`/v1/vinculos/${vinculoA1}/alocacoes`, rhB).expect(404);
      await get(`/v1/vinculos/${vinculoA1}/linha-do-tempo`, rhB).expect(404);
      await get(
        `/v1/vinculos/${vinculoA1}/situacao?dataReferencia=2026-02-01`,
        rhB,
      ).expect(404);
    });

    it("rh de outra empresa recebe 404 ao retificar cadastro", async () => {
      await patch(`/v1/colaboradores/${colaboradorA1}`, rhB)
        .send({ nome: "Invadido" })
        .expect(404);
    });

    it("rh de outra empresa recebe 404 ao movimentar, efetivar e cancelar", async () => {
      await post("/v1/movimentacoes", rhB)
        .send({
          vinculoId: vinculoA1,
          tipo: "transferencia_organizacional",
          motivoCodigo: "realocacao_interna",
          vigenciaInicio: TRANSFERENCIA,
          departamentoId: departamentoB,
        })
        .expect(404);

      await post(`/v1/movimentacoes/${movimentacaoA1}/efetivar`, rhB)
        .send()
        .expect(404);
      await post(`/v1/movimentacoes/${movimentacaoA1}/cancelar`, rhB)
        .send()
        .expect(404);
      await post(`/v1/movimentacoes/${movimentacaoA1}/retificar`, rhB)
        .send({
          motivoCodigo: "correcao_cadastral",
          vigenciaInicio: "2026-04-01",
          departamentoId: departamentoB,
        })
        .expect(404);
    });

    it("listagem não vaza: rh de B não vê colaborador de A", async () => {
      const lista = await get("/v1/colaboradores", rhB).expect(200);
      expect(
        lista.body.itens.some((c: { id: string }) => c.id === colaboradorA1),
      ).toBe(false);
    });

    it("filtro por outra empresa devolve página vazia, não erro", async () => {
      const lista = await get(
        `/v1/colaboradores?empresaId=${empresaA}`,
        rhB,
      ).expect(200);
      expect(lista.body.itens).toHaveLength(0);
      expect(lista.body.total).toBe(0);

      const movimentacoes = await get(
        `/v1/movimentacoes?empresaId=${empresaA}`,
        rhB,
      ).expect(200);
      expect(movimentacoes.body.itens).toHaveLength(0);
    });

    it("admitir informando empresa de terceiro responde 404", async () => {
      await post("/v1/colaboradores", rhB)
        .send({
          nome: "Pessoa Sintetica Escopo",
          empresaId: empresaA,
          matricula: "MAT-ESC",
          tipo: "clt",
          dataAdmissao: ADMISSAO,
          motivoCodigo: "admissao_inicial",
          departamentoId: departamentoA,
        })
        .expect(404);
    });

    it("tentativa fora de escopo gera evento `denied` na trilha", async () => {
      const prisma = new PrismaClient({ datasources: { db: { url: appUrl } } });
      try {
        const negados = await prisma.auditEvent.count({
          where: {
            action: "authorization_denied",
            result: "denied",
            resource: {
              in: [
                "colaborador",
                "vinculo_funcional",
                "movimentacao_funcional",
                "alocacao_organizacional",
              ],
            },
          },
        });
        expect(negados).toBeGreaterThan(0);
      } finally {
        await prisma.$disconnect();
      }
    });
  });

  // -------------------------------------------------------------------------

  describe("RI-O1: inativação organizacional bloqueada por vínculo ativo", () => {
    let departamentoOcupado: string;
    let cargoOcupado: string;
    let equipeOcupada: string;

    beforeAll(async () => {
      departamentoOcupado = (
        await post("/v1/departamentos", master)
          .send({ empresaId: empresaA, codigo: "DEPOCU", nome: "Dep Ocupado" })
          .expect(201)
      ).body.id;
      cargoOcupado = (
        await post("/v1/cargos", master)
          .send({
            empresaId: empresaA,
            codigo: "CARGOCU",
            nome: "Cargo Ocupado",
          })
          .expect(201)
      ).body.id;
      equipeOcupada = (
        await post("/v1/equipes", master)
          .send({
            departamentoId: departamentoOcupado,
            codigo: "EQPOCU",
            nome: "Equipe Ocupada",
          })
          .expect(201)
      ).body.id;

      const colaborador = await post("/v1/colaboradores", rhA)
        .send({
          nome: "Pessoa Sintetica Ocupa",
          empresaId: empresaA,
          matricula: "MAT-OCUP",
          tipo: "clt",
          dataAdmissao: ADMISSAO,
          motivoCodigo: "admissao_inicial",
          departamentoId: departamentoOcupado,
          cargoId: cargoOcupado,
          equipeId: equipeOcupada,
        })
        .expect(201);

      const vinculos = await get(
        `/v1/colaboradores/${colaborador.body.id}/vinculos`,
        rhA,
      ).expect(200);
      const linha = await get(
        `/v1/vinculos/${vinculos.body[0].id}/linha-do-tempo`,
        rhA,
      ).expect(200);
      await post(`/v1/movimentacoes/${linha.body[0].id}/efetivar`, rhA)
        .send()
        .expect(201);
    });

    it("recusa inativar departamento com alocação vigente (409)", async () => {
      await post(`/v1/departamentos/${departamentoOcupado}/inativar`, master)
        .send()
        .expect(409);
    });

    it("recusa inativar cargo e equipe com alocação vigente", async () => {
      await post(`/v1/cargos/${cargoOcupado}/inativar`, master)
        .send()
        .expect(409);
      await post(`/v1/equipes/${equipeOcupada}/inativar`, master)
        .send()
        .expect(409);
    });

    it("recusa inativar a empresa com vínculo ativo", async () => {
      await post(`/v1/empresas/${empresaA}/inativar`, master)
        .send()
        .expect(409);
    });

    it("a recusa NÃO revela nome, matrícula ou identidade do dependente", async () => {
      const resposta = await post(
        `/v1/departamentos/${departamentoOcupado}/inativar`,
        master,
      )
        .send()
        .expect(409);

      const corpo = JSON.stringify(resposta.body).toLowerCase();
      // Quem inativa estrutura não necessariamente pode ler pessoas.
      for (const proibido of [
        "pessoa",
        "sintetica",
        "ocupa",
        "mat-ocup",
        "colaborador",
        "vinculo",
        "alocacao",
      ]) {
        expect(corpo).not.toContain(proibido);
      }
      expect(Object.keys(resposta.body).sort()).toEqual([
        "message",
        "request_id",
        "status_code",
        "timestamp",
      ]);
    });

    it("o nó organizacional permanece ATIVO — não houve cascata", async () => {
      const departamento = await get(
        `/v1/departamentos/${departamentoOcupado}`,
        master,
      ).expect(200);
      expect(departamento.body.status).toBe("ativo");
    });

    it("histórico encerrado NÃO bloqueia inativação (R-INA-4)", async () => {
      const departamentoLivre = (
        await post("/v1/departamentos", master)
          .send({ empresaId: empresaA, codigo: "DEPLIV", nome: "Dep Livre" })
          .expect(201)
      ).body.id;

      const { vinculoId } = await admitirEEfetivar(rhA, {
        nome: "Pessoa Sintetica Passou",
        empresaId: empresaA,
        matricula: "MAT-PASS",
        departamentoId: departamentoLivre,
      });

      const desligamento = await post("/v1/movimentacoes", rhA)
        .send({
          vinculoId,
          tipo: "desligamento",
          motivoCodigo: "encerramento_de_vinculo",
          vigenciaInicio: DESLIGAMENTO,
        })
        .expect(201);
      await post(`/v1/movimentacoes/${desligamento.body.id}/efetivar`, rhA)
        .send()
        .expect(201);

      // Alocação encerrada e vínculo encerrado: nada bloqueia mais.
      await post(`/v1/departamentos/${departamentoLivre}/inativar`, master)
        .send()
        .expect(201);
    });

    it("bloqueio por filho ORGANIZACIONAL ativo continua idêntico (regressão)", async () => {
      const departamentoPai = (
        await post("/v1/departamentos", master)
          .send({ empresaId: empresaA, codigo: "DEPPAI", nome: "Dep Pai" })
          .expect(201)
      ).body.id;
      await post("/v1/areas", master)
        .send({
          departamentoId: departamentoPai,
          codigo: "AREAF",
          nome: "Area Filha",
        })
        .expect(201);

      await post(`/v1/departamentos/${departamentoPai}/inativar`, master)
        .send()
        .expect(409);
    });
  });

  // -------------------------------------------------------------------------

  describe("auditoria", () => {
    it("registra os verbos da fatia com escopo e request_id corretos", async () => {
      const prisma = new PrismaClient({ datasources: { db: { url: appUrl } } });
      try {
        for (const action of [
          "pessoas_colaborador_criado",
          "pessoas_vinculo_criado",
          "pessoas_vinculo_ativado",
          "pessoas_vinculo_encerrado",
          "pessoas_movimentacao_registrada",
          "pessoas_movimentacao_efetivada",
          "pessoas_movimentacao_cancelada",
          "pessoas_movimentacao_retificada",
          "pessoas_alocacao_criada",
          "pessoas_alocacao_encerrada",
        ] as const) {
          const evento = await prisma.auditEvent.findFirst({
            where: { action },
          });
          expect(evento).not.toBeNull();
          expect(evento!.companyId).toEqual(expect.any(String));
          expect(evento!.requestId).toEqual(expect.any(String));
          expect(evento!.actorUserId).toEqual(expect.any(String));
          expect(evento!.result).toBe("success");
        }
      } finally {
        await prisma.$disconnect();
      }
    });

    it("o valor persistido segue a convenção em português separada por ponto", async () => {
      const prisma = new PrismaClient({ datasources: { db: { url: appUrl } } });
      try {
        const linhas = await prisma.$queryRawUnsafe<{ action: string }[]>(
          `SELECT DISTINCT action::text AS action FROM app.audit_event
             WHERE action::text LIKE 'pessoas.%' ORDER BY 1`,
        );
        expect(linhas.length).toBeGreaterThanOrEqual(10);
        for (const { action } of linhas) {
          expect(action).toMatch(/^pessoas\.[a-z_]+\.[a-z_]+$/);
        }
      } finally {
        await prisma.$disconnect();
      }
    });

    it("NENHUM evento carrega nome, matrícula ou dado pessoal", async () => {
      const prisma = new PrismaClient({ datasources: { db: { url: appUrl } } });
      try {
        const eventos = await prisma.auditEvent.findMany({
          where: {
            resource: {
              in: [
                "colaborador",
                "vinculo_funcional",
                "movimentacao_funcional",
                "alocacao_organizacional",
              ],
            },
          },
        });
        expect(eventos.length).toBeGreaterThan(0);

        const serializado = JSON.stringify(eventos).toLowerCase();
        for (const proibido of [
          "pessoa sintetica",
          "mat-0001",
          "mat-alvo",
          "mat-ocup",
          "sintetica",
        ]) {
          expect(serializado).not.toContain(proibido.toLowerCase());
        }

        // O evento só carrega identificador **técnico** do recurso — nunca
        // matrícula, nome ou documento. `null` é legítimo: negação sem alvo
        // resolvido (ex.: empresa fora do escopo) não tem recurso a apontar.
        for (const evento of eventos) {
          if (evento.resourceId === null) continue;
          expect(evento.resourceId).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
          );
        }
      } finally {
        await prisma.$disconnect();
      }
    });

    it("verbos de aprovação e de dado restrito NÃO existem no enum", async () => {
      const prisma = new PrismaClient({ datasources: { db: { url: appUrl } } });
      try {
        const valores = await prisma.$queryRawUnsafe<{ label: string }[]>(
          `SELECT e.enumlabel AS label FROM pg_enum e
             JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'AuditAction'`,
        );
        const labels = valores.map((v) => v.label);
        for (const ausente of [
          "pessoas.movimentacao.aprovada",
          "pessoas.movimentacao.rejeitada",
          "pessoas.dado_restrito.consultado",
        ]) {
          expect(labels).not.toContain(ausente);
        }
      } finally {
        await prisma.$disconnect();
      }
    });

    it("atomicidade real: INSERT revogado em audit_event impede a mutação", async () => {
      const migrator = new PrismaClient({
        datasources: { db: { url: migratorUrl } },
      });
      try {
        await migrator.$executeRawUnsafe(
          "REVOKE INSERT ON TABLE app.audit_event FROM evolli_app",
        );
        await post("/v1/colaboradores", rhA)
          .send({
            nome: "Pessoa Sintetica Rollback",
            empresaId: empresaA,
            matricula: "MAT-ROLL",
            tipo: "clt",
            dataAdmissao: ADMISSAO,
            motivoCodigo: "admissao_inicial",
            departamentoId: departamentoA,
          })
          .expect(500);
      } finally {
        await migrator.$executeRawUnsafe(
          "GRANT INSERT ON TABLE app.audit_event TO evolli_app",
        );
        await migrator.$disconnect();
      }

      // Nada persistiu — nem o colaborador, nem o vínculo, nem a movimentação.
      const prisma = new PrismaClient({ datasources: { db: { url: appUrl } } });
      try {
        expect(
          await prisma.colaborador.count({
            where: { nome: "Pessoa Sintetica Rollback" },
          }),
        ).toBe(0);
        expect(
          await prisma.vinculoFuncional.count({
            where: { matricula: "MAT-ROLL" },
          }),
        ).toBe(0);
      } finally {
        await prisma.$disconnect();
      }
    });
  });

  // -------------------------------------------------------------------------

  describe("ausência comprovada de rota DELETE e de campo proibido", () => {
    it("nenhuma rota DELETE responde no domínio", async () => {
      const { colaboradorId, vinculoId } = await admitirEEfetivar(rhA, {
        nome: "Pessoa Sintetica Delete",
        empresaId: empresaA,
        matricula: "MAT-DEL",
        departamentoId: departamentoA,
      });

      for (const rota of [
        `/v1/colaboradores/${colaboradorId}`,
        `/v1/vinculos/${vinculoId}`,
        "/v1/movimentacoes",
      ]) {
        await agent()
          .delete(rota)
          .set("Cookie", rhA.cookie)
          .set("x-csrf-token", rhA.csrfToken)
          .expect(404);
      }
    });

    it("o SCHEMA não contém nenhuma coluna de dado proibido", async () => {
      const prisma = new PrismaClient({ datasources: { db: { url: appUrl } } });
      try {
        const colunas = await prisma.$queryRawUnsafe<
          { table_name: string; column_name: string }[]
        >(
          `SELECT table_name, column_name FROM information_schema.columns
             WHERE table_schema = 'app'
               AND table_name IN ('colaborador','vinculo_funcional',
                                  'alocacao_organizacional','movimentacao_funcional')`,
        );

        const nomes = colunas.map((c) => c.column_name.toLowerCase());
        const PROIBIDOS = [
          "cpf",
          "rg",
          "documento",
          "endereco",
          "logradouro",
          "cep",
          "telefone",
          "celular",
          "email",
          "nome_social",
          "genero",
          "identidade_genero",
          "data_nascimento",
          "nascimento",
          "salario",
          "remuneracao",
          "beneficio",
          "dependente",
          "familiar",
          "medico",
          "saude",
          "atestado",
          "anexo",
          "arquivo",
          "cnpj",
          "banco",
          "conta_bancaria",
          "pis",
          "ctps",
          "gestor",
          "tenant_id",
          "motivo_texto",
          "observacao",
        ];
        for (const proibido of PROIBIDOS) {
          expect(nomes).not.toContain(proibido);
        }

        // Prova positiva: o conjunto de colunas do colaborador é exatamente o
        // aprovado na Baseline V1.
        const colaborador = colunas
          .filter((c) => c.table_name === "colaborador")
          .map((c) => c.column_name)
          .sort();
        expect(colaborador).toEqual([
          "atualizado_em",
          "criado_em",
          "id",
          "nome",
          "situacao",
        ]);
      } finally {
        await prisma.$disconnect();
      }
    });

    it("tabelas de aprovação e de dado restrito NÃO existem", async () => {
      const prisma = new PrismaClient({ datasources: { db: { url: appUrl } } });
      try {
        const tabelas = await prisma.$queryRawUnsafe<{ table_name: string }[]>(
          `SELECT table_name FROM information_schema.tables WHERE table_schema = 'app'`,
        );
        const nomes = tabelas.map((t) => t.table_name);
        for (const ausente of [
          "aprovacao_movimentacao",
          "anexo_movimentacao",
          "dado_restrito_colaborador",
          "colaborador_dado_restrito",
        ]) {
          expect(nomes).not.toContain(ausente);
        }
      } finally {
        await prisma.$disconnect();
      }
    });

    it("a RESPOSTA de colaborador só expõe os campos aprovados", async () => {
      const { colaboradorId } = await admitirEEfetivar(rhA, {
        nome: "Pessoa Sintetica Resposta",
        empresaId: empresaA,
        matricula: "MAT-RESP",
        departamentoId: departamentoA,
      });

      const resposta = await get(
        `/v1/colaboradores/${colaboradorId}`,
        rhA,
      ).expect(200);

      // Asserção sobre o corpo INTEIRO, não sobre campos esperados: assim um
      // campo novo introduzido por engano falha o teste.
      expect(Object.keys(resposta.body).sort()).toEqual([
        "atualizadoEm",
        "criadoEm",
        "id",
        "nome",
        "situacao",
      ]);
    });

    it("erro não vaza stack trace, SQL nem nome de tabela", async () => {
      const resposta = await get(
        "/v1/colaboradores/11111111-1111-4111-8111-111111111111",
        rhA,
      ).expect(404);

      const corpo = JSON.stringify(resposta.body).toLowerCase();
      for (const proibido of [
        "select",
        "insert",
        "prisma",
        "app.",
        "constraint",
        "at ",
      ]) {
        expect(corpo).not.toContain(proibido);
      }
    });
  });

  // -------------------------------------------------------------------------

  describe("concorrência", () => {
    it("duas efetivações simultâneas: exatamente uma vence", async () => {
      const colaborador = await post("/v1/colaboradores", rhA)
        .send({
          nome: "Pessoa Sintetica Corrida",
          empresaId: empresaA,
          matricula: "MAT-CORR",
          tipo: "clt",
          dataAdmissao: ADMISSAO,
          motivoCodigo: "admissao_inicial",
          departamentoId: departamentoA,
        })
        .expect(201);

      const vinculos = await get(
        `/v1/colaboradores/${colaborador.body.id}/vinculos`,
        rhA,
      ).expect(200);
      const linha = await get(
        `/v1/vinculos/${vinculos.body[0].id}/linha-do-tempo`,
        rhA,
      ).expect(200);
      const movimentacaoId = linha.body[0].id;

      const [a, b] = await Promise.all([
        post(`/v1/movimentacoes/${movimentacaoId}/efetivar`, rhA).send(),
        post(`/v1/movimentacoes/${movimentacaoId}/efetivar`, rhA).send(),
      ]);

      const sucessos = [a, b].filter((r) => r.status === 201);
      expect(sucessos).toHaveLength(1);

      // E, sobretudo: nunca duas alocações abertas.
      const prisma = new PrismaClient({ datasources: { db: { url: appUrl } } });
      try {
        const abertas = await prisma.alocacaoOrganizacional.count({
          where: { vinculoId: vinculos.body[0].id, vigenteAte: null },
        });
        expect(abertas).toBe(1);
      } finally {
        await prisma.$disconnect();
      }
    });

    it("duas transferências simultâneas não deixam alocação aberta duplicada", async () => {
      const { vinculoId } = await admitirEEfetivar(rhA, {
        nome: "Pessoa Sintetica Corrida Dois",
        empresaId: empresaA,
        matricula: "MAT-CORR2",
        departamentoId: departamentoA,
      });

      const um = await post("/v1/movimentacoes", rhA)
        .send({
          vinculoId,
          tipo: "transferencia_organizacional",
          motivoCodigo: "realocacao_interna",
          vigenciaInicio: TRANSFERENCIA,
          departamentoId: departamentoA2,
        })
        .expect(201);
      const dois = await post("/v1/movimentacoes", rhA)
        .send({
          vinculoId,
          tipo: "transferencia_organizacional",
          motivoCodigo: "realocacao_interna",
          vigenciaInicio: "2026-03-03",
          departamentoId: departamentoA,
        })
        .expect(201);

      await Promise.all([
        post(`/v1/movimentacoes/${um.body.id}/efetivar`, rhA).send(),
        post(`/v1/movimentacoes/${dois.body.id}/efetivar`, rhA).send(),
      ]);

      const prisma = new PrismaClient({ datasources: { db: { url: appUrl } } });
      try {
        const abertas = await prisma.alocacaoOrganizacional.count({
          where: { vinculoId, vigenteAte: null },
        });
        expect(abertas).toBe(1);
      } finally {
        await prisma.$disconnect();
      }
    });
  });

  // -------------------------------------------------------------------------

  describe("privilégios de banco continuam íntegros", () => {
    it("evolli_app não tem DDL nas tabelas da fatia", async () => {
      const prisma = new PrismaClient({ datasources: { db: { url: appUrl } } });
      try {
        await expect(
          prisma.$executeRawUnsafe(
            "ALTER TABLE app.colaborador ADD COLUMN cpf TEXT",
          ),
        ).rejects.toThrow();
      } finally {
        await prisma.$disconnect();
      }
    });

    it("audit_event continua append-only para evolli_app", async () => {
      const prisma = new PrismaClient({ datasources: { db: { url: appUrl } } });
      try {
        await expect(
          prisma.$executeRawUnsafe("DELETE FROM app.audit_event"),
        ).rejects.toThrow();
        await expect(
          prisma.$executeRawUnsafe("UPDATE app.audit_event SET resource = 'x'"),
        ).rejects.toThrow();
      } finally {
        await prisma.$disconnect();
      }
    });
  });
});
