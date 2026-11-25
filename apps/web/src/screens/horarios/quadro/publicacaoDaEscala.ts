/**
 * T215 — "Publicar a escala": o resumo do que o rascunho muda e os períodos
 * que dá para publicar (como a referência: a semana, o mês ou 4 semanas).
 */
import type { PessoaDoQuadroApi } from "../../../api/escalaClient";
import { diaMesComZero } from "../../../format/data";
import { somarDias } from "../../pessoas/ficha/escala/calendarioDaEscala";
import { type Visao, tituloDoPeriodo } from "./quadroDaEscala";

export interface ResumoDaPublicacao {
  /** Dias de rascunho sem nada publicado no dia. */
  readonly novas: number;
  /** Dias de rascunho que trocam o publicado (sem tirar o trabalho). */
  readonly alteradas: number;
  /** Trabalho ou sobreaviso publicado que vira folga ou DSR. */
  readonly removidas: number;
  readonly pessoas: number;
}

const ESCALADO = new Set(["trabalho", "sobreaviso"]);

/** O que o rascunho das pessoas muda, nos dias dados. */
export function resumoDaPublicacao(
  pessoas: readonly PessoaDoQuadroApi[],
  dias: ReadonlySet<string>,
): ResumoDaPublicacao {
  let novas = 0;
  let alteradas = 0;
  let removidas = 0;
  const comMudanca = new Set<string>();
  for (const p of pessoas) {
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
