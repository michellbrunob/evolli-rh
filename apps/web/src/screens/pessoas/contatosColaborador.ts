/**
 * T169 — regra de formato dos contatos do colaborador, no cliente.
 *
 * Espelha a regra do servidor (ficha de tratamento, §3) só para dizer, campo a
 * campo, o que corrigir antes de enviar: o servidor responde com mensagem fixa
 * por status, sem apontar o campo. **Quem decide é o servidor** — ele valida e
 * normaliza de novo, qualquer que seja o cliente.
 *
 * Nenhum país é presumido: sem DDD, DDI ou máscara nacional.
 */

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
const TELEFONE_NORMALIZADO = /^\+?[0-9]{8,15}$/;

export function normalizarEmailPessoal(valor: string): string {
  return valor.trim().toLowerCase();
}

/** Só dígitos, precedidos de `+` quando informado; inválido volta aparado. */
export function normalizarTelefone(valor: string): string {
  const aparado = valor.trim();
  if (!TELEFONE_ENTRADA.test(aparado)) {
    return aparado;
  }
  const digitos = aparado.replace(/[^0-9]/g, "");
  return aparado.startsWith("+") ? `+${digitos}` : digitos;
}

export function normalizarContatos(valores: ValoresContatos): ValoresContatos {
  return {
    emailPessoal: normalizarEmailPessoal(valores.emailPessoal),
    celular: normalizarTelefone(valores.celular),
    telefone: normalizarTelefone(valores.telefone),
  };
}

function erroDeTelefone(valor: string, rotulo: string): string | undefined {
  if (valor.trim() === "") {
    return `${rotulo} é obrigatório.`;
  }
  if (!TELEFONE_ENTRADA.test(valor.trim())) {
    return `${rotulo} aceita só dígitos e, como separadores, espaço, parênteses, hífen e ponto, com + apenas no início.`;
  }
  if (!TELEFONE_NORMALIZADO.test(normalizarTelefone(valor))) {
    return `${rotulo} deve ter de 8 a 15 dígitos.`;
  }
  return undefined;
}

/** Erros por campo; vazio quando os três estão válidos. */
export function validarContatos(valores: ValoresContatos): ErrosContatos {
  const erros: ErrosContatos = {};
  const email = normalizarEmailPessoal(valores.emailPessoal);
  if (email === "") {
    erros.emailPessoal = "E-mail pessoal é obrigatório.";
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
