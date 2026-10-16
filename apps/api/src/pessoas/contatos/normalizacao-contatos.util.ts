import { normalizeEmail } from "../../auth/normalize-email.util";

/**
 * Formato e normalização dos contatos do colaborador — regra explícita da
 * ficha de tratamento (docs/decisions/ficha-tratamento-contatos-colaborador.md,
 * §3). Não havia padrão de telefone no projeto, e a ficha não fixa país: nada
 * aqui presume DDD, DDI ou formato nacional.
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

/** Celular e telefone normalizados: `+` opcional e 8 a 15 dígitos (E.164). */
export const TELEFONE_NORMALIZADO = /^\+?[0-9]{8,15}$/;

/**
 * O que a entrada pode conter antes de normalizar: dígitos e, só como
 * separadores, espaço, parênteses, hífen e ponto, com `+` apenas no início.
 */
const TELEFONE_ENTRADA = /^\+?[0-9 ().-]+$/;

/** E-mail pessoal: o mesmo tratamento do e-mail de conta (pontas e caixa). */
export function normalizarEmailPessoal(valor: unknown): unknown {
  return typeof valor === "string" ? normalizeEmail(valor) : valor;
}

/**
 * Celular ou telefone: remove os separadores e guarda só os dígitos,
 * precedidos de `+` quando ele foi informado.
 */
export function normalizarTelefone(valor: unknown): unknown {
  if (typeof valor !== "string") {
    return valor;
  }
  const aparado = valor.trim();
  if (!TELEFONE_ENTRADA.test(aparado)) {
    return valor;
  }
  const digitos = aparado.replace(/[^0-9]/g, "");
  return aparado.startsWith("+") ? `+${digitos}` : digitos;
}
