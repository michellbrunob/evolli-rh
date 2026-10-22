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
 *
 * T179 (revisão final) — telefone LEGADO: o banco ainda guarda números de
 * antes da forma atual (`^\+?[0-9]{8,15}$`). A ficha os mostra exatamente como
 * gravados e, enquanto o campo não é alterado, nem os valida nem os envia: a
 * chave fica FORA do `PUT`, e campo ausente é "manter o gravado" no servidor.
 */
import {
  TELEFONE_ENTRADA,
  TELEFONE_NORMALIZADO,
  digitosNacionaisDoTelefone,
  exibirTelefone,
  telefoneNaFormaAtual,
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

/** T179 — os dois campos de telefone. */
export type CampoTelefone = "celular" | "telefone";

const CAMPOS_TELEFONE: readonly CampoTelefone[] = ["celular", "telefone"];

/**
 * T179 (revisão final) — telefones gravados FORA da forma atual
 * (`TELEFONE_NORMALIZADO`), exatamente como vieram do servidor. Só os
 * presentes aqui são legados; `null` (não informado) nunca é.
 */
export type TelefonesLegados = Partial<Record<CampoTelefone, string>>;

/** T179 (revisão final) — os telefones legados do que foi gravado. */
export function telefonesLegados(
  gravado: {
    readonly celular: string | null;
    readonly telefone: string | null;
  } | null,
): TelefonesLegados {
  const legados: TelefonesLegados = {};
  if (!gravado) return legados;
  for (const campo of CAMPOS_TELEFONE) {
    const bruto = gravado[campo];
    if (bruto !== null && !telefoneNaFormaAtual(bruto)) legados[campo] = bruto;
  }
  return legados;
}

/**
 * T179 (revisão final) — o campo ainda tem o legado intacto: valor IDÊNTICO
 * ao bruto carregado (a comparação é com o texto exibido, nunca com uma
 * versão mascarada). Intacto, ele não é validado nem enviado.
 */
export function legadoIntacto(
  valores: ValoresContatos,
  legados: TelefonesLegados,
  campo: CampoTelefone,
): boolean {
  const bruto = legados[campo];
  return bruto !== undefined && valores[campo] === bruto;
}

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
  // T179 (revisão final) — os dígitos nacionais vêm inteiros, sem corte: só
  // 10 ou 11 servem.
  const nacionais = digitosNacionaisDoTelefone(aparado);
  if (nacionais.length !== 10 && nacionais.length !== 11) {
    return aparado;
  }
  return `+55${nacionais}`;
}

/**
 * Valores gravados como a tela os edita: telefones na máscara brasileira.
 * T179 — o não informado (`null`) vira campo vazio; o legado, o texto
 * gravado, sem máscara (`exibirTelefone`).
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
 * T179 — corpo do `PUT` da ficha: os campos normalizados, e o vazio como
 * `null` — é assim que um contato gravado é apagado.
 *
 * T179 (revisão final) — telefone legado INTACTO fica fora do corpo: a chave
 * ausente mantém o gravado no servidor. Alterado, vai como os demais.
 */
export function contatosParaRegistro(
  valores: ValoresContatos,
  legados: TelefonesLegados = {},
): { emailPessoal: string | null } & Partial<
  Record<CampoTelefone, string | null>
> {
  const normalizados = normalizarContatos(valores);
  const corpo: { emailPessoal: string | null } & Partial<
    Record<CampoTelefone, string | null>
  > = { emailPessoal: normalizados.emailPessoal || null };
  for (const campo of CAMPOS_TELEFONE) {
    if (!legadoIntacto(valores, legados, campo)) {
      corpo[campo] = normalizados[campo] || null;
    }
  }
  return corpo;
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
 * válido: só o preenchido tem o formato conferido. T179 (revisão final) — o
 * telefone legado intacto também não é conferido (não será enviado); alterado,
 * só passa um número brasileiro na forma atual.
 */
export function validarContatos(
  valores: ValoresContatos,
  legados: TelefonesLegados = {},
): ErrosContatos {
  const erros: ErrosContatos = {};
  const email = normalizarEmailPessoal(valores.emailPessoal);
  if (email === "") {
    // Opcional: nada a conferir.
  } else if (email.length > LIMITE_EMAIL_PESSOAL) {
    erros.emailPessoal = `E-mail pessoal deve ter no máximo ${LIMITE_EMAIL_PESSOAL} caracteres.`;
  } else if (!EMAIL_FORMA.test(email)) {
    erros.emailPessoal = "Informe um e-mail válido, como nome@exemplo.com.";
  }
  const celular = legadoIntacto(valores, legados, "celular")
    ? undefined
    : erroDeTelefone(valores.celular, "Celular");
  if (celular) {
    erros.celular = celular;
  }
  const telefone = legadoIntacto(valores, legados, "telefone")
    ? undefined
    : erroDeTelefone(valores.telefone, "Telefone");
  if (telefone) {
    erros.telefone = telefone;
  }
  return erros;
}
