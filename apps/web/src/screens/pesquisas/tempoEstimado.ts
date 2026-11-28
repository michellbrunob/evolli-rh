/**
 * T216 — tempo estimado de uma pesquisa, o mesmo na tela do RH
 * (pré-visualização, galeria, assistente, resumo), na página pública de
 * resposta e no texto de todos os modelos. Os modelos do mapa têm minutos
 * fixos (decisão da proprietária), mesmo quando o RH acrescenta ou tira
 * perguntas; os demais seguem a regra: 0,3 minuto por pergunta,
 * arredondado, no mínimo 3 minutos. Nenhum catálogo escreve os minutos à
 * mão: o texto sai daqui.
 */
import { plural } from "../../format/plural";

/** A regra dos modelos fora do mapa. */
export function minutosEstimados(totalDePerguntas: number): number {
  return Math.max(3, Math.round(totalDePerguntas * 0.3));
}

/**
 * Os minutos fixos de cada modelo: espelho exato do mapa da API
 * (`regras-pesquisa.ts`), conferido por teste.
 */
export const MINUTOS_POR_MODELO: Readonly<Record<string, number>> = {
  pulso: 2,
  clima: 15,
  copsoq: 15,
  disc: 8,
  isfb: 6,
  onboarding: 5,
};

/** O tempo da pesquisa: o do mapa ou, fora dele (e sem modelo), a regra. */
export function minutosDaPesquisa(
  modelo: string | null | undefined,
  totalDePerguntas: number,
): number {
  return (
    (modelo ? MINUTOS_POR_MODELO[modelo] : undefined) ??
    minutosEstimados(totalDePerguntas)
  );
}

/** "cerca de 3 minutos" (ou "menos de 1 minuto" sem perguntas). */
export function textoDoTempoEstimado(minutos: number): string {
  if (minutos < 1) return "menos de 1 minuto";
  return `cerca de ${plural(Math.round(minutos), "minuto", "minutos")}`;
}

interface SecaoParaOTempo {
  readonly perguntas: readonly unknown[];
}

/**
 * Quantas perguntas a página pública conta: todas as das seções (os
 * comentários por dimensão também) e o comentário final, quando há.
 */
export function perguntasParaOTempo(
  secoes: readonly SecaoParaOTempo[],
  comentarioFinal?: string | null,
): number {
  return (
    secoes.reduce((t, s) => t + s.perguntas.length, 0) +
    (comentarioFinal ? 1 : 0)
  );
}

/** Os minutos de um modelo da galeria, contados como na página pública. */
export function minutosDoModelo(m: {
  readonly id: string;
  readonly secoes: readonly SecaoParaOTempo[];
  readonly comentarioFinal?: string | null;
  readonly grupos?: readonly { readonly quantidade: number }[];
}): number {
  const n =
    m.secoes.length === 0 && m.grupos
      ? m.grupos.reduce((t, g) => t + g.quantidade, 0)
      : perguntasParaOTempo(m.secoes, m.comentarioFinal);
  return minutosDaPesquisa(m.id, n);
}

/** "Cerca de 19 minutos" (do modelo, de N perguntas) para o catálogo. */
export function tempoParaResponder(
  modelo: string,
  totalDePerguntas: number,
): string {
  const t = tempoNoTexto(modelo, totalDePerguntas);
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** "19 min" (do modelo, de N perguntas) para os números do catálogo. */
export function minutosCurtos(
  modelo: string,
  totalDePerguntas: number,
): string {
  return `${minutosDaPesquisa(modelo, totalDePerguntas)} min`;
}

/** "cerca de 19 minutos" (do modelo, de N perguntas) no meio de uma frase. */
export function tempoNoTexto(modelo: string, totalDePerguntas: number): string {
  return textoDoTempoEstimado(minutosDaPesquisa(modelo, totalDePerguntas));
}
