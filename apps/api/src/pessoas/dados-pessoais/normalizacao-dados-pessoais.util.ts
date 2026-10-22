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

/**
 * T179 — CEP brasileiro normalizado: os 8 dígitos (decisão da proprietária de
 * 2026-10-21). A entrada aceita `00000-000` ou `00000000`; a tela mostra
 * `00000-000`. Com outro país, o CEP segue em texto livre (`CEP_FORMA`).
 */
export const CEP_BRASILEIRO = /^[0-9]{8}$/;
const CEP_BRASILEIRO_ENTRADA = /^[0-9]{5}-?[0-9]{3}$/;

/**
 * O país é o Brasil? Comparação sem caixa, sem acento e sem espaço nas pontas
 * — a mesma da tela. Não há catálogo de país (`DP-ADM-12`): só o nome.
 */
export function ehPaisBrasil(pais: unknown): boolean {
  return (
    typeof pais === "string" &&
    pais
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase() === "brasil"
  );
}

/**
 * CEP do endereço: texto pessoal normalizado e, com país Brasil, só os 8
 * dígitos quando a forma é `00000-000` ou `00000000`. Fora dessa forma volta
 * como veio, para a validação recusar — normalizar nunca "conserta".
 */
export function normalizarCep(valor: unknown, pais: unknown): unknown {
  const texto = normalizarTextoPessoal(valor);
  if (
    typeof texto !== "string" ||
    !ehPaisBrasil(normalizarTextoPessoal(pais))
  ) {
    return texto;
  }
  return CEP_BRASILEIRO_ENTRADA.test(texto) ? texto.replace("-", "") : texto;
}

/**
 * T179 — Sexo em opções FECHADAS (decisão da proprietária de 2026-10-21),
 * sem texto livre: o servidor recusa qualquer outro valor. Opcional — sem
 * seleção, o campo fica `null`, e a ficha mostra "Não informado". "Não
 * informar" é uma escolha explícita, diferente de não ter escolhido. Gênero é
 * outro dado, bloqueado até a sua ficha (`DP-ADM-09`).
 */
export const SEXOS = [
  "feminino",
  "masculino",
  "intersexo",
  "nao_informar",
] as const;
export type Sexo = (typeof SEXOS)[number];

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
