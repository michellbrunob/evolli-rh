/**
 * T215 — "Publicar a escala": o resumo do que o rascunho muda e os períodos
 * que dá para publicar (como a referência: a semana, o mês ou 4 semanas).
 */
import type { PessoaDoQuadroApi } from "../../../api/escalaClient";
import { diaMesComZero } from "../../../format/data";
import { somarDias } from "../../pessoas/ficha/escala/calendarioDaEscala";
import { resolverDia } from "../../pessoas/ficha/escala/diaDaEscala";
import { type Visao, periodosNoDia, tituloDoPeriodo } from "./quadroDaEscala";

export interface ResumoDaPublicacao {
  /**
   * Dias de rascunho sem nada publicado no dia e dias do padrão ainda não
   * publicados (T215 — Publicar grava todo dia resolvido).
   */
  readonly novas: number;
  /** Dias de rascunho que trocam o publicado (sem tirar o trabalho). */
  readonly alteradas: number;
  /** Trabalho ou sobreaviso publicado que vira folga ou DSR. */
  readonly removidas: number;
  readonly pessoas: number;
}

const ESCALADO = new Set(["trabalho", "sobreaviso"]);

/**
 * T215 — o dia segue o padrão e ainda não foi publicado: Publicar o grava
 * como publicado (a mesma regra do servidor). Sem padrão no dia, trabalho
 * sem turno fixo ou com mais de 2 períodos não têm forma de dia gravado e
 * continuam pelo padrão; fora do vínculo, nada.
 */
export function padraoParaPublicar(p: PessoaDoQuadroApi, dia: string): boolean {
  if (dia < p.dataAdmissao) return false;
  if (p.dataDesligamento !== null && dia > p.dataDesligamento) return false;
  if ((p.dias ?? []).some((d) => d.dia === dia)) return false;
  const r = resolverDia(p.escalas, dia);
  if (r.tipo === "sem-escala") return false;
  if (r.tipo !== "trabalho") return true;
  if (r.turno === null) return false;
  return periodosNoDia(r.turno, dia).length <= 2;
}

/**
 * O que publicar muda nos dias dados: o rascunho (novo, sobre um publicado
 * ou tirando o trabalho) e os dias do padrão ainda não publicados (novos).
 */
export function resumoDaPublicacao(
  pessoas: readonly PessoaDoQuadroApi[],
  dias: ReadonlySet<string>,
): ResumoDaPublicacao {
  let novas = 0;
  let alteradas = 0;
  let removidas = 0;
  const comMudanca = new Set<string>();
  for (const p of pessoas) {
    for (const dia of dias) {
      if (!padraoParaPublicar(p, dia)) continue;
      novas += 1;
      comMudanca.add(p.colaboradorId);
    }
    for (const d of p.dias ?? []) {
      if (d.camada !== "rascunho" || !dias.has(d.dia)) continue;
      comMudanca.add(p.colaboradorId);
      const publicado = (p.dias ?? []).find(
        (x) => x.dia === d.dia && x.camada === "publicado",
      );
      if (!publicado) novas += 1;
      else if (ESCALADO.has(publicado.tipo) && !ESCALADO.has(d.tipo)) {
        removidas += 1;
      } else alteradas += 1;
    }
  }
  return { novas, alteradas, removidas, pessoas: comMudanca.size };
}

export interface PeriodoDaPublicacao {
  readonly rotulo: string;
  readonly inicio: string;
  readonly fim: string;
}

/**
 * Os períodos do diálogo: o do quadro primeiro. Na semana: a semana, o mês
 * dela e 4 semanas a partir dela; no mês: o mês e 4 semanas a partir dele.
 */
export function periodosDaPublicacao(
  visao: Visao,
  inicio: string,
  fim: string,
): PeriodoDaPublicacao[] {
  const mes = (dia: string): PeriodoDaPublicacao => {
    const primeiro = `${dia.slice(0, 7)}-01`;
    const ultimo = somarDias(`${somarDias(primeiro, 32).slice(0, 7)}-01`, -1);
    const nome = tituloDoPeriodo("mes", primeiro, ultimo);
    return {
      rotulo: `Mês de ${nome.charAt(0).toLowerCase()}${nome.slice(1)}`,
      inicio: primeiro,
      fim: ultimo,
    };
  };
  const fimDas4 = somarDias(inicio, 27);
  const quatro: PeriodoDaPublicacao = {
    rotulo: `Até ${diaMesComZero(fimDas4)} (4 semanas)`,
    inicio,
    fim: fimDas4,
  };
  if (visao === "mes") return [mes(inicio), quatro];
  return [
    {
      rotulo: `Semana de ${tituloDoPeriodo("semana", inicio, fim)}`,
      inicio,
      fim,
    },
    mes(inicio),
    quatro,
  ];
}
