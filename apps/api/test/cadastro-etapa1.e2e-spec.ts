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
import { contratoDaAdmissao, lotacaoMinima } from "./admissao-obrigatoria";

/**
 * T209 — Novo colaborador, etapa 1 (dados básicos). PostgreSQL real e
 * efêmero (Testcontainers), migrations do zero.
 *
 * Prova: data de nascimento opcional; CPF (dígitos verificadores, máscara
 * aceita, gravado só com dígitos, único por empresa), RG, gênero em lista
 * fechada, estado civil e contato de emergência no perfil pessoal; nome com
 * pelo menos 3 letras e até 150 caracteres; trilha só com nomes de campos; a
 * ficha não apaga o que não enviou.
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
const SENHA_PADRAO = "Etapa!Um#Cadastro#2026";

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

/** CPFs sintéticos com dígitos verificadores válidos (gerados para teste). */
const CPF_A = "52998224725";
const CPF_A_FORMATADO = "529.982.247-25";
const CPF_B = "11144477735";
const CPF_DV_ERRADO = "52998224726";

describe("T209 — Novo colaborador, etapa 1 (e2e)", () => {
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
  /** Admissão mínima da etapa 1, com a lotação e o vínculo de hoje. */
  async function corpo(
    empresaId: string,
    perfil: Record<string, unknown>,
    extra: Record<string, unknown> = {},
  ) {
    sequencia += 1;
    return {
      ...(await lotacaoMinima(appUrl, empresaId)),
      nome: `Pessoa Etapa Um ${String.fromCharCode(64 + sequencia)}`,
      empresaId,
      tipo: "clt",
      dataAdmissao: "2026-12-01",
      motivoCodigo: "admissao_inicial",
      perfilPessoal: perfil,
      ...extra,
      contrato: contratoDaAdmissao(extra["contrato"]),
    };
  }

  const perfilDoBanco = (colaboradorId: string) =>
    prisma.perfilPessoalColaborador.findFirstOrThrow({
      where: { colaboradorId },
    });

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
        email: "master.etapa1@example.test",
        passwordHash: await new PasswordHashService().hash(SENHA_PADRAO),
        role: "master_tecnico",
        status: "active",
      },
    });
    master = await login("master.etapa1@example.test");
    const empresa = async (codigo: string) =>
      (
        await post("/v1/empresas", master)
          .send({ codigo, nome: `Empresa ${codigo}` })
          .expect(201)
      ).body.id as string;
    empresaA = await empresa("ET1A");
    empresaB = await empresa("ET1B");
    rhA = await criarUsuario("rh.et1a@example.test", "rh", empresaA);
    dpA = await criarUsuario("dp.et1a@example.test", "dp", empresaA);
    rhB = await criarUsuario("rh.et1b@example.test", "rh", empresaB);
  });

  afterAll(async () => {
    await app?.close();
    await prisma?.$disconnect();
    await container?.stop();
  });

  it("migration: nascimento opcional, colunas novas, CHECKs e CPF único por empresa", async () => {
    const colunas = await prisma.$queryRaw<
      { column_name: string; is_nullable: string }[]
    >`SELECT column_name, is_nullable FROM information_schema.columns
      WHERE table_name = 'perfil_pessoal_colaborador'`;
    const mapa = new Map(colunas.map((c) => [c.column_name, c.is_nullable]));
    expect(mapa.get("data_nascimento")).toBe("YES");
    for (const nova of [
      "cpf",
      "rg",
      "genero",
      "contato_emergencia_nome",
      "contato_emergencia_telefone",
    ]) {
      expect(mapa.get(nova)).toBe("YES");
    }
    const valores = await prisma.$queryRaw<{ v: string }[]>`
      SELECT unnest(enum_range(NULL::"CampoDadosPessoais"))::text AS v`;
    expect(valores.map((x) => x.v)).toEqual(
      expect.arrayContaining([
        "cpf",
        "rg",
        "genero",
        "contato_emergencia_nome",
        "contato_emergencia_telefone",
      ]),
    );
    const checks = await prisma.$queryRaw<{ conname: string }[]>`
      SELECT conname FROM pg_constraint
      WHERE conrelid = 'perfil_pessoal_colaborador'::regclass AND contype = 'c'`;
    const nomes = checks.map((c) => c.conname);
    for (const esperado of [
      "perfil_pessoal_colaborador_cpf_check",
      "perfil_pessoal_colaborador_rg_check",
      "perfil_pessoal_colaborador_genero_check",
      "perfil_pessoal_colaborador_contato_emergencia_check",
    ]) {
      expect(nomes).toContain(esperado);
    }
    const indices = await prisma.$queryRaw<{ indexdef: string }[]>`
      SELECT indexdef FROM pg_indexes
      WHERE tablename = 'perfil_pessoal_colaborador'`;
    expect(
      indices.some(
        (i) => /UNIQUE/.test(i.indexdef) && /empresa_id, cpf/.test(i.indexdef),
      ),
    ).toBe(true);
  });

  it("admissão da etapa 1: CPF (com máscara), RG, gênero, estado civil, emergência e SEM nascimento", async () => {
    const r = await post("/v1/colaboradores", rhA)
      .send(
        await corpo(empresaA, {
          cpf: CPF_A_FORMATADO,
          rg: " 12.345.678-9 ",
          genero: "feminino",
          estadoCivil: "Casado(a)",
          contatoEmergenciaNome: "  Contato   Sintetico ",
          contatoEmergenciaTelefone: "(11) 98765-4321",
        }),
      )
      .expect(201);
    expect(r.body.perfilPessoal).toMatchObject({
      dataNascimento: null,
      cpf: CPF_A,
      rg: "12.345.678-9",
      genero: "feminino",
      estadoCivil: "Casado(a)",
      contatoEmergenciaNome: "Contato Sintetico",
      contatoEmergenciaTelefone: "+5511987654321",
    });
    const gravado = await perfilDoBanco(r.body.id);
    expect(gravado.cpf).toBe(CPF_A);
    expect(gravado.dataNascimento).toBeNull();
    // Trilha: só o nome dos campos, nunca o valor.
    const eventos = await prisma.dadosPessoaisColaboradorEvento.findMany({
      where: { colaboradorId: r.body.id },
    });
    expect(eventos.flatMap((e) => e.campos)).toEqual(
      expect.arrayContaining(["cpf", "rg", "genero"]),
    );
    expect(JSON.stringify(eventos)).not.toContain(CPF_A);
    const auditoria = await prisma.auditEvent.findMany({
      where: { resourceId: r.body.id },
    });
    expect(JSON.stringify(auditoria)).not.toContain(CPF_A);
    // A leitura da ficha devolve os campos novos.
    const ficha = await agent()
      .get(`/v1/colaboradores/${r.body.id}/dados-pessoais`)
      .set("Cookie", dpA.cookie)
      .expect(200);
    expect(ficha.body.perfilPessoal).toMatchObject({
      dataNascimento: null,
      cpf: CPF_A,
      genero: "feminino",
    });
  });

  it("CPF com dígito verificador errado: 400 e nada é gravado", async () => {
    const antes = await prisma.colaborador.count();
    await post("/v1/colaboradores", rhA)
      .send(await corpo(empresaA, { cpf: CPF_DV_ERRADO }))
      .expect(400);
    await post("/v1/colaboradores", rhA)
      .send(await corpo(empresaA, { cpf: "111.111.111-11" }))
      .expect(400);
    expect(await prisma.colaborador.count()).toBe(antes);
  });

  it("CPF já usado NA EMPRESA: 409 em `perfilPessoal.cpf`, sem ecoar o CPF; em outra empresa, aceito", async () => {
    const antes = await prisma.colaborador.count();
    const r = await post("/v1/colaboradores", dpA)
      .send(await corpo(empresaA, { cpf: CPF_A }))
      .expect(409);
    expect(r.body.erros).toEqual([
      { campo: "perfilPessoal.cpf", motivo: "em_uso" },
    ]);
    expect(JSON.stringify(r.body)).not.toContain(CPF_A);
    expect(await prisma.colaborador.count()).toBe(antes);
    await post("/v1/colaboradores", rhB)
      .send(await corpo(empresaB, { cpf: CPF_A }))
      .expect(201);
  });

  it("gênero fora da lista: 400", async () => {
    await post("/v1/colaboradores", rhA)
      .send(await corpo(empresaA, { cpf: CPF_B, genero: "nao_binario" }))
      .expect(400);
  });

  it("telefone de emergência inválido ou nome de emergência longo demais: 400", async () => {
    await post("/v1/colaboradores", rhA)
      .send(
        await corpo(empresaA, {
          cpf: CPF_B,
          contatoEmergenciaTelefone: "123",
        }),
      )
      .expect(400);
    await post("/v1/colaboradores", rhA)
      .send(
        await corpo(empresaA, {
          cpf: CPF_B,
          contatoEmergenciaNome: "x".repeat(151),
        }),
      )
      .expect(400);
  });

  it("nome: pelo menos 3 letras e até 150 caracteres", async () => {
    const curto = await corpo(empresaA, { cpf: CPF_B });
    curto.nome = "A B";
    await post("/v1/colaboradores", rhA).send(curto).expect(400);
    const comNumeros = await corpo(empresaA, { cpf: CPF_B });
    comNumeros.nome = "A1 2B";
    await post("/v1/colaboradores", rhA).send(comNumeros).expect(400);
    const longo = await corpo(empresaA, { cpf: CPF_B });
    longo.nome = `Ana ${"a".repeat(147)}`;
    await post("/v1/colaboradores", rhA).send(longo).expect(400);
    const tresLetras = await corpo(empresaA, { cpf: CPF_B });
    tresLetras.nome = "Ana";
    await post("/v1/colaboradores", rhA).send(tresLetras).expect(201);
  });

  it("retificação do nome segue a mesma regra", async () => {
    const r = await post("/v1/colaboradores", rhA)
      .send(await corpo(empresaA, {}))
      .expect(201);
    await agent()
      .patch(`/v1/colaboradores/${r.body.id}`)
      .set("Cookie", rhA.cookie)
      .set("x-csrf-token", rhA.csrfToken)
      .send({ nome: "Al" })
      .expect(400);
  });

  it("sem CPF a API aceita (a importação por planilha não traz CPF); a tela o exige", async () => {
    const r = await post("/v1/colaboradores", rhA)
      .send(await corpo(empresaA, { dataNascimento: "1990-02-03" }))
      .expect(201);
    expect(r.body.perfilPessoal.cpf).toBeNull();
  });

  it("ficha: o PUT sem CPF, RG, gênero ou emergência MANTÉM os gravados; enviados, altera", async () => {
    const admitido = await post("/v1/colaboradores", rhA)
      .send(
        await corpo(empresaA, {
          cpf: "39053344705",
          rg: "MG-1.234.567",
          genero: "masculino",
          contatoEmergenciaNome: "Contato Um",
          contatoEmergenciaTelefone: "11987650000",
        }),
      )
      .expect(201);
    const rota = `/v1/colaboradores/${admitido.body.id}/dados-pessoais`;
    await put(rota, dpA)
      .send({ perfilPessoal: { dataNascimento: "1985-04-05" } })
      .expect(200);
    let gravado = await perfilDoBanco(admitido.body.id);
    expect(gravado).toMatchObject({
      cpf: "39053344705",
      rg: "MG-1.234.567",
      genero: "masculino",
      contatoEmergenciaNome: "Contato Um",
      contatoEmergenciaTelefone: "+5511987650000",
    });
    await put(rota, dpA)
      .send({
        perfilPessoal: {
          dataNascimento: "1985-04-05",
          genero: "outro",
          rg: null,
        },
      })
      .expect(200);
    gravado = await perfilDoBanco(admitido.body.id);
    expect(gravado.genero).toBe("outro");
    expect(gravado.rg).toBeNull();
    expect(gravado.cpf).toBe("39053344705");
    // CPF de outra pessoa da mesma empresa pela ficha: 409.
    await put(rota, dpA)
      .send({ perfilPessoal: { cpf: CPF_A } })
      .expect(409);
  });
});
