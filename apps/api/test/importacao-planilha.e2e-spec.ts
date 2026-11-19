import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { join } from "node:path";
import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { AccessRole, PrismaClient } from "@prisma/client";
import cookieParser from "cookie-parser";
import request from "supertest";
import { GenericContainer, StartedTestContainer, Wait } from "testcontainers";
import { AppModule } from "../src/app.module";
import { AllExceptionsFilter } from "../src/common/filters/http-exception.filter";
import { requestIdMiddleware } from "../src/common/request-id";
import { LotacaoMinima, lotacaoMinima } from "./admissao-obrigatoria";

/**
 * T212 — importação de colaboradores por planilha (`.xlsx` ou `.csv`),
 * PostgreSQL real e efêmero (Testcontainers), migrations aplicadas do zero.
 *
 * A planilha é lida só no navegador e nunca chega ao servidor: o que chega é,
 * linha a linha, a MESMA admissão do cadastro individual (`POST
 * /v1/colaboradores`), com a chave de idempotência da linha. Esta suíte envia
 * exatamente o que a página envia — o corpo de `montarAdmissao` e a chave de
 * `chaveDaLinha` (UUID v5 da identidade da pessoa na empresa) — e prova:
 *
 *  - RH e DP importam (201) na própria empresa;
 *  - reenviar a mesma linha (reimportar o arquivo) devolve a admissão já
 *    feita, com `Idempotent-Replayed: true`, e nada é criado de novo;
 *  - a mesma pessoa com outros dados (mesma chave) é recusada (422), sem
 *    gravar nada;
 *  - gestor, financeiro, colaborador, auditor, dpo, admin_tecnico e
 *    master_tecnico são recusados (403), sem gravar nada;
 *  - RH de outra empresa não importa nesta (404, como no resto do domínio).
 *
 * **Todos os dados são sintéticos.** Domínio reservado `example.test`.
 */

jest.setTimeout(900_000);

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
const SENHA_PADRAO = "Importacao!Planilha#2026";

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

async function subirBanco(): Promise<{
  container: StartedTestContainer;
  migratorUrl: string;
  appUrl: string;
}> {
  const container = await new GenericContainer("postgres:16-alpine")
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
  await runInfraScript(container, "01_create_roles.sql", [
    "-v",
    `migrator_password=${MIGRATOR_PASSWORD}`,
    "-v",
    `app_password=${APP_PASSWORD}`,
  ]);
  await runInfraScript(container, "02_schema_and_grants.sql", []);
  await runInfraScript(container, "04_extensions.sql", []);
  const host = container.getHost();
  const port = container.getMappedPort(5432);
  return {
    container,
    migratorUrl: `postgresql://evolli_migrator:${MIGRATOR_PASSWORD}@${host}:${port}/${ADMIN_DB}?schema=app`,
    appUrl: `postgresql://evolli_app:${APP_PASSWORD}@${host}:${port}/${ADMIN_DB}?schema=app`,
  };
}

function migrar(migratorUrl: string): void {
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
}

// ---------------------------------------------------------------------------
// O que a página de importação envia (espelho de `planilhaColaboradores.ts`).

/** Uma linha já conferida da planilha (códigos resolvidos em ids ativos). */
interface LinhaDaPlanilha {
  nome: string;
  tipo: "clt" | "estagio" | "pj" | "aprendiz" | "temporario";
  dataAdmissao: string;
  dataNascimento: string;
  departamentoId: string;
  cargoId: string;
  unidadeId?: string;
  matricula?: string;
}

/** Mesma normalização do nome usada pela página na chave da linha. */
function normalizarNome(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, " ");
}

