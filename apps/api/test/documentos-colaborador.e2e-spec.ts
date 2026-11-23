import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createServer, type AddressInfo, type Server } from "node:net";
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
import { ArmazenamentoEmMemoria } from "../src/pessoas/foto-colaborador/armazenamento-de-objetos";
import { ARMAZENAMENTO_DE_DOCUMENTOS } from "../src/pessoas/documentos-colaborador/armazenamento-de-documentos";
import {
  ASSINATURA_DE_TESTE_ANTIVIRUS,
  VERIFICADOR_DE_ARQUIVOS,
  VerificadorClamav,
  VerificadorFalso,
  escolherVerificadorDeArquivos,
  type VerificadorDeArquivos,
} from "../src/pessoas/documentos-colaborador/verificador-de-arquivos";
import { LIMPEZA_ENVIO_PARADO_MS } from "../src/pessoas/documentos-colaborador/documento-colaborador.service";
import {
  camposObrigatoriosAdmissao,
  lotacaoMinima,
} from "./admissao-obrigatoria";

/**
 * T213 — documentos do colaborador com arquivo (ADR 0021), PostgreSQL real
 * e efêmero (Testcontainers), migrations do zero. Armazenamento em memória e
 * antivírus falso: nenhum teste fala com o bucket nem com o ClamAV.
 *
 * Prova papéis, isolamento entre empresas, envio, download, troca, remoção
 * lógica, quarentena (aprovado, reprovado e falha do antivírus), formato,
 * tamanho, arquivo malformado, limites, idempotência, limpeza pendente e a
 * trilha sem conteúdo.
 *
 * **Todos os dados e arquivos são sintéticos.**
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
const SENHA_PADRAO = "Documentos!Pessoas#2026";

const CHAVE_DO_OBJETO =
  /^v1\/empresas\/[0-9a-f-]{36}\/colaboradores\/[0-9a-f-]{36}\/documentos\/[0-9a-f-]{36}\/[0-9a-f-]{36}$/;

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

let sequencia = 0;
/** PDF sintético mínimo e único (o conteúdo muda a cada chamada). */
function pdf(extra = ""): Buffer {
  sequencia += 1;
  return Buffer.from(
    `%PDF-1.4\n% sintetico ${sequencia} ${extra}\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n`,
    "latin1",
  );
}
function png(): Buffer {
  sequencia += 1;
  const corpo = Buffer.alloc(16, sequencia % 255);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    corpo,
    Buffer.from([0, 0, 0, 0, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]),
  ]);
}

