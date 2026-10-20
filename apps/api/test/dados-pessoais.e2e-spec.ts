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
 * T177 — Cadastro de colaborador, Módulo 1: dados pessoais, endereço e
 * contatos na admissão. PostgreSQL real e efêmero (Testcontainers), migrations
 * aplicadas do zero.
 *
 * Prova o que só o banco prova: a admissão com os três blocos é UMA transação
 * (falhou uma parte, nada fica), os contatos têm uma única fonte, a trilha não
 * guarda valor pessoal, o isolamento por empresa ativa vale também depois de
 * trocar de empresa, e só `rh` e `dp` alcançam estas categorias.
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
const SENHA_PADRAO = "Pessoas!Modulo1#2026";
const ADMISSAO = "2026-01-05";

/** Valores sintéticos que NÃO podem aparecer em trilha nenhuma. */
const PERFIL = {
  dataNascimento: "1991-07-14",
  sexo: "  Feminino ",
  saudacao: "Sra.",
  estadoCivil: "Casada",
  nacionalidade: "Brasileira",
  naturalidade: "Ouro   Preto",
  escolaridade: "Superior completo",
  curso: "Engenharia Sintética",
  nomePai: "Pai Sintetico Modulo",
  nomeMae: "Mae Sintetica Modulo",
};
const ENDERECO = {
  pais: "Brasil",
  cep: "30140-071",
  logradouro: "Avenida Sintetica Modulo",
  numero: "1771",
  complemento: "Sala 7",
  bairro: "Bairro Sintetico",
  cidade: "Cidade Sintetica",
  estado: "MG",
};
const CONTATOS = {
  emailPessoal: "Pessoa.Modulo1@Example.TEST",
  celular: "+55 (31) 98888-1771",
  telefone: "31 3333-1771",
};
const VALORES_PESSOAIS = [
  "1991-07-14",
  "Feminino",
  "Casada",
  "Brasileira",
  "Ouro Preto",
  "Engenharia Sintética",
  "Pai Sintetico Modulo",
  "Mae Sintetica Modulo",
  "30140-071",
  "Avenida Sintetica Modulo",
  "Bairro Sintetico",
  "Cidade Sintetica",
  "pessoa.modulo1@example.test",
  "+5531988881771",
  "3133331771",
];

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

interface Credencial {
  cookie: string;
  csrfToken: string;
}

