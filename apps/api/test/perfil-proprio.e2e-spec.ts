/**
 * T208 — Configurações › Meu perfil: o nome de exibição da própria conta
 * (e2e, PostgreSQL real e efêmero via Testcontainers; dados sintéticos).
 *
 * O que esta suíte prova, sobre o banco de verdade:
 *
 * - a migration bate com o schema (sem diferença entre o banco migrado e o
 *   `schema.prisma`) e a CHECK do banco segura nome fora da forma;
 * - todo papel altera o PRÓPRIO nome, e só ele: não há rota para outra conta,
 *   e campo proibido no corpo é recusado sem mudar nada;
 * - validação de tamanho, normalização e limpeza (volta o e-mail);
 * - concorrência otimista: versão velha e gravação simultânea não
 *   sobrescrevem a edição concorrente;
 * - `perfilAtualizadoEm` muda só ao salvar o perfil — não com papel, senha ou
 *   desativação;
 * - auditoria própria sem o conteúdo do nome;
 * - o nome é global da conta (sobrevive à troca de empresa) e não aparece na
 *   listagem de Contas de acesso.
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
import {
  generateOpaqueToken,
  hashOpaqueToken,
} from "../src/auth/crypto/opaque-token.util";

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

const SENHA_PADRAO = "Perfil!Proprio2026#Teste";
const SENHA_NOVA = "Perfil!Proprio2026#Trocada";

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
  email: string;
  cookie: string;
  csrfToken: string;
}

describe("T208 — Meu perfil: nome de exibição da própria conta (e2e)", () => {
  let container: StartedTestContainer;
  let appUrl: string;
  let migratorUrl: string;
  let app: INestApplication;
  let prisma: PrismaClient;

  let master: Credencial;
  let empresaA: string;
  let empresaB: string;
  /** Uma credencial por papel conhecido. */
  const porPapel: Record<string, Credencial> = {};

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
    return { email, cookie, csrfToken: response.body.csrfToken };
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

  async function lerMe(cred: Credencial) {
    return (await get("/v1/users/me", cred).expect(200)).body as {
      id: string;
      email: string;
      role: string;
      companyId: string | null;
      nomeExibicao: string | null;
      perfilAtualizadoEm: string | null;
    };
  }

  /**
   * Salva o nome a partir da versão que a conta tem agora e confere o status.
   */
  async function salvarNome(
    cred: Credencial,
    nomeExibicao: unknown,
    status: number,
  ) {
    const atual = await lerMe(cred);
    return patch("/v1/users/me", cred)
      .send({ nomeExibicao, perfilAtualizadoEmLido: atual.perfilAtualizadoEm })
      .expect(status);
  }

  async function conta(email: string) {
    return prisma.accessUser.findUniqueOrThrow({ where: { email } });
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
        ADMIN_BOOTSTRAP_EMAIL: "admin.perfil@example.test",
        ADMIN_BOOTSTRAP_PASSWORD: SENHA_PADRAO,
      }).status,
    ).toBe(0);
    porPapel.admin_tecnico = await login(
      "admin.perfil@example.test",
      SENHA_PADRAO,
    );

    const { PasswordHashService } =
      await import("../src/auth/password/password-hash.service");
    const passwordHash = await new PasswordHashService().hash(SENHA_PADRAO);
    await prisma.accessUser.create({
      data: {
        email: "master.perfil@example.test",
        passwordHash,
        role: "master_tecnico",
        status: "active",
      },
    });
    master = await login("master.perfil@example.test", SENHA_PADRAO);
    porPapel.master_tecnico = master;

    empresaA = (
      await post("/v1/empresas", master)
        .send({ codigo: "PERFA", nome: "Empresa Perfil A" })
        .expect(201)
    ).body.id;
    empresaB = (
      await post("/v1/empresas", master)
        .send({ codigo: "PERFB", nome: "Empresa Perfil B" })
        .expect(201)
    ).body.id;

    for (const papel of ["rh", "dp", "gestor", "financeiro", "colaborador"]) {
      porPapel[papel] = await criarUsuario(
        `${papel}.perfil@example.test`,
        papel,
        empresaA,
      );
    }
    // `auditor` e `dpo` não são provisionáveis por rota (ADR 0012): as contas
    // legadas existem só no banco, então entram por ele — como o master.
    for (const papel of ["auditor", "dpo"] as const) {
      await prisma.accessUser.create({
        data: {
          email: `${papel}.perfil@example.test`,
          passwordHash,
          role: papel,
          companyId: empresaA,
          status: "active",
        },
      });
      porPapel[papel] = await login(
        `${papel}.perfil@example.test`,
        SENHA_PADRAO,
      );
    }
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    await app?.close();
    await container?.stop();
  });

  // -------------------------------------------------------------------------
  describe("1. migration e banco", () => {
    it("o banco migrado não difere do schema (a migration bate com o schema.prisma)", () => {
      const saida = execFileSync(
        process.execPath,
        [
          PRISMA_CLI,
          "migrate",
          "diff",
          "--from-url",
          migratorUrl,
          "--to-schema-datamodel",
          "prisma/schema.prisma",
          "--exit-code",
        ],
        {
          cwd: API_ROOT,
          env: {
            ...process.env,
            DATABASE_URL: migratorUrl,
            MIGRATE_DATABASE_URL: migratorUrl,
          },
          stdio: "pipe",
          encoding: "utf8",
        },
      );
      expect(saida).toContain("No difference detected");
    });

    it("contas existentes ficam sem nome e sem data de perfil (nada inventado)", async () => {
      const contas = await prisma.accessUser.findMany();
      expect(contas.length).toBeGreaterThan(0);
      for (const c of contas) {
        expect(c.nomeExibicao).toBeNull();
        expect(c.perfilAtualizadoEm).toBeNull();
      }
    });

    it("a CHECK do banco recusa nome curto ou com espaço nas extremidades", async () => {
      const { id } = await conta("dpo.perfil@example.test");
      await expect(
        prisma.accessUser.update({
          where: { id },
          data: { nomeExibicao: "A" },
        }),
      ).rejects.toThrow();
      await expect(
        prisma.accessUser.update({
          where: { id },
          data: { nomeExibicao: " Ana" },
        }),
      ).rejects.toThrow();
      expect((await conta("dpo.perfil@example.test")).nomeExibicao).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  describe("2. cada papel altera o próprio nome", () => {
    it.each([
      "rh",
      "dp",
      "master_tecnico",
      "gestor",
      "financeiro",
      "colaborador",
      "auditor",
      "dpo",
      "admin_tecnico",
    ])(
      "%s: salva, lê de volta em /users/me e gera auditoria sem o nome",
      async (papel) => {
        const cred = porPapel[papel]!;
        const nome = `Pessoa ${papel.replace("_", " ")} Sintética`;
        const antes = await lerMe(cred);

        const r = await salvarNome(cred, nome, 200);
        expect(r.body.nomeExibicao).toBe(nome);
        expect(r.body.perfilAtualizadoEm).not.toBeNull();
        // A resposta é a mesma projeção de GET /users/me: papel, e-mail e
        // empresa seguem os mesmos.
        expect(r.body.email).toBe(antes.email);
        expect(r.body.role).toBe(antes.role);
        expect(r.body.companyId).toBe(antes.companyId);
        expect(r.body).not.toHaveProperty("passwordHash");

        const depois = await lerMe(cred);
        expect(depois.nomeExibicao).toBe(nome);
        expect(depois.perfilAtualizadoEm).toBe(r.body.perfilAtualizadoEm);

        const eventos = await prisma.auditEvent.findMany({
          where: { action: "conta_perfil_atualizado", actorUserId: antes.id },
        });
        expect(eventos).toHaveLength(1);
        expect(eventos[0]).toMatchObject({
          resource: "access_user",
          resourceId: antes.id,
          actorRole: papel,
          result: "success",
        });
        expect(JSON.stringify(eventos[0])).not.toContain("Sintética");
      },
    );

    it("o valor persistido é o normalizado (espaços juntados e aparados)", async () => {
      const cred = porPapel.colaborador!;
      await salvarNome(cred, "   Maria    da   Silva  ", 200);
      expect((await conta(cred.email)).nomeExibicao).toBe("Maria da Silva");
    });

    it("vazio limpa o nome (a tela volta ao e-mail); null também", async () => {
      const cred = porPapel.financeiro!;
      await salvarNome(cred, "Nome Temporario", 200);
      const r = await salvarNome(cred, "   ", 200);
      expect(r.body.nomeExibicao).toBeNull();
      expect((await conta(cred.email)).nomeExibicao).toBeNull();

      await salvarNome(cred, "De Novo", 200);
      await salvarNome(cred, null, 200);
      expect((await conta(cred.email)).nomeExibicao).toBeNull();
    });

    it("tamanho: 80 caracteres passa; 1 e 81 são recusados (400) sem gravar", async () => {
      const cred = porPapel.auditor!;
      await salvarNome(cred, "a".repeat(80), 200);
      const gravado = await conta(cred.email);

      await salvarNome(cred, "A", 400);
      await salvarNome(cred, "a".repeat(81), 400);
      await salvarNome(cred, "1234", 400);
      const depois = await conta(cred.email);
      expect(depois.nomeExibicao).toBe(gravado.nomeExibicao);
      expect(depois.perfilAtualizadoEm).toEqual(gravado.perfilAtualizadoEm);
    });
  });

  // -------------------------------------------------------------------------
  describe("3. só a própria conta, só o nome", () => {
    it("não existe rota para alterar o perfil de outra conta (404)", async () => {
      const outra = await conta("colaborador.perfil@example.test");
      const r = await patch(`/v1/users/${outra.id}`, porPapel.rh!).send({
        nomeExibicao: "Invasao",
        perfilAtualizadoEmLido: null,
      });
      expect(r.status).toBe(404);
      expect((await conta(outra.email)).nomeExibicao).not.toBe("Invasao");
    });

    it.each([
      ["id", (alvo: string) => alvo],
      ["userId", (alvo: string) => alvo],
      ["email", () => "trocado@example.test"],
      ["role", () => "master_tecnico"],
      ["companyId", () => "empresa-qualquer"],
      ["status", () => "disabled"],
    ])(
      "campo proibido no corpo (%s) é recusado com 400 e nada muda",
      async (campo, valor) => {
        const alvo = await conta("colaborador.perfil@example.test");
        const cred = porPapel.gestor!;
        const antes = await conta(cred.email);
        const atual = await lerMe(cred);
        await patch("/v1/users/me", cred)
          .send({
            nomeExibicao: "Tentativa",
            perfilAtualizadoEmLido: atual.perfilAtualizadoEm,
            [campo]: valor(alvo.id),
          })
          .expect(400);
        const depois = await conta(cred.email);
        expect(depois).toEqual(antes);
        expect((await conta(alvo.email)).nomeExibicao).not.toBe("Tentativa");
      },
    );

    it("sem CSRF: 403; sem sessão: 401", async () => {
      const cred = porPapel.dp!;
      await agent()
        .patch("/v1/users/me")
        .set("Cookie", cred.cookie)
        .send({ nomeExibicao: "Sem Csrf", perfilAtualizadoEmLido: null })
        .expect(403);
      await agent()
        .patch("/v1/users/me")
        .send({ nomeExibicao: "Sem Sessao", perfilAtualizadoEmLido: null })
        .expect(401);
    });
  });

  // -------------------------------------------------------------------------
  describe("4. concorrência otimista", () => {
    it("versão velha (outra sessão salvou antes): 409 e o valor gravado fica", async () => {
      const email = "rh.perfil@example.test";
      const sessaoUm = porPapel.rh!;
      const sessaoDois = await login(email, SENHA_PADRAO);

      const lidaPelasDuas = (await lerMe(sessaoUm)).perfilAtualizadoEm;
      await patch("/v1/users/me", sessaoUm)
        .send({
          nomeExibicao: "Primeira",
          perfilAtualizadoEmLido: lidaPelasDuas,
        })
        .expect(200);

      const r = await patch("/v1/users/me", sessaoDois).send({
        nomeExibicao: "Segunda",
        perfilAtualizadoEmLido: lidaPelasDuas,
      });
      expect(r.status).toBe(409);
      expect(r.body.message).toBe("Conflito ao processar a requisição.");
      expect(JSON.stringify(r.body)).not.toContain("Primeira");
      expect((await conta(email)).nomeExibicao).toBe("Primeira");
    });

    it("duas gravações simultâneas da mesma versão: só uma passa", async () => {
      const cred = porPapel.colaborador!;
      const lida = (await lerMe(cred)).perfilAtualizadoEm;
      const [a, b] = await Promise.all([
        patch("/v1/users/me", cred).send({
          nomeExibicao: "Simultaneo Um",
          perfilAtualizadoEmLido: lida,
        }),
        patch("/v1/users/me", cred).send({
          nomeExibicao: "Simultaneo Dois",
          perfilAtualizadoEmLido: lida,
        }),
      ]);
      expect([a.status, b.status].sort()).toEqual([200, 409]);
      const vencedor = a.status === 200 ? "Simultaneo Um" : "Simultaneo Dois";
      expect((await conta(cred.email)).nomeExibicao).toBe(vencedor);
    });
  });

  // -------------------------------------------------------------------------
  describe("5. a data do perfil muda só ao salvar o perfil", () => {
    it("troca de papel, redefinição de senha e desativação não mexem nela", async () => {
      const email = "papel.perfil@example.test";
      const cred = await criarUsuario(email, "colaborador", empresaA);
      await salvarNome(cred, "Conta Datada", 200);
      const salvo = await conta(email);
      expect(salvo.perfilAtualizadoEm).not.toBeNull();

      // Papel (ato administrativo de outra conta).
      await patch(`/v1/users/${salvo.id}/role`, porPapel.rh!)
        .send({ role: "financeiro" })
        .expect(200);
      const aposPapel = await conta(email);
      expect(aposPapel.updatedAt.getTime()).toBeGreaterThan(
        salvo.updatedAt.getTime(),
      );
      expect(aposPapel.perfilAtualizadoEm).toEqual(salvo.perfilAtualizadoEm);

      // Senha (redefinição com token de uso único).
      const token = generateOpaqueToken();
      await prisma.accessPasswordResetToken.create({
        data: {
          userId: salvo.id,
          tokenHash: hashOpaqueToken(token),
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        },
      });
      await agent()
        .post("/v1/auth/password/reset")
        .send({ token, newPassword: SENHA_NOVA })
        .expect(204);
      const aposSenha = await conta(email);
      expect(aposSenha.passwordHash).not.toBe(aposPapel.passwordHash);
      expect(aposSenha.perfilAtualizadoEm).toEqual(salvo.perfilAtualizadoEm);
      expect(aposSenha.nomeExibicao).toBe("Conta Datada");

      // Desativação.
      await post(`/v1/users/${salvo.id}/disable`, porPapel.rh!).expect(204);
      const aposDesativar = await conta(email);
      expect(aposDesativar.status).toBe("disabled");
      expect(aposDesativar.perfilAtualizadoEm).toEqual(
        salvo.perfilAtualizadoEm,
      );
    });

    it("conta desativada não grava mais nada (a sessão cai)", async () => {
      const email = "desativada.perfil@example.test";
      const cred = await criarUsuario(email, "colaborador", empresaA);
      const { id } = await conta(email);
      await post(`/v1/users/${id}/disable`, porPapel.rh!).expect(204);
      await patch("/v1/users/me", cred)
        .send({
          nomeExibicao: "Depois De Desativada",
          perfilAtualizadoEmLido: null,
        })
        .expect(401);
      expect((await conta(email)).nomeExibicao).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  describe("6. global da conta e fora da listagem administrativa", () => {
    it("o nome sobrevive à troca de empresa (não é por empresa)", async () => {
      const email = "rh.global.perfil@example.test";
      const cred = await criarUsuario(email, "rh", empresaA);
      const conta_ = await conta(email);
      await prisma.accessUserEmpresa.create({
        data: {
          userId: conta_.id,
          empresaId: empresaB,
          concedidoPorUserId: (await conta("master.perfil@example.test")).id,
        },
      });
      await salvarNome(cred, "Nome Global", 200);

      await post("/v1/auth/contexto/empresa", cred)
        .send({ empresaId: empresaB })
        .expect(200);
      const me = await lerMe(cred);
      expect(me.companyId).toBe(empresaB);
      expect(me.nomeExibicao).toBe("Nome Global");
    });

    it("a listagem de Contas de acesso não traz nome de exibição nem data do perfil", async () => {
      const r = await get("/v1/users?limit=100", master).expect(200);
      expect(r.body.items.length).toBeGreaterThan(0);
      for (const item of r.body.items) {
        expect(item).not.toHaveProperty("nomeExibicao");
        expect(item).not.toHaveProperty("perfilAtualizadoEm");
      }
      expect(JSON.stringify(r.body)).not.toContain("Nome Global");
    });
  });
});
