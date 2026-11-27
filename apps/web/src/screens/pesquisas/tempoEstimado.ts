/**
 * T216 — tempo estimado de uma pesquisa, numa regra só para a tela do RH
 * (pré-visualização, galeria, assistente) e para a página pública de
 * resposta: cerca de 20 segundos por pergunta, arredondado, no mínimo 1
 * minuto.
 */
export function minutosEstimados(totalDePerguntas: number): number {
  return Math.max(1, Math.round((totalDePerguntas * 20) / 60));
}
