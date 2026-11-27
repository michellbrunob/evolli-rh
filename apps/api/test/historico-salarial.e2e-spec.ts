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
import { dataLocalDe } from "../src/ponto/competencia.util";
import {
  camposObrigatoriosAdmissao,
  lotacaoMinima,
} from "./admissao-obrigatoria";

/**
 * T215 — Salários: a linha do tempo salarial do vínculo (aba Salários da
 * ficha). `GET/POST /v1/colaboradores/:id/salarios` e
 * `PUT/DELETE /v1/colaboradores/:id/salarios/:alteracaoId`. PostgreSQL real
 * e efêmero (Testcontainers), migrations do zero.
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
const SENHA_PADRAO = "HistoricoSalarial!Sintetico#2026";
/** Dia civil de hoje em São Paulo — a regra do servidor. */
const HOJE = dataLocalDe(new Date());

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

interface Alteracao {
  id: string;
  origem: "admissao" | "alteracao";
  vigenciaInicio: string;
  vigenciaFim: string | null;
  salarioBruto: string;
  cargo: string | null;
  modeloContrato: string | null;
  vigente: boolean;
}

interface Historico {
  colaboradorId: string;
  empresaId: string;
  vinculo: {
    id: string;
    tipo: string;
    situacao: string;
    dataAdmissao: string;
  };
  dependentesIrrf: number | null;
  pensaoAlimenticiaPercentual: string | null;
  alteracoes: Alteracao[];
}

const ADMISSAO = `${Number(HOJE.slice(0, 4)) - 2}-01-05`;
const ANO_PASSADO = `${Number(HOJE.slice(0, 4)) - 1}-03-01`;

