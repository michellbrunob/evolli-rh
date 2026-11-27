import { execFileSync } from "node:child_process";
import { join } from "node:path";
import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { PrismaClient } from "@prisma/client";
import cookieParser from "cookie-parser";
import request from "supertest";
import { GenericContainer, StartedTestContainer, Wait } from "testcontainers";
import { AppModule } from "../src/app.module";
import { ProcessadorDePesquisas } from "../src/pesquisas/modelos/processador-de-pesquisas";
import { secoesDaAvaliacao } from "../src/pesquisas/modelos/avaliacao/definicao";
import { ArmazenamentoEmMemoria } from "../src/pessoas/foto-colaborador/armazenamento-de-objetos";
import { ARMAZENAMENTO_DE_DOCUMENTOS } from "../src/pessoas/documentos-colaborador/armazenamento-de-documentos";
import {
  VERIFICADOR_DE_ARQUIVOS,
  VerificadorFalso,
} from "../src/pessoas/documentos-colaborador/verificador-de-arquivos";
import { AllExceptionsFilter } from "../src/common/filters/http-exception.filter";
import { requestIdMiddleware } from "../src/common/request-id";
import { aplicarLimiteDoCorpo } from "../src/common/corpo-json";
import {
  hojeEmSaoPaulo,
  somarDias,
  somarMeses,
} from "../src/pessoas/ausencias/calculo-ausencias";
import {
  camposObrigatoriosAdmissao,
  lotacaoMinima,
} from "./admissao-obrigatoria";

/**
 * T216 — Avaliação 90°/180° e Onboarding automático: times pela liderança,
 * resposta do gestor e da autoavaliação pelo link, resultados, ficha, os
 * convites (aguardando e-mail) e a resposta por rodada. PostgreSQL real e
 * efêmero (Testcontainers), migrations do zero.
 *
 * **Todos os dados são sintéticos.** Domínio reservado `example.test`; CPFs
 * gerados pela regra dos dígitos verificadores, sem relação com ninguém.
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
const SENHA_PADRAO = "Pesquisas!Sinteticas#2026";
/** O nascimento que `camposObrigatoriosAdmissao` grava. */
const NASCIMENTO = "1990-01-15";

const HOJE = hojeEmSaoPaulo();
const ADMISSAO = somarMeses(HOJE, -6);

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

