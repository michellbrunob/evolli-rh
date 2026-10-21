/**
 * T169 — regra de formato dos contatos do colaborador, no cliente.
 *
 * Espelha a regra do servidor (ficha de tratamento, §3) só para dizer, campo a
 * campo, o que corrigir antes de enviar: o servidor responde com mensagem fixa
 * por status, sem apontar o campo. **Quem decide é o servidor** — ele valida e
 * normaliza de novo, qualquer que seja o cliente.
 *
 * T179 — telefone SÓ BRASILEIRO (decisão da proprietária de 2026-10-21): o
 * servidor grava `+55` + DDD + número, com DDD de dois dígitos de 1 a 9,
 * celular de 9 dígitos começando por 9 e fixo de 8 começando de 2 a 5. A tela
 * mostra e edita na máscara `(00) 00000-0000` / `(00) 0000-0000`
 * (`format/mascaras.ts`); aqui o valor, mascarado ou colado, vira a forma do
 * servidor.
 *
 * T179 — os três contatos passaram a ser OPCIONAIS (decisão da proprietária
 * de 2026-10-21): vazio é "não informado", e o formato só é conferido quando
 * o campo está preenchido.
 */
import {
  digitosNacionaisDoTelefone,
  exibirTelefone,
} from "../../format/mascaras";

export interface ValoresContatos {
  emailPessoal: string;
  celular: string;
  telefone: string;
}

export type CampoContato = keyof ValoresContatos;

export type ErrosContatos = Partial<Record<CampoContato | "geral", string>>;

export const LIMITE_EMAIL_PESSOAL = 254;

const EMAIL_FORMA = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const TELEFONE_ENTRADA = /^\+?[0-9 ().-]+$/;
/** O mesmo `TELEFONE_NORMALIZADO` do servidor (T179). */
const TELEFONE_NORMALIZADO = /^\+55[1-9]{2}(?:9[0-9]{8}|[2-5][0-9]{7})$/;

export function normalizarEmailPessoal(valor: string): string {
  return valor.trim().toLowerCase();
}

/**
 * `+55` + DDD + número, como o servidor grava. Aceita o número nacional (10
 * ou 11 dígitos, com ou sem máscara) e o internacional brasileiro (`+55` ou
 * `55` + 10 ou 11 dígitos). Fora dessas formas volta aparado, para a
 * validação recusar — normalizar nunca "conserta".
 */
export function normalizarTelefone(valor: string): string {
  const aparado = valor.trim();
  if (!TELEFONE_ENTRADA.test(aparado)) {
    return aparado;
  }
  const digitos = aparado.replace(/[^0-9]/g, "");
  if (aparado.startsWith("+") && !digitos.startsWith("55")) {
    return aparado;
  }
  const nacionais = digitosNacionaisDoTelefone(aparado);
  const sobra = digitos.length - nacionais.length;
  // Só 10 ou 11 dígitos nacionais, e nada além do `55` do país.
  const semSobra = sobra === 0 || (sobra === 2 && digitos.startsWith("55"));
  if ((nacionais.length !== 10 && nacionais.length !== 11) || !semSobra) {
    return aparado;
  }
  return `+55${nacionais}`;
}

/**
 * Valores gravados como a tela os edita: telefones na máscara brasileira.
 * T179 — o não informado (`null`) vira campo vazio.
 */
export function contatosParaEdicao(valores: {
  readonly emailPessoal: string | null;
  readonly celular: string | null;
  readonly telefone: string | null;
}): ValoresContatos {
  return {
    emailPessoal: valores.emailPessoal ?? "",
    celular: exibirTelefone(valores.celular),
    telefone: exibirTelefone(valores.telefone),
  };
}

export function normalizarContatos(valores: ValoresContatos): ValoresContatos {
  return {
    emailPessoal: normalizarEmailPessoal(valores.emailPessoal),
    celular: normalizarTelefone(valores.celular),
    telefone: normalizarTelefone(valores.telefone),
  };
}

