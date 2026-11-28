/**
 * T216 — tempo estimado de uma pesquisa, numa regra só para a tela do RH
 * (pré-visualização, galeria, assistente) e para a página pública de
 * resposta, e para o texto de todos os modelos: 0,3 minuto por pergunta,
 * arredondado, no mínimo 3 minutos (a mesma do Onboarding).
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
