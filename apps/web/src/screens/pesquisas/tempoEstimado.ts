/**
 * T216 — tempo estimado de uma pesquisa, numa regra só para a tela do RH
 * (pré-visualização, galeria, assistente) e para a página pública de
 * resposta, e para o texto de todos os modelos: 0,3 minuto por pergunta,
 * arredondado, no mínimo 3 minutos (a mesma do Onboarding). Nenhum
 * catálogo escreve os minutos à mão: o texto sai daqui.
 */
import { plural } from "../../format/plural";

export function minutosEstimados(totalDePerguntas: number): number {
  return Math.max(3, Math.round(totalDePerguntas * 0.3));
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
  readonly secoes: readonly SecaoParaOTempo[];
  readonly comentarioFinal?: string | null;
  readonly grupos?: readonly { readonly quantidade: number }[];
}): number {
  const n =
    m.secoes.length === 0 && m.grupos
      ? m.grupos.reduce((t, g) => t + g.quantidade, 0)
      : perguntasParaOTempo(m.secoes, m.comentarioFinal);
  return minutosEstimados(n);
}

/** "Cerca de 19 minutos" (de N perguntas) para o texto do catálogo. */
export function tempoParaResponder(totalDePerguntas: number): string {
  const t = textoDoTempoEstimado(minutosEstimados(totalDePerguntas));
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** "19 min" (de N perguntas) para os números do catálogo. */
export function minutosCurtos(totalDePerguntas: number): string {
  return `${minutosEstimados(totalDePerguntas)} min`;
}

/** "cerca de 19 minutos" (de N perguntas) para o meio de uma frase. */
export function tempoNoTexto(totalDePerguntas: number): string {
  return textoDoTempoEstimado(minutosEstimados(totalDePerguntas));
}
