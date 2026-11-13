/**
 * T208 — Configurações › Meu perfil: foto de perfil da própria conta
 * (ADR 0018; e2e, PostgreSQL real e efêmero via Testcontainers; imagens
 * sintéticas geradas no próprio teste).
 *
 * O que esta suíte prova, sobre o banco de verdade:
 *
 * - a migration bate com o schema, e a CHECK do banco só aceita JPEG;
 * - todo papel envia a PRÓPRIA foto; o servidor grava uma imagem nova
 *   (JPEG 256 × 256, sem metadados), nunca o arquivo enviado;
 * - o arquivo é julgado pelo conteúdo: formato, tamanho (5 MB), lado mínimo,
 *   teto de pixels (imagem-bomba) e arquivo malformado; o MIME declarado não
 *   decide nada;
 * - leitura privada, só da titular, com cabeçalhos de imagem privada; não há
 *   rota para a foto de outra conta;
 * - concorrência pela versão do perfil (409 sem sobrescrever);
 * - remover e desativar apagam os bytes; auditoria sem dado da imagem;
 * - a foto é da conta (sobrevive à troca de empresa) e não entra na
 *   listagem de Contas de acesso.
 */
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
import sharp from "sharp";

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
const TS_NODE_REGISTER = require.resolve("ts-node/register/transpile-only");

const ADMIN_USER = "admin_test";
const ADMIN_PASSWORD = "admin_test_pw";
const ADMIN_DB = "evolli_test";
const MIGRATOR_PASSWORD = "migrator_test_pw";
const APP_PASSWORD = "app_test_pw";

const SENHA_PADRAO = "Foto!Perfil2026#Teste";

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

