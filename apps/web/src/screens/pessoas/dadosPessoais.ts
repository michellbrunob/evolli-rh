import type {
  EnderecoApi,
  PerfilPessoalApi,
} from "../../api/dadosPessoaisClient";
import { exibirCep } from "../../format/mascaras";

/**
 * Dados pessoais e endereço do colaborador (T177, Módulo 1) — campos, limites,
 * normalização e validação no cliente.
 *
 * Espelha `normalizacao-dados-pessoais.util.ts` e `dados-pessoais.dto.ts` da
 * API: o servidor é a regra e o banco a rede de segurança; aqui a validação só
 * antecipa a recusa, com a mensagem no campo certo.
 *
 * OBRIGATÓRIO: data de nascimento. OPCIONAIS: todos os demais campos do perfil
 * e todos os do endereço, em texto: não há catálogo canônico no sistema para
 * saudação, estado civil, escolaridade, país, UF ou município, e a tela não
 * inventa lista de opções.
 *
 * T179 — a exceção é o SEXO: lista FECHADA decidida pela proprietária em
 * 2026-10-21 (`OPCOES_SEXO`), opcional, sem texto livre. Vai o código; a tela
 * mostra o rótulo.
 */

export type ChavePerfil =
  | "dataNascimento"
  | "sexo"
  | "saudacao"
  | "estadoCivil"
  | "nacionalidade"
  | "naturalidade"
  | "escolaridade"
  | "curso"
  | "nomePai"
  | "nomeMae";

export type ChaveEndereco =
  | "pais"
  | "cep"
  | "logradouro"
  | "numero"
  | "complemento"
  | "bairro"
  | "cidade"
  | "estado";

export type ValoresPerfil = Record<ChavePerfil, string>;
export type ValoresEndereco = Record<ChaveEndereco, string>;

export interface DefinicaoCampo<K extends string> {
  readonly chave: K;
  readonly rotulo: string;
  /** Limite de caracteres, o mesmo do servidor. Ausente na data. */
  readonly limite?: number;
  readonly ajuda?: string;
}

/**
 * T179 — opções FECHADAS de sexo (decisão da proprietária de 2026-10-21), na
 * ordem do seletor. O código é o que vai ao servidor e fica gravado; o rótulo
 * é só da tela. Sem seleção, o campo vai `null` — "não informado".
 */
export const OPCOES_SEXO = [
  { codigo: "feminino", rotulo: "Feminino" },
  { codigo: "masculino", rotulo: "Masculino" },
  { codigo: "intersexo", rotulo: "Intersexo" },
  { codigo: "nao_informar", rotulo: "Não informar" },
] as const;

export type CodigoSexo = (typeof OPCOES_SEXO)[number]["codigo"];

/** O valor é um dos códigos da lista fechada? */
export function ehCodigoSexo(valor: string): valor is CodigoSexo {
  return OPCOES_SEXO.some((o) => o.codigo === valor);
}

/**
 * T179 — sexo gravado, como a tela o mostra: código conhecido pelo rótulo;
 * texto livre de um cadastro anterior à lista, como veio (sem inferir); e
 * ausente como `null`, para quem chama escrever "Não informado".
 */
export function rotuloDoSexo(valor: string | null | undefined): string | null {
  if (typeof valor !== "string" || valor.trim() === "") return null;
  return OPCOES_SEXO.find((o) => o.codigo === valor)?.rotulo ?? valor;
}

/** T179 — o sexo é seletor, não texto: definição à parte, na ordem da tela. */
export const CAMPO_SEXO: DefinicaoCampo<"sexo"> = {
  chave: "sexo",
  rotulo: "Sexo",
};

/**
 * Campos de texto do perfil, na ordem da tela — todos OPCIONAIS. A data de
 * nascimento, obrigatória, é tratada à parte; o sexo (T179), também, porque
 * é seletor de lista fechada (`CAMPO_SEXO`).
 */
export const CAMPOS_TEXTO_PERFIL: readonly DefinicaoCampo<
  Exclude<ChavePerfil, "dataNascimento" | "sexo">
>[] = [
  {
    chave: "saudacao",
    rotulo: "Saudação",
    limite: 40,
    ajuda: "Por exemplo, Sr. ou Sra.",
  },
  { chave: "estadoCivil", rotulo: "Estado civil", limite: 60 },
  { chave: "nacionalidade", rotulo: "Nacionalidade", limite: 80 },
  {
    chave: "naturalidade",
    rotulo: "Naturalidade",
    limite: 120,
    ajuda: "Cidade e estado de nascimento.",
  },
  { chave: "escolaridade", rotulo: "Escolaridade", limite: 80 },
  { chave: "curso", rotulo: "Curso", limite: 160 },
  { chave: "nomePai", rotulo: "Nome do pai", limite: 160 },
  { chave: "nomeMae", rotulo: "Nome da mãe", limite: 160 },
];

