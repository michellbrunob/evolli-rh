import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { CamposRecusadosException } from "../../common/erros/recusa-por-campo";
import { PessoasAuditoriaService } from "../../pessoas/pessoas-auditoria.service";
import type { PessoasAuditContext } from "../../pessoas/pessoas.types";
import { gruposDoCampo } from "../calculo-resultados";
import { PesquisasService } from "../pesquisas.service";
import type {
  CampoGrupo,
  MotivoOculto,
  ValorRespondido,
} from "../pesquisas.types";
import {
  acompanhamentoVazio,
  conferirAcompanhamento,
  detalharAcompanhamento,
  lerAcompanhamento,
  type AcompanhamentoNr1Detalhe,
} from "./copsoq/acompanhamento";
import {
  calcularNr1,
  individualNr1,
  pressaoERecursos,
  type IndividualNr1,
  type NivelNr1,
  type ResultadoNr1,
} from "./copsoq/calculo";
import {
  calcularIsfb,
  calcularPessoaIsfb,
  MEDIA_DO_BRASIL,
  type FaixaIsfb,
  type PessoaIsfb,
  type ResultadoIsfb,
  type SaudeFinanceira,
} from "./isfb/calculo";
import { temResultadoProprio, type ModeloComResultado } from "./registro";

/**
 * T216 — resultados dos modelos com cálculo próprio (riscos psicossociais
 * NR-1 e saúde financeira): o time, os recortes por grupo, o resultado de
 * uma resposta e o acompanhamento da NR-1 (etapas e plano de ação).
 *
 * Privacidade: igual aos resultados gerais. Na confidencial, nada aparece
 * abaixo do mínimo por grupo; recortes abaixo do mínimo (e o menor visível,
 * quando o oculto seria descoberto por subtração) não mostram números;
 * fora da identificada, contagens de comportamentos ofensivos abaixo do
 * mínimo somem. O resultado de uma resposta segue as respostas individuais
 * (identificada e anônima; auditado).
 */

export interface GrupoDoModelo {
  id: string;
  nome: string;
  respostas: number;
  visivel: boolean;
  oculto: MotivoOculto | null;
  nr1: {
    pressao: number | null;
    recursos: number | null;
    /** Pressão acima e recursos abaixo da empresa. */
    destaque: boolean;
    niveis: Record<NivelNr1, number>;
    precisamDeAcao: number;
    dimensoes: {
      id: string;
      escore: number | null;
      percentualEmRisco: number;
      nivel: NivelNr1 | null;
    }[];
  } | null;
  isfb: {
    isfb: number | null;
    faixa: FaixaIsfb | null;
    saude: Record<SaudeFinanceira, number>;
    /** Pessoas com 3 ou 4 sinais de alerta. */
    comTresOuMaisSinais: number;
  } | null;
}

export interface ResultadoDoModelo {
  modelo: ModeloComResultado;
  respostas: number;
  /** Na confidencial, `false` abaixo do mínimo por grupo. */
  visivel: boolean;
  minimoPorGrupo: number;
  recortes: CampoGrupo[];
  nr1:
    (ResultadoNr1 & { pressao: number | null; recursos: number | null }) | null;
  isfb: (ResultadoIsfb & { mediaDoBrasil: number }) | null;
  campo: CampoGrupo | null;
  /** Os grupos do campo pedido (`campo`), ordem alfabética. */
  grupos: GrupoDoModelo[] | null;
  /** Respostas sem grupo no campo pedido. */
  semGrupo: number;
}

export interface IndividualDoModelo {
  modelo: ModeloComResultado;
  respostaId: string;
  nr1: IndividualNr1 | null;
  isfb:
    | (PessoaIsfb & {
        isfbDoTime: number | null;
        mediaDoBrasil: number;
        dimensoesDoTime: Record<string, number | null>;
      })
    | null;
}