/** CPF sintético com os dígitos verificadores certos. */
let sequenciaCpf = 0;
function cpfSintetico(): string {
  sequenciaCpf += 1;
  const base = String(310_000_000 + sequenciaCpf * 7).padStart(9, "0");
  const dv = (s: string, peso: number) => {
    let soma = 0;
    for (const ch of s) soma += Number(ch) * peso--;
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  const d1 = dv(base, 10);
  const d2 = dv(`${base}${d1}`, 11);
  return `${base}${d1}${d2}`;
}

const formatarCpf = (c: string) =>
  `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}`;

interface Credencial {
  cookie: string;
  csrfToken: string;
}

interface Pessoa {
  id: string;
  nome: string;
  cpf: string;
}

/** A estrutura usada na maior parte da suíte. */
function estrutura() {
  return [
    {
      id: "s-geral",
      titulo: "Geral",
      descricao: null,
      perguntas: [
        {
          id: "gosta",
          tipo: "sim_nao",
          texto: "Você recomendaria trabalhar aqui?",
          rotulo: null,
          descricao: null,
          obrigatoria: true,
          config: { respostaBoa: "sim" },
          condicao: null,
        },
        {
          id: "porque",
          tipo: "paragrafo",
          texto: "O que precisa melhorar?",
          rotulo: null,
          descricao: null,
          obrigatoria: true,
          config: {},
          condicao: { perguntaId: "gosta", opcaoId: "nao" },
        },
        {
          id: "clima",
          tipo: "concordancia",
          texto: "O ambiente de trabalho é respeitoso.",
          rotulo: "Respeito",
          descricao: null,
          obrigatoria: true,
          config: {},
          condicao: null,
        },
      ],
    },
    {
      id: "s-nota",
      titulo: null,
      descricao: null,
      perguntas: [
        {
          id: "enps",
          tipo: "nota_0_10",
          texto: "De 0 a 10, quanto recomendaria a empresa?",
          rotulo: null,
          descricao: null,
          obrigatoria: false,
          config: { enps: true },
          condicao: null,
        },
        {
          id: "comentario",
          tipo: "texto_curto",
          texto: "Comentário",
          rotulo: null,
          descricao: null,
          obrigatoria: false,
          config: {},
          condicao: null,
        },
      ],
    },
  ];
}

describe("T216 — Avaliação 90°/180° e Onboarding (e2e)", () => {
  let container: StartedTestContainer;
  let app: INestApplication;
  let prisma: PrismaClient;
  let appUrl: string;
  let migratorUrl: string;

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
    return login(email);
  }

  async function criarDireto(
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

  const armazenamento = new ArmazenamentoEmMemoria();

  let sequencia = 0;
  function corpo(extra: Record<string, unknown> = {}) {
    return {
      nome: "Pesquisa de clima sintética",
      boasVindas: "Leva poucos minutos.",
      modelo: "clima",
      identificacao: "identificada",
      secoes: estrutura(),
      participantes: { todos: false, colaboradorIds: [] as string[] },
      encerraEm: null,
      minimoPorGrupo: 3,
      ...extra,
    };
  }

  const publico = (token: string, sufixo = "") =>
    `/v1/publico/pesquisas/${token}${sufixo}`;

  function identificar(token: string, pessoa: Pessoa) {
    return agent()
      .post(publico(token, "/identificar"))
      .send({ cpf: formatarCpf(pessoa.cpf), dataNascimento: NASCIMENTO });
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

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ARMAZENAMENTO_DE_DOCUMENTOS)
      .useValue(armazenamento)
      .overrideProvider(VERIFICADOR_DE_ARQUIVOS)
      .useValue(new VerificadorFalso())
      .compile();
    const expressApp =
      moduleRef.createNestApplication<NestExpressApplication>();
    // O mesmo limite do bootstrap (src/main.ts).
    aplicarLimiteDoCorpo(expressApp);
    app = expressApp;
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

    master = await criarDireto(
      "master.pesquisas@example.test",
      "master_tecnico",
      null,
    );
    const empresa = async (codigo: string) =>
      (
        await post("/v1/empresas", master)
          .send({ codigo, nome: `Empresa ${codigo}` })
          .expect(201)
      ).body.id as string;
    empresaA = await empresa("PESA");
    empresaB = await empresa("PESB");
    rhA = await criarUsuario("rh.pesa@example.test", "rh", empresaA);
    dpA = await criarUsuario("dp.pesa@example.test", "dp", empresaA);
    rhB = await criarUsuario("rh.pesb@example.test", "rh", empresaB);
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
        await criarDireto(`${papel}.pesa@example.test`, papel, empresaA),
      ]);
    }
    masterA = await criarDireto(
      "master.pesquisas.a@example.test",
      "master_tecnico",
      null,
    );
    await post("/v1/auth/contexto/empresa", masterA)
      .send({ empresaId: empresaA })
      .expect(200);
  });

  afterAll(async () => {
    await app?.close();
    await prisma?.$disconnect();
    await container?.stop();
  });

  // -----------------------------------------------------------------------
  // T216 — Avaliação 90°/180° e Onboarding automático

  const dia = (n: number) => somarDias(HOJE, n);
  const processador = () => app.get(ProcessadorDePesquisas);

  /** Admite com a data e a equipe pedidas; CPF sintético opcional. */
  async function admitirEm(
    dataAdmissao: string,
    equipeId: string | null,
    comCpf = true,
  ): Promise<Pessoa> {
    sequencia += 1;
    const nome = `Pessoa Modelo ${String.fromCharCode(65 + (sequencia % 26))}${sequencia}`;
    const r = await post("/v1/colaboradores", rhA)
      .send({
        ...camposObrigatoriosAdmissao(),
        ...(await lotacaoMinima(appUrl, empresaA)),
        ...(equipeId ? { equipeId } : {}),
        nome,
        empresaId: empresaA,
        tipo: "clt",
        dataAdmissao,
        motivoCodigo: "admissao_inicial",
      })
      .expect(201);
    await post(`/v1/movimentacoes/${r.body.movimentacao.id}/efetivar`, rhA)
      .send()
      .expect(201);
    const cpf = comCpf ? cpfSintetico() : "";
    if (comCpf) {
      await prisma.perfilPessoalColaborador.updateMany({
        where: { colaboradorId: r.body.id, empresaId: empresaA },
        data: { cpf },
      });
    }
    return { id: r.body.id as string, nome, cpf };
  }

  async function passeDe(token: string, pessoa: Pessoa): Promise<string> {
    const r = await identificar(token, pessoa).expect(200);
    return r.body.passe as string;
  }

  const notas = (n: number, exceto: Record<string, number> = {}) =>
    secoesDaAvaliacao().flatMap((s) =>
      s.perguntas.map((p) => ({ perguntaId: p.id, valor: exceto[p.id] ?? n })),
    );

  interface ItemPendente {
    parId: string;
    papel: string;
    avaliado: { nome: string };
    aberta: boolean;
    comparativo: unknown;
  }

  describe("avaliação 180°", () => {
    let gestora: Pessoa;
    let a1: Pessoa;
    let a2: Pessoa;
    let semCpf: Pessoa;
    let pesquisaId: string;
    let token: string;

    beforeAll(async () => {
      const lot = await lotacaoMinima(appUrl, empresaA);
      const equipe = (
        await post("/v1/equipes", master)
          .send({
            codigo: "EQ_AVAL",
            nome: "Equipe Avaliação",
            departamentoId: lot.departamentoId,
          })
          .expect(201)
      ).body.id as string;
      gestora = await admitirEm(ADMISSAO, null);
      a1 = await admitirEm(ADMISSAO, equipe);
      a2 = await admitirEm(ADMISSAO, equipe);
      semCpf = await admitirEm(ADMISSAO, equipe, false);
      await post("/v1/gestor/administracao/atribuicoes", rhA)
        .send({
          equipeId: equipe,
          gestorColaboradorId: gestora.id,
          papel: "principal",
          vigenciaInicio: ADMISSAO,
        })
        .expect(201);
    });

    it("organograma: o time da gestora pela equipe; ela fica sem gestor", async () => {
      const r = await get("/v1/pesquisas/avaliacoes/organograma", rhA).expect(
        200,
      );
      const times = r.body.times as {
        gestor: { id: string };
        pessoas: { id: string; identificavel: boolean }[];
      }[];
      const time = times.find((t) => t.gestor.id === gestora.id)!;
      expect(time.pessoas.map((p) => p.id).sort()).toEqual(
        [a1.id, a2.id, semCpf.id].sort(),
      );
      expect(time.pessoas.find((p) => p.id === semCpf.id)!.identificavel).toBe(
        false,
      );
      const sem = r.body.semGestor as {
        pessoa: { id: string };
        motivo: string;
      }[];
      expect(sem.find((s) => s.pessoa.id === gestora.id)!.motivo).toBe(
        "sem_gestor",
      );
      // CPF, nascimento e e-mail nunca saem.
      expect(JSON.stringify(r.body)).not.toContain(a1.cpf);
      await get(
        "/v1/pesquisas/avaliacoes/organograma",
        outrosPapeis[0]![1],
      ).expect(403);
    });

    it("cria, grava os times (pares e participantes) e recusa time inválido", async () => {
      const criada = await post("/v1/pesquisas", rhA)
        .send(
          corpo({
            nome: "Avaliação 180° sintética",
            modelo: "avaliacao180",
            secoes: secoesDaAvaliacao(),
            encerraEm: `${dia(30)}T23:59`,
          }),
        )
        .expect(201);
      pesquisaId = criada.body.id;
      await put(`/v1/pesquisas/${pesquisaId}/avaliacao`, rhA)
        .send({ times: [{ gestorId: semCpf.id, avaliadoIds: [a1.id] }] })
        .expect(422)
        .expect((r) =>
          expect(r.body.erros).toEqual([
            { campo: "times", motivo: "gestor_nao_identificavel" },
          ]),
        );
      await put(`/v1/pesquisas/${pesquisaId}/avaliacao`, rhA)
        .send({ times: [{ gestorId: gestora.id, avaliadoIds: [gestora.id] }] })
        .expect(422);
      await put(`/v1/pesquisas/${pesquisaId}/avaliacao`, rhA)
        .send({
          config: { prazoAutoavaliacao: `${dia(40)}T10:00` },
          times: [{ gestorId: gestora.id, avaliadoIds: [a1.id] }],
        })
        .expect(422)
        .expect((r) =>
          expect(r.body.erros).toEqual([
            { campo: "prazoAutoavaliacao", motivo: "fora_de_ordem" },
          ]),
        );
      const r = await put(`/v1/pesquisas/${pesquisaId}/avaliacao`, rhA)
        .send({
          config: { comentarios: "extremos", envio: "email" },
          times: [
            { gestorId: gestora.id, avaliadoIds: [a1.id, a2.id, semCpf.id] },
          ],
        })
        .expect(200);
      expect(r.body.totais).toEqual({
        gestores: 1,
        pessoas: 3,
        autoavaliacoes: 2,
        respondidas: 0,
        pendentes: 5,
      });
      const participantes = await prisma.pesquisaParticipante.findMany({
        where: { pesquisaId },
        select: { colaboradorId: true },
      });
      expect(participantes.map((x) => x.colaboradorId).sort()).toEqual(
        [gestora.id, a1.id, a2.id].sort(),
      );
      // Tirar e pôr de novo (sem resposta) funciona; DP também grava.
      await put(`/v1/pesquisas/${pesquisaId}/avaliacao`, dpA)
        .send({ times: [{ gestorId: gestora.id, avaliadoIds: [a1.id] }] })
        .expect(200);
      expect(
        await prisma.pesquisaAvaliacaoPar.count({ where: { pesquisaId } }),
      ).toBe(2);
      await put(`/v1/pesquisas/${pesquisaId}/avaliacao`, rhA)
        .send({
          config: { comentarios: "extremos" },
          times: [
            { gestorId: gestora.id, avaliadoIds: [a1.id, a2.id, semCpf.id] },
          ],
        })
        .expect(200);
      // Outra empresa não enxerga; o master só lê.
      await get(`/v1/pesquisas/${pesquisaId}/avaliacao`, rhB).expect(404);
      await get(`/v1/pesquisas/${pesquisaId}/avaliacao`, masterA).expect(200);
      await put(`/v1/pesquisas/${pesquisaId}/avaliacao`, masterA)
        .send({ times: [] })
        .expect(403);
    });

    it("publica e a gestora avalia uma pessoa por vez pelo link", async () => {
      const pub = await post(`/v1/pesquisas/${pesquisaId}/publicar`, rhA)
        .send()
        .expect(200);
      token = (pub.body.link as string).replace("#/p/", "");
      const passe = await passeDe(token, gestora);
      const pend = await agent()
        .post(publico(token, "/avaliacao/pendentes"))
        .send({ passe })
        .expect(200);
      const itens = pend.body.itens as ItemPendente[];
      expect(itens).toHaveLength(3);
      expect(itens.every((i) => i.papel === "gestor" && i.aberta)).toBe(true);
      const par = (nome: string) =>
        itens.find((i) => i.avaliado.nome === nome)!.parId;
      await agent()
        .post(publico(token, `/avaliacao/pares/${par(a1.nome)}`))
        .send({ passe, respostas: notas(4) })
        .expect(201)
        .expect((r) => expect(r.body.restantes).toBe(2));
      await agent()
        .post(publico(token, `/avaliacao/pares/${par(a1.nome)}`))
        .send({ passe, respostas: notas(4) })
        .expect(409);
      // Notas extremas pedem comentário.
      await agent()
        .post(publico(token, `/avaliacao/pares/${par(a2.nome)}`))
        .send({ passe, respostas: notas(5) })
        .expect(422)
        .expect((r) => expect(r.body.erros).toHaveLength(8));
      await agent()
        .post(publico(token, `/avaliacao/pares/${par(a2.nome)}`))
        .send({
          passe,
          respostas: notas(5),
          comentarios: {
            comunicacao: "a",
            trabalho_equipe: "b",
            proatividade: "c",
            organizacao: "d",
            responsabilidade: "e",
            adaptabilidade: "f",
            lideranca: "g",
            resolucao_problemas: "h",
          },
        })
        .expect(201);
      // Passe errado não entra.
      await agent()
        .post(publico(token, `/avaliacao/pares/${par(semCpf.nome)}`))
        .send({ passe: "x".repeat(43), respostas: notas(3) })
        .expect(401);
      await agent()
        .post(publico(token, `/avaliacao/pares/${par(semCpf.nome)}`))
        .send({ passe, respostas: notas(3) })
        .expect(201)
        .expect((r) => expect(r.body.restantes).toBe(0));
      // Terminou: o passe sai e não dá para entrar de novo.
      await agent()
        .post(publico(token, "/avaliacao/pendentes"))
        .send({ passe })
        .expect(401);
      await identificar(token, gestora).expect(409);
      // A resposta não guarda a pessoa: o par liga avaliado e avaliador.
      const respostas = await prisma.pesquisaResposta.findMany({
        where: { pesquisaId },
        select: { colaboradorId: true, par: { select: { avaliadoId: true } } },
      });
      expect(respostas.every((x) => x.colaboradorId === null)).toBe(true);
      expect(respostas.map((x) => x.par!.avaliadoId).sort()).toEqual(
        [a1.id, a2.id, semCpf.id].sort(),
      );
    });

    it("a pessoa faz a autoavaliação sem ver a nota do gestor", async () => {
      const passe = await passeDe(token, a1);
      const pend = await agent()
        .post(publico(token, "/avaliacao/pendentes"))
        .send({ passe })
        .expect(200);
      const itens = pend.body.itens as ItemPendente[];
      expect(itens).toHaveLength(1);
      expect(itens[0]!.papel).toBe("autoavaliacao");
      expect(itens[0]!.comparativo).toBeNull();
      await agent()
        .post(publico(token, `/avaliacao/pares/${itens[0]!.parId}`))
        .send({ passe, respostas: notas(4, { lid_1: 5 }) })
        .expect(201);
    });

    it("resultados do time e da pessoa (RH e DP; master não), com trilha", async () => {
      const r = await get(
        `/v1/pesquisas/${pesquisaId}/avaliacao/resultados`,
        rhA,
      ).expect(200);
      expect(r.body.avaliadas).toBe(3);
      expect(r.body.autoavaliacoes).toEqual({ previstas: 2, respondidas: 1 });
      expect(r.body.time.media).toBe(4);
      expect([...r.body.time.grupos.destaque].sort()).toEqual(
        [a1.id, a2.id].sort(),
      );
      expect(r.body.comparativo.completas).toBe(1);
      const pessoas = r.body.pessoas as {
        colaboradorId: string;
        alinhamento: string | null;
        nota: { geral: number };
      }[];
      const p1 = pessoas.find((x) => x.colaboradorId === a1.id)!;
      expect(p1.nota.geral).toBe(4);
      expect(p1.alinhamento).toBe("alinhada");
      await get(`/v1/pesquisas/${pesquisaId}/avaliacao/resultados`, dpA).expect(
        200,
      );
      await get(
        `/v1/pesquisas/${pesquisaId}/avaliacao/resultados`,
        masterA,
      ).expect(403);
      const d = await get(
        `/v1/pesquisas/${pesquisaId}/avaliacao/pessoas/${a1.id}`,
        rhA,
      ).expect(200);
      expect(d.body.gestorAvaliacao.nota.geral).toBe(4);
      expect(d.body.autoavaliacao.nota.competencias.lideranca).toBe(4.3);
      expect(d.body.comparativo.diferenca).toBe(0);
      expect(d.body.roteiro.at(-1).passo).toBe("plano");
      await get(
        `/v1/pesquisas/${pesquisaId}/avaliacao/pessoas/${gestora.id}`,
        rhA,
      ).expect(404);
      const trilha = await prisma.auditEvent.count({
        where: {
          resourceId: pesquisaId,
          action: "pesquisas_respostas_consultadas",
        },
      });
      expect(trilha).toBeGreaterThanOrEqual(3);
    });

    it("aba da ficha: as avaliações sobre a pessoa", async () => {
      const r = await get(`/v1/colaboradores/${a1.id}/avaliacoes`, rhA).expect(
        200,
      );
      expect(r.body).toEqual([
        expect.objectContaining({
          pesquisaId,
          gestor: gestora.nome,
          geral: 4,
          nivel: "excelente",
          autoavaliacao: 4,
        }),
      ]);
      await get(`/v1/colaboradores/${a1.id}/avaliacoes`, rhB).expect(404);
    });

    it("convites aguardando e-mail, uma vez só (idempotente)", async () => {
      expect(
        await processador().processarAvaliacao(pesquisaId, new Date()),
      ).toBe(3);
      const envios = await prisma.pesquisaEnvio.findMany({
        where: { pesquisaId },
        select: { situacao: true, rodada: true },
      });
      expect(
        envios.every(
          (e) => e.situacao === "aguardando_email" && e.rodada === 0,
        ),
      ).toBe(true);
      expect(
        await processador().processarAvaliacao(pesquisaId, new Date()),
      ).toBe(0);
      const det = await get(
        `/v1/pesquisas/${pesquisaId}/avaliacao`,
        rhA,
      ).expect(200);
      expect(det.body.convites.aguardandoEmail).toBe(3);
    });

    it("par respondido não sai dos times (409)", async () => {
      await put(`/v1/pesquisas/${pesquisaId}/avaliacao`, rhA)
        .send({ times: [{ gestorId: gestora.id, avaliadoIds: [a2.id] }] })
        .expect(409);
    });
  });

  describe("onboarding automático", () => {
    const secoesDoOnboarding = () => [
      {
        id: "b1",
        titulo: "Onboarding e treinamento",
        descricao: null,
        perguntas: [
          {
            id: "q1",
            tipo: "escala",
            texto: "A integração me preparou.",
            rotulo: null,
            descricao: null,
            obrigatoria: true,
            config: {
              minimo: 1,
              maximo: 4,
              rotulos: [
                "Discordo totalmente",
                "Discordo parcialmente",
                "Concordo parcialmente",
                "Concordo totalmente",
              ],
            },
            condicao: null,
          },
        ],
      },
    ];
    let novata: Pessoa;
    let recente: Pessoa;
    let pesquisaId: string;
    let token: string;
    const amanha = () => new Date(Date.now() + 26 * 60 * 60 * 1000);

    beforeAll(async () => {
      novata = await admitirEm(dia(-35), null); // 30 dias: há 5 dias
      recente = await admitirEm(dia(-10), null); // 30 dias: daqui a 20
    });

    it("grava a configuração e recusa horário fora da faixa", async () => {
      const r = await post("/v1/pesquisas", rhA)
        .send(
          corpo({
            nome: "Onboarding sintético",
            modelo: "onboarding",
            identificacao: "confidencial",
            secoes: secoesDoOnboarding(),
          }),
        )
        .expect(201);
      pesquisaId = r.body.id;
      await put(`/v1/pesquisas/${pesquisaId}/onboarding`, rhA)
        .send({ config: { horario: "05:00" } })
        .expect(422)
        .expect((x) =>
          expect(x.body.erros).toEqual([
            { campo: "horario", motivo: "invalido" },
          ]),
        );
      const ok = await put(`/v1/pesquisas/${pesquisaId}/onboarding`, rhA)
        .send({
          config: {
            modo: "automatizar",
            rodadas: [30, 60],
            soDiasUteis: false,
            incluirAtrasados: true,
            horario: "06:00",
          },
        })
        .expect(200);
      expect(ok.body.config.rodadas).toEqual([30, 60]);
      expect(ok.body.ativa).toBe(false);
      const previa = await post("/v1/pesquisas/onboarding/publico", rhA)
        .send({ publico: { tipo: "todos" }, soDiasUteis: false })
        .expect(200);
      expect(previa.body.proximas[30]).toBeGreaterThanOrEqual(1);
      expect(JSON.stringify(previa.body)).not.toContain(novata.cpf);
    });

    it("ativa sem participante e cria os convites na data de cada pessoa", async () => {
      const r = await post(`/v1/pesquisas/${pesquisaId}/onboarding/ativar`, rhA)
        .send()
        .expect(200);
      expect(r.body.ativa).toBe(true);
      token = (r.body.link as string).replace("#/p/", "");
      // Amanhã às 06:00 já passou: o convite de hoje sai.
      await processador().processarOnboarding(pesquisaId, amanha());
      const envios = await get(
        `/v1/pesquisas/${pesquisaId}/onboarding/envios`,
        rhA,
      ).expect(200);
      const itens = envios.body.itens as {
        colaboradorId: string;
        rodada: number;
        situacao: string;
        dataPrevista: string;
      }[];
      const de = (p: Pessoa, rodada: number) =>
        itens.find((e) => e.colaboradorId === p.id && e.rodada === rodada);
      expect(de(novata, 30)).toMatchObject({
        situacao: "aguardando_email",
        dataPrevista: HOJE,
      });
      expect(de(recente, 30)).toMatchObject({
        situacao: "agendado",
        dataPrevista: dia(20),
      });
      expect(de(novata, 60)).toMatchObject({
        situacao: "agendado",
        dataPrevista: dia(25),
      });
      // Quem entrou há meses não recebe (passou há mais de 30 dias).
      expect(
        itens.filter((e) => [novata.id, recente.id].includes(e.colaboradorId)),
      ).toHaveLength(itens.length);
      await post(`/v1/pesquisas/${pesquisaId}/onboarding/ativar`, rhA)
        .send()
        .expect(409);
    });

    it("pular só o convite agendado", async () => {
      const envios = await get(
        `/v1/pesquisas/${pesquisaId}/onboarding/envios`,
        rhA,
      ).expect(200);
      const agendado = (
        envios.body.itens as {
          id: string;
          colaboradorId: string;
          rodada: number;
        }[]
      ).find((e) => e.colaboradorId === recente.id && e.rodada === 30)!;
      await post(
        `/v1/pesquisas/${pesquisaId}/onboarding/envios/${agendado.id}/pular`,
        rhA,
      )
        .send()
        .expect(204);
      await post(
        `/v1/pesquisas/${pesquisaId}/onboarding/envios/${agendado.id}/pular`,
        rhA,
      )
        .send()
        .expect(409);
    });

    it("a pessoa responde a rodada dela; a resposta guarda a rodada, sem a pessoa", async () => {
      const passe = await passeDe(token, novata);
      const r = await agent()
        .post(publico(token, "/onboarding/respostas"))
        .send({ passe, respostas: [{ perguntaId: "q1", valor: 3 }] })
        .expect(201);
      expect(r.body.rodada).toBe(30);
      const outro = await passeDe(token, novata);
      await agent()
        .post(publico(token, "/onboarding/respostas"))
        .send({ passe: outro, respostas: [{ perguntaId: "q1", valor: 3 }] })
        .expect(409);
      const gravada = await prisma.pesquisaResposta.findFirstOrThrow({
        where: { pesquisaId },
      });
      expect(gravada.rodada).toBe(30);
      expect(gravada.colaboradorId).toBeNull();
      const envio = await prisma.pesquisaEnvio.findFirstOrThrow({
        where: { pesquisaId, colaboradorId: novata.id, rodada: 30 },
      });
      expect(envio.situacao).toBe("respondido");
    });

    it("resultado por rodada (mínimo de 3) e o funil", async () => {
      const r = await get(
        `/v1/pesquisas/${pesquisaId}/onboarding/resultados`,
        rhA,
      ).expect(200);
      expect(r.body.rodadas.map((x: { rodada: number }) => x.rodada)).toEqual([
        30, 60,
      ]);
      expect(r.body.rodadas[0]).toMatchObject({
        respostas: 1,
        visivel: false,
        faltam: 2,
      });
      expect(r.body.funil).toMatchObject({ responderam: 1, pulados: 1 });
      expect(r.body.contatos).toEqual([]);
    });

    it("processo idempotente: rodar de novo não muda nada", async () => {
      const agora = amanha();
      await processador().processarOnboarding(pesquisaId, agora);
      expect(await processador().processarOnboarding(pesquisaId, agora)).toBe(
        0,
      );
    });

    it("anônima automática: o link precisa da rodada", async () => {
      const r = await post("/v1/pesquisas", rhA)
        .send(
          corpo({
            nome: "Onboarding anônimo",
            modelo: "onboarding",
            identificacao: "anonima",
            secoes: secoesDoOnboarding(),
          }),
        )
        .expect(201);
      await put(`/v1/pesquisas/${r.body.id}/onboarding`, rhA)
        .send({
          config: { modo: "automatizar", rodadas: [30], lembreteDias: 5 },
        })
        .expect(200)
        .expect((x) => expect(x.body.config.lembreteDias).toBeNull());
      const at = await post(`/v1/pesquisas/${r.body.id}/onboarding/ativar`, rhA)
        .send()
        .expect(200);
      const t = (at.body.link as string).replace("#/p/", "");
      const enviar = (rodada?: number) =>
        agent()
          .post(publico(t, "/onboarding/respostas"))
          .send({
            ...(rodada !== undefined ? { rodada } : {}),
            respostas: [{ perguntaId: "q1", valor: 2 }],
          });
      await enviar().expect(422);
      await enviar(60).expect(422);
      await enviar(30).expect(201);
      await enviar(30).expect(201);
    });
  });
});
