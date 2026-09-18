import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
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
import { totpCodeForEpoch } from "../src/auth/mfa/crypto/totp.util";

/**
 * T125 — MFA TOTP: cadastro → confirmação → login com 2º fator → sessão plena,
 * mais challenge expirado/reutilizado/inválido, código de recuperação de uso
 * único, reset administrativo (autorizado, negado a DP, isolado entre
 * empresas) e ausência de segredo/código em resposta/auditoria.
 *
 * Integração real com PostgreSQL efêmero (Testcontainers), mesmo padrão de
 * `identity.e2e-spec.ts`. Requer Docker. Fixtures 100% sintéticas.
 */

jest.setTimeout(300_000);

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

const SENHA_SINTETICA = "senha-sintetica-mfa-bem-longa";

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

describe("MFA TOTP (e2e)", () => {
  let container: StartedTestContainer;
  let app: INestApplication;
  let prisma: PrismaClient;
  let appUrl: string;
  const agent = () => request(app.getHttpServer());

  let masterCookie: string;
  let masterCsrf: string;

  interface Sessao {
    cookie: string;
    csrf: string;
  }

  async function login(
    email: string,
    password: string,
  ): Promise<{
    mfaRequired: boolean;
    challengeToken?: string;
    sessao?: Sessao;
  }> {
    const res = await agent()
      .post("/v1/auth/login")
      .send({ email, password })
      .expect(200);
    if (res.body.mfaRequired) {
      return { mfaRequired: true, challengeToken: res.body.challengeToken };
    }
    const cookies = res.headers["set-cookie"] as unknown as string[];
    const cookie = cookies
      .find((c) => c.startsWith("evolli_session="))!
      .split(";")[0]!;
    return { mfaRequired: false, sessao: { cookie, csrf: res.body.csrfToken } };
  }

  async function criarColaborador(
    email: string,
    companyId: string,
  ): Promise<string> {
    const res = await agent()
      .post("/v1/users")
      .set("Cookie", masterCookie)
      .set("x-csrf-token", masterCsrf)
      .send({
        email,
        password: SENHA_SINTETICA,
        role: "colaborador",
        companyId,
      })
      .expect(201);
    return res.body.id as string;
  }

  /** Cadastra e ativa MFA para uma conta; devolve secret e os recovery codes. */
  async function configurarMfa(
    sessao: Sessao,
  ): Promise<{ secret: string; recoveryCodes: string[] }> {
    const enroll = await agent()
      .post("/v1/auth/mfa/totp/enroll")
      .set("Cookie", sessao.cookie)
      .set("x-csrf-token", sessao.csrf)
      .expect(201);
    const secret = enroll.body.secretBase32 as string;
    const confirm = await agent()
      .post("/v1/auth/mfa/totp/confirm")
      .set("Cookie", sessao.cookie)
      .set("x-csrf-token", sessao.csrf)
      .send({ code: totpCodeForEpoch(secret, Date.now()) })
      .expect(201);
    return { secret, recoveryCodes: confirm.body.recoveryCodes as string[] };
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
    // T131 — esta suíte exercita os fluxos de MFA, então o interruptor de
    // servidor precisa estar ATIVADO. O comportamento com MFA desativado
    // (rotas 404, login por senha, anti-bypass) é coberto por testes unitários.
    process.env.MFA_ENABLED = "true";
    // Chave de cifragem do segredo TOTP (32 bytes Base64). Sintética, só para
    // o ambiente efêmero deste teste — nunca uma chave real.
    process.env.MFA_TOTP_ENCRYPTION_KEY = randomBytes(32).toString("base64");

    app = await buildApp();
    prisma = new PrismaClient({ datasources: { db: { url: appUrl } } });

    // master_tecnico semeado direto (análogo de teste do runbook, sujeito a MFA).
    const { PasswordHashService } =
      await import("../src/auth/password/password-hash.service");
    await prisma.accessUser.create({
      data: {
        email: "master.mfa@example.test",
        passwordHash: await new PasswordHashService().hash(SENHA_SINTETICA),
        role: "master_tecnico",
        status: "active",
      },
    });
    const master = await login("master.mfa@example.test", SENHA_SINTETICA);
    masterCookie = master.sessao!.cookie;
    masterCsrf = master.sessao!.csrf;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
    await container.stop();
  });

  it("cadastro → confirmação → login MFA → sessão plena", async () => {
    const id = await criarColaborador("fluxo@example.test", "empresa-mfa-a");
    expect(id).toEqual(expect.any(String));

    const inicial = await login("fluxo@example.test", SENHA_SINTETICA);
    expect(inicial.mfaRequired).toBe(false); // ainda sem MFA
    const { secret } = await configurarMfa(inicial.sessao!);

    // Agora o login exige 2º fator — nenhuma sessão plena ainda.
    const comMfa = await login("fluxo@example.test", SENHA_SINTETICA);
    expect(comMfa.mfaRequired).toBe(true);
    expect(comMfa.challengeToken).toEqual(expect.any(String));

    const verify = await agent()
      .post("/v1/auth/mfa/verify")
      .send({
        challengeToken: comMfa.challengeToken,
        code: totpCodeForEpoch(secret, Date.now()),
      })
      .expect(200);
    expect(verify.body.csrfToken).toEqual(expect.any(String));
    const cookies = verify.headers["set-cookie"] as unknown as string[];
    const cookie = cookies
      .find((c) => c.startsWith("evolli_session="))!
      .split(";")[0]!;
    await agent().get("/v1/users/me").set("Cookie", cookie).expect(200);
  });

  it("o segredo NUNCA volta após a confirmação; confirm devolve exatamente 10 códigos", async () => {
    await criarColaborador("segredo@example.test", "empresa-mfa-a");
    const s = await login("segredo@example.test", SENHA_SINTETICA);
    const { secret, recoveryCodes } = await configurarMfa(s.sessao!);
    expect(recoveryCodes).toHaveLength(10);

    // O login MFA e o verify jamais retornam o segredo.
    const comMfa = await login("segredo@example.test", SENHA_SINTETICA);
    const verify = await agent()
      .post("/v1/auth/mfa/verify")
      .send({
        challengeToken: comMfa.challengeToken,
        code: totpCodeForEpoch(secret, Date.now()),
      })
      .expect(200);
    const corpoLogin = JSON.stringify(comMfa);
    const corpoVerify = JSON.stringify(verify.body);
    expect(corpoLogin).not.toContain(secret);
    expect(corpoVerify).not.toContain(secret);
  });

  it("challenge inválido, expirado e reutilizado → 401 genérico", async () => {
    await criarColaborador("challenge@example.test", "empresa-mfa-a");
    const s = await login("challenge@example.test", SENHA_SINTETICA);
    const { secret } = await configurarMfa(s.sessao!);

    // Inválido (token aleatório).
    await agent()
      .post("/v1/auth/mfa/verify")
      .send({ challengeToken: "token-inexistente", code: "000000" })
      .expect(401);

    // Expirado: força expiresAt no passado.
    const expirado = await login("challenge@example.test", SENHA_SINTETICA);
    await prisma.accessMfaChallenge.updateMany({
      where: { consumedAt: null },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await agent()
      .post("/v1/auth/mfa/verify")
      .send({
        challengeToken: expirado.challengeToken,
        code: totpCodeForEpoch(secret, Date.now()),
      })
      .expect(401);

    // Reutilizado: um challenge novo, usado com sucesso, não vale de novo.
    const novo = await login("challenge@example.test", SENHA_SINTETICA);
    await agent()
      .post("/v1/auth/mfa/verify")
      .send({
        challengeToken: novo.challengeToken,
        code: totpCodeForEpoch(secret, Date.now()),
      })
      .expect(200);
    await agent()
      .post("/v1/auth/mfa/verify")
      .send({
        challengeToken: novo.challengeToken,
        code: totpCodeForEpoch(secret, Date.now()),
      })
      .expect(401);
  });

  it("código de recuperação é de uso único", async () => {
    await criarColaborador("recovery@example.test", "empresa-mfa-a");
    const s = await login("recovery@example.test", SENHA_SINTETICA);
    const { recoveryCodes } = await configurarMfa(s.sessao!);
    const codigo = recoveryCodes[0]!;

    // 1º uso: sucesso.
    const l1 = await login("recovery@example.test", SENHA_SINTETICA);
    await agent()
      .post("/v1/auth/mfa/verify")
      .send({ challengeToken: l1.challengeToken, code: codigo })
      .expect(200);

    // 2º uso do MESMO código: falha.
    const l2 = await login("recovery@example.test", SENHA_SINTETICA);
    await agent()
      .post("/v1/auth/mfa/verify")
      .send({ challengeToken: l2.challengeToken, code: codigo })
      .expect(401);
  });

  it("duas verificações concorrentes, challenges distintos e MESMO código: só uma sessão é emitida", async () => {
    await criarColaborador("concorrente@example.test", "empresa-mfa-a");
    const s = await login("concorrente@example.test", SENHA_SINTETICA);
    const { recoveryCodes } = await configurarMfa(s.sessao!);
    const codigo = recoveryCodes[0]!;

    // Dois challenges DISTINTOS para a mesma conta.
    const a = await login("concorrente@example.test", SENHA_SINTETICA);
    const b = await login("concorrente@example.test", SENHA_SINTETICA);

    // Disparadas em paralelo com o MESMO código de recuperação. O consumo
    // atômico (updateMany + count === 1) garante que só uma vence; a outra
    // recebe 401 genérico e não emite sessão.
    const [r1, r2] = await Promise.all([
      agent()
        .post("/v1/auth/mfa/verify")
        .send({ challengeToken: a.challengeToken, code: codigo }),
      agent()
        .post("/v1/auth/mfa/verify")
        .send({ challengeToken: b.challengeToken, code: codigo }),
    ]);

    const statuses = [r1.status, r2.status].sort();
    expect(statuses).toEqual([200, 401]);

    // Exatamente uma resposta traz cookie de sessão.
    const comCookie = [r1, r2].filter((r) => r.headers["set-cookie"]);
    expect(comCookie).toHaveLength(1);

    // O código não vale mais para um terceiro challenge.
    const c = await login("concorrente@example.test", SENHA_SINTETICA);
    await agent()
      .post("/v1/auth/mfa/verify")
      .send({ challengeToken: c.challengeToken, code: codigo })
      .expect(401);
  });

  it("código TOTP errado não cria sessão (401), sem enumerar", async () => {
    await criarColaborador("errado@example.test", "empresa-mfa-a");
    const s = await login("errado@example.test", SENHA_SINTETICA);
    await configurarMfa(s.sessao!);
    const comMfa = await login("errado@example.test", SENHA_SINTETICA);
    const res = await agent()
      .post("/v1/auth/mfa/verify")
      .send({ challengeToken: comMfa.challengeToken, code: "000000" })
      .expect(401);
    expect(res.headers["set-cookie"]).toBeUndefined();
  });

  it("reset por master remove o fator, revoga sessões e dispensa MFA no próximo login", async () => {
    const id = await criarColaborador("reset@example.test", "empresa-mfa-a");
    const s = await login("reset@example.test", SENHA_SINTETICA);
    const { secret } = await configurarMfa(s.sessao!);

    // Loga com MFA e guarda a sessão.
    const comMfa = await login("reset@example.test", SENHA_SINTETICA);
    const verify = await agent()
      .post("/v1/auth/mfa/verify")
      .send({
        challengeToken: comMfa.challengeToken,
        code: totpCodeForEpoch(secret, Date.now()),
      })
      .expect(200);
    const cookies = verify.headers["set-cookie"] as unknown as string[];
    const cookieAntes = cookies
      .find((c) => c.startsWith("evolli_session="))!
      .split(";")[0]!;
    await agent().get("/v1/users/me").set("Cookie", cookieAntes).expect(200);

    // Master reseta o MFA da conta.
    await agent()
      .post(`/v1/users/${id}/mfa/reset`)
      .set("Cookie", masterCookie)
      .set("x-csrf-token", masterCsrf)
      .expect(204);

    // Sessão anterior foi revogada.
    await agent().get("/v1/users/me").set("Cookie", cookieAntes).expect(401);

    // Próximo login NÃO exige MFA (fator removido) — prova que sumiu.
    const depois = await login("reset@example.test", SENHA_SINTETICA);
    expect(depois.mfaRequired).toBe(false);

    // Fator e códigos de recuperação foram apagados.
    expect(
      await prisma.accessMfaTotp.findUnique({ where: { userId: id } }),
    ).toBeNull();
    expect(
      await prisma.accessMfaRecoveryCode.count({ where: { userId: id } }),
    ).toBe(0);
  });

  it("DP não pode resetar MFA (403); RH de outra empresa recebe 404 anti-enumeração", async () => {
    // Alvo na empresa A, com MFA ativo.
    const alvoId = await criarColaborador(
      "alvo-reset@example.test",
      "empresa-mfa-a",
    );
    const sAlvo = await login("alvo-reset@example.test", SENHA_SINTETICA);
    await configurarMfa(sAlvo.sessao!);

    // DP da empresa A.
    await criarColaboradorComPapel("dp@example.test", "empresa-mfa-a", "dp");
    const dp = await login("dp@example.test", SENHA_SINTETICA);
    await agent()
      .post(`/v1/users/${alvoId}/mfa/reset`)
      .set("Cookie", dp.sessao!.cookie)
      .set("x-csrf-token", dp.sessao!.csrf)
      .expect(403);
    // Fator do alvo permanece intacto.
    expect(
      await prisma.accessMfaTotp.findUnique({ where: { userId: alvoId } }),
    ).not.toBeNull();

    // RH da empresa B tenta resetar conta da empresa A → 404 anti-enumeração.
    await criarColaboradorComPapel("rh-b@example.test", "empresa-mfa-b", "rh");
    const rhB = await login("rh-b@example.test", SENHA_SINTETICA);
    const negado = await agent()
      .post(`/v1/users/${alvoId}/mfa/reset`)
      .set("Cookie", rhB.sessao!.cookie)
      .set("x-csrf-token", rhB.sessao!.csrf)
      .expect(404);
    expect(negado.body).toEqual({
      status_code: 404,
      message: "Recurso não encontrado.",
      request_id: expect.any(String),
      timestamp: expect.any(String),
    });
  });

  it("nenhum evento de auditoria de MFA contém segredo, código ou token de challenge", async () => {
    await criarColaborador("audit@example.test", "empresa-mfa-a");
    const s = await login("audit@example.test", SENHA_SINTETICA);
    const { secret, recoveryCodes } = await configurarMfa(s.sessao!);
    const comMfa = await login("audit@example.test", SENHA_SINTETICA);
    await agent()
      .post("/v1/auth/mfa/verify")
      .send({
        challengeToken: comMfa.challengeToken,
        code: totpCodeForEpoch(secret, Date.now()),
      })
      .expect(200);

    const eventos = await prisma.auditEvent.findMany({
      where: {
        action: {
          in: [
            "mfa_enrollment_started",
            "mfa_confirmed",
            "mfa_challenge_succeeded",
          ],
        },
      },
    });
    expect(eventos.length).toBeGreaterThan(0);
    const serial = JSON.stringify(eventos);
    expect(serial).not.toContain(secret);
    expect(serial).not.toContain(comMfa.challengeToken);
    for (const rc of recoveryCodes) {
      expect(serial).not.toContain(rc);
    }
  });

  async function criarColaboradorComPapel(
    email: string,
    companyId: string,
    role: "rh" | "dp",
  ): Promise<string> {
    const res = await agent()
      .post("/v1/users")
      .set("Cookie", masterCookie)
      .set("x-csrf-token", masterCsrf)
      .send({ email, password: SENHA_SINTETICA, role, companyId })
      .expect(201);
    return res.body.id as string;
  }
});