function runBootstrap(env: Record<string, string>): { status: number } {
  try {
    execFileSync(
      process.execPath,
      [
        "-r",
        TS_NODE_REGISTER,
        join(API_ROOT, "src/bootstrap/bootstrap-admin.ts"),
      ],
      { cwd: API_ROOT, env: { ...process.env, ...env }, stdio: "pipe" },
    );
    return { status: 0 };
  } catch (error) {
    return { status: (error as { status: number }).status };
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
  email: string;
  cookie: string;
  csrfToken: string;
}

describe("T208 — Meu perfil: foto de perfil da própria conta (e2e)", () => {
  let container: StartedTestContainer;
  let appUrl: string;
  let migratorUrl: string;
  let app: INestApplication;
  let prisma: PrismaClient;

  let master: Credencial;
  let empresaA: string;
  let empresaB: string;
  /** Uma credencial por papel conhecido. */
  const porPapel: Record<string, Credencial> = {};

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
    return { email, cookie, csrfToken: response.body.csrfToken };
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

  async function lerMe(cred: Credencial) {
    return (await get("/v1/users/me", cred).expect(200)).body as {
      id: string;
      email: string;
      role: string;
      companyId: string | null;
      nomeExibicao: string | null;
      perfilAtualizadoEm: string | null;
      fotoVersao: string | null;
    };
  }

  async function conta(email: string) {
    return prisma.accessUser.findUniqueOrThrow({ where: { email } });
  }

  async function criarUsuario(
    email: string,
    role: string,
    companyId: string | undefined,
  ): Promise<Credencial> {
    await post("/v1/users", master)
      .send({
        email,
        password: SENHA_PADRAO,
        role,
        ...(companyId ? { companyId } : {}),
      })
      .expect(201);
    return login(email, SENHA_PADRAO);
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
    app = await buildApp();
    prisma = new PrismaClient({ datasources: { db: { url: appUrl } } });

    expect(
      runBootstrap({
        DATABASE_URL: appUrl,
        ADMIN_BOOTSTRAP_EMAIL: "admin.foto@example.test",
        ADMIN_BOOTSTRAP_PASSWORD: SENHA_PADRAO,
      }).status,
    ).toBe(0);
    porPapel.admin_tecnico = await login(
      "admin.foto@example.test",
      SENHA_PADRAO,
    );

    const { PasswordHashService } =
      await import("../src/auth/password/password-hash.service");
    const passwordHash = await new PasswordHashService().hash(SENHA_PADRAO);
    await prisma.accessUser.create({
      data: {
        email: "master.foto@example.test",
        passwordHash,
        role: "master_tecnico",
        status: "active",
      },
    });
    master = await login("master.foto@example.test", SENHA_PADRAO);
    porPapel.master_tecnico = master;

    empresaA = (
      await post("/v1/empresas", master)
        .send({ codigo: "FOTOA", nome: "Empresa Foto A" })
        .expect(201)
    ).body.id;
    empresaB = (
      await post("/v1/empresas", master)
        .send({ codigo: "FOTOB", nome: "Empresa Foto B" })
        .expect(201)
    ).body.id;

    for (const papel of ["rh", "dp", "gestor", "financeiro", "colaborador"]) {
      porPapel[papel] = await criarUsuario(
        `${papel}.foto@example.test`,
        papel,
        empresaA,
      );
    }
    // `auditor` e `dpo` não são provisionáveis por rota (ADR 0012): as contas
    // legadas existem só no banco, então entram por ele — como o master.
    for (const papel of ["auditor", "dpo"] as const) {
      await prisma.accessUser.create({
        data: {
          email: `${papel}.foto@example.test`,
          passwordHash,
          role: papel,
          companyId: empresaA,
          status: "active",
        },
      });
      porPapel[papel] = await login(`${papel}.foto@example.test`, SENHA_PADRAO);
    }
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    await app?.close();
    await container?.stop();
  });

  // --- foto: auxiliares --------------------------------------------------

  /** Imagem sintética de cor sólida. */
  function imagem(
    largura: number,
    altura: number,
    formato: "jpeg" | "png" | "webp" | "gif",
    cor: { r: number; g: number; b: number } = { r: 30, g: 140, b: 90 },
  ): Promise<Buffer> {
    return sharp({
      create: {
        width: largura,
        height: altura,
        channels: 3,
        background: cor,
      },
    })
      .toFormat(formato)
      .toBuffer();
  }

  /** CRC-32 dos chunks PNG. */
  function crc32(dados: Buffer): number {
    let crc = 0xffffffff;
    for (const byte of dados) {
      crc ^= byte;
      for (let k = 0; k < 8; k++)
        crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  /** Imagem-bomba: PNG minúsculo cujo cabeçalho declara `l × a`. */
  async function bomba(largura: number, altura: number) {
    const png = Buffer.from(await imagem(200, 200, "png"));
    png.writeUInt32BE(largura, 16);
    png.writeUInt32BE(altura, 20);
    png.writeUInt32BE(crc32(png.subarray(12, 29)), 29);
    return png;
  }

  function versaoHeader(perfilAtualizadoEm: string | null) {
    return perfilAtualizadoEm ?? "nenhuma";
  }

  /** Envia `bytes` como a própria foto, a partir da versão atual. */
  async function enviarFoto(
    cred: Credencial,
    bytes: Buffer,
    opcoes: { tipo?: string; versao?: string | null } = {},
  ) {
    const versao =
      opcoes.versao === undefined
        ? versaoHeader((await lerMe(cred)).perfilAtualizadoEm)
        : versaoHeader(opcoes.versao);
    return agent()
      .put("/v1/users/me/foto")
      .set("Cookie", cred.cookie)
      .set("x-csrf-token", cred.csrfToken)
      .set("x-evolli-perfil-versao", versao)
      .set("Content-Type", opcoes.tipo ?? "application/octet-stream")
      .send(bytes);
  }

  async function removerFoto(cred: Credencial, versao?: string | null) {
    const v =
      versao === undefined
        ? versaoHeader((await lerMe(cred)).perfilAtualizadoEm)
        : versaoHeader(versao);
    return agent()
      .delete("/v1/users/me/foto")
      .set("Cookie", cred.cookie)
      .set("x-csrf-token", cred.csrfToken)
      .set("x-evolli-perfil-versao", v);
  }

  function lerFoto(cred: Credencial) {
    return agent()
      .get("/v1/users/me/foto")
      .set("Cookie", cred.cookie)
      .buffer(true)
      .parse((res, callback) => {
        const partes: Buffer[] = [];
        res.on("data", (parte: Buffer) => partes.push(parte));
        res.on("end", () => callback(null, Buffer.concat(partes)));
      });
  }

  /** Espera a resposta e confere o status. */
  async function comStatus(
    pedido: Promise<request.Response>,
    status: number,
  ): Promise<request.Response> {
    const resposta = await pedido;
    expect(resposta.status).toBe(status);
    return resposta;
  }

  async function fotoNoBanco(email: string) {
    const { id } = await conta(email);
    return prisma.accessUserFoto.findUnique({ where: { userId: id } });
  }

  // -------------------------------------------------------------------------
  describe("1. migration e banco", () => {
    it("o banco migrado não difere do schema (a migration bate com o schema.prisma)", () => {
      const saida = execFileSync(
        process.execPath,
        [
          PRISMA_CLI,
          "migrate",
          "diff",
          "--from-url",
          migratorUrl,
          "--to-schema-datamodel",
          "prisma/schema.prisma",
          "--exit-code",
        ],
        {
          cwd: API_ROOT,
          env: {
            ...process.env,
            DATABASE_URL: migratorUrl,
            MIGRATE_DATABASE_URL: migratorUrl,
          },
          stdio: "pipe",
          encoding: "utf8",
        },
      );
      expect(saida).toContain("No difference detected");
    });

    it("contas existentes ficam sem foto (nada inventado)", async () => {
      expect(await prisma.accessUserFoto.count()).toBe(0);
      expect((await lerMe(porPapel.rh!)).fotoVersao).toBeNull();
    });

    it("a CHECK do banco recusa bytes que não são JPEG", async () => {
      const { id } = await conta("dp.foto@example.test");
      await expect(
        prisma.accessUserFoto.create({
          data: {
            userId: id,
            conteudo: Buffer.from("<svg/>"),
            gravadaEm: new Date(),
          },
        }),
      ).rejects.toThrow();
      expect(await fotoNoBanco("dp.foto@example.test")).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  describe("2. enviar, ler e substituir a própria foto", () => {
    it.each([
      "rh",
      "dp",
      "master_tecnico",
      "gestor",
      "financeiro",
      "colaborador",
      "auditor",
      "dpo",
      "admin_tecnico",
    ])(
      "%s: envia; o servidor grava um JPEG 256 × 256 novo; a versão volta no ator; auditoria sem dado da imagem",
      async (papel) => {
        const cred = porPapel[papel]!;
        const enviado = await imagem(640, 480, "png");
        const r = await comStatus(enviarFoto(cred, enviado), 200);
        expect(r.body.fotoVersao).toEqual(expect.any(String));
        expect(r.body.perfilAtualizadoEm).toBe(r.body.fotoVersao);
        expect(JSON.stringify(r.body)).not.toMatch(/conteudo|base64/i);

        const gravada = await fotoNoBanco(cred.email);
        const meta = await sharp(Buffer.from(gravada!.conteudo)).metadata();
        expect(meta.format).toBe("jpeg");
        expect([meta.width, meta.height]).toEqual([256, 256]);
        expect(Buffer.from(gravada!.conteudo).equals(enviado)).toBe(false);

        const { id } = await conta(cred.email);
        const eventos = await prisma.auditEvent.findMany({
          where: { action: "conta_foto_enviada", actorUserId: id },
        });
        expect(eventos).toHaveLength(1);
        expect(eventos[0]).toMatchObject({
          resource: "access_user",
          resourceId: id,
          actorRole: papel,
          result: "success",
        });
      },
    );

    it("leitura privada: só a titular, com cabeçalhos de imagem privada", async () => {
      const r = await lerFoto(porPapel.colaborador!).expect(200);
      expect(r.headers["content-type"]).toBe("image/jpeg");
      expect(r.headers["cache-control"]).toBe("no-store");
      expect(r.headers["x-content-type-options"]).toBe("nosniff");
      expect(r.headers["content-disposition"]).toBe("inline");
      expect(r.headers["content-security-policy"]).toBe(
        "default-src 'none'; sandbox",
      );
      const meta = await sharp(r.body as Buffer).metadata();
      expect([meta.format, meta.width, meta.height]).toEqual([
        "jpeg",
        256,
        256,
      ]);
    });

    it("metadados do arquivo enviado não chegam à foto lida", async () => {
      const cred = porPapel.gestor!;
      const comMetadados = await sharp(await imagem(500, 500, "jpeg"))
        .withExif({ IFD0: { Copyright: "Dado Particular" } })
        .jpeg()
        .toBuffer();
      await comStatus(enviarFoto(cred, comMetadados), 200);
      const lida = (await lerFoto(cred).expect(200)).body as Buffer;
      expect((await sharp(lida).metadata()).exif).toBeUndefined();
      expect(lida.includes(Buffer.from("Dado Particular"))).toBe(false);
    });

    it("substituir troca os bytes e a versão", async () => {
      const cred = porPapel.financeiro!;
      const antes = await lerMe(cred);
      const bytesAntes = Buffer.from((await fotoNoBanco(cred.email))!.conteudo);
      const r = await comStatus(
        enviarFoto(cred, await imagem(300, 900, "webp")),
        200,
      );
      expect(r.body.fotoVersao).not.toBe(antes.fotoVersao);
      const bytesDepois = Buffer.from(
        (await fotoNoBanco(cred.email))!.conteudo,
      );
      expect(bytesDepois.equals(bytesAntes)).toBe(false);
      expect(
        await prisma.accessUserFoto.count({
          where: { userId: (await conta(cred.email)).id },
        }),
      ).toBe(1);
    });

    it("sem foto, a leitura responde 404", async () => {
      const email = "sem.foto@example.test";
      const cred = await criarUsuario(email, "colaborador", empresaA);
      await lerFoto(cred).expect(404);
    });
  });

  // -------------------------------------------------------------------------
  describe("3. o arquivo é julgado pelo conteúdo", () => {
    const EMAIL = "tentativas.foto@example.test";
    let cred: Credencial;
    beforeAll(async () => {
      cred = await criarUsuario(EMAIL, "colaborador", empresaA);
    });
    const tentar = (bytes: Buffer, tipo?: string) =>
      enviarFoto(cred, bytes, tipo ? { tipo } : {});

    it("GIF, SVG e HTML são recusados (422 foto_formato_invalido), mesmo que o nome diga .jpg", async () => {
      for (const bytes of [
        await imagem(300, 300, "gif"),
        Buffer.from(
          "<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>",
        ),
        Buffer.from("<html><body>foto.jpg</body></html>"),
      ]) {
        const r = await comStatus(tentar(bytes), 422);
        expect(r.body.codigo).toBe("foto_formato_invalido");
      }
      expect(await fotoNoBanco(EMAIL)).toBeNull();
    });

    it("tipo declarado diferente de octet-stream é recusado (415): o servidor não confia no MIME", async () => {
      await comStatus(tentar(await imagem(300, 300, "png"), "image/png"), 415);
      await comStatus(tentar(await imagem(300, 300, "png"), "image/jpeg"), 415);
    });

    it("acima de 5 MB: 413, antes de processar", async () => {
      const grande = Buffer.alloc(5 * 1024 * 1024 + 1, 0);
      grande.set([0xff, 0xd8, 0xff]);
      const r = await tentar(grande);
      expect(r.status).toBe(413);
    });

    it("imagem pequena (menor lado < 128 px): 422 foto_pequena", async () => {
      const r = await comStatus(tentar(await imagem(127, 300, "jpeg")), 422);
      expect(r.body.codigo).toBe("foto_pequena");
    });

    it("imagem-bomba (30 milhões de pixels num arquivo minúsculo): 422 foto_grande_demais", async () => {
      const r = await comStatus(tentar(await bomba(6000, 5000)), 422);
      expect(r.body.codigo).toBe("foto_grande_demais");
    });

    it("arquivo malformado ou truncado: 422 foto_invalida", async () => {
      const jpeg = await imagem(400, 400, "jpeg");
      for (const bytes of [
        jpeg.subarray(0, Math.floor(jpeg.length / 2)),
        Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(400, 9)]),
      ]) {
        const r = await comStatus(tentar(bytes), 422);
        expect(r.body.codigo).toBe("foto_invalida");
      }
      expect(await fotoNoBanco(EMAIL)).toBeNull();
    });

    it("nenhuma recusa ecoa o arquivo nem detalhe interno", async () => {
      const r = await comStatus(
        tentar(Buffer.from("<html>segredo-do-arquivo</html>")),
        422,
      );
      expect(JSON.stringify(r.body)).not.toContain("segredo-do-arquivo");
    });
  });

  // -------------------------------------------------------------------------
  describe("4. só a própria conta", () => {
    it("não existe rota para a foto de outra conta (404)", async () => {
      const outra = await conta("colaborador.foto@example.test");
      await agent()
        .get(`/v1/users/${outra.id}/foto`)
        .set("Cookie", porPapel.rh!.cookie)
        .expect(404);
      await agent()
        .put(`/v1/users/${outra.id}/foto`)
        .set("Cookie", porPapel.rh!.cookie)
        .set("x-csrf-token", porPapel.rh!.csrfToken)
        .set("x-evolli-perfil-versao", "nenhuma")
        .set("Content-Type", "application/octet-stream")
        .send(await imagem(300, 300, "jpeg"))
        .expect(404);
    });

    it("cada conta lê só a própria foto: a do RH não é a do colaborador", async () => {
      await comStatus(
        enviarFoto(
          porPapel.colaborador!,
          await imagem(300, 300, "jpeg", { r: 200, g: 20, b: 20 }),
        ),
        200,
      );
      const doRh = (await lerFoto(porPapel.rh!).expect(200)).body as Buffer;
      const doColaborador = (await lerFoto(porPapel.colaborador!).expect(200))
        .body as Buffer;
      expect(
        doRh.equals(
          Buffer.from((await fotoNoBanco("rh.foto@example.test"))!.conteudo),
        ),
      ).toBe(true);
      expect(doColaborador.equals(doRh)).toBe(false);
    });

    it("sem sessão: 401 na leitura e no envio; sem CSRF: 403", async () => {
      await agent().get("/v1/users/me/foto").expect(401);
      await agent()
        .put("/v1/users/me/foto")
        .set("Content-Type", "application/octet-stream")
        .send(await imagem(300, 300, "jpeg"))
        .expect(401);
      await agent()
        .put("/v1/users/me/foto")
        .set("Cookie", porPapel.rh!.cookie)
        .set("x-evolli-perfil-versao", "nenhuma")
        .set("Content-Type", "application/octet-stream")
        .send(await imagem(300, 300, "jpeg"))
        .expect(403);
      await agent()
        .delete("/v1/users/me/foto")
        .set("Cookie", porPapel.rh!.cookie)
        .set("x-evolli-perfil-versao", "nenhuma")
        .expect(403);
    });

    it("versão ausente ou malformada: 400", async () => {
      await agent()
        .put("/v1/users/me/foto")
        .set("Cookie", porPapel.rh!.cookie)
        .set("x-csrf-token", porPapel.rh!.csrfToken)
        .set("Content-Type", "application/octet-stream")
        .send(await imagem(300, 300, "jpeg"))
        .expect(400);
      await comStatus(
        enviarFoto(porPapel.rh!, await imagem(300, 300, "jpeg"), {
          versao: "ontem",
        }),
        400,
      );
    });

    it("a listagem de Contas de acesso não traz foto nem versão", async () => {
      const r = await get("/v1/users?limit=100", master).expect(200);
      for (const item of r.body.items) {
        expect(item).not.toHaveProperty("fotoVersao");
      }
    });
  });

  // -------------------------------------------------------------------------
  describe("5. concorrência", () => {
    it("versão velha (outra sessão mexeu no perfil): 409 e a foto gravada fica", async () => {
      const email = "rh.foto@example.test";
      const outraSessao = await login(email, SENHA_PADRAO);
      const lida = (await lerMe(porPapel.rh!)).perfilAtualizadoEm;
      await comStatus(
        enviarFoto(outraSessao, await imagem(300, 300, "webp"), {
          versao: lida,
        }),
        200,
      );
      const gravada = Buffer.from((await fotoNoBanco(email))!.conteudo);

      const r = await enviarFoto(porPapel.rh!, await imagem(300, 300, "png"), {
        versao: lida,
      });
      expect(r.status).toBe(409);
      expect(
        Buffer.from((await fotoNoBanco(email))!.conteudo).equals(gravada),
      ).toBe(true);
      await comStatus(removerFoto(porPapel.rh!, lida), 409);
      expect(await fotoNoBanco(email)).not.toBeNull();
    });

    it("foto e nome compartilham a versão do perfil: salvar o nome depois da foto exige a versão nova", async () => {
      const cred = porPapel.auditor!;
      const antes = (await lerMe(cred)).perfilAtualizadoEm;
      await comStatus(enviarFoto(cred, await imagem(300, 300, "jpeg")), 200);
      await patch("/v1/users/me", cred)
        .send({
          nomeExibicao: "Nome Depois Da Foto",
          perfilAtualizadoEmLido: antes,
        })
        .expect(409);
    });
  });

  // -------------------------------------------------------------------------
  describe("6. remover e desativar apagam os bytes", () => {
    it("remover: bytes apagados, leitura 404, versão nula no ator; auditoria sem dado da imagem", async () => {
      const cred = porPapel.colaborador!;
      const r = await comStatus(removerFoto(cred), 200);
      expect(r.body.fotoVersao).toBeNull();
      expect(await fotoNoBanco(cred.email)).toBeNull();
      await lerFoto(cred).expect(404);
      const { id } = await conta(cred.email);
      const eventos = await prisma.auditEvent.findMany({
        where: { action: "conta_foto_removida", actorUserId: id },
      });
      expect(eventos).toHaveLength(1);
      expect(eventos[0]).toMatchObject({ resourceId: id, result: "success" });
    });

    it("remover sem foto: 404, e a versão do perfil não muda", async () => {
      const cred = porPapel.colaborador!;
      const antes = (await lerMe(cred)).perfilAtualizadoEm;
      await comStatus(removerFoto(cred), 404);
      expect((await lerMe(cred)).perfilAtualizadoEm).toBe(antes);
    });

    it("desativar a conta apaga a foto e registra a remoção", async () => {
      const email = "desativada.foto@example.test";
      const cred = await criarUsuario(email, "colaborador", empresaA);
      await comStatus(enviarFoto(cred, await imagem(300, 300, "jpeg")), 200);
      const { id } = await conta(email);
      expect(await fotoNoBanco(email)).not.toBeNull();

      await post(`/v1/users/${id}/disable`, porPapel.rh!).expect(204);
      expect(await fotoNoBanco(email)).toBeNull();
      const eventos = await prisma.auditEvent.findMany({
        where: { action: "conta_foto_removida", resourceId: id },
      });
      expect(eventos).toHaveLength(1);
      await lerFoto(cred).expect(401);
    });

    it("nenhum evento de foto guarda dado da imagem", async () => {
      const eventos = await prisma.auditEvent.findMany({
        where: {
          action: { in: ["conta_foto_enviada", "conta_foto_removida"] },
        },
      });
      expect(eventos.length).toBeGreaterThan(0);
      for (const evento of eventos) {
        for (const valor of Object.values(evento)) {
          expect(Buffer.isBuffer(valor)).toBe(false);
        }
        expect(JSON.stringify(evento)).not.toMatch(
          /jpeg|png|webp|image|conteudo|largura|altura/i,
        );
      }
    });
  });

  // -------------------------------------------------------------------------
  describe("7. global da conta", () => {
    it("a foto sobrevive à troca de empresa (não é por empresa)", async () => {
      const email = "rh.global.foto@example.test";
      const cred = await criarUsuario(email, "rh", empresaA);
      const { id } = await conta(email);
      await prisma.accessUserEmpresa.create({
        data: {
          userId: id,
          empresaId: empresaB,
          concedidoPorUserId: (await conta("master.foto@example.test")).id,
        },
      });
      const r = await comStatus(
        enviarFoto(cred, await imagem(300, 300, "jpeg")),
        200,
      );
      await post("/v1/auth/contexto/empresa", cred)
        .send({ empresaId: empresaB })
        .expect(200);
      const me = await lerMe(cred);
      expect(me.companyId).toBe(empresaB);
      expect(me.fotoVersao).toBe(r.body.fotoVersao);
      await lerFoto(cred).expect(200);
    });
  });
});