/** Campos do endereço, na ordem da tela — todos OPCIONAIS. */
export const CAMPOS_ENDERECO: readonly DefinicaoCampo<ChaveEndereco>[] = [
  { chave: "pais", rotulo: "País", limite: 80 },
  {
    chave: "cep",
    rotulo: "CEP",
    limite: 12,
    ajuda: "Letras, números, espaço e hífen, de 3 a 12 caracteres.",
  },
  { chave: "logradouro", rotulo: "Logradouro", limite: 200 },
  { chave: "numero", rotulo: "Número", limite: 20 },
  { chave: "complemento", rotulo: "Complemento", limite: 120 },
  { chave: "bairro", rotulo: "Bairro", limite: 120 },
  { chave: "cidade", rotulo: "Cidade", limite: 120 },
  { chave: "estado", rotulo: "Estado", limite: 80 },
];

export const ROTULO_DATA_NASCIMENTO = "Data de nascimento";

/** País sugerido no início da admissão. Editável: é só o valor inicial. */
export const PAIS_SUGERIDO = "Brasil";

export const PERFIL_VAZIO: ValoresPerfil = {
  dataNascimento: "",
  sexo: "",
  saudacao: "",
  estadoCivil: "",
  nacionalidade: "",
  naturalidade: "",
  escolaridade: "",
  curso: "",
  nomePai: "",
  nomeMae: "",
};

export const ENDERECO_INICIAL: ValoresEndereco = {
  pais: PAIS_SUGERIDO,
  cep: "",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  estado: "",
};

const DATA_MINIMA = "1900-01-01";
// eslint-disable-next-line no-control-regex
const SEM_CONTROLE = /^[^\u0000-\u001F\u007F]*$/;
const CEP_FORMA = /^[A-Za-z0-9 -]{3,12}$/;
/** T179 — CEP brasileiro: 8 dígitos, com ou sem o hífen da máscara. */
const CEP_BRASILEIRO_ENTRADA = /^[0-9]{5}-?[0-9]{3}$/;

/**
 * T179 — o país é o Brasil? Sem diferenciar caixa e acento, e sem os espaços
 * das pontas: a MESMA comparação de `ehPaisBrasil` no servidor. Não há
 * catálogo de país (`DP-ADM-12`), só o nome.
 */
export function ehPaisBrasil(pais: string | null | undefined): boolean {
  return (
    typeof pais === "string" &&
    pais.normalize("NFD").replace(/\p{M}/gu, "").trim().toLowerCase() ===
      "brasil"
  );
}

/** Apara e colapsa espaços repetidos — a mesma normalização do servidor. */
export function normalizarTexto(valor: string): string {
  return valor.trim().replace(/ {2,}/g, " ");
}

function hojeUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function erroDeTexto(
  valor: string,
  rotulo: string,
  limite: number,
): string | undefined {
  const limpo = normalizarTexto(valor);
  if (limpo === "") return undefined;
  if (!SEM_CONTROLE.test(limpo)) {
    return `${rotulo} não pode conter quebra de linha nem caractere de controle.`;
  }
  if (limpo.length > limite) {
    return `${rotulo} deve ter no máximo ${limite} caracteres.`;
  }
  return undefined;
}

export type ErrosPerfil = Partial<Record<ChavePerfil, string>>;
export type ErrosEndereco = Partial<Record<ChaveEndereco, string>>;

export function validarPerfil(valores: ValoresPerfil): ErrosPerfil {
  const erros: ErrosPerfil = {};
  const data = valores.dataNascimento;
  if (data === "") {
    erros.dataNascimento = "Informe a data de nascimento.";
  } else {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || Number.isNaN(Date.parse(data))) {
      erros.dataNascimento = "Informe uma data de nascimento válida.";
    } else if (data < DATA_MINIMA) {
      erros.dataNascimento =
        "A data de nascimento não pode ser anterior a 01/01/1900.";
    } else if (data > hojeUtc()) {
      erros.dataNascimento = "A data de nascimento não pode estar no futuro.";
    }
  }
  // T179 — sexo só da lista fechada; sem seleção é válido (opcional).
  if (valores.sexo !== "" && !ehCodigoSexo(valores.sexo)) {
    erros.sexo = "Selecione uma das opções de sexo, ou deixe sem seleção.";
  }
  for (const campo of CAMPOS_TEXTO_PERFIL) {
    const erro = erroDeTexto(
      valores[campo.chave],
      campo.rotulo,
      campo.limite ?? 0,
    );
    if (erro) erros[campo.chave] = erro;
  }
  return erros;
}