@Injectable()
export class ModelosPesquisaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pesquisas: PesquisasService,
    private readonly auditoria: PessoasAuditoriaService,
  ) {}

  private modeloDa(modelo: string): ModeloComResultado {
    if (!temResultadoProprio(modelo as never)) throw new NotFoundException();
    return modelo as ModeloComResultado;
  }

  async resultado(
    id: string,
    campo: CampoGrupo | null,
    ctx: PessoasAuditContext,
  ): Promise<ResultadoDoModelo> {
    const { pesquisa: p } = await this.pesquisas.pesquisaDoModelo(
      this.prisma,
      id,
      "leitura",
      ctx,
    );
    const modelo = this.modeloDa(p.modelo);
    const { respostas, nomesDosGrupos, recortes } =
      await this.pesquisas.respostasDoModelo(p);
    if (campo && !recortes.includes(campo)) {
      throw new CamposRecusadosException([
        { campo: "campo", motivo: "nao_se_aplica" },
      ]);
    }
    const minimo = p.minimoPorGrupo;
    const visivel =
      p.identificacao !== "confidencial" || respostas.length >= minimo;
    const sigilo = p.identificacao === "identificada" ? null : minimo;
    const base: ResultadoDoModelo = {
      modelo,
      respostas: respostas.length,
      visivel,
      minimoPorGrupo: minimo,
      recortes,
      nr1: null,
      isfb: null,
      campo,
      grupos: null,
      semGrupo: 0,
    };
    if (!visivel) return base;

    let empresaNr1: ResultadoDoModelo["nr1"] = null;
    if (modelo === "copsoq") {
      const r = calcularNr1(respostas, { sigilo });
      empresaNr1 = { ...r, ...pressaoERecursos(r) };
      base.nr1 = empresaNr1;
    } else {
      base.isfb = {
        ...calcularIsfb(respostas, minimo),
        mediaDoBrasil: MEDIA_DO_BRASIL,
      };
    }

    if (campo) {
      base.semGrupo = respostas.filter((r) => !r.grupos[campo]).length;
      base.grupos = gruposDoCampo(campo, respostas, nomesDosGrupos, minimo).map(
        (g) => {
          const doGrupo = respostas.filter((r) => r.grupos[campo] === g.id);
          const grupo: GrupoDoModelo = {
            id: g.id,
            nome: g.nome,
            respostas: g.respostas,
            visivel: g.visivel,
            oculto: g.oculto,
            nr1: null,
            isfb: null,
          };
          if (!g.visivel) return grupo;
          if (empresaNr1) {
            const r = calcularNr1(doGrupo, { sigilo });
            const pr = pressaoERecursos(r);
            grupo.nr1 = {
              ...pr,
              destaque:
                pr.pressao !== null &&
                pr.recursos !== null &&
                empresaNr1.pressao !== null &&
                empresaNr1.recursos !== null &&
                pr.pressao > empresaNr1.pressao &&
                pr.recursos < empresaNr1.recursos,
              niveis: r.niveis,
              precisamDeAcao: r.precisamDeAcao,
              dimensoes: r.dimensoes.map((x) => ({
                id: x.id,
                escore: x.escore,
                percentualEmRisco: x.percentuais.risco,
                nivel: x.nivel,
              })),
            };
          } else {
            const r = calcularIsfb(doGrupo, minimo);
            grupo.isfb = {
              isfb: r.isfb,
              faixa: r.faixa,
              saude: {
                baixa: r.saude.baixa.quantidade,
                no_limite: r.saude.no_limite.quantidade,
                saudavel: r.saude.saudavel.quantidade,
              },
              comTresOuMaisSinais:
                r.sinaisAcumulados[3]! + r.sinaisAcumulados[4]!,
            };
          }
          return grupo;
        },
      );
    }
    return base;
  }

  /** O resultado de uma resposta (identificada e anônima; auditado). */
  async individual(
    id: string,
    respostaId: string,
    ctx: PessoasAuditContext,
  ): Promise<IndividualDoModelo> {
    const { pesquisa: p } = await this.pesquisas.pesquisaDoModelo(
      this.prisma,
      id,
      "leitura",
      ctx,
    );
    const modelo = this.modeloDa(p.modelo);
    // Mesma regra e auditoria das respostas individuais (404 na
    // confidencial e para resposta de outra pesquisa).
    const detalhe = await this.pesquisas.respostaIndividual(
      id,
      respostaId,
      ctx,
    );
    const valores: ValorRespondido[] = detalhe.valores.map((v) => ({
      perguntaId: v.perguntaId,
      valor: v.valor,
    }));
    const { respostas } = await this.pesquisas.respostasDoModelo(p);
    if (modelo === "copsoq") {
      return {
        modelo,
        respostaId,
        nr1: individualNr1(valores, calcularNr1(respostas)),
        isfb: null,
      };
    }
    const pessoa = calcularPessoaIsfb(valores);
    const time = calcularIsfb(respostas, p.minimoPorGrupo);
    return {
      modelo,
      respostaId,
      nr1: null,
      isfb: pessoa
        ? {
            ...pessoa,
            isfbDoTime: time.isfb,
            mediaDoBrasil: MEDIA_DO_BRASIL,
            dimensoesDoTime: Object.fromEntries(
              time.dimensoes.map((d) => [d.id, d.nota]),
            ),
          }
        : null,
    };
  }

  private async detalhe(
    p: { id: string; identificacao: string; publicadaEm: Date | null },
    bruto: unknown,
  ): Promise<AcompanhamentoNr1Detalhe> {
    const [respostas, participantes] = await Promise.all([
      this.prisma.pesquisaResposta.count({ where: { pesquisaId: p.id } }),
      this.prisma.pesquisaParticipante.count({ where: { pesquisaId: p.id } }),
    ]);
    return detalharAcompanhamento(lerAcompanhamento(bruto), {
      anonima: p.identificacao === "anonima",
      respostas,
      participantes,
      publicadaEm: p.publicadaEm,
    });
  }

  /** Conformidade com a NR-1 (só no modelo de riscos psicossociais). */
  async acompanhamento(
    id: string,
    ctx: PessoasAuditContext,
  ): Promise<AcompanhamentoNr1Detalhe> {
    const { pesquisa: p } = await this.pesquisas.pesquisaDoModelo(
      this.prisma,
      id,
      "leitura",
      ctx,
    );
    if (p.modelo !== "copsoq") throw new NotFoundException();
    return this.detalhe(p, p.acompanhamento ?? acompanhamentoVazio());
  }

  async gravarAcompanhamento(
    id: string,
    corpo: unknown,
    ctx: PessoasAuditContext,
  ): Promise<AcompanhamentoNr1Detalhe> {
    const gravado = await this.prisma.$transaction(async (tx) => {
      const { pesquisa: p, empresaId } = await this.pesquisas.pesquisaDoModelo(
        tx,
        id,
        "escrita",
        ctx,
      );
      if (p.modelo !== "copsoq") throw new NotFoundException();
      const conferido = conferirAcompanhamento(
        corpo,
        lerAcompanhamento(p.acompanhamento),
        new Date(),
      );
      if (!conferido.ok) throw new CamposRecusadosException(conferido.erros);
      const novo = await tx.pesquisa.update({
        where: { id: p.id },
        data: {
          acompanhamento: conferido.valor as unknown as Prisma.InputJsonValue,
        },
      });
      await this.auditoria.registrarMutacao(
        tx,
        ctx,
        "pesquisas_pesquisa_alterada",
        "pesquisa",
        p.id,
        empresaId,
      );
      return novo;
    });
    return this.detalhe(gravado, gravado.acompanhamento);
  }
}