/** `chaveDaLinha`: UUID v5 (SHA-256 truncado) da identidade da pessoa. */
function chaveDaLinha(empresaId: string, linha: LinhaDaPlanilha): string {
  const identidade = [
    "evolli:importacao-colaboradores:v1",
    empresaId,
    normalizarNome(linha.nome),
    linha.dataNascimento,
    linha.matricula ?? "",
  ].join(" ");
  const resumo = createHash("sha256")
    .update(identidade)
    .digest()
    .subarray(0, 16);
  resumo[6] = (resumo[6]! & 0x0f) | 0x50;
  resumo[8] = (resumo[8]! & 0x3f) | 0x80;
  const hex = resumo.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** `montarAdmissao`: o contrato do cadastro individual, sem contatos. */
function montarAdmissao(linha: LinhaDaPlanilha, empresaId: string) {
  return {
    nome: linha.nome,
    empresaId,
    tipo: linha.tipo,
    dataAdmissao: linha.dataAdmissao,
    motivoCodigo: "admissao_inicial",
    departamentoId: linha.departamentoId,
    cargoId: linha.cargoId,
    ...(linha.matricula ? { matricula: linha.matricula } : {}),
    ...(linha.unidadeId ? { unidadeOrganizacionalId: linha.unidadeId } : {}),
    perfilPessoal: {
      dataNascimento: linha.dataNascimento,
      sexo: null,
      saudacao: null,
      estadoCivil: null,
      nacionalidade: null,
      naturalidade: null,
      escolaridade: null,
      curso: null,
      nomePai: null,
      nomeMae: null,
    },
  };
}

interface Credencial {
  cookie: string;
  csrfToken: string;
}

describe("Importação de colaboradores por planilha (T212, e2e)", () => {
  let container: StartedTestContainer;
  let app: INestApplication;
  let prisma: PrismaClient;

  let rh: Credencial;
  let dp: Credencial;
  let rhOutraEmpresa: Credencial;
  const recusados = new Map<string, Credencial>();

  let empresaA: string;
  let lotacao: LotacaoMinima;

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

  /** Conta criada direto no banco, para cobrir também papéis técnicos. */
  async function conta(
    email: string,
    role: AccessRole,
    companyId: string | null,
  ): Promise<Credencial> {
    const { PasswordHashService } =
      await import("../src/auth/password/password-hash.service");
    await prisma.accessUser.create({
      data: {
        email,
        passwordHash: await new PasswordHashService().hash(SENHA_PADRAO),
        role,
        companyId,
        status: "active",
      },
    });
    return login(email);
  }

  /** O envio de uma linha, como a página faz. */
  function enviarLinha(
    cred: Credencial,
    linha: LinhaDaPlanilha,
    empresaId = empresaA,
  ) {
    return agent()
      .post("/v1/colaboradores")
      .set("Cookie", cred.cookie)
      .set("x-csrf-token", cred.csrfToken)
      .set("Idempotency-Key", chaveDaLinha(empresaId, linha))
      .send(montarAdmissao(linha, empresaId));
  }

  const colaboradoresChamados = (nome: string) =>
    prisma.colaborador.count({ where: { nome } });

  function linha(
    nome: string,
    extra: Partial<LinhaDaPlanilha> = {},
  ): LinhaDaPlanilha {
    return {
      nome,
      tipo: "clt",
      dataAdmissao: "2026-12-01",
      dataNascimento: "1990-05-15",
      departamentoId: lotacao.departamentoId,
      cargoId: lotacao.cargoId,
      ...extra,
    };
  }

  beforeAll(async () => {
    const banco = await subirBanco();
    container = banco.container;
    migrar(banco.migratorUrl);

    process.env.DATABASE_URL = banco.appUrl;
    prisma = new PrismaClient({ datasources: { db: { url: banco.appUrl } } });

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
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

    empresaA = (
      await prisma.empresa.create({
        data: { codigo: "T212A", nome: "Empresa T212A" },
      })
    ).id;
    const empresaB = (
      await prisma.empresa.create({
        data: { codigo: "T212B", nome: "Empresa T212B" },
      })
    ).id;
    lotacao = await lotacaoMinima(banco.appUrl, empresaA);

    rh = await conta("rh.t212@example.test", "rh", empresaA);
    dp = await conta("dp.t212@example.test", "dp", empresaA);
    rhOutraEmpresa = await conta("rh.t212b@example.test", "rh", empresaB);
    for (const papel of [
      "gestor",
      "financeiro",
      "colaborador",
      "auditor",
      "dpo",
      "admin_tecnico",
    ] as const) {
      recusados.set(
        papel,
        await conta(`${papel}.t212@example.test`, papel, empresaA),
      );
    }
    recusados.set(
      "master_tecnico",
      await conta("master.t212@example.test", "master_tecnico", null),
    );
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    await app?.close();
    await container?.stop();
  });

  // -------------------------------------------------------------------------

  describe.each([
    ["rh", () => rh],
    ["dp", () => dp],
  ] as const)("%s importa na própria empresa", (papel, cred) => {
    // Montadas na hora (a lotação só existe depois do `beforeAll`).
    const semMatricula = () => linha(`Pessoa Sintética Planilha ${papel} Um`);
    const comMatriculaEUnidade = () =>
      linha(`Pessoa Sintética Planilha ${papel} Dois`, {
        tipo: "estagio",
        matricula: `T212-${papel.toUpperCase()}-02`,
        unidadeId: lotacao.unidadeOrganizacionalId,
      });

    it("cada linha pronta vira uma admissão (201), sem marca de reenvio", async () => {
      for (const l of [semMatricula(), comMatriculaEUnidade()]) {
        const r = await enviarLinha(cred(), l).expect(201);
        expect(r.headers["idempotent-replayed"]).toBeUndefined();
        expect(await colaboradoresChamados(l.nome)).toBe(1);
      }
      const vinculo = await prisma.vinculoFuncional.findFirst({
        where: { matricula: `T212-${papel.toUpperCase()}-02` },
      });
      expect(vinculo?.tipo).toBe("estagio");
    });

    it("reimportar o mesmo arquivo não duplica: a mesma admissão volta, marcada como reenvio", async () => {
      const antes = await prisma.colaborador.count();
      for (const l of [semMatricula(), comMatriculaEUnidade()]) {
        const r = await enviarLinha(cred(), l).expect(201);
        expect(r.headers["idempotent-replayed"]).toBe("true");
        expect(await colaboradoresChamados(l.nome)).toBe(1);
      }
      expect(await prisma.colaborador.count()).toBe(antes);
    });

    it("a mesma pessoa com outros dados (mesma chave) é recusada, sem gravar nada", async () => {
      const antes = await prisma.colaborador.count();
      const divergente = { ...semMatricula(), tipo: "pj" as const };
      await enviarLinha(cred(), divergente).expect(422);
      expect(await prisma.colaborador.count()).toBe(antes);
    });
  });

  it.each([
    "gestor",
    "financeiro",
    "colaborador",
    "auditor",
    "dpo",
    "admin_tecnico",
    "master_tecnico",
  ])("%s é recusado (403) e nada é gravado", async (papel) => {
    const l = linha(`Pessoa Sintética Planilha Recusada ${papel}`);
    await enviarLinha(recusados.get(papel)!, l).expect(403);
    expect(await colaboradoresChamados(l.nome)).toBe(0);
    expect(
      await prisma.idempotenciaAdmissao.count({
        where: { chave: chaveDaLinha(empresaA, l) },
      }),
    ).toBe(0);
  });

  it("RH de outra empresa não importa nesta (404, sem revelar a empresa) e nada é gravado", async () => {
    const l = linha("Pessoa Sintética Planilha Outra Empresa");
    await enviarLinha(rhOutraEmpresa, l).expect(404);
    expect(await colaboradoresChamados(l.nome)).toBe(0);
  });
});