export function validarEndereco(valores: ValoresEndereco): ErrosEndereco {
  const erros: ErrosEndereco = {};
  for (const campo of CAMPOS_ENDERECO) {
    const erro = erroDeTexto(
      valores[campo.chave],
      campo.rotulo,
      campo.limite ?? 0,
    );
    if (erro) erros[campo.chave] = erro;
  }
  const cep = normalizarTexto(valores.cep);
  if (!erros.cep && cep !== "") {
    // T179 — com país Brasil, o servidor exige os 8 dígitos; com outro país,
    // o CEP segue em texto livre, com a forma de antes.
    if (ehPaisBrasil(valores.pais)) {
      if (!CEP_BRASILEIRO_ENTRADA.test(cep)) {
        erros.cep = "Informe os 8 dígitos do CEP, no formato 00000-000.";
      }
    } else if (!CEP_FORMA.test(cep)) {
      erros.cep = "Use letras, números, espaço e hífen, de 3 a 12 caracteres.";
    }
  }
  return erros;
}

/**
 * Corpo do bloco: texto normalizado, vazio como `null`. A data de nascimento
 * vai como digitada — só se monta o bloco depois de `validarPerfil` aceitá-la.
 */
export function blocoPerfil(valores: ValoresPerfil): Record<
  Exclude<ChavePerfil, "dataNascimento">,
  string | null
> & {
  dataNascimento: string;
} {
  const bloco = {} as Record<ChavePerfil, string | null>;
  for (const chave of Object.keys(valores) as ChavePerfil[]) {
    const limpo = normalizarTexto(valores[chave]);
    bloco[chave] = limpo === "" ? null : limpo;
  }
  return { ...bloco, dataNascimento: valores.dataNascimento };
}

export function blocoEndereco(
  valores: ValoresEndereco,
): Record<ChaveEndereco, string | null> {
  const bloco = {} as Record<ChaveEndereco, string | null>;
  for (const chave of Object.keys(valores) as ChaveEndereco[]) {
    const limpo = normalizarTexto(valores[chave]);
    bloco[chave] = limpo === "" ? null : limpo;
  }
  // T179 — CEP brasileiro vai só com os 8 dígitos, a forma que o servidor
  // grava; a máscara `00000-000` é só da tela.
  if (
    bloco.cep !== null &&
    ehPaisBrasil(bloco.pais) &&
    CEP_BRASILEIRO_ENTRADA.test(bloco.cep)
  ) {
    bloco.cep = bloco.cep.replace("-", "");
  }
  return bloco;
}

// ---- T181 — edição na ficha do colaborador ---------------------------------

/**
 * T181 — o perfil gravado, como a ficha o edita: `null` vira campo vazio. Sexo
 * gravado fora da lista fechada (cadastro anterior à T179) não cabe no
 * seletor: o campo começa sem seleção e o valor volta em `sexoAnterior`, para
 * a ficha dizer o que estava gravado — o servidor só aceita a lista.
 */
export function perfilParaEdicao(perfil: PerfilPessoalApi | null): {
  readonly valores: ValoresPerfil;
  readonly sexoAnterior: string | null;
} {
  if (!perfil) return { valores: PERFIL_VAZIO, sexoAnterior: null };
  const valores = { ...PERFIL_VAZIO };
  for (const chave of Object.keys(PERFIL_VAZIO) as ChavePerfil[]) {
    valores[chave] = perfil[chave] ?? "";
  }
  const sexo = perfil.sexo ?? "";
  const legado = sexo !== "" && !ehCodigoSexo(sexo);
  return {
    valores: { ...valores, sexo: legado ? "" : sexo },
    sexoAnterior: legado ? sexo : null,
  };
}

/**
 * T181 — o endereço gravado, como a ficha o edita: `null` vira campo vazio e
 * o CEP brasileiro aparece na máscara `00000-000`. Sem endereço gravado, o
 * formulário começa como o da admissão, com o país sugerido.
 */
export function enderecoParaEdicao(
  endereco: EnderecoApi | null,
): ValoresEndereco {
  if (!endereco) return ENDERECO_INICIAL;
  const valores = { ...ENDERECO_INICIAL };
  for (const chave of Object.keys(ENDERECO_INICIAL) as ChaveEndereco[]) {
    valores[chave] = endereco[chave] ?? "";
  }
  valores.cep = exibirCep(endereco.cep, ehPaisBrasil(endereco.pais));
  return valores;
}

/** T181 — os dois conjuntos de valores são iguais, campo a campo. */
export function mesmosValores<K extends string>(
  a: Readonly<Record<K, string>>,
  b: Readonly<Record<K, string>>,
): boolean {
  return (Object.keys(a) as K[]).every((chave) => a[chave] === b[chave]);
}
