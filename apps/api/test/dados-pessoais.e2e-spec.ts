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
import { LotacaoMinima, lotacaoMinima } from "./admissao-obrigatoria";

/**
 * T177 — Cadastro de colaborador, Módulo 1: dados pessoais, endereço e
 * contatos na admissão. PostgreSQL real e efêmero (Testcontainers), migrations
 * aplicadas do zero.
 *
 * Prova o que só o banco prova: a admissão com os três blocos é UMA transação
 * (falhou uma parte, nada fica), os contatos têm uma única fonte, a trilha não
 * guarda valor pessoal, o isolamento por empresa ativa vale também depois de
 * trocar de empresa, `rh` e `dp` alcançam estas categorias na empresa ativa,
 * o `master_tecnico` em qualquer empresa (com empresa ativa, só nela), e os
 * demais perfis são negados. Nome completo, data de nascimento e os três
 * contatos são obrigatórios na admissão.
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
  sexo: "  feminino ",
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
/**
 * T179 — o e-mail pessoal é único na mesma empresa: cada admissão usa o seu,
 * derivado da matrícula (`Pessoa.<matrícula>@Example.TEST`, gravado em caixa
 * baixa). A mesma matrícula repete o mesmo e-mail.
 */
const emailDaAdmissao = (matricula: string) =>
  `Pessoa.${matricula}@Example.TEST`;
