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
 * Etapa 2 — Documentos e Admissão Digital: V1 de METADADOS (ADR 0011, T008).
 * PostgreSQL real e efêmero (Testcontainers), migration aplicada do zero.
 *
 * **Todos os dados são sintéticos.** Nenhum documento real, nenhum conteúdo,
 * nenhum tipo documental real — os códigos/nomes de tipo são arbitrários
 * (`TIPO-SINT-*`), nunca categorias documentais verdadeiras (DP-2E-02 segue
 * pendente).
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

const SENHA_PADRAO = "Documentos!Metadado2026#Teste";
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

/** Chaves que NUNCA podem aparecer numa resposta de documento (sem conteúdo). */
const CHAVES_PROIBIDAS = [
  "conteudo",
  "content",
  "arquivo",
  "file",
  "bytes",
  "base64",
  "url",
  "uri",
  "bucket",
  "chave",
  "key",
  "hash",
  "mime",
  "path",
  "caminho",
  "tamanho",
  "size",
  "storage",
  "referenciaConteudo",
  "referencia_conteudo",
  "nomeArquivo",
  "downloadUrl",
];

function assertSemConteudo(corpo: Record<string, unknown>): void {
  const chaves = Object.keys(corpo).map((k) => k.toLowerCase());
  for (const proibida of CHAVES_PROIBIDAS) {
    expect(chaves).not.toContain(proibida.toLowerCase());
  }
}

