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
import {
  mediaDaResposta,
  montarResultados,
  type RespostaParaCalculo,
} from "./calculo-resultados";
import {
  compararComOTime,
  mediaGeralVisivel,
  montarAnalises,
} from "./analises-pesquisa";
import {
  ativosDaEmpresa,
  departamentosVigentes,
  lotacoesVigentes,
  nomesDosGrupos,
} from "./pessoas-da-pesquisa";
import { conferirSecoes, totalDePerguntas } from "./estrutura-pesquisa";
import {
  type AnalisesPesquisa,
  CAMPOS_GRUPO,
  type CampoGrupo,
  type ContagensPorStatus,
  type GruposDaResposta,
  type Identificacao,
  type ListaDePesquisas,
  type Modelo,
  type ParticipanteDaLista,
  type PesquisaDaFicha,
  type PesquisaDetalhe,
  type PesquisaResumo,
  type RespostaDetalhe,
  type RespostaResumo,
  type ResultadosPesquisa,
  type Secao,
  STATUS_PESQUISA,
  type StatusPesquisa,
  type ValorRespondido,
} from "./pesquisas.types";
import {
  identificavelPeloLink,
  podeEditar,
  statusEfetivo,
  transicaoValida,
} from "./regras-pesquisa";

/**
 * T216 — Pesquisas da empresa ativa: lista com contagens por status, criar
 * (rascunho), detalhe, editar (com as regras depois de publicar), publicar,
 * status, duplicar, excluir (lógico), resultados agregados com indicadores e
 * recortes, análises (mapa por grupo e evolução), respostas individuais
 * (identificada e anônima, auditadas) e a aba da ficha.
 *
 * A anônima não tem participantes (quem tiver o link responde) e pode
 * separar as respostas por até 2 grupos que quem responde escolhe.
 *
 * `rh` e `dp` operam; o `master_tecnico` só lê a pesquisa e os agregados;
 * respostas individuais, só `rh` e `dp`. A trilha leva só ação, recurso
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
  separarPor: true,
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
  participantes?: { todos: boolean; colaboradorIds?: string[] };
  separarPor?: CampoGrupo[];
  encerraEm?: string | null;
  minimoPorGrupo: number;
}

interface EntradaConferida {
  nome: string;
  boasVindas: string | null;
  secoes: Secao[];
  encerraEm: string | null;
  minimoPorGrupo: number;
  separarPor: CampoGrupo[];
  /** Na anônima, sempre `{ todos: false, colaboradorIds: [] }`. */
  todos: boolean;
  colaboradorIds: string[];
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

/** Os recortes disponíveis: na anônima, só os escolhidos por quem responde. */
export function recortesDa(p: {
  identificacao: Identificacao;
  separarPor: string[];
}): CampoGrupo[] {
  return p.identificacao === "anonima"
    ? (p.separarPor as CampoGrupo[])
    : [...CAMPOS_GRUPO];
}

