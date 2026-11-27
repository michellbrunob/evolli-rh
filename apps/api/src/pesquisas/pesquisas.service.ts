import { randomBytes } from "node:crypto";
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import {
  CamposRecusadosException,
  ConflitoDeCamposException,
  type ErroDeCampo,
} from "../common/erros/recusa-por-campo";
import { PessoasAuditoriaService } from "../pessoas/pessoas-auditoria.service";
import type {
  PessoasAuditContext,
  ResultadoPaginado,
} from "../pessoas/pessoas.types";
import {
  dataDoDia,
  diaDe,
  hojeEmSaoPaulo,
} from "../pessoas/ausencias/calculo-ausencias";
import { montarResultados } from "./calculo-resultados";
import { ativosDaEmpresa, departamentosVigentes } from "./pessoas-da-pesquisa";
import { conferirSecoes, totalDePerguntas } from "./estrutura-pesquisa";
import type {
  ContagensPorStatus,
  Identificacao,
  ListaDePesquisas,
  Modelo,
  ParticipanteDaLista,
  PesquisaDaFicha,
  PesquisaDetalhe,
  PesquisaResumo,
  RespostaIndividual,
  ResultadosPesquisa,
  Secao,
  StatusPesquisa,
  ValorRespondido,
} from "./pesquisas.types";
import { STATUS_PESQUISA } from "./pesquisas.types";
import {
  identificavelPeloLink,
  podeEditar,
  statusEfetivo,
  transicaoValida,
} from "./regras-pesquisa";

/**
 * T216 — Pesquisas da empresa ativa: lista com contagens por status, criar
 * (rascunho), detalhe, editar (com as regras depois de publicar), publicar,
 * status, duplicar, excluir (lógico), resultados agregados, respostas
 * individuais (só identificada, auditado) e a aba da ficha.
 *
 * `rh` e `dp` operam; o `master_tecnico` só lê a pesquisa e os agregados;
 * respostas com a pessoa, só `rh` e `dp`. A trilha leva só ação, recurso
 * (id) e empresa — nunca nome, perguntas ou respostas.
 */

const LIMITE_NOME = 120;
const LIMITE_BOAS_VINDAS = 1000;
const DIA = /^\d{4}-\d{2}-\d{2}$/;

type Db = Prisma.TransactionClient;
type LinhaPesquisa = Prisma.PesquisaGetPayload<object>;

/** A linha sem a estrutura (a lista não precisa das perguntas). */
const SEM_SECOES = {
  id: true,
  empresaId: true,
  nome: true,
  boasVindas: true,
  modelo: true,
  identificacao: true,
  status: true,
  todos: true,
  encerraEm: true,
  minimoPorGrupo: true,
  token: true,
  publicadaEm: true,
  excluidaEm: true,
  excluidaPorId: true,
  criadaPorId: true,
  criadaEm: true,
  atualizadaEm: true,
} satisfies Prisma.PesquisaSelect;

export interface PesquisaInformada {
  nome: string;
  boasVindas?: string | null;
  modelo: Modelo;
  identificacao: Identificacao;
  secoes: unknown[];
  participantes: { todos: boolean; colaboradorIds?: string[] };
  encerraEm?: string | null;
  minimoPorGrupo: number;
}

interface EntradaConferida {
  nome: string;
  boasVindas: string | null;
  secoes: Secao[];
  encerraEm: string | null;
  minimoPorGrupo: number;
}