/**
 * T179 — corpo do bloco `contatos` da ADMISSÃO: só os campos preenchidos,
 * normalizados; `undefined` quando os três estão vazios, para o bloco nem ir.
 */
export function contatosDaAdmissao(
  valores: ValoresContatos,
): Partial<ValoresContatos> | undefined {
  const normalizados = normalizarContatos(valores);
  const bloco: Partial<ValoresContatos> = {};
  for (const campo of Object.keys(normalizados) as CampoContato[]) {
    if (normalizados[campo] !== "") bloco[campo] = normalizados[campo];
  }
  return Object.keys(bloco).length > 0 ? bloco : undefined;
}

/**
 * T179 — corpo do `PUT` da ficha: os três campos sempre, normalizados, e o
 * vazio como `null` — é assim que um contato gravado é apagado.
 */
export function contatosParaRegistro(
  valores: ValoresContatos,
): Record<CampoContato, string | null> {
  const normalizados = normalizarContatos(valores);
  return {
    emailPessoal: normalizados.emailPessoal || null,
    celular: normalizados.celular || null,
    telefone: normalizados.telefone || null,
  };
}

/** T179 — nenhum dos três foi preenchido? */
export function contatosVazios(valores: ValoresContatos): boolean {
  return (Object.keys(valores) as CampoContato[]).every(
    (campo) => valores[campo].trim() === "",
  );
}

function erroDeTelefone(valor: string, rotulo: string): string | undefined {
  const aparado = valor.trim();
  // T179 — opcional: vazio não tem formato a conferir.
  if (aparado === "") {
    return undefined;
  }
  if (!TELEFONE_ENTRADA.test(aparado)) {
    return `${rotulo} aceita só dígitos e, como separadores, espaço, parênteses, hífen e ponto, com + apenas no início.`;
  }
  const normalizado = normalizarTelefone(aparado);
  if (TELEFONE_NORMALIZADO.test(normalizado)) {
    return undefined;
  }
  const digitos = aparado.replace(/[^0-9]/g, "");
  if (aparado.startsWith("+") && !digitos.startsWith("55")) {
    return `${rotulo} aceita só número brasileiro (+55).`;
  }
  const comPais =
    aparado.startsWith("+") ||
    ((digitos.length === 12 || digitos.length === 13) &&
      digitos.startsWith("55"));
  const nacionais = comPais ? digitos.slice(2) : digitos;
  if (nacionais.length !== 10 && nacionais.length !== 11) {
    return `${rotulo} precisa do DDD e do número: 10 dígitos para fixo ou 11 para celular.`;
  }
  return `${rotulo} não é um número brasileiro válido: confira o DDD; celular tem 9 dígitos começando por 9, e fixo tem 8 começando de 2 a 5.`;
}

/**
 * Erros por campo; vazio quando os três estão válidos. T179 — campo vazio é
 * válido: só o preenchido tem o formato conferido.
 */
export function validarContatos(valores: ValoresContatos): ErrosContatos {
  const erros: ErrosContatos = {};
  const email = normalizarEmailPessoal(valores.emailPessoal);
  if (email === "") {
    // Opcional: nada a conferir.
  } else if (email.length > LIMITE_EMAIL_PESSOAL) {
    erros.emailPessoal = `E-mail pessoal deve ter no máximo ${LIMITE_EMAIL_PESSOAL} caracteres.`;
  } else if (!EMAIL_FORMA.test(email)) {
    erros.emailPessoal = "Informe um e-mail válido, como nome@exemplo.com.";
  }
  const celular = erroDeTelefone(valores.celular, "Celular");
  if (celular) {
    erros.celular = celular;
  }
  const telefone = erroDeTelefone(valores.telefone, "Telefone");
  if (telefone) {
    erros.telefone = telefone;
  }
  return erros;
}