/** Uma resposta gravada com os grupos e o autor (identificada). */
interface RespostaCarregada extends RespostaParaCalculo {
  id: string;
  respondidaEm: Date;
  colaboradorId: string | null;
  departamento: string | null;
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
      participantes: p.identificacao === "anonima" ? null : participantes,
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
    let lista: { colaboradorId: string; respondeu: boolean | null }[] = [];
    if (p.identificacao === "anonima") {
      lista = []; // sem participantes: quem tiver o link responde
    } else if (p.status === "rascunho" && p.todos) {
      lista = (await ativosDaEmpresa(db, p.empresaId)).map((colaboradorId) => ({
        colaboradorId,
        respondeu: false,
      }));
    } else {
      const linhas = await db.pesquisaParticipante.findMany({
        where: { pesquisaId: p.id },
        select: { colaboradorId: true, respondeuEm: true },
      });
      lista = linhas.map((l) => ({
        colaboradorId: l.colaboradorId,
        respondeu: l.respondeuEm !== null,
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
      db.perfilPessoalColaborador.findMany({
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
      separarPor: p.separarPor as CampoGrupo[],
      todos: p.todos,
      participantesLista,
      naoIdentificaveis: participantesLista.filter((x) => !x.identificavel)
        .length,
      temRespostas: respostas > 0,
    };
  }

  // ---------------------------------------------------------------------
  // Escrita

  /** Nome, boas-vindas, estrutura, prazo e grupos, com erros por campo. */
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
    const anonima = dto.identificacao === "anonima";
    const separarPor = dto.separarPor ?? [];
    if (separarPor.length && !anonima) {
      erros.push({ campo: "separarPor", motivo: "nao_se_aplica" });
    } else if (separarPor.length > 2) {
      erros.push({ campo: "separarPor", motivo: "limite" });
    } else if (new Set(separarPor).size !== separarPor.length) {
      erros.push({ campo: "separarPor", motivo: "invalido" });
    }
    const participantes = anonima
      ? { todos: false, colaboradorIds: [] }
      : (dto.participantes ?? { todos: false, colaboradorIds: [] });
    const colaboradorIds = participantes.todos
      ? []
      : (participantes.colaboradorIds ?? []);
    if (new Set(colaboradorIds).size !== colaboradorIds.length) {
      erros.push({ campo: "participantes", motivo: "invalido" });
    }
    if (erros.length) throw new CamposRecusadosException(erros);
    return {
      nome,
      boasVindas,
      secoes: estrutura.secoes,
      encerraEm,
      minimoPorGrupo: dto.minimoPorGrupo,
      separarPor: anonima ? separarPor : [],
      todos: participantes.todos,
      colaboradorIds,
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
    return this.prisma.$transaction(async (tx) => {
      await this.conferirNovosParticipantes(tx, empresaId, e.colaboradorIds);
      const p = await tx.pesquisa.create({
        data: {
          empresaId,
          nome: e.nome,
          boasVindas: e.boasVindas,
          modelo: dto.modelo,
          identificacao: dto.identificacao,
          secoes: e.secoes as unknown as Prisma.InputJsonValue,
          todos: e.todos,
          separarPor: e.separarPor,
          encerraEm: e.encerraEm ? dataDoDia(e.encerraEm) : null,
          minimoPorGrupo: e.minimoPorGrupo,
          token: novoToken(),
          criadaPorId: ctx.actor.id,
        },
      });
      if (e.colaboradorIds.length) {
        await tx.pesquisaParticipante.createMany({
          data: e.colaboradorIds.map((colaboradorId) => ({
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
      if (temRespostas) {
        const travados: ErroDeCampo[] = [];
        if (jsonCanonico(e.secoes) !== jsonCanonico(atual.secoes)) {
          travados.push({ campo: "secoes", motivo: "com_respostas" });
        }
        if (jsonCanonico(e.separarPor) !== jsonCanonico(atual.separarPor)) {
          travados.push({ campo: "separarPor", motivo: "com_respostas" });
        }
        if (travados.length) throw new ConflitoDeCamposException(travados);
      }

      // Participantes: incluir sempre; retirar só quem não respondeu. A
      // anônima não tem participantes.
      const existentes = await tx.pesquisaParticipante.findMany({
        where: { pesquisaId: id },
        select: { id: true, colaboradorId: true, respondeuEm: true },
      });
      const jaEstao = new Set(existentes.map((x) => x.colaboradorId));
      let desejados: Set<string>;
      if (dto.identificacao === "anonima") {
        desejados = new Set();
      } else if (e.todos) {
        desejados = publicada
          ? new Set([...jaEstao, ...(await ativosDaEmpresa(tx, empresaId))])
          : new Set(); // no rascunho, "todos" se resolve ao publicar
      } else {
        desejados = new Set(e.colaboradorIds);
      }
      const novos = [...desejados].filter((c) => !jaEstao.has(c));
      const saem = existentes.filter((x) => !desejados.has(x.colaboradorId));
      if (saem.some((x) => x.respondeuEm !== null)) {
        throw new ConflitoDeCamposException([
          { campo: "participantes", motivo: "com_respostas" },
        ]);
      }
      if (!e.todos) {
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
          todos: e.todos,
          separarPor: e.separarPor,
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
      // A anônima não tem participantes: quem tiver o link responde.
      if (atual.identificacao !== "anonima") {
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
          separarPor: p.separarPor,
          encerraEm:
            p.encerraEm && diaDe(p.encerraEm) >= hoje ? p.encerraEm : null,
          minimoPorGrupo: p.minimoPorGrupo,
          token: novoToken(),
          criadaPorId: ctx.actor.id,
        },
      });
      if (!p.todos && p.identificacao !== "anonima") {
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
  // Resultados, análises e respostas

  /**
   * As respostas com os grupos: na identificada, pela lotação vigente (e o
   * autor, se pedido); na confidencial, os gravados no envio; na anônima, a
   * escolha de quem respondeu. Ordem: respondida em, depois id.
   */
  private async carregarRespostas(
    p: { id: string; empresaId: string; identificacao: Identificacao },
    comAutor: boolean,
  ): Promise<RespostaCarregada[]> {
    const linhas = await this.prisma.pesquisaResposta.findMany({
      where: { pesquisaId: p.id },
      orderBy: [{ respondidaEm: "asc" }, { id: "asc" }],
      select: {
        id: true,
        respondidaEm: true,
        valores: true,
        colaboradorId: true,
        departamentoId: true,
        centroCustoId: true,
        unidadeId: true,
      },
    });
    const identificada = p.identificacao === "identificada";
    const pessoas = identificada
      ? [...new Set(linhas.map((l) => l.colaboradorId!))]
      : [];
    const [nomes, lotacoes] = await Promise.all([
      this.prisma.colaborador.findMany({
        where: { id: { in: pessoas } },
        select: { id: true, nome: true },
      }),
      lotacoesVigentes(this.prisma, p.empresaId, pessoas),
    ]);
    const nomeDe = new Map(nomes.map((c) => [c.id, c.nome]));
    return linhas.map((l) => {
      const lot = identificada ? lotacoes.get(l.colaboradorId!) : undefined;
      const grupos: GruposDaResposta = identificada
        ? {
            departamento: lot?.departamento?.id ?? null,
            centroCusto: lot?.centroCusto?.id ?? null,
            unidade: lot?.unidade?.id ?? null,
          }
        : {
            departamento: l.departamentoId,
            centroCusto: l.centroCustoId,
            unidade: l.unidadeId,
          };
      return {
        id: l.id,
        respondidaEm: l.respondidaEm,
        colaboradorId: l.colaboradorId,
        departamento: lot?.departamento?.nome ?? null,
        valores: l.valores as unknown as ValorRespondido[],
        autor:
          identificada && comAutor
            ? (nomeDe.get(l.colaboradorId!) ?? null)
            : null,
        grupos,
      };
    });
  }

  private async nomesDosGruposDe(
    empresaId: string,
    respostas: readonly { grupos: GruposDaResposta }[],
  ): Promise<Map<string, string>> {
    const ids = new Set<string>();
    for (const r of respostas) {
      for (const id of Object.values(r.grupos)) if (id) ids.add(id);
    }
    return nomesDosGrupos(this.prisma, empresaId, [...ids]);
  }

  async resultados(
    id: string,
    filtro: { campo: CampoGrupo; grupoId: string } | null,
    ctx: PessoasAuditContext,
  ): Promise<ResultadosPesquisa> {
    const empresaId = this.empresaDaSessao(ctx, "leitura");
    const p = await this.obterLinha(this.prisma, id, empresaId, ctx);
    // O autor dos textos é dado individual: só RH e DP (o master lê o
    // agregado, sem a pessoa).
    const comAutor =
      p.identificacao === "identificada" &&
      (ctx.actor.role === "rh" || ctx.actor.role === "dp");
    const respostas = await this.carregarRespostas(p, comAutor);
    let participantes: number | null = null;
    if (p.identificacao !== "anonima") {
      participantes =
        p.status === "rascunho" && p.todos
          ? (await ativosDaEmpresa(this.prisma, empresaId)).length
          : await this.prisma.pesquisaParticipante.count({
              where: { pesquisaId: id },
            });
    }
    return montarResultados({
      pesquisaId: id,
      secoes: p.secoes as unknown as Secao[],
      respostas,
      participantes,
      nomesDosGrupos: await this.nomesDosGruposDe(empresaId, respostas),
      minimoPorGrupo: p.minimoPorGrupo,
      filtro,
      recortes: recortesDa(p),
      identificada: comAutor,
      minimoNaVisaoGeral: p.identificacao === "confidencial",
    });
  }

  /** Mapa de médias por grupo e a evolução entre pesquisas do mesmo modelo. */
  async analises(
    id: string,
    campo: CampoGrupo,
    ctx: PessoasAuditContext,
  ): Promise<AnalisesPesquisa> {
    const empresaId = this.empresaDaSessao(ctx, "leitura");
    const p = await this.obterLinha(this.prisma, id, empresaId, ctx);
    if (!recortesDa(p).includes(campo)) {
      throw new CamposRecusadosException([
        { campo: "campo", motivo: "nao_se_aplica" },
      ]);
    }
    const respostas = await this.carregarRespostas(p, false);

    const mesmas = await this.prisma.pesquisa.findMany({
      where: {
        empresaId,
        modelo: p.modelo,
        excluidaEm: null,
        publicadaEm: { not: null },
      },
      orderBy: [{ publicadaEm: "asc" }, { id: "asc" }],
      select: {
        id: true,
        nome: true,
        publicadaEm: true,
        secoes: true,
        identificacao: true,
        minimoPorGrupo: true,
      },
    });
    const valoresDe = await this.prisma.pesquisaResposta.findMany({
      where: { pesquisaId: { in: mesmas.map((m) => m.id) } },
      select: { pesquisaId: true, valores: true },
    });
    const evolucao = mesmas.map((m) => ({
      pesquisaId: m.id,
      nome: m.nome,
      publicadaEm: m.publicadaEm!.toISOString(),
      mediaGeral: mediaGeralVisivel(
        m.secoes as unknown as Secao[],
        valoresDe
          .filter((v) => v.pesquisaId === m.id)
          .map((v) => ({
            valores: v.valores as unknown as ValorRespondido[],
            grupos: {},
          })),
        m.minimoPorGrupo,
        m.identificacao === "confidencial",
      ),
    }));

    return montarAnalises({
      campo,
      secoes: p.secoes as unknown as Secao[],
      respostas,
      nomesDosGrupos: await this.nomesDosGruposDe(empresaId, respostas),
      minimoPorGrupo: p.minimoPorGrupo,
      minimoNaVisaoGeral: p.identificacao === "confidencial",
      evolucao,
    });
  }

  /** Identificada e anônima; a confidencial nunca mostra (404). */
  private async respostasNumeradas(
    id: string,
    ctx: PessoasAuditContext,
  ): Promise<{
    p: LinhaPesquisa;
    empresaId: string;
    lista: (RespostaCarregada & { resumo: RespostaResumo })[];
  }> {
    const empresaId = this.empresaDaSessao(ctx, "respostas");
    const p = await this.obterLinha(this.prisma, id, empresaId, ctx);
    if (p.identificacao === "confidencial") throw new NotFoundException();
    const secoes = p.secoes as unknown as Secao[];
    const respostas = await this.carregarRespostas(p, true);
    const lista = respostas.map((r, i) => ({
      ...r,
      resumo: {
        id: r.id,
        numero: i + 1,
        colaboradorId: r.colaboradorId,
        nome: r.autor,
        departamento: r.departamento,
        respondidaEm: r.respondidaEm.toISOString(),
        media: mediaDaResposta(
          secoes,
          new Map(r.valores.map((v) => [v.perguntaId, v.valor])),
        ),
      },
    }));
    return { p, empresaId, lista };
  }

  /** A lista numerada (auditada). */
  async respostasIndividuais(
    id: string,
    ctx: PessoasAuditContext,
  ): Promise<RespostaResumo[]> {
    const { empresaId, lista } = await this.respostasNumeradas(id, ctx);
    await this.auditoria.registrarLeitura(
      ctx,
      "pesquisas_respostas_consultadas",
      "resposta_pesquisa",
      id,
      empresaId,
    );
    return lista.map((r) => r.resumo);
  }

  /** Uma resposta comparada com o time, com anterior e próxima (auditada). */
  async respostaIndividual(
    id: string,
    respostaId: string,
    ctx: PessoasAuditContext,
  ): Promise<RespostaDetalhe> {
    const { p, empresaId, lista } = await this.respostasNumeradas(id, ctx);
    const i = lista.findIndex((r) => r.id === respostaId);
    if (i < 0) throw new NotFoundException();
    await this.auditoria.registrarLeitura(
      ctx,
      "pesquisas_respostas_consultadas",
      "resposta_pesquisa",
      respostaId,
      empresaId,
    );
    const comparacao = compararComOTime(
      p.secoes as unknown as Secao[],
      lista,
      i,
    );
    return {
      ...lista[i]!.resumo,
      anteriorId: i > 0 ? lista[i - 1]!.id : null,
      proximaId: i < lista.length - 1 ? lista[i + 1]!.id : null,
      posicao: i + 1,
      total: lista.length,
      ...comparacao,
    };
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
        id: true,
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
      respostaId: l.id,
      pesquisaId: l.pesquisa.id,
      nome: l.pesquisa.nome,
      modelo: l.pesquisa.modelo,
      respondidaEm: l.respondidaEm.toISOString(),
      secoes: l.pesquisa.secoes as unknown as Secao[],
      valores: l.valores as unknown as ValorRespondido[],
    }));
  }
}
