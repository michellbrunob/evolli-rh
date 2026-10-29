import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { Writable } from "node:stream";
import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { PrismaClient } from "@prisma/client";
import cookieParser from "cookie-parser";
import { Logger, PARAMS_PROVIDER_TOKEN } from "nestjs-pino";
import request from "supertest";
import { GenericContainer, StartedTestContainer, Wait } from "testcontainers";
import { AppModule } from "../src/app.module";
import { AllExceptionsFilter } from "../src/common/filters/http-exception.filter";
import { opcoesDoLogHttp } from "../src/common/logger/logger.module";
import {
  REQUEST_ID_HEADER,
  requestIdMiddleware,
} from "../src/common/request-id";
import {
  FORNECEDOR_CEP,
  FornecedorCep,
  ResultadoFornecedorCep,
} from "../src/cep/cep.types";
import {
  camposObrigatoriosAdmissao,
  lotacaoMinima,
} from "./admissao-obrigatoria";

/**
 * T178 — log geral de requisições COM O LOG LIGADO (nível `info`, as mesmas
 * opções da API em execução), capturado linha a linha.
 *
 * Prova: nem o CEP do caminho (`/v1/cep/01001000`), nem a `busca` por nome ou
 * matrícula, nem outro valor de rota ou query entram no log; os metadados
 * técnicos (método, padrão da rota, status, duração e `requestId`) continuam
 * lá; e a consulta de CEP e a listagem respondem como antes.
 *
 * T179 — também com o log ligado: a admissão recusada por duplicidade (409)
 * e a edição de contatos não deixam e-mail, telefone, CEP, matrícula nem a
 * chave de idempotência em linha nenhuma, e o 409 traz só o nome do campo.
 *
 * As demais suítes rodam com `LOG_LEVEL=silent` — por isso esta existe.
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
const SENHA_PADRAO = "Log!SemValores#2026";

const CEP = "01001000";
const NOME = "Lucia Rastreavel Sintetica";
const MATRICULA = "MAT-LOGX-77";
// T179 — chaves de idempotência rastreáveis no log.
const CHAVE_CONFLITO = "3f2b6c1e-9a7d-4e5f-8b6a-1c2d3e4f5a6b";
const CHAVE_ADMISSAO = "7c8d9e0f-1a2b-4c3d-9e4f-5a6b7c8d9e0f";

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

/** Fornecedor falso: nenhum teste sai para a rede. */
class FornecedorFalso implements FornecedorCep {
  readonly nome = "falso";
  proxima: ResultadoFornecedorCep = { tipo: "inexistente" };

  consultar(): Promise<ResultadoFornecedorCep> {
    return Promise.resolve(this.proxima);
  }
}

/** Destino do log: guarda cada linha, crua, como o pino a escreveria. */
class DestinoDoLog extends Writable {
  linhas: string[] = [];

  override _write(
    chunk: Buffer,
    _encoding: BufferEncoding,
    feito: (erro?: Error | null) => void,
  ): void {
    this.linhas.push(...chunk.toString("utf8").split("\n").filter(Boolean));
    feito();
  }
}

type Linha = Record<string, unknown>;

