import { createHash } from "node:crypto";
import {
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../database/prisma.service";
import { AuditService } from "../../../audit/audit.service";
import {
  CamposRecusadosException,
  ConflitoDeCamposException,
} from "../../../common/erros/recusa-por-campo";
import { PessoasAuditoriaService } from "../../../pessoas/pessoas-auditoria.service";
import type { PessoasAuditContext } from "../../../pessoas/pessoas.types";
import type { SessionRequestMetadata } from "../../../auth/session/session.service";
import { hojeEmSaoPaulo } from "../../../pessoas/ausencias/calculo-ausencias";
import {
  lerEncerramento,
  motivoIndisponivel,
  podeEditar,
  statusEfetivo,
} from "../../regras-pesquisa";
import {
  atribuicoesVigentes,
  pessoasAtivas,
  type PessoaAtiva,
} from "../pessoas-ativas";
import {
  alertasDaAvaliacao,
  calibracao,
  comparativoDaPessoa,
  comparativoDoTime,
  faixaDeTempoDeCasa,
  notaDaAvaliacao,
  pontosADesenvolver,
  recorte,
  resumoDoTime,
  roteiroDeFeedback,
  type AvaliacaoDoGestor,
} from "./calculo-avaliacao";
import {
  COMPETENCIAS,
  ehAvaliacao,
  ITENS,
  secoesDaAvaliacao,
  type ModeloDeAvaliacao,
} from "./definicao";
import {
  agendaDeLembretes,
  conferirConfigAvaliacao,
  configGravada,
  montarOrganograma,
  participantesDosPares,
  planejarPares,
  type ConfigAvaliacao,
  type Organograma,
  type PessoaResumida,
  type TimeInformado,
} from "./regras-avaliacao";
import {
  conferirRespostaDaAvaliacao,
  lerRespostaDaAvaliacao,
} from "./respostas-avaliacao";

/**
 * T216 — Avaliação 90°/180°: organograma, times e configuração (RH), os
 * resultados (por pessoa e do time, sempre nominais: só `rh` e `dp`, com
 * trilha) e a resposta pelo link (o gestor entra com CPF + nascimento, vê o
 * time e avalia uma pessoa por vez; na 180°, cada pessoa também se avalia).
 */

type Db = Prisma.TransactionClient;

function hashDoPasse(passe: string): string {
  return createHash("sha256").update(passe, "utf8").digest("hex");
}

const resumida = (p: PessoaAtiva): PessoaResumida => ({
  id: p.id,
  nome: p.nome,
  cargo: p.cargo,
  departamento: p.departamento,
  identificavel: p.identificavel,
  temEmail: p.temEmail,
});

export interface PessoaDoTime extends PessoaResumida {
  gestorRespondeu: boolean;
  /** Na 180°: a autoavaliação; `null` sem autoavaliação (90° ou sem CPF). */
  autoavaliacao: { respondeu: boolean } | null;
}

export interface AvaliacaoDetalhe {
  pesquisaId: string;
  modelo: ModeloDeAvaliacao;
  config: ConfigAvaliacao;
  prazo: string | null;
  times: { gestor: PessoaResumida; pessoas: PessoaDoTime[] }[];
  totais: {
    gestores: number;
    pessoas: number;
    autoavaliacoes: number;
    respondidas: number;
    pendentes: number;
  };
  lembretes: { lembrete: string; quando: string }[];
  convites: { aguardandoEmail: number; semEmail: number; enviados: number };
}

@Injectable()
export class AvaliacaoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: PessoasAuditoriaService,
    private readonly auditService: AuditService,
  ) {}

  private empresa(
    ctx: PessoasAuditContext,
    uso: "leitura" | "escrita" | "respostas",
  ): string {
    const papel = ctx.actor.role;
    const ok =
      papel === "rh" ||
      papel === "dp" ||
      (papel === "master_tecnico" && uso === "leitura");
    if (!ok || ctx.actor.companyId === null) throw new ForbiddenException();
    return ctx.actor.companyId;
  }

  private async linha(
    db: Db,
    id: string,
    empresaId: string,
    ctx: PessoasAuditContext,
  ) {
    const p = await db.pesquisa.findFirst({
      where: { id, empresaId, excluidaEm: null },
    });
    if (!p || !ehAvaliacao(p.modelo)) {
      return this.auditoria.negarAcesso(ctx, "pesquisa", id, empresaId);
    }
    return p as typeof p & { modelo: ModeloDeAvaliacao };
  }

  // -------------------------------------------------------------------------
  // RH

  async organograma(
    ctx: PessoasAuditContext,
  ): Promise<Organograma & { ativos: PessoaResumida[] }> {
    const empresaId = this.empresa(ctx, "leitura");
    const hoje = hojeEmSaoPaulo();
    const [ativos, atribuicoes] = await Promise.all([
      pessoasAtivas(this.prisma, empresaId),
      atribuicoesVigentes(this.prisma, empresaId, hoje),
    ]);
    const ativosIds = new Set(ativos.map((a) => a.id));
    const fora = [
      ...new Set(
        atribuicoes.map((a) => a.gestorId).filter((g) => !ativosIds.has(g)),
      ),
    ];
    const nomesDeFora = new Map(
      (
        await this.prisma.colaborador.findMany({
          where: { id: { in: fora } },
          select: { id: true, nome: true },
        })
      ).map((c) => [c.id, c.nome]),
    );
    return {
      ...montarOrganograma(ativos, atribuicoes, nomesDeFora),
      ativos: ativos.map(resumida),
    };
  }

  async obter(id: string, ctx: PessoasAuditContext): Promise<AvaliacaoDetalhe> {
    const empresaId = this.empresa(ctx, "leitura");
    const p = await this.linha(this.prisma, id, empresaId, ctx);
    return this.detalhe(this.prisma, p);
  }

  private async detalhe(
    db: Db,
    p: {
      id: string;
      empresaId: string;
      modelo: ModeloDeAvaliacao;
      configModelo: unknown;
      encerraEm: Date | null;
    },
  ): Promise<AvaliacaoDetalhe> {
    const config = configGravada(p.configModelo);
    const [pares, envios] = await Promise.all([
      db.pesquisaAvaliacaoPar.findMany({
        where: { pesquisaId: p.id },
        select: {
          avaliadorId: true,
          avaliadoId: true,
          papel: true,
          respondidaEm: true,
        },
      }),
      db.pesquisaEnvio.groupBy({
        by: ["situacao"],
        where: { pesquisaId: p.id, rodada: 0 },
        _count: { _all: true },
      }),
    ]);
    const ids = [
      ...new Set(pares.flatMap((x) => [x.avaliadorId, x.avaliadoId])),
    ];
    const pessoas = await this.pessoasPorId(db, p.empresaId, ids);
    const porGestor = new Map<string, PessoaDoTime[]>();
    const auto = new Map(
      pares
        .filter((x) => x.papel === "autoavaliacao")
        .map((x) => [x.avaliadoId, x.respondidaEm !== null]),
    );
    for (const x of pares.filter((y) => y.papel === "gestor")) {
      const pessoa = pessoas.get(x.avaliadoId);
      const linha: PessoaDoTime = {
        ...(pessoa ?? vazia(x.avaliadoId)),
        gestorRespondeu: x.respondidaEm !== null,
        autoavaliacao: auto.has(x.avaliadoId)
          ? { respondeu: auto.get(x.avaliadoId)! }
          : null,
      };
      porGestor.set(x.avaliadorId, [
        ...(porGestor.get(x.avaliadorId) ?? []),
        linha,
      ]);
    }
    const times = [...porGestor]
      .map(([g, ps]) => ({
        gestor: pessoas.get(g) ?? vazia(g),
        pessoas: ps.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
      }))
      .sort((a, b) => a.gestor.nome.localeCompare(b.gestor.nome, "pt-BR"));
    const respondidas = pares.filter((x) => x.respondidaEm !== null).length;
    const contagem = (s: string) =>
      envios.find((e) => e.situacao === s)?._count._all ?? 0;
    return {
      pesquisaId: p.id,
      modelo: p.modelo,
      config,
      prazo: p.encerraEm ? p.encerraEm.toISOString() : null,
      times,
      totais: {
        gestores: times.length,
        pessoas: pares.filter((x) => x.papel === "gestor").length,
        autoavaliacoes: auto.size,
        respondidas,
        pendentes: pares.length - respondidas,
      },
      lembretes: p.encerraEm
        ? agendaDeLembretes(p.encerraEm, config.lembretes, new Date()).map(
            (l) => ({ lembrete: l.lembrete, quando: l.quando.toISOString() }),
          )
        : [],
      convites: {
        aguardandoEmail: contagem("aguardando_email"),
        semEmail: contagem("sem_email"),
        enviados: contagem("enviado"),
      },
    };
  }

  private async pessoasPorId(
    db: Db,
    empresaId: string,
    ids: readonly string[],
  ): Promise<Map<string, PessoaResumida>> {
    const ativos = await pessoasAtivas(db, empresaId);
    const mapa = new Map(
      ativos.filter((a) => ids.includes(a.id)).map((a) => [a.id, resumida(a)]),
    );
    const faltam = ids.filter((i) => !mapa.has(i));
    if (faltam.length) {
      const fora = await db.colaborador.findMany({
        where: { id: { in: faltam } },
        select: { id: true, nome: true },
      });
      for (const c of fora) mapa.set(c.id, { ...vazia(c.id), nome: c.nome });
    }
    return mapa;
  }

  /**
   * Grava os times e a configuração (rascunho, ativa ou pausada). Pares já
   * respondidos não saem (409). As perguntas são sempre o catálogo fixo;
   * os participantes (quem entra pelo link) seguem os pares.
   */
  async salvar(
    id: string,
    dto: { config?: unknown; times: TimeInformado[] },
    ctx: PessoasAuditContext,
  ): Promise<AvaliacaoDetalhe> {
    const empresaId = this.empresa(ctx, "escrita");
    return this.prisma.$transaction(async (tx) => {
      const p = await this.linha(tx, id, empresaId, ctx);
      if (!podeEditar(statusEfetivo(p.status, p.encerraEm, new Date()))) {
        throw new ConflictException();
      }
      const cfg = conferirConfigAvaliacao(
        p.modelo,
        dto.config,
        p.encerraEm,
        new Date(),
        lerEncerramento,
      );
      const ativos = await pessoasAtivas(tx, empresaId);
      const planejado = planejarPares(
        p.modelo,
        dto.times,
        new Set(ativos.map((a) => a.id)),
        new Set(ativos.filter((a) => a.identificavel).map((a) => a.id)),
      );
      const erros = [...cfg.erros, ...planejado.erros];
      if (erros.length) throw new CamposRecusadosException(erros);

      const existentes = await tx.pesquisaAvaliacaoPar.findMany({
        where: { pesquisaId: id },
        select: {
          id: true,
          avaliadorId: true,
          avaliadoId: true,
          papel: true,
          respostaId: true,
        },
      });
      const chave = (x: {
        avaliadorId: string;
        avaliadoId: string;
        papel: string;
      }) => `${x.avaliadorId}|${x.avaliadoId}|${x.papel}`;
      const desejados = new Set(planejado.pares.map(chave));
      const jaHa = new Set(existentes.map(chave));
      const saem = existentes.filter((x) => !desejados.has(chave(x)));
      if (saem.some((x) => x.respostaId !== null)) {
        throw new ConflitoDeCamposException([
          { campo: "times", motivo: "com_respostas" },
        ]);
      }
      if (saem.length) {
        await tx.pesquisaAvaliacaoPar.deleteMany({
          where: { id: { in: saem.map((x) => x.id) } },
        });
      }
      const novos = planejado.pares.filter((x) => !jaHa.has(chave(x)));
      if (novos.length) {
        await tx.pesquisaAvaliacaoPar.createMany({
          data: novos.map((x) => ({ ...x, pesquisaId: id, empresaId })),
        });
      }
      // Participantes = quem avalia; quem já respondeu algo fica.
      const queremos = new Set(participantesDosPares(planejado.pares));
      const participantes = await tx.pesquisaParticipante.findMany({
        where: { pesquisaId: id },
        select: { id: true, colaboradorId: true, respondeuEm: true },
      });
      const respondidosPor = new Set(
        existentes.filter((x) => x.respostaId).map((x) => x.avaliadorId),
      );
      const tirar = participantes.filter(
        (x) =>
          !queremos.has(x.colaboradorId) &&
          !respondidosPor.has(x.colaboradorId),
      );
      if (tirar.length) {
        await tx.pesquisaParticipante.deleteMany({
          where: { id: { in: tirar.map((x) => x.id) } },
        });
      }
      const ha = new Set(participantes.map((x) => x.colaboradorId));
      const entrar = [...queremos].filter((c) => !ha.has(c));
      if (entrar.length) {
        await tx.pesquisaParticipante.createMany({
          data: entrar.map((colaboradorId) => ({
            pesquisaId: id,
            empresaId,
            colaboradorId,
          })),
          skipDuplicates: true,
        });
      }
      // Um par sem resposta reaberto devolve o participante a "pendente".
      await tx.pesquisaParticipante.updateMany({
        where: {
          pesquisaId: id,
          respondeuEm: { not: null },
          colaborador: {
            avaliacoesFeitas: { some: { pesquisaId: id, respostaId: null } },
          },
        },
        data: { respondeuEm: null },
      });
      const temRespostas =
        (await tx.pesquisaResposta.count({ where: { pesquisaId: id } })) > 0;
      const alterada = await tx.pesquisa.update({
        where: { id },
        data: {
          configModelo: cfg.config as unknown as Prisma.InputJsonValue,
          ...(p.status === "rascunho"
            ? { identificacao: "identificada" as const }
            : {}),
          todos: false,
          ...(temRespostas
            ? {}
            : {
                secoes: secoesDaAvaliacao() as unknown as Prisma.InputJsonValue,
              }),
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
      return this.detalhe(tx, { ...alterada, modelo: p.modelo });
    });
  }

  // -------------------------------------------------------------------------
  // Resultados (nominais)

  private async carregar(db: Db, pesquisaId: string) {
    const pares = await db.pesquisaAvaliacaoPar.findMany({
      where: { pesquisaId },
      select: {
        avaliadorId: true,
        avaliadoId: true,
        papel: true,
        respondidaEm: true,
        resposta: { select: { valores: true } },
      },
    });
    return pares.map((x) => ({
      ...x,
      lido: x.resposta ? lerRespostaDaAvaliacao(x.resposta.valores) : null,
    }));
  }

  async resultados(id: string, ctx: PessoasAuditContext) {
    const empresaId = this.empresa(ctx, "respostas");
    const p = await this.linha(this.prisma, id, empresaId, ctx);
    const pares = await this.carregar(this.prisma, id);
    const ids = [
      ...new Set(pares.flatMap((x) => [x.avaliadorId, x.avaliadoId])),
    ];
    const [pessoas, ativos] = await Promise.all([
      this.pessoasPorId(this.prisma, empresaId, ids),
      pessoasAtivas(this.prisma, empresaId),
    ]);
    const admissao = new Map(ativos.map((a) => [a.id, a.admissao]));
    const hoje = hojeEmSaoPaulo();
    const doGestor: AvaliacaoDoGestor[] = pares
      .filter((x) => x.papel === "gestor" && x.lido)
      .map((x) => ({
        avaliadoId: x.avaliadoId,
        avaliadorId: x.avaliadorId,
        notas: x.lido!.notas,
      }));
    const autoDe = new Map(
      pares
        .filter((x) => x.papel === "autoavaliacao" && x.lido)
        .map((x) => [x.avaliadoId, x.lido!]),
    );
    const gestorDe = new Map(
      pares.filter((x) => x.papel === "gestor").map((x) => [x.avaliadoId, x]),
    );
    const listaDePessoas = [...gestorDe.values()]
      .map((x) => {
        const nota = x.lido ? notaDaAvaliacao(x.lido.notas) : null;
        const auto = autoDe.get(x.avaliadoId);
        const comp =
          x.lido && auto ? comparativoDaPessoa(x.lido.notas, auto.notas) : null;
        const adm = admissao.get(x.avaliadoId) ?? null;
        const pessoa = pessoas.get(x.avaliadoId) ?? vazia(x.avaliadoId);
        return {
          colaboradorId: x.avaliadoId,
          nome: pessoa.nome,
          cargo: pessoa.cargo,
          departamento: pessoa.departamento,
          gestor: {
            id: x.avaliadorId,
            nome: pessoas.get(x.avaliadorId)?.nome ?? "",
          },
          gestorRespondeu: x.respondidaEm !== null,
          temAutoavaliacao: pares.some(
            (y) => y.papel === "autoavaliacao" && y.avaliadoId === x.avaliadoId,
          ),
          autoavaliacaoRespondida: !!auto,
          nota,
          autoavaliacao: auto ? notaDaAvaliacao(auto.notas) : null,
          diferenca: comp?.diferenca ?? null,
          alinhamento: comp?.alinhamento ?? null,
          alertas: x.lido
            ? alertasDaAvaliacao(x.lido.notas, x.lido.comentarios)
            : [],
          tempoDeCasa: adm ? faixaDeTempoDeCasa(adm, hoje) : null,
        };
      })
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    const tempo = new Map(
      listaDePessoas.map((x) => [x.colaboradorId, x.tempoDeCasa]),
    );
    const depto = new Map(
      listaDePessoas.map((x) => [x.colaboradorId, x.departamento]),
    );
    const itens = ITENS.map((i) => {
      const v = doGestor
        .map((a) => a.notas[i.id])
        .filter((n): n is number => typeof n === "number");
      return {
        itemId: i.id,
        media: v.length
          ? Math.round((v.reduce((t, n) => t + n, 0) / v.length) * 10) / 10
          : null,
      };
    });
    await this.auditoria.registrarLeitura(
      ctx,
      "pesquisas_respostas_consultadas",
      "resposta_pesquisa",
      id,
      empresaId,
    );
    return {
      pesquisaId: id,
      modelo: p.modelo,
      avaliadas: doGestor.length,
      previstas: gestorDe.size,
      autoavaliacoes: {
        previstas: pares.filter((x) => x.papel === "autoavaliacao").length,
        respondidas: autoDe.size,
      },
      time: resumoDoTime(doGestor),
      itens,
      pessoas: listaDePessoas,
      calibracao: calibracao(doGestor).map((c) => ({
        ...c,
        nome: pessoas.get(c.avaliadorId)?.nome ?? "",
      })),
      recortes: {
        tempoDeCasa: recorte(doGestor, (pid) => tempo.get(pid) ?? null),
        departamento: recorte(doGestor, (pid) => depto.get(pid) ?? null),
      },
      comparativo:
        p.modelo === "avaliacao180"
          ? comparativoDoTime(
              doGestor
                .filter((a) => autoDe.has(a.avaliadoId))
                .map((a) => ({
                  gestor: a.notas,
                  auto: autoDe.get(a.avaliadoId)!.notas,
                })),
            )
          : null,
    };
  }

  async pessoa(id: string, colaboradorId: string, ctx: PessoasAuditContext) {
    const empresaId = this.empresa(ctx, "respostas");
    const p = await this.linha(this.prisma, id, empresaId, ctx);
    const pares = await this.carregar(this.prisma, id);
    const gestor = pares.find(
      (x) => x.papel === "gestor" && x.avaliadoId === colaboradorId,
    );
    if (!gestor) {
      return this.auditoria.negarAcesso(
        ctx,
        "resposta_pesquisa",
        colaboradorId,
        empresaId,
      );
    }
    const auto = pares.find(
      (x) => x.papel === "autoavaliacao" && x.avaliadoId === colaboradorId,
    );
    const pessoas = await this.pessoasPorId(this.prisma, empresaId, [
      colaboradorId,
      gestor.avaliadorId,
    ]);
    const doTime = resumoDoTime(
      pares
        .filter((x) => x.papel === "gestor" && x.lido)
        .map((x) => ({
          avaliadoId: x.avaliadoId,
          avaliadorId: x.avaliadorId,
          notas: x.lido!.notas,
        })),
    );
    const lado = (x: (typeof pares)[number] | undefined) =>
      x?.lido
        ? {
            respondidaEm: x.respondidaEm!.toISOString(),
            nota: notaDaAvaliacao(x.lido.notas),
            notas: x.lido.notas,
            comentarios: x.lido.comentarios,
            alertas: alertasDaAvaliacao(x.lido.notas, x.lido.comentarios),
          }
        : null;
    const g = lado(gestor);
    const a = lado(auto);
    const comparativo = g && a ? comparativoDaPessoa(g.notas, a.notas) : null;
    await this.auditoria.registrarLeitura(
      ctx,
      "pesquisas_respostas_consultadas",
      "resposta_pesquisa",
      id,
      empresaId,
    );
    const pessoa = pessoas.get(colaboradorId)!;
    return {
      pesquisaId: id,
      pesquisa: p.nome,
      modelo: p.modelo,
      colaboradorId,
      nome: pessoa.nome,
      cargo: pessoa.cargo,
      departamento: pessoa.departamento,
      gestor: {
        id: gestor.avaliadorId,
        nome: pessoas.get(gestor.avaliadorId)?.nome ?? "",
      },
      temAutoavaliacao: !!auto,
      gestorAvaliacao: g,
      autoavaliacao: a,
      comparativo,
      roteiro: comparativo ? roteiroDeFeedback(comparativo) : null,
      desenvolver: g ? pontosADesenvolver(g.nota) : [],
      time: {
        media: doTime.media,
        competencias: Object.fromEntries(
          doTime.competencias.map((c) => [c.competencia, c.media]),
        ),
      },
    };
  }

  /** Aba da ficha: as avaliações sobre a pessoa (com a nota do gestor). */
  async daFicha(colaboradorId: string, ctx: PessoasAuditContext) {
    const empresaId = this.empresa(ctx, "respostas");
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
    const pares = await this.prisma.pesquisaAvaliacaoPar.findMany({
      where: {
        empresaId,
        avaliadoId: colaboradorId,
        respostaId: { not: null },
        pesquisa: { excluidaEm: null },
      },
      orderBy: [{ respondidaEm: "desc" }, { id: "asc" }],
      select: {
        papel: true,
        respondidaEm: true,
        avaliador: { select: { nome: true } },
        resposta: { select: { valores: true } },
        pesquisa: { select: { id: true, nome: true, modelo: true } },
      },
    });
    await this.auditoria.registrarLeitura(
      ctx,
      "pesquisas_respostas_consultadas",
      "resposta_pesquisa",
      colaboradorId,
      empresaId,
    );
    const porPesquisa = new Map<
      string,
      {
        pesquisaId: string;
        nome: string;
        modelo: string;
        respondidaEm: string;
        gestor: string | null;
        geral: number | null;
        nivel: string | null;
        autoavaliacao: number | null;
      }
    >();
    for (const x of pares) {
      const nota = notaDaAvaliacao(
        lerRespostaDaAvaliacao(x.resposta!.valores).notas,
      );
      const atual = porPesquisa.get(x.pesquisa.id) ?? {
        pesquisaId: x.pesquisa.id,
        nome: x.pesquisa.nome,
        modelo: x.pesquisa.modelo,
        respondidaEm: x.respondidaEm!.toISOString(),
        gestor: null,
        geral: null,
        nivel: null,
        autoavaliacao: null,
      };
      if (x.papel === "gestor") {
        atual.gestor = x.avaliador.nome;
        atual.geral = nota.geral;
        atual.nivel = nota.nivel;
      } else {
        atual.autoavaliacao = nota.geral;
      }
      porPesquisa.set(x.pesquisa.id, atual);
    }
    return [...porPesquisa.values()];
  }

  // -------------------------------------------------------------------------
  // Pelo link

  private async doLink(token: string) {
    if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) throw new NotFoundException();
    const p = await this.prisma.pesquisa.findFirst({
      where: { token, excluidaEm: null, publicadaEm: { not: null } },
    });
    if (!p || !ehAvaliacao(p.modelo)) throw new NotFoundException();
    if (motivoIndisponivel(p.status, p.encerraEm, new Date()) !== null) {
      throw new GoneException();
    }
    return p as typeof p & { modelo: ModeloDeAvaliacao };
  }

  private async participanteDoPasse(pesquisaId: string, passe: unknown) {
    if (typeof passe !== "string" || !passe) throw new UnauthorizedException();
    const linha = await this.prisma.pesquisaPasse.findFirst({
      where: {
        hash: hashDoPasse(passe),
        pesquisaId,
        expiraEm: { gt: new Date() },
      },
      select: { participante: { select: { id: true, colaboradorId: true } } },
    });
    if (!linha) throw new UnauthorizedException();
    return linha.participante;
  }

  async pendentes(token: string, passe: unknown) {
    const p = await this.doLink(token);
    const participante = await this.participanteDoPasse(p.id, passe);
    const config = configGravada(p.configModelo);
    const pares = await this.prisma.pesquisaAvaliacaoPar.findMany({
      where: { pesquisaId: p.id, avaliadorId: participante.colaboradorId },
      select: {
        id: true,
        papel: true,
        avaliadoId: true,
        respondidaEm: true,
        avaliado: { select: { nome: true } },
      },
    });
    const avaliados = pares.map((x) => x.avaliadoId);
    const ativos = await pessoasAtivas(this.prisma, p.empresaId);
    const cargo = new Map(ativos.map((a) => [a.id, a.cargo]));
    // 180°: o gestor vê a autoavaliação só depois de enviar a dele.
    let autos = new Map<string, Record<string, number>>();
    let gestores = new Map<string, Record<string, number>>();
    if (
      p.modelo === "avaliacao180" &&
      config.visibilidade === "depois_do_gestor"
    ) {
      const outros = await this.prisma.pesquisaAvaliacaoPar.findMany({
        where: {
          pesquisaId: p.id,
          avaliadoId: { in: avaliados },
          respostaId: { not: null },
        },
        select: {
          avaliadoId: true,
          papel: true,
          resposta: { select: { valores: true } },
        },
      });
      const medias = (v: unknown) => {
        const n = notaDaAvaliacao(lerRespostaDaAvaliacao(v).notas);
        return Object.fromEntries(
          COMPETENCIAS.map((c) => [c, n.competencias[c] ?? 0]),
        );
      };
      autos = new Map(
        outros
          .filter((o) => o.papel === "autoavaliacao")
          .map((o) => [o.avaliadoId, medias(o.resposta!.valores)]),
      );
      gestores = new Map(
        outros
          .filter((o) => o.papel === "gestor")
          .map((o) => [o.avaliadoId, medias(o.resposta!.valores)]),
      );
    }
    const agora = Date.now();
    const prazoAuto = config.prazoAutoavaliacao
      ? new Date(config.prazoAutoavaliacao)
      : null;
    return {
      modelo: p.modelo,
      comentarios: config.comentarios,
      prazo: p.encerraEm ? p.encerraEm.toISOString() : null,
      prazoAutoavaliacao: config.prazoAutoavaliacao,
      itens: pares
        .map((x) => {
          const respondida = x.respondidaEm !== null;
          const aberta =
            !respondida &&
            !(
              x.papel === "autoavaliacao" &&
              prazoAuto &&
              prazoAuto.getTime() < agora
            );
          const ver =
            x.papel === "gestor" &&
            respondida &&
            autos.has(x.avaliadoId) &&
            gestores.has(x.avaliadoId);
          return {
            parId: x.id,
            papel: x.papel as "gestor" | "autoavaliacao",
            avaliado: {
              nome: x.avaliado.nome,
              cargo: cargo.get(x.avaliadoId) ?? null,
            },
            respondida,
            aberta,
            comparativo: ver
              ? {
                  gestor: gestores.get(x.avaliadoId)!,
                  autoavaliacao: autos.get(x.avaliadoId)!,
                }
              : null,
          };
        })
        .sort(
          (a, b) =>
            Number(a.papel === "gestor") - Number(b.papel === "gestor") ||
            a.avaliado.nome.localeCompare(b.avaliado.nome, "pt-BR"),
        ),
    };
  }

  async responder(
    token: string,
    parId: string,
    dados: { passe?: unknown; respostas?: unknown; comentarios?: unknown },
    metadata: SessionRequestMetadata,
  ): Promise<{ ok: true; restantes: number }> {
    const p = await this.doLink(token);
    const participante = await this.participanteDoPasse(p.id, dados.passe);
    const config = configGravada(p.configModelo);
    const par = await this.prisma.pesquisaAvaliacaoPar.findFirst({
      where: {
        id: parId,
        pesquisaId: p.id,
        avaliadorId: participante.colaboradorId,
      },
      select: { id: true, papel: true, respostaId: true },
    });
    if (!par) throw new NotFoundException();
    if (par.respostaId) throw new ConflictException();
    if (
      par.papel === "autoavaliacao" &&
      config.prazoAutoavaliacao &&
      new Date(config.prazoAutoavaliacao).getTime() < Date.now()
    ) {
      throw new GoneException();
    }
    const conferida = conferirRespostaDaAvaliacao(
      dados.respostas,
      dados.comentarios,
      config.comentarios,
    );
    if (conferida.erros.length) {
      throw new CamposRecusadosException(conferida.erros);
    }
    const restantes = await this.prisma.$transaction(async (tx) => {
      const resposta = await tx.pesquisaResposta.create({
        data: {
          pesquisaId: p.id,
          empresaId: p.empresaId,
          // A pessoa está no par (avaliado e avaliador), não na resposta.
          colaboradorId: null,
          valores: conferida.resposta!
            .valores as unknown as Prisma.InputJsonValue,
          respondidaEm: new Date(),
        },
      });
      const ligado = await tx.pesquisaAvaliacaoPar.updateMany({
        where: { id: par.id, respostaId: null },
        data: { respostaId: resposta.id, respondidaEm: resposta.respondidaEm },
      });
      if (ligado.count !== 1) throw new ConflictException();
      const faltam = await tx.pesquisaAvaliacaoPar.count({
        where: {
          pesquisaId: p.id,
          avaliadorId: participante.colaboradorId,
          respostaId: null,
        },
      });
      if (faltam === 0) {
        await tx.pesquisaParticipante.update({
          where: { id: participante.id },
          data: { respondeuEm: new Date(`${hojeEmSaoPaulo()}T00:00:00.000Z`) },
        });
        await tx.pesquisaPasse.deleteMany({
          where: { participanteId: participante.id },
        });
      }
      await this.auditService.record(
        {
          actorType: "system",
          actorSystemId: "pesquisa-publica:avaliacao",
          companyId: p.empresaId,
          action: "pesquisas_resposta_recebida",
          resource: "pesquisa",
          resourceId: p.id,
          ip: null,
          userAgent: null,
          result: "success",
          requestId: metadata.requestId,
        },
        tx,
      );
      return faltam;
    });
    return { ok: true, restantes };
  }
}

function vazia(id: string): PessoaResumida {
  return {
    id,
    nome: "",
    cargo: null,
    departamento: null,
    identificavel: false,
    temEmail: false,
  };
}