/** JSON com as chaves em ordem (o JSONB não guarda a ordem das chaves). */
export function jsonCanonico(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(jsonCanonico).join(",")}]`;
  if (v && typeof v === "object") {
    const r = v as Record<string, unknown>;
    return `{${Object.keys(r)
      .filter((k) => r[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${jsonCanonico(r[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v);
}

function diaValido(v: string): boolean {
  if (!DIA.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

/** O link público: 32 bytes aleatórios em base64url. */
export function novoToken(): string {
  return randomBytes(32).toString("base64url");
}

@Injectable()
export class PesquisasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: PessoasAuditoriaService,
  ) {}

  private empresaDaSessao(
    ctx: PessoasAuditContext,
    uso: "leitura" | "escrita" | "respostas",
  ): string {
    const papel = ctx.actor.role;
    const permitido =
      papel === "rh" ||
      papel === "dp" ||
      (papel === "master_tecnico" && uso === "leitura");
    if (!permitido || ctx.actor.companyId === null) {
      throw new ForbiddenException();
    }
    return ctx.actor.companyId;
  }

  private async obterLinha(
    db: Db,
    id: string,
    empresaId: string,
    ctx: PessoasAuditContext,
  ): Promise<LinhaPesquisa> {
    const p = await db.pesquisa.findFirst({
      where: { id, empresaId, excluidaEm: null },
    });
    if (!p) return this.auditoria.negarAcesso(ctx, "pesquisa", id, empresaId);
    return p;
  }

  private efetivo(p: {
    status: StatusPesquisa;
    encerraEm: Date | null;
  }): StatusPesquisa {
    return statusEfetivo(
      p.status,
      p.encerraEm ? diaDe(p.encerraEm) : null,
      hojeEmSaoPaulo(),
    );
  }

  private resumo(
    p: Omit<LinhaPesquisa, "secoes">,
    participantes: number,
    respostas: number,
  ): PesquisaResumo {
    return {
      id: p.id,
      nome: p.nome,
      modelo: p.modelo,
      identificacao: p.identificacao,
      status: this.efetivo(p),
      participantes,
      respostas,
      criadaEm: p.criadaEm.toISOString(),
      publicadaEm: p.publicadaEm ? p.publicadaEm.toISOString() : null,
      encerraEm: p.encerraEm ? diaDe(p.encerraEm) : null,
      link: p.publicadaEm ? `#/p/${p.token}` : null,
    };
  }

  // ---------------------------------------------------------------------
  // Leitura

  async listar(
    q: {
      status?: "todas" | StatusPesquisa;
      pagina: number;
      tamanhoPagina: number;
    },
    ctx: PessoasAuditContext,
  ): Promise<ListaDePesquisas> {
    const empresaId = this.empresaDaSessao(ctx, "leitura");
    const linhas = await this.prisma.pesquisa.findMany({
      where: { empresaId, excluidaEm: null },
      orderBy: [{ criadaEm: "desc" }, { id: "asc" }],
      select: SEM_SECOES,
    });
    const ids = linhas.map((l) => l.id);
    const [part, resp] = await Promise.all([
      this.prisma.pesquisaParticipante.groupBy({
        by: ["pesquisaId"],
        where: { pesquisaId: { in: ids } },
        _count: { _all: true },
      }),
      this.prisma.pesquisaResposta.groupBy({
        by: ["pesquisaId"],
        where: { pesquisaId: { in: ids } },
        _count: { _all: true },
      }),
    ]);
    const nPart = new Map(part.map((g) => [g.pesquisaId, g._count._all]));
    const nResp = new Map(resp.map((g) => [g.pesquisaId, g._count._all]));
    const ativos = linhas.some((l) => l.status === "rascunho" && l.todos)
      ? (await ativosDaEmpresa(this.prisma, empresaId)).length
      : 0;
    const resumos = linhas.map((l) =>
      this.resumo(
        l,
        l.status === "rascunho" && l.todos ? ativos : (nPart.get(l.id) ?? 0),
        nResp.get(l.id) ?? 0,
      ),
    );
    const contagens = Object.fromEntries([
      ["todas", resumos.length],
      ...STATUS_PESQUISA.map((s) => [
        s,
        resumos.filter((r) => r.status === s).length,
      ]),
    ]) as ContagensPorStatus;
    const filtradas =
      q.status && q.status !== "todas"
        ? resumos.filter((r) => r.status === q.status)
        : resumos;
    const inicio = (q.pagina - 1) * q.tamanhoPagina;
    const pagina: ResultadoPaginado<PesquisaResumo> = {
      itens: filtradas.slice(inicio, inicio + q.tamanhoPagina),
      pagina: q.pagina,
      tamanhoPagina: q.tamanhoPagina,
      total: filtradas.length,
    };
    return { ...pagina, contagens };
  }

  async obter(id: string, ctx: PessoasAuditContext): Promise<PesquisaDetalhe> {
    const empresaId = this.empresaDaSessao(ctx, "leitura");
    const p = await this.obterLinha(this.prisma, id, empresaId, ctx);
    return this.detalhe(this.prisma, p);
  }

  private async detalhe(db: Db, p: LinhaPesquisa): Promise<PesquisaDetalhe> {
    const respostas = await db.pesquisaResposta.count({
      where: { pesquisaId: p.id },
    });
    const anonima = p.identificacao === "anonima";
    let lista: { colaboradorId: string; respondeu: boolean | null }[];
    if (p.status === "rascunho" && p.todos) {
      lista = (await ativosDaEmpresa(db, p.empresaId)).map((colaboradorId) => ({
        colaboradorId,
        respondeu: anonima ? null : false,
      }));
    } else {
      const linhas = await db.pesquisaParticipante.findMany({
        where: { pesquisaId: p.id },
        select: { colaboradorId: true, respondeuEm: true },
      });
      lista = linhas.map((l) => ({
        colaboradorId: l.colaboradorId,
        respondeu: anonima ? null : l.respondeuEm !== null,
      }));
    }
    const ids = lista.map((l) => l.colaboradorId);
    const [nomes, deps, perfis] = await Promise.all([
      db.colaborador.findMany({
        where: { id: { in: ids } },
        select: { id: true, nome: true },
      }),
      departamentosVigentes(db, p.empresaId, ids),
      // Só para saber se o link consegue identificar a pessoa: CPF e
      // nascimento nunca saem na resposta.
      anonima
        ? Promise.resolve([])
        : db.perfilPessoalColaborador.findMany({
            where: { empresaId: p.empresaId, colaboradorId: { in: ids } },
            select: { colaboradorId: true, cpf: true, dataNascimento: true },
          }),
    ]);
    const nomeDe = new Map(nomes.map((c) => [c.id, c.nome]));
    const perfilDe = new Map(perfis.map((x) => [x.colaboradorId, x]));
    const participantesLista: ParticipanteDaLista[] = lista
      .map((l) => ({
        colaboradorId: l.colaboradorId,
        nome: nomeDe.get(l.colaboradorId) ?? "",
        departamento: deps.get(l.colaboradorId)?.nome ?? null,
        respondeu: l.respondeu,
        identificavel: identificavelPeloLink(
          p.identificacao,
          perfilDe.get(l.colaboradorId) ?? null,
        ),
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    return {
      ...this.resumo(p, participantesLista.length, respostas),
      boasVindas: p.boasVindas,
      secoes: p.secoes as unknown as Secao[],
      minimoPorGrupo: p.minimoPorGrupo,
      todos: p.todos,
      participantesLista,
      naoIdentificaveis: participantesLista.filter((x) => !x.identificavel)
        .length,
      temRespostas: respostas > 0,
    };
  }

  // ---------------------------------------------------------------------
  // Escrita

  /** Nome, boas-vindas, estrutura e prazo, com os erros por campo. */
  private conferirEntrada(
    dto: PesquisaInformada,
    encerraEmAtual: string | null,
  ): EntradaConferida {
    const erros: ErroDeCampo[] = [];
    const nome = dto.nome.trim();
    if (!nome) erros.push({ campo: "nome", motivo: "obrigatorio" });
    else if (nome.length > LIMITE_NOME) {
      erros.push({ campo: "nome", motivo: "limite" });
    }
    const boasVindas = dto.boasVindas?.trim() || null;
    if (boasVindas && boasVindas.length > LIMITE_BOAS_VINDAS) {
      erros.push({ campo: "boasVindas", motivo: "limite" });
    }
    const estrutura = conferirSecoes(dto.secoes);
    erros.push(...estrutura.erros);
    const encerraEm = dto.encerraEm ?? null;
    if (encerraEm !== null) {
      if (!diaValido(encerraEm)) {
        erros.push({ campo: "encerraEm", motivo: "invalido" });
      } else if (encerraEm !== encerraEmAtual && encerraEm < hojeEmSaoPaulo()) {
        erros.push({ campo: "encerraEm", motivo: "invalido" });
      }
    }
    if (
      !dto.participantes.todos &&
      dto.participantes.colaboradorIds !== undefined &&
      new Set(dto.participantes.colaboradorIds).size !==
        dto.participantes.colaboradorIds.length
    ) {
      erros.push({ campo: "participantes", motivo: "invalido" });
    }
    if (erros.length) throw new CamposRecusadosException(erros);
    return {
      nome,
      boasVindas,
      secoes: estrutura.secoes,
      encerraEm,
      minimoPorGrupo: dto.minimoPorGrupo,
    };
  }

  /** Quem entra precisa estar ativo na empresa da sessão. */
  private async conferirNovosParticipantes(
    db: Db,
    empresaId: string,
    ids: readonly string[],
  ): Promise<void> {
    if (ids.length === 0) return;
    const ativos = new Set(await ativosDaEmpresa(db, empresaId));
    if (ids.some((id) => !ativos.has(id))) {
      throw new CamposRecusadosException([
        { campo: "participantes", motivo: "indisponivel" },
      ]);
    }
  }

  async criar(
    dto: PesquisaInformada,
    ctx: PessoasAuditContext,
  ): Promise<PesquisaDetalhe> {
    const empresaId = this.empresaDaSessao(ctx, "escrita");
    const e = this.conferirEntrada(dto, null);
    const ids = dto.participantes.todos
      ? []
      : (dto.participantes.colaboradorIds ?? []);
    return this.prisma.$transaction(async (tx) => {
      await this.conferirNovosParticipantes(tx, empresaId, ids);
      const p = await tx.pesquisa.create({
        data: {
          empresaId,
          nome: e.nome,
          boasVindas: e.boasVindas,
          modelo: dto.modelo,
          identificacao: dto.identificacao,
          secoes: e.secoes as unknown as Prisma.InputJsonValue,
          todos: dto.participantes.todos,
          encerraEm: e.encerraEm ? dataDoDia(e.encerraEm) : null,
          minimoPorGrupo: e.minimoPorGrupo,
          token: novoToken(),
          criadaPorId: ctx.actor.id,
        },
      });
      if (ids.length) {
        await tx.pesquisaParticipante.createMany({
          data: ids.map((colaboradorId) => ({
            pesquisaId: p.id,
            empresaId,
            colaboradorId,
          })),
        });
      }
      await this.auditoria.registrarMutacao(
        tx,
        ctx,
        "pesquisas_pesquisa_criada",
        "pesquisa",
        p.id,
        empresaId,
      );
      return this.detalhe(tx, p);
    });
  }

  async alterar(
    id: string,
    dto: PesquisaInformada,
    ctx: PessoasAuditContext,
  ): Promise<PesquisaDetalhe> {
    const empresaId = this.empresaDaSessao(ctx, "escrita");
    return this.prisma.$transaction(async (tx) => {
      const atual = await this.obterLinha(tx, id, empresaId, ctx);
      if (!podeEditar(this.efetivo(atual))) throw new ConflictException();
      const publicada = atual.status !== "rascunho";
      if (publicada && dto.identificacao !== atual.identificacao) {
        throw new CamposRecusadosException([
          { campo: "identificacao", motivo: "nao_editavel" },
        ]);
      }
      const e = this.conferirEntrada(
        dto,
        atual.encerraEm ? diaDe(atual.encerraEm) : null,
      );
      const temRespostas =
        (await tx.pesquisaResposta.count({ where: { pesquisaId: id } })) > 0;
      if (
        temRespostas &&
        jsonCanonico(e.secoes) !== jsonCanonico(atual.secoes)
      ) {
        throw new ConflitoDeCamposException([
          { campo: "secoes", motivo: "com_respostas" },
        ]);
      }

      // Participantes: incluir sempre; retirar só quem não respondeu.
      const existentes = await tx.pesquisaParticipante.findMany({
        where: { pesquisaId: id },
        select: { id: true, colaboradorId: true, respondeuEm: true },
      });
      const jaEstao = new Set(existentes.map((x) => x.colaboradorId));
      let desejados: Set<string>;
      if (dto.participantes.todos) {
        desejados = publicada
          ? new Set([...jaEstao, ...(await ativosDaEmpresa(tx, empresaId))])
          : new Set(); // no rascunho, "todos" se resolve ao publicar
      } else {
        desejados = new Set(dto.participantes.colaboradorIds ?? []);
      }
      const novos = [...desejados].filter((c) => !jaEstao.has(c));
      const saem = existentes.filter((x) => !desejados.has(x.colaboradorId));
      if (saem.some((x) => x.respondeuEm !== null)) {
        throw new ConflitoDeCamposException([
          { campo: "participantes", motivo: "com_respostas" },
        ]);
      }
      if (!dto.participantes.todos) {
        await this.conferirNovosParticipantes(tx, empresaId, novos);
      }
      if (saem.length) {
        await tx.pesquisaParticipante.deleteMany({
          where: { id: { in: saem.map((x) => x.id) } },
        });
      }
      if (novos.length) {
        await tx.pesquisaParticipante.createMany({
          data: novos.map((colaboradorId) => ({
            pesquisaId: id,
            empresaId,
            colaboradorId,
          })),
          skipDuplicates: true,
        });
      }

      const alterada = await tx.pesquisa.update({
        where: { id },
        data: {
          nome: e.nome,
          boasVindas: e.boasVindas,
          modelo: dto.modelo,
          ...(publicada ? {} : { identificacao: dto.identificacao }),
          secoes: e.secoes as unknown as Prisma.InputJsonValue,
          todos: dto.participantes.todos,
          encerraEm: e.encerraEm ? dataDoDia(e.encerraEm) : null,
          minimoPorGrupo: e.minimoPorGrupo,
        },
      });
      await this.auditoria.registrarMutacao(
        tx,
        ctx,
        "pesquisas_pesquisa_alterada",
        "pesquisa",
        id,
        empresaId,
      );
      return this.detalhe(tx, alterada);
    });
  }

  async publicar(
    id: string,
    ctx: PessoasAuditContext,
  ): Promise<PesquisaDetalhe> {
    const empresaId = this.empresaDaSessao(ctx, "escrita");
    return this.prisma.$transaction(async (tx) => {
      const atual = await this.obterLinha(tx, id, empresaId, ctx);
      if (this.efetivo(atual) !== "rascunho") throw new ConflictException();
      const erros: ErroDeCampo[] = [];
      if (totalDePerguntas(atual.secoes as unknown as Secao[]) === 0) {
        erros.push({ campo: "secoes", motivo: "obrigatorio" });
      }
      if (atual.encerraEm && diaDe(atual.encerraEm) < hojeEmSaoPaulo()) {
        erros.push({ campo: "encerraEm", motivo: "invalido" });
      }
      if (atual.todos) {
        const ativos = await ativosDaEmpresa(tx, empresaId);
        if (ativos.length) {
          await tx.pesquisaParticipante.createMany({
            data: ativos.map((colaboradorId) => ({
              pesquisaId: id,
              empresaId,
              colaboradorId,
            })),
            skipDuplicates: true,
          });
        }
      }
      const participantes = await tx.pesquisaParticipante.count({
        where: { pesquisaId: id },
      });
      if (participantes === 0) {
        erros.push({ campo: "participantes", motivo: "obrigatorio" });
      }
      if (erros.length) throw new CamposRecusadosException(erros);
      const publicada = await tx.pesquisa.update({
        where: { id },
        data: { status: "ativa", publicadaEm: new Date() },
      });
      await this.auditoria.registrarMutacao(
        tx,
        ctx,
        "pesquisas_pesquisa_publicada",
        "pesquisa",
        id,
        empresaId,
      );
      return this.detalhe(tx, publicada);
    });
  }

  async alterarStatus(
    id: string,
    status: StatusPesquisa,
    ctx: PessoasAuditContext,
  ): Promise<PesquisaDetalhe> {
    const empresaId = this.empresaDaSessao(ctx, "escrita");
    return this.prisma.$transaction(async (tx) => {
      const atual = await this.obterLinha(tx, id, empresaId, ctx);
      if (!transicaoValida(this.efetivo(atual), status)) {
        throw new ConflictException();
      }
      const alterada = await tx.pesquisa.update({
        where: { id },
        data: { status },
      });
      await this.auditoria.registrarMutacao(
        tx,
        ctx,
        "pesquisas_pesquisa_status_alterado",
        "pesquisa",
        id,
        empresaId,
      );
      return this.detalhe(tx, alterada);
    });
  }

  /** Nome "(cópia)", identificação, perguntas e participantes; rascunho. */
  async duplicar(
    id: string,
    ctx: PessoasAuditContext,
  ): Promise<PesquisaDetalhe> {
    const empresaId = this.empresaDaSessao(ctx, "escrita");
    return this.prisma.$transaction(async (tx) => {
      const p = await this.obterLinha(tx, id, empresaId, ctx);
      const hoje = hojeEmSaoPaulo();
      const sufixo = " (cópia)";
      const copia = await tx.pesquisa.create({
        data: {
          empresaId,
          nome: `${p.nome.slice(0, LIMITE_NOME - sufixo.length)}${sufixo}`,
          boasVindas: p.boasVindas,
          modelo: p.modelo,
          identificacao: p.identificacao,
          secoes: p.secoes as Prisma.InputJsonValue,
          todos: p.todos,
          encerraEm:
            p.encerraEm && diaDe(p.encerraEm) >= hoje ? p.encerraEm : null,
          minimoPorGrupo: p.minimoPorGrupo,
          token: novoToken(),
          criadaPorId: ctx.actor.id,
        },
      });
      if (!p.todos) {
        const participantes = await tx.pesquisaParticipante.findMany({
          where: { pesquisaId: id },
          select: { colaboradorId: true },
        });
        if (participantes.length) {
          await tx.pesquisaParticipante.createMany({
            data: participantes.map(({ colaboradorId }) => ({
              pesquisaId: copia.id,
              empresaId,
              colaboradorId,
            })),
          });
        }
      }
      await this.auditoria.registrarMutacao(
        tx,
        ctx,
        "pesquisas_pesquisa_duplicada",
        "pesquisa",
        copia.id,
        empresaId,
      );
      return this.detalhe(tx, copia);
    });
  }

  async excluir(id: string, ctx: PessoasAuditContext): Promise<void> {
    const empresaId = this.empresaDaSessao(ctx, "escrita");
    await this.prisma.$transaction(async (tx) => {
      await this.obterLinha(tx, id, empresaId, ctx);
      await tx.pesquisa.update({
        where: { id },
        data: { excluidaEm: new Date(), excluidaPorId: ctx.actor.id },
      });
      await this.auditoria.registrarMutacao(
        tx,
        ctx,
        "pesquisas_pesquisa_excluida",
        "pesquisa",
        id,
        empresaId,
      );
    });
  }

  // ---------------------------------------------------------------------
  // Resultados e respostas

  async resultados(
    id: string,
    departamentoId: string | null,
    ctx: PessoasAuditContext,
  ): Promise<ResultadosPesquisa> {
    const empresaId = this.empresaDaSessao(ctx, "leitura");
    const p = await this.obterLinha(this.prisma, id, empresaId, ctx);
    const linhas = await this.prisma.pesquisaResposta.findMany({
      where: { pesquisaId: id },
      orderBy: [{ respondidaEm: "asc" }, { id: "asc" }],
      select: { valores: true, colaboradorId: true, departamentoId: true },
    });
    const identificada = p.identificacao === "identificada";
    // O autor dos textos é dado individual: só RH e DP (o master lê o
    // agregado, sem a pessoa).
    const comAutor =
      identificada && (ctx.actor.role === "rh" || ctx.actor.role === "dp");
    const pessoas = identificada
      ? [...new Set(linhas.map((l) => l.colaboradorId!))]
      : [];
    const [nomes, deps] = await Promise.all([
      this.prisma.colaborador.findMany({
        where: { id: { in: pessoas } },
        select: { id: true, nome: true },
      }),
      departamentosVigentes(this.prisma, empresaId, pessoas),
    ]);
    const nomeDe = new Map(nomes.map((c) => [c.id, c.nome]));
    const respostas = linhas.map((l) => ({
      valores: l.valores as unknown as ValorRespondido[],
      autor: comAutor ? (nomeDe.get(l.colaboradorId!) ?? null) : null,
      departamentoId: identificada
        ? (deps.get(l.colaboradorId!)?.id ?? null)
        : l.departamentoId,
    }));
    const idsDeps = [
      ...new Set(respostas.map((r) => r.departamentoId).filter(Boolean)),
    ] as string[];
    const departamentos = await this.prisma.departamento.findMany({
      where: { id: { in: idsDeps }, empresaId },
      select: { id: true, nome: true },
    });
    const participantes =
      p.status === "rascunho" && p.todos
        ? (await ativosDaEmpresa(this.prisma, empresaId)).length
        : await this.prisma.pesquisaParticipante.count({
            where: { pesquisaId: id },
          });
    return montarResultados({
      pesquisaId: id,
      secoes: p.secoes as unknown as Secao[],
      respostas,
      participantes,
      nomesDosDepartamentos: new Map(departamentos.map((d) => [d.id, d.nome])),
      minimoPorGrupo: p.minimoPorGrupo,
      departamentoId,
      identificada: comAutor,
      minimoNaVisaoGeral: p.identificacao === "confidencial",
    });
  }

  /** Só identificada: cada pessoa e as respostas dela (auditado). */
  async respostasIndividuais(
    id: string,
    ctx: PessoasAuditContext,
  ): Promise<RespostaIndividual[]> {
    const empresaId = this.empresaDaSessao(ctx, "respostas");
    const p = await this.obterLinha(this.prisma, id, empresaId, ctx);
    if (p.identificacao !== "identificada") throw new NotFoundException();
    const linhas = await this.prisma.pesquisaResposta.findMany({
      where: { pesquisaId: id, colaboradorId: { not: null } },
      select: {
        colaboradorId: true,
        respondidaEm: true,
        valores: true,
        colaborador: { select: { nome: true } },
      },
    });
    const deps = await departamentosVigentes(
      this.prisma,
      empresaId,
      linhas.map((l) => l.colaboradorId!),
    );
    await this.auditoria.registrarLeitura(
      ctx,
      "pesquisas_respostas_consultadas",
      "resposta_pesquisa",
      id,
      empresaId,
    );
    return linhas
      .map((l) => ({
        colaboradorId: l.colaboradorId!,
        nome: l.colaborador?.nome ?? "",
        departamento: deps.get(l.colaboradorId!)?.nome ?? null,
        respondidaEm: l.respondidaEm.toISOString(),
        valores: l.valores as unknown as ValorRespondido[],
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }

  /** Aba da ficha: as identificadas que a pessoa respondeu (auditado). */
  async daFicha(
    colaboradorId: string,
    ctx: PessoasAuditContext,
  ): Promise<PesquisaDaFicha[]> {
    const empresaId = this.empresaDaSessao(ctx, "respostas");
    const vinculo = await this.prisma.vinculoFuncional.findFirst({
      where: { colaboradorId, empresaId },
      select: { id: true },
    });
    if (!vinculo) {
      return this.auditoria.negarAcesso(
        ctx,
        "resposta_pesquisa",
        colaboradorId,
        empresaId,
      );
    }
    const linhas = await this.prisma.pesquisaResposta.findMany({
      where: {
        colaboradorId,
        empresaId,
        pesquisa: { identificacao: "identificada", excluidaEm: null },
      },
      orderBy: [{ respondidaEm: "desc" }, { id: "asc" }],
      select: {
        respondidaEm: true,
        valores: true,
        pesquisa: {
          select: { id: true, nome: true, modelo: true, secoes: true },
        },
      },
    });
    await this.auditoria.registrarLeitura(
      ctx,
      "pesquisas_respostas_consultadas",
      "resposta_pesquisa",
      colaboradorId,
      empresaId,
    );
    return linhas.map((l) => ({
      pesquisaId: l.pesquisa.id,
      nome: l.pesquisa.nome,
      modelo: l.pesquisa.modelo,
      respondidaEm: l.respondidaEm.toISOString(),
      secoes: l.pesquisa.secoes as unknown as Secao[],
      valores: l.valores as unknown as ValorRespondido[],
    }));
  }
}
