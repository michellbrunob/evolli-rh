import { CampoDadosPessoais } from "@prisma/client";

/**
 * Normalização e limites dos dados pessoais e do endereço (T177, Módulo 1).
 *
 * As funções recebem `unknown` porque rodam como `@Transform`, ANTES da
 * validação: o que não é texto volta intacto, e a validação o recusa —
 * normalizar nunca "conserta" entrada inválida.
 *
 * Os limites são os mesmos dos CHECKs da migration
 * `20261020120000_dados_pessoais_endereco_colaborador`: o banco é a rede de
 * segurança, o servidor é a regra.
 */

/** Sem caractere de controle (inclui quebra de linha e tabulação). */
// eslint-disable-next-line no-control-regex
export const SEM_CONTROLE = /^[^\u0000-\u001F\u007F]*$/;

/** CEP ou código postal: letras, dígitos, espaço e hífen, de 3 a 12. */
export const CEP_FORMA = /^[A-Za-z0-9 -]{3,12}$/;

/** Borda inferior da data de nascimento, igual ao CHECK do banco. */
export const DATA_NASCIMENTO_MINIMA = "1900-01-01";

export const LIMITES_PERFIL = {
  sexo: 60,
  saudacao: 40,
  estadoCivil: 60,
  nacionalidade: 80,
  naturalidade: 120,
  escolaridade: 80,
  curso: 160,
  nomePai: 160,
  nomeMae: 160,
} as const;

export const LIMITES_ENDERECO = {
  pais: 80,
  cep: 12,
  logradouro: 200,
  numero: 20,
  complemento: 120,
  bairro: 120,
  cidade: 120,
  estado: 80,
} as const;

/**
 * Texto pessoal: apara as pontas e colapsa espaços internos repetidos; vazio
 * vira `null`. Só espaço comum é colapsado — caractere de controle fica, para
 * a validação recusar.
 */
export function normalizarTextoPessoal(valor: unknown): unknown {
  if (typeof valor !== "string") return valor;
  const limpo = valor.trim().replace(/ {2,}/g, " ");
  return limpo === "" ? null : limpo;
}

/** Campos do perfil, na ordem da tela, com o nome do campo no evento. */
export const CAMPOS_PERFIL = [
  ["dataNascimento", "data_nascimento"],
  ["sexo", "sexo"],
  ["saudacao", "saudacao"],
  ["estadoCivil", "estado_civil"],
  ["nacionalidade", "nacionalidade"],
  ["naturalidade", "naturalidade"],
  ["escolaridade", "escolaridade"],
  ["curso", "curso"],
  ["nomePai", "nome_pai"],
  ["nomeMae", "nome_mae"],
] as const satisfies readonly (readonly [string, CampoDadosPessoais])[];

/** Campos do endereço, na ordem da tela, com o nome do campo no evento. */
export const CAMPOS_ENDERECO = [
  ["pais", "pais"],
  ["cep", "cep"],
  ["logradouro", "logradouro"],
  ["numero", "numero"],
  ["complemento", "complemento"],
  ["bairro", "bairro"],
  ["cidade", "cidade"],
  ["estado", "estado"],
] as const satisfies readonly (readonly [string, CampoDadosPessoais])[];

export type ChavePerfil = (typeof CAMPOS_PERFIL)[number][0];
export type ChaveEndereco = (typeof CAMPOS_ENDERECO)[number][0];
