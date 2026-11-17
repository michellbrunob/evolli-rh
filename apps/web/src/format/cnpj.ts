/**
 * T209 — CNPJ na tela. 14 posições: as 12 primeiras numéricas ou, desde
 * 2026, alfanuméricas (maiúsculas); as 2 últimas, dígitos verificadores pelo
 * módulo 11, com o valor de cada caractere = código ASCII − 48. O servidor
 * confere de novo: aqui é só para avisar antes de enviar.
 */

const PESOS_1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const PESOS_2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

/** Só os caracteres que valem, na ordem: 12 alfanuméricos e 2 dígitos. */
function caracteres(texto: string): string {
  let saida = "";
  for (const c of texto.toUpperCase()) {
    if (saida.length >= 14) break;
    if (saida.length < 12 ? /[0-9A-Z]/.test(c) : /[0-9]/.test(c)) saida += c;
  }
  return saida;
}

function comMascara(limpo: string): string {
  const partes = [
    limpo.slice(0, 2),
    limpo.slice(2, 5),
    limpo.slice(5, 8),
    limpo.slice(8, 12),
    limpo.slice(12, 14),
  ];
  let saida = partes[0]!;
  if (partes[1]) saida += `.${partes[1]}`;
  if (partes[2]) saida += `.${partes[2]}`;
  if (partes[3]) saida += `/${partes[3]}`;
  if (partes[4]) saida += `-${partes[4]}`;
  return saida;
}

/** Máscara progressiva 00.000.000/0000-00, enquanto se digita. */
export function mascararCnpj(texto: string): string {
  return comMascara(caracteres(texto));
}

function verificador(texto: string, pesos: readonly number[]): number {
  let soma = 0;
  for (let i = 0; i < pesos.length; i += 1) {
    soma += (texto.charCodeAt(i) - 48) * pesos[i]!;
  }
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

/** O CNPJ (com ou sem máscara) está completo e com os verificadores certos. */
export function cnpjValido(texto: string): boolean {
  const limpo = caracteres(texto);
  if (!/^[0-9A-Z]{12}[0-9]{2}$/.test(limpo)) return false;
  if (/^(.)\1{13}$/.test(limpo)) return false;
  return limpo.endsWith(
    `${verificador(limpo, PESOS_1)}${verificador(limpo, PESOS_2)}`,
  );
}

/** O CNPJ gravado (14 posições, sem máscara), para exibir. */
export function formatarCnpj(cnpj: string): string {
  return comMascara(caracteres(cnpj));
}
