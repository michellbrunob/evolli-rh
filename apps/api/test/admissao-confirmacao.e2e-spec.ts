import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
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
 * T179 — confirmação segura da Nova admissão (decisões da proprietária de
 * 2026-10-21). PostgreSQL real e efêmero (Testcontainers), migrations
 * aplicadas do zero.
 *
 * Prova o que só o banco e o HTTP provam:
 *  - a lotação da admissão exige Departamento, Cargo e Unidade, ativos e da
 *    própria empresa;
 *  - matrícula e e-mail pessoal já usados na empresa são 409 com o NOME do
 *    campo e nunca o valor — inclusive sob envio simultâneo;
 *  - o mesmo e-mail em outra empresa é aceito, e nada da empresa A chega a
 *    quem está na B;
 *  - a chave de idempotência não deixa o reenvio criar outra admissão,
 *    recusa conteúdo diferente e é independente por ator e por empresa;
 *  - telefone brasileiro em `+55`, CEP brasileiro em 8 dígitos;
 *  - nenhuma trilha guarda e-mail, telefone, CEP ou matrícula enviados;
 *  - a migration de dados converte só o inequívoco, lista o resto sem valor
 *    e para diante de e-mail já repetido, dizendo só a contagem.
 *
 * **Todos os dados são sintéticos.** Domínio reservado `example.test`,
 * números sem titular.
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
const MIGRATION_T179 = "20261021120000_confirmacao_admissao_normalizacao";

const ADMIN_USER = "admin_test";
const ADMIN_PASSWORD = "admin_test_pw";
const ADMIN_DB = "evolli_test";
const MIGRATOR_PASSWORD = "migrator_test_pw";
const APP_PASSWORD = "app_test_pw";
const SENHA_PADRAO = "Confirmacao!Admissao#2026";
const ADMISSAO = "2026-01-05";

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

/** Sobe um PostgreSQL com os papéis e o schema de produção (sem migrations). */
async function subirBanco(): Promise<{
  container: StartedTestContainer;
  migratorUrl: string;
  appUrl: string;
}> {
  const container = await new GenericContainer("postgres:16-alpine")
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
  await runInfraScript(container, "01_create_roles.sql", [
    "-v",
    `migrator_password=${MIGRATOR_PASSWORD}`,
    "-v",
    `app_password=${APP_PASSWORD}`,
  ]);
  await runInfraScript(container, "02_schema_and_grants.sql", []);
  await runInfraScript(container, "04_extensions.sql", []);
  const host = container.getHost();
  const port = container.getMappedPort(5432);
  return {
    container,
    migratorUrl: `postgresql://evolli_migrator:${MIGRATOR_PASSWORD}@${host}:${port}/${ADMIN_DB}?schema=app`,
    appUrl: `postgresql://evolli_app:${APP_PASSWORD}@${host}:${port}/${ADMIN_DB}?schema=app`,
  };
}

