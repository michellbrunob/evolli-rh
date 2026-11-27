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
import { ArmazenamentoEmMemoria } from "../src/pessoas/foto-colaborador/armazenamento-de-objetos";
import { ARMAZENAMENTO_DE_DOCUMENTOS } from "../src/pessoas/documentos-colaborador/armazenamento-de-documentos";
import {
  VERIFICADOR_DE_ARQUIVOS,
  VerificadorFalso,
} from "../src/pessoas/documentos-colaborador/verificador-de-arquivos";
import { AllExceptionsFilter } from "../src/common/filters/http-exception.filter";
import { requestIdMiddleware } from "../src/common/request-id";
import {
  hojeEmSaoPaulo,
  somarMeses,
} from "../src/pessoas/ausencias/calculo-ausencias";
import {
  camposObrigatoriosAdmissao,
  lotacaoMinima,
} from "./admissao-obrigatoria";

/**
 * T215 — Benefícios (como a referência) e dependentes do colaborador:
 * cadastro, cálculo por competência (dia útil, VT, faixa etária com
 * dependentes), valores do mês, alteração em massa, pessoas, ciclo de vida,
 * ficha e acesso. PostgreSQL real e efêmero (Testcontainers), migrations do
 * zero. Competência fixa 11/2026 (19 dias úteis).
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
const SENHA_PADRAO = "Beneficios!Sinteticos#2026";

const HOJE = hojeEmSaoPaulo();
const ADMISSAO = somarMeses(HOJE, -18);

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

describe("T215 — Benefícios e dependentes (e2e)", () => {
  let container: StartedTestContainer;
  let app: INestApplication;
  let prisma: PrismaClient;
  let appUrl: string;

  let master: Credencial;
  let masterA: Credencial;
  let rhA: Credencial;
  let dpA: Credencial;
  let rhB: Credencial;
  let empresaA: string;
  let empresaB: string;
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

  async function criarUsuarioDireto(
    email: string,
    role: string,
    companyId: string,
  ): Promise<Credencial> {
    const { PasswordHashService } =
      await import("../src/auth/password/password-hash.service");
    await prisma.accessUser.create({
      data: {
        email,
        passwordHash: await new PasswordHashService().hash(SENHA_PADRAO),
        role: role as never,
        companyId,
        status: "active",
      },
    });
    return login(email);
  }

  async function criarMaster(email: string): Promise<Credencial> {
    const { PasswordHashService } =
      await import("../src/auth/password/password-hash.service");
    await prisma.accessUser.create({
      data: {
        email,
        passwordHash: await new PasswordHashService().hash(SENHA_PADRAO),
        role: "master_tecnico",
        status: "active",
      },
    });
    return login(email);
  }

  /** O R2 dos testes: em memória, nenhum teste fala com o bucket. */
  const armazenamento = new ArmazenamentoEmMemoria();

  let sequencia = 0;
  /** Admite pela API (18 meses atrás); `ativo` efetiva a admissão. */
  async function admitir(
    cred: Credencial,
    empresaId: string,
    estado: "ativo" | "previsto" = "ativo",
    tipo = "clt",
    dataAdmissao = ADMISSAO,
  ): Promise<{ id: string; nome: string }> {
    sequencia += 1;
    const nome = `Pessoa Beneficio ${String.fromCharCode(65 + (sequencia % 26))}${sequencia}`;
    const r = await post("/v1/colaboradores", cred)
      .send({
        ...camposObrigatoriosAdmissao(),
        ...(await lotacaoMinima(appUrl, empresaId)),
        nome,
        empresaId,
        tipo,
        dataAdmissao,
        motivoCodigo: "admissao_inicial",
      })
      .expect(201);
    if (estado === "ativo") {
      await post(`/v1/movimentacoes/${r.body.movimentacao.id}/efetivar`, cred)
        .send()
        .expect(201);
    }
    return { id: r.body.id as string, nome };
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
    })
      .overrideProvider(ARMAZENAMENTO_DE_DOCUMENTOS)
      .useValue(armazenamento)
      .overrideProvider(VERIFICADOR_DE_ARQUIVOS)
      .useValue(new VerificadorFalso())
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

    master = await criarMaster("master.beneficios@example.test");
    const empresa = async (codigo: string) =>
      (
        await post("/v1/empresas", master)
          .send({ codigo, nome: `Empresa ${codigo}` })
          .expect(201)
      ).body.id as string;
    empresaA = await empresa("BENA");
    empresaB = await empresa("BENB");
    rhA = await criarUsuario("rh.bena@example.test", "rh", empresaA);
    dpA = await criarUsuario("dp.bena@example.test", "dp", empresaA);
    rhB = await criarUsuario("rh.benb@example.test", "rh", empresaB);
    for (const papel of [
      "gestor",
      "financeiro",
      "colaborador",
      "auditor",
      "dpo",
      "admin_tecnico",
    ]) {
      outrosPapeis.push([
        papel,
        // Direto no banco: a API não deixa criar alguns destes papéis.
        await criarUsuarioDireto(`${papel}.bena@example.test`, papel, empresaA),
      ]);
    }
    masterA = await criarMaster("master.beneficios.a@example.test");
    await post("/v1/auth/contexto/empresa", masterA)
      .send({ empresaId: empresaA })
      .expect(200);
  });

  afterAll(async () => {
    await app?.close();
    await prisma?.$disconnect();
    await container?.stop();
  });

  const C = "2026-11";
  const put = (rota: string, cred: Credencial) =>
    agent()
      .put(rota)
      .set("Cookie", cred.cookie)
      .set("x-csrf-token", cred.csrfToken);

  const VR = {
    nome: "VR sintético",
    categoria: "alimentacao",
    folha: "desconto",
    tipoValor: "dia_util",
    inicio: "2026-01-01",
    regras: {
      valorDia: 30,
      diasModo: "uteis",
      quemPaga: { modo: "empresa_parte", calculo: "percentual", empresa: 80 },
    },
  };

  const trilhaDo = (id: string) =>
    prisma.auditEvent.findMany({
      where: { resourceId: id, resource: "beneficio" },
      orderBy: { occurredAt: "asc" },
    });

  describe("migration", () => {
    it("nada se apaga: a aplicação não tem DELETE nas tabelas de benefícios", async () => {
      for (const tabela of [
        "beneficio",
        "beneficio_pessoa",
        "beneficio_ajuste",
        "beneficio_dependente",
        "beneficio_historico",
        "beneficio_versao",
        "beneficio_pausa",
        "dependente_colaborador",
      ]) {
        const linhas = await prisma.$queryRawUnsafe<{ pode: boolean }[]>(
          `SELECT has_table_privilege('evolli_app', 'app.${tabela}', 'DELETE') AS pode`,
        );
        expect(linhas[0]!.pode).toBe(false);
      }
    });
  });

  describe("acesso", () => {
    it("outros papéis são negados; o master sem empresa também", async () => {
      for (const [, cred] of outrosPapeis) {
        const r = await get("/v1/beneficios", cred);
        expect([403, 404]).toContain(r.status);
      }
      const r = await get("/v1/beneficios", master);
      expect([403, 404]).toContain(r.status);
    });

    it("o master com empresa só lê; a outra empresa não vê o benefício", async () => {
      const criado = await post("/v1/beneficios", rhA).send(VR).expect(201);
      await get(`/v1/beneficios/${criado.body.id}`, masterA).expect(200);
      expect([403, 404]).toContain(
        (await post("/v1/beneficios", masterA).send(VR)).status,
      );
      await get(`/v1/beneficios/${criado.body.id}`, rhB).expect(404);
      await post(`/v1/beneficios/${criado.body.id}/excluir`, rhA)
        .send()
        .expect(200);
    });
  });

  describe("cadastro e cálculo", () => {
    it("recusa por campo: nome, valor do dia e tabela fora das regras da ANS", async () => {
      const r = await post("/v1/beneficios", rhA)
        .send({ ...VR, nome: " ", regras: { valorDia: 0 } })
        .expect(422);
      expect(r.body.erros).toEqual(
        expect.arrayContaining([
          { campo: "nome", motivo: "obrigatorio" },
          { campo: "regras.valorDia", motivo: "obrigatorio" },
        ]),
      );
      const ans = await post("/v1/beneficios", rhA)
        .send({
          nome: "Saúde sintética",
          categoria: "saude",
          folha: "desconto",
          tipoValor: "faixa_etaria",
          inicio: "2026-01-01",
          fim: "2027-12-31",
          regras: {
            faixas: [100, 120, 140, 160, 180, 200, 230, 260, 300, 700],
            colaboradorPaga: {
              calculo: "percentual",
              titular: 20,
              dependente: 30,
            },
          },
        })
        .expect(422);
      expect(ans.body.erros).toContainEqual({
        campo: "regras.faixas",
        motivo: "fora_das_regras_ans",
      });
    });

    it("VR por dia útil: 19 dias em 11/2026, empresa 80%; estágio sem desconto", async () => {
      const clt = await admitir(rhA, empresaA);
      const est = await admitir(rhA, empresaA, "ativo", "estagio");
      const criado = await post("/v1/beneficios", rhA)
        .send({
          ...VR,
          pessoas: [{ colaboradorId: clt.id }, { colaboradorId: est.id }],
        })
        .expect(201);
      const d = await get(
        `/v1/beneficios/${criado.body.id}?competencia=${C}`,
        rhA,
      ).expect(200);
      expect(d.body.diasUteis).toBe(19);
      const pClt = d.body.pessoas.find(
        (p: { colaboradorId: string }) => p.colaboradorId === clt.id,
      );
      const pEst = d.body.pessoas.find(
        (p: { colaboradorId: string }) => p.colaboradorId === est.id,
      );
      expect(pClt).toMatchObject({
        dias: 19,
        origemDias: "uteis",
        valor: 57000,
        empresa: 45600,
        desconto: 11400,
      });
      expect(pEst).toMatchObject({
        valor: 57000,
        empresa: 57000,
        desconto: 0,
        observacao: "estagio_sem_desconto",
      });
      expect(d.body.totais).toMatchObject({
        pessoas: 2,
        empresa: 102600,
        desconto: 11400,
      });

      // Valores do mês: 15 dias para a pessoa CLT.
      await put(`/v1/beneficios/${criado.body.id}/valores`, rhA)
        .send({ competencia: C, linhas: [{ colaboradorId: clt.id, dias: 15 }] })
        .expect(200);
      const d2 = await get(
        `/v1/beneficios/${criado.body.id}?competencia=${C}`,
        rhA,
      ).expect(200);
      expect(
        d2.body.pessoas.find(
          (p: { colaboradorId: string }) => p.colaboradorId === clt.id,
        ),
      ).toMatchObject({
        dias: 15,
        origemDias: "digitado",
        ajustado: true,
        valor: 45000,
        desconto: 9000,
      });
      // Outro mês não muda.
      const d3 = await get(
        `/v1/beneficios/${criado.body.id}?competencia=2026-12`,
        rhA,
      ).expect(200);
      expect(
        d3.body.pessoas.find(
          (p: { colaboradorId: string }) => p.colaboradorId === clt.id,
        ),
      ).toMatchObject({ dias: 22, ajustado: false });

      // Lista da empresa e ficha.
      const lista = await get(`/v1/beneficios?competencia=${C}`, rhA).expect(
        200,
      );
      expect(
        lista.body.beneficios.find(
          (b: { id: string }) => b.id === criado.body.id,
        ),
      ).toMatchObject({
        pessoas: 2,
        empresa: 36000 + 57000,
      });
      const ficha = await get(
        `/v1/colaboradores/${clt.id}/beneficios?competencia=${C}`,
        rhA,
      ).expect(200);
      expect(ficha.body).toMatchObject({
        salarioBruto: 1621,
        beneficios: [{ id: criado.body.id, empresa: 36000, desconto: 9000 }],
      });

      // Histórico e trilha (sem valores).
      const h = await get(
        `/v1/beneficios/${criado.body.id}/historico`,
        rhA,
      ).expect(200);
      expect(h.body.itens.map((i: { tipo: string }) => i.tipo)).toEqual([
        "valores",
        "criado",
      ]);
      expect((await trilhaDo(criado.body.id)).map((e) => e.action)).toEqual([
        "pessoas_beneficio_criado",
        "pessoas_beneficio_valores_alterados",
      ]);
    });

    it("alteração em massa: só no mês, ou daqui em diante (muda a regra)", async () => {
      const p = await admitir(rhA, empresaA);
      const b = await post("/v1/beneficios", rhA)
        .send({ ...VR, pessoas: [{ colaboradorId: p.id }] })
        .expect(201);
      await post(`/v1/beneficios/${b.body.id}/valores/lote`, rhA)
        .send({
          competencia: C,
          para: "todos",
          reajustePercentual: 10,
          duracao: "mes",
        })
        .expect(200);
      let d = await get(
        `/v1/beneficios/${b.body.id}?competencia=${C}`,
        rhA,
      ).expect(200);
      expect(d.body.pessoas[0]).toMatchObject({ valorDia: 3300, valor: 62700 });
      await post(`/v1/beneficios/${b.body.id}/valores/lote`, rhA)
        .send({
          competencia: C,
          para: "grupo",
          escalas: ["12x36"],
          dias: 10,
          duracao: "mes",
        })
        .expect(422);
      await post(`/v1/beneficios/${b.body.id}/valores/lote`, rhA)
        .send({
          competencia: "2026-12",
          para: "todos",
          valorDia: 35,
          duracao: "em_diante",
        })
        .expect(200);
      d = await get(
        `/v1/beneficios/${b.body.id}?competencia=2026-12`,
        rhA,
      ).expect(200);
      expect(d.body.beneficio.regras.valorDia).toBe(35);
      expect(d.body.pessoas[0]).toMatchObject({ valorDia: 3500, valor: 77000 });
    });

    it("vale-transporte: até 6% do salário, nunca maior que o VT; sem salário, pendente", async () => {
      const a = await admitir(rhA, empresaA);
      const semSalario = await admitir(rhA, empresaA);
      const vinculo = await prisma.vinculoFuncional.findFirstOrThrow({
        where: { colaboradorId: semSalario.id },
      });
      // Sem salário (como um vínculo antigo, de antes do histórico salarial):
      // nenhuma linha viva no histórico e o contrato vazio. A linha da
      // admissão não se remove pela aplicação; aqui ela vira uma alteração
      // removida só para simular o vínculo antigo.
      const rh = await prisma.accessUser.findFirstOrThrow({
        where: { email: "rh.bena@example.test" },
      });
      await prisma.alteracaoSalarial.updateMany({
        where: { vinculoId: vinculo.id },
        data: {
          origem: "alteracao",
          removidaEm: new Date(),
          removidaPorUserId: rh.id,
        },
      });
      await prisma.contratoVinculo.update({
        where: { vinculoId: vinculo.id },
        data: { salarioBruto: null },
      });
      const b = await post("/v1/beneficios", rhA)
        .send({
          nome: "VT sintético",
          categoria: "mobilidade",
          folha: "desconto",
          tipoValor: "dia_util",
          inicio: "2026-01-01",
          regras: {
            valorDia: 10,
            diasModo: "uteis",
            vt: { percentualSalario: 6, empresaCusteiaTudo: false },
          },
          pessoas: [{ colaboradorId: a.id }, { colaboradorId: semSalario.id }],
        })
        .expect(201);
      const d = await get(
        `/v1/beneficios/${b.body.id}?competencia=${C}`,
        rhA,
      ).expect(200);
      const pa = d.body.pessoas.find(
        (p: { colaboradorId: string }) => p.colaboradorId === a.id,
      );
      const ps = d.body.pessoas.find(
        (p: { colaboradorId: string }) => p.colaboradorId === semSalario.id,
      );
      expect(pa).toMatchObject({ valor: 19000, desconto: 9726, empresa: 9274 });
      expect(ps).toMatchObject({ desconto: 0, pendencia: "sem_salario" });
      expect(d.body.totais.comPendencia).toBe(1);
      // A prévia traz os exemplos do VT.
      const previa = await post("/v1/beneficios/previa", rhA)
        .send({
          nome: b.body.nome,
          categoria: b.body.categoria,
          folha: b.body.folha,
          tipoValor: b.body.tipoValor,
          inicio: b.body.inicio,
          regras: b.body.regras,
          competencia: C,
        })
        .expect(200);
      expect(
        previa.body.exemplosVt.map(
          (e: { calculo: { desconto: number } }) => e.calculo.desconto,
        ),
      ).toEqual([9726, 19000, 19000, 0, 0]);
    });
  });

  describe("saúde por faixa etária e dependentes", () => {
    const SAUDE = {
      nome: "Saúde sintética",
      categoria: "saude",
      folha: "desconto",
      tipoValor: "faixa_etaria",
      inicio: "2026-01-01",
      fim: "2027-12-31",
      regras: {
        faixas: [100, 120, 140, 160, 180, 200, 230, 260, 300, 529],
        colaboradorPaga: { calculo: "percentual", titular: 20, dependente: 30 },
        coparticipacao: true,
      },
    };

    it("titular pela idade; sem nascimento, pendente; dependente no plano soma", async () => {
      const titular = await admitir(rhA, empresaA);
      const semNasc = await admitir(rhA, empresaA);
      await prisma.perfilPessoalColaborador.updateMany({
        where: { colaboradorId: semNasc.id },
        data: { dataNascimento: null },
      });
      const b = await post("/v1/beneficios", rhA)
        .send({
          ...SAUDE,
          pessoas: [
            { colaboradorId: titular.id },
            { colaboradorId: semNasc.id },
          ],
        })
        .expect(201);
      let d = await get(
        `/v1/beneficios/${b.body.id}?competencia=${C}`,
        rhA,
      ).expect(200);
      const pt = () =>
        d.body.pessoas.find(
          (p: { colaboradorId: string }) => p.colaboradorId === titular.id,
        );
      expect(pt()).toMatchObject({
        faixa: "34 a 38",
        valor: 18000,
        desconto: 3600,
        empresa: 14400,
      });
      expect(
        d.body.pessoas.find(
          (p: { colaboradorId: string }) => p.colaboradorId === semNasc.id,
        ),
      ).toMatchObject({ pendencia: "sem_nascimento", valor: 0 });

      // Dependente cadastrado (com CPF inválido, recusado).
      await post(`/v1/colaboradores/${titular.id}/dependentes`, rhA)
        .send({
          nome: "Filho Sintético",
          parentesco: "filho",
          dataNascimento: "2018-05-10",
          cpf: "123.456.789-00",
        })
        .expect(422);
      const dep = await post(`/v1/colaboradores/${titular.id}/dependentes`, rhA)
        .send({
          nome: "Filho Sintético",
          parentesco: "filho",
          dataNascimento: "2018-05-10",
        })
        .expect(201);
      // Cadastrado não entra sozinho no plano.
      d = await get(`/v1/beneficios/${b.body.id}?competencia=${C}`, rhA).expect(
        200,
      );
      expect(pt()).toMatchObject({
        dependentesNoPlano: 0,
        dependentesCadastrados: 1,
      });
      await put(
        `/v1/beneficios/${b.body.id}/pessoas/${titular.id}/dependentes`,
        rhA,
      )
        .send({ dependenteIds: [dep.body.id], aPartirDe: C })
        .expect(200);
      d = await get(`/v1/beneficios/${b.body.id}?competencia=${C}`, rhA).expect(
        200,
      );
      expect(pt()).toMatchObject({
        dependentesNoPlano: 1,
        valor: 28000,
        desconto: 6600,
        empresa: 21400,
      });
      const lista = await get(
        `/v1/beneficios/${b.body.id}/pessoas/${titular.id}/dependentes?competencia=${C}`,
        rhA,
      ).expect(200);
      expect(lista.body.dependentes).toEqual([
        expect.objectContaining({
          id: dep.body.id,
          noPlano: true,
          dataNascimento: "2018-05-10",
        }),
      ]);

      // Coparticipação do mês.
      await put(`/v1/beneficios/${b.body.id}/valores`, rhA)
        .send({
          competencia: C,
          linhas: [{ colaboradorId: titular.id, coparticipacao: 35.5 }],
        })
        .expect(200);
      d = await get(`/v1/beneficios/${b.body.id}?competencia=${C}`, rhA).expect(
        200,
      );
      expect(pt()).toMatchObject({
        valor: 31550,
        desconto: 10150,
        empresa: 21400,
      });

      // Remover o dependente o tira do plano (a partir do mês atual).
      await post(
        `/v1/colaboradores/${titular.id}/dependentes/${dep.body.id}/remover`,
        rhA,
      )
        .send()
        .expect(200);
      const deps = await get(
        `/v1/colaboradores/${titular.id}/dependentes`,
        rhA,
      ).expect(200);
      expect(deps.body.dependentes).toEqual([]);
      const vivo = await prisma.beneficioDependente.findFirstOrThrow({
        where: { dependenteId: dep.body.id },
      });
      expect(vivo.ate).not.toBeNull();
    });

    it("dependentes: outra empresa não vê; dados conferidos", async () => {
      const p = await admitir(rhA, empresaA);
      await get(`/v1/colaboradores/${p.id}/dependentes`, rhB).expect(404);
      const r = await post(`/v1/colaboradores/${p.id}/dependentes`, rhA)
        .send({ nome: "", parentesco: "primo", email: "x" })
        .expect(422);
      expect(r.body.erros).toEqual(
        expect.arrayContaining([
          { campo: "nome", motivo: "obrigatorio" },
          { campo: "parentesco", motivo: "obrigatorio" },
          { campo: "email", motivo: "invalido" },
        ]),
      );
      const ok = await post(`/v1/colaboradores/${p.id}/dependentes`, rhA)
        .send({
          nome: " Cônjuge  Sintética ",
          parentesco: "conjuge",
          telefone: "(11) 91234-5678",
          email: "Conjuge@Example.test",
        })
        .expect(201);
      expect(ok.body).toMatchObject({
        nome: "Cônjuge Sintética",
        telefone: "+5511912345678",
        email: "conjuge@example.test",
      });
      const alterado = await put(
        `/v1/colaboradores/${p.id}/dependentes/${ok.body.id}`,
        dpA,
      )
        .send({
          nome: "Cônjuge Sintética",
          parentesco: "conjuge",
          dataNascimento: "1992-02-02",
        })
        .expect(200);
      expect(alterado.body.dataNascimento).toBe("1992-02-02");
    });
  });

  describe("ciclo de vida", () => {
    it("pausar a partir da próxima folha, reativar, encerrar, duplicar e excluir", async () => {
      const p = await admitir(rhA, empresaA);
      const b = await post("/v1/beneficios", rhA)
        .send({ ...VR, nome: "VR ciclo", pessoas: [{ colaboradorId: p.id }] })
        .expect(201);
      await post(`/v1/beneficios/${b.body.id}/pausar`, rhA)
        .send({ aPartirDe: "2026-12" })
        .expect(200);
      let nov = await get(
        `/v1/beneficios/${b.body.id}?competencia=${C}`,
        rhA,
      ).expect(200);
      let dez = await get(
        `/v1/beneficios/${b.body.id}?competencia=2026-12`,
        rhA,
      ).expect(200);
      expect(nov.body.totais.pessoas).toBe(1);
      expect(dez.body.totais.pessoas).toBe(0);
      expect(dez.body.beneficio).toMatchObject({
        situacao: "pausado",
        suspensoAPartirDe: "2026-12",
      });
      await post(`/v1/beneficios/${b.body.id}/pausar`, rhA)
        .send({ aPartirDe: "2026-12" })
        .expect(422);
      await post(`/v1/beneficios/${b.body.id}/reativar`, rhA)
        .send()
        .expect(200);
      dez = await get(
        `/v1/beneficios/${b.body.id}?competencia=2026-12`,
        rhA,
      ).expect(200);
      expect(dez.body.totais.pessoas).toBe(1);
      await post(`/v1/beneficios/${b.body.id}/encerrar`, rhA)
        .send({ aPartirDe: C })
        .expect(200);
      nov = await get(
        `/v1/beneficios/${b.body.id}?competencia=${C}`,
        rhA,
      ).expect(200);
      expect(nov.body.totais.pessoas).toBe(0);

      const copia = await post(`/v1/beneficios/${b.body.id}/duplicar`, rhA)
        .send()
        .expect(201);
      expect(copia.body).toMatchObject({
        nome: "VR ciclo (cópia)",
        situacao: "ativo",
      });
      const dc = await get(`/v1/beneficios/${copia.body.id}`, rhA).expect(200);
      expect(dc.body.totais.pessoas).toBe(0);

      await post(`/v1/beneficios/${copia.body.id}/excluir`, rhA)
        .send()
        .expect(200);
      await get(`/v1/beneficios/${copia.body.id}`, rhA).expect(404);
      expect((await trilhaDo(b.body.id)).map((e) => e.action)).toEqual([
        "pessoas_beneficio_criado",
        "pessoas_beneficio_pausado",
        "pessoas_beneficio_reativado",
        "pessoas_beneficio_encerrado",
      ]);
    });

    it("adicionar pessoas: candidatos, já recebe e remover", async () => {
      const a = await admitir(rhA, empresaA);
      const n = await admitir(rhA, empresaA);
      const b = await post("/v1/beneficios", rhA)
        .send({ ...VR, nome: "VR pessoas", pessoas: [{ colaboradorId: a.id }] })
        .expect(201);
      const cand = await get(
        `/v1/beneficios/${b.body.id}/candidatos?competencia=${C}`,
        rhA,
      ).expect(200);
      const ids = cand.body.pessoas.map(
        (p: { colaboradorId: string }) => p.colaboradorId,
      );
      expect(ids).toContain(n.id);
      expect(ids).not.toContain(a.id);
      await post(`/v1/beneficios/${b.body.id}/pessoas`, rhA)
        .send({ aPartirDe: C, pessoas: [{ colaboradorId: a.id }] })
        .expect(422);
      await post(`/v1/beneficios/${b.body.id}/pessoas`, rhA)
        .send({ aPartirDe: "2026-12", pessoas: [{ colaboradorId: n.id }] })
        .expect(201);
      let nov = await get(
        `/v1/beneficios/${b.body.id}?competencia=${C}`,
        rhA,
      ).expect(200);
      const dez = await get(
        `/v1/beneficios/${b.body.id}?competencia=2026-12`,
        rhA,
      ).expect(200);
      expect(nov.body.totais.pessoas).toBe(1);
      expect(dez.body.totais.pessoas).toBe(2);
      await post(`/v1/beneficios/${b.body.id}/pessoas/${a.id}/remover`, rhA)
        .send()
        .expect(200);
      nov = await get(
        `/v1/beneficios/${b.body.id}?competencia=${C}`,
        rhA,
      ).expect(200);
      expect(nov.body.totais.pessoas).toBe(0);
      // Outra empresa não adiciona pessoa de A.
      const bB = await post("/v1/beneficios", rhB).send(VR).expect(201);
      await post(`/v1/beneficios/${bB.body.id}/pessoas`, rhB)
        .send({ aPartirDe: C, pessoas: [{ colaboradorId: a.id }] })
        .expect(422);
    });
  });
  describe("competências, resumo da lista, importação e impacto", () => {
    const comCpf = async (colaboradorId: string, cpf: string) => {
      const r = await prisma.perfilPessoalColaborador.updateMany({
        where: { colaboradorId },
        data: { cpf },
      });
      expect(r.count).toBe(1);
    };

    it("valores mudam a partir da competência escolhida; meses antes ficam", async () => {
      const p = await admitir(rhA, empresaA);
      const b = await post("/v1/beneficios", rhA)
        .send({
          ...VR,
          inicio: "2026-11-01",
          pessoas: [{ colaboradorId: p.id }],
        })
        .expect(201);
      // Nova regra de valor a partir de 12/2026.
      await put(`/v1/beneficios/${b.body.id}`, rhA)
        .send({
          ...VR,
          inicio: "2026-11-01",
          regras: { ...VR.regras, valorDia: 40 },
          aPartirDe: "2026-12",
        })
        .expect(200);
      const em = async (c: string) =>
        (
          await get(`/v1/beneficios/${b.body.id}?competencia=${c}`, rhA).expect(
            200,
          )
        ).body;
      expect((await em("2026-11")).beneficio.regras.valorDia).toBe(30);
      expect((await em("2026-11")).pessoas[0]).toMatchObject({
        valorDia: 3000,
      });
      expect((await em("2026-12")).beneficio.regras.valorDia).toBe(40);
      expect((await em("2027-03")).pessoas[0]).toMatchObject({
        valorDia: 4000,
      });

      // "Daqui em diante" no lote também é uma versão: 12/2026 fica com 40.
      await post(`/v1/beneficios/${b.body.id}/valores/lote`, rhA)
        .send({
          competencia: "2027-01",
          para: "todos",
          valorDia: 45,
          duracao: "em_diante",
        })
        .expect(200);
      expect((await em("2026-12")).beneficio.regras.valorDia).toBe(40);
      expect((await em("2027-01")).beneficio.regras.valorDia).toBe(45);

      // Uma versão nova substitui as que começavam depois dela.
      await put(`/v1/beneficios/${b.body.id}`, rhA)
        .send({
          ...VR,
          inicio: "2026-11-01",
          regras: { ...VR.regras, valorDia: 50 },
          aPartirDe: "2026-12",
        })
        .expect(200);
      expect((await em("2027-01")).beneficio.regras.valorDia).toBe(50);
      expect((await em("2026-11")).beneficio.regras.valorDia).toBe(30);

      // Desde o início: troca a regra do próprio benefício.
      await put(`/v1/beneficios/${b.body.id}`, rhA)
        .send({
          ...VR,
          inicio: "2026-11-01",
          regras: { ...VR.regras, valorDia: 25 },
          aPartirDe: "2026-11",
        })
        .expect(200);
      expect((await em("2026-11")).beneficio.regras.valorDia).toBe(25);
      expect((await em("2027-06")).beneficio.regras.valorDia).toBe(25);

      const h = await get(`/v1/beneficios/${b.body.id}/historico`, rhA).expect(
        200,
      );
      expect(h.body.itens[0]).toMatchObject({
        tipo: "valores",
        aPartirDe: "2026-11",
        descricao: "Valores do benefício alterados a partir de 11/2026.",
      });
      const versoes = await prisma.beneficioVersao.findMany({
        where: { beneficioId: b.body.id },
      });
      expect(versoes.length).toBe(3);
      expect(versoes.every((v) => v.substituidaEm !== null)).toBe(true);
    });

    it("lista: dependentes, pessoas distintas, cobertura e quem está sem benefício", async () => {
      const titular = await admitir(rhA, empresaA);
      const plano = await post("/v1/beneficios", rhA)
        .send({
          nome: "Saúde da lista",
          categoria: "saude",
          folha: "desconto",
          tipoValor: "faixa_etaria",
          inicio: "2026-01-01",
          fim: "2027-12-31",
          regras: {
            faixas: [100, 120, 140, 160, 180, 200, 230, 260, 300, 529],
            colaboradorPaga: {
              calculo: "percentual",
              titular: 20,
              dependente: 30,
            },
          },
          pessoas: [{ colaboradorId: titular.id }],
        })
        .expect(201);
      const dep = await post(`/v1/colaboradores/${titular.id}/dependentes`, rhA)
        .send({
          nome: "Dependente Lista",
          parentesco: "filho",
          dataNascimento: "2018-05-10",
        })
        .expect(201);
      await put(
        `/v1/beneficios/${plano.body.id}/pessoas/${titular.id}/dependentes`,
        rhA,
      )
        .send({ dependenteIds: [dep.body.id], aPartirDe: C })
        .expect(200);
      const lista = await get(`/v1/beneficios?competencia=${C}`, rhA).expect(
        200,
      );
      const r = lista.body.resumo;
      expect(r.ativos).toBeGreaterThan(0);
      expect(r.ativos - r.semBeneficio.length).toBeLessThanOrEqual(r.pessoas);
      expect(r.pessoas).toBeLessThanOrEqual(
        lista.body.beneficios.reduce(
          (t: number, b: { pessoas: number }) => t + b.pessoas,
          0,
        ),
      );
      const ativos = lista.body.beneficios.filter(
        (b: { situacao: string }) => b.situacao === "ativo",
      );
      expect(r.empresa).toBeLessThanOrEqual(
        ativos.reduce((t: number, b: { empresa: number }) => t + b.empresa, 0),
      );
      expect(r.semBeneficio[0]).toEqual({
        colaboradorId: expect.any(String),
        nome: expect.any(String),
        cargo: expect.anything(),
      });
      const comDep = lista.body.beneficios.find(
        (b: { id: string }) => b.id === plano.body.id,
      );
      expect(comDep).toMatchObject({ pessoas: 1, dependentes: 1 });
      // Outra empresa: só o que é dela.
      const deB = await get(`/v1/beneficios?competencia=${C}`, rhB).expect(200);
      const idsDeA = new Set(
        r.semBeneficio.map((p: { colaboradorId: string }) => p.colaboradorId),
      );
      expect(
        deB.body.resumo.semBeneficio.some((p: { colaboradorId: string }) =>
          idsDeA.has(p.colaboradorId),
        ),
      ).toBe(false);
    });

    it("importar valores: conferência por CPF, antes e depois; importa só as prontas", async () => {
      const a = await admitir(rhA, empresaA);
      const fora = await admitir(rhA, empresaA);
      await comCpf(a.id, "11144477735");
      await comCpf(fora.id, "52998224725");
      const b = await post("/v1/beneficios", rhA)
        .send({ ...VR, pessoas: [{ colaboradorId: a.id }] })
        .expect(201);
      const d = await get(
        `/v1/beneficios/${b.body.id}?competencia=${C}`,
        rhA,
      ).expect(200);
      expect(d.body.pessoas[0].cpf).toBe("11144477735");
      // O master só lê: sem CPF.
      const dm = await get(
        `/v1/beneficios/${b.body.id}?competencia=${C}`,
        masterA,
      ).expect(200);
      expect(dm.body.pessoas[0].cpf).toBeNull();

      const r = await post(
        `/v1/beneficios/${b.body.id}/importacao/conferir`,
        rhA,
      )
        .send({
          competencia: C,
          linhas: [
            {
              linha: 2,
              cpf: "111.444.777-35",
              valores: { dias: "15", valorDia: "30,00" },
            },
            { linha: 3, cpf: "529.982.247-25", valores: { dias: "10" } },
            { linha: 4, cpf: "123", valores: { dias: "10" } },
          ],
        })
        .expect(200);
      expect(r.body.colunas).toEqual(["dias", "valorDia"]);
      expect(r.body.linhas[0]).toMatchObject({
        situacao: "pronta",
        nome: a.nome,
        // Só o que muda vai para o lançamento.
        valores: { dias: 15 },
        atuais: { dias: 19, valorDia: 30 },
        antes: { valor: 57000, desconto: 11400 },
        depois: { valor: 45000, desconto: 9000 },
      });
      expect(r.body.linhas[1]).toMatchObject({
        situacao: "pendencia",
        problemas: [{ campo: "cpf", motivo: "nao_recebe" }],
      });
      expect(r.body.linhas[2].problemas).toEqual([
        { campo: "cpf", motivo: "invalido" },
      ]);
      // Conferir não grava.
      const d2 = await get(
        `/v1/beneficios/${b.body.id}?competencia=${C}`,
        rhA,
      ).expect(200);
      expect(d2.body.pessoas[0]).toMatchObject({ dias: 19, ajustado: false });
      // A barra de alterações: totais antes e depois, sem gravar.
      const sim = await post(`/v1/beneficios/${b.body.id}/valores/simular`, rhA)
        .send({ competencia: C, linhas: [{ colaboradorId: a.id, dias: 10 }] })
        .expect(200);
      expect(sim.body.antes).toMatchObject({ desconto: 11400 });
      expect(sim.body.depois).toMatchObject({ desconto: 6000 });
      // O master não importa.
      await post(`/v1/beneficios/${b.body.id}/importacao/conferir`, masterA)
        .send({ competencia: C, linhas: [] })
        .expect(403);
      // Importar = salvar valores com a origem.
      await put(`/v1/beneficios/${b.body.id}/valores`, rhA)
        .send({
          competencia: C,
          origem: "importacao",
          linhas: [{ colaboradorId: a.id, dias: 15, valorDia: 30 }],
        })
        .expect(200);
      const h = await get(`/v1/beneficios/${b.body.id}/historico`, rhA).expect(
        200,
      );
      expect(h.body.itens[0].descricao).toBe(
        "Valores de 11/2026 importados da planilha para 1 pessoa.",
      );
      await put(`/v1/beneficios/${b.body.id}/valores`, rhA)
        .send({ competencia: C, linhas: [] })
        .expect(422);
    });

    it("coparticipação digitada volta na tela; impacto dos dependentes sem gravar", async () => {
      const titular = await admitir(rhA, empresaA);
      const b = await post("/v1/beneficios", rhA)
        .send({
          nome: "Saúde impacto",
          categoria: "saude",
          folha: "desconto",
          tipoValor: "faixa_etaria",
          inicio: "2026-01-01",
          fim: "2027-12-31",
          regras: {
            faixas: [100, 120, 140, 160, 180, 200, 230, 260, 300, 529],
            colaboradorPaga: {
              calculo: "percentual",
              titular: 20,
              dependente: 30,
            },
            coparticipacao: true,
          },
          pessoas: [{ colaboradorId: titular.id }],
        })
        .expect(201);
      await put(`/v1/beneficios/${b.body.id}/valores`, rhA)
        .send({
          competencia: C,
          linhas: [{ colaboradorId: titular.id, coparticipacao: 50 }],
        })
        .expect(200);
      const d = await get(
        `/v1/beneficios/${b.body.id}?competencia=${C}`,
        rhA,
      ).expect(200);
      expect(d.body.pessoas[0]).toMatchObject({
        coparticipacao: 50,
        desconto: 3600 + 5000,
      });

      const dep = await post(`/v1/colaboradores/${titular.id}/dependentes`, rhA)
        .send({
          nome: "Dependente Impacto",
          parentesco: "filho",
          dataNascimento: "2018-05-10",
        })
        .expect(201);
      const sim = await post(
        `/v1/beneficios/${b.body.id}/pessoas/${titular.id}/dependentes/simular`,
        rhA,
      )
        .send({ dependenteIds: [dep.body.id], aPartirDe: C })
        .expect(200);
      expect(sim.body).toEqual({
        competencia: C,
        // O valor inclui a coparticipação do mês (R$ 50,00).
        antes: { valor: 23000, empresa: 14400, desconto: 8600 },
        depois: { valor: 33000, empresa: 21400, desconto: 11600 },
      });
      // Simular não grava.
      const d2 = await get(
        `/v1/beneficios/${b.body.id}?competencia=${C}`,
        rhA,
      ).expect(200);
      expect(d2.body.pessoas[0].dependentesNoPlano).toBe(0);
    });
  });
  describe("revisão: o passado não muda", () => {
    const em = async (id: string, c: string, cred = rhA) =>
      (await get(`/v1/beneficios/${id}?competencia=${c}`, cred).expect(200))
        .body;
    const ANTES = "2026-10";

    it("editar só o nome não apaga o reajuste que já estava marcado", async () => {
      const p = await admitir(rhA, empresaA);
      const b = await post("/v1/beneficios", rhA)
        .send({ ...VR, pessoas: [{ colaboradorId: p.id }] })
        .expect(201);
      await post(`/v1/beneficios/${b.body.id}/valores/lote`, rhA)
        .send({
          competencia: "2027-01",
          para: "todos",
          valorDia: 35,
          duracao: "em_diante",
        })
        .expect(200);
      // O formulário reenvia as regras de 11/2026 (iguais), só o nome muda.
      const d = await em(b.body.id, C);
      await put(`/v1/beneficios/${b.body.id}`, rhA)
        .send({
          nome: "VR sintético renomeado",
          categoria: d.beneficio.categoria,
          folha: d.beneficio.folha,
          tipoValor: d.beneficio.tipoValor,
          inicio: d.beneficio.inicio,
          fim: d.beneficio.fim,
          observacao: d.beneficio.observacao,
          regras: d.beneficio.regras,
          aPartirDe: "2026-01",
        })
        .expect(200);
      expect((await em(b.body.id, "2027-01")).beneficio.regras.valorDia).toBe(
        35,
      );
      expect((await em(b.body.id, C)).beneficio.nome).toBe(
        "VR sintético renomeado",
      );
    });

    it("remover a pessoa vale deste mês em diante; dá para adicionar de novo", async () => {
      const p = await admitir(rhA, empresaA);
      const b = await post("/v1/beneficios", rhA)
        .send({ ...VR, pessoas: [{ colaboradorId: p.id }] })
        .expect(201);
      const atual = HOJE.slice(0, 7);
      const anterior = somarMeses(`${atual}-01`, -1).slice(0, 7);
      await post(`/v1/beneficios/${b.body.id}/pessoas/${p.id}/remover`, rhA)
        .send()
        .expect(200);
      expect((await em(b.body.id, anterior)).pessoas).toHaveLength(1);
      expect((await em(b.body.id, atual)).pessoas).toHaveLength(0);
      await post(`/v1/beneficios/${b.body.id}/pessoas`, rhA)
        .send({ aPartirDe: atual, pessoas: [{ colaboradorId: p.id }] })
        .expect(201);
      expect((await em(b.body.id, atual)).pessoas).toHaveLength(1);
      // A mesma pessoa duas vezes no pedido: recusa por campo.
      await post(`/v1/beneficios/${b.body.id}/pessoas`, rhA)
        .send({
          aPartirDe: atual,
          pessoas: [{ colaboradorId: p.id }, { colaboradorId: p.id }],
        })
        .expect(422);
    });

    it("reativar não devolve o benefício aos meses em que ficou pausado", async () => {
      const p = await admitir(rhA, empresaA);
      const b = await post("/v1/beneficios", rhA)
        .send({ ...VR, pessoas: [{ colaboradorId: p.id }] })
        .expect(201);
      const atual = HOJE.slice(0, 7);
      const doisAntes = somarMeses(`${atual}-01`, -2).slice(0, 7);
      const umAntes = somarMeses(`${atual}-01`, -1).slice(0, 7);
      const tresAntes = somarMeses(`${atual}-01`, -3).slice(0, 7);
      await post(`/v1/beneficios/${b.body.id}/pausar`, rhA)
        .send({ aPartirDe: doisAntes })
        .expect(200);
      await post(`/v1/beneficios/${b.body.id}/reativar`, rhA)
        .send()
        .expect(200);
      expect((await em(b.body.id, tresAntes)).pessoas).toHaveLength(1);
      expect((await em(b.body.id, doisAntes)).pessoas).toHaveLength(0);
      expect((await em(b.body.id, umAntes)).pessoas).toHaveLength(0);
      expect((await em(b.body.id, atual)).pessoas).toHaveLength(1);
      const lista = await get(
        `/v1/beneficios?competencia=${umAntes}`,
        rhA,
      ).expect(200);
      expect(
        lista.body.beneficios.find((l: { id: string }) => l.id === b.body.id),
      ).toMatchObject({ empresa: 0 });
    });

    it("trocar o plano vale do mês em diante; o mês anterior fica com o de antes", async () => {
      const p = await admitir(rhA, empresaA);
      const b = await post("/v1/beneficios", rhA)
        .send({
          nome: "Academia sintética",
          categoria: "bem_estar",
          folha: "desconto",
          tipoValor: "individual",
          inicio: "2026-01-01",
          regras: {
            individualModo: "plano",
            planos: [
              { id: "p1", nome: "Básico", valor: 100 },
              { id: "p2", nome: "Completo", valor: 200 },
            ],
            quemPaga: { modo: "colaborador_tudo" },
          },
          pessoas: [{ colaboradorId: p.id, planoId: "p1" }],
        })
        .expect(201);
      await put(`/v1/beneficios/${b.body.id}/valores`, rhA)
        .send({
          competencia: "2026-12",
          linhas: [{ colaboradorId: p.id, planoId: "p2" }],
        })
        .expect(200);
      expect((await em(b.body.id, C)).pessoas[0]).toMatchObject({
        planoId: "p1",
        valor: 10000,
      });
      expect((await em(b.body.id, "2026-12")).pessoas[0]).toMatchObject({
        planoId: "p2",
        valor: 20000,
      });
      // A ficha mostra o benefício uma vez só.
      const ficha = await get(
        `/v1/colaboradores/${p.id}/beneficios?competencia=2026-12`,
        rhA,
      ).expect(200);
      expect(
        ficha.body.beneficios.filter((x: { id: string }) => x.id === b.body.id),
      ).toHaveLength(1);
    });

    it("dependente: sem nascimento não entra no plano; removido some só daqui em diante; CPF só para RH", async () => {
      const titular = await admitir(rhA, empresaA);
      const b = await post("/v1/beneficios", rhA)
        .send({
          nome: "Saúde revisão",
          categoria: "saude",
          folha: "desconto",
          tipoValor: "faixa_etaria",
          inicio: "2026-01-01",
          fim: "2027-12-31",
          regras: {
            faixas: [100, 120, 140, 160, 180, 200, 230, 260, 300, 529],
            colaboradorPaga: {
              calculo: "percentual",
              titular: 20,
              dependente: 30,
            },
          },
          pessoas: [{ colaboradorId: titular.id }],
        })
        .expect(201);
      const semNasc = await post(
        `/v1/colaboradores/${titular.id}/dependentes`,
        rhA,
      )
        .send({ nome: "Sem Nascimento", parentesco: "filho" })
        .expect(201);
      await put(
        `/v1/beneficios/${b.body.id}/pessoas/${titular.id}/dependentes`,
        rhA,
      )
        .send({ dependenteIds: [semNasc.body.id], aPartirDe: ANTES })
        .expect(422);
      const dep = await post(`/v1/colaboradores/${titular.id}/dependentes`, rhA)
        .send({
          nome: "Com Nascimento",
          parentesco: "filho",
          dataNascimento: "2018-05-10",
          cpf: "529.982.247-25",
        })
        .expect(201);
      await post(`/v1/colaboradores/${titular.id}/dependentes`, rhA)
        .send({
          nome: "Data Errada",
          parentesco: "filho",
          dataNascimento: "2020-02-30",
        })
        .expect(422);
      await put(
        `/v1/beneficios/${b.body.id}/pessoas/${titular.id}/dependentes`,
        rhA,
      )
        .send({ dependenteIds: [dep.body.id], aPartirDe: ANTES })
        .expect(200);
      // O master só lê: dependentes sem CPF.
      const doMaster = await get(
        `/v1/colaboradores/${titular.id}/dependentes`,
        masterA,
      ).expect(200);
      expect(
        doMaster.body.dependentes.every(
          (d: { cpf: unknown }) => d.cpf === null,
        ),
      ).toBe(true);
      await post(
        `/v1/colaboradores/${titular.id}/dependentes/${dep.body.id}/remover`,
        rhA,
      )
        .send()
        .expect(200);
      const atual = HOJE.slice(0, 7);
      const anterior = somarMeses(`${atual}-01`, -1).slice(0, 7);
      if (anterior >= ANTES) {
        expect(
          (await em(b.body.id, anterior)).pessoas[0].dependentesNoPlano,
        ).toBe(1);
      }
      expect((await em(b.body.id, atual)).pessoas[0].dependentesNoPlano).toBe(
        0,
      );
    });

    it("desligada antes do mês sai do benefício; no mês da saída ainda conta", async () => {
      const p = await admitir(rhA, empresaA);
      const b = await post("/v1/beneficios", rhA)
        .send({ ...VR, pessoas: [{ colaboradorId: p.id }] })
        .expect(201);
      await prisma.vinculoFuncional.updateMany({
        where: { colaboradorId: p.id },
        data: {
          situacao: "encerrado",
          dataDesligamento: new Date("2026-09-15T00:00:00Z"),
        },
      });
      expect((await em(b.body.id, "2026-09")).pessoas).toHaveLength(1);
      expect((await em(b.body.id, "2026-10")).pessoas).toHaveLength(0);
    });
  });

  describe("dias pela escala e salário do mês", () => {
    const VR_ESCALA = {
      ...VR,
      nome: "VR pela escala",
      regras: { ...VR.regras, diasModo: "escala" },
    };

    async function idDoRh(): Promise<string> {
      return (
        await prisma.accessUser.findFirstOrThrow({
          where: { email: "rh.bena@example.test" },
        })
      ).id;
    }

    async function definirPadrao(
      colaboradorId: string,
      corpo: Record<string, unknown>,
    ) {
      await post(`/v1/colaboradores/${colaboradorId}/escalas`, rhA)
        .send({ vigenciaInicio: "2026-10-01", ...corpo })
        .expect(201);
    }

    async function publicarDireto(
      colaboradorId: string,
      dia: string,
      tipo: "trabalho" | "folga",
    ) {
      const rh = await idDoRh();
      await prisma.escalaDia.create({
        data: {
          colaboradorId,
          empresaId: empresaA,
          dia: new Date(`${dia}T00:00:00Z`),
          camada: "publicado",
          tipo,
          periodos:
            tipo === "trabalho" ? [{ inicio: "09:00", fim: "18:00" }] : [],
          criadoPorUserId: rh,
          atualizadoPorUserId: rh,
        },
      });
    }

    const pessoaNo = async (
      beneficioId: string,
      colaboradorId: string,
      c = C,
    ) =>
      (
        await get(`/v1/beneficios/${beneficioId}?competencia=${c}`, rhA).expect(
          200,
        )
      ).body.pessoas.find(
        (p: { colaboradorId: string }) => p.colaboradorId === colaboradorId,
      );

    it("6x1 com um dia publicado: o mês inteiro dia a dia, o publicado por cima do padrão", async () => {
      const soTerca = await admitir(rhA, empresaA);
      const comFolga = await admitir(rhA, empresaA);
      for (const p of [soTerca, comFolga]) {
        await definirPadrao(p.id, { modelo: "6x1", folgaSemanal: 7 });
      }
      // 03/11/2026 é terça: trabalho publicado num, folga publicada no outro.
      await publicarDireto(soTerca.id, "2026-11-03", "trabalho");
      await publicarDireto(comFolga.id, "2026-11-03", "folga");
      const b = await post("/v1/beneficios", rhA)
        .send({
          ...VR_ESCALA,
          pessoas: [
            { colaboradorId: soTerca.id },
            { colaboradorId: comFolga.id },
          ],
        })
        .expect(201);
      // Novembro/2026: 30 dias, 5 domingos (DSR) = 25 dias de trabalho.
      expect(await pessoaNo(b.body.id, soTerca.id)).toMatchObject({
        dias: 25,
        origemDias: "escala",
        valor: 25 * 3000,
      });
      expect(await pessoaNo(b.body.id, comFolga.id)).toMatchObject({
        dias: 24,
        origemDias: "escala",
      });
    });

    it("férias aprovadas tiram os dias; home office não", async () => {
      const ferias = await admitir(rhA, empresaA);
      const remoto = await admitir(rhA, empresaA);
      const rh = await idDoRh();
      for (const [p, tipo] of [
        [ferias, "ferias"],
        [remoto, "home_office"],
      ] as const) {
        await definirPadrao(p.id, { modelo: "5x2" });
        const vinculo = await prisma.vinculoFuncional.findFirstOrThrow({
          where: { colaboradorId: p.id },
        });
        await prisma.ausencia.create({
          data: {
            empresaId: empresaA,
            colaboradorId: p.id,
            vinculoId: vinculo.id,
            tipo,
            inicio: new Date("2026-11-09T00:00:00Z"),
            fim: new Date("2026-11-13T00:00:00Z"),
            status: "aprovada",
            registradoPorId: rh,
          },
        });
      }
      const b = await post("/v1/beneficios", rhA)
        .send({
          ...VR_ESCALA,
          pessoas: [{ colaboradorId: ferias.id }, { colaboradorId: remoto.id }],
        })
        .expect(201);
      // 5x2 pelo padrão: 21 dias de semana em novembro/2026.
      expect(await pessoaNo(b.body.id, ferias.id)).toMatchObject({
        dias: 16,
        origemDias: "escala",
      });
      expect(await pessoaNo(b.body.id, remoto.id)).toMatchObject({ dias: 21 });
    });

    it("sem padrão nem publicado: a proporção do modelo do cadastro", async () => {
      const p = await admitir(rhA, empresaA);
      const vinculo = await prisma.vinculoFuncional.findFirstOrThrow({
        where: { colaboradorId: p.id },
      });
      await prisma.contratoVinculo.update({
        where: { vinculoId: vinculo.id },
        data: { escala: "12x36" },
      });
      const b = await post("/v1/beneficios", rhA)
        .send({ ...VR_ESCALA, pessoas: [{ colaboradorId: p.id }] })
        .expect(201);
      expect(await pessoaNo(b.body.id, p.id)).toMatchObject({
        dias: 15,
        origemDias: "catalogo",
      });
    });

    it("reajuste em 01/11: outubro desconta o VT pelo salário antigo", async () => {
      const p = await admitir(rhA, empresaA);
      await post(`/v1/colaboradores/${p.id}/salarios`, rhA)
        .send({ vigenciaInicio: "2026-11-01", salarioBruto: "3000.00" })
        .expect(201);
      const b = await post("/v1/beneficios", rhA)
        .send({
          nome: "VT do reajuste",
          categoria: "mobilidade",
          folha: "desconto",
          tipoValor: "dia_util",
          inicio: "2026-01-01",
          regras: {
            valorDia: 10,
            diasModo: "uteis",
            vt: { percentualSalario: 6, empresaCusteiaTudo: false },
          },
          pessoas: [{ colaboradorId: p.id }],
        })
        .expect(201);
      // Outubro/2026: 21 dias úteis (12/10 é feriado) → VT de R$ 210,00;
      // 6% de R$ 1.621,00 = R$ 97,26.
      expect(await pessoaNo(b.body.id, p.id, "2026-10")).toMatchObject({
        valor: 21000,
        desconto: 9726,
      });
      // Novembro: 6% de R$ 3.000,00 = R$ 180,00 (menor que o VT de R$ 190,00).
      expect(await pessoaNo(b.body.id, p.id, C)).toMatchObject({
        valor: 19000,
        desconto: 18000,
      });
    });
  });
});