const emailGravado = (matricula: string) =>
  emailDaAdmissao(matricula).toLowerCase();
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
  // T179 — com país Brasil, o CEP é gravado nos 8 dígitos.
  "30140071",
  "Avenida Sintetica Modulo",
  "Bairro Sintetico",
  "Cidade Sintetica",
  "pessoa.modulo1@example.test",
  // T179 — todo e-mail pessoal derivado da matrícula (`emailDaAdmissao`).
  "pessoa.mat-m1-",
  "Pessoa.MAT-M1-",
  "+5531988881771",
  // T179 — telefone gravado em `+55` + DDD + número.
  "553133331771",
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
  // T179 — a Nova admissão exige Departamento, Cargo e Unidade da empresa.
  let lotacaoA: LotacaoMinima;
  let lotacaoB: LotacaoMinima;

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
      ...lotacaoA,
      nome: `Pessoa Sintetica ${matricula}`,
      empresaId: empresaA,
      matricula,
      tipo: "clt",
      dataAdmissao: ADMISSAO,
      motivoCodigo: "admissao_inicial",
      departamentoId: departamentoA,
      perfilPessoal: PERFIL,
      endereco: ENDERECO,
      contatos: { ...CONTATOS, emailPessoal: emailDaAdmissao(matricula) },
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
    lotacaoA = await lotacaoMinima(appUrl, empresaA);
    lotacaoB = await lotacaoMinima(appUrl, empresaB);

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
        sexo: "feminino",
        naturalidade: "Ouro Preto",
        nomeMae: "Mae Sintetica Modulo",
      });
      // T179 — CEP brasileiro em 8 dígitos; telefones em `+55`.
      expect(resposta.endereco).toMatchObject({
        pais: "Brasil",
        cep: "30140071",
        estado: "MG",
      });
      expect(resposta.contatos).toMatchObject({
        emailPessoal: emailGravado("MAT-M1-001"),
        celular: "+5531988881771",
        telefone: "+553133331771",
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
        sexo: "feminino",
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
        emailPessoal: emailGravado("MAT-M1-001"),
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

  describe("master_tecnico lê e edita dados pessoais", () => {
    let colaboradorId: string;
    let masterEscopadoB: Credencial;
    let masterEscopadoA: Credencial;

    /** As duas trilhas da última operação: evento e `audit_event`. */
    async function ultimaTrilha(id: string) {
      const evento =
        await prisma.dadosPessoaisColaboradorEvento.findFirstOrThrow({
          where: { colaboradorId: id },
          orderBy: { ocorridoEm: "desc" },
        });
      const formal = await prisma.auditEvent.findFirstOrThrow({
        where: {
          requestId: evento.requestId,
          resource: "dados_pessoais_colaborador",
        },
      });
      return { evento, formal };
    }

    beforeAll(async () => {
      colaboradorId = (
        await post("/v1/colaboradores", rhA)
          .send(admissao("MAT-M1-MASTER"))
          .expect(201)
      ).body.id;
      // Contas próprias: trocar o contexto do `master` compartilhado mudaria o
      // escopo dos outros testes.
      masterEscopadoB = await seedMaster("master.m1b@example.test");
      await post("/v1/auth/contexto/empresa", masterEscopadoB)
        .send({ empresaId: empresaB })
        .expect(200);
      masterEscopadoA = await seedMaster("master.m1a@example.test");
      await post("/v1/auth/contexto/empresa", masterEscopadoA)
        .send({ empresaId: empresaA })
        .expect(200);
    });

    it("sem empresa ativa: lê na empresa REAL do vínculo, auditado com ela", async () => {
      const r = await get(
        `/v1/colaboradores/${colaboradorId}/dados-pessoais`,
        master,
      ).expect(200);
      expect(r.headers["cache-control"]).toBe("no-store");
      expect(r.body).toMatchObject({
        empresaId: empresaA,
        situacao: "registrado",
        perfilPessoal: { dataNascimento: "1991-07-14", sexo: "feminino" },
        endereco: { cidade: "Cidade Sintetica" },
      });
      const { evento, formal } = await ultimaTrilha(colaboradorId);
      expect(evento).toMatchObject({
        empresaId: empresaA,
        acao: "leitura",
        resultado: "valores_devolvidos",
      });
      expect(formal).toMatchObject({
        action: "pessoas_dados_pessoais_consultados",
        companyId: empresaA,
        actorRole: "master_tecnico",
        result: "success",
      });
    });

    it("sem empresa ativa: edita na empresa do vínculo, só o campo alterado", async () => {
      const r = await put(
        `/v1/colaboradores/${colaboradorId}/dados-pessoais`,
        master,
      )
        .send({
          perfilPessoal: { ...PERFIL, curso: "Curso Editado Pelo Master" },
        })
        .expect(200);
      expect(r.body).toMatchObject({
        empresaId: empresaA,
        perfilPessoal: { curso: "Curso Editado Pelo Master" },
      });
      const { evento, formal } = await ultimaTrilha(colaboradorId);
      expect(evento).toMatchObject({
        empresaId: empresaA,
        categoria: "perfil_pessoal",
        acao: "edicao",
        resultado: "gravado",
        campos: ["curso"],
      });
      expect(formal).toMatchObject({
        action: "pessoas_dados_pessoais_atualizados",
        companyId: empresaA,
        actorRole: "master_tecnico",
      });
      expect(JSON.stringify([evento, formal])).not.toContain(
        "Curso Editado Pelo Master",
      );
    });

    it("com empresa ativa B: colaborador da A responde 404, sem valor", async () => {
      const leitura = await get(
        `/v1/colaboradores/${colaboradorId}/dados-pessoais`,
        masterEscopadoB,
      ).expect(404);
      expect(JSON.stringify(leitura.body)).not.toContain("Feminino");
      await put(
        `/v1/colaboradores/${colaboradorId}/dados-pessoais`,
        masterEscopadoB,
      )
        .send({ endereco: ENDERECO })
        .expect(404);
    });

    it("com empresa ativa A: lê e edita na A", async () => {
      await get(
        `/v1/colaboradores/${colaboradorId}/dados-pessoais`,
        masterEscopadoA,
      ).expect(200);
      const r = await put(
        `/v1/colaboradores/${colaboradorId}/dados-pessoais`,
        masterEscopadoA,
      )
        .send({ endereco: { ...ENDERECO, bairro: "Bairro Do Master" } })
        .expect(200);
      expect(r.body.endereco.bairro).toBe("Bairro Do Master");
    });

    it("sem empresa ativa e vínculo em duas empresas: 409, nada lido nem gravado", async () => {
      // A API não cria vínculo em outra empresa para quem não está nela: o
      // segundo vínculo entra direto no banco, como nos E2E de contatos.
      const linhas = await prisma.$queryRawUnsafe<{ id: string }[]>(
        `INSERT INTO app.vinculo_funcional
           (id, colaborador_id, empresa_id, matricula, tipo, situacao,
            data_admissao, criado_em, atualizado_em)
         VALUES (gen_random_uuid()::text, $1, $2, 'MAT-M1-AMB-B', 'clt',
                 'previsto', DATE '2026-01-05', now(), now())
         RETURNING id`,
        colaboradorId,
        empresaB,
      );
      const segundoVinculo = linhas[0]!.id;
      try {
        const antes = await prisma.perfilPessoalColaborador.findFirstOrThrow({
          where: { colaboradorId },
        });
        const leitura = await get(
          `/v1/colaboradores/${colaboradorId}/dados-pessoais`,
          master,
        ).expect(409);
        expect(JSON.stringify(leitura.body)).not.toContain("Feminino");
        const consulta = await prisma.dadosPessoaisColaboradorEvento.findMany({
          where: {
            colaboradorId,
            resultado: "empresa_ambigua",
            acao: "leitura",
          },
        });
        expect(consulta.map((e) => e.categoria).sort()).toEqual([
          "endereco",
          "perfil_pessoal",
        ]);
        for (const e of consulta) {
          expect(e).toMatchObject({
            empresaId: null,
            perfilId: null,
            enderecoId: null,
            campos: [],
          });
        }
        const formal = await prisma.auditEvent.findFirstOrThrow({
          where: {
            requestId: consulta[0]!.requestId,
            resource: "dados_pessoais_colaborador",
          },
        });
        expect(formal).toMatchObject({
          action: "pessoas_dados_pessoais_consultados",
          companyId: null,
          actorRole: "master_tecnico",
          result: "failure",
        });

        await put(`/v1/colaboradores/${colaboradorId}/dados-pessoais`, master)
          .send({ perfilPessoal: { ...PERFIL, curso: "Nao Pode Gravar" } })
          .expect(409);
        const tentativa = await ultimaTrilha(colaboradorId);
        expect(tentativa.evento).toMatchObject({
          empresaId: null,
          categoria: "perfil_pessoal",
          acao: "edicao",
          resultado: "empresa_ambigua",
        });
        expect(tentativa.formal).toMatchObject({
          action: "pessoas_dados_pessoais_atualizados",
          companyId: null,
          result: "failure",
        });
        expect(
          await prisma.perfilPessoalColaborador.findFirstOrThrow({
            where: { colaboradorId },
          }),
        ).toEqual(antes);
      } finally {
        // O vínculo extra não pode vazar para os testes seguintes.
        await prisma.$executeRawUnsafe(
          "DELETE FROM app.vinculo_funcional WHERE id = $1",
          segundoVinculo,
        );
      }
    });
  });

  describe("a admissão continua só de rh e dp", () => {
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
      ["sem data de nascimento", { perfilPessoal: { sexo: "feminino" } }],
      ["data de nascimento vazia", { perfilPessoal: { dataNascimento: "" } }],
      ["sem o bloco do perfil", { perfilPessoal: undefined }],
      // T179 — contatos (inteiros ou em parte) são opcionais desde a decisão
      // de 2026-10-21: os casos de contato ausente saíram desta lista.
      [
        "sexo fora da lista fechada",
        { perfilPessoal: { ...PERFIL, sexo: "Feminino" } },
      ],
      ["sem nome completo", { nome: undefined }],
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

  describe("só o obrigatório", () => {
    it("admite com nome, data de nascimento e contatos, sem endereço", async () => {
      const r = await post("/v1/colaboradores", rhA)
        .send(
          admissao("MAT-M1-MIN", {
            perfilPessoal: { dataNascimento: "1988-03-09" },
            endereco: undefined,
          }),
        )
        .expect(201);
      expect(r.body.perfilPessoal).toMatchObject({
        dataNascimento: "1988-03-09",
        sexo: null,
        nomeMae: null,
      });
      expect(r.body.endereco).toBeNull();
      expect(r.body.contatos).toMatchObject({
        emailPessoal: emailGravado("MAT-M1-MIN"),
      });
      expect(
        await prisma.enderecoColaborador.count({
          where: { colaboradorId: r.body.id },
        }),
      ).toBe(0);
      const leitura = await get(
        `/v1/colaboradores/${r.body.id}/dados-pessoais`,
        rhA,
      ).expect(200);
      expect(leitura.body).toMatchObject({
        situacao: "registrado",
        endereco: null,
      });
    });
  });

  // T181 — a ficha do colaborador edita os dados já aprovados, um bloco por
  // vez, pela rota própria: o que a tela envia, com PostgreSQL real.
  describe("T181 — edição pela ficha do colaborador", () => {
    /** Valores sintéticos da T181 que NÃO podem aparecer em trilha nenhuma. */
    const VALORES_T181 = [
      "Curso Ficha T181",
      "Rua Ficha Sintetica",
      "1000-001",
      "Lisboa Sintetica",
      "Numero 321",
    ];

    async function admitir(
      matricula: string,
      extra: Record<string, unknown> = {},
    ): Promise<string> {
      const r = await post("/v1/colaboradores", rhA)
        .send(admissao(matricula, extra))
        .expect(201);
      return r.body.id as string;
    }

    const rota = (id: string) => `/v1/colaboradores/${id}/dados-pessoais`;
    const perfilDe = (colaboradorId: string) =>
      prisma.perfilPessoalColaborador.findFirstOrThrow({
        where: { colaboradorId },
      });
    const enderecoDe = (colaboradorId: string) =>
      prisma.enderecoColaborador.findFirst({ where: { colaboradorId } });

    async function trilhaSemValores(colaboradorId: string) {
      const eventos = await prisma.dadosPessoaisColaboradorEvento.findMany({
        where: { colaboradorId },
      });
      const contatos = await prisma.contatoColaboradorEvento.findMany({
        where: { colaboradorId },
      });
      const auditoria = await prisma.auditEvent.findMany({
        where: { resourceId: colaboradorId },
      });
      const trilha = JSON.stringify([eventos, contatos, auditoria]);
      for (const valor of VALORES_T181) {
        expect(trilha).not.toContain(valor);
      }
    }

    it("salvar o endereço não toca nos dados pessoais, e vice-versa", async () => {
      const id = await admitir("MAT-T181-001");
      const perfilAntes = await perfilDe(id);
      await put(rota(id), rhA)
        .send({ endereco: { ...ENDERECO, logradouro: "Rua Ficha Sintetica" } })
        .expect(200);
      expect(await perfilDe(id)).toEqual(perfilAntes);

      const enderecoAntes = await enderecoDe(id);
      const r = await put(rota(id), rhA)
        .send({ perfilPessoal: { ...PERFIL, curso: "Curso Ficha T181" } })
        .expect(200);
      expect(r.body.perfilPessoal.curso).toBe("Curso Ficha T181");
      expect(r.body.endereco.logradouro).toBe("Rua Ficha Sintetica");
      expect(await enderecoDe(id)).toEqual(enderecoAntes);

      const edicoes = await prisma.dadosPessoaisColaboradorEvento.findMany({
        where: { colaboradorId: id, acao: "edicao", resultado: "gravado" },
        orderBy: { ocorridoEm: "asc" },
      });
      expect(edicoes.map((e) => [e.categoria, e.campos])).toEqual([
        ["endereco", ["logradouro"]],
        ["perfil_pessoal", ["curso"]],
      ]);
      await trilhaSemValores(id);
    });

    it("limpar um campo opcional grava null, e a trilha leva só o nome do campo", async () => {
      const id = await admitir("MAT-T181-002");
      expect((await enderecoDe(id))?.bairro).not.toBeNull();
      const r = await put(rota(id), rhA)
        .send({ endereco: { ...ENDERECO, bairro: null, numero: "Numero 321" } })
        .expect(200);
      expect(r.body.endereco).toMatchObject({
        bairro: null,
        numero: "Numero 321",
      });
      expect(await enderecoDe(id)).toMatchObject({
        bairro: null,
        numero: "Numero 321",
      });
      const ultimo = await prisma.dadosPessoaisColaboradorEvento.findFirst({
        where: { colaboradorId: id, acao: "edicao" },
        orderBy: { ocorridoEm: "desc" },
      });
      expect(ultimo?.campos).toEqual(
        expect.arrayContaining(["bairro", "numero"]),
      );
      expect(ultimo?.campos).toHaveLength(2);
      await trilhaSemValores(id);
    });

    it("sem endereço, a ficha o cria; com outro país, o CEP fica como veio", async () => {
      const id = await admitir("MAT-T181-003", { endereco: undefined });
      expect(await enderecoDe(id)).toBeNull();
      const r = await put(rota(id), dpA)
        .send({
          endereco: {
            pais: "Portugal",
            cep: "1000-001",
            logradouro: null,
            numero: null,
            complemento: null,
            bairro: null,
            cidade: "Lisboa Sintetica",
            estado: null,
          },
        })
        .expect(200);
      expect(r.body.endereco).toMatchObject({
        pais: "Portugal",
        cep: "1000-001",
        cidade: "Lisboa Sintetica",
      });
      const criacao =
        await prisma.dadosPessoaisColaboradorEvento.findFirstOrThrow({
          where: { colaboradorId: id, categoria: "endereco", acao: "criacao" },
        });
      expect(criacao.campos).toEqual(
        expect.arrayContaining(["pais", "cep", "cidade"]),
      );
      expect(criacao.campos).toHaveLength(3);
      await trilhaSemValores(id);
    });

    it("CEP brasileiro digitado na máscara é gravado nos 8 dígitos", async () => {
      const id = await admitir("MAT-T181-004", { endereco: undefined });
      const r = await put(rota(id), rhA)
        .send({ endereco: { ...ENDERECO, cep: "01310-100" } })
        .expect(200);
      expect(r.body.endereco.cep).toBe("01310100");
    });

    it("RH de outra empresa recebe 404 nos dois blocos, e nada muda", async () => {
      const id = await admitir("MAT-T181-005");
      const perfilAntes = await perfilDe(id);
      const enderecoAntes = await enderecoDe(id);
      const r1 = await put(rota(id), rhB)
        .send({ perfilPessoal: { ...PERFIL, curso: "Curso Ficha T181" } })
        .expect(404);
      const r2 = await put(rota(id), rhB)
        .send({ endereco: { ...ENDERECO, cidade: "Lisboa Sintetica" } })
        .expect(404);
      for (const corpo of [r1.body, r2.body]) {
        expect(JSON.stringify(corpo)).not.toContain("Curso Ficha T181");
        expect(JSON.stringify(corpo)).not.toContain("Lisboa Sintetica");
      }
      expect(await perfilDe(id)).toEqual(perfilAntes);
      expect(await enderecoDe(id)).toEqual(enderecoAntes);
    });

    it.each([
      ["gestor", "G", () => gestorA],
      ["colaborador", "C", () => colaboradorA],
      ["financeiro", "F", () => financeiroA],
    ])(
      "%s não edita nenhum bloco, e nada muda",
      async (_papel, sufixo, cred) => {
        const id = await admitir(`MAT-T181-N${sufixo}`);
        const perfilAntes = await perfilDe(id);
        const enderecoAntes = await enderecoDe(id);
        const r = await put(rota(id), cred()).send({
          perfilPessoal: { ...PERFIL, curso: "Curso Ficha T181" },
          endereco: { ...ENDERECO, cidade: "Lisboa Sintetica" },
        });
        expect([403, 404]).toContain(r.status);
        expect(await perfilDe(id)).toEqual(perfilAntes);
        expect(await enderecoDe(id)).toEqual(enderecoAntes);
      },
    );

    it("contatos pela ficha: adicionar, remover todos e adicionar de novo", async () => {
      const id = await admitir("MAT-T181-006", { contatos: undefined });
      const rotaContatos = `/v1/colaboradores/${id}/contatos`;
      const vazio = await get(rotaContatos, rhA).expect(200);
      expect(vazio.body).toMatchObject({
        situacao: "sem_registro",
        contatos: null,
      });

      const criado = await put(rotaContatos, dpA)
        .send({ celular: "(31) 98888-0181" })
        .expect(200);
      expect(criado.body).toMatchObject({
        resultado: "criado",
        contatos: { celular: "+5531988880181" },
      });

      const removido = await put(rotaContatos, rhA)
        .send({ emailPessoal: null, celular: null, telefone: null })
        .expect(200);
      expect(removido.body).toMatchObject({
        resultado: "removido",
        situacao: "sem_registro",
        contatos: null,
      });
      expect(
        await prisma.contatoColaborador.findFirstOrThrow({
          where: { colaboradorId: id },
        }),
      ).toMatchObject({ ativo: false, celular: null });

      const deNovo = await put(rotaContatos, rhA)
        .send({ telefone: "(31) 3333-0181" })
        .expect(200);
      expect(deNovo.body).toMatchObject({
        situacao: "registrado",
        contatos: { telefone: "+553133330181", celular: null },
      });
      const eventos = await prisma.contatoColaboradorEvento.findMany({
        where: { colaboradorId: id, resultado: "gravado" },
        orderBy: { ocorridoEm: "asc" },
      });
      expect(eventos.map((e) => [e.acao, e.campos])).toEqual([
        ["criacao", ["celular"]],
        ["edicao", ["celular"]],
        ["edicao", ["telefone"]],
      ]);
      const trilha = JSON.stringify(eventos);
      for (const valor of ["98888-0181", "988880181", "33330181"]) {
        expect(trilha).not.toContain(valor);
      }
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
            ...lotacaoB,
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

  describe("após o desligamento: uso operacional bloqueado (retenção aprovada)", () => {
    // Cada caso monta o PRÓPRIO cenário: contas novas (rh que admite e desliga,
    // e o papel que consulta), colaborador próprio e `x-request-id` próprio por
    // requisição. Nenhum caso depende de outro, da ordem, nem do contexto de
    // empresa que outro teste deixou numa conta compartilhada.
    const DESLIGAMENTO = "2026-05-04";
    let sequencia = 0;

    async function contaNova(papel: "rh" | "dp" | "master_tecnico") {
      sequencia += 1;
      const email = `${papel.replace("_", ".")}.desl${sequencia}@example.test`;
      return papel === "master_tecnico"
        ? seedMaster(email)
        : criarUsuario(email, papel, empresaA);
    }

    /** Admite, efetiva e desliga um colaborador próprio, na empresa A. */
    async function colaboradorDesligado(matricula: string) {
      const rh = await contaNova("rh");
      const id: string = (
        await post("/v1/colaboradores", rh)
          .send(admissao(matricula))
          .expect(201)
      ).body.id;
      const vinculoId: string = (
        await get(`/v1/colaboradores/${id}/vinculos`, rh).expect(200)
      ).body[0].id;
      const admissaoId: string = (
        await get(`/v1/vinculos/${vinculoId}/linha-do-tempo`, rh).expect(200)
      ).body[0].id;
      await post(`/v1/movimentacoes/${admissaoId}/efetivar`, rh)
        .send()
        .expect(201);
      const desligamento = await post("/v1/movimentacoes", rh)
        .send({
          vinculoId,
          tipo: "desligamento",
          motivoCodigo: "encerramento_de_vinculo",
          vigenciaInicio: DESLIGAMENTO,
        })
        .expect(201);
      await post(`/v1/movimentacoes/${desligamento.body.id}/efetivar`, rh)
        .send()
        .expect(201);
      const vinculo = await prisma.vinculoFuncional.findUniqueOrThrow({
        where: { id: vinculoId },
      });
      expect(vinculo.situacao).toBe("encerrado");
      const perfil = await prisma.perfilPessoalColaborador.findFirstOrThrow({
        where: { colaboradorId: id },
      });
      const endereco = await prisma.enderecoColaborador.findFirstOrThrow({
        where: { colaboradorId: id },
      });
      return { id, perfil, endereco };
    }

    /** Eventos e trilha formal de UMA requisição, pelo `x-request-id` dela. */
    async function trilhaDa(requestId: string) {
      const eventos = await prisma.dadosPessoaisColaboradorEvento.findMany({
        where: { requestId },
      });
      const formal = await prisma.auditEvent.findMany({
        where: { requestId, resource: "dados_pessoais_colaborador" },
      });
      return { eventos, formal };
    }

    it.each(["rh", "dp", "master_tecnico"] as const)(
      "%s lê: 200 bloqueado, sem nenhum valor, com trilha por categoria",
      async (papel) => {
        const alvo = await colaboradorDesligado(
          `MAT-M1-DL-${papel.slice(0, 2).toUpperCase()}`,
        );
        const cred = await contaNova(papel);
        const requestId = `t177-desl-leitura-${papel}`;
        const r = await get(`/v1/colaboradores/${alvo.id}/dados-pessoais`, cred)
          .set("x-request-id", requestId)
          .expect(200);
        expect(r.body).toEqual({
          colaboradorId: alvo.id,
          empresaId: empresaA,
          situacao: "bloqueado",
          perfilPessoal: null,
          endereco: null,
        });
        expect(r.headers["cache-control"]).toBe("no-store");
        const texto = JSON.stringify(r.body);
        for (const valor of VALORES_PESSOAIS) {
          expect(texto).not.toContain(valor);
        }

        const { eventos, formal } = await trilhaDa(requestId);
        expect(
          eventos
            .map((e) => ({
              colaboradorId: e.colaboradorId,
              categoria: e.categoria,
              acao: e.acao,
              resultado: e.resultado,
              campos: e.campos,
              registro: e.perfilId ?? e.enderecoId,
              empresaId: e.empresaId,
            }))
            .sort((x, y) => x.categoria.localeCompare(y.categoria)),
        ).toEqual([
          {
            colaboradorId: alvo.id,
            categoria: "endereco",
            acao: "leitura",
            resultado: "bloqueado",
            campos: [],
            registro: alvo.endereco.id,
            empresaId: empresaA,
          },
          {
            colaboradorId: alvo.id,
            categoria: "perfil_pessoal",
            acao: "leitura",
            resultado: "bloqueado",
            campos: [],
            registro: alvo.perfil.id,
            empresaId: empresaA,
          },
        ]);
        expect(formal.map((f) => [f.action, f.result, f.actorRole])).toEqual([
          ["pessoas_dados_pessoais_consultados", "success", papel],
          ["pessoas_dados_pessoais_consultados", "success", papel],
        ]);
      },
    );

    it.each(["rh", "dp", "master_tecnico"] as const)(
      "%s edita: 409, nada gravado, trilha de falha e registros preservados",
      async (papel) => {
        const alvo = await colaboradorDesligado(
          `MAT-M1-DE-${papel.slice(0, 2).toUpperCase()}`,
        );
        const cred = await contaNova(papel);
        const requestId = `t177-desl-edicao-${papel}`;
        await put(`/v1/colaboradores/${alvo.id}/dados-pessoais`, cred)
          .set("x-request-id", requestId)
          .send({
            perfilPessoal: { ...PERFIL, curso: "Nao Pode Gravar" },
            endereco: { ...ENDERECO, cidade: "Nao Pode Gravar" },
          })
          .expect(409);

        const { eventos, formal } = await trilhaDa(requestId);
        expect(
          eventos
            .map((e) => [e.categoria, e.acao, e.resultado, e.campos])
            .sort((x, y) => String(x[0]).localeCompare(String(y[0]))),
        ).toEqual([
          ["endereco", "edicao", "bloqueado", []],
          ["perfil_pessoal", "edicao", "bloqueado", []],
        ]);
        expect(formal.map((f) => [f.action, f.result, f.actorRole])).toEqual([
          ["pessoas_dados_pessoais_atualizados", "failure", papel],
          ["pessoas_dados_pessoais_atualizados", "failure", papel],
        ]);

        // Retenção aprovada: nada apagado, nada alterado, o contato continua.
        expect(
          await prisma.perfilPessoalColaborador.findUniqueOrThrow({
            where: { id: alvo.perfil.id },
          }),
        ).toEqual(alvo.perfil);
        expect(
          await prisma.enderecoColaborador.findUniqueOrThrow({
            where: { id: alvo.endereco.id },
          }),
        ).toEqual(alvo.endereco);
        expect(
          await prisma.contatoColaborador.count({
            where: { colaboradorId: alvo.id },
          }),
        ).toBe(1);
      },
    );
  });

  describe("o banco é a rede de segurança", () => {
    it("recusa perfil sem data de nascimento e evento sem empresa fora da ambiguidade", async () => {
      const qualquer = await prisma.perfilPessoalColaborador.findFirstOrThrow();
      await expect(
        prisma.$executeRawUnsafe(
          "UPDATE app.perfil_pessoal_colaborador SET data_nascimento = NULL WHERE id = $1",
          qualquer.id,
        ),
      ).rejects.toThrow();
      const ator = await prisma.accessUser.findFirstOrThrow({
        where: { email: "rh.m1a@example.test" },
      });
      await expect(
        prisma.dadosPessoaisColaboradorEvento.create({
          data: {
            colaboradorId: qualquer.colaboradorId,
            empresaId: null,
            categoria: "perfil_pessoal",
            acao: "leitura",
            resultado: "sem_registro",
            campos: [],
            atorUserId: ator.id,
            requestId: "req-incoerente",
          },
        }),
      ).rejects.toThrow();
      await expect(
        prisma.dadosPessoaisColaboradorEvento.create({
          data: {
            colaboradorId: qualquer.colaboradorId,
            empresaId: qualquer.empresaId,
            categoria: "perfil_pessoal",
            acao: "leitura",
            resultado: "empresa_ambigua",
            campos: [],
            atorUserId: ator.id,
            requestId: "req-incoerente-2",
          },
        }),
      ).rejects.toThrow();
    });

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
