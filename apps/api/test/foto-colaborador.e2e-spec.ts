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
import sharp from "sharp";
import request from "supertest";
import { GenericContainer, StartedTestContainer, Wait } from "testcontainers";
import { AppModule } from "../src/app.module";
import { AllExceptionsFilter } from "../src/common/filters/http-exception.filter";
import { requestIdMiddleware } from "../src/common/request-id";
import {
  ARMAZENAMENTO_DE_FOTOS,
  ArmazenamentoEmMemoria,
} from "../src/pessoas/foto-colaborador/armazenamento-de-objetos";
import {
  camposObrigatoriosAdmissao,
  lotacaoMinima,
} from "./admissao-obrigatoria";

/**
 * T209 — foto do colaborador (ADR 0020). PostgreSQL real e efêmero
 * (Testcontainers), migrations do zero, e o armazenamento de objetos FALSO
 * (`ArmazenamentoEmMemoria`): nenhum byte vai ao bucket real.
 *
 * Prova: a migration cria as tabelas próprias, os CHECKs e os três valores
 * de auditoria; RH e DP enviam e substituem na empresa ativa; master
 * técnico, gestor e colaborador não editam; outra empresa não lê nem grava;
 * arquivo falso, MIME enganoso, tamanho excedido e tipo errado são
 * recusados sem gravar nada; só três WebP por envio, com chaves de ids
 * internos; leitura só por rota autenticada; remoção, falha do
 * armazenamento, limpeza pendente e nova tentativa.
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
const SENHA_PADRAO = "Foto!Pessoas#2026";

const CHAVE_DA_VERSAO =
  /^v1\/empresas\/[0-9a-f-]{36}\/colaboradores\/[0-9a-f-]{36}\/foto\/[0-9a-f-]{36}\/foto-(96|256|512)\.webp$/;

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

async function png(largura = 400, altura = 300): Promise<Buffer> {
  return sharp({
    create: {
      width: largura,
      height: altura,
      channels: 3,
      background: { r: 30, g: 140, b: 90 },
    },
  })
    .png()
    .toBuffer();
}

describe("T209 — foto do colaborador (e2e)", () => {
  let container: StartedTestContainer;
  let app: INestApplication;
  let prisma: PrismaClient;
  let appUrl: string;
  const armazenamento = new ArmazenamentoEmMemoria();

  let master: Credencial;
  let rhA: Credencial;
  let dpA: Credencial;
  let rhB: Credencial;
  let gestorA: Credencial;
  let colaboradorConta: Credencial;
  let empresaA: string;
  let empresaB: string;
  let colaboradorA: string;
  let colaboradorB: string;

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

  function enviar(
    cred: Credencial,
    colaboradorId: string,
    corpo: Buffer,
    tipo = "image/png",
    extensao = "png",
  ) {
    return agent()
      .put(`/v1/colaboradores/${colaboradorId}/foto`)
      .set("Cookie", cred.cookie)
      .set("x-csrf-token", cred.csrfToken)
      .set("Content-Type", "application/octet-stream")
      .set("x-evolli-foto-tipo", tipo)
      .set("x-evolli-foto-extensao", extensao)
      .send(corpo);
  }

  const ler = (cred: Credencial, colaboradorId: string, tamanho = 256) =>
    agent()
      .get(`/v1/colaboradores/${colaboradorId}/foto?tamanho=${tamanho}`)
      .set("Cookie", cred.cookie)
      .buffer(true)
      .parse((res, cb) => {
        const partes: Buffer[] = [];
        res.on("data", (c: Buffer) => partes.push(c));
        res.on("end", () => cb(null, Buffer.concat(partes)));
      });

  const remover = (cred: Credencial, colaboradorId: string) =>
    agent()
      .delete(`/v1/colaboradores/${colaboradorId}/foto`)
      .set("Cookie", cred.cookie)
      .set("x-csrf-token", cred.csrfToken);

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

  async function admitir(
    cred: Credencial,
    nome: string,
    empresaId: string,
    departamentoId: string,
  ): Promise<string> {
    const r = await post("/v1/colaboradores", cred)
      .send({
        ...camposObrigatoriosAdmissao(),
        ...(await lotacaoMinima(appUrl, empresaId)),
        nome,
        empresaId,
        tipo: "clt",
        dataAdmissao: "2026-01-05",
        motivoCodigo: "admissao_inicial",
        departamentoId,
      })
      .expect(201);
    return r.body.id as string;
  }

  const chavesGuardadas = () => [...armazenamento.objetos.keys()].sort();

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
      .overrideProvider(ARMAZENAMENTO_DE_FOTOS)
      .useValue(armazenamento)
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

    const { PasswordHashService } =
      await import("../src/auth/password/password-hash.service");
    await prisma.accessUser.create({
      data: {
        email: "master.foto@example.test",
        passwordHash: await new PasswordHashService().hash(SENHA_PADRAO),
        role: "master_tecnico",
        status: "active",
      },
    });
    master = await login("master.foto@example.test");

    const empresa = async (codigo: string) =>
      (
        await post("/v1/empresas", master)
          .send({ codigo, nome: `Empresa ${codigo}` })
          .expect(201)
      ).body.id as string;
    empresaA = await empresa("FOTA");
    empresaB = await empresa("FOTB");
    const departamento = async (empresaId: string, codigo: string) =>
      (
        await post("/v1/departamentos", master)
          .send({ empresaId, codigo, nome: `Depto ${codigo}` })
          .expect(201)
      ).body.id as string;
    const depA = await departamento(empresaA, "DFA");
    const depB = await departamento(empresaB, "DFB");

    rhA = await criarUsuario("rh.fota@example.test", "rh", empresaA);
    dpA = await criarUsuario("dp.fota@example.test", "dp", empresaA);
    rhB = await criarUsuario("rh.fotb@example.test", "rh", empresaB);
    gestorA = await criarUsuario(
      "gestor.fota@example.test",
      "gestor",
      empresaA,
    );
    colaboradorConta = await criarUsuario(
      "colaborador.fota@example.test",
      "colaborador",
      empresaA,
    );
    colaboradorA = await admitir(rhA, "Pessoa Foto Alfa", empresaA, depA);
    colaboradorB = await admitir(rhB, "Pessoa Foto Beta", empresaB, depB);
  });

  afterAll(async () => {
    await app?.close();
    await prisma?.$disconnect();
    await container?.stop();
  });

  beforeEach(() => {
    armazenamento.falhar = () => false;
  });

  it("migration: tabelas próprias, CHECK da chave e os três valores de auditoria", async () => {
    const tabelas = await prisma.$queryRawUnsafe<{ t: string }[]>(
      `SELECT table_name AS t FROM information_schema.tables
        WHERE table_schema = 'app'
          AND table_name IN ('foto_colaborador', 'limpeza_foto_colaborador_pendente')`,
    );
    expect(tabelas.map((x) => x.t).sort()).toEqual([
      "foto_colaborador",
      "limpeza_foto_colaborador_pendente",
    ]);
    const valores = (
      await prisma.$queryRawUnsafe<{ v: string }[]>(
        `SELECT unnest(enum_range(NULL::"AuditAction"))::text AS v`,
      )
    ).map((x) => x.v);
    for (const v of [
      "pessoas.foto_colaborador.enviada",
      "pessoas.foto_colaborador.substituida",
      "pessoas.foto_colaborador.removida",
    ]) {
      expect(valores).toContain(v);
    }
    // A chave com dado pessoal é recusada pelo banco.
    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO "limpeza_foto_colaborador_pendente" (id, empresa_id, colaborador_id, chave, motivo)
         VALUES ('00000000-0000-4000-8000-000000000009', $1, $2, 'v1/empresas/x/colaboradores/Pessoa Foto/foto.webp', 'remocao')`,
        empresaA,
        colaboradorA,
      ),
    ).rejects.toThrow();
  });

  it("RH envia: três WebP com chaves só de ids internos; o banco guarda os metadados; trilha sem conteúdo", async () => {
    const r = await enviar(rhA, colaboradorA, await png()).expect(200);
    expect(r.body.versao).toBe(1);
    const chaves = chavesGuardadas();
    expect(chaves).toHaveLength(3);
    for (const chave of chaves) {
      expect(chave).toMatch(CHAVE_DA_VERSAO);
      expect(chave).toContain(
        `/empresas/${empresaA}/colaboradores/${colaboradorA}/`,
      );
      expect(chave).not.toMatch(/pessoa|foto alfa|example/i);
      expect(armazenamento.objetos.get(chave)!.tipo).toBe("image/webp");
      const meta = await sharp(
        armazenamento.objetos.get(chave)!.corpo,
      ).metadata();
      expect(meta.format).toBe("webp");
      expect(meta.exif).toBeUndefined();
    }
    const linha = await prisma.fotoColaborador.findFirstOrThrow({
      where: { colaboradorId: colaboradorA },
    });
    expect(linha.empresaId).toBe(empresaA);
    expect(linha.tipo).toBe("image/webp");
    expect(linha.hashSha256).toMatch(/^[0-9a-f]{64}$/);
    const eventos = await prisma.auditEvent.findMany({
      where: { action: "pessoas_foto_colaborador_enviada" },
    });
    expect(eventos).toHaveLength(1);
    expect(eventos[0]!.resource).toBe("foto_colaborador");
    expect(eventos[0]!.resourceId).toBe(colaboradorA);
    expect(JSON.stringify(eventos[0])).not.toContain(linha.hashSha256);
    expect(JSON.stringify(eventos[0])).not.toContain("v1/empresas");
  });

  it("a leitura é só pela rota autenticada: WebP do tamanho pedido, privado e sem cache", async () => {
    const r = await ler(rhA, colaboradorA, 96).expect(200);
    expect(r.headers["content-type"]).toBe("image/webp");
    expect(r.headers["cache-control"]).toBe("private, no-store");
    expect(r.headers["x-content-type-options"]).toBe("nosniff");
    const meta = await sharp(r.body as Buffer).metadata();
    expect(meta.width).toBe(96);
    await agent().get(`/v1/colaboradores/${colaboradorA}/foto`).expect(401);
    await ler(rhA, colaboradorA, 300).expect(422);
  });

  it("DP da mesma empresa substitui: versão sobe, as versões antigas somem, trilha de substituição", async () => {
    const antes = chavesGuardadas();
    const r = await enviar(dpA, colaboradorA, await png(500, 500)).expect(200);
    expect(r.body.versao).toBe(2);
    const depois = chavesGuardadas();
    expect(depois).toHaveLength(3);
    expect(depois.some((c) => antes.includes(c))).toBe(false);
    expect(
      await prisma.auditEvent.count({
        where: { action: "pessoas_foto_colaborador_substituida" },
      }),
    ).toBe(1);
  });

  it.each([
    ["master técnico", () => master],
    ["gestor", () => gestorA],
    ["colaborador", () => colaboradorConta],
  ])("%s não edita a foto", async (_papel, cred) => {
    const antes = chavesGuardadas();
    const r = await enviar(cred(), colaboradorA, await png());
    expect([403, 404]).toContain(r.status);
    const d = await remover(cred(), colaboradorA);
    expect([403, 404]).toContain(d.status);
    expect(chavesGuardadas()).toEqual(antes);
  });

  it("outra empresa não lê nem grava (404, sem tocar no armazenamento)", async () => {
    const antes = chavesGuardadas();
    await enviar(rhB, colaboradorA, await png()).expect(404);
    await ler(rhB, colaboradorA).expect(404);
    await remover(rhB, colaboradorA).expect(404);
    expect(chavesGuardadas()).toEqual(antes);
    // E o RH da empresa A não alcança o colaborador da B.
    await enviar(rhA, colaboradorB, await png()).expect(404);
  });

  it.each([
    [
      "arquivo falso",
      Buffer.from("isto nao e imagem"),
      "image/png",
      "png",
      "foto_tipo_divergente",
    ],
    ["MIME enganoso", null, "image/jpeg", "jpg", "foto_tipo_divergente"],
    [
      "extensão fora da lista",
      null,
      "image/png",
      "gif",
      "foto_formato_invalido",
    ],
  ])(
    "%s é recusado (422) sem gravar nada",
    async (_caso, corpo, tipo, extensao, codigo) => {
      const antes = chavesGuardadas();
      const r = await enviar(
        rhA,
        colaboradorA,
        (corpo as Buffer | null) ?? (await png()),
        tipo as string,
        extensao as string,
      ).expect(422);
      expect(JSON.stringify(r.body)).toContain(codigo as string);
      expect(chavesGuardadas()).toEqual(antes);
    },
  );

  it("acima de 5 MB: 413; corpo que não é binário: 415", async () => {
    await enviar(
      rhA,
      colaboradorA,
      Buffer.alloc(5 * 1024 * 1024 + 10, 1),
    ).expect(413);
    await agent()
      .put(`/v1/colaboradores/${colaboradorA}/foto`)
      .set("Cookie", rhA.cookie)
      .set("x-csrf-token", rhA.csrfToken)
      .set("Content-Type", "image/png")
      .send(await png())
      .expect(415);
  });

  it("falha do armazenamento no envio: 503, nada sobra, a foto atual continua", async () => {
    const antes = chavesGuardadas();
    let gravacoes = 0;
    armazenamento.falhar = (op) => op === "gravar" && ++gravacoes === 2;
    const r = await enviar(rhA, colaboradorA, await png()).expect(503);
    // A resposta não traz nenhum detalhe do provedor.
    expect(JSON.stringify(r.body)).not.toMatch(
      /r2|cloudflare|bucket|v1\/empresas/i,
    );
    expect(chavesGuardadas()).toEqual(antes);
    const linha = await prisma.fotoColaborador.findFirstOrThrow({
      where: { colaboradorId: colaboradorA },
    });
    expect(linha.versao).toBe(2);
    // O colaborador (a admissão) não é tocado pela falha da foto.
    expect(
      await prisma.colaborador.count({ where: { id: colaboradorA } }),
    ).toBe(1);
  });

  it("falha também ao limpar o que foi gravado: limpeza pendente segura, refeita na próxima operação", async () => {
    let gravacoes = 0;
    armazenamento.falhar = (op) =>
      (op === "gravar" && ++gravacoes === 3) || op === "apagar";
    await enviar(rhA, colaboradorA, await png()).expect(503);
    const pendentes = await prisma.limpezaFotoColaboradorPendente.findMany();
    expect(pendentes).toHaveLength(2);
    for (const p of pendentes) {
      expect(p.chave).toMatch(CHAVE_DA_VERSAO);
      expect(p.motivo).toBe("falha_no_envio");
    }
    // O armazenamento volta: a próxima operação limpa as pendências.
    armazenamento.falhar = () => false;
    await enviar(rhA, colaboradorA, await png()).expect(200);
    expect(await prisma.limpezaFotoColaboradorPendente.count()).toBe(0);
    expect(chavesGuardadas()).toHaveLength(3);
  });

  it("remoção: apaga as três versões e o registro, com trilha; ler depois dá 404", async () => {
    await remover(rhA, colaboradorA).expect(204);
    expect(chavesGuardadas()).toHaveLength(0);
    expect(
      await prisma.fotoColaborador.count({
        where: { colaboradorId: colaboradorA },
      }),
    ).toBe(0);
    expect(
      await prisma.auditEvent.count({
        where: { action: "pessoas_foto_colaborador_removida" },
      }),
    ).toBe(1);
    await ler(rhA, colaboradorA).expect(404);
    // Remover sem foto não é erro.
    await remover(rhA, colaboradorA).expect(204);
  });

  it("remoção com o armazenamento fora: o registro sai, as versões viram limpeza pendente", async () => {
    await enviar(rhA, colaboradorA, await png()).expect(200);
    armazenamento.falhar = (op) => op === "apagar";
    await remover(rhA, colaboradorA).expect(204);
    const pendentes = await prisma.limpezaFotoColaboradorPendente.findMany();
    expect(pendentes).toHaveLength(3);
    expect(pendentes.every((p) => p.motivo === "remocao")).toBe(true);
    armazenamento.falhar = () => false;
    await enviar(rhA, colaboradorA, await png()).expect(200);
    expect(await prisma.limpezaFotoColaboradorPendente.count()).toBe(0);
  });

  it("falha do armazenamento na leitura: 503, sem detalhe do provedor", async () => {
    await enviar(rhA, colaboradorA, await png()).expect(200);
    armazenamento.falhar = (op) => op === "ler";
    const r = await ler(rhA, colaboradorA).expect(503);
    expect(r.body.toString()).not.toMatch(/r2|cloudflare|bucket|v1\/empresas/i);
  });
});
