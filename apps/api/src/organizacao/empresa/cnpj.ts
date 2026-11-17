/**
 * T209 — CNPJ da empresa.
 *
 * 14 posições: as 12 primeiras numéricas ou, desde 2026, alfanuméricas em
 * maiúsculas; as 2 últimas são os dígitos verificadores (módulo 11), com o
 * valor de cada caractere igual ao código ASCII menos 48 — para dígitos, o
 * próprio dígito, como no CNPJ numérico de sempre.
 */

const FORMATO = /^[0-9A-Z]{12}[0-9]{2}$/;
const PESOS_1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const PESOS_2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

/**
 * Tira a máscara (ponto, barra, hífen e espaços) e põe em maiúsculas.
 * `null` quando o resultado não tem o formato do CNPJ.
 */
export function normalizarCnpj(texto: string): string | null {
  const limpo = texto.replace(/[\s./-]/g, "").toUpperCase();
  return FORMATO.test(limpo) ? limpo : null;
}

function verificador(texto: string, pesos: readonly number[]): number {
  let soma = 0;
  for (let i = 0; i < pesos.length; i += 1) {
    soma += (texto.charCodeAt(i) - 48) * pesos[i]!;
  }
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

/** O CNPJ normalizado tem os verificadores certos (e não é repetido). */
export function cnpjValido(cnpj: string): boolean {
  if (!FORMATO.test(cnpj)) return false;
  // Todos os caracteres iguais passam no módulo 11, mas não são CNPJ.
  if (/^(.)\1{13}$/.test(cnpj)) return false;
  const d1 = verificador(cnpj, PESOS_1);
  const d2 = verificador(cnpj, PESOS_2);
  return cnpj.endsWith(`${d1}${d2}`);
}