describe("Documentos — metadados V1 (e2e)", () => {
  let container: StartedTestContainer;
  let appUrl: string;
  let migratorUrl: string;
  let app: INestApplication;

  let admin: Credencial; // admin_tecnico
  let rhA: Credencial;
  let rhB: Credencial;
  let dpA: Credencial;
  let gestorA: Credencial;
  let colaboradorUserA: Credencial;
  let auditorA: Credencial;

  let empresaA: string;
  let empresaB: string;
  let departamentoA: string;
  let departamentoB: string;
  let colaboradorA1: string;
  let colaboradorB1: string;

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

  async function criarUsuario(
    email: string,
    role: string,
    companyId: string | undefined,
  ): Promise<Credencial> {
    await agent()
      .post("/v1/users")
      .set("Cookie", admin.cookie)
      .set("x-csrf-token", admin.csrfToken)
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

  async function admitir(
    cred: Credencial,
    empresaId: string,
    departamentoId: string,
    matricula: string,
  ): Promise<string> {
    const colaborador = await post("/v1/colaboradores", cred)
      .send({
        nome: "Pessoa Sintetica Documentos",
        empresaId,
        matricula,
        tipo: "clt",
        dataAdmissao: ADMISSAO,
        motivoCodigo: "admissao_inicial",
        departamentoId,
      })
      .expect(201);
    return colaborador.body.id as string;
  }

  async function criarTipo(
    cred: Credencial,
    empresaId: string,
    codigo: string,
    nome: string,
  ): Promise<string> {
    const resp = await post("/v1/tipos-documento", cred)
      .send({
        empresaId,
        codigo,
        nome,
        aprovacaoDpoReferencia: "DPO-REF-SINT-0001",
      })
      .expect(201);
    return resp.body.id as string;
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

    const adminEmail = "admin.docs@example.test";
    expect(
      runBootstrap({
        DATABASE_URL: appUrl,
        ADMIN_BOOTSTRAP_EMAIL: adminEmail,
        ADMIN_BOOTSTRAP_PASSWORD: SENHA_PADRAO,
      }).status,
    ).toBe(0);
    admin = await login(adminEmail, SENHA_PADRAO);

    empresaA = (
      await post("/v1/empresas", admin)
        .send({ codigo: "DOCA", nome: "Empresa Docs A" })
        .expect(201)
    ).body.id;
    empresaB = (
      await post("/v1/empresas", admin)
        .send({ codigo: "DOCB", nome: "Empresa Docs B" })
        .expect(201)
    ).body.id;

    departamentoA = (
      await post("/v1/departamentos", admin)
        .send({ empresaId: empresaA, codigo: "DDEPA", nome: "Dep Docs A" })
        .expect(201)
    ).body.id;
    departamentoB = (
      await post("/v1/departamentos", admin)
        .send({ empresaId: empresaB, codigo: "DDEPB", nome: "Dep Docs B" })
        .expect(201)
    ).body.id;

    rhA = await criarUsuario("rh.da@example.test", "rh", empresaA);
    rhB = await criarUsuario("rh.db@example.test", "rh", empresaB);
    dpA = await criarUsuario("dp.da@example.test", "dp", empresaA);
    gestorA = await criarUsuario("gestor.da@example.test", "gestor", empresaA);
    colaboradorUserA = await criarUsuario(
      "colab.da@example.test",
      "colaborador",
      empresaA,
    );
    auditorA = await criarUsuario(
      "auditor.da@example.test",
      "auditor",
      empresaA,
    );

    colaboradorA1 = await admitir(rhA, empresaA, departamentoA, "DOC-A-0001");
    colaboradorB1 = await admitir(rhB, empresaB, departamentoB, "DOC-B-0001");
  });

  afterAll(async () => {
    await app?.close();
    await container?.stop();
  });

  // -------------------------------------------------------------------------
  // Catálogo (TipoDocumento)
  // -------------------------------------------------------------------------

  describe("catálogo de tipos documentais", () => {
    it("rh cria tipo (inicia restrito) com aprovação de DPO registrada", async () => {
      const resp = await post("/v1/tipos-documento", rhA)
        .send({
          empresaId: empresaA,
          codigo: "TIPO-SINT-1",
          nome: "Tipo Sintetico 1",
          aprovacaoDpoReferencia: "DPO-REF-0001",
        })
        .expect(201);
      expect(resp.body.classificacao).toBe("restrito");
      expect(resp.body.empresaId).toBe(empresaA);
    });

    it("recusa criação de catálogo SEM aprovação de DPO (400)", async () => {
      await post("/v1/tipos-documento", rhA)
        .send({
          empresaId: empresaA,
          codigo: "TIPO-SINT-2",
          nome: "Tipo Sintetico 2",
        })
        .expect(400);
    });

    it("dp lê o catálogo mas NÃO cria nem altera (403)", async () => {
      await get("/v1/tipos-documento", dpA).expect(200);
      await post("/v1/tipos-documento", dpA)
        .send({
          empresaId: empresaA,
          codigo: "TIPO-DP",
          nome: "Tipo DP",
          aprovacaoDpoReferencia: "DPO-REF-DP",
        })
        .expect(403);
    });

    it("gestor, colaborador e admin_tecnico são negados no catálogo (403)", async () => {
      for (const cred of [gestorA, colaboradorUserA, admin]) {
        await get("/v1/tipos-documento", cred).expect(403);
        await post("/v1/tipos-documento", cred)
          .send({
            empresaId: empresaA,
            codigo: "TIPO-NEG",
            nome: "Tipo Negado",
            aprovacaoDpoReferencia: "DPO-REF-NEG",
          })
          .expect(403);
      }
    });

    it("rh de outra empresa não cria tipo na empresa A (404, nunca 403)", async () => {
      await post("/v1/tipos-documento", rhB)
        .send({
          empresaId: empresaA,
          codigo: "TIPO-CROSS",
          nome: "Tipo Cross",
          aprovacaoDpoReferencia: "DPO-REF-X",
        })
        .expect(404);
    });

    it("rh altera o tipo com nova aprovação de DPO", async () => {
      const tipoId = await criarTipo(rhA, empresaA, "TIPO-ALT", "Antes");
      const resp = await patch(`/v1/tipos-documento/${tipoId}`, rhA)
        .send({ nome: "Depois", aprovacaoDpoReferencia: "DPO-REF-ALT-2" })
        .expect(200);
      expect(resp.body.nome).toBe("Depois");
    });
  });

  // -------------------------------------------------------------------------
  // DocumentoMetadado
  // -------------------------------------------------------------------------

  describe("metadados de documento", () => {
    let tipoA: string;
    let tipoB: string;
    let documentoA: string;

    beforeAll(async () => {
      tipoA = await criarTipo(rhA, empresaA, "TIPO-META-A", "Tipo Meta A");
      tipoB = await criarTipo(rhB, empresaB, "TIPO-META-B", "Tipo Meta B");
    });

    it("rh cria metadado (upload_desabilitado) sem nenhum campo de conteúdo", async () => {
      const resp = await post("/v1/documentos", rhA)
        .send({
          empresaId: empresaA,
          colaboradorId: colaboradorA1,
          tipoDocumentoId: tipoA,
        })
        .expect(201);
      documentoA = resp.body.id;
      expect(resp.body.estado).toBe("upload_desabilitado");
      assertSemConteudo(resp.body);
    });

    it("recusa metadado para colaborador sem vínculo na empresa (404)", async () => {
      await post("/v1/documentos", rhA)
        .send({
          empresaId: empresaA,
          colaboradorId: colaboradorB1,
          tipoDocumentoId: tipoA,
        })
        .expect(404);
    });

    it("recusa metadado com tipo de outra empresa (404)", async () => {
      await post("/v1/documentos", rhA)
        .send({
          empresaId: empresaA,
          colaboradorId: colaboradorA1,
          tipoDocumentoId: tipoB,
        })
        .expect(404);
    });

    it("dp cria metadado normalmente", async () => {
      await post("/v1/documentos", dpA)
        .send({
          empresaId: empresaA,
          colaboradorId: colaboradorA1,
          tipoDocumentoId: tipoA,
        })
        .expect(201);
    });

    it("detalhe não expõe conteúdo, endereço ou referência de armazenamento", async () => {
      const resp = await get(`/v1/documentos/${documentoA}`, rhA).expect(200);
      assertSemConteudo(resp.body);
    });

    it("rh de outra empresa recebe 404 no detalhe (IDOR), nunca 403", async () => {
      await get(`/v1/documentos/${documentoA}`, rhB).expect(404);
    });

    it("filtro por outra empresa devolve página vazia, não erro", async () => {
      const lista = await get(
        `/v1/documentos?empresaId=${empresaA}`,
        rhB,
      ).expect(200);
      expect(lista.body.itens).toHaveLength(0);
      expect(lista.body.total).toBe(0);
    });

    it("gestor, colaborador, auditor e admin_tecnico são negados (403)", async () => {
      for (const cred of [gestorA, colaboradorUserA, auditorA, admin]) {
        await get("/v1/documentos", cred).expect(403);
        await post("/v1/documentos", cred)
          .send({
            empresaId: empresaA,
            colaboradorId: colaboradorA1,
            tipoDocumentoId: tipoA,
          })
          .expect(403);
      }
    });

    it("substituição preserva histórico: cria novo, marca anterior `substituido`, não apaga", async () => {
      const original = (
        await post("/v1/documentos", rhA)
          .send({
            empresaId: empresaA,
            colaboradorId: colaboradorA1,
            tipoDocumentoId: tipoA,
          })
          .expect(201)
      ).body.id;

      const tipoNovo = await criarTipo(rhA, empresaA, "TIPO-SUB", "Tipo Sub");
      const novo = await post(`/v1/documentos/${original}/substituicoes`, rhA)
        .send({ tipoDocumentoId: tipoNovo })
        .expect(201);
      expect(novo.body.substituiDocumentoId).toBe(original);
      expect(novo.body.tipoDocumentoId).toBe(tipoNovo);

      // O anterior PERMANECE (sem exclusão física) e transitou para substituido.
      const anterior = await get(`/v1/documentos/${original}`, rhA).expect(200);
      expect(anterior.body.estado).toBe("substituido");

      // Substituir um já substituído é conflito.
      await post(`/v1/documentos/${original}/substituicoes`, rhA)
        .send({ tipoDocumentoId: tipoNovo })
        .expect(409);
    });

    it("leitura sem auditoria persistível NÃO retorna sucesso (fail-safe)", async () => {
      const migrator = new PrismaClient({
        datasources: { db: { url: migratorUrl } },
      });
      try {
        // Impede a gravação do evento de leitura pela conta de runtime.
        await migrator.$executeRawUnsafe(
          "REVOKE INSERT ON TABLE app.audit_event FROM evolli_app;",
        );
        await get(`/v1/documentos/${documentoA}`, rhA).expect(500);
      } finally {
        await migrator.$executeRawUnsafe(
          "GRANT INSERT ON TABLE app.audit_event TO evolli_app;",
        );
        await migrator.$disconnect();
      }

      // Restaurado: a leitura volta a funcionar.
      await get(`/v1/documentos/${documentoA}`, rhA).expect(200);
    });
  });

  // -------------------------------------------------------------------------
  // SolicitacaoDocumento
  // -------------------------------------------------------------------------

  describe("solicitações de documento", () => {
    let tipoA: string;

    beforeAll(async () => {
      tipoA = await criarTipo(rhA, empresaA, "TIPO-SOL-A", "Tipo Sol A");
    });

    it("rh solicita (pendente) e dp também", async () => {
      const resp = await post("/v1/solicitacoes-documento", rhA)
        .send({
          empresaId: empresaA,
          colaboradorId: colaboradorA1,
          tipoDocumentoId: tipoA,
        })
        .expect(201);
      expect(resp.body.estado).toBe("pendente");

      await post("/v1/solicitacoes-documento", dpA)
        .send({
          empresaId: empresaA,
          colaboradorId: colaboradorA1,
          tipoDocumentoId: tipoA,
        })
        .expect(201);
    });

    it("recusa solicitação para colaborador sem vínculo na empresa (404)", async () => {
      await post("/v1/solicitacoes-documento", rhA)
        .send({
          empresaId: empresaA,
          colaboradorId: colaboradorB1,
          tipoDocumentoId: tipoA,
        })
        .expect(404);
    });

    it("gestor e colaborador são negados (403)", async () => {
      for (const cred of [gestorA, colaboradorUserA]) {
        await get("/v1/solicitacoes-documento", cred).expect(403);
        await post("/v1/solicitacoes-documento", cred)
          .send({
            empresaId: empresaA,
            colaboradorId: colaboradorA1,
            tipoDocumentoId: tipoA,
          })
          .expect(403);
      }
    });
  });

  // -------------------------------------------------------------------------
  // Integridade empresa <-> colaborador, garantida pelo BANCO (P1)
  //
  // Prova que a coerência não depende só da aplicação: SQL direto (conta
  // migrator, contornando os services) tentando cruzar documento/solicitação
  // da empresa A com colaborador sem vínculo em A falha no banco; e remover ou
  // reapontar o vínculo que sustenta um metadado/solicitação existente também
  // falha. Constraint triggers diferidos: verificação no COMMIT.
  // -------------------------------------------------------------------------

  describe("integridade empresa <-> colaborador (garantia no banco)", () => {
    let migrator: PrismaClient;
    let tipoIntegA: string;
    let userId: string;

    beforeAll(async () => {
      migrator = new PrismaClient({
        datasources: { db: { url: migratorUrl } },
      });
      tipoIntegA = await criarTipo(
        rhA,
        empresaA,
        "TIPO-INTEG-A",
        "Tipo Integ A",
      );
      const users = await migrator.$queryRawUnsafe<{ id: string }[]>(
        "SELECT id FROM app.access_user LIMIT 1",
      );
      userId = users[0]!.id;
    });

    afterAll(async () => {
      await migrator.$disconnect();
    });

    /**
     * Cria um colaborador com vínculo em A (via admissão) e um SEGUNDO vínculo
     * em B inserido cru — SEM movimentação/alocação, para que remover/reapontar
     * o vínculo B esbarre no trigger de integridade, não no FK de movimentação
     * (que tem ON UPDATE CASCADE). O documento é criado em B, sustentado pelo
     * vínculo B. Como o colaborador mantém o vínculo em A, a invariante de
     * Pessoas ("colaborador sempre tem vínculo") não é a que dispara — isola o
     * trigger DESTE módulo.
     */
    async function prepararColaboradorComDocumentoEmB(sufixo: string): Promise<{
      colaborador: string;
      vinculoB: string;
    }> {
      const colaborador = await admitir(
        rhA,
        empresaA,
        departamentoA,
        `DOC-${sufixo}-A`,
      );
      await migrator.$executeRawUnsafe(
        `INSERT INTO app.vinculo_funcional
           (id, colaborador_id, empresa_id, matricula, tipo, situacao, data_admissao, criado_em, atualizado_em)
         VALUES (gen_random_uuid()::text, $1, $2, $3, 'clt', 'previsto', DATE '2026-01-05', now(), now())`,
        colaborador,
        empresaB,
        `INTEG-${sufixo}-B`,
      );
      const tipoB = await criarTipo(
        rhB,
        empresaB,
        `TIPO-${sufixo}-B`,
        `Tipo ${sufixo} B`,
      );
      await post("/v1/documentos", rhB)
        .send({
          empresaId: empresaB,
          colaboradorId: colaborador,
          tipoDocumentoId: tipoB,
        })
        .expect(201);
      const linhas = await migrator.$queryRawUnsafe<{ id: string }[]>(
        "SELECT id FROM app.vinculo_funcional WHERE colaborador_id = $1 AND empresa_id = $2",
        colaborador,
        empresaB,
      );
      return { colaborador, vinculoB: linhas[0]!.id };
    }

    it("INSERT direto de documento_metadado (empresa A × colaborador sem vínculo em A) falha", async () => {
      await expect(
        migrator.$transaction([
          migrator.$executeRawUnsafe(
            `INSERT INTO app.documento_metadado
               (id, empresa_id, colaborador_id, tipo_documento_id, estado, criado_em, atualizado_em)
             VALUES (gen_random_uuid()::text, $1, $2, $3, 'upload_desabilitado', now(), now())`,
            empresaA,
            colaboradorB1, // vínculo de colaboradorB1 é em B, não em A
            tipoIntegA,
          ),
        ]),
      ).rejects.toThrow(/sem vinculo na mesma empresa/i);
    });

    it("INSERT direto de solicitacao_documento (empresa A × colaborador sem vínculo em A) falha", async () => {
      await expect(
        migrator.$transaction([
          migrator.$executeRawUnsafe(
            `INSERT INTO app.solicitacao_documento
               (id, empresa_id, colaborador_id, tipo_documento_id, estado, solicitante_user_id, solicitada_em, criado_em, atualizado_em)
             VALUES (gen_random_uuid()::text, $1, $2, $3, 'pendente', $4, now(), now(), now())`,
            empresaA,
            colaboradorB1,
            tipoIntegA,
            userId,
          ),
        ]),
      ).rejects.toThrow(/sem vinculo na mesma empresa/i);
    });

    it("REAPONTAR a empresa do vínculo que sustenta um documento falha (orfanaria o metadado)", async () => {
      const { vinculoB } = await prepararColaboradorComDocumentoEmB("REAP");
      // Reaponta o vínculo B para A: o par (colaborador, B) perde o vínculo e o
      // documento em B fica órfão.
      await expect(
        migrator.$transaction([
          migrator.$executeRawUnsafe(
            "UPDATE app.vinculo_funcional SET empresa_id = $1 WHERE id = $2",
            empresaA,
            vinculoB,
          ),
        ]),
      ).rejects.toThrow(/orfanaria|sustenta/i);
    });

    it("REMOVER o vínculo que sustenta um documento falha, mesmo havendo outro vínculo em outra empresa", async () => {
      const { vinculoB } = await prepararColaboradorComDocumentoEmB("DEL");
      await expect(
        migrator.$transaction([
          migrator.$executeRawUnsafe(
            "DELETE FROM app.vinculo_funcional WHERE id = $1",
            vinculoB,
          ),
        ]),
      ).rejects.toThrow(/orfanaria|sustenta/i);
    });

    it("SUBSTITUIR o vínculo sustentador por outro do MESMO par, numa unica transacao, CONCLUI", async () => {
      // Caso legítimo (positivo): trocar um vínculo por outro do mesmo par
      // (colaborador, empresa) enquanto existe documento. Os triggers são
      // DEFERRABLE INITIALLY DEFERRED: a verificação ocorre no COMMIT, quando o
      // par já tem o vínculo substituto — a transação conclui com sucesso.
      const { colaborador, vinculoB } =
        await prepararColaboradorComDocumentoEmB("SWAP");

      await expect(
        migrator.$transaction([
          migrator.$executeRawUnsafe(
            "DELETE FROM app.vinculo_funcional WHERE id = $1",
            vinculoB,
          ),
          migrator.$executeRawUnsafe(
            `INSERT INTO app.vinculo_funcional
               (id, colaborador_id, empresa_id, matricula, tipo, situacao, data_admissao, criado_em, atualizado_em)
             VALUES (gen_random_uuid()::text, $1, $2, 'SWAP-INTEG-B2', 'clt', 'previsto', DATE '2026-01-05', now(), now())`,
            colaborador,
            empresaB,
          ),
        ]),
      ).resolves.toBeDefined();

      // O par (colaborador, empresa B) continua com exatamente um vínculo, e o
      // documento em B permanece íntegro.
      const vinculos = await migrator.$queryRawUnsafe<{ n: bigint }[]>(
        "SELECT count(*)::bigint AS n FROM app.vinculo_funcional WHERE colaborador_id = $1 AND empresa_id = $2",
        colaborador,
        empresaB,
      );
      expect(Number(vinculos[0]!.n)).toBe(1);

      const docs = await migrator.$queryRawUnsafe<{ n: bigint }[]>(
        "SELECT count(*)::bigint AS n FROM app.documento_metadado WHERE colaborador_id = $1 AND empresa_id = $2",
        colaborador,
        empresaB,
      );
      expect(Number(docs[0]!.n)).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // Sessão, CSRF e garantias estruturais no banco
  // -------------------------------------------------------------------------

  describe("sessão, CSRF e garantias no banco", () => {
    it("requisição sem sessão é recusada (401)", async () => {
      await agent().get("/v1/documentos").expect(401);
    });

    it("mutação sem CSRF é recusada (403)", async () => {
      await agent()
        .post("/v1/tipos-documento")
        .set("Cookie", rhA.cookie)
        .send({
          empresaId: empresaA,
          codigo: "TIPO-NOCSRF",
          nome: "Sem CSRF",
          aprovacaoDpoReferencia: "DPO-REF-NOCSRF",
        })
        .expect(403);
    });

    it("NENHUMA tabela de documentos tem coluna capaz de armazenar conteúdo", async () => {
      const migrator = new PrismaClient({
        datasources: { db: { url: migratorUrl } },
      });
      try {
        const colunas = await migrator.$queryRawUnsafe<
          { column_name: string }[]
        >(
          `SELECT column_name FROM information_schema.columns
           WHERE table_schema = 'app'
             AND table_name IN ('tipo_documento','documento_metadado','solicitacao_documento')`,
        );
        const nomes = colunas.map((c) => c.column_name.toLowerCase());
        const proibidas = [
          "conteudo",
          "content",
          "arquivo",
          "file",
          "bytes",
          "base64",
          "url",
          "uri",
          "bucket",
          "chave",
          "hash",
          "mime",
          "path",
          "caminho",
          "tamanho",
          "size",
          "storage",
          "referencia_conteudo",
          "nome_arquivo",
        ];
        for (const nome of nomes) {
          expect(proibidas).not.toContain(nome);
        }
      } finally {
        await migrator.$disconnect();
      }
    });

    it("a trilha registra ação + id técnico, NUNCA o rótulo/tipo documental", async () => {
      const nomeDistintivo = "TipoRotuloSensivelSintetico";
      const tipoId = await criarTipo(
        rhA,
        empresaA,
        "TIPO-ROTULO",
        nomeDistintivo,
      );

      const migrator = new PrismaClient({
        datasources: { db: { url: migratorUrl } },
      });
      try {
        const eventos = await migrator.$queryRawUnsafe<
          { resource: string; resource_id: string | null }[]
        >(
          `SELECT resource, resource_id FROM app.audit_event
           WHERE action = 'documentos.tipo_documento.criado'`,
        );
        // Há evento, seu recurso é o rótulo TÉCNICO e o id é o UUID do tipo —
        // nunca o nome/rótulo documental.
        const doTipo = eventos.find((e) => e.resource_id === tipoId);
        expect(doTipo).toBeDefined();
        expect(doTipo!.resource).toBe("tipo_documento");

        // O nome distintivo NÃO aparece em nenhum campo textual da trilha.
        const vazamento = await migrator.$queryRawUnsafe<{ n: bigint }[]>(
          `SELECT count(*)::bigint AS n FROM app.audit_event
           WHERE resource ILIKE '%${nomeDistintivo}%'
              OR COALESCE(resource_id, '') ILIKE '%${nomeDistintivo}%'`,
        );
        expect(Number(vazamento[0]!.n)).toBe(0);
      } finally {
        await migrator.$disconnect();
      }
    });
  });

  describe("master_tecnico (T030) — perfil global controlado", () => {
    let master: Credencial;
    let tipoMasterA: string;
    let tipoMasterB: string;
    let metadadoB: string;

    async function seedMaster(email: string): Promise<Credencial> {
      const { PasswordHashService } =
        await import("../src/auth/password/password-hash.service");
      const prisma = new PrismaClient({ datasources: { db: { url: appUrl } } });
      try {
        const passwordHash = await new PasswordHashService().hash(SENHA_PADRAO);
        // O Master não pode ser criado por rota comum (T030). É provisionado
        // diretamente — o análogo de teste do runbook futuro (sujeito a MFA).
        await prisma.accessUser.create({
          data: {
            email,
            passwordHash,
            role: "master_tecnico",
            status: "active",
          },
        });
      } finally {
        await prisma.$disconnect();
      }
      return login(email, SENHA_PADRAO);
    }

    beforeAll(async () => {
      master = await seedMaster("master@ecossistema.test");

      tipoMasterA = await criarTipo(
        rhA,
        empresaA,
        "TIPO-MST-A",
        "Tipo Master A",
      );
      tipoMasterB = await criarTipo(
        rhB,
        empresaB,
        "TIPO-MST-B",
        "Tipo Master B",
      );

      const meta = await post("/v1/documentos", rhB)
        .send({
          empresaId: empresaB,
          colaboradorId: colaboradorB1,
          tipoDocumentoId: tipoMasterB,
        })
        .expect(201);
      metadadoB = meta.body.id as string;
    });

    it("lê colaboradores das DUAS empresas numa única listagem global", async () => {
      const resp = await get("/v1/colaboradores", master).expect(200);
      const ids = (resp.body.itens as { id: string }[]).map((c) => c.id);
      expect(ids).toEqual(
        expect.arrayContaining([colaboradorA1, colaboradorB1]),
      );
    });

    it("lê o detalhe de um colaborador de outra empresa (leitura global)", async () => {
      await get(`/v1/colaboradores/${colaboradorB1}`, master).expect(200);
    });

    it("lê a estrutura organizacional das duas empresas", async () => {
      const resp = await get("/v1/departamentos", master).expect(200);
      const ids = (resp.body.itens as { id: string }[]).map((d) => d.id);
      expect(ids).toEqual(
        expect.arrayContaining([departamentoA, departamentoB]),
      );
    });

    it("lê o catálogo de documentos das duas empresas", async () => {
      const resp = await get("/v1/tipos-documento", master).expect(200);
      const ids = (resp.body.itens as { id: string }[]).map((t) => t.id);
      expect(ids).toEqual(expect.arrayContaining([tipoMasterA, tipoMasterB]));
    });

    it("lê metadado de qualquer empresa, ainda sem conteúdo algum", async () => {
      const resp = await get(`/v1/documentos/${metadadoB}`, master).expect(200);
      assertSemConteudo(resp.body);
    });

    it("NÃO admite colaborador (mutação sensível negada)", async () => {
      await post("/v1/colaboradores", master)
        .send({
          nome: "Nao Deve Ser Criado",
          empresaId: empresaA,
          matricula: "MST-X-0001",
          tipo: "clt",
          dataAdmissao: ADMISSAO,
          motivoCodigo: "admissao_inicial",
          departamentoId: departamentoA,
        })
        .expect(403);
    });

    it("NÃO cria tipo de documento nem metadado (mutação negada)", async () => {
      await post("/v1/tipos-documento", master)
        .send({
          empresaId: empresaA,
          codigo: "TIPO-MST-NEG",
          nome: "Nao",
          aprovacaoDpoReferencia: "DPO-REF-SINT-0002",
        })
        .expect(403);

      await post("/v1/documentos", master)
        .send({
          empresaId: empresaB,
          colaboradorId: colaboradorB1,
          tipoDocumentoId: tipoMasterB,
        })
        .expect(403);
    });

    it("gerencia conta comum em qualquer empresa (desativa usuário da empresa B)", async () => {
      const alvo = await post("/v1/users", admin)
        .send({
          email: "descartavel.b@example.test",
          password: SENHA_PADRAO,
          role: "colaborador",
          companyId: empresaB,
        })
        .expect(201);

      await post(`/v1/users/${alvo.body.id}/disable`, master).expect(204);
    });

    it("NÃO promove ninguém a master_tecnico — nem o próprio Master, nem RH", async () => {
      await post("/v1/users", master)
        .send({
          email: "outro.master@example.test",
          password: SENHA_PADRAO,
          role: "master_tecnico",
          companyId: empresaA,
        })
        .expect(403);

      await post("/v1/users", rhA)
        .send({
          email: "master.por.rh@example.test",
          password: SENHA_PADRAO,
          role: "master_tecnico",
          companyId: empresaA,
        })
        .expect(403);
    });

    it("registra as consultas globais na trilha, sem dado pessoal", async () => {
      const prisma = new PrismaClient({ datasources: { db: { url: appUrl } } });
      try {
        const eventos = await prisma.auditEvent.findMany({
          where: { action: "master_consulta_global" },
        });
        // As leituras globais acima geraram eventos.
        expect(eventos.length).toBeGreaterThan(0);
        // Ator é o Master; empresa nula (consulta atravessa empresas); só id
        // técnico como recurso — nunca nome ou matrícula.
        expect(eventos.every((e) => e.actorRole === "master_tecnico")).toBe(
          true,
        );
        expect(eventos.every((e) => e.companyId === null)).toBe(true);
        expect(
          eventos.every(
            (e) =>
              e.resourceId === null ||
              /^[0-9a-fA-F-]{36}$/.test(e.resourceId ?? ""),
          ),
        ).toBe(true);
      } finally {
        await prisma.$disconnect();
      }
    });
  });
});
