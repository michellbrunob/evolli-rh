import { normalizeEmail } from "../../auth/normalize-email.util";

/**
 * Formato e normalização dos contatos do colaborador — regra explícita da
 * ficha de tratamento (docs/decisions/ficha-tratamento-contatos-colaborador.md,
 * §3, com a alteração da §8 na T179: telefone só brasileiro, em `+55`).
 *
 * As funções de normalização recebem `unknown` porque rodam como `@Transform`,
 * ANTES da validação: um valor que não é texto, ou que traz caractere fora do
 * permitido, volta intacto e a validação o recusa — normalizar nunca "conserta"
 * entrada inválida.
 */

/** Limite de endereço de e-mail (RFC 5321, caminho completo). */
export const LIMITE_EMAIL_PESSOAL = 254;

/**
 * Um `@`, nada de espaço, e algo dos dois lados. É a mesma prova que o CHECK do
 * banco faz; o formato completo fica com `@IsEmail()`.
 */
export const EMAIL_PESSOAL_FORMA = /^[^@\s]+@[^@\s]+$/;

/**
 * T179 — celular e telefone **brasileiros**, normalizados em `+55` + DDD +
 * número (decisão da proprietária de 2026-10-21; ficha de Contatos, §8): DDD
 * de dois dígitos de 1 a 9; celular com 9 dígitos iniciado por 9; fixo com 8
 * dígitos iniciado por 2 a 5. Número estrangeiro não é aceito nesta etapa.
 */
export const TELEFONE_NORMALIZADO = /^\+55[1-9]{2}(?:9[0-9]{8}|[2-5][0-9]{7})$/;

/**
 * O que a entrada pode conter antes de normalizar: dígitos e, só como
 * separadores, espaço, parênteses, hífen e ponto, com `+` apenas no início.
 */
const TELEFONE_ENTRADA = /^\+?[0-9 ().-]+$/;

/** E-mail pessoal: o mesmo tratamento do e-mail de conta (pontas e caixa). */
export function normalizarEmailPessoal(valor: unknown): unknown {
  if (typeof valor !== "string") return valor;
  // T179 — contato opcional: vazio (ou só espaço) vale como não informado.
  const normalizado = normalizeEmail(valor);
  return normalizado === "" ? null : normalizado;
}

/**
 * Celular ou telefone: remove os separadores e leva à forma `+55` + DDD +
 * número. Aceita o número nacional (10 ou 11 dígitos, com ou sem máscara) e o
 * internacional brasileiro (`+55` ou `55` + 10 ou 11 dígitos). O que não tiver
 * uma dessas formas volta como veio, para a validação recusar: `+` de outro
 * país, comprimento errado, DDD ou número fora da regra.
 */
export function normalizarTelefone(valor: unknown): unknown {
  if (typeof valor !== "string") {
    return valor;
  }
  const aparado = valor.trim();
  // T179 — contato opcional: vazio (ou só espaço) vale como não informado.
  if (aparado === "") return null;
  if (!TELEFONE_ENTRADA.test(aparado)) {
    return valor;
  }
  const digitos = aparado.replace(/[^0-9]/g, "");
  if (aparado.startsWith("+")) {
    return digitos.startsWith("55") ? `+${digitos}` : valor;
  }
  if (digitos.length === 10 || digitos.length === 11) {
    return `+55${digitos}`;
  }
  if (
    (digitos.length === 12 || digitos.length === 13) &&
    digitos.startsWith("55")
  ) {
    return `+${digitos}`;
  }
  return valor;
}
