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
  SALARIO_DA_ADMISSAO,
  contratoDaAdmissao,
  lotacaoMinima,
} from "./admissao-obrigatoria";

/**
 * T215 — contrato do colaborador na edição (`GET`/`PUT
 * /v1/colaboradores/:colaboradorId/contrato`). PostgreSQL real e efêmero
 * (Testcontainers), migrations do zero.
 *
 * Prova: leitura do contrato do vínculo PRINCIPAL na empresa ativa, com os
 * dados de leitura do vínculo; o PUT substitui o bloco inteiro (ausente e
 * `null` limpam) e cria a linha quando falta; matrícula única na empresa
 * (409 por campo, sem o valor); gestor direto só da empresa e nunca a própria
 * pessoa; validação fechada; RH e DP editam, master técnico só lê, os demais
 * papéis são negados; outra empresa é 404; CSRF; `no-store`; trilha sem
 * valores.
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
const SENHA_PADRAO = "Contrato!Edicao#Sintetica#2026";

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

const CONTRATO_VAZIO = {
  nivel: null,
  gestorDiretoId: null,
  jornadaSemanalHoras: null,
  escala: null,
  salarioBruto: null,
  conselhoProfissional: null,
  registroProfissional: null,
  dependentesIrrf: null,
  pensaoAlimenticiaPercentual: null,
};

describe("T215 — contrato do colaborador na edição (e2e)", () => {
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
  const outrosPapeis: [string, Credencial][] = [];

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

  function put(rota: string, cred: Credencial) {
    return agent()
      .put(rota)
      .set("Cookie", cred.cookie)
      .set("x-csrf-token", cred.csrfToken);
  }

  function get(rota: string, cred: Credencial) {
    return agent().get(rota).set("Cookie", cred.cookie);
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
  async function admitir(
    cred: Credencial,
    empresaId: string,
    extra: Record<string, unknown> = {},
  ): Promise<{ id: string; vinculoId: string }> {
    sequencia += 1;
    const r = await post("/v1/colaboradores", cred)
      .send({
        nome: `Pessoa Contrato ${String.fromCharCode(65 + (sequencia % 26))}${sequencia}`,
        empresaId,
        tipo: "clt",
        dataAdmissao: "2026-12-01",
        motivoCodigo: "admissao_inicial",
        unidadeOrganizacionalId: (await lotacaoMinima(appUrl, empresaId))
          .unidadeOrganizacionalId,
        perfilPessoal: {},
        ...extra,
        contrato: contratoDaAdmissao(extra["contrato"]),
      })
      .expect(201);
    return { id: r.body.id as string, vinculoId: r.body.vinculo.id as string };
  }

  const rota = (colaboradorId: string) =>
    `/v1/colaboradores/${colaboradorId}/contrato`;

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
        email: "master.contrato@example.test",
        passwordHash: await new PasswordHashService().hash(SENHA_PADRAO),
        role: "master_tecnico",
        status: "active",
      },
    });
    master = await login("master.contrato@example.test");
    const empresa = async (codigo: string) =>
      (
        await post("/v1/empresas", master)
          .send({ codigo, nome: `Empresa ${codigo}` })
          .expect(201)
      ).body.id as string;
    empresaA = await empresa("CTRA");
    empresaB = await empresa("CTRB");
    rhA = await criarUsuario("rh.ctra@example.test", "rh", empresaA);
    dpA = await criarUsuario("dp.ctra@example.test", "dp", empresaA);
    rhB = await criarUsuario("rh.ctrb@example.test", "rh", empresaB);
    for (const papel of ["gestor", "financeiro", "colaborador"]) {
      outrosPapeis.push([
        papel,
        await criarUsuario(`${papel}.ctra@example.test`, papel, empresaA),
      ]);
    }
    gestorA = (await admitir(rhA, empresaA)).id;
    gestorB = (await admitir(rhB, empresaB)).id;
  });

  afterAll(async () => {
    await app?.close();
    await prisma?.$disconnect();
    await container?.stop();
  });

  it("GET: o contrato gravado na admissão e os dados do vínculo principal, sem cache", async () => {
    const { id, vinculoId } = await admitir(rhA, empresaA, {
      matricula: "CT-001",
      contrato: {
        nivel: "pleno",
        gestorDiretoId: gestorA,
        jornadaSemanalHoras: 44,
        escala: "5x2",
        salarioBruto: "5000.00",
        conselhoProfissional: "crc",
        registroProfissional: "123456/SP",
        dependentesIrrf: 2,
        pensaoAlimenticiaPercentual: "12.5",
      },
    });
    const r = await get(rota(id), rhA).expect(200);
    expect(r.headers["cache-control"]).toBe("no-store");
    expect(r.body).toEqual({
      colaboradorId: id,
      empresaId: empresaA,
      vinculo: {
        id: vinculoId,
        matricula: "CT-001",
        tipo: "clt",
        situacao: "previsto",
        dataAdmissao: "2026-12-01",
        dataDesligamento: null,
      },
      contrato: {
        nivel: "pleno",
        gestorDiretoId: gestorA,
        jornadaSemanalHoras: 44,
        escala: "5x2",
        salarioBruto: "5000.00",
        conselhoProfissional: "crc",
        registroProfissional: "123456/SP",
        dependentesIrrf: 2,
        pensaoAlimenticiaPercentual: "12.50",
      },
      atualizadoEm: expect.any(String),
      // T215 — o estado da desativação na empresa.
      desativado: false,
      desativadoEm: null,
    });
  });

  it("GET só com o salário da admissão: os demais campos nulos", async () => {
    const { id } = await admitir(rhA, empresaA);
    const r = await get(rota(id), rhA).expect(200);
    expect(r.body.contrato).toEqual({
      ...CONTRATO_VAZIO,
      salarioBruto: SALARIO_DA_ADMISSAO,
    });
  });

  it("PUT cria a linha quando falta, devolve o gravado e a trilha não leva valores", async () => {
    const { id, vinculoId } = await admitir(rhA, empresaA);
    const r = await put(rota(id), rhA)
      .send({
        nivel: "senior",
        gestorDiretoId: gestorA,
        jornadaSemanalHoras: 40,
        escala: "6x1",
        salarioBruto: "7321.45",
        conselhoProfissional: "crea",
        registroProfissional: " 98765/RJ ",
        dependentesIrrf: 1,
        pensaoAlimenticiaPercentual: "7",
      })
      .expect(200);
    expect(r.headers["cache-control"]).toBe("no-store");
    expect(r.body.contrato).toEqual({
      nivel: "senior",
      gestorDiretoId: gestorA,
      jornadaSemanalHoras: 40,
      escala: "6x1",
      salarioBruto: "7321.45",
      conselhoProfissional: "crea",
      registroProfissional: "98765/RJ",
      dependentesIrrf: 1,
      pensaoAlimenticiaPercentual: "7.00",
    });
    expect(r.body.atualizadoEm).toEqual(expect.any(String));
    const linha = await prisma.contratoVinculo.findUniqueOrThrow({
      where: { vinculoId },
    });
    expect(linha.empresaId).toBe(empresaA);
    const trilha = await prisma.auditEvent.findMany({
      where: { resource: "contrato_vinculo", resourceId: vinculoId },
    });
    expect(trilha).toHaveLength(1);
    expect(trilha[0]).toMatchObject({
      action: "pessoas_colaborador_atualizado",
      companyId: empresaA,
      result: "success",
    });
    expect(JSON.stringify(trilha)).not.toMatch(/7321|98765/);
  });

  it("PUT substitui o bloco inteiro: ausente e null limpam", async () => {
    const { id } = await admitir(rhA, empresaA, {
      contrato: { nivel: "junior", salarioBruto: "3000.00", escala: "5x2" },
    });
    const r = await put(rota(id), rhA)
      .send({ salarioBruto: "3500.00", escala: null })
      .expect(200);
    expect(r.body.contrato).toEqual({
      ...CONTRATO_VAZIO,
      salarioBruto: "3500.00",
    });
    const lido = await get(rota(id), rhA).expect(200);
    expect(lido.body.contrato).toEqual(r.body.contrato);
  });

  it("PUT só com o salário limpa os demais campos; sem o salário, é recusado", async () => {
    const { id } = await admitir(rhA, empresaA, {
      contrato: { nivel: "junior" },
    });
    const r = await put(rota(id), rhA)
      .send({ salarioBruto: SALARIO_DA_ADMISSAO })
      .expect(200);
    expect(r.body.contrato).toEqual({
      ...CONTRATO_VAZIO,
      salarioBruto: SALARIO_DA_ADMISSAO,
    });
    const recusa = await put(rota(id), rhA).send({}).expect(422);
    expect(recusa.body.erros).toEqual([
      { campo: "salarioBruto", motivo: "obrigatorio" },
    ]);
  });

  it("matrícula: ausente mantém, nova grava, null apaga; em uso na empresa é 409 por campo sem o valor", async () => {
    await admitir(rhA, empresaA, { matricula: "CT-OCUPADA" });
    const { id, vinculoId } = await admitir(rhA, empresaA, {
      matricula: "CT-ORIGINAL",
    });
    await put(rota(id), rhA)
      .send({ nivel: "pleno", salarioBruto: SALARIO_DA_ADMISSAO })
      .expect(200);
    expect(
      (
        await prisma.vinculoFuncional.findUniqueOrThrow({
          where: { id: vinculoId },
        })
      ).matricula,
    ).toBe("CT-ORIGINAL");

    const nova = await put(rota(id), rhA)
      .send({ matricula: "CT-NOVA", salarioBruto: SALARIO_DA_ADMISSAO })
      .expect(200);
    expect(nova.body.vinculo.matricula).toBe("CT-NOVA");

    const recusa = await put(rota(id), rhA)
      .send({ matricula: "CT-OCUPADA", salarioBruto: SALARIO_DA_ADMISSAO })
      .expect(409);
    expect(recusa.body.erros).toEqual([
      { campo: "matricula", motivo: "em_uso" },
    ]);
    expect(JSON.stringify(recusa.body)).not.toContain("CT-OCUPADA");
    expect(
      (
        await prisma.vinculoFuncional.findUniqueOrThrow({
          where: { id: vinculoId },
        })
      ).matricula,
    ).toBe("CT-NOVA");

    // A mesma matrícula do próprio vínculo não conflita com ele mesmo.
    await put(rota(id), rhA)
      .send({ matricula: "CT-NOVA", salarioBruto: SALARIO_DA_ADMISSAO })
      .expect(200);

    const apagada = await put(rota(id), rhA)
      .send({ matricula: null, salarioBruto: SALARIO_DA_ADMISSAO })
      .expect(200);
    expect(apagada.body.vinculo.matricula).toBeNull();
  });

  it("matrícula em uso em OUTRA empresa não conflita", async () => {
    await admitir(rhB, empresaB, { matricula: "CT-OUTRA" });
    const { id } = await admitir(rhA, empresaA);
    const r = await put(rota(id), rhA)
      .send({ matricula: "CT-OUTRA", salarioBruto: SALARIO_DA_ADMISSAO })
      .expect(200);
    expect(r.body.vinculo.matricula).toBe("CT-OUTRA");
  });

  it.each([
    ["nível fora da lista", { nivel: "estagiario" }],
    ["escala fora da lista", { escala: "9x9" }],
    ["conselho fora da lista", { conselhoProfissional: "xyz" }],
    ["registro sem conselho", { registroProfissional: "123" }],
    ["jornada acima de 80", { jornadaSemanalHoras: 81 }],
    ["salário zero", { salarioBruto: "0" }],
    ["pensão acima de 100", { pensaoAlimenticiaPercentual: "100.5" }],
    ["matrícula fora do padrão", { matricula: "ab" }],
    ["campo desconhecido", { observacao: "x" }],
    ["tipo do vínculo (só leitura)", { tipo: "pj" }],
  ])("PUT inválido (%s): 400 e nada gravado", async (_caso, corpo) => {
    const { id, vinculoId } = await admitir(rhA, empresaA, {
      contrato: { nivel: "junior" },
    });
    await put(rota(id), rhA).send(corpo).expect(400);
    const linha = await prisma.contratoVinculo.findUniqueOrThrow({
      where: { vinculoId },
    });
    expect(linha.nivel).toBe("junior");
  });

  it("gestor direto de outra empresa, inexistente ou a própria pessoa: 422 em gestorDiretoId, sem ecoar o id", async () => {
    const { id } = await admitir(rhA, empresaA);
    for (const gestor of [
      gestorB,
      "99999999-9999-4999-8999-999999999999",
      id,
    ]) {
      const r = await put(rota(id), rhA)
        .send({ gestorDiretoId: gestor })
        .expect(422);
      expect(r.body.erros).toEqual([
        { campo: "gestorDiretoId", motivo: "indisponivel" },
      ]);
      expect(JSON.stringify(r.body)).not.toContain(gestor);
    }
  });

  it("DP lê e edita", async () => {
    const { id } = await admitir(rhA, empresaA);
    await get(rota(id), dpA).expect(200);
    const r = await put(rota(id), dpA)
      .send({ salarioBruto: "2500.00" })
      .expect(200);
    expect(r.body.contrato.salarioBruto).toBe("2500.00");
  });

  it("master técnico lê (global) e não edita", async () => {
    const { id } = await admitir(rhA, empresaA, {
      contrato: { nivel: "gerente" },
    });
    const r = await get(rota(id), master).expect(200);
    expect(r.body.empresaId).toBe(empresaA);
    expect(r.body.contrato.nivel).toBe("gerente");
    await put(rota(id), master).send({ nivel: "head" }).expect(403);
  });

  it("gestor, financeiro e colaborador: 403 na leitura e na edição", async () => {
    const { id } = await admitir(rhA, empresaA);
    for (const [, cred] of outrosPapeis) {
      await get(rota(id), cred).expect(403);
      await put(rota(id), cred).send({}).expect(403);
    }
  });

  it("colaborador de outra empresa: 404 na leitura e na edição, sem gravar", async () => {
    const { id, vinculoId } = await admitir(rhA, empresaA);
    await get(rota(id), rhB).expect(404);
    await put(rota(id), rhB).send({ nivel: "pleno" }).expect(404);
    expect(
      await prisma.contratoVinculo.findUnique({ where: { vinculoId } }),
    ).toMatchObject({ nivel: null });
  });

  it("colaborador inexistente: 404", async () => {
    await get(rota("99999999-9999-4999-8999-999999999999"), rhA).expect(404);
  });

  it("PUT sem CSRF: 403 e nada gravado", async () => {
    const { id, vinculoId } = await admitir(rhA, empresaA);
    await agent()
      .put(rota(id))
      .set("Cookie", rhA.cookie)
      .send({ nivel: "pleno" })
      .expect(403);
    expect(
      await prisma.contratoVinculo.findUnique({ where: { vinculoId } }),
    ).toMatchObject({ nivel: null });
  });

  it("vínculo encerrado: a edição é recusada (409) e nada muda", async () => {
    const { id, vinculoId } = await admitir(rhA, empresaA, {
      contrato: { nivel: "junior" },
    });
    await prisma.vinculoFuncional.update({
      where: { id: vinculoId },
      data: { situacao: "encerrado", dataDesligamento: new Date("2026-12-20") },
    });
    const lido = await get(rota(id), rhA).expect(200);
    expect(lido.body.vinculo.situacao).toBe("encerrado");
    expect(lido.body.vinculo.dataDesligamento).toBe("2026-12-20");
    await put(rota(id), rhA).send({ nivel: "pleno" }).expect(409);
    const linha = await prisma.contratoVinculo.findUniqueOrThrow({
      where: { vinculoId },
    });
    expect(linha.nivel).toBe("junior");
  });
});