/** `prisma migrate deploy` com o schema indicado, como o papel de migração. */
function migrar(migratorUrl: string, schema: string): void {
  execFileSync(
    process.execPath,
    [PRISMA_CLI, "migrate", "deploy", `--schema=${schema}`],
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
}

interface Credencial {
  cookie: string;
  csrfToken: string;
}

describe("Confirmação da Nova admissão (T179, e2e)", () => {
  let container: StartedTestContainer;
  let app: INestApplication;
  let prisma: PrismaClient;
  let appUrl: string;

  let master: Credencial;
  let rhA: Credencial;
  let rhA2: Credencial;
  let rhB: Credencial;

  let empresaA: string;
  let empresaB: string;
  let lotacaoA: LotacaoMinima;
  let lotacaoB: LotacaoMinima;

  /**
   * Todo valor pessoal ou de identificação enviado nesta suíte: no fim, as
   * trilhas são varridas atrás de cada um.
   */
  const enviados = new Set<string>();

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
  const admitir = (cred: Credencial, chave?: string) => {
    const req = post("/v1/colaboradores", cred);
    return chave === undefined ? req : req.set("Idempotency-Key", chave);
  };

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

  let sequencia = 0;

  /**
   * Corpo válido de admissão na empresa A, com matrícula e e-mail pessoal
   * novos a cada chamada. Os valores enviados entram em `enviados`.
   */
  function admissao(extra: Record<string, unknown> = {}) {
    sequencia += 1;
    const n = String(sequencia).padStart(4, "0");
    const corpo = {
      ...lotacaoA,
      nome: `Pessoa Sintetica Confirmacao ${n}`,
      empresaId: empresaA,
      matricula: `T179-${n}`,
      tipo: "clt",
      dataAdmissao: ADMISSAO,
      motivoCodigo: "admissao_inicial",
      perfilPessoal: { dataNascimento: "1990-01-15" },
      contatos: {
        emailPessoal: `pessoa.confirmacao.${n}@example.test`,
        celular: "(11) 98765-4321",
        telefone: "(11) 3333-4444",
      },
      ...extra,
    };
    lembrar(corpo);
    return corpo;
  }

  /** O mesmo corpo, levado para a empresa B (lotação da B). */
  function naEmpresaB(corpo: Record<string, unknown>) {
    return { ...corpo, ...lotacaoB, empresaId: empresaB };
  }

  function lembrar(corpo: Record<string, unknown>) {
    enviados.add(String(corpo["matricula"]));
    const contatos = corpo["contatos"] as Record<string, string> | undefined;
    if (contatos) {
      for (const valor of Object.values(contatos)) enviados.add(valor);
    }
    const endereco = corpo["endereco"] as Record<string, string> | undefined;
    if (endereco?.["cep"]) enviados.add(endereco["cep"]);
  }

  const vinculosCom = (matricula: string) =>
    prisma.vinculoFuncional.count({ where: { matricula } });

  beforeAll(async () => {
    const banco = await subirBanco();
    container = banco.container;
    appUrl = banco.appUrl;
    migrar(banco.migratorUrl, "prisma/schema.prisma");

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
        email: "master.t179@example.test",
        passwordHash: await new PasswordHashService().hash(SENHA_PADRAO),
        role: "master_tecnico",
        status: "active",
      },
    });
    master = await login("master.t179@example.test", SENHA_PADRAO);
    const empresa = async (codigo: string) =>
      (
        await post("/v1/empresas", master)
          .send({ codigo, nome: `Empresa ${codigo}` })
          .expect(201)
      ).body.id as string;
    empresaA = await empresa("T179A");
    empresaB = await empresa("T179B");
    lotacaoA = await lotacaoMinima(appUrl, empresaA);
    lotacaoB = await lotacaoMinima(appUrl, empresaB);
    rhA = await criarUsuario("rh.t179a@example.test", "rh", empresaA);
    rhA2 = await criarUsuario("rh2.t179a@example.test", "rh", empresaA);
    rhB = await criarUsuario("rh.t179b@example.test", "rh", empresaB);
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    await app?.close();
    await container?.stop();
  });

  // -------------------------------------------------------------------------

  describe("lotação obrigatória: Departamento e Cargo (Unidade opcional)", () => {
    it.each(["departamentoId", "cargoId"])(
      "sem %s: 400 e nada é gravado",
      async (campo) => {
        const corpo: Record<string, unknown> = admissao();
        delete corpo[campo];
        await admitir(rhA).send(corpo).expect(400);
        expect(await vinculosCom(String(corpo["matricula"]))).toBe(0);
      },
    );

    it.each(["departamentoId", "cargoId", "unidadeOrganizacionalId"] as const)(
      "%s de OUTRA empresa: 422 e nada é gravado",
      async (campo) => {
        const corpo = admissao({ [campo]: lotacaoB[campo] });
        const r = await admitir(rhA).send(corpo).expect(422);
        expect(JSON.stringify(r.body)).not.toContain(lotacaoB[campo]);
        expect(await vinculosCom(corpo.matricula)).toBe(0);
      },
    );

    it.each(["departamentoId", "cargoId", "unidadeOrganizacionalId"] as const)(
      "%s INATIVO da própria empresa: 422 e nada é gravado",
      async (campo) => {
        const codigo = `T179_INATIVO_${campo.slice(0, 4).toUpperCase()}`;
        const dados = {
          empresaId: empresaA,
          codigo,
          nome: `Inativo ${codigo}`,
          status: "inativo" as const,
        };
        const inativo =
          campo === "departamentoId"
            ? await prisma.departamento.create({ data: dados })
            : campo === "cargoId"
              ? await prisma.cargo.create({ data: dados })
              : await prisma.unidadeOrganizacional.create({ data: dados });
        const corpo = admissao({ [campo]: inativo.id });
        await admitir(rhA).send(corpo).expect(422);
        expect(await vinculosCom(corpo.matricula)).toBe(0);
      },
    );

    it("com os três (e sem área, equipe ou centro de custo): 201, gravados no destino", async () => {
      const r = await admitir(rhA).send(admissao()).expect(201);
      expect(r.body.movimentacao.destino).toEqual({
        unidadeOrganizacionalId: lotacaoA.unidadeOrganizacionalId,
        departamentoId: lotacaoA.departamentoId,
        areaId: null,
        equipeId: null,
        cargoId: lotacaoA.cargoId,
        centroCustoId: null,
      });
    });
  });

  // -------------------------------------------------------------------------

  describe("duplicidade: 409 com o campo, nunca o valor", () => {
    let existente: ReturnType<typeof admissao>;

    beforeAll(async () => {
      existente = admissao();
      await admitir(rhA).send(existente).expect(201);
    });

    it("matrícula já usada na empresa: 409 com `matricula` e sem o valor", async () => {
      const corpo = admissao({ matricula: existente.matricula });
      const colaboradoresAntes = await prisma.colaborador.count();
      const r = await admitir(rhA).send(corpo).expect(409);
      expect(r.body).toEqual({
        status_code: 409,
        message: "Conflito ao processar a requisição.",
        request_id: expect.any(String),
        timestamp: expect.any(String),
        erros: [{ campo: "matricula", motivo: "em_uso" }],
      });
      const texto = JSON.stringify(r.body);
      expect(texto).not.toContain(existente.matricula);
      expect(texto).not.toContain(corpo.contatos.emailPessoal);
      expect(await prisma.colaborador.count()).toBe(colaboradoresAntes);
      expect(await vinculosCom(existente.matricula)).toBe(1);
    });

    it("e-mail pessoal já usado na empresa (mesmo com outra caixa e espaços): 409 com `contatos.emailPessoal`", async () => {
      const variacao = `  ${existente.contatos.emailPessoal.toUpperCase()} `;
      const corpo = admissao();
      corpo.contatos = { ...corpo.contatos, emailPessoal: variacao };
      const r = await admitir(rhA).send(corpo).expect(409);
      expect(r.body.erros).toEqual([
        { campo: "contatos.emailPessoal", motivo: "em_uso" },
      ]);
      const texto = JSON.stringify(r.body);
      expect(texto).not.toContain(existente.contatos.emailPessoal);
      expect(texto.toLowerCase()).not.toContain(
        existente.contatos.emailPessoal,
      );
      expect(texto).not.toContain(corpo.matricula);
      expect(await vinculosCom(corpo.matricula)).toBe(0);
    });

    it("matrícula e e-mail ao mesmo tempo: os dois campos, sem nenhum valor", async () => {
      const corpo = admissao({ matricula: existente.matricula });
      corpo.contatos = {
        ...corpo.contatos,
        emailPessoal: existente.contatos.emailPessoal,
      };
      const r = await admitir(rhA).send(corpo).expect(409);
      expect(r.body.erros).toEqual([
        { campo: "matricula", motivo: "em_uso" },
        { campo: "contatos.emailPessoal", motivo: "em_uso" },
      ]);
      const texto = JSON.stringify(r.body);
      expect(texto).not.toContain(existente.matricula);
      expect(texto).not.toContain(existente.contatos.emailPessoal);
      expect(texto).not.toContain("+5511987654321");
    });

    it("o mesmo e-mail e a mesma matrícula em OUTRA empresa: 201", async () => {
      const r = await admitir(rhB)
        .send(
          naEmpresaB({
            ...admissao(),
            matricula: existente.matricula,
            contatos: { ...existente.contatos },
          }),
        )
        .expect(201);
      expect(r.body.vinculo.empresaId).toBe(empresaB);
      expect(r.body.contatos.emailPessoal).toBe(
        existente.contatos.emailPessoal,
      );
    });

    it("quem está na B não recebe nada que revele a pessoa da A", async () => {
      const pessoaA = await prisma.vinculoFuncional.findFirstOrThrow({
        where: { empresaId: empresaA, matricula: existente.matricula },
        include: { colaborador: true },
      });
      // A admissão na B, com os dados da A, é uma pessoa NOVA na B.
      const naB = await prisma.vinculoFuncional.findFirstOrThrow({
        where: { empresaId: empresaB, matricula: existente.matricula },
      });
      expect(naB.colaboradorId).not.toBe(pessoaA.colaboradorId);

      const lista = await get(
        "/v1/colaboradores?tamanhoPagina=100",
        rhB,
      ).expect(200);
      const texto = JSON.stringify(lista.body);
      expect(texto).not.toContain(pessoaA.colaboradorId);
      expect(texto).not.toContain(pessoaA.colaborador.nome);
      await get(`/v1/colaboradores/${pessoaA.colaboradorId}`, rhB).expect(404);
      await get(
        `/v1/colaboradores/${pessoaA.colaboradorId}/contatos`,
        rhB,
      ).expect(404);

      // Um conflito na B também não fala da A: o 409 só olha a empresa ativa.
      const conflitoNaB = await admitir(rhB)
        .send(naEmpresaB({ ...admissao(), matricula: existente.matricula }))
        .expect(409);
      expect(JSON.stringify(conflitoNaB.body)).not.toContain(
        pessoaA.colaboradorId,
      );
    });
  });

  // -------------------------------------------------------------------------

  describe("concorrência: o banco decide, uma 201 e uma 409", () => {
    it.each([1, 2, 3])(
      "rodada %p — duas admissões simultâneas com a MESMA matrícula e chaves diferentes",
      async () => {
        const primeira = admissao();
        const segunda = admissao({ matricula: primeira.matricula });
        const respostas = await Promise.all([
          admitir(rhA, randomUUID()).send(primeira),
          admitir(rhA, randomUUID()).send(segunda),
        ]);
        const status = respostas.map((r) => r.status).sort();
        expect(status).toEqual([201, 409]);
        const recusa = respostas.find((r) => r.status === 409)!;
        expect(recusa.body.erros).toEqual([
          { campo: "matricula", motivo: "em_uso" },
        ]);
        expect(JSON.stringify(recusa.body)).not.toContain(primeira.matricula);
        expect(await vinculosCom(primeira.matricula)).toBe(1);
      },
    );

    it.each([1, 2, 3])(
      "rodada %p — duas admissões simultâneas com o MESMO e-mail pessoal e chaves diferentes",
      async () => {
        const primeira = admissao();
        const segunda = admissao();
        segunda.contatos = {
          ...segunda.contatos,
          emailPessoal: primeira.contatos.emailPessoal,
        };
        const respostas = await Promise.all([
          admitir(rhA, randomUUID()).send(primeira),
          admitir(rhA, randomUUID()).send(segunda),
        ]);
        const status = respostas.map((r) => r.status).sort();
        expect(status).toEqual([201, 409]);
        const recusa = respostas.find((r) => r.status === 409)!;
        expect(recusa.body.erros).toEqual([
          { campo: "contatos.emailPessoal", motivo: "em_uso" },
        ]);
        expect(JSON.stringify(recusa.body)).not.toContain(
          primeira.contatos.emailPessoal,
        );
        expect(
          await prisma.contatoColaborador.count({
            where: {
              empresaId: empresaA,
              emailPessoal: primeira.contatos.emailPessoal,
            },
          }),
        ).toBe(1);
        expect(
          (await vinculosCom(primeira.matricula)) +
            (await vinculosCom(segunda.matricula)),
        ).toBe(1);
      },
    );
  });

  // -------------------------------------------------------------------------

  describe("idempotência do envio (Idempotency-Key)", () => {
    const contar = async (matricula: string) => {
      const vinculos = await prisma.vinculoFuncional.findMany({
        where: { matricula },
        select: { id: true, colaboradorId: true },
      });
      return {
        vinculos: vinculos.length,
        colaboradores: new Set(vinculos.map((v) => v.colaboradorId)).size,
        movimentacoes: await prisma.movimentacaoFuncional.count({
          where: { vinculo: { matricula } },
        }),
        contatos: await prisma.contatoColaborador.count({
          where: { colaborador: { vinculos: { some: { matricula } } } },
        }),
      };
    };
    const UM_DE_CADA = {
      vinculos: 1,
      colaboradores: 1,
      movimentacoes: 1,
      contatos: 1,
    };

    it("primeiro envio: 201 sem `Idempotent-Replayed`; o reenvio: 201, `Idempotent-Replayed: true`, a MESMA admissão e nada a mais", async () => {
      const chave = randomUUID();
      const corpo = admissao();
      const primeiro = await admitir(rhA, chave).send(corpo).expect(201);
      expect(primeiro.headers["idempotent-replayed"]).toBeUndefined();

      const colaboradoresAntes = await prisma.colaborador.count();
      const auditoriaAntes = await prisma.auditEvent.count({
        where: { action: "pessoas_colaborador_criado" },
      });
      const reenvio = await admitir(rhA, chave).send(corpo).expect(201);
      expect(reenvio.headers["idempotent-replayed"]).toBe("true");
      expect(reenvio.body.id).toBe(primeiro.body.id);
      expect(reenvio.body.vinculo.id).toBe(primeiro.body.vinculo.id);
      expect(reenvio.body.movimentacao.id).toBe(primeiro.body.movimentacao.id);
      expect(reenvio.body).toEqual(primeiro.body);

      // A chave em caixa alta é a mesma chave.
      const emCaixaAlta = await admitir(rhA, chave.toUpperCase())
        .send(corpo)
        .expect(201);
      expect(emCaixaAlta.headers["idempotent-replayed"]).toBe("true");
      expect(emCaixaAlta.body.id).toBe(primeiro.body.id);

      expect(await prisma.colaborador.count()).toBe(colaboradoresAntes);
      expect(await contar(corpo.matricula)).toEqual(UM_DE_CADA);
      expect(
        await prisma.auditEvent.count({
          where: { action: "pessoas_colaborador_criado" },
        }),
      ).toBe(auditoriaAntes);
      expect(
        await prisma.idempotenciaAdmissao.count({ where: { chave } }),
      ).toBe(1);
    });

    it("mesma chave com conteúdo diferente: 422 `idempotencia_conteudo_divergente` e nada gravado", async () => {
      const chave = randomUUID();
      const corpo = admissao();
      await admitir(rhA, chave).send(corpo).expect(201);

      for (const divergente of [
        { ...corpo, nome: "Pessoa Sintetica Outro Nome" },
        { ...corpo, contatos: { ...corpo.contatos, telefone: "1144445555" } },
        { ...corpo, dataAdmissao: "2026-01-06" },
        { ...corpo, endereco: { pais: "Brasil", cep: "01001-000" } },
      ]) {
        const r = await admitir(rhA, chave).send(divergente).expect(422);
        expect(r.body).toEqual({
          status_code: 422,
          message: "Dados inválidos.",
          request_id: expect.any(String),
          timestamp: expect.any(String),
          codigo: "idempotencia_conteudo_divergente",
        });
        expect(r.headers["idempotent-replayed"]).toBeUndefined();
      }
      // Conteúdo diferente que conflitaria (outra matrícula, mesmo e-mail)
      // também é recusado pela chave, não pela duplicidade.
      const outraMatricula = await admitir(rhA, chave)
        .send({ ...corpo, matricula: `${corpo.matricula}-X` })
        .expect(422);
      expect(outraMatricula.body.codigo).toBe(
        "idempotencia_conteudo_divergente",
      );
      expect(await vinculosCom(`${corpo.matricula}-X`)).toBe(0);
      expect(await contar(corpo.matricula)).toEqual(UM_DE_CADA);
    });

    it("admissão editada depois do envio: o reenvio da chave é recusado, sem devolver um estado que não é o do envio", async () => {
      const chave = randomUUID();
      const corpo = admissao();
      const r = await admitir(rhA, chave).send(corpo).expect(201);
      await put(`/v1/colaboradores/${r.body.id}/contatos`, rhA)
        .send({ ...corpo.contatos, telefone: "(11) 3333-5555" })
        .expect(200);
      const reenvio = await admitir(rhA, chave).send(corpo).expect(422);
      expect(reenvio.body.codigo).toBe("idempotencia_conteudo_divergente");
    });

    it("mesma chave em envios SIMULTÂNEOS: todos 201, um só cadastro, os outros como reenvio", async () => {
      const chave = randomUUID();
      const corpo = admissao();
      const respostas = await Promise.all([
        admitir(rhA, chave).send(corpo),
        admitir(rhA, chave).send(corpo),
        admitir(rhA, chave).send(corpo),
      ]);
      expect(respostas.map((r) => r.status)).toEqual([201, 201, 201]);
      expect(new Set(respostas.map((r) => r.body.id)).size).toBe(1);
      expect(new Set(respostas.map((r) => r.body.vinculo.id)).size).toBe(1);
      expect(
        respostas.filter((r) => r.headers["idempotent-replayed"] === "true"),
      ).toHaveLength(2);
      expect(await contar(corpo.matricula)).toEqual(UM_DE_CADA);
      expect(
        await prisma.idempotenciaAdmissao.count({ where: { chave } }),
      ).toBe(1);
    });

    it("a mesma chave usada por OUTRO ator da mesma empresa é independente", async () => {
      const chave = randomUUID();
      const corpo = admissao();
      const doPrimeiro = await admitir(rhA, chave).send(corpo).expect(201);

      // Com o MESMO conteúdo, a chave do outro ator não devolve a admissão
      // do primeiro: a duplicidade de dado responde, como em qualquer envio
      // novo — e a recusa não registra a chave para ele.
      const mesmoConteudo = await admitir(rhA2, chave).send(corpo).expect(409);
      expect(mesmoConteudo.headers["idempotent-replayed"]).toBeUndefined();
      expect(mesmoConteudo.body.erros).toEqual([
        { campo: "matricula", motivo: "em_uso" },
        { campo: "contatos.emailPessoal", motivo: "em_uso" },
      ]);
      expect(JSON.stringify(mesmoConteudo.body)).not.toContain(
        doPrimeiro.body.id,
      );

      // Com outro conteúdo, é uma admissão nova — não um reenvio.
      const outro = admissao();
      const doSegundo = await admitir(rhA2, chave).send(outro).expect(201);
      expect(doSegundo.headers["idempotent-replayed"]).toBeUndefined();
      expect(doSegundo.body.id).not.toBe(doPrimeiro.body.id);

      // Cada ator reenvia a SUA admissão com a mesma chave.
      const reenvioDoSegundo = await admitir(rhA2, chave)
        .send(outro)
        .expect(201);
      expect(reenvioDoSegundo.headers["idempotent-replayed"]).toBe("true");
      expect(reenvioDoSegundo.body.id).toBe(doSegundo.body.id);
      const reenvioDoPrimeiro = await admitir(rhA, chave)
        .send(corpo)
        .expect(201);
      expect(reenvioDoPrimeiro.headers["idempotent-replayed"]).toBe("true");
      expect(reenvioDoPrimeiro.body.id).toBe(doPrimeiro.body.id);
      expect(
        await prisma.idempotenciaAdmissao.count({ where: { chave } }),
      ).toBe(2);
    });

    it("a mesma chave em OUTRA empresa é independente", async () => {
      const chave = randomUUID();
      const corpo = admissao();
      const naA = await admitir(rhA, chave).send(corpo).expect(201);
      const naB = await admitir(rhB, chave)
        .send(naEmpresaB(admissao()))
        .expect(201);
      expect(naB.headers["idempotent-replayed"]).toBeUndefined();
      expect(naB.body.id).not.toBe(naA.body.id);
      expect(naB.body.vinculo.empresaId).toBe(empresaB);
    });

    it.each([
      ["nao-e-uuid", "texto"],
      ["", "vazia"],
      ["6f1c2a4e8b3d4c5e9f60718293a4b5c6", "sem hífens"],
      ["6f1c2a4e-8b3d-0c5e-9f60-718293a4b5c6", "versão 0"],
    ])("chave fora da forma (%p, %s): 400 e nada gravado", async (chave) => {
      const corpo = admissao();
      const r = await admitir(rhA).set("Idempotency-Key", chave).send(corpo);
      expect(r.status).toBe(400);
      expect(await vinculosCom(corpo.matricula)).toBe(0);
    });

    it("sem chave, a admissão continua funcionando e não deixa registro de idempotência", async () => {
      const antes = await prisma.idempotenciaAdmissao.count();
      const corpo = admissao();
      const r = await admitir(rhA).send(corpo).expect(201);
      expect(r.headers["idempotent-replayed"]).toBeUndefined();
      expect(await prisma.idempotenciaAdmissao.count()).toBe(antes);
      // Sem chave, repetir é uma nova tentativa — e esbarra na duplicidade.
      const repetida = await admitir(rhA).send(corpo).expect(409);
      expect(repetida.body.erros).toEqual([
        { campo: "matricula", motivo: "em_uso" },
        { campo: "contatos.emailPessoal", motivo: "em_uso" },
      ]);
    });

    it("`idempotencia_admissao` guarda só chave, ator, empresa e ids — nenhum dado pessoal", async () => {
      const colunas = await prisma.$queryRawUnsafe<{ column_name: string }[]>(
        `SELECT column_name FROM information_schema.columns
          WHERE table_schema = 'app' AND table_name = 'idempotencia_admissao'
          ORDER BY column_name`,
      );
      expect(colunas.map((c) => c.column_name)).toEqual(
        [
          "ator_user_id",
          "chave",
          "colaborador_id",
          "criado_em",
          "empresa_id",
          "id",
          "movimentacao_id",
          "vinculo_id",
        ].sort(),
      );
      const linhas = await prisma.$queryRawUnsafe<{ linha: string }[]>(
        `SELECT row_to_json(t)::text AS linha FROM app.idempotencia_admissao t`,
      );
      expect(linhas.length).toBeGreaterThan(0);
      const texto = linhas.map((l) => l.linha).join("\n");
      for (const valor of enviados) {
        expect(texto).not.toContain(valor);
      }
      expect(texto).not.toContain("@");
      expect(texto).not.toContain("Pessoa Sintetica");
    });

    it("`idempotencia_admissao` é append-only para a aplicação", async () => {
      const privilegios = await prisma.$queryRawUnsafe<
        { update: boolean; delete: boolean; insert: boolean }[]
      >(
        `SELECT has_table_privilege('evolli_app', 'app.idempotencia_admissao', 'UPDATE') AS "update",
                has_table_privilege('evolli_app', 'app.idempotencia_admissao', 'DELETE') AS "delete",
                has_table_privilege('evolli_app', 'app.idempotencia_admissao', 'INSERT') AS "insert"`,
      );
      expect(privilegios[0]).toEqual({
        update: false,
        delete: false,
        insert: true,
      });
      await expect(
        prisma.idempotenciaAdmissao.deleteMany({}),
      ).rejects.toThrow();
    });
  });

  // -------------------------------------------------------------------------

  describe("PUT de contatos: e-mail pessoal único na empresa", () => {
    let pessoaUm: { id: string; corpo: ReturnType<typeof admissao> };
    let pessoaDois: { id: string; corpo: ReturnType<typeof admissao> };
    const rota = (id: string) => `/v1/colaboradores/${id}/contatos`;

    beforeAll(async () => {
      const um = admissao();
      const dois = admissao();
      pessoaUm = {
        id: (await admitir(rhA).send(um).expect(201)).body.id,
        corpo: um,
      };
      pessoaDois = {
        id: (await admitir(rhA).send(dois).expect(201)).body.id,
        corpo: dois,
      };
    });

    it("e-mail de OUTRO colaborador da mesma empresa: 409 com `emailPessoal`, sem o valor, e nada muda", async () => {
      const antes = await prisma.contatoColaborador.findFirstOrThrow({
        where: { colaboradorId: pessoaDois.id },
      });
      for (const emailPessoal of [
        pessoaUm.corpo.contatos.emailPessoal,
        ` ${pessoaUm.corpo.contatos.emailPessoal.toUpperCase()}  `,
      ]) {
        const r = await put(rota(pessoaDois.id), rhA)
          .send({ ...pessoaDois.corpo.contatos, emailPessoal })
          .expect(409);
        expect(r.body.erros).toEqual([
          { campo: "emailPessoal", motivo: "em_uso" },
        ]);
        expect(JSON.stringify(r.body).toLowerCase()).not.toContain(
          pessoaUm.corpo.contatos.emailPessoal,
        );
      }
      expect(
        await prisma.contatoColaborador.findFirstOrThrow({
          where: { colaboradorId: pessoaDois.id },
        }),
      ).toEqual(antes);
    });

    it("o PRÓPRIO e-mail do colaborador: ok (não conflita consigo mesmo)", async () => {
      const r = await put(rota(pessoaDois.id), rhA)
        .send({ ...pessoaDois.corpo.contatos, telefone: "(11) 3333-6666" })
        .expect(200);
      expect(r.body.resultado).toBe("atualizado");
      expect(r.body.contatos).toMatchObject({
        emailPessoal: pessoaDois.corpo.contatos.emailPessoal,
        telefone: "+551133336666",
      });
      enviados.add("(11) 3333-6666");
      enviados.add("+551133336666");
    });

    it("e-mail novo, livre na empresa: ok", async () => {
      const novo = "pessoa.confirmacao.novo.email@example.test";
      enviados.add(novo);
      await put(rota(pessoaDois.id), rhA)
        .send({ ...pessoaDois.corpo.contatos, emailPessoal: novo })
        .expect(200);
    });

    it("telefone estrangeiro no PUT: 400 e nada muda", async () => {
      const antes = await prisma.contatoColaborador.findFirstOrThrow({
        where: { colaboradorId: pessoaUm.id },
      });
      await put(rota(pessoaUm.id), rhA)
        .send({ ...pessoaUm.corpo.contatos, celular: "+44 20 7946 0958" })
        .expect(400);
      expect(
        await prisma.contatoColaborador.findFirstOrThrow({
          where: { colaboradorId: pessoaUm.id },
        }),
      ).toEqual(antes);
    });
  });

  // -------------------------------------------------------------------------

  describe("telefone brasileiro em +55 e CEP brasileiro em 8 dígitos", () => {
    it.each([
      ["(11) 98765-4321", "11 3333-4444", "+5511987654321", "+551133334444"],
      ["11987654321", "1133334444", "+5511987654321", "+551133334444"],
      [
        "+55 (21) 98765-4321",
        "+55 21 2222-3333",
        "+5521987654321",
        "+552122223333",
      ],
      ["5531988887777", "553132221111", "+5531988887777", "+553132221111"],
      ["+5511987654321", "+551155556666", "+5511987654321", "+551155556666"],
      // T179 (B1) — o que a tela envia depois de digitar +55 tecla a tecla:
      // DDD iniciado por 9 e DDD comum; e o número com o 55 do país sem o +,
      // que só chega INTEIRO (colagem, preenchimento ou outro cliente).
      ["(91) 98765-4321", "(11) 3222-1111", "+5591987654321", "+551132221111"],
      [
        "+55 91 98765-4320",
        "5591988887777",
        "+5591987654320",
        "+5591988887777",
      ],
      // T179 (B2) — DDD 55 completo continua nacional; `+55` digitado com o
      // resto colado chega como uma entrada só.
      [
        "(55) 99999-8888",
        "+5591 98765-4319",
        "+5555999998888",
        "+5591987654319",
      ],
    ])(
      "celular %p e telefone %p são gravados %p e %p",
      async (celular, telefone, celularGravado, telefoneGravado) => {
        const corpo = admissao();
        corpo.contatos = { ...corpo.contatos, celular, telefone };
        lembrar(corpo);
        enviados.add(celularGravado);
        enviados.add(telefoneGravado);
        const r = await admitir(rhA).send(corpo).expect(201);
        expect(r.body.contatos).toMatchObject({
          celular: celularGravado,
          telefone: telefoneGravado,
        });
        expect(
          await prisma.contatoColaborador.findFirstOrThrow({
            where: { colaboradorId: r.body.id },
            select: { celular: true, telefone: true },
          }),
        ).toEqual({ celular: celularGravado, telefone: telefoneGravado });
      },
    );

    it.each([
      ["+44 20 7946 0958", "estrangeiro"],
      ["+1 212 555 0100", "estrangeiro"],
      ["11887654321", "celular sem o 9"],
      ["1163334444", "fixo iniciado por 6"],
      ["(01) 98765-4321", "DDD inválido"],
      // T179 (B2) — DDD 55 completo com dígito a mais e + sem o 55.
      ["559999988881", "DDD 55 com dígito a mais"],
      ["+91987654321", "+ sem o 55 do Brasil"],
      ["+499111234567", "estrangeiro que parece brasileiro"],
      ["0119876543210", "zero de operadora"],
      ["12345678", "sem DDD"],
    ])("telefone %p (%s): 400 e nada gravado", async (valor) => {
      const corpo = admissao();
      corpo.contatos = { ...corpo.contatos, celular: valor };
      await admitir(rhA).send(corpo).expect(400);
      expect(await vinculosCom(corpo.matricula)).toBe(0);
    });

    it("CEP brasileiro `01001-000` é gravado `01001000`", async () => {
      const corpo = admissao({
        endereco: { pais: "Brasil", cep: "01001-000", cidade: "Sao Paulo" },
      });
      enviados.add("01001000");
      const r = await admitir(rhA).send(corpo).expect(201);
      expect(r.body.endereco).toMatchObject({
        pais: "Brasil",
        cep: "01001000",
      });
      expect(
        (
          await prisma.enderecoColaborador.findFirstOrThrow({
            where: { colaboradorId: r.body.id },
          })
        ).cep,
      ).toBe("01001000");
    });

    it("país com outra caixa e espaços (`  BRASIL `) também normaliza o CEP", async () => {
      const corpo = admissao({
        endereco: { pais: "  BRASIL ", cep: "20040002" },
      });
      const r = await admitir(rhA).send(corpo).expect(201);
      expect(r.body.endereco).toMatchObject({
        pais: "BRASIL",
        cep: "20040002",
      });
    });

    it.each(["ABC123", "0100-1000", "010010000", "01001 000"])(
      "CEP brasileiro inválido %p: 400 e nada gravado",
      async (cep) => {
        const corpo = admissao({ endereco: { pais: "Brasil", cep } });
        await admitir(rhA).send(corpo).expect(400);
        expect(await vinculosCom(corpo.matricula)).toBe(0);
      },
    );

    it("outro país mantém o código postal em texto", async () => {
      const corpo = admissao({
        endereco: { pais: "Inglaterra", cep: "SW1A 1AA", cidade: "Londres" },
      });
      const r = await admitir(rhA).send(corpo).expect(201);
      expect(r.body.endereco).toMatchObject({
        pais: "Inglaterra",
        cep: "SW1A 1AA",
      });
    });

    it("a edição do endereço segue a mesma regra do CEP", async () => {
      const corpo = admissao();
      const r = await admitir(rhA).send(corpo).expect(201);
      const editado = await put(
        `/v1/colaboradores/${r.body.id}/dados-pessoais`,
        rhA,
      )
        .send({ endereco: { pais: "Brasil", cep: "30140-071" } })
        .expect(200);
      enviados.add("30140-071");
      enviados.add("30140071");
      expect(JSON.stringify(editado.body)).toContain("30140071");
      expect(
        (
          await prisma.enderecoColaborador.findFirstOrThrow({
            where: { colaboradorId: r.body.id },
          })
        ).cep,
      ).toBe("30140071");
      await put(`/v1/colaboradores/${r.body.id}/dados-pessoais`, rhA)
        .send({ endereco: { pais: "Brasil", cep: "ABC123" } })
        .expect(400);
    });
  });

  // -------------------------------------------------------------------------

  describe("obrigatoriedade da Nova admissão (decisão de 2026-10-21)", () => {
    /** Corpo só com os obrigatórios: sem matrícula, Unidade nem contatos. */
    function soObrigatorios(extra: Record<string, unknown> = {}) {
      const corpo: Record<string, unknown> = admissao();
      delete corpo["matricula"];
      delete corpo["unidadeOrganizacionalId"];
      delete corpo["contatos"];
      return { ...corpo, ...extra };
    }

    it("só com os obrigatórios: 201, sem matrícula, Unidade, contatos nem sexo", async () => {
      const r = await admitir(rhA).send(soObrigatorios()).expect(201);
      expect(r.body.vinculo.matricula).toBeNull();
      expect(r.body.contatos).toBeNull();
      expect(r.body.movimentacao.destino.unidadeOrganizacionalId).toBeNull();
      expect(r.body.perfilPessoal.sexo).toBeNull();
      expect(
        await prisma.contatoColaborador.count({
          where: { colaboradorId: r.body.id },
        }),
      ).toBe(0);
      const dados = await get(
        `/v1/colaboradores/${r.body.id}/dados-pessoais`,
        rhA,
      ).expect(200);
      expect(dados.body.perfilPessoal.sexo).toBeNull();
      const contatos = await get(
        `/v1/colaboradores/${r.body.id}/contatos`,
        rhA,
      ).expect(200);
      expect(contatos.body).toMatchObject({
        situacao: "sem_registro",
        contatos: null,
      });
    });

    it("duas admissões sem matrícula e sem e-mail na mesma empresa: as duas 201", async () => {
      await admitir(rhA).send(soObrigatorios()).expect(201);
      await admitir(rhA).send(soObrigatorios()).expect(201);
    });

    it("contatos parciais: só o celular é gravado, e-mail e telefone ficam nulos", async () => {
      const corpo = soObrigatorios({
        contatos: { celular: "(91) 98765-4321" },
      });
      const r = await admitir(rhA).send(corpo).expect(201);
      expect(r.body.contatos).toMatchObject({
        emailPessoal: null,
        celular: "+5591987654321",
        telefone: null,
      });
    });

    it("contatos vazios valem como não informados", async () => {
      const corpo = soObrigatorios({
        contatos: { emailPessoal: "  ", celular: "", telefone: null },
      });
      const r = await admitir(rhA).send(corpo).expect(201);
      expect(r.body.contatos).toBeNull();
      expect(
        await prisma.contatoColaborador.count({
          where: { colaboradorId: r.body.id },
        }),
      ).toBe(0);
    });

    it("sem nenhum contato: nenhum registro nem evento de contato, e a leitura posterior diz sem registro", async () => {
      const contatoCriado = () =>
        prisma.auditEvent.count({
          where: { action: "pessoas_contato_criado" },
        });
      const criadosAntes = await contatoCriado();
      const r = await admitir(rhA).send(soObrigatorios()).expect(201);
      const colaboradorId: string = r.body.id;
      expect(r.body.contatos).toBeNull();
      expect(
        await prisma.contatoColaborador.count({ where: { colaboradorId } }),
      ).toBe(0);
      // Nenhum evento de criação de contato: só a admissão foi registrada.
      expect(
        await prisma.contatoColaboradorEvento.count({
          where: { colaboradorId, acao: "criacao" },
        }),
      ).toBe(0);
      expect(await contatoCriado()).toBe(criadosAntes);

      const lido = await get(
        `/v1/colaboradores/${colaboradorId}/contatos`,
        rhA,
      ).expect(200);
      expect(lido.body).toMatchObject({
        colaboradorId,
        situacao: "sem_registro",
        contatos: null,
      });
      // A leitura não cria registro.
      expect(
        await prisma.contatoColaborador.count({ where: { colaboradorId } }),
      ).toBe(0);
      // Isolamento: outra empresa não sabe que a pessoa existe.
      await get(`/v1/colaboradores/${colaboradorId}/contatos`, rhB).expect(404);
    });

    it("sem nenhum contato: o reenvio com a mesma chave é reconhecido e não cria nada", async () => {
      const chave = randomUUID();
      const corpo = soObrigatorios({
        contatos: { emailPessoal: "", celular: "", telefone: "" },
      });
      const primeiro = await admitir(rhA, chave).send(corpo).expect(201);
      const reenvio = await admitir(rhA, chave).send(corpo).expect(201);
      expect(reenvio.headers["idempotent-replayed"]).toBe("true");
      expect(reenvio.body.id).toBe(primeiro.body.id);
      expect(reenvio.body.contatos).toBeNull();
      expect(
        await prisma.contatoColaborador.count({
          where: { colaboradorId: primeiro.body.id },
        }),
      ).toBe(0);
      // Sem os contatos, o mesmo corpo continua sendo o mesmo envio; com um
      // contato a mais, é conteúdo divergente.
      const divergente = await admitir(rhA, chave)
        .send(soObrigatorios({ contatos: { celular: "(91) 98765-4321" } }))
        .expect(422);
      expect(divergente.body.codigo).toBe("idempotencia_conteudo_divergente");
    });

    it("telefone informado fora da forma continua recusado", async () => {
      const corpo = soObrigatorios({ contatos: { celular: "12345" } });
      await admitir(rhA).send(corpo).expect(400);
    });

    it.each(["feminino", "masculino", "intersexo", "nao_informar"])(
      "sexo %p: gravado e lido como veio",
      async (sexo) => {
        const corpo = soObrigatorios({
          perfilPessoal: { dataNascimento: "1990-01-15", sexo },
        });
        const r = await admitir(rhA).send(corpo).expect(201);
        expect(r.body.perfilPessoal.sexo).toBe(sexo);
        const lido = await get(
          `/v1/colaboradores/${r.body.id}/dados-pessoais`,
          rhA,
        ).expect(200);
        expect(lido.body.perfilPessoal.sexo).toBe(sexo);
        expect(
          (
            await prisma.perfilPessoalColaborador.findFirstOrThrow({
              where: { colaboradorId: r.body.id },
            })
          ).sexo,
        ).toBe(sexo);
      },
    );

    it.each(["Feminino", "outro", "não informar", "F"])(
      "sexo fora da lista fechada (%p) enviado direto à API: 400 e nada gravado",
      async (sexo) => {
        const corpo = soObrigatorios({
          perfilPessoal: { dataNascimento: "1990-01-15", sexo },
        });
        const antes = await prisma.colaborador.count();
        await admitir(rhA).send(corpo).expect(400);
        expect(await prisma.colaborador.count()).toBe(antes);
      },
    );

    it("Departamento, Cargo e data de admissão continuam obrigatórios", async () => {
      for (const campo of ["departamentoId", "cargoId", "dataAdmissao"]) {
        const corpo = soObrigatorios();
        delete corpo[campo];
        await admitir(rhA).send(corpo).expect(400);
      }
    });

    it("PUT de contatos: todos opcionais — nada informado não cria registro; um só cria com os outros nulos", async () => {
      const r = await admitir(rhA).send(soObrigatorios()).expect(201);
      const rota = `/v1/colaboradores/${r.body.id}/contatos`;
      const vazio = await put(rota, rhA).send({}).expect(200);
      expect(vazio.body).toMatchObject({
        situacao: "sem_registro",
        contatos: null,
      });
      expect(
        await prisma.contatoColaborador.count({
          where: { colaboradorId: r.body.id },
        }),
      ).toBe(0);
      const um = await put(rota, rhA)
        .send({ telefone: "(55) 3222-1111" })
        .expect(200);
      expect(um.body.contatos).toMatchObject({
        emailPessoal: null,
        celular: null,
        telefone: "+555532221111",
      });
      // Como a ficha envia: os três campos, vazio como `null`. Era o único
      // contato: o registro fica INATIVO e a resposta é "sem registro".
      const apagado = await put(rota, rhA)
        .send({ emailPessoal: null, celular: null, telefone: null })
        .expect(200);
      expect(apagado.body).toMatchObject({
        situacao: "sem_registro",
        contatos: null,
        resultado: "removido",
      });
    });

    // ---------------------------------------------------------------------
    // Revisão final — matrícula `null` e remoção de todos os contatos.

    it("sem matrícula por clientes diferentes (omitida, null, vazia, só espaços): todas 201, nenhuma conflita", async () => {
      const ids: string[] = [];
      for (const matricula of [undefined, null, "", "   ", null]) {
        const corpo = soObrigatorios(
          matricula === undefined ? {} : { matricula },
        );
        const r = await admitir(rhA, randomUUID()).send(corpo).expect(201);
        expect(r.body.vinculo.matricula).toBeNull();
        ids.push(r.body.id);
      }
      expect(new Set(ids).size).toBe(5);
      // O reenvio com `null` e a mesma chave é reconhecido, sem 409.
      const chave = randomUUID();
      const corpo = soObrigatorios({ matricula: null });
      const primeiro = await admitir(rhA, chave).send(corpo).expect(201);
      const reenvio = await admitir(rhA, chave).send(corpo).expect(201);
      expect(reenvio.headers["idempotent-replayed"]).toBe("true");
      expect(reenvio.body.id).toBe(primeiro.body.id);
    });

    it("remover todos os contatos: registro inativo e sem valor, evento de edição só com nomes, leitura sem registro; um contato depois o reativa", async () => {
      const r = await admitir(rhA)
        .send(
          soObrigatorios({
            contatos: { celular: "(31) 98888-1771", telefone: "3133331771" },
          }),
        )
        .expect(201);
      const colaboradorId: string = r.body.id;
      const rota = `/v1/colaboradores/${colaboradorId}/contatos`;
      const registro = () =>
        prisma.contatoColaborador.findFirstOrThrow({
          where: { colaboradorId },
        });
      const ultimoEvento = () =>
        prisma.contatoColaboradorEvento.findFirstOrThrow({
          where: { colaboradorId },
          orderBy: { ocorridoEm: "desc" },
        });

      const removido = await put(rota, rhA)
        .send({ emailPessoal: "", celular: "", telefone: "" })
        .expect(200);
      expect(removido.body).toMatchObject({
        situacao: "sem_registro",
        contatos: null,
        resultado: "removido",
      });
      const inativo = await registro();
      expect(inativo).toMatchObject({
        ativo: false,
        emailPessoal: null,
        celular: null,
        telefone: null,
      });
      expect(await ultimoEvento()).toMatchObject({
        contatoId: inativo.id,
        acao: "edicao",
        resultado: "gravado",
        campos: ["celular", "telefone"],
      });

      const lido = await get(rota, rhA).expect(200);
      expect(lido.body).toMatchObject({
        situacao: "sem_registro",
        contatos: null,
      });
      expect(await ultimoEvento()).toMatchObject({
        contatoId: inativo.id,
        acao: "leitura",
        resultado: "sem_registro",
        campos: [],
      });
      // Isolamento: outra empresa não sabe que a pessoa existe.
      await get(rota, rhB).expect(404);

      const nada = await put(rota, rhA).send({}).expect(200);
      expect(nada.body).toMatchObject({
        situacao: "sem_registro",
        resultado: "sem_alteracao",
      });
      expect(await registro()).toMatchObject({ ativo: false });

      const reativado = await put(rota, rhA)
        .send({ celular: "(31) 98888-1772" })
        .expect(200);
      expect(reativado.body).toMatchObject({
        situacao: "registrado",
        resultado: "atualizado",
        contatos: {
          emailPessoal: null,
          celular: "+5531988881772",
          telefone: null,
        },
      });
      expect(await registro()).toMatchObject({ ativo: true });
      // Um só registro do par o tempo todo: nada foi apagado.
      expect(
        await prisma.contatoColaborador.count({ where: { colaboradorId } }),
      ).toBe(1);
      for (const valor of ["31988881771", "3133331771", "31988881772"]) {
        enviados.add(valor);
      }
    });

    it("o banco recusa registro ativo vazio e registro inativo com valor", async () => {
      const r = await admitir(rhA)
        .send(soObrigatorios({ contatos: { telefone: "3133331773" } }))
        .expect(201);
      const contato = await prisma.contatoColaborador.findFirstOrThrow({
        where: { colaboradorId: r.body.id },
      });
      await expect(
        prisma.contatoColaborador.update({
          where: { id: contato.id },
          data: { telefone: null },
        }),
      ).rejects.toThrow();
      await expect(
        prisma.contatoColaborador.update({
          where: { id: contato.id },
          data: { ativo: false },
        }),
      ).rejects.toThrow();
      enviados.add("3133331773");
    });
  });

  describe("trilhas sem valores", () => {
    it("`audit_event` e as trilhas de tratamento não contêm e-mail, telefone, CEP nem matrícula enviados", async () => {
      expect(enviados.size).toBeGreaterThan(50);
      for (const tabela of [
        "audit_event",
        "contato_colaborador_evento",
        "dados_pessoais_colaborador_evento",
        "idempotencia_admissao",
        "revisao_normalizacao_cadastro",
      ]) {
        const linhas = await prisma.$queryRawUnsafe<{ linha: string }[]>(
          `SELECT row_to_json(t)::text AS linha FROM app."${tabela}" t`,
        );
        const texto = linhas.map((l) => l.linha).join("\n");
        for (const valor of enviados) {
          expect([tabela, texto.includes(valor)]).toEqual([tabela, false]);
          expect([tabela, texto.includes(valor.toLowerCase())]).toEqual([
            tabela,
            false,
          ]);
        }
      }
    });
  });
});

