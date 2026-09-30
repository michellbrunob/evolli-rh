import { execFileSync } from "node:child_process";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { PrismaClient } from "@prisma/client";
import cookieParser from "cookie-parser";
import { GenericContainer, StartedTestContainer, Wait } from "testcontainers";
import { AppModule } from "../src/app.module";
import { AllExceptionsFilter } from "../src/common/filters/http-exception.filter";
import { requestIdMiddleware } from "../src/common/request-id";
import {
  PERFIS_DEMO,
  SENHA_DEMO,
  semearDemonstracao,
} from "../src/seed/demo-seed";

/**
 * T141 — prova do seed de demonstração contra PostgreSQL REAL.
 *
 * Esta máquina de desenvolvimento não tem Docker, então a garantia de que o
 * seed funciona e é idempotente não pode vir de uma execução manual: vem
 * daqui, e roda na CI a cada push. O que se prova:
 *
 *  - o seed completa contra um banco migrado do zero, com os papéis
 *    `evolli_migrator`/`evolli_app` segregados como em qualquer ambiente;
 *  - rodar DUAS vezes não duplica nada — a segunda execução só reaproveita;
 *  - cada perfil sintético documentado consegue autenticar;
 *  - os cenários que as telas distinguem existem (um vínculo x dois vínculos);
 *  - o isolamento entre as duas empresas de demonstração é real;
 *  - nenhum dado é apagado (o seed nunca precisa de DELETE, que o banco revoga
 *    em `solicitacao_pessoa` e `audit_event`).
 *
 * Todos os dados são sintéticos.
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

describe("Seed do ambiente local de demonstração (T141, e2e)", () => {
  let container: StartedTestContainer;
  let appUrl: string;
  let app: INestApplication;
  let baseUrl: string;

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
    app = await buildApp();
    // O seed fala HTTP como qualquer cliente, então precisa de um servidor
    // realmente escutando — não basta `app.init()`.
    await app.listen(0, "127.0.0.1");
    const endereco = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${endereco.port}`;
  });

  afterAll(async () => {
    await app?.close();
    await container?.stop();
  });

  it("recusa apontar para uma API que não seja local", async () => {
    await expect(
      semearDemonstracao("https://evolli.exemplo.com", appUrl),
    ).rejects.toThrow(/só aceita API local/i);
  });

  it("semeia um banco vazio e é idempotente na segunda execução", async () => {
    const primeira = await semearDemonstracao(baseUrl, appUrl);

    expect(primeira.criados).toBeGreaterThan(0);
    expect(primeira.empresas).toBe(2);
    expect(primeira.usuarios).toBe(PERFIS_DEMO.length);
    expect(primeira.colaboradores).toBe(2);
    expect(primeira.vinculos).toBe(2);

    // Segunda execução: encontra tudo e não escreve nada.
    const segunda = await semearDemonstracao(baseUrl, appUrl);

    expect(segunda.criados).toBe(0);
    expect(segunda.reaproveitados).toBeGreaterThan(0);
    expect(segunda.empresas).toBe(primeira.empresas);
    expect(segunda.usuarios).toBe(primeira.usuarios);
    expect(segunda.colaboradores).toBe(primeira.colaboradores);
    expect(segunda.vinculos).toBe(primeira.vinculos);

    // E o banco confirma: nenhuma duplicata de empresa, conta ou vínculo.
    const prisma = new PrismaClient({ datasources: { db: { url: appUrl } } });
    try {
      const empresas = await prisma.empresa.findMany({
        where: { codigo: { startsWith: "DEMO" } },
        select: { codigo: true },
      });
      expect(empresas.map((e) => e.codigo).sort()).toEqual([
        "DEMOALFA",
        "DEMOBETA",
      ]);

      const contas = await prisma.accessUser.findMany({
        where: { email: { endsWith: "@evolli.local" } },
        select: { email: true },
      });
      expect(new Set(contas.map((c) => c.email)).size).toBe(contas.length);
      expect(contas.length).toBe(PERFIS_DEMO.length);

      const vinculos = await prisma.vinculoFuncional.findMany({
        where: { matricula: { startsWith: "DEMO-" } },
        select: { matricula: true },
      });
      expect(vinculos.map((v) => v.matricula).sort()).toEqual([
        "DEMO-A-0001",
        "DEMO-A-0002",
        "DEMO-A-0003",
        "DEMO-B-0001",
      ]);
    } finally {
      await prisma.$disconnect();
    }
  });

  it("todo perfil sintético documentado consegue autenticar", async () => {
    for (const perfil of PERFIS_DEMO) {
      const res = await fetch(`${baseUrl}/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: perfil.email, password: SENHA_DEMO }),
      });
      expect([perfil.email, res.status]).toEqual([perfil.email, 200]);
      const corpo = (await res.json()) as { csrfToken?: string };
      expect(corpo.csrfToken).toBeTruthy();
    }
  });

  it("os perfis recebem exatamente o papel e a empresa documentados", async () => {
    const prisma = new PrismaClient({ datasources: { db: { url: appUrl } } });
    try {
      const alfa = await prisma.empresa.findFirstOrThrow({
        where: { codigo: "DEMOALFA" },
        select: { id: true },
      });
      const beta = await prisma.empresa.findFirstOrThrow({
        where: { codigo: "DEMOBETA" },
        select: { id: true },
      });

      for (const perfil of PERFIS_DEMO) {
        const conta = await prisma.accessUser.findFirstOrThrow({
          where: { email: perfil.email },
          select: { role: true, companyId: true, status: true },
        });
        const esperado =
          perfil.empresa === null
            ? null
            : perfil.empresa === "beta"
              ? beta.id
              : alfa.id;
        expect([
          perfil.email,
          conta.role,
          conta.companyId,
          conta.status,
        ]).toEqual([perfil.email, perfil.papel, esperado, "active"]);
      }
    } finally {
      await prisma.$disconnect();
    }
  });

  it("cria os cenários de um e de dois vínculos que as telas distinguem", async () => {
    const prisma = new PrismaClient({ datasources: { db: { url: appUrl } } });
    try {
      const um = await prisma.colaborador.findFirstOrThrow({
        where: { nome: { endsWith: "Alfa Um" } },
        select: { id: true },
      });
      const dois = await prisma.colaborador.findFirstOrThrow({
        where: { nome: { endsWith: "Alfa Dois" } },
        select: { id: true },
      });

      expect(
        await prisma.vinculoFuncional.count({
          where: { colaboradorId: um.id },
        }),
      ).toBe(1);
      expect(
        await prisma.vinculoFuncional.count({
          where: { colaboradorId: dois.id },
        }),
      ).toBe(2);
    } finally {
      await prisma.$disconnect();
    }
  });

  it("as duas empresas de demonstração ficam isoladas entre si", async () => {
    const entrar = async (email: string) => {
      const res = await fetch(`${baseUrl}/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: SENHA_DEMO }),
      });
      const cookie = (res.headers.getSetCookie?.() ?? [])
        .find((c) => c.startsWith("evolli_session="))!
        .split(";")[0]!;
      return cookie;
    };

    const cookieAlfa = await entrar(`rh.alfa@evolli.local`);
    const cookieBeta = await entrar(`rh.beta@evolli.local`);

    const listar = async (cookie: string) => {
      const res = await fetch(`${baseUrl}/v1/colaboradores?tamanhoPagina=100`, {
        headers: { Cookie: cookie, Accept: "application/json" },
      });
      const corpo = (await res.json()) as { itens: { nome: string }[] };
      return corpo.itens.map((c) => c.nome);
    };

    const daAlfa = await listar(cookieAlfa);
    const daBeta = await listar(cookieBeta);

    expect(daAlfa.some((n) => n.includes("Alfa"))).toBe(true);
    expect(daAlfa.some((n) => n.includes("Beta"))).toBe(false);
    expect(daBeta.some((n) => n.includes("Beta"))).toBe(true);
    expect(daBeta.some((n) => n.includes("Alfa"))).toBe(false);
  });

  it("não cria conteúdo documental, anexo nem dado clínico", async () => {
    const prisma = new PrismaClient({ datasources: { db: { url: appUrl } } });
    try {
      expect(await prisma.documentoMetadado.count()).toBe(0);
      expect(await prisma.solicitacaoPessoa.count()).toBe(0);
      // Nenhum fator de MFA é habilitado pelo seed: o TOTP vive em tabela
      // própria, e ela precisa continuar vazia para estas contas.
      expect(await prisma.accessMfaTotp.count()).toBe(0);
      expect(await prisma.accessMfaRecoveryCode.count()).toBe(0);
    } finally {
      await prisma.$disconnect();
    }
  });
});
