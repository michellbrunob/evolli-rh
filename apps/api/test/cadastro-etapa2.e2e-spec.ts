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
import { lotacaoMinima } from "./admissao-obrigatoria";

/**
 * T209 — Novo colaborador, etapa 2 (dados profissionais). PostgreSQL real e
 * efêmero (Testcontainers), migrations do zero.
 *
 * Prova: só tipo e data de admissão obrigatórios (departamento e cargo
 * opcionais); tipos novos de contratação; o contrato (nível, gestor direto,
 * jornada semanal, escala, salário bruto, conselho, dependentes e pensão) numa
 * tabela própria, fora do vínculo; validação fechada; gestor só da empresa;
 * salário fora da trilha e das rotas do vínculo; idempotência com o contrato.
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
const SENHA_PADRAO = "Etapa!Dois#Cadastro#2026";

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

describe("T209 — Novo colaborador, etapa 2 (e2e)", () => {
  let container: StartedTestContainer;
  let app: INestApplication;
  let prisma: PrismaClient;
  let appUrl: string;

  let master: Credencial;
  let rhA: Credencial;
  let dpA: Credencial;
  let rhB: Credencial;
  let empresaA: string;
  let empresaB: string;
  let gestorA: string;
  let gestorB: string;

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

  let sequencia = 0;
  /**
   * Admissão mínima da etapa 2: tipo, data de admissão e só a Unidade na
   * lotação (Departamento e Cargo ausentes). A Baseline V1 (item 10) exige ao
   * menos uma referência organizacional.
   */
  async function base(empresaId: string, extra: Record<string, unknown> = {}) {
    sequencia += 1;
    return {
      nome: `Pessoa Etapa Dois ${String.fromCharCode(64 + (sequencia % 26))}${sequencia}`,
      empresaId,
      tipo: "clt",
      dataAdmissao: "2026-12-01",
      motivoCodigo: "admissao_inicial",
      unidadeOrganizacionalId: (await lotacaoMinima(appUrl, empresaId))
        .unidadeOrganizacionalId,
      perfilPessoal: {},
      ...extra,
    };
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
    prisma = new PrismaClient({ datasources: { db: { url: appUrl } } });

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

    const { PasswordHashService } =
      await import("../src/auth/password/password-hash.service");
    await prisma.accessUser.create({
      data: {
        email: "master.etapa2@example.test",
        passwordHash: await new PasswordHashService().hash(SENHA_PADRAO),
        role: "master_tecnico",
        status: "active",
      },
    });
    master = await login("master.etapa2@example.test");
    const empresa = async (codigo: string) =>
      (
        await post("/v1/empresas", master)
          .send({ codigo, nome: `Empresa ${codigo}` })
          .expect(201)
      ).body.id as string;
    empresaA = await empresa("ET2A");
    empresaB = await empresa("ET2B");
    rhA = await criarUsuario("rh.et2a@example.test", "rh", empresaA);
    dpA = await criarUsuario("dp.et2a@example.test", "dp", empresaA);
    rhB = await criarUsuario("rh.et2b@example.test", "rh", empresaB);
    gestorA = (
      await post("/v1/colaboradores", rhA)
        .send({ ...(await base(empresaA)), nome: "Gestora Sintetica Alfa" })
        .expect(201)
    ).body.id as string;
    gestorB = (
      await post("/v1/colaboradores", rhB)
        .send({ ...(await base(empresaB)), nome: "Gestor Sintetico Beta" })
        .expect(201)
    ).body.id as string;
  });

  afterAll(async () => {
    await app?.close();
    await prisma?.$disconnect();
    await container?.stop();
  });

  it("migration: tipos novos, tabela do contrato com CHECKs e sem salário no vínculo", async () => {
    const tipos = await prisma.$queryRaw<{ v: string }[]>`
      SELECT unnest(enum_range(NULL::"TipoVinculo"))::text AS v`;
    expect(tipos.map((t) => t.v)).toEqual(
      expect.arrayContaining(["part_time", "freelancer", "trainee"]),
    );
    const colunas = await prisma.$queryRaw<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'contrato_vinculo'`;
    expect(colunas.map((c) => c.column_name).sort()).toEqual(
      [
        "atualizado_em",
        "conselho_profissional",
        "criado_em",
        "dependentes_irrf",
        "empresa_id",
        "escala",
        "gestor_direto_colaborador_id",
        "jornada_semanal_horas",
        "nivel",
        "pensao_alimenticia_percentual",
        "registro_profissional",
        "salario_bruto",
        "vinculo_id",
      ].sort(),
    );
    const doVinculo = await prisma.$queryRaw<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'vinculo_funcional' AND column_name LIKE '%salario%'`;
    expect(doVinculo).toEqual([]);
    const checks = await prisma.$queryRaw<{ conname: string }[]>`
      SELECT conname FROM pg_constraint
      WHERE conrelid = 'contrato_vinculo'::regclass AND contype = 'c'`;
    expect(checks.map((c) => c.conname)).toEqual(
      expect.arrayContaining([
        "contrato_vinculo_nivel_check",
        "contrato_vinculo_escala_check",
        "contrato_vinculo_conselho_check",
        "contrato_vinculo_numeros_check",
      ]),
    );
  });

  it("sem nenhuma referência de lotação: 422 (Baseline V1, item 10)", async () => {
    const corpo = await base(empresaA);
    delete (corpo as Record<string, unknown>)["unidadeOrganizacionalId"];
    await post("/v1/colaboradores", rhA).send(corpo).expect(422);
  });

  it("admissão sem departamento nem cargo (só tipo, admissão e unidade): 201", async () => {
    const r = await post("/v1/colaboradores", rhA)
      .send(await base(empresaA, { tipo: "trainee" }))
      .expect(201);
    expect(r.body.vinculo.tipo).toBe("trainee");
    expect(r.body.movimentacao.destino).toMatchObject({
      departamentoId: null,
      cargoId: null,
      unidadeOrganizacionalId: expect.any(String),
    });
    expect(r.body.contrato).toBeNull();
  });

  it.each([
    "part_time",
    "freelancer",
    "trainee",
    "clt",
    "pj",
    "estagio",
    "aprendiz",
  ])("tipo de contratação %s aceito", async (tipo) => {
    await post("/v1/colaboradores", rhA)
      .send(await base(empresaA, { tipo }))
      .expect(201);
  });

  it("tipo e data de admissão continuam obrigatórios", async () => {
    const semTipo = await base(empresaA);
    delete (semTipo as Record<string, unknown>)["tipo"];
    await post("/v1/colaboradores", rhA).send(semTipo).expect(400);
    const semData = await base(empresaA);
    delete (semData as Record<string, unknown>)["dataAdmissao"];
    await post("/v1/colaboradores", rhA).send(semData).expect(400);
  });

  it("contrato completo: grava na tabela própria e devolve na resposta; trilha sem o salário", async () => {
    const r = await post("/v1/colaboradores", rhA)
      .send(
        await base(empresaA, {
          contrato: {
            nivel: "pleno",
            gestorDiretoId: gestorA,
            jornadaSemanalHoras: 44,
            escala: "5x2",
            salarioBruto: "5000.00",
            conselhoProfissional: "crc",
            registroProfissional: " 123456/SP ",
            dependentesIrrf: 2,
            pensaoAlimenticiaPercentual: "12.5",
          },
        }),
      )
      .expect(201);
    expect(r.body.contrato).toEqual({
      nivel: "pleno",
      gestorDiretoId: gestorA,
      jornadaSemanalHoras: 44,
      escala: "5x2",
      salarioBruto: "5000.00",
      conselhoProfissional: "crc",
      registroProfissional: "123456/SP",
      dependentesIrrf: 2,
      pensaoAlimenticiaPercentual: "12.50",
    });
    const gravado = await prisma.contratoVinculo.findUniqueOrThrow({
      where: { vinculoId: r.body.vinculo.id },
    });
    expect(gravado.salarioBruto!.toFixed(2)).toBe("5000.00");
    expect(gravado.empresaId).toBe(empresaA);
    const trilha = await prisma.auditEvent.findMany({
      where: { resourceId: r.body.id },
    });
    expect(JSON.stringify(trilha)).not.toMatch(/5000|123456/);
    // O vínculo e o detalhe do colaborador não expõem o contrato.
    const vinculos = await agent()
      .get(`/v1/colaboradores/${r.body.id}/vinculos`)
      .set("Cookie", rhA.cookie)
      .expect(200);
    expect(JSON.stringify(vinculos.body)).not.toMatch(/salario|5000/i);
    const detalhe = await agent()
      .get(`/v1/colaboradores/${r.body.id}`)
      .set("Cookie", rhA.cookie)
      .expect(200);
    expect(JSON.stringify(detalhe.body)).not.toMatch(/salario|5000/i);
  });

  it.each([
    ["nível fora da lista", { nivel: "estagiario" }],
    ["escala fora da lista", { escala: "9x9" }],
    ["conselho fora da lista", { conselhoProfissional: "xyz" }],
    ["registro sem conselho", { registroProfissional: "123" }],
    ["jornada zero", { jornadaSemanalHoras: 0 }],
    ["jornada acima de 80", { jornadaSemanalHoras: 81 }],
    ["salário zero", { salarioBruto: "0" }],
    ["salário com 3 casas", { salarioBruto: "10.001" }],
    ["dependentes negativos", { dependentesIrrf: -1 }],
    ["pensão acima de 100", { pensaoAlimenticiaPercentual: "100.5" }],
    ["campo desconhecido", { observacao: "x" }],
  ])("contrato inválido (%s): 400 e nada gravado", async (_caso, contrato) => {
    const antes = await prisma.colaborador.count();
    await post("/v1/colaboradores", rhA)
      .send(await base(empresaA, { contrato }))
      .expect(400);
    expect(await prisma.colaborador.count()).toBe(antes);
  });

  it("gestor direto de outra empresa ou inexistente: 422 em `contrato.gestorDiretoId`, sem ecoar o id", async () => {
    for (const gestor of [gestorB, "99999999-9999-4999-8999-999999999999"]) {
      const antes = await prisma.colaborador.count();
      const r = await post("/v1/colaboradores", rhA)
        .send(await base(empresaA, { contrato: { gestorDiretoId: gestor } }))
        .expect(422);
      expect(r.body.erros).toEqual([
        { campo: "contrato.gestorDiretoId", motivo: "indisponivel" },
      ]);
      expect(JSON.stringify(r.body)).not.toContain(gestor);
      expect(await prisma.colaborador.count()).toBe(antes);
    }
  });

  it("reenvio com a mesma chave e outro salário: conteúdo divergente (422)", async () => {
    const chave = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
    const corpo = await base(empresaA, {
      contrato: { salarioBruto: "3000.00" },
    });
    await post("/v1/colaboradores", rhA)
      .set("Idempotency-Key", chave)
      .send(corpo)
      .expect(201);
    await post("/v1/colaboradores", rhA)
      .set("Idempotency-Key", chave)
      .send({ ...corpo, contrato: { salarioBruto: "3100.00" } })
      .expect(422);
    // O mesmo conteúdo é reenvio (201, sem criar outro).
    const antes = await prisma.colaborador.count();
    await post("/v1/colaboradores", rhA)
      .set("Idempotency-Key", chave)
      .send(corpo)
      .expect(201);
    expect(await prisma.colaborador.count()).toBe(antes);
  });

  it("DP também admite com contrato", async () => {
    await post("/v1/colaboradores", dpA)
      .send(await base(empresaA, { contrato: { salarioBruto: "2500.00" } }))
      .expect(201);
  });
});