describe("Cadastro de colaborador — Módulo 1 (e2e)", () => {
  let container: StartedTestContainer;
  let appUrl: string;
  let migratorUrl: string;
  let app: INestApplication;
  let prisma: PrismaClient;

  let master: Credencial;
  let rhA: Credencial;
  let rhB: Credencial;
  let dpA: Credencial;
  let gestorA: Credencial;
  let colaboradorA: Credencial;
  let financeiroA: Credencial;

  let empresaA: string;
  let empresaB: string;
  let departamentoA: string;
  let departamentoB: string;

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
    return { cookie, csrfToken: response.body.csrfToken };
  }

  async function seedMaster(email: string): Promise<Credencial> {
    const { PasswordHashService } =
      await import("../src/auth/password/password-hash.service");
    const passwordHash = await new PasswordHashService().hash(SENHA_PADRAO);
    await prisma.accessUser.create({
      data: { email, passwordHash, role: "master_tecnico", status: "active" },
    });
    return login(email, SENHA_PADRAO);
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
    return login(email, SENHA_PADRAO);
  }

  function admissao(matricula: string, extra: Record<string, unknown> = {}) {
    return {
      nome: `Pessoa Sintetica ${matricula}`,
      empresaId: empresaA,
      matricula,
      tipo: "clt",
      dataAdmissao: ADMISSAO,
      motivoCodigo: "admissao_inicial",
      departamentoId: departamentoA,
      perfilPessoal: PERFIL,
      endereco: ENDERECO,
      contatos: CONTATOS,
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
    prisma = new PrismaClient({ datasources: { db: { url: appUrl } } });
    app = await buildApp();
    master = await seedMaster("master.modulo1@example.test");

    empresaA = (
      await post("/v1/empresas", master)
        .send({ codigo: "MOD1A", nome: "Empresa Modulo A" })
        .expect(201)
    ).body.id;
    empresaB = (
      await post("/v1/empresas", master)
        .send({ codigo: "MOD1B", nome: "Empresa Modulo B" })
        .expect(201)
    ).body.id;
    departamentoA = (
      await post("/v1/departamentos", master)
        .send({ empresaId: empresaA, codigo: "DEPM1A", nome: "Depto A" })
        .expect(201)
    ).body.id;
    departamentoB = (
      await post("/v1/departamentos", master)
        .send({ empresaId: empresaB, codigo: "DEPM1B", nome: "Depto B" })
        .expect(201)
    ).body.id;

    rhA = await criarUsuario("rh.m1a@example.test", "rh", empresaA);
    rhB = await criarUsuario("rh.m1b@example.test", "rh", empresaB);
    dpA = await criarUsuario("dp.m1a@example.test", "dp", empresaA);
    gestorA = await criarUsuario("gestor.m1a@example.test", "gestor", empresaA);
    colaboradorA = await criarUsuario(
      "colab.m1a@example.test",
      "colaborador",
      empresaA,
    );
    financeiroA = await criarUsuario(
      "fin.m1a@example.test",
      "financeiro",
      empresaA,
    );
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    await app?.close();
    await container?.stop();
  });

  describe("admissão com os três blocos", () => {
    let colaboradorId: string;
    let resposta: Record<string, unknown>;

    beforeAll(async () => {
      const r = await post("/v1/colaboradores", rhA)
        .send(admissao("MAT-M1-001"))
        .expect(201);
      resposta = r.body;
      colaboradorId = r.body.id;
    });

    it("devolve o que o servidor gravou, já normalizado", () => {
      expect(resposta.perfilPessoal).toMatchObject({
        dataNascimento: "1991-07-14",
        sexo: "Feminino",
        naturalidade: "Ouro Preto",
        nomeMae: "Mae Sintetica Modulo",
      });
      expect(resposta.endereco).toMatchObject({
        pais: "Brasil",
        cep: "30140-071",
        estado: "MG",
      });
      expect(resposta.contatos).toMatchObject({
        emailPessoal: "pessoa.modulo1@example.test",
        celular: "+5531988881771",
        telefone: "3133331771",
      });
    });

    it("a leitura posterior recupera perfil e endereço persistidos", async () => {
      const r = await get(
        `/v1/colaboradores/${colaboradorId}/dados-pessoais`,
        rhA,
      ).expect(200);
      expect(r.headers["cache-control"]).toBe("no-store");
      expect(r.body.situacao).toBe("registrado");
      expect(r.body.empresaId).toBe(empresaA);
      expect(r.body.perfilPessoal).toMatchObject({
        sexo: "Feminino",
        escolaridade: "Superior completo",
      });
      expect(r.body.endereco).toMatchObject({ cidade: "Cidade Sintetica" });
    });

    it("os contatos ficam na fonte única da T169 e são lidos pela rota dela", async () => {
      const r = await get(
        `/v1/colaboradores/${colaboradorId}/contatos`,
        rhA,
      ).expect(200);
      expect(r.body.situacao).toBe("registrado");
      expect(r.body.contatos).toMatchObject({
        emailPessoal: "pessoa.modulo1@example.test",
      });
      expect(
        await prisma.contatoColaborador.count({ where: { colaboradorId } }),
      ).toBe(1);
    });

    it("cada categoria tem um registro, na empresa do vínculo", async () => {
      expect(
        await prisma.perfilPessoalColaborador.findMany({
          where: { colaboradorId },
          select: { empresaId: true },
        }),
      ).toEqual([{ empresaId: empresaA }]);
      expect(
        await prisma.enderecoColaborador.findMany({
          where: { colaboradorId },
          select: { empresaId: true },
        }),
      ).toEqual([{ empresaId: empresaA }]);
    });

    it("a trilha registra criação e consulta, sem nenhum valor pessoal", async () => {
      const eventos = await prisma.dadosPessoaisColaboradorEvento.findMany({
        where: { colaboradorId },
        orderBy: { ocorridoEm: "asc" },
      });
      expect(
        eventos.filter((e) => e.acao === "criacao").map((e) => e.categoria),
      ).toEqual(["perfil_pessoal", "endereco"]);
      const contatoEventos = await prisma.contatoColaboradorEvento.findMany({
        where: { colaboradorId },
      });
      const auditoria = await prisma.auditEvent.findMany({
        where: { resourceId: colaboradorId },
      });
      const acoes = auditoria.map((a) => a.action);
      expect(acoes).toEqual(
        expect.arrayContaining([
          "pessoas_colaborador_criado",
          "pessoas_dados_pessoais_criados",
          "pessoas_dados_pessoais_consultados",
          "pessoas_contato_criado",
        ]),
      );
      const trilha = JSON.stringify([eventos, contatoEventos, auditoria]);
      for (const valor of VALORES_PESSOAIS) {
        expect(trilha).not.toContain(valor);
      }
    });

    it("editar grava só o campo alterado; repetir não grava nada", async () => {
      await put(`/v1/colaboradores/${colaboradorId}/dados-pessoais`, rhA)
        .send({ endereco: { ...ENDERECO, cidade: "Outra Cidade Sintetica" } })
        .expect(200);
      const ultimo = await prisma.dadosPessoaisColaboradorEvento.findFirst({
        where: { colaboradorId, acao: "edicao" },
        orderBy: { ocorridoEm: "desc" },
      });
      expect(ultimo).toMatchObject({
        categoria: "endereco",
        resultado: "gravado",
        campos: ["cidade"],
      });

      const r = await put(
        `/v1/colaboradores/${colaboradorId}/dados-pessoais`,
        rhA,
      )
        .send({ endereco: { ...ENDERECO, cidade: "Outra Cidade Sintetica" } })
        .expect(200);
      expect(r.body.endereco.cidade).toBe("Outra Cidade Sintetica");
      const semAlteracao =
        await prisma.dadosPessoaisColaboradorEvento.findFirst({
          where: { colaboradorId, resultado: "sem_alteracao" },
        });
      expect(semAlteracao).toMatchObject({ acao: "leitura" });
    });

    it("dp lê e edita na própria empresa", async () => {
      await get(
        `/v1/colaboradores/${colaboradorId}/dados-pessoais`,
        dpA,
      ).expect(200);
      const r = await put(
        `/v1/colaboradores/${colaboradorId}/dados-pessoais`,
        dpA,
      )
        .send({ perfilPessoal: { ...PERFIL, curso: "Curso Editado Pelo DP" } })
        .expect(200);
      expect(r.body.perfilPessoal.curso).toBe("Curso Editado Pelo DP");
    });

    it("rh de outra empresa recebe 404, sem saber que a pessoa existe", async () => {
      await get(
        `/v1/colaboradores/${colaboradorId}/dados-pessoais`,
        rhB,
      ).expect(404);
      await put(`/v1/colaboradores/${colaboradorId}/dados-pessoais`, rhB)
        .send({ endereco: ENDERECO })
        .expect(404);
    });

    it.each([
      ["gestor", () => gestorA],
      ["colaborador", () => colaboradorA],
      ["financeiro", () => financeiroA],
      ["master_tecnico", () => master],
    ])("%s não lê nem edita dados pessoais", async (_papel, cred) => {
      const leitura = await get(
        `/v1/colaboradores/${colaboradorId}/dados-pessoais`,
        cred(),
      );
      expect([403, 404]).toContain(leitura.status);
      expect(JSON.stringify(leitura.body)).not.toContain("Feminino");
      const edicao = await put(
        `/v1/colaboradores/${colaboradorId}/dados-pessoais`,
        cred(),
      ).send({ endereco: ENDERECO });
      expect([403, 404]).toContain(edicao.status);
    });
  });

  describe("perfis sem acesso não admitem com os blocos", () => {
    it.each([
      ["gestor", () => gestorA],
      ["colaborador", () => colaboradorA],
      ["master_tecnico", () => master],
    ])("%s recebe recusa e nada é gravado", async (_papel, cred) => {
      const r = await post("/v1/colaboradores", cred()).send(
        admissao(`MAT-M1-NEG-${_papel.slice(0, 3).toUpperCase()}`),
      );
      expect([403, 404]).toContain(r.status);
      expect(
        await prisma.vinculoFuncional.count({
          where: { matricula: { startsWith: "MAT-M1-NEG" } },
        }),
      ).toBe(0);
    });
  });

  describe("validação recusa antes de gravar", () => {
    it.each([
      [
        "data de nascimento futura",
        { perfilPessoal: { dataNascimento: "2999-01-01" } },
      ],
      ["CEP fora do padrão", { endereco: { cep: "30140/071" } }],
      ["contatos incompletos", { contatos: { emailPessoal: "a@b.test" } }],
      ["campo fora do Módulo 1", { perfilPessoal: { nomeSocial: "X" } }],
      ["empresa no bloco", { endereco: { empresaId: "x" } }],
    ])("%s: 400 e nada persiste", async (_caso, extra) => {
      const matricula = `MAT-M1-V${Math.abs(
        [..._caso].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7),
      )
        .toString()
        .slice(0, 6)}`;
      await post("/v1/colaboradores", rhA)
        .send(admissao(matricula, extra))
        .expect(400);
      expect(
        await prisma.vinculoFuncional.count({ where: { matricula } }),
      ).toBe(0);
    });
  });

  describe("atomicidade: falhou uma parte, nada fica", () => {
    it("sem permissão de gravar o endereço, a admissão INTEIRA é desfeita", async () => {
      const migrator = new PrismaClient({
        datasources: { db: { url: migratorUrl } },
      });
      try {
        await migrator.$executeRawUnsafe(
          "REVOKE INSERT ON TABLE app.endereco_colaborador FROM evolli_app",
        );
        await post("/v1/colaboradores", rhA)
          .send(admissao("MAT-M1-ATOM"))
          .expect(500);
      } finally {
        await migrator.$executeRawUnsafe(
          "GRANT INSERT ON TABLE app.endereco_colaborador TO evolli_app",
        );
        await migrator.$disconnect();
      }

      expect(
        await prisma.vinculoFuncional.count({
          where: { matricula: "MAT-M1-ATOM" },
        }),
      ).toBe(0);
      expect(
        await prisma.colaborador.count({
          where: { nome: "Pessoa Sintetica MAT-M1-ATOM" },
        }),
      ).toBe(0);
      // O perfil, gravado ANTES do endereço na mesma transação, também saiu.
      expect(
        await prisma.perfilPessoalColaborador.count({
          where: {
            nomeMae: "Mae Sintetica Modulo",
            colaborador: { nome: "Pessoa Sintetica MAT-M1-ATOM" },
          },
        }),
      ).toBe(0);
      expect(
        await prisma.colaborador.count({ where: { vinculos: { none: {} } } }),
      ).toBe(0);
      expect(
        await prisma.perfilPessoalColaborador.count({
          where: { colaborador: { vinculos: { none: {} } } },
        }),
      ).toBe(0);
    });

    it("matrícula repetida recusa a admissão e não deixa perfil nem contato", async () => {
      const antesPerfis = await prisma.perfilPessoalColaborador.count();
      const antesContatos = await prisma.contatoColaborador.count();
      await post("/v1/colaboradores", rhA)
        .send(admissao("MAT-M1-001"))
        .expect(409);
      expect(await prisma.perfilPessoalColaborador.count()).toBe(antesPerfis);
      expect(await prisma.contatoColaborador.count()).toBe(antesContatos);
    });
  });

  describe("troca de empresa", () => {
    it("depois de trocar para B, o colaborador da A some; ao voltar, reaparece", async () => {
      const r = await post("/v1/colaboradores", rhA)
        .send(admissao("MAT-M1-TROCA"))
        .expect(201);
      const id = r.body.id as string;

      const user = await prisma.accessUser.findUniqueOrThrow({
        where: { email: "rh.m1a@example.test" },
      });
      const concedente = await prisma.accessUser.findFirstOrThrow({
        where: { role: "master_tecnico" },
      });
      for (const empresaId of [empresaA, empresaB]) {
        await prisma.accessUserEmpresa.upsert({
          where: { userId_empresaId: { userId: user.id, empresaId } },
          create: {
            userId: user.id,
            empresaId,
            concedidoPorUserId: concedente.id,
          },
          update: { revogadoEm: null, revogadoPorUserId: null },
        });
      }

      await post("/v1/auth/contexto/empresa", rhA)
        .send({ empresaId: empresaB })
        .expect(200);
      const emB = await get(`/v1/colaboradores/${id}/dados-pessoais`, rhA);
      expect(emB.status).toBe(404);
      expect(JSON.stringify(emB.body)).not.toContain("Feminino");
      // Admitir na B com os blocos grava na B.
      const naB = await post("/v1/colaboradores", rhA)
        .send(
          admissao("MAT-M1-B", {
            empresaId: empresaB,
            departamentoId: departamentoB,
          }),
        )
        .expect(201);
      expect(
        (
          await prisma.perfilPessoalColaborador.findFirstOrThrow({
            where: { colaboradorId: naB.body.id },
          })
        ).empresaId,
      ).toBe(empresaB);

      await post("/v1/auth/contexto/empresa", rhA)
        .send({ empresaId: empresaA })
        .expect(200);
      await get(`/v1/colaboradores/${id}/dados-pessoais`, rhA).expect(200);
    });
  });

  describe("o banco é a rede de segurança", () => {
    it("recusa texto não aparado e data antes de 1900, mesmo por SQL direto", async () => {
      const qualquer = await prisma.perfilPessoalColaborador.findFirstOrThrow();
      await expect(
        prisma.perfilPessoalColaborador.update({
          where: { id: qualquer.id },
          data: { sexo: " com espaco " },
        }),
      ).rejects.toThrow();
      await expect(
        prisma.perfilPessoalColaborador.update({
          where: { id: qualquer.id },
          data: { dataNascimento: new Date("1899-12-31T00:00:00.000Z") },
        }),
      ).rejects.toThrow();
    });

    it("a trilha é append-only e o registro não se apaga", async () => {
      await expect(
        prisma.dadosPessoaisColaboradorEvento.deleteMany({}),
      ).rejects.toThrow();
      await expect(
        prisma.dadosPessoaisColaboradorEvento.updateMany({
          data: { requestId: "reescrito" },
        }),
      ).rejects.toThrow();
      await expect(prisma.enderecoColaborador.deleteMany({})).rejects.toThrow();
    });
  });
});