describe("Log geral de requisições sem valores (T178, e2e)", () => {
  let container: StartedTestContainer;
  let app: INestApplication;
  let prisma: PrismaClient;
  const fornecedor = new FornecedorFalso();
  const destino = new DestinoDoLog();

  let rh: Credencial;
  // T179 — o que a primeira admissão enviou, e o corpo comum às admissões.
  let primeiraAdmissao: ReturnType<typeof camposObrigatoriosAdmissao>;
  let colaboradorId: string;
  let corpoBase: Record<string, unknown>;

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
  const get = (rota: string, cred: Credencial) =>
    agent().get(rota).set("Cookie", cred.cookie);
  function put(rota: string, cred: Credencial) {
    return agent()
      .put(rota)
      .set("Cookie", cred.cookie)
      .set("x-csrf-token", cred.csrfToken);
  }

  /** Linhas JSON do log de uma requisição, pelo `requestId` da resposta. */
  function linhasDa(requestId: string): Linha[] {
    return destino.linhas
      .map((l) => JSON.parse(l) as Linha)
      .filter((l) => l.requestId === requestId);
  }

  /** A linha de conclusão da requisição (a que traz `res`). */
  function conclusao(requestId: string): Linha {
    const linhas = linhasDa(requestId).filter((l) => l.res !== undefined);
    expect(linhas).toHaveLength(1);
    return linhas[0]!;
  }

  /** O valor não aparece em NENHUMA linha, nem codificado para URL. */
  function ausenteDoLog(...valores: string[]): void {
    const tudo = destino.linhas.join("\n").toLowerCase();
    for (const valor of valores) {
      for (const forma of [valor, encodeURIComponent(valor)]) {
        expect(tudo).not.toContain(forma.toLowerCase());
      }
    }
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
    const appUrl = `postgresql://evolli_app:${APP_PASSWORD}@${host}:${port}/${ADMIN_DB}?schema=app`;
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

    // As MESMAS opções da API, só que em `info` e escrevendo no destino de
    // teste — não o `silent` das demais suítes.
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PARAMS_PROVIDER_TOKEN)
      .useValue({ pinoHttp: [opcoesDoLogHttp("info"), destino] })
      .overrideProvider(FORNECEDOR_CEP)
      .useValue(fornecedor)
      .compile();
    app = moduleRef.createNestApplication({ bufferLogs: true });
    app.use(requestIdMiddleware);
    app.useLogger(app.get(Logger));
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
        email: "master.log@example.test",
        passwordHash: await new PasswordHashService().hash(SENHA_PADRAO),
        role: "master_tecnico",
        status: "active",
      },
    });
    const master = await login("master.log@example.test");
    const empresaId = (
      await post("/v1/empresas", master)
        .send({ codigo: "LOGA", nome: "Empresa Log Alfa" })
        .expect(201)
    ).body.id as string;
    const departamentoId = (
      await post("/v1/departamentos", master)
        .send({ empresaId, codigo: "DEPLOG", nome: "Depto Log" })
        .expect(201)
    ).body.id as string;
    await post("/v1/users", master)
      .send({
        email: "rh.log@example.test",
        password: SENHA_PADRAO,
        role: "rh",
        companyId: empresaId,
      })
      .expect(201);
    rh = await login("rh.log@example.test");
    primeiraAdmissao = camposObrigatoriosAdmissao();
    corpoBase = {
      ...(await lotacaoMinima(appUrl, empresaId)),
      empresaId,
      tipo: "clt",
      dataAdmissao: "2026-02-02",
      motivoCodigo: "admissao_inicial",
      departamentoId,
    };
    colaboradorId = (
      await post("/v1/colaboradores", rh)
        .send({
          ...primeiraAdmissao,
          ...corpoBase,
          nome: NOME,
          matricula: MATRICULA,
        })
        .expect(201)
    ).body.id as string;
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    await app?.close();
    await container?.stop();
  });

  it("o log está mesmo ligado: há linhas de conclusão de requisição", () => {
    expect(
      destino.linhas.some((l) => (JSON.parse(l) as Linha).res !== undefined),
    ).toBe(true);
  });

  describe("CEP na rota", () => {
    it("200: a sugestão chega igual, e o CEP e o endereço ficam fora do log", async () => {
      fornecedor.proxima = {
        tipo: "encontrado",
        endereco: {
          cep: CEP,
          logradouro: "Praca Rastreavel",
          bairro: "Bairro Rastreavel",
          cidade: "Cidade Rastreavel",
          uf: "SP",
          estado: "Sao Paulo",
        },
      };
      const r = await get(`/v1/cep/${CEP}`, rh).expect(200);
      expect(r.body).toEqual({
        cep: CEP,
        logradouro: "Praca Rastreavel",
        bairro: "Bairro Rastreavel",
        cidade: "Cidade Rastreavel",
        uf: "SP",
        estado: "Sao Paulo",
      });

      const requestId = r.headers[REQUEST_ID_HEADER] as string;
      const fim = conclusao(requestId);
      expect(fim).toMatchObject({
        req: { method: "GET" },
        res: { statusCode: 200 },
        rota: "/v1/cep/:cep",
      });
      expect(typeof fim.responseTime).toBe("number");
      // A linha técnica do serviço segue, sem valor.
      expect(
        linhasDa(requestId).find((l) => l.evento === "cep.consulta"),
      ).toMatchObject({ fornecedor: "falso", resultado: "encontrado" });

      ausenteDoLog(
        CEP,
        "01001-000",
        "Praca Rastreavel",
        "Bairro Rastreavel",
        "Cidade Rastreavel",
      );
    });

    it.each([
      [404, "inexistente", { tipo: "inexistente" }],
      [503, "falha", { tipo: "indisponivel", motivo: "falha" }],
    ] as const)(
      "%s: status e padrão da rota no log, sem o CEP",
      async (status, resultado, proxima) => {
        fornecedor.proxima = proxima;
        const r = await get("/v1/cep/99999999", rh).expect(status);
        const requestId = r.headers[REQUEST_ID_HEADER] as string;
        expect(conclusao(requestId)).toMatchObject({
          req: { method: "GET" },
          res: { statusCode: status },
          rota: "/v1/cep/:cep",
        });
        expect(
          linhasDa(requestId).find((l) => l.evento === "cep.consulta"),
        ).toMatchObject({ resultado });
        ausenteDoLog("99999999");
      },
    );

    it("400 (CEP fora da forma): nem o valor recusado entra no log", async () => {
      const r = await get("/v1/cep/1234567x", rh).expect(400);
      expect(conclusao(r.headers[REQUEST_ID_HEADER] as string)).toMatchObject({
        res: { statusCode: 400 },
        rota: "/v1/cep/:cep",
      });
      ausenteDoLog("1234567x");
    });
  });

  describe("busca da listagem", () => {
    it("por nome: o colaborador é encontrado, e o termo fica fora do log", async () => {
      const r = await get(
        `/v1/colaboradores?busca=${encodeURIComponent("rastreavel sint")}`,
        rh,
      ).expect(200);
      expect(r.body.itens.map((c: { nome: string }) => c.nome)).toEqual([NOME]);
      expect(r.body.contadores).toEqual({ ativos: 0, inativos: 1 });

      const fim = conclusao(r.headers[REQUEST_ID_HEADER] as string);
      expect(fim).toMatchObject({
        req: { method: "GET" },
        res: { statusCode: 200 },
        rota: "/v1/colaboradores",
      });
      expect(typeof fim.responseTime).toBe("number");
      ausenteDoLog("rastreavel sint", "rastreavel+sint");
    });

    it("por matrícula: o colaborador é encontrado, e o termo fica fora do log", async () => {
      const r = await get(
        `/v1/colaboradores?busca=${encodeURIComponent("LOGX-77")}&pagina=1`,
        rh,
      ).expect(200);
      expect(
        r.body.itens.map(
          (c: { vinculos: { matricula: string }[] }) =>
            c.vinculos[0]!.matricula,
        ),
      ).toEqual([MATRICULA]);
      expect(conclusao(r.headers[REQUEST_ID_HEADER] as string)).toMatchObject({
        res: { statusCode: 200 },
        rota: "/v1/colaboradores",
      });
      ausenteDoLog("LOGX-77", "pagina=");
    });
  });

  describe("T196 — busca nas referências da lotação", () => {
    it("Departamento, Cargo, Unidade e Centro de custo: encontrados pela busca, e o termo fica fora do log", async () => {
      const empresaId = (await get("/v1/empresas", rh).expect(200)).body
        .itens[0].id as string;
      for (const [rota, codigo] of [
        ["/v1/departamentos", "LOGBUSCA_DEP"],
        ["/v1/cargos", "LOGBUSCA_CAR"],
        ["/v1/unidades-organizacionais", "LOGBUSCA_UNI"],
        ["/v1/centros-de-custo", "LOGBUSCA_CC"],
      ] as const) {
        await post(rota, rh)
          .send({ empresaId, codigo, nome: "Referencia Rastreavel Log" })
          .expect(201);
        const r = await get(
          `${rota}?busca=${encodeURIComponent("rastreavel log")}&status=ativo`,
          rh,
        ).expect(200);
        expect(r.body.itens.map((i: { codigo: string }) => i.codigo)).toEqual([
          codigo,
        ]);
        expect(conclusao(r.headers[REQUEST_ID_HEADER] as string)).toMatchObject(
          {
            req: { method: "GET" },
            res: { statusCode: 200 },
            rota,
          },
        );
      }
      ausenteDoLog("rastreavel log", "rastreavel+log", "busca=");
    });
  });

  describe("T197 — criação com código gerado no servidor", () => {
    it("Departamento, Cargo, Unidade e Centro de custo: nem o nome nem o código gerado vão para o log", async () => {
      const empresaId = (await get("/v1/empresas", rh).expect(200)).body
        .itens[0].id as string;
      for (const rota of [
        "/v1/departamentos",
        "/v1/cargos",
        "/v1/unidades-organizacionais",
        "/v1/centros-de-custo",
      ]) {
        const criada = await post(rota, rh)
          .send({ empresaId, nome: "Inline Rastreavel Log" })
          .expect(201);
        expect(criada.body.codigo).toBe("INLINE_RASTREAVEL_LOG");
        const repetida = await post(rota, rh)
          .send({ empresaId, nome: "inline rastreavel log" })
          .expect(409);
        expect(
          conclusao(repetida.headers[REQUEST_ID_HEADER] as string),
        ).toMatchObject({
          req: { method: "POST" },
          res: { statusCode: 409 },
          rota,
        });
      }
      ausenteDoLog("inline rastreavel log", "INLINE_RASTREAVEL_LOG");
    });
  });

  it("caminho inexistente: só o padrão genérico do Nest, e nada do caminho pedido", async () => {
    const r = await get(
      "/v1/caminho-inexistente/87654321?busca=Valor%20Secreto",
      rh,
    ).expect(404);
    expect(conclusao(r.headers[REQUEST_ID_HEADER] as string)).toMatchObject({
      req: { method: "GET" },
      res: { statusCode: 404 },
      // O 404 do Nest é atendido por uma rota curinga: o padrão, nunca o
      // caminho pedido.
      rota: "/*",
    });
    ausenteDoLog("caminho-inexistente", "87654321", "Valor Secreto");
  });

  describe("T179 — admissão e contatos com o log ligado", () => {
    // Valores SINTÉTICOS que não aparecem em nenhum outro lugar da suíte:
    // se surgirem no log, vieram destas requisições.
    const EMAIL_NOVO = "pessoa.rastreavel.log@example.test";
    const CELULAR_ENTRADA = "(11) 98765-1212";
    const CELULAR_GRAVADO = "+5511987651212";
    const TELEFONE_ENTRADA = "(11) 3232-1212";
    const TELEFONE_GRAVADO = "+551132321212";
    const CEP_ENTRADA = "04538-133";
    const CEP_GRAVADO = "04538133";
    const MATRICULA_NOVA = "MAT-LOGX-88";

    const valoresDaT179 = () => [
      MATRICULA,
      MATRICULA_NOVA,
      primeiraAdmissao.contatos.emailPessoal,
      EMAIL_NOVO,
      CELULAR_ENTRADA,
      CELULAR_GRAVADO,
      "5511987651212",
      "11987651212",
      TELEFONE_ENTRADA,
      TELEFONE_GRAVADO,
      "551132321212",
      "1132321212",
      CEP_ENTRADA,
      CEP_GRAVADO,
      CHAVE_CONFLITO,
      CHAVE_ADMISSAO,
    ];

    it("409 de duplicidade: só os nomes dos campos na resposta, e nenhum valor nem a chave no log", async () => {
      const r = await post("/v1/colaboradores", rh)
        .set("Idempotency-Key", CHAVE_CONFLITO)
        .send({
          ...corpoBase,
          nome: "Outra Pessoa Rastreavel",
          matricula: MATRICULA,
          perfilPessoal: { dataNascimento: "1991-03-04" },
          endereco: { pais: "Brasil", cep: CEP_ENTRADA },
          contatos: {
            emailPessoal: primeiraAdmissao.contatos.emailPessoal,
            celular: CELULAR_ENTRADA,
            telefone: TELEFONE_ENTRADA,
          },
        })
        .expect(409);
      expect(r.body.erros).toEqual([
        { campo: "matricula", motivo: "em_uso" },
        { campo: "contatos.emailPessoal", motivo: "em_uso" },
      ]);
      expect(Object.keys(r.body).sort()).toEqual(
        ["erros", "message", "request_id", "status_code", "timestamp"].sort(),
      );
      const corpo = JSON.stringify(r.body).toLowerCase();
      for (const valor of valoresDaT179()) {
        expect(corpo).not.toContain(valor.toLowerCase());
      }

      expect(conclusao(r.headers[REQUEST_ID_HEADER] as string)).toMatchObject({
        req: { method: "POST" },
        res: { statusCode: 409 },
        rota: "/v1/colaboradores",
      });
      ausenteDoLog(...valoresDaT179());
    });

    it("admissão com chave e o reenvio dela: a chave e os valores ficam fora do log", async () => {
      const corpo = {
        ...corpoBase,
        nome: "Pessoa Rastreavel Nova",
        matricula: MATRICULA_NOVA,
        perfilPessoal: { dataNascimento: "1991-03-04" },
        endereco: { pais: "Brasil", cep: CEP_ENTRADA },
        contatos: {
          emailPessoal: EMAIL_NOVO,
          celular: CELULAR_ENTRADA,
          telefone: TELEFONE_ENTRADA,
        },
      };
      const primeira = await post("/v1/colaboradores", rh)
        .set("Idempotency-Key", CHAVE_ADMISSAO)
        .send(corpo)
        .expect(201);
      expect(primeira.body.contatos).toMatchObject({
        celular: CELULAR_GRAVADO,
        telefone: TELEFONE_GRAVADO,
      });
      expect(primeira.body.endereco).toMatchObject({ cep: CEP_GRAVADO });
      const reenvio = await post("/v1/colaboradores", rh)
        .set("Idempotency-Key", CHAVE_ADMISSAO)
        .send(corpo)
        .expect(201);
      expect(reenvio.headers["idempotent-replayed"]).toBe("true");
      expect(reenvio.body.id).toBe(primeira.body.id);
      for (const r of [primeira, reenvio]) {
        expect(conclusao(r.headers[REQUEST_ID_HEADER] as string)).toMatchObject(
          {
            req: { method: "POST" },
            res: { statusCode: 201 },
            rota: "/v1/colaboradores",
          },
        );
      }
      ausenteDoLog(...valoresDaT179());
    });

    it("PUT de contatos — gravado e em conflito: nenhum valor no log, e o 409 só com o campo", async () => {
      const ok = await put(`/v1/colaboradores/${colaboradorId}/contatos`, rh)
        .send({
          emailPessoal: primeiraAdmissao.contatos.emailPessoal,
          celular: CELULAR_ENTRADA,
          telefone: TELEFONE_ENTRADA,
        })
        .expect(200);
      expect(ok.body.contatos).toMatchObject({
        celular: CELULAR_GRAVADO,
        telefone: TELEFONE_GRAVADO,
      });
      expect(conclusao(ok.headers[REQUEST_ID_HEADER] as string)).toMatchObject({
        req: { method: "PUT" },
        res: { statusCode: 200 },
        rota: "/v1/colaboradores/:colaboradorId/contatos",
      });

      const conflito = await put(
        `/v1/colaboradores/${colaboradorId}/contatos`,
        rh,
      )
        .send({
          emailPessoal: EMAIL_NOVO,
          celular: CELULAR_ENTRADA,
          telefone: TELEFONE_ENTRADA,
        })
        .expect(409);
      expect(conflito.body.erros).toEqual([
        { campo: "emailPessoal", motivo: "em_uso" },
      ]);
      expect(JSON.stringify(conflito.body).toLowerCase()).not.toContain(
        EMAIL_NOVO,
      );
      expect(
        conclusao(conflito.headers[REQUEST_ID_HEADER] as string),
      ).toMatchObject({
        req: { method: "PUT" },
        res: { statusCode: 409 },
        rota: "/v1/colaboradores/:colaboradorId/contatos",
      });
      ausenteDoLog(...valoresDaT179(), primeiraAdmissao.contatos.celular);
    });
  });

  it("nenhuma linha traz URL, query ou parâmetros", () => {
    for (const bruta of destino.linhas) {
      const linha = JSON.parse(bruta) as Linha;
      const req = linha.req as Record<string, unknown> | undefined;
      if (req) expect(Object.keys(req)).toEqual(["method"]);
      expect(bruta).not.toMatch(/"(url|originalUrl|query|params)"/);
    }
    ausenteDoLog(CEP, NOME, MATRICULA);
  });
});