function somarDias(dia: string, n: number): string {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

describe("T215 — histórico salarial (e2e)", () => {
  let container: StartedTestContainer;
  let app: INestApplication;
  let prisma: PrismaClient;
  /** Papel do migrador: simula quem foi admitido antes da regra do salário. */
  let migrador: PrismaClient;
  let appUrl: string;

  let master: Credencial;
  let rhA: Credencial;
  let dpA: Credencial;
  let rhB: Credencial;
  let gestorA: Credencial;
  let empresaA: string;
  let empresaB: string;

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

  function put(rota: string, cred: Credencial) {
    return agent()
      .put(rota)
      .set("Cookie", cred.cookie)
      .set("x-csrf-token", cred.csrfToken);
  }

  function del(rota: string, cred: Credencial) {
    return agent()
      .delete(rota)
      .set("Cookie", cred.cookie)
      .set("x-csrf-token", cred.csrfToken);
  }

  let sequencia = 0;
  /** Admite pela API (ativo), com o salário da admissão. */
  async function admitir(
    salario = "2000.00",
  ): Promise<{ id: string; vinculoId: string; cargoId: string }> {
    sequencia += 1;
    const obrigatorios = camposObrigatoriosAdmissao();
    const lotacao = await lotacaoMinima(appUrl, empresaA);
    const r = await post("/v1/colaboradores", rhA)
      .send({
        ...obrigatorios,
        ...lotacao,
        nome: `Pessoa Salario ${sequencia}`,
        empresaId: empresaA,
        tipo: "clt",
        dataAdmissao: ADMISSAO,
        motivoCodigo: "admissao_inicial",
        contrato: { salarioBruto: salario },
      })
      .expect(201);
    await post(`/v1/movimentacoes/${r.body.movimentacao.id}/efetivar`, rhA)
      .send()
      .expect(201);
    return {
      id: r.body.id as string,
      vinculoId: r.body.vinculo.id as string,
      cargoId: lotacao.cargoId,
    };
  }

  /** Quem foi admitido antes da regra: sem salário e sem linha do tempo. */
  async function admitirSemSalario() {
    const p = await admitir();
    await migrador.alteracaoSalarial.deleteMany({
      where: { vinculoId: p.vinculoId },
    });
    await migrador.contratoVinculo.update({
      where: { vinculoId: p.vinculoId },
      data: { salarioBruto: null },
    });
    return p;
  }

  const rota = (id: string) => `/v1/colaboradores/${id}/salarios`;

  async function historico(id: string, cred: Credencial = rhA) {
    return (await get(rota(id), cred).expect(200)).body as Historico;
  }

  async function registrar(id: string, corpo: Record<string, unknown>) {
    return (await post(rota(id), rhA).send(corpo).expect(201))
      .body as Historico;
  }

  async function salarioDoContrato(vinculoId: string) {
    const c = await prisma.contratoVinculo.findUnique({
      where: { vinculoId },
      select: { salarioBruto: true },
    });
    return c?.salarioBruto?.toFixed(2) ?? null;
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
    migrador = new PrismaClient({ datasources: { db: { url: migratorUrl } } });
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
        email: "master.salario@example.test",
        passwordHash: await new PasswordHashService().hash(SENHA_PADRAO),
        role: "master_tecnico",
        status: "active",
      },
    });
    master = await login("master.salario@example.test");
    const empresa = async (codigo: string) =>
      (
        await post("/v1/empresas", master)
          .send({ codigo, nome: `Empresa ${codigo}` })
          .expect(201)
      ).body.id as string;
    empresaA = await empresa("SALA");
    empresaB = await empresa("SALB");
    rhA = await criarUsuario("rh.sala@example.test", "rh", empresaA);
    dpA = await criarUsuario("dp.sala@example.test", "dp", empresaA);
    rhB = await criarUsuario("rh.salb@example.test", "rh", empresaB);
    gestorA = await criarUsuario(
      "gestor.sala@example.test",
      "gestor",
      empresaA,
    );
  });

  afterAll(async () => {
    await app?.close();
    await prisma?.$disconnect();
    await migrador?.$disconnect();
    await container?.stop();
  });

  describe("admissão", () => {
    it("o salário da admissão vira a linha da admissão, vigente", async () => {
      const p = await admitir("1621.00");
      const cargo = await prisma.cargo.findUniqueOrThrow({
        where: { id: p.cargoId },
      });
      const h = await historico(p.id);
      expect(h.vinculo).toMatchObject({ tipo: "clt", dataAdmissao: ADMISSAO });
      expect(h.alteracoes).toEqual([
        expect.objectContaining({
          origem: "admissao",
          vigenciaInicio: ADMISSAO,
          vigenciaFim: null,
          salarioBruto: "1621.00",
          cargo: cargo.nome,
          modeloContrato: null,
          vigente: true,
        }),
      ]);
    });

    it("admissão sem salário é recusada (422 contrato.salarioBruto obrigatorio)", async () => {
      const lotacao = await lotacaoMinima(appUrl, empresaA);
      const semContrato: Record<string, unknown> = {
        ...camposObrigatoriosAdmissao(),
      };
      delete semContrato["contrato"];
      const r = await post("/v1/colaboradores", rhA)
        .send({
          ...semContrato,
          ...lotacao,
          nome: "Pessoa Sem Salario",
          empresaId: empresaA,
          tipo: "clt",
          dataAdmissao: ADMISSAO,
          motivoCodigo: "admissao_inicial",
        })
        .expect(422);
      expect(r.body.erros).toEqual([
        { campo: "contrato.salarioBruto", motivo: "obrigatorio" },
      ]);
      expect(
        await prisma.colaborador.count({
          where: { nome: "Pessoa Sem Salario" },
        }),
      ).toBe(0);
    });

    it("admitido antes da regra (sem salário): a linha do tempo vem vazia", async () => {
      const p = await admitirSemSalario();
      expect((await historico(p.id)).alteracoes).toEqual([]);
    });
  });

  describe("registrar alteração", () => {
    it("reajuste vira o vigente, fecha o período anterior e espelha no contrato", async () => {
      const p = await admitir("2000.00");
      const h = await registrar(p.id, {
        vigenciaInicio: ANO_PASSADO,
        salarioBruto: "2500.00",
        cargo: "Analista Pleno",
        modeloContrato: "CLT",
      });
      expect(
        h.alteracoes.map((a) => [a.vigenciaInicio, a.salarioBruto, a.vigente]),
      ).toEqual([
        [ANO_PASSADO, "2500.00", true],
        [ADMISSAO, "2000.00", false],
      ]);
      expect(h.alteracoes[1]!.vigenciaFim).toBe(somarDias(ANO_PASSADO, -1));
      expect(h.alteracoes[0]).toMatchObject({
        origem: "alteracao",
        cargo: "Analista Pleno",
        modeloContrato: "CLT",
        vigenciaFim: null,
      });
      expect(await salarioDoContrato(p.vinculoId)).toBe("2500.00");
    });

    it("data passada entre dois períodos: o sistema organiza, o vigente não muda", async () => {
      const p = await admitir("2000.00");
      await registrar(p.id, { vigenciaInicio: HOJE, salarioBruto: "3000.00" });
      const h = await registrar(p.id, {
        vigenciaInicio: ANO_PASSADO,
        salarioBruto: "2400.00",
      });
      expect(h.alteracoes.map((a) => a.salarioBruto)).toEqual([
        "3000.00",
        "2400.00",
        "2000.00",
      ]);
      expect(h.alteracoes.map((a) => a.vigente)).toEqual([true, false, false]);
      expect(await salarioDoContrato(p.vinculoId)).toBe("3000.00");
    });

    it("dp também registra", async () => {
      const p = await admitir("2000.00");
      await post(rota(p.id), dpA)
        .send({ vigenciaInicio: ANO_PASSADO, salarioBruto: "2100.00" })
        .expect(201);
    });

    it("sem histórico: o primeiro salário é o da admissão, na data de admissão", async () => {
      const p = await admitirSemSalario();
      const r = await post(rota(p.id), rhA)
        .send({ vigenciaInicio: ANO_PASSADO, salarioBruto: "1800.00" })
        .expect(422);
      expect(r.body.erros).toEqual([
        { campo: "vigenciaInicio", motivo: "nao_se_aplica" },
      ]);
      const h = await registrar(p.id, {
        vigenciaInicio: ADMISSAO,
        salarioBruto: "1800.00",
      });
      expect(h.alteracoes).toHaveLength(1);
      expect(h.alteracoes[0]).toMatchObject({
        origem: "admissao",
        vigenciaInicio: ADMISSAO,
        vigente: true,
        salarioBruto: "1800.00",
      });
      expect(await salarioDoContrato(p.vinculoId)).toBe("1800.00");
    });

    it.each([
      ["antes da admissão", "fora_de_ordem", () => somarDias(ADMISSAO, -1)],
      ["no futuro", "futura", () => somarDias(HOJE, 1)],
    ])("recusa a data %s (422 %s)", async (_r, motivo, data) => {
      const p = await admitir("2000.00");
      const r = await post(rota(p.id), rhA)
        .send({ vigenciaInicio: data(), salarioBruto: "2100.00" })
        .expect(422);
      expect(r.body.erros).toEqual([{ campo: "vigenciaInicio", motivo }]);
    });

    it("recusa a mesma data de outro período (409 em_uso)", async () => {
      const p = await admitir("2000.00");
      const r = await post(rota(p.id), rhA)
        .send({ vigenciaInicio: ADMISSAO, salarioBruto: "2100.00" })
        .expect(409);
      expect(r.body.erros).toEqual([
        { campo: "vigenciaInicio", motivo: "em_uso" },
      ]);
    });

    it.each([
      ["zero", { salarioBruto: "0.00" }],
      ["negativo", { salarioBruto: "-10.00" }],
      ["texto", { salarioBruto: "mil" }],
      ["sem data", { vigenciaInicio: undefined }],
      ["data inválida", { vigenciaInicio: "2025-02-30" }],
      ["cargo longo", { cargo: "x".repeat(121) }],
      ["modelo longo", { modeloContrato: "x".repeat(61) }],
      ["campo a mais", { observacao: "x" }],
    ])("recusa corpo inválido: %s (400)", async (_r, troca) => {
      const p = await admitir("2000.00");
      await post(rota(p.id), rhA)
        .send({
          vigenciaInicio: ANO_PASSADO,
          salarioBruto: "2100.00",
          ...troca,
        })
        .expect(400);
    });
  });

  describe("editar e remover", () => {
    it("editar a alteração muda valor, data, cargo e contrato; o contrato acompanha", async () => {
      const p = await admitir("2000.00");
      const id = (
        await registrar(p.id, {
          vigenciaInicio: ANO_PASSADO,
          salarioBruto: "2500.00",
        })
      ).alteracoes[0]!.id;
      const h = (
        await put(`${rota(p.id)}/${id}`, rhA)
          .send({
            vigenciaInicio: HOJE,
            salarioBruto: "2600.00",
            cargo: "Coordenadora",
            modeloContrato: "CLT",
          })
          .expect(200)
      ).body as Historico;
      expect(h.alteracoes[0]).toMatchObject({
        id,
        vigenciaInicio: HOJE,
        salarioBruto: "2600.00",
        cargo: "Coordenadora",
      });
      expect(await salarioDoContrato(p.vinculoId)).toBe("2600.00");
    });

    it("editar para a data de outro período: 409 em_uso", async () => {
      const p = await admitir("2000.00");
      const id = (
        await registrar(p.id, {
          vigenciaInicio: ANO_PASSADO,
          salarioBruto: "2500.00",
        })
      ).alteracoes[0]!.id;
      await put(`${rota(p.id)}/${id}`, rhA)
        .send({ vigenciaInicio: ADMISSAO, salarioBruto: "2500.00" })
        .expect(409);
    });

    it("a linha da admissão edita valor e cargo, mas não a data", async () => {
      const p = await admitir("2000.00");
      const id = (await historico(p.id)).alteracoes[0]!.id;
      await put(`${rota(p.id)}/${id}`, rhA)
        .send({
          vigenciaInicio: ADMISSAO,
          salarioBruto: "2050.00",
          cargo: "Assistente",
        })
        .expect(200);
      expect(await salarioDoContrato(p.vinculoId)).toBe("2050.00");
      const r = await put(`${rota(p.id)}/${id}`, rhA)
        .send({ vigenciaInicio: ANO_PASSADO, salarioBruto: "2050.00" })
        .expect(422);
      expect(r.body.erros).toEqual([
        { campo: "vigenciaInicio", motivo: "nao_se_aplica" },
      ]);
    });

    it("remover: some da linha do tempo, fica no banco, o vigente volta ao anterior", async () => {
      const p = await admitir("2000.00");
      const id = (
        await registrar(p.id, {
          vigenciaInicio: ANO_PASSADO,
          salarioBruto: "2500.00",
        })
      ).alteracoes[0]!.id;
      const h = (await del(`${rota(p.id)}/${id}`, rhA).expect(200))
        .body as Historico;
      expect(h.alteracoes.map((a) => a.salarioBruto)).toEqual(["2000.00"]);
      expect(h.alteracoes[0]!.vigente).toBe(true);
      expect(await salarioDoContrato(p.vinculoId)).toBe("2000.00");
      const linha = await prisma.alteracaoSalarial.findUnique({
        where: { id },
      });
      expect(linha?.removidaEm).not.toBeNull();
      // A data volta a ficar livre.
      await registrar(p.id, {
        vigenciaInicio: ANO_PASSADO,
        salarioBruto: "2400.00",
      });
      // Removida não se edita nem se remove de novo.
      await del(`${rota(p.id)}/${id}`, rhA).expect(404);
    });

    it("a linha da admissão não se remove (409)", async () => {
      const p = await admitir("2000.00");
      const id = (await historico(p.id)).alteracoes[0]!.id;
      await del(`${rota(p.id)}/${id}`, rhA).expect(409);
    });

    it("alteração de outra pessoa ou inexistente: 404", async () => {
      const p = await admitir("2000.00");
      const outra = await admitir("2000.00");
      const id = (await historico(outra.id)).alteracoes[0]!.id;
      await put(`${rota(p.id)}/${id}`, rhA)
        .send({ vigenciaInicio: ADMISSAO, salarioBruto: "1.00" })
        .expect(404);
      await del(`${rota(p.id)}/${id}`, rhA).expect(404);
      await del(
        `${rota(p.id)}/00000000-0000-4000-8000-000000000000`,
        rhA,
      ).expect(404);
    });
  });

  describe("edição do contrato (Dados profissionais)", () => {
    it("com histórico, salário diferente é recusado (422 nao_se_aplica) e o período vigente fica intacto", async () => {
      const p = await admitir("2000.00");
      const r = await put(`/v1/colaboradores/${p.id}/contrato`, rhA)
        .send({ salarioBruto: "2200.00" })
        .expect(422);
      expect(r.body.erros).toEqual([
        { campo: "salarioBruto", motivo: "nao_se_aplica" },
      ]);
      const h = await historico(p.id);
      expect(h.alteracoes.map((a) => [a.origem, a.salarioBruto])).toEqual([
        ["admissao", "2000.00"],
      ]);
      expect(await salarioDoContrato(p.vinculoId)).toBe("2000.00");
    });

    it("aumento não vira retroativo: o reajuste segue pela aba Salários e o contrato só espelha", async () => {
      const p = await admitir("2000.00");
      await registrar(p.id, { vigenciaInicio: HOJE, salarioBruto: "2500.00" });
      // Sem o salário no corpo (a tela não o envia mais): nada muda nele.
      const r = await put(`/v1/colaboradores/${p.id}/contrato`, rhA)
        .send({ nivel: "pleno" })
        .expect(200);
      expect(r.body.contrato.salarioBruto).toBe("2500.00");
      const h = await historico(p.id);
      expect(
        h.alteracoes.map((a) => [a.vigenciaInicio, a.salarioBruto]),
      ).toEqual([
        [HOJE, "2500.00"],
        [ADMISSAO, "2000.00"],
      ]);
    });

    it("sem histórico, o salário do contrato cria a linha da admissão", async () => {
      const semSalario = await admitirSemSalario();
      await put(`/v1/colaboradores/${semSalario.id}/contrato`, rhA)
        .send({ salarioBruto: "1900.00" })
        .expect(200);
      const h = await historico(semSalario.id);
      expect(h.alteracoes).toEqual([
        expect.objectContaining({
          origem: "admissao",
          vigenciaInicio: ADMISSAO,
          salarioBruto: "1900.00",
        }),
      ]);
      expect(await salarioDoContrato(semSalario.vinculoId)).toBe("1900.00");
    });

    it("com histórico, apagar o salário no contrato é recusado (422 obrigatorio)", async () => {
      const p = await admitir("2000.00");
      const r = await put(`/v1/colaboradores/${p.id}/contrato`, rhA)
        .send({ salarioBruto: null })
        .expect(422);
      expect(r.body.erros).toEqual([
        { campo: "salarioBruto", motivo: "obrigatorio" },
      ]);
    });
  });

  describe("admissão futura", () => {
    it("antes do primeiro dia, a linha da admissão não é vigente", async () => {
      sequencia += 1;
      const futura = somarDias(HOJE, 10);
      const r = await post("/v1/colaboradores", rhA)
        .send({
          ...camposObrigatoriosAdmissao(),
          ...(await lotacaoMinima(appUrl, empresaA)),
          nome: `Pessoa Salario Futura ${sequencia}`,
          empresaId: empresaA,
          tipo: "clt",
          dataAdmissao: futura,
          motivoCodigo: "admissao_inicial",
          contrato: { salarioBruto: "3000.00" },
        })
        .expect(201);
      const h = await historico(r.body.id as string);
      expect(h.alteracoes).toEqual([
        expect.objectContaining({
          origem: "admissao",
          vigenciaInicio: futura,
          vigenciaFim: null,
          salarioBruto: "3000.00",
          vigente: false,
        }),
      ]);
    });
  });

  describe("readmissão (POST /v1/vinculos)", () => {
    async function desligado() {
      const p = await admitir("2000.00");
      await prisma.vinculoFuncional.update({
        where: { id: p.vinculoId },
        data: {
          situacao: "encerrado",
          dataDesligamento: new Date(`${ANO_PASSADO}T00:00:00Z`),
        },
      });
      return p;
    }

    it("sem salário: 422 contrato.salarioBruto obrigatorio e nenhum vínculo novo", async () => {
      const p = await desligado();
      const lotacao = await lotacaoMinima(appUrl, empresaA);
      const r = await post("/v1/vinculos", rhA)
        .send({
          colaboradorId: p.id,
          empresaId: empresaA,
          matricula: `READM-${sequencia}`,
          tipo: "clt",
          dataAdmissao: HOJE,
          motivoCodigo: "admissao_inicial",
          departamentoId: lotacao.departamentoId,
          cargoId: lotacao.cargoId,
        })
        .expect(422);
      expect(r.body.erros).toEqual([
        { campo: "contrato.salarioBruto", motivo: "obrigatorio" },
      ]);
      expect(
        await prisma.vinculoFuncional.count({ where: { colaboradorId: p.id } }),
      ).toBe(1);
    });

    it("com salário: o vínculo novo abre a própria linha do tempo, com a tag Admissão e o cargo", async () => {
      const p = await desligado();
      const lotacao = await lotacaoMinima(appUrl, empresaA);
      const cargo = await prisma.cargo.findUniqueOrThrow({
        where: { id: lotacao.cargoId },
      });
      const r = await post("/v1/vinculos", rhA)
        .send({
          colaboradorId: p.id,
          empresaId: empresaA,
          matricula: `READM-OK-${sequencia}`,
          tipo: "clt",
          dataAdmissao: HOJE,
          motivoCodigo: "admissao_inicial",
          departamentoId: lotacao.departamentoId,
          cargoId: lotacao.cargoId,
          contrato: { salarioBruto: "2800.00" },
        })
        .expect(201);
      const novo = r.body.id as string;
      const linhas = await prisma.alteracaoSalarial.findMany({
        where: { vinculoId: novo },
      });
      expect(linhas).toHaveLength(1);
      expect(linhas[0]).toMatchObject({
        origem: "admissao",
        cargo: cargo.nome,
      });
      expect(linhas[0]!.salarioBruto.toFixed(2)).toBe("2800.00");
      expect(linhas[0]!.vigenciaInicio.toISOString().slice(0, 10)).toBe(HOJE);
      expect(await salarioDoContrato(novo)).toBe("2800.00");
      // O vínculo antigo guarda o próprio histórico.
      expect(await salarioDoContrato(p.vinculoId)).toBe("2000.00");
    });
  });

  describe("migration", () => {
    it("histórico preservado: a aplicação não apaga linha salarial", async () => {
      const linhas = await prisma.$queryRaw<{ pode: boolean }[]>`
        SELECT has_table_privilege('evolli_app', 'app.alteracao_salarial', 'DELETE') AS pode`;
      expect(linhas[0]!.pode).toBe(false);
    });

    it("CHECKs: salário positivo e linha da admissão nunca removida", async () => {
      const p = await admitir("2000.00");
      const linha = await prisma.alteracaoSalarial.findFirstOrThrow({
        where: { vinculoId: p.vinculoId },
      });
      const autor = await prisma.accessUser.findFirstOrThrow({
        where: { email: "rh.sala@example.test" },
      });
      await expect(
        prisma.alteracaoSalarial.update({
          where: { id: linha.id },
          data: { salarioBruto: "0" },
        }),
      ).rejects.toThrow();
      await expect(
        prisma.alteracaoSalarial.update({
          where: { id: linha.id },
          data: { removidaEm: new Date(), removidaPorUserId: autor.id },
        }),
      ).rejects.toThrow();
    });
  });

  describe("acesso e trilha", () => {
    it("gestor não lê nem grava (403)", async () => {
      const p = await admitir("2000.00");
      await get(rota(p.id), gestorA).expect(403);
      await post(rota(p.id), gestorA)
        .send({ vigenciaInicio: ANO_PASSADO, salarioBruto: "2100.00" })
        .expect(403);
    });

    it("outra empresa: 404 (sem revelar a pessoa)", async () => {
      const p = await admitir("2000.00");
      await get(rota(p.id), rhB).expect(404);
      await post(rota(p.id), rhB)
        .send({ vigenciaInicio: ANO_PASSADO, salarioBruto: "2100.00" })
        .expect(404);
    });

    it("master técnico sem empresa ativa lê (consulta global auditada)", async () => {
      const p = await admitir("2000.00");
      const h = await historico(p.id, master);
      expect(h.empresaId).toBe(empresaA);
    });

    it("cada gravação deixa um evento com o id da alteração, sem valores", async () => {
      const p = await admitir("2000.00");
      const id = (
        await registrar(p.id, {
          vigenciaInicio: ANO_PASSADO,
          salarioBruto: "2777.00",
          cargo: "Cargo Sigiloso",
        })
      ).alteracoes[0]!.id;
      await put(`${rota(p.id)}/${id}`, rhA)
        .send({ vigenciaInicio: ANO_PASSADO, salarioBruto: "2778.00" })
        .expect(200);
      await del(`${rota(p.id)}/${id}`, rhA).expect(200);
      const eventos = await prisma.auditEvent.findMany({
        where: { resourceId: id },
        orderBy: { occurredAt: "asc" },
      });
      expect(eventos.map((e) => e.action)).toEqual([
        "pessoas_salario_registrado",
        "pessoas_salario_atualizado",
        "pessoas_salario_removido",
      ]);
      for (const e of eventos) {
        expect(e).toMatchObject({
          resource: "alteracao_salarial",
          companyId: empresaA,
        });
      }
      const texto = JSON.stringify(eventos);
      expect(texto).not.toContain("2777");
      expect(texto).not.toContain("Cargo Sigiloso");
    });

    it("desligado: só leitura (409 ao gravar)", async () => {
      const p = await admitir("2000.00");
      await prisma.vinculoFuncional.update({
        where: { id: p.vinculoId },
        data: {
          situacao: "encerrado",
          dataDesligamento: new Date(`${HOJE}T00:00:00Z`),
        },
      });
      await get(rota(p.id), rhA).expect(200);
      await post(rota(p.id), rhA)
        .send({ vigenciaInicio: ANO_PASSADO, salarioBruto: "2100.00" })
        .expect(409);
    });
  });
});