describe("T213 — documentos do colaborador (e2e)", () => {
  let container: StartedTestContainer;
  let app: INestApplication;
  let prisma: PrismaClient;
  let appUrl: string;
  const armazenamento = new ArmazenamentoEmMemoria();
  const verificador = new VerificadorFalso();
  /**
   * T213 — o verificador em uso, trocável por teste: o falso (padrão), o
   * "sem ClamAV configurado" e um ClamAV real apontado para um servidor que
   * não responde ou para uma porta fechada.
   */
  let verificadorAtual: VerificadorDeArquivos = verificador;
  const verificadorDaApp: VerificadorDeArquivos = {
    verificar: (bytes) => verificadorAtual.verificar(bytes),
  };

  let master: Credencial;
  let rhA: Credencial;
  let dpA: Credencial;
  let rhB: Credencial;
  const negados = new Map<string, Credencial>();
  let empresaA: string;
  let empresaB: string;
  let colaboradorA: string;
  let colaboradorA2: string;
  let colaboradorB: string;

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

  const rota = (colaboradorId: string) =>
    `/v1/colaboradores/${colaboradorId}/documentos`;

  function enviar(
    cred: Credencial,
    colaboradorId: string,
    corpo: Buffer,
    opcoes: {
      categoria?: string;
      nome?: string;
      tipo?: string;
      extensao?: string;
      chave?: string;
      contentType?: string;
    } = {},
  ) {
    const req = post(rota(colaboradorId), cred)
      .set("Content-Type", opcoes.contentType ?? "application/octet-stream")
      .set("x-evolli-documento-categoria", opcoes.categoria ?? "rg")
      .set("x-evolli-documento-tipo", opcoes.tipo ?? "application/pdf")
      .set("x-evolli-documento-extensao", opcoes.extensao ?? "pdf");
    if (opcoes.nome !== undefined) {
      req.set("x-evolli-documento-nome", encodeURIComponent(opcoes.nome));
    }
    if (opcoes.chave) req.set("Idempotency-Key", opcoes.chave);
    return req.send(corpo);
  }

  function trocar(
    cred: Credencial,
    colaboradorId: string,
    documentoId: string,
    corpo: Buffer,
    chave?: string,
  ) {
    const req = post(`${rota(colaboradorId)}/${documentoId}/versoes`, cred)
      .set("Content-Type", "application/octet-stream")
      .set("x-evolli-documento-tipo", "application/pdf")
      .set("x-evolli-documento-extensao", "pdf");
    if (chave) req.set("Idempotency-Key", chave);
    return req.send(corpo);
  }

  const listar = (cred: Credencial, colaboradorId: string) =>
    agent().get(rota(colaboradorId)).set("Cookie", cred.cookie);

  const baixar = (
    cred: Credencial,
    colaboradorId: string,
    documentoId: string,
  ) =>
    agent()
      .get(`${rota(colaboradorId)}/${documentoId}/arquivo`)
      .set("Cookie", cred.cookie)
      .buffer(true)
      .parse((res, cb) => {
        const partes: Buffer[] = [];
        res.on("data", (c: Buffer) => partes.push(c));
        res.on("end", () => {
          const corpo = Buffer.concat(partes);
          // Erro vem em JSON; sucesso, em bytes.
          const json = /json/.test(String(res.headers["content-type"] ?? ""));
          cb(null, json ? JSON.parse(corpo.toString("utf8") || "{}") : corpo);
        });
      });

  const remover = (
    cred: Credencial,
    colaboradorId: string,
    documentoId: string,
  ) =>
    agent()
      .delete(`${rota(colaboradorId)}/${documentoId}`)
      .set("Cookie", cred.cookie)
      .set("x-csrf-token", cred.csrfToken);

  const verificarDeNovo = (
    cred: Credencial,
    colaboradorId: string,
    documentoId: string,
  ) => post(`${rota(colaboradorId)}/${documentoId}/verificacao`, cred);

  async function criarUsuario(
    email: string,
    role: string,
    companyId: string | null,
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

  async function admitir(
    cred: Credencial,
    nome: string,
    empresaId: string,
    departamentoId: string,
  ): Promise<string> {
    const r = await post("/v1/colaboradores", cred)
      .send({
        ...camposObrigatoriosAdmissao(),
        ...(await lotacaoMinima(appUrl, empresaId)),
        nome,
        empresaId,
        tipo: "clt",
        dataAdmissao: "2026-01-05",
        motivoCodigo: "admissao_inicial",
        departamentoId,
      })
      .expect(201);
    return r.body.id as string;
  }

  const eventos = (acao: string, documentoId: string) =>
    prisma.auditEvent.count({
      where: {
        // O Prisma usa o nome do enum (pontos viram sublinhados).
        action: acao.replace(/\./g, "_") as never,
        resource: "documento_colaborador",
        resourceId: documentoId,
      },
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
    })
      .overrideProvider(ARMAZENAMENTO_DE_DOCUMENTOS)
      .useValue(armazenamento)
      .overrideProvider(VERIFICADOR_DE_ARQUIVOS)
      .useValue(verificadorDaApp)
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

    master = await criarUsuario(
      "master.doc@example.test",
      "master_tecnico",
      null,
    );
    const empresa = async (codigo: string) =>
      (
        await post("/v1/empresas", master)
          .send({ codigo, nome: `Empresa ${codigo}` })
          .expect(201)
      ).body.id as string;
    empresaA = await empresa("DOCA");
    empresaB = await empresa("DOCB");
    const departamento = async (empresaId: string, codigo: string) =>
      (
        await post("/v1/departamentos", master)
          .send({ empresaId, codigo, nome: `Depto ${codigo}` })
          .expect(201)
      ).body.id as string;
    const depA = await departamento(empresaA, "DDA");
    const depB = await departamento(empresaB, "DDB");

    rhA = await criarUsuario("rh.doca@example.test", "rh", empresaA);
    dpA = await criarUsuario("dp.doca@example.test", "dp", empresaA);
    rhB = await criarUsuario("rh.docb@example.test", "rh", empresaB);
    for (const papel of [
      "gestor",
      "colaborador",
      "financeiro",
      "auditor",
      "dpo",
      "admin_tecnico",
    ]) {
      negados.set(
        papel,
        await criarUsuario(`${papel}.doca@example.test`, papel, empresaA),
      );
    }
    colaboradorA = await admitir(rhA, "Pessoa Documento Alfa", empresaA, depA);
    colaboradorA2 = await admitir(rhA, "Pessoa Documento Gama", empresaA, depA);
    colaboradorB = await admitir(rhB, "Pessoa Documento Beta", empresaB, depB);
  });

  afterAll(async () => {
    await app?.close();
    await prisma?.$disconnect();
    await container?.stop();
  });

  beforeEach(() => {
    armazenamento.falhar = () => false;
    verificador.falhar = false;
    verificadorAtual = verificador;
  });

  // -------------------------------------------------------------------------

  describe("envio, lista e download (RH e DP)", () => {
    it("RH envia um PDF: 201, aprovado pelo antivírus, chave só com ids internos", async () => {
      const corpo = pdf();
      const r = await enviar(rhA, colaboradorA, corpo).expect(201);
      expect(r.body).toEqual({
        id: expect.any(String),
        categoria: "rg",
        nome: null,
        estado: "aprovado",
        formato: "pdf",
        tamanhoBytes: corpo.length,
        versao: 1,
        enviadoEm: expect.any(String),
        verificadoEm: expect.any(String),
      });
      const versao = await prisma.versaoDocumentoColaborador.findFirstOrThrow({
        where: { documentoId: r.body.id },
      });
      expect(versao.chave).toMatch(CHAVE_DO_OBJETO);
      expect(versao.chave).toContain(empresaA);
      expect(armazenamento.objetos.get(versao.chave)?.corpo).toEqual(corpo);
      expect(
        await eventos("pessoas.documento_colaborador.enviado", r.body.id),
      ).toBe(1);
      expect(
        await eventos("pessoas.documento_colaborador.aprovado", r.body.id),
      ).toBe(1);
      expect(await prisma.limpezaDocumentoColaboradorPendente.count()).toBe(0);
    });

    it("DP envia um PNG de CPF e um PDF em Outros, com nome", async () => {
      await enviar(dpA, colaboradorA, png(), {
        categoria: "cpf",
        tipo: "image/png",
        extensao: "png",
      }).expect(201);
      const outros = await enviar(dpA, colaboradorA, pdf(), {
        categoria: "outros",
        nome: "Contrato de experiência",
      }).expect(201);
      expect(outros.body.nome).toBe("Contrato de experiência");
    });

    it("RH e DP baixam o aprovado: nome neutro, sem cache, nosniff, com trilha", async () => {
      const corpo = pdf();
      const { body } = await enviar(rhA, colaboradorA, corpo, {
        categoria: "comprovante_endereco",
      }).expect(201);
      for (const cred of [rhA, dpA]) {
        const r = await baixar(cred, colaboradorA, body.id).expect(200);
        expect(r.body).toEqual(corpo);
        expect(r.headers["content-type"]).toBe("application/pdf");
        expect(r.headers["content-disposition"]).toMatch(
          /^attachment; filename="comprovante-endereco-\d{4}-\d{2}-\d{2}\.pdf"$/,
        );
        expect(r.headers["cache-control"]).toBe("private, no-store");
        expect(r.headers["x-content-type-options"]).toBe("nosniff");
      }
      expect(
        await eventos("pessoas.documento_colaborador.baixado", body.id),
      ).toBe(2);
    });

    it("a lista traz só os não removidos, com estado e versão", async () => {
      const r = await listar(rhA, colaboradorA).expect(200);
      expect(r.body.length).toBeGreaterThanOrEqual(4);
      for (const item of r.body) {
        expect(Object.keys(item).sort()).toEqual(
          [
            "categoria",
            "enviadoEm",
            "estado",
            "formato",
            "id",
            "nome",
            "tamanhoBytes",
            "verificadoEm",
            "versao",
          ].sort(),
        );
      }
    });
  });

  describe("master_tecnico: só lista e estado", () => {
    let documentoId: string;

    beforeAll(async () => {
      documentoId = (
        await enviar(rhA, colaboradorA, pdf(), {
          categoria: "outros",
          nome: "Laudo sintético",
        }).expect(201)
      ).body.id;
    });

    it("sem empresa ativa: não vê (404)", async () => {
      await listar(master, colaboradorA).expect(404);
    });

    it("com empresa ativa: vê a lista e o estado, sem o nome de Outros", async () => {
      await post("/v1/auth/contexto/empresa", master)
        .send({ empresaId: empresaA })
        .expect(200);
      const r = await listar(master, colaboradorA).expect(200);
      const item = r.body.find((d: { id: string }) => d.id === documentoId);
      expect(item.estado).toBe("aprovado");
      expect(item.nome).toBeNull();
    });

    it("nunca baixa nem escreve", async () => {
      await baixar(master, colaboradorA, documentoId).expect(403);
      await enviar(master, colaboradorA, pdf()).expect(403);
      await remover(master, colaboradorA, documentoId).expect(403);
      await trocar(master, colaboradorA, documentoId, pdf()).expect(403);
    });
  });

  describe("demais papéis: recusados", () => {
    it.each([
      "gestor",
      "colaborador",
      "financeiro",
      "auditor",
      "dpo",
      "admin_tecnico",
    ])("%s não lista, não envia e não baixa (403)", async (papel) => {
      const cred = negados.get(papel)!;
      const { body } = await enviar(rhA, colaboradorA, pdf(), {
        categoria: "certidoes",
      }).expect(201);
      await listar(cred, colaboradorA).expect(403);
      await enviar(cred, colaboradorA, pdf()).expect(403);
      await baixar(cred, colaboradorA, body.id).expect(403);
      await remover(cred, colaboradorA, body.id).expect(403);
      await remover(rhA, colaboradorA, body.id).expect(204);
    });
  });

  describe("isolamento entre empresas", () => {
    it("RH de outra empresa: lista, envio, download e remoção respondem 404", async () => {
      const { body } = await enviar(rhA, colaboradorA, pdf(), {
        categoria: "carteira_trabalho",
      }).expect(201);
      const objetosAntes = armazenamento.objetos.size;
      await listar(rhB, colaboradorA).expect(404);
      await enviar(rhB, colaboradorA, pdf()).expect(404);
      await baixar(rhB, colaboradorA, body.id).expect(404);
      await remover(rhB, colaboradorA, body.id).expect(404);
      await trocar(rhB, colaboradorA, body.id, pdf()).expect(404);
      expect(armazenamento.objetos.size).toBe(objetosAntes);
    });

    it("documento de outro colaborador pela rota errada: 404", async () => {
      const { body } = await enviar(rhA, colaboradorA, pdf()).expect(201);
      await baixar(rhA, colaboradorA2, body.id).expect(404);
      await remover(rhA, colaboradorA2, body.id).expect(404);
      await baixar(rhB, colaboradorB, body.id).expect(404);
    });
  });

  describe("troca e remoção", () => {
    it("trocar cria a versão 2 e preserva a 1; o download é da nova", async () => {
      const original = pdf();
      const { body } = await enviar(rhA, colaboradorA2, original).expect(201);
      const nova = pdf("troca");
      const r = await trocar(rhA, colaboradorA2, body.id, nova).expect(201);
      expect(r.body.versao).toBe(2);
      expect(r.body.id).toBe(body.id);
      const versoes = await prisma.versaoDocumentoColaborador.findMany({
        where: { documentoId: body.id },
        orderBy: { numero: "asc" },
      });
      expect(versoes.map((v) => v.numero)).toEqual([1, 2]);
      expect(armazenamento.objetos.has(versoes[0]!.chave)).toBe(true);
      expect(
        (await baixar(dpA, colaboradorA2, body.id).expect(200)).body,
      ).toEqual(nova);
      expect(
        await eventos("pessoas.documento_colaborador.substituido", body.id),
      ).toBe(1);
    });

    it("remover é lógico: some da lista e do download; o objeto continua", async () => {
      const { body } = await enviar(dpA, colaboradorA2, pdf()).expect(201);
      const versao = await prisma.versaoDocumentoColaborador.findFirstOrThrow({
        where: { documentoId: body.id },
      });
      await remover(dpA, colaboradorA2, body.id).expect(204);
      const lista = await listar(rhA, colaboradorA2).expect(200);
      expect(lista.body.map((d: { id: string }) => d.id)).not.toContain(
        body.id,
      );
      await baixar(rhA, colaboradorA2, body.id).expect(404);
      await remover(rhA, colaboradorA2, body.id).expect(404);
      expect(armazenamento.objetos.has(versao.chave)).toBe(true);
      const linha = await prisma.documentoColaborador.findUniqueOrThrow({
        where: { id: body.id },
      });
      expect(linha.removidoEm).not.toBeNull();
      expect(
        await eventos("pessoas.documento_colaborador.removido", body.id),
      ).toBe(1);
    });
  });

  describe("trava: sem antivírus operante, nenhum envio é aceito", () => {
    /** Fotografia do que existe: R2, documentos, versões, limpezas e trilha. */
    const retrato = async () => ({
      objetos: armazenamento.objetos.size,
      documentos: await prisma.documentoColaborador.count(),
      versoes: await prisma.versaoDocumentoColaborador.count(),
      limpezas: await prisma.limpezaDocumentoColaboradorPendente.count(),
      trilha: await prisma.auditEvent.count({
        where: { resource: "documento_colaborador" },
      }),
    });

    let colaboradorTrava: string;
    /** Um clamd que aceita a conexão e nunca responde (tempo esgotado). */
    let mudo: Server;
    let portaMuda: number;
    beforeAll(async () => {
      const dep = await prisma.departamento.findFirstOrThrow({
        where: { empresaId: empresaA, codigo: "DDA" },
      });
      colaboradorTrava = await admitir(
        rhA,
        "Pessoa Documento Trava",
        empresaA,
        dep.id,
      );
      mudo = createServer((socket) => socket.on("data", () => undefined));
      await new Promise<void>((ok) => mudo.listen(0, "127.0.0.1", ok));
      portaMuda = (mudo.address() as AddressInfo).port;
    });
    afterAll(async () => {
      await new Promise<void>((ok) => mudo.close(() => ok()));
    });

    /** Uma porta que acabou de ser fechada: conexão recusada. */
    async function portaFechada(): Promise<number> {
      const s = createServer();
      await new Promise<void>((ok) => s.listen(0, "127.0.0.1", ok));
      const porta = (s.address() as AddressInfo).port;
      await new Promise<void>((ok) => s.close(() => ok()));
      return porta;
    }

    const cenarios: [string, () => Promise<VerificadorDeArquivos>][] = [
      ["ClamAV não configurado", async () => escolherVerificadorDeArquivos({})],
      [
        "ClamAV sem resposta (tempo esgotado)",
        async () =>
          new VerificadorClamav({
            host: "127.0.0.1",
            porta: portaMuda,
            tempoLimiteMs: 300,
          }),
      ],
      [
        "ClamAV recusando a conexão",
        async () =>
          new VerificadorClamav({
            host: "127.0.0.1",
            porta: await portaFechada(),
            tempoLimiteMs: 2_000,
          }),
      ],
      [
        "antivírus falhando",
        async () => {
          verificador.falhar = true;
          return verificador;
        },
      ],
    ];

    it.each(cenarios)(
      "%s: envio recusado com 503 acionável, antes de gravar no R2 ou no banco",
      async (_, montar) => {
        verificadorAtual = await montar();
        const antes = await retrato();
        const r = await enviar(rhA, colaboradorTrava, pdf()).expect(503);
        expect(r.body.codigo).toBe("documento_verificacao_indisponivel");
        // Nada de configuração interna na resposta.
        expect(JSON.stringify(r.body)).not.toMatch(
          /clam|127\.0\.0\.1|porta|host|instream/i,
        );
        expect(await retrato()).toEqual(antes);
      },
    );

    it.each(cenarios)(
      "%s: troca recusada com 503, sem versão nova e com a anterior intacta",
      async (_, montar) => {
        const { body } = await enviar(rhA, colaboradorTrava, pdf()).expect(201);
        verificadorAtual = await montar();
        const antes = await retrato();
        const r = await trocar(rhA, colaboradorTrava, body.id, pdf()).expect(
          503,
        );
        expect(r.body.codigo).toBe("documento_verificacao_indisponivel");
        expect(await retrato()).toEqual(antes);
        const lista = await listar(rhA, colaboradorTrava).expect(200);
        expect(
          lista.body.find((d: { id: string }) => d.id === body.id),
        ).toMatchObject({ versao: 1, estado: "aprovado" });
        await baixar(rhA, colaboradorTrava, body.id).expect(200);
      },
    );

    it("com o antivírus operante, o envio grava já com o resultado (aprovado), numa trilha só", async () => {
      const { body } = await enviar(rhA, colaboradorTrava, pdf(), {
        categoria: "cpf",
      }).expect(201);
      expect(body.estado).toBe("aprovado");
      expect(body.verificadoEm).toEqual(expect.any(String));
      const versao = await prisma.versaoDocumentoColaborador.findFirstOrThrow({
        where: { documentoId: body.id },
      });
      expect(versao.estado).toBe("aprovado");
      expect(
        await eventos("pessoas.documento_colaborador.enviado", body.id),
      ).toBe(1);
      expect(
        await eventos("pessoas.documento_colaborador.aprovado", body.id),
      ).toBe(1);
    });

    it("versão antiga ainda em verificação: a nova tentativa continua bloqueada sem antivírus e aprova quando ele volta", async () => {
      // Uma versão que ficou em verificação antes da trava (dado legado).
      const documentoId = randomUUID();
      const versaoId = randomUUID();
      const chave = `v1/empresas/${empresaA}/colaboradores/${colaboradorTrava}/documentos/${documentoId}/${versaoId}`;
      await armazenamento.gravar(chave, pdf(), "application/pdf");
      const autor = await prisma.accessUser.findFirstOrThrow({
        where: { email: "rh.doca@example.test" },
      });
      await prisma.documentoColaborador.create({
        data: {
          id: documentoId,
          empresaId: empresaA,
          colaboradorId: colaboradorTrava,
          categoria: "certidoes",
          criadoPorId: autor.id,
          versoes: {
            create: {
              id: versaoId,
              empresaId: empresaA,
              numero: 1,
              chave,
              formato: "pdf",
              tamanhoBytes: pdf().length,
              hashSha256: "a".repeat(64),
              enviadaPorId: autor.id,
            },
          },
        },
      });
      await baixar(rhA, colaboradorTrava, documentoId).expect(422);

      verificadorAtual = escolherVerificadorDeArquivos({});
      const ainda = await verificarDeNovo(
        rhA,
        colaboradorTrava,
        documentoId,
      ).expect(200);
      expect(ainda.body.estado).toBe("em_verificacao");
      expect(
        await eventos(
          "pessoas.documento_colaborador.nao_verificado",
          documentoId,
        ),
      ).toBe(1);

      verificadorAtual = verificador;
      const aprovado = await verificarDeNovo(
        dpA,
        colaboradorTrava,
        documentoId,
      ).expect(200);
      expect(aprovado.body.estado).toBe("aprovado");
      await baixar(rhA, colaboradorTrava, documentoId).expect(200);
    });
  });

  describe("quarentena", () => {
    it("ameaça encontrada: reprovado, nunca baixa, e a nova tentativa não muda", async () => {
      const { body } = await enviar(
        rhA,
        colaboradorA2,
        pdf(ASSINATURA_DE_TESTE_ANTIVIRUS),
      ).expect(201);
      expect(body.estado).toBe("reprovado");
      await baixar(rhA, colaboradorA2, body.id).expect(422);
      const r = await verificarDeNovo(rhA, colaboradorA2, body.id).expect(200);
      expect(r.body.estado).toBe("reprovado");
      expect(
        await eventos("pessoas.documento_colaborador.reprovado", body.id),
      ).toBe(1);
    });
  });

  describe("validação do arquivo (nada é guardado na recusa)", () => {
    const nadaGuardado = async (envio: () => Promise<unknown>) => {
      const objetos = armazenamento.objetos.size;
      const documentos = await prisma.documentoColaborador.count();
      const limpezas = await prisma.limpezaDocumentoColaboradorPendente.count();
      await envio();
      expect(armazenamento.objetos.size).toBe(objetos);
      expect(await prisma.documentoColaborador.count()).toBe(documentos);
      expect(await prisma.limpezaDocumentoColaboradorPendente.count()).toBe(
        limpezas,
      );
    };

    it.each([
      [
        "extensão diz PNG, conteúdo é PDF",
        { extensao: "png", tipo: "image/png" },
      ],
      ["tipo declarado diverge", { tipo: "image/png" }],
      ["extensão fora da lista", { extensao: "docx" }],
    ])("%s: 422 formato inválido", async (_, opcoes) => {
      await nadaGuardado(async () => {
        const r = await enviar(rhA, colaboradorA2, pdf(), opcoes).expect(422);
        expect(r.body.codigo).toBe("documento_formato_invalido");
      });
    });

    it("PDF cortado (sem fim de arquivo): 422 malformado", async () => {
      await nadaGuardado(async () => {
        const r = await enviar(
          rhA,
          colaboradorA2,
          pdf().subarray(0, 20),
        ).expect(422);
        expect(r.body.codigo).toBe("documento_arquivo_malformado");
      });
    });

    it("acima de 10 MB: 413", async () => {
      await nadaGuardado(async () => {
        await enviar(
          rhA,
          colaboradorA2,
          Buffer.concat([pdf(), Buffer.alloc(10 * 1024 * 1024)]),
        ).expect(413);
      });
    });

    it("corpo que não é octet-stream: 415", async () => {
      await nadaGuardado(async () => {
        await enviar(rhA, colaboradorA2, pdf(), {
          contentType: "application/json",
        }).expect(415);
      });
    });

    it.each([
      [
        "categoria desconhecida",
        { categoria: "passaporte" },
        "documento_categoria_invalida",
      ],
      [
        "Outros sem nome",
        { categoria: "outros" },
        "documento_nome_obrigatorio",
      ],
      [
        "nome em categoria fixa",
        { nome: "Meu RG" },
        "documento_nome_nao_permitido",
      ],
      [
        "nome longo",
        { categoria: "outros", nome: "x".repeat(61) },
        "documento_nome_invalido",
      ],
    ])("%s: 422", async (_, opcoes, codigo) => {
      await nadaGuardado(async () => {
        const r = await enviar(rhA, colaboradorA2, pdf(), opcoes).expect(422);
        expect(r.body.codigo).toBe(codigo);
      });
    });
  });

  describe("limites", () => {
    let colaboradorLimite: string;

    beforeAll(async () => {
      const dep = await prisma.departamento.findFirstOrThrow({
        where: { empresaId: empresaA, codigo: "DDA" },
      });
      colaboradorLimite = await admitir(
        rhA,
        "Pessoa Documento Limite",
        empresaA,
        dep.id,
      );
    });

    it("até 5 por categoria: o 6º é recusado", async () => {
      for (let i = 0; i < 5; i += 1) {
        await enviar(rhA, colaboradorLimite, pdf(), {
          categoria: "certidoes",
        }).expect(201);
      }
      const r = await enviar(rhA, colaboradorLimite, pdf(), {
        categoria: "certidoes",
      }).expect(422);
      expect(r.body.codigo).toBe("documento_limite_categoria");
    });

    it("até 30 por colaborador: o 31º é recusado", async () => {
      // Já há 5 (certidões); mais 25 direto no banco chegam a 30.
      const autor = await prisma.accessUser.findFirstOrThrow({
        where: { email: "rh.doca@example.test" },
      });
      await prisma.documentoColaborador.createMany({
        data: Array.from({ length: 25 }, (_, i) => ({
          empresaId: empresaA,
          colaboradorId: colaboradorLimite,
          categoria: "outros" as const,
          nomeOutros: `Sintético ${i}`,
          criadoPorId: autor.id,
        })),
      });
      const r = await enviar(rhA, colaboradorLimite, pdf()).expect(422);
      expect(r.body.codigo).toBe("documento_limite_colaborador");
    });
  });

  describe("idempotência", () => {
    it("mesma chave e mesmo arquivo: devolve o mesmo documento, sem criar outro", async () => {
      const chave = randomUUID();
      const corpo = pdf();
      const primeiro = await enviar(rhA, colaboradorA2, corpo, {
        categoria: "cpf",
        chave,
      }).expect(201);
      const documentos = await prisma.documentoColaborador.count();
      const objetos = armazenamento.objetos.size;
      const segundo = await enviar(rhA, colaboradorA2, corpo, {
        categoria: "cpf",
        chave,
      }).expect(200);
      expect(segundo.headers["idempotent-replayed"]).toBe("true");
      expect(segundo.body.id).toBe(primeiro.body.id);
      expect(await prisma.documentoColaborador.count()).toBe(documentos);
      expect(armazenamento.objetos.size).toBe(objetos);
    });

    it("mesma chave com outro arquivo: 422, nada criado", async () => {
      const chave = randomUUID();
      await enviar(rhA, colaboradorA2, pdf(), { chave }).expect(201);
      const r = await enviar(rhA, colaboradorA2, pdf(), { chave }).expect(422);
      expect(r.body.codigo).toBe("idempotencia_conteudo_divergente");
    });

    it("troca com a mesma chave: uma versão só", async () => {
      const { body } = await enviar(rhA, colaboradorA2, pdf()).expect(201);
      const chave = randomUUID();
      const corpo = pdf("troca idempotente");
      await trocar(rhA, colaboradorA2, body.id, corpo, chave).expect(201);
      const r = await trocar(rhA, colaboradorA2, body.id, corpo, chave).expect(
        200,
      );
      expect(r.headers["idempotent-replayed"]).toBe("true");
      expect(
        await prisma.versaoDocumentoColaborador.count({
          where: { documentoId: body.id },
        }),
      ).toBe(2);
    });
  });

  describe("limpeza pendente", () => {
    let colaboradorLimpeza: string;

    beforeAll(async () => {
      const dep = await prisma.departamento.findFirstOrThrow({
        where: { empresaId: empresaA, codigo: "DDA" },
      });
      colaboradorLimpeza = await admitir(
        rhA,
        "Pessoa Documento Limpeza",
        empresaA,
        dep.id,
      );
    });

    it("R2 falha ao gravar: 503, nada registrado, nada sobra", async () => {
      armazenamento.falhar = (operacao) => operacao === "gravar";
      const documentos = await prisma.documentoColaborador.count();
      await enviar(rhA, colaboradorLimpeza, pdf()).expect(503);
      expect(await prisma.documentoColaborador.count()).toBe(documentos);
      expect(await prisma.limpezaDocumentoColaboradorPendente.count()).toBe(0);
    });

    it("R2 falha ao gravar e ao apagar: fica a limpeza pendente, apagada na próxima operação", async () => {
      armazenamento.falhar = (operacao) =>
        operacao === "gravar" || operacao === "apagar";
      await enviar(rhA, colaboradorLimpeza, pdf()).expect(503);
      const pendentes =
        await prisma.limpezaDocumentoColaboradorPendente.findMany();
      expect(pendentes).toHaveLength(1);
      expect(pendentes[0]!.motivo).toBe("falha_no_envio");
      expect(pendentes[0]!.chave).toMatch(CHAVE_DO_OBJETO);

      armazenamento.falhar = () => false;
      await enviar(rhA, colaboradorLimpeza, pdf()).expect(201);
      expect(await prisma.limpezaDocumentoColaboradorPendente.count()).toBe(0);
    });

    it("envio parado há mais de 15 minutos sem registro: o objeto é apagado", async () => {
      const chave = `v1/empresas/${empresaA}/colaboradores/${colaboradorLimpeza}/documentos/${randomUUID()}/${randomUUID()}`;
      await armazenamento.gravar(chave, pdf(), "application/pdf");
      await prisma.limpezaDocumentoColaboradorPendente.create({
        data: {
          chave,
          motivo: "envio_em_andamento",
          empresaId: empresaA,
          colaboradorId: colaboradorLimpeza,
          criadoEm: new Date(Date.now() - LIMPEZA_ENVIO_PARADO_MS - 60_000),
        },
      });
      // Um envio recente (ainda gravando) não é tocado.
      const recente = `v1/empresas/${empresaA}/colaboradores/${colaboradorLimpeza}/documentos/${randomUUID()}/${randomUUID()}`;
      await armazenamento.gravar(recente, pdf(), "application/pdf");
      await prisma.limpezaDocumentoColaboradorPendente.create({
        data: {
          chave: recente,
          motivo: "envio_em_andamento",
          empresaId: empresaA,
          colaboradorId: colaboradorLimpeza,
        },
      });

      await enviar(rhA, colaboradorLimpeza, pdf()).expect(201);
      expect(armazenamento.objetos.has(chave)).toBe(false);
      expect(armazenamento.objetos.has(recente)).toBe(true);
      expect(
        await prisma.limpezaDocumentoColaboradorPendente.findMany({
          select: { chave: true },
        }),
      ).toEqual([{ chave: recente }]);
      await prisma.limpezaDocumentoColaboradorPendente.deleteMany();
    });
  });

  describe("banco: remoção só lógica", () => {
    it("o usuário da aplicação não apaga documento nem versão; a remoção lógica e a limpeza continuam", async () => {
      const { body } = await enviar(rhA, colaboradorA, pdf(), {
        categoria: "outros",
        nome: "Documento para remoção",
      }).expect(201);
      // O PrismaClient do teste conecta como evolli_app, o mesmo da API.
      await expect(
        prisma.versaoDocumentoColaborador.deleteMany({
          where: { documentoId: body.id },
        }),
      ).rejects.toThrow(/permission denied|42501/i);
      await expect(
        prisma.documentoColaborador.deleteMany({ where: { id: body.id } }),
      ).rejects.toThrow(/permission denied|42501/i);
      expect(
        await prisma.versaoDocumentoColaborador.count({
          where: { documentoId: body.id },
        }),
      ).toBe(1);

      // Remoção lógica (UPDATE) segue funcionando.
      await remover(rhA, colaboradorA, body.id).expect(204);
      const linha = await prisma.documentoColaborador.findUniqueOrThrow({
        where: { id: body.id },
      });
      expect(linha.removidoEm).not.toBeNull();

      // A limpeza pendente continua podendo apagar a própria fila.
      await prisma.limpezaDocumentoColaboradorPendente.create({
        data: {
          chave: `v1/empresas/${empresaA}/colaboradores/${colaboradorA}/documentos/${randomUUID()}/${randomUUID()}`,
          motivo: "falha_no_envio",
          empresaId: empresaA,
          colaboradorId: colaboradorA,
        },
      });
      await prisma.limpezaDocumentoColaboradorPendente.deleteMany();
      expect(await prisma.limpezaDocumentoColaboradorPendente.count()).toBe(0);
    });
  });

  describe("auditoria sem conteúdo", () => {
    it("os eventos do documento não carregam nome, categoria, chave nem tamanho", async () => {
      const { body } = await enviar(rhA, colaboradorA2, pdf(), {
        categoria: "outros",
        nome: "Nome Sintético Secreto",
      }).expect(201);
      const versao = await prisma.versaoDocumentoColaborador.findFirstOrThrow({
        where: { documentoId: body.id },
      });
      const todos = await prisma.auditEvent.findMany({
        where: { resource: "documento_colaborador", resourceId: body.id },
      });
      expect(todos.length).toBeGreaterThanOrEqual(2);
      const texto = JSON.stringify(todos);
      expect(texto).not.toContain("Nome Sintético Secreto");
      expect(texto).not.toContain(versao.chave);
      expect(texto).not.toContain(versao.hashSha256);
      expect(texto).not.toContain("outros");
    });
  });
});
