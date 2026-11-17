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
 * T209 — cadastro de empresa (Configurações › Empresas › Nova empresa).
 * PostgreSQL real e efêmero (Testcontainers), migrations do zero.
 *
 * Prova: CNPJ (numérico ou alfanumérico) com verificadores conferidos no
 * servidor e único; razão social obrigatória; porte e endereço opcionais e
 * fechados; RH e master criam; quem cria pelo RH ganha a concessão na mesma
 * transação e pode trocar para a empresa nova; DP não cria; a lista da conta
 * marca a principal e conta os vínculos ativos.
 *
 * **Todos os dados são sintéticos.** Domínio reservado `example.test`; CNPJs
 * só de exemplo (verificadores calculados no teste).
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
const SENHA_PADRAO = "Nova!Empresa#Cadastro#2026";

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

/** Verificadores do CNPJ (módulo 11; caractere = ASCII − 48). */
function comVerificadores(base12: string): string {
  const valor = (c: string) => c.charCodeAt(0) - 48;
  const dv = (texto: string) => {
    const pesos =
      texto.length === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const soma = [...texto].reduce((s, c, i) => s + valor(c) * pesos[i]!, 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  const d1 = dv(base12);
  return `${base12}${d1}${dv(`${base12}${d1}`)}`;
}

describe("T209 — cadastro de empresa (e2e)", () => {
  let container: StartedTestContainer;
  let app: INestApplication;
  let prisma: PrismaClient;
  let appUrl: string;

  let master: Credencial;
  let rhA: Credencial;
  let dpA: Credencial;
  let rhB: Credencial;
  let empresaA: string;
  let rhAId: string;

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

  function patch(rota: string, cred: Credencial) {
    return agent()
      .patch(rota)
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
  ): Promise<{ cred: Credencial; id: string }> {
    const r = await post("/v1/users", master)
      .send({ email, password: SENHA_PADRAO, role, companyId })
      .expect(201);
    return { cred: await login(email), id: r.body.id as string };
  }

  let sequencia = 100;
  /** Um CNPJ numérico válido e novo a cada chamada. */
  function novoCnpj(): string {
    sequencia += 1;
    return comVerificadores(`11${String(sequencia).padStart(6, "0")}0001`);
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
        email: "master.empresa@example.test",
        passwordHash: await new PasswordHashService().hash(SENHA_PADRAO),
        role: "master_tecnico",
        status: "active",
      },
    });
    master = await login("master.empresa@example.test");
    const empresa = async (codigo: string) =>
      (
        await post("/v1/empresas", master)
          .send({ codigo, nome: `Empresa ${codigo}` })
          .expect(201)
      ).body.id as string;
    empresaA = await empresa("NEA");
    const empresaB = await empresa("NEB");
    const a = await criarUsuario("rh.a.empresa@example.test", "rh", empresaA);
    rhA = a.cred;
    rhAId = a.id;
    dpA = (await criarUsuario("dp.a.empresa@example.test", "dp", empresaA))
      .cred;
    rhB = (await criarUsuario("rh.b.empresa@example.test", "rh", empresaB))
      .cred;
  });

  afterAll(async () => {
    await app?.close();
    await prisma?.$disconnect();
    await container?.stop();
  });

  it("migration: CNPJ, porte e endereço na empresa, com CHECKs e CNPJ único", async () => {
    const colunas = await prisma.$queryRaw<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'empresa'`;
    expect(colunas.map((c) => c.column_name)).toEqual(
      expect.arrayContaining([
        "cnpj",
        "porte",
        "cep",
        "logradouro",
        "numero",
        "complemento",
        "bairro",
        "cidade",
        "uf",
      ]),
    );
    const restricoes = await prisma.$queryRaw<{ conname: string }[]>`
      SELECT conname FROM pg_constraint
      WHERE conrelid = 'app.empresa'::regclass AND contype = 'c'`;
    expect(restricoes.map((r) => r.conname)).toEqual(
      expect.arrayContaining([
        "empresa_cnpj_check",
        "empresa_porte_check",
        "empresa_cep_check",
        "empresa_uf_check",
      ]),
    );
    const indices = await prisma.$queryRaw<{ indexdef: string }[]>`
      SELECT indexdef FROM pg_indexes WHERE tablename = 'empresa'`;
    expect(
      indices.some(
        (i) => /UNIQUE/.test(i.indexdef) && /\(cnpj\)/.test(i.indexdef),
      ),
    ).toBe(true);
  });

  it("RH cria com CNPJ mascarado: código automático, concessão na hora, e a empresa entra no seletor e na troca", async () => {
    const cnpj = novoCnpj();
    const mascarado = `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12)}`;
    const r = await post("/v1/empresas/cadastro", rhA)
      .send({
        cnpj: mascarado,
        nome: "  Comercio   Sintetico Alfa  ",
        porte: "11_50",
        endereco: {
          cep: "30140071",
          logradouro: "Avenida Sintetica",
          numero: "100",
          bairro: "Bairro Sintetico",
          cidade: "Cidade Sintetica",
          uf: "MG",
        },
      })
      .expect(201);
    expect(r.body).toMatchObject({
      nome: "Comercio Sintetico Alfa",
      cnpj,
      porte: "11_50",
      endereco: {
        cep: "30140071",
        logradouro: "Avenida Sintetica",
        numero: "100",
        complemento: null,
        bairro: "Bairro Sintetico",
        cidade: "Cidade Sintetica",
        uf: "MG",
      },
    });
    expect(r.body.codigo).toMatch(/^COMERCIO_SINTETICO_ALFA(_\d+)?$/);
    const id = r.body.id as string;

    const concessao = await prisma.accessUserEmpresa.findFirst({
      where: { userId: rhAId, empresaId: id, revogadoEm: null },
    });
    expect(concessao?.concedidoPorUserId).toBe(rhAId);

    const contexto = await get("/v1/auth/contexto/empresas", rhA).expect(200);
    expect(contexto.body.itens).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id, nome: "Comercio Sintetico Alfa", cnpj }),
      ]),
    );
    await post("/v1/auth/contexto/empresa", rhA)
      .send({ empresaId: id })
      .expect(200);
    // Volta para a empresa da conta, para não afetar os demais casos.
    await post("/v1/auth/contexto/empresa", rhA)
      .send({ empresaId: empresaA })
      .expect(200);

    // O RH de outra conta não vê nem troca para ela.
    const deB = await get("/v1/auth/contexto/empresas", rhB).expect(200);
    expect(deB.body.itens.map((e: { id: string }) => e.id)).not.toContain(id);
    await post("/v1/auth/contexto/empresa", rhB)
      .send({ empresaId: id })
      .expect(404);
  });

  it("CNPJ alfanumérico válido é aceito; porte e endereço são opcionais", async () => {
    const cnpj = comVerificadores("A1B2C3D40001");
    const r = await post("/v1/empresas/cadastro", rhA)
      .send({ cnpj: cnpj.toLowerCase(), nome: "Servicos Sinteticos Letra" })
      .expect(201);
    expect(r.body).toMatchObject({ cnpj, porte: null });
    expect(r.body.endereco).toMatchObject({
      cep: null,
      cidade: null,
      uf: null,
    });
  });

  it("verificador errado: 422 no campo cnpj, sem eco do valor; nada é gravado", async () => {
    const certo = novoCnpj();
    const errado = `${certo.slice(0, 13)}${(Number(certo[13]) + 1) % 10}`;
    const antes = await prisma.empresa.count();
    const r = await post("/v1/empresas/cadastro", rhA)
      .send({ cnpj: errado, nome: "Empresa Verificador Errado" })
      .expect(422);
    expect(r.body.erros).toEqual([{ campo: "cnpj", motivo: "invalido" }]);
    expect(JSON.stringify(r.body)).not.toContain(errado);
    expect(await prisma.empresa.count()).toBe(antes);
  });

  it("CNPJ já cadastrado: 409 no campo cnpj, mesmo vindo de outra conta", async () => {
    const cnpj = novoCnpj();
    await post("/v1/empresas/cadastro", rhA)
      .send({ cnpj, nome: "Empresa Primeira" })
      .expect(201);
    const r = await post("/v1/empresas/cadastro", rhB)
      .send({ cnpj, nome: "Empresa Segunda" })
      .expect(409);
    expect(r.body.erros).toEqual([{ campo: "cnpj", motivo: "em_uso" }]);
  });

  it("mesmo nome de outra empresa: código diferente", async () => {
    const um = await post("/v1/empresas/cadastro", rhA)
      .send({ cnpj: novoCnpj(), nome: "Nome Repetido" })
      .expect(201);
    const dois = await post("/v1/empresas/cadastro", rhB)
      .send({ cnpj: novoCnpj(), nome: "Nome Repetido" })
      .expect(201);
    expect(um.body.codigo).not.toBe(dois.body.codigo);
  });

  it.each([
    ["sem razão social", { nome: "" }],
    ["razão social longa", { nome: "x".repeat(161) }],
    ["porte fora da lista", { porte: "gigante" }],
    ["UF fora da lista", { endereco: { uf: "XX" } }],
    ["CEP com 7 dígitos", { endereco: { cep: "3014007" } }],
    ["campo desconhecido", { codigo: "MANUAL" }],
    ["sem CNPJ", { cnpj: undefined }],
  ])("%s: 400", async (_, extra) => {
    await post("/v1/empresas/cadastro", rhA)
      .send({ cnpj: novoCnpj(), nome: "Empresa Recusada", ...extra })
      .expect(400);
  });

  it("DP não cria (403); sem CSRF, 403", async () => {
    await post("/v1/empresas/cadastro", dpA)
      .send({ cnpj: novoCnpj(), nome: "Empresa do DP" })
      .expect(403);
    await agent()
      .post("/v1/empresas/cadastro")
      .set("Cookie", rhA.cookie)
      .send({ cnpj: novoCnpj(), nome: "Empresa sem CSRF" })
      .expect(403);
  });

  it("master cria sem concessão (a política dele já é global)", async () => {
    const r = await post("/v1/empresas/cadastro", master)
      .send({ cnpj: novoCnpj(), nome: "Empresa do Master" })
      .expect(201);
    expect(
      await prisma.accessUserEmpresa.count({ where: { empresaId: r.body.id } }),
    ).toBe(0);
  });

  it("criação fica na trilha de auditoria", async () => {
    const r = await post("/v1/empresas/cadastro", rhA)
      .send({ cnpj: novoCnpj(), nome: "Empresa Auditada" })
      .expect(201);
    const eventos = await prisma.auditEvent.count({
      where: {
        action: "organizacao_empresa_criada",
        resourceId: r.body.id,
        actorUserId: rhAId,
      },
    });
    expect(eventos).toBe(1);
  });

  it("empresas da conta: a principal primeiro, com CNPJ, cidade e vínculos ativos; só as autorizadas", async () => {
    const r = await get("/v1/empresas/da-conta", rhA).expect(200);
    const itens = r.body.itens as Array<{
      id: string;
      nome: string;
      principal: boolean;
      colaboradoresAtivos: number;
    }>;
    expect(itens[0]).toMatchObject({ id: empresaA, principal: true });
    expect(itens.filter((e) => e.principal)).toHaveLength(1);
    expect(itens.every((e) => typeof e.colaboradoresAtivos === "number")).toBe(
      true,
    );
    expect(itens).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          nome: "Comercio Sintetico Alfa",
          cidade: "Cidade Sintetica",
          uf: "MG",
          principal: false,
        }),
      ]),
    );
    const deB = await get("/v1/empresas/da-conta", rhB).expect(200);
    expect(deB.body.itens.map((e: { nome: string }) => e.nome)).not.toContain(
      "Comercio Sintetico Alfa",
    );
    // Gestor (e quem não tem a tela) não lê a lista: 403.
    const gestor = await criarUsuario(
      "gestor.a.empresa@example.test",
      "gestor",
      empresaA,
    );
    await get("/v1/empresas/da-conta", gestor.cred).expect(403);
    // DP vê só a própria empresa.
    const doDp = await get("/v1/empresas/da-conta", dpA).expect(200);
    expect(doDp.body.itens.map((e: { id: string }) => e.id)).toEqual([
      empresaA,
    ]);
  });

  describe("editar (painel lateral de Empresas)", () => {
    let editavel: string;
    beforeAll(async () => {
      editavel = (
        await post("/v1/empresas/cadastro", rhA)
          .send({ cnpj: novoCnpj(), nome: "Empresa Para Editar" })
          .expect(201)
      ).body.id as string;
    });

    it("RH edita nome, CNPJ, porte e endereço de empresa que alcança; a lista reflete", async () => {
      const cnpj = novoCnpj();
      const r = await patch(`/v1/empresas/${editavel}/cadastro`, rhA)
        .send({
          cnpj,
          nome: "Empresa Editada",
          porte: "51_200",
          endereco: { cep: "01310100", cidade: "Cidade Editada", uf: "SP" },
        })
        .expect(200);
      expect(r.body).toMatchObject({
        id: editavel,
        nome: "Empresa Editada",
        cnpj,
        porte: "51_200",
        endereco: {
          cep: "01310100",
          cidade: "Cidade Editada",
          uf: "SP",
          logradouro: null,
        },
      });
      const lista = await get("/v1/empresas/da-conta", rhA).expect(200);
      expect(lista.body.itens).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: editavel,
            nome: "Empresa Editada",
            porte: "51_200",
            cep: "01310100",
            cidade: "Cidade Editada",
            uf: "SP",
          }),
        ]),
      );
    });

    it("a principal sem CNPJ ganha o CNPJ pela edição", async () => {
      const cnpj = novoCnpj();
      await patch(`/v1/empresas/${empresaA}/cadastro`, rhA)
        .send({ cnpj, nome: "Empresa NEA" })
        .expect(200);
      const eu = await get("/v1/users/me", rhA).expect(200);
      expect(eu.body.empresaAtiva.cnpj).toBe(cnpj);
    });

    it("outra conta: 404 (sem revelar a empresa); DP: 403", async () => {
      await patch(`/v1/empresas/${editavel}/cadastro`, rhB)
        .send({ cnpj: novoCnpj(), nome: "Invasora" })
        .expect(404);
      await patch(`/v1/empresas/${empresaA}/cadastro`, dpA)
        .send({ cnpj: novoCnpj(), nome: "Pelo DP" })
        .expect(403);
    });

    it("CNPJ de outra empresa: 409; verificador errado: 422; o próprio CNPJ de novo: 200", async () => {
      const outra = novoCnpj();
      await post("/v1/empresas/cadastro", rhA)
        .send({ cnpj: outra, nome: "Dona do CNPJ" })
        .expect(201);
      const r409 = await patch(`/v1/empresas/${editavel}/cadastro`, rhA)
        .send({ cnpj: outra, nome: "Empresa Editada" })
        .expect(409);
      expect(r409.body.erros).toEqual([{ campo: "cnpj", motivo: "em_uso" }]);
      const r422 = await patch(`/v1/empresas/${editavel}/cadastro`, rhA)
        .send({ cnpj: "11222333000182", nome: "Empresa Editada" })
        .expect(422);
      expect(r422.body.erros).toEqual([{ campo: "cnpj", motivo: "invalido" }]);
      const atual = await prisma.empresa.findUniqueOrThrow({
        where: { id: editavel },
      });
      await patch(`/v1/empresas/${editavel}/cadastro`, rhA)
        .send({ cnpj: atual.cnpj, nome: "Empresa Editada" })
        .expect(200);
    });

    it("edição auditada", async () => {
      expect(
        await prisma.auditEvent.count({
          where: {
            action: "organizacao_empresa_atualizada",
            resourceId: editavel,
            actorUserId: rhAId,
          },
        }),
      ).toBeGreaterThan(0);
    });
  });
});
