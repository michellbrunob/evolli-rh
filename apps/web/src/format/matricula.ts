/**
 * T179 — matrícula do vínculo, como a tela a mostra.
 *
 * Decisão da proprietária de 2026-10-21: a matrícula passou a ser OPCIONAL na
 * admissão, e o servidor devolve `null` quando ela não foi informada. Toda
 * tela que mostra matrícula passa por aqui, para nunca exibir "null", nem um
 * espaço vazio que pareça erro de carga.
 *
 * Funções puras, fora dos clientes da API de propósito: os testes automockam
 * os clientes, e uma função de lá viraria `vi.fn` e deixaria de formatar.
 */

/** Texto de quem não tem matrícula — o mesmo em toda tela. */
export const SEM_MATRICULA = "Sem matrícula";

/** A matrícula aparada, ou `null` quando ausente ou só espaços. */
function matriculaInformada(
  matricula: string | null | undefined,
): string | null {
  if (typeof matricula !== "string") return null;
  const aparada = matricula.trim();
  return aparada === "" ? null : aparada;
}

/** A matrícula como veio, ou "Sem matrícula". Para célula, rótulo e título. */
export function exibirMatricula(matricula: string | null | undefined): string {
  return matriculaInformada(matricula) ?? SEM_MATRICULA;
}

/**
 * Trecho para o meio de uma frase ou opção: "matrícula MAT-1" ou
 * "sem matrícula" — nunca "matrícula Sem matrícula".
 */
export function trechoDeMatricula(
  matricula: string | null | undefined,
): string {
  const informada = matriculaInformada(matricula);
  return informada === null ? "sem matrícula" : `matrícula ${informada}`;
}
