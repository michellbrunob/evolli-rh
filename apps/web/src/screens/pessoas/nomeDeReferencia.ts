/**
 * T197 — o nome de uma referência criada inline na Nova admissão, com a MESMA
 * regra do servidor (`criacao-automatica.ts`): extremidades aparadas, espaços
 * repetidos reduzidos a um, maiúsculas, minúsculas e acentos como digitados.
 * O servidor continua sendo a autoridade; aqui só se decide se a opção
 * "Criar" faz sentido e o que a confirmação mostra.
 */

export const NOME_MAXIMO_DA_REFERENCIA = 160;

// eslint-disable-next-line no-control-regex
const CARACTERE_DE_CONTROLE = /[\u0000-\u001F\u007F]/;

/** Nome como será gravado, ou `null` se vazio, longo ou com controle. */
export function normalizarNomeDeReferencia(texto: string): string | null {
  if (CARACTERE_DE_CONTROLE.test(texto)) return null;
  const nome = texto.trim().replace(/\s+/g, " ");
  if (!nome || nome.length > NOME_MAXIMO_DA_REFERENCIA) return null;
  return nome;
}

/** Comparação de nomes: sem diferenciar maiúsculas; acentos contam. */
export function chaveDoNome(nome: string): string {
  return nome.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
}