// ---------------------------------------------------------------------------
// Migration de dados da T179 sobre cadastro já existente
// ---------------------------------------------------------------------------

describe("Migration T179 sobre dados já gravados (e2e)", () => {
  /** Cópia de `prisma/` SEM a migration da T179 — o banco "antes" dela. */
  function prismaSemT179(): string {
    const destino = mkdtempSync(join(tmpdir(), "evolli-t179-"));
    cpSync(join(API_ROOT, "prisma"), destino, {
      recursive: true,
      filter: (origem) => !origem.includes(MIGRATION_T179),
    });
    return destino;
  }
  function acrescentarT179(destino: string): void {
    cpSync(
      join(API_ROOT, "prisma", "migrations", MIGRATION_T179),
      join(destino, "migrations", MIGRATION_T179),
      { recursive: true },
    );
  }

  /**
   * Cadastro legado, como o deixava o servidor antes da T179 (só dígitos, `+`
   * opcional; CEP em texto livre), inserido pelo papel de migração — dono das
   * tabelas — numa transação só: os gatilhos diferidos exigem o vínculo.
   */
  async function semearLegado(
    migratorUrl: string,
    pessoas: {
      empresa: string;
      email: string;
      celular: string;
      telefone: string;
      pais?: string;
      cep?: string;
    }[],
  ) {
    const cliente = new PrismaClient({
      datasources: { db: { url: migratorUrl } },
    });
    const ator = randomUUID();
    const empresas = new Map<string, string>();
    const criados: {
      colaboradorId: string;
      empresaId: string;
      contatoId: string;
      enderecoId: string | null;
    }[] = [];
    try {
      await cliente.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `INSERT INTO app.access_user (id, email, password_hash, role, status, created_at, updated_at)
           VALUES ($1, 'rh.legado@example.test', 'hash-sintetico', 'rh', 'active', now(), now())`,
          ator,
        );
        for (const [i, p] of pessoas.entries()) {
          let empresaId = empresas.get(p.empresa);
          if (!empresaId) {
            empresaId = randomUUID();
            empresas.set(p.empresa, empresaId);
            await tx.$executeRawUnsafe(
              `INSERT INTO app.empresa (id, codigo, nome, criado_em, atualizado_em)
               VALUES ($1, $2, $3, now(), now())`,
              empresaId,
              p.empresa,
              `Empresa ${p.empresa}`,
            );
          }
          const colaboradorId = randomUUID();
          const contatoId = randomUUID();
          await tx.$executeRawUnsafe(
            `INSERT INTO app.colaborador (id, nome, criado_em, atualizado_em)
             VALUES ($1, $2, now(), now())`,
            colaboradorId,
            `Pessoa Sintetica Legada ${i}`,
          );
          await tx.$executeRawUnsafe(
            `INSERT INTO app.vinculo_funcional
               (id, colaborador_id, empresa_id, matricula, tipo, situacao,
                data_admissao, criado_em, atualizado_em)
             VALUES ($1, $2, $3, $4, 'clt', 'previsto', DATE '2026-01-05', now(), now())`,
            randomUUID(),
            colaboradorId,
            empresaId,
            `LEG-${i}`,
          );
          await tx.$executeRawUnsafe(
            `INSERT INTO app.contato_colaborador
               (id, empresa_id, colaborador_id, email_pessoal, celular, telefone,
                criado_por_user_id, atualizado_por_user_id, criado_em, atualizado_em)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $7, now(), TIMESTAMP '2026-10-01 12:00:00')`,
            contatoId,
            empresaId,
            colaboradorId,
            p.email,
            p.celular,
            p.telefone,
            ator,
          );
          let enderecoId: string | null = null;
          if (p.cep !== undefined) {
            enderecoId = randomUUID();
            await tx.$executeRawUnsafe(
              `INSERT INTO app.endereco_colaborador
                 (id, empresa_id, colaborador_id, pais, cep,
                  criado_por_user_id, atualizado_por_user_id, criado_em, atualizado_em)
               VALUES ($1, $2, $3, $4, $5, $6, $6, now(), TIMESTAMP '2026-10-01 12:00:00')`,
              enderecoId,
              empresaId,
              colaboradorId,
              p.pais ?? null,
              p.cep,
              ator,
            );
          }
          criados.push({ colaboradorId, empresaId, contatoId, enderecoId });
        }
      });
    } finally {
      await cliente.$disconnect();
    }
    return criados;
  }

  describe("converte o inequívoco e lista o resto sem valor", () => {
    let container: StartedTestContainer;
    let migratorUrl: string;
    let appUrl: string;
    let pasta: string;
    let migrator: PrismaClient;
    let criados: Awaited<ReturnType<typeof semearLegado>>;

    // Cada linha: o que já estava gravado e o que a migration deve deixar.
    const LEGADO = [
      {
        empresa: "LEGA",
        email: "legado.um@example.test",
        celular: "11987654321",
        telefone: "1130000000",
        pais: "Brasil",
        cep: "01001-000",
        esperado: {
          celular: "+5511987654321",
          telefone: "+551130000000",
          cep: "01001000",
        },
        revisao: [] as string[],
      },
      {
        empresa: "LEGA",
        email: "legado.dois@example.test",
        celular: "5511987654321",
        telefone: "+5511987654321",
        pais: "Brasil",
        cep: "01001000",
        esperado: {
          celular: "+5511987654321",
          telefone: "+5511987654321",
          cep: "01001000",
        },
        revisao: [],
      },
      {
        empresa: "LEGA",
        email: "legado.tres@example.test",
        celular: "+442079460958",
        telefone: "0119876543210",
        pais: "Brasil",
        cep: "ABC123",
        esperado: {
          celular: "+442079460958",
          telefone: "0119876543210",
          cep: "ABC123",
        },
        revisao: ["celular", "telefone", "cep"],
      },
      {
        empresa: "LEGA",
        email: "legado.quatro@example.test",
        celular: "12345678",
        telefone: "551130000000",
        pais: "Inglaterra",
        cep: "SW1A 1AA",
        esperado: {
          celular: "12345678",
          telefone: "+551130000000",
          cep: "SW1A 1AA",
        },
        revisao: ["celular"],
      },
      {
        empresa: "LEGB",
        email: "legado.cinco@example.test",
        celular: "11887654321",
        telefone: "1163334444",
        pais: "BRASIL",
        cep: "20040-002",
        esperado: {
          celular: "11887654321",
          telefone: "1163334444",
          cep: "20040002",
        },
        revisao: ["celular", "telefone"],
      },
      {
        empresa: "LEGB",
        email: "legado.seis@example.test",
        celular: "21987654321",
        telefone: "2133334444",
        pais: "Brasil",
        cep: "0100-1000",
        esperado: {
          celular: "+5521987654321",
          telefone: "+552133334444",
          cep: "0100-1000",
        },
        revisao: ["cep"],
      },
    ];

    beforeAll(async () => {
      const banco = await subirBanco();
      container = banco.container;
      migratorUrl = banco.migratorUrl;
      appUrl = banco.appUrl;
      pasta = prismaSemT179();
      migrar(migratorUrl, join(pasta, "schema.prisma"));
      migrator = new PrismaClient({
        datasources: { db: { url: migratorUrl } },
      });
      // Sanidade: o banco está ANTES da T179.
      const antes = await migrator.$queryRawUnsafe<{ existe: string | null }[]>(
        `SELECT to_regclass('app.idempotencia_admissao')::text AS existe`,
      );
      expect(antes[0]!.existe).toBeNull();

      criados = await semearLegado(migratorUrl, LEGADO);
      acrescentarT179(pasta);
      migrar(migratorUrl, join(pasta, "schema.prisma"));
    });

    afterAll(async () => {
      await migrator?.$disconnect();
      await container?.stop();
      if (pasta) rmSync(pasta, { recursive: true, force: true });
    });

    it("a migration da T179 foi aplicada sobre o banco legado", async () => {
      const aplicadas = await migrator.$queryRawUnsafe<
        { migration_name: string; finished_at: Date | null }[]
      >(
        `SELECT migration_name, finished_at FROM app._prisma_migrations
          WHERE migration_name = $1`,
        MIGRATION_T179,
      );
      expect(aplicadas).toHaveLength(1);
      expect(aplicadas[0]!.finished_at).not.toBeNull();
    });

    it("telefones convertidos para +55 só quando inequívocos; os demais intactos", async () => {
      for (const [i, linha] of LEGADO.entries()) {
        const contato = await migrator.contatoColaborador.findUniqueOrThrow({
          where: { id: criados[i]!.contatoId },
        });
        expect([linha.email, contato.celular, contato.telefone]).toEqual([
          linha.email,
          linha.esperado.celular,
          linha.esperado.telefone,
        ]);
        // Conversão de forma não é edição: `atualizado_em` não muda.
        expect(contato.atualizadoEm.toISOString()).toBe(
          "2026-10-01T12:00:00.000Z",
        );
      }
    });

    it("CEP brasileiro convertido para 8 dígitos só quando inequívoco; outro país e o inválido intactos", async () => {
      for (const [i, linha] of LEGADO.entries()) {
        const endereco = await migrator.enderecoColaborador.findUniqueOrThrow({
          where: { id: criados[i]!.enderecoId! },
        });
        expect([linha.email, endereco.cep]).toEqual([
          linha.email,
          linha.esperado.cep,
        ]);
        expect(endereco.atualizadoEm.toISOString()).toBe(
          "2026-10-01T12:00:00.000Z",
        );
      }
    });

    it("o que não converteu está em `revisao_normalizacao_cadastro`, com registro e NOME do campo", async () => {
      const revisoes = await migrator.revisaoNormalizacaoCadastro.findMany();
      const esperadas = LEGADO.flatMap((linha, i) =>
        linha.revisao.map((campo) => ({
          empresaId: criados[i]!.empresaId,
          colaboradorId: criados[i]!.colaboradorId,
          entidade:
            campo === "cep" ? "endereco_colaborador" : "contato_colaborador",
          registroId:
            campo === "cep" ? criados[i]!.enderecoId : criados[i]!.contatoId,
          campo,
          motivo: "forma_nao_inequivoca",
        })),
      );
      const ordenar = <T extends { registroId: string | null; campo: string }>(
        lista: T[],
      ) =>
        [...lista].sort((a, b) =>
          `${a.registroId}${a.campo}`.localeCompare(
            `${b.registroId}${b.campo}`,
          ),
        );
      expect(
        ordenar(
          revisoes.map((r) => ({
            empresaId: r.empresaId,
            colaboradorId: r.colaboradorId,
            entidade: r.entidade,
            registroId: r.registroId,
            campo: r.campo,
            motivo: r.motivo,
          })),
        ),
      ).toEqual(ordenar(esperadas));
      expect(revisoes).toHaveLength(7);
    });

    it("`revisao_normalizacao_cadastro` não guarda valor nenhum", async () => {
      const colunas = await migrator.$queryRawUnsafe<{ column_name: string }[]>(
        `SELECT column_name FROM information_schema.columns
          WHERE table_schema = 'app' AND table_name = 'revisao_normalizacao_cadastro'
          ORDER BY column_name`,
      );
      expect(colunas.map((c) => c.column_name)).toEqual(
        [
          "campo",
          "colaborador_id",
          "criado_em",
          "empresa_id",
          "entidade",
          "id",
          "motivo",
          "registro_id",
        ].sort(),
      );
      const linhas = await migrator.$queryRawUnsafe<{ linha: string }[]>(
        `SELECT row_to_json(t)::text AS linha FROM app.revisao_normalizacao_cadastro t`,
      );
      const texto = linhas.map((l) => l.linha).join("\n");
      for (const linha of LEGADO) {
        for (const valor of [
          linha.email,
          linha.celular,
          linha.telefone,
          linha.cep,
          linha.esperado.celular,
          linha.esperado.telefone,
          linha.esperado.cep,
        ]) {
          expect(texto).not.toContain(valor);
        }
      }
    });

    it("a conversão não deixa trilha com valor, nem evento de tratamento", async () => {
      expect(await migrator.contatoColaboradorEvento.count()).toBe(0);
      expect(await migrator.dadosPessoaisColaboradorEvento.count()).toBe(0);
      expect(await migrator.auditEvent.count()).toBe(0);
    });

    it("a aplicação só lê a revisão; e o e-mail pessoal passa a ser único na empresa", async () => {
      const privilegios = await migrator.$queryRawUnsafe<
        {
          select: boolean;
          insert: boolean;
          update: boolean;
          delete: boolean;
        }[]
      >(
        `SELECT has_table_privilege('evolli_app', 'app.revisao_normalizacao_cadastro', 'SELECT') AS "select",
                has_table_privilege('evolli_app', 'app.revisao_normalizacao_cadastro', 'INSERT') AS "insert",
                has_table_privilege('evolli_app', 'app.revisao_normalizacao_cadastro', 'UPDATE') AS "update",
                has_table_privilege('evolli_app', 'app.revisao_normalizacao_cadastro', 'DELETE') AS "delete"`,
      );
      expect(privilegios[0]).toEqual({
        select: true,
        insert: false,
        update: false,
        delete: false,
      });
      const app = new PrismaClient({ datasources: { db: { url: appUrl } } });
      try {
        expect(await app.revisaoNormalizacaoCadastro.count()).toBe(7);
        await expect(
          app.revisaoNormalizacaoCadastro.deleteMany({}),
        ).rejects.toThrow();
      } finally {
        await app.$disconnect();
      }
      const indice = await migrator.$queryRawUnsafe<{ indexdef: string }[]>(
        `SELECT indexdef FROM pg_indexes
          WHERE schemaname = 'app'
            AND indexname = 'contato_colaborador_empresa_id_email_pessoal_key'`,
      );
      expect(indice[0]!.indexdef).toMatch(/UNIQUE/);
    });
  });

  describe("e-mail já repetido na mesma empresa", () => {
    let container: StartedTestContainer;
    let migratorUrl: string;
    let pasta: string;

    const REPETIDO_1 = "legado.repetido.um@example.test";
    const REPETIDO_2 = "legado.repetido.dois@example.test";

    afterAll(async () => {
      await container?.stop();
      if (pasta) rmSync(pasta, { recursive: true, force: true });
    });

    it("a migration PARA, dizendo só a contagem de grupos — nenhum e-mail na mensagem — e não muda nada", async () => {
      const banco = await subirBanco();
      container = banco.container;
      migratorUrl = banco.migratorUrl;
      pasta = prismaSemT179();
      migrar(migratorUrl, join(pasta, "schema.prisma"));
      const criados = await semearLegado(migratorUrl, [
        // Dois grupos repetidos na LEGD1…
        {
          empresa: "LEGD1",
          email: REPETIDO_1,
          celular: "11987654321",
          telefone: "1130000000",
        },
        {
          empresa: "LEGD1",
          email: REPETIDO_1,
          celular: "11987654322",
          telefone: "1130000001",
        },
        {
          empresa: "LEGD1",
          email: REPETIDO_2,
          celular: "11987654323",
          telefone: "1130000002",
        },
        {
          empresa: "LEGD1",
          email: REPETIDO_2,
          celular: "11987654324",
          telefone: "1130000003",
        },
        // …e o mesmo e-mail em OUTRA empresa, que não conta.
        {
          empresa: "LEGD2",
          email: REPETIDO_1,
          celular: "11987654325",
          telefone: "1130000004",
        },
      ]);
      acrescentarT179(pasta);

      let saida = "";
      try {
        migrar(migratorUrl, join(pasta, "schema.prisma"));
        throw new Error("a migration deveria ter parado");
      } catch (erro) {
        const e = erro as { stdout?: Buffer; stderr?: Buffer; message: string };
        saida = [e.message, e.stdout?.toString(), e.stderr?.toString()].join(
          "\n",
        );
      }
      expect(saida).toContain(
        "T179: 2 grupo(s) de e-mail pessoal repetido na mesma empresa",
      );
      for (const valor of [
        REPETIDO_1,
        REPETIDO_2,
        "legado.repetido",
        "11987654321",
        "1130000000",
      ]) {
        expect(saida).not.toContain(valor);
      }

      const migrator = new PrismaClient({
        datasources: { db: { url: migratorUrl } },
      });
      try {
        const estado = await migrator.$queryRawUnsafe<
          {
            idempotencia: string | null;
            revisao: string | null;
            indice: string | null;
          }[]
        >(
          `SELECT to_regclass('app.idempotencia_admissao')::text AS idempotencia,
                  to_regclass('app.revisao_normalizacao_cadastro')::text AS revisao,
                  to_regclass('app.contato_colaborador_empresa_id_email_pessoal_key')::text AS indice`,
        );
        expect(estado[0]).toEqual({
          idempotencia: null,
          revisao: null,
          indice: null,
        });
        // Nem os telefones foram convertidos: a migration parou antes.
        const contatos = await migrator.contatoColaborador.findMany({
          where: { id: { in: criados.map((c) => c.contatoId) } },
          select: { celular: true },
        });
        expect(contatos.map((c) => c.celular).sort()).toEqual([
          "11987654321",
          "11987654322",
          "11987654323",
          "11987654324",
          "11987654325",
        ]);
        const registro = await migrator.$queryRawUnsafe<
          { finished_at: Date | null }[]
        >(
          `SELECT finished_at FROM app._prisma_migrations WHERE migration_name = $1`,
          MIGRATION_T179,
        );
        expect(registro.every((r) => r.finished_at === null)).toBe(true);
      } finally {
        await migrator.$disconnect();
      }
    });
  });
});
