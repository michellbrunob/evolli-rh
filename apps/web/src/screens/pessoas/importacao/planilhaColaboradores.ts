/**
 * T209 (Bloco C) — regras da importação de colaboradores por planilha CSV.
 *
 * Tudo aqui é puro e roda só no navegador (ficha de tratamento, seção 29.2
 * do dossiê): o arquivo nunca sai da aba como arquivo; o que vai ao servidor
 * é uma admissão por linha válida, pelo contrato de sempre
 * (`POST /v1/colaboradores`).
 *
 * - **Cabeçalho fixo** (C-8, C-10): as obrigatórias, mais as opcionais;
 *   qualquer outra coluna recusa o arquivo inteiro, antes de ler as linhas.
 * - **Limites** (C-9): até 200 linhas de dados e 1 MB.
 * - **Conferência por linha:** campo e motivo, **nunca o valor** — nem na
 *   tela, nem no relatório baixável.
 * - **Referências por código** (C-13): só Departamento, Cargo e Unidade
 *   ATIVOS da empresa; código inexistente recusa a linha, nada é criado.
 */
import type {
  AdmitirColaboradorDto,
  TipoVinculo,
} from "../../../api/colaboradoresClient";
import { PERFIL_VAZIO, blocoPerfil } from "../dadosPessoais";

export const COLUNAS_OBRIGATORIAS = [
  "nome",
  "tipo_vinculo",
  "data_admissao",
  "data_nascimento",
  "departamento_codigo",
  "cargo_codigo",
] as const;

export const COLUNAS_OPCIONAIS = ["matricula", "unidade_codigo"] as const;

export type Coluna =
  (typeof COLUNAS_OBRIGATORIAS)[number] | (typeof COLUNAS_OPCIONAIS)[number];

const COLUNAS: readonly Coluna[] = [
  ...COLUNAS_OBRIGATORIAS,
  ...COLUNAS_OPCIONAIS,
];

/** O nome de cada coluna como a pessoa o lê (tela e relatório). */
export const ROTULO_DA_COLUNA: Readonly<Record<Coluna, string>> = {
  nome: "Nome",
  tipo_vinculo: "Tipo de vínculo",
  data_admissao: "Data de admissão",
  data_nascimento: "Data de nascimento",
  departamento_codigo: "Departamento",
  cargo_codigo: "Cargo",
  matricula: "Matrícula",
  unidade_codigo: "Unidade",
};

export const LIMITE_DE_LINHAS = 200;
export const LIMITE_DE_BYTES = 1024 * 1024;

/** Nome da linha de exemplo do modelo: importada sem ser apagada, é recusada. */
export const NOME_DA_LINHA_DE_EXEMPLO = "Exemplo Sintético (apague esta linha)";

const BOM = "﻿";
const FIM_DE_LINHA = "\r\n";
const DATA_MINIMA = "1900-01-01";
/** Mesmo padrão de `MATRICULA_PATTERN` do contrato (`pessoas.dto.ts`). */
const PADRAO_MATRICULA = /^[A-Z0-9_-]{2,32}$/;
// eslint-disable-next-line no-control-regex
const CARACTERE_DE_CONTROLE = /[\u0000-\u001f\u007f]/;

/** Rótulo, na ordem do catálogo controlado (AP-8). */
const TIPOS: ReadonlyArray<readonly [TipoVinculo, string]> = [
  ["clt", "CLT"],
  ["estagio", "Estágio"],
  ["aprendiz", "Aprendiz"],
  ["pj", "PJ"],
  ["temporario", "Temporário"],
  ["outro_controlado", "Outro controlado"],
];

/** Minúsculas, sem acento, espaços e hífens viram sublinhado. */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

const TIPO_POR_TEXTO = new Map<string, TipoVinculo>(
  TIPOS.flatMap(([tipo, rotulo]) => [
    [tipo, tipo],
    [normalizar(rotulo), tipo],
  ]),
);

// ---------------------------------------------------------------- modelo

/** O modelo: BOM, cabeçalho fixo e uma linha de exemplo sintética. */
export function gerarModelo(): string {
  const exemplo = [
    NOME_DA_LINHA_DE_EXEMPLO,
    "clt",
    "01/12/2026",
    "15/05/1990",
    "CODIGO-DO-DEPARTAMENTO",
    "CODIGO-DO-CARGO",
    "",
    "",
  ];
  return (
    BOM +
    [COLUNAS.join(";"), exemplo.join(";")].join(FIM_DE_LINHA) +
    FIM_DE_LINHA
  );
}

// ---------------------------------------------------------------- tamanho

/** Erro de arquivo pelo tamanho, ou `null` se cabe. */
export function verificarTamanho(bytes: number): string | null {
  if (bytes <= 0) return "O arquivo está vazio.";
  if (bytes > LIMITE_DE_BYTES) {
    return "O arquivo passa de 1 MB. Divida a planilha em arquivos menores.";
  }
  return null;
}

// ---------------------------------------------------------------- leitura

export interface LinhaLida {
  /** Número da linha no arquivo (o cabeçalho é a linha 1). */
  readonly numero: number;
  readonly valores: Readonly<Partial<Record<Coluna, string>>>;
  /** A linha trouxe mais valores que as colunas do cabeçalho. */
  readonly sobra: boolean;
}

export type PlanilhaLida =
  | { readonly erro: string }
  | {
      readonly colunas: readonly Coluna[];
      readonly linhas: readonly LinhaLida[];
    };

interface Registro {
  readonly linha: number;
  readonly campos: string[];
}

/**
 * Quebra o texto em registros, respeitando aspas (separador, quebra de linha
 * e `""` dentro delas). `null` se uma aspa nunca fecha.
 */
function registros(texto: string, separador: string): Registro[] | null {
  const saida: Registro[] = [];
  let campos: string[] = [];
  let campo = "";
  let entreAspas = false;
  let linha = 1;
  let inicio = 1;
  for (let i = 0; i < texto.length; i += 1) {
    const c = texto[i]!;
    if (entreAspas) {
      if (c === '"') {
        if (texto[i + 1] === '"') {
          campo += '"';
          i += 1;
        } else {
          entreAspas = false;
        }
      } else {
        if (c === "\n") linha += 1;
        campo += c;
      }
      continue;
    }
    if (c === '"' && campo === "") {
      entreAspas = true;
    } else if (c === separador) {
      campos.push(campo);
      campo = "";
    } else if (c === "\r" || c === "\n") {
      if (c === "\r" && texto[i + 1] === "\n") i += 1;
      campos.push(campo);
      saida.push({ linha: inicio, campos });
      campos = [];
      campo = "";
      linha += 1;
      inicio = linha;
    } else {
      campo += c;
    }
  }
  if (entreAspas) return null;
  if (campo !== "" || campos.length > 0) {
    campos.push(campo);
    saida.push({ linha: inicio, campos });
  }
  return saida;
}

/** `;` ou `,`: o que mais aparece na primeira linha, fora de aspas. */
function detectarSeparador(texto: string): string {
  const primeira = texto.split(/\r?\n/, 1)[0] ?? "";
  const semAspas = primeira.replace(/"[^"]*"/g, "");
  const pontoEVirgula = semAspas.split(";").length;
  const virgula = semAspas.split(",").length;
  return virgula > pontoEVirgula ? "," : ";";
}

export function lerPlanilha(conteudo: string): PlanilhaLida {
  const texto = conteudo.startsWith(BOM) ? conteudo.slice(1) : conteudo;
  if (texto.trim() === "") return { erro: "O arquivo está vazio." };

  const lidos = registros(texto, detectarSeparador(texto));
  if (lidos === null) {
    return { erro: "O arquivo tem aspas sem fechamento e não pôde ser lido." };
  }
  const [cabecalho, ...resto] = lidos;
  const nomes = cabecalho!.campos.map(normalizar);

  const desconhecidas = nomes.filter(
    (nome) => !(COLUNAS as readonly string[]).includes(nome),
  );
  if (desconhecidas.length > 0) {
    return {
      erro: `A planilha tem colunas que não fazem parte do modelo: ${desconhecidas.join(", ")}. Use o modelo, sem colunas a mais.`,
    };
  }
  const repetida = nomes.find((nome, i) => nomes.indexOf(nome) !== i);
  if (repetida !== undefined) {
    return {
      erro: `A coluna ${repetida} aparece mais de uma vez no cabeçalho.`,
    };
  }
  const faltando = COLUNAS_OBRIGATORIAS.filter((c) => !nomes.includes(c));
  if (faltando.length > 0) {
    return {
      erro: `Faltam colunas obrigatórias no cabeçalho: ${faltando.join(", ")}.`,
    };
  }

  const colunas = nomes as Coluna[];
  const linhas: LinhaLida[] = [];
  for (const registro of resto) {
    if (registro.campos.every((campo) => campo.trim() === "")) continue;
    const valores: Partial<Record<Coluna, string>> = {};
    colunas.forEach((coluna, i) => {
      valores[coluna] = registro.campos[i] ?? "";
    });
    const sobra = registro.campos
      .slice(colunas.length)
      .some((campo) => campo.trim() !== "");
    linhas.push({ numero: registro.linha, valores, sobra });
  }
  if (linhas.length === 0) {
    return {
      erro: "A planilha não tem nenhuma linha de dados abaixo do cabeçalho.",
    };
  }
  if (linhas.length > LIMITE_DE_LINHAS) {
    return {
      erro: `A planilha tem mais de ${LIMITE_DE_LINHAS} linhas de dados. Divida em arquivos menores.`,
    };
  }
  return { colunas, linhas };
}

// ---------------------------------------------------------------- conferência

export interface ReferenciaDoCatalogo {
  readonly id: string;
  readonly codigo: string;
}

/** Só os itens ATIVOS da empresa ativa. */
export interface Referencias {
  readonly departamentos: readonly ReferenciaDoCatalogo[];
  readonly cargos: readonly ReferenciaDoCatalogo[];
  readonly unidades: readonly ReferenciaDoCatalogo[];
}

export interface ErroDaLinha {
  readonly campo: string;
  readonly motivo: string;
}

/** O que uma linha válida admite. */
export interface AdmissaoDaLinha {
  readonly nome: string;
  readonly tipo: TipoVinculo;
  readonly dataAdmissao: string;
  readonly dataNascimento: string;
  readonly departamentoId: string;
  readonly cargoId: string;
  readonly unidadeId?: string;
  readonly matricula?: string;
}

export interface LinhaConferida {
  readonly numero: number;
  readonly erros: readonly ErroDaLinha[];
  /** `null` quando há qualquer erro: a linha não é enviada. */
  readonly admissao: AdmissaoDaLinha | null;
}

/** `DD/MM/AAAA` ou `AAAA-MM-DD` de um dia que existe → `AAAA-MM-DD`. */
function dataIso(texto: string): string | null {
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto);
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
  const [ano, mes, dia] = br
    ? [br[3]!, br[2]!, br[1]!]
    : iso
      ? [iso[1]!, iso[2]!, iso[3]!]
      : [];
  if (ano === undefined || mes === undefined || dia === undefined) return null;
  const data = new Date(Date.UTC(Number(ano), Number(mes) - 1, Number(dia)));
  if (
    data.getUTCFullYear() !== Number(ano) ||
    data.getUTCMonth() !== Number(mes) - 1 ||
    data.getUTCDate() !== Number(dia)
  ) {
    return null;
  }
  return `${ano}-${mes}-${dia}`;
}

function porCodigo(
  itens: readonly ReferenciaDoCatalogo[],
): Map<string, string> {
  return new Map(
    itens.map((item) => [item.codigo.trim().toUpperCase(), item.id]),
  );
}

export function conferirPlanilha(
  planilha: Exclude<PlanilhaLida, { erro: string }>,
  referencias: Referencias,
  hoje: string,
): LinhaConferida[] {
  const departamentos = porCodigo(referencias.departamentos);
  const cargos = porCodigo(referencias.cargos);
  const unidades = porCodigo(referencias.unidades);
  const matriculaVistaEm = new Map<string, number>();
  const linhaVistaEm = new Map<string, number>();

  return planilha.linhas.map((lida) => {
    const v = (coluna: Coluna) => (lida.valores[coluna] ?? "").trim();
    const erros: ErroDaLinha[] = [];
    const erro = (coluna: Coluna | "linha", motivo: string) =>
      erros.push({
        campo: coluna === "linha" ? "Linha" : ROTULO_DA_COLUNA[coluna],
        motivo,
      });

    // Nome
    const nome = v("nome");
    if (nome === "") erro("nome", "obrigatório");
    else if (CARACTERE_DE_CONTROLE.test(nome))
      erro("nome", "tem caracteres não permitidos");
    else if (nome.length < 2 || nome.length > 160)
      erro("nome", "deve ter entre 2 e 160 caracteres");
    else if (nome === NOME_DA_LINHA_DE_EXEMPLO)
      erro(
        "nome",
        "é a linha de exemplo do modelo; apague-a antes de importar",
      );

    // Tipo de vínculo
    const textoTipo = v("tipo_vinculo");
    const tipo = TIPO_POR_TEXTO.get(normalizar(textoTipo));
    if (textoTipo === "") erro("tipo_vinculo", "obrigatório");
    else if (tipo === undefined)
      erro(
        "tipo_vinculo",
        `não é um dos tipos aceitos (${TIPOS.map(([, r]) => r).join(", ")})`,
      );

    // Datas
    const conferirData = (
      coluna: "data_admissao" | "data_nascimento",
    ): string | null => {
      const texto = v(coluna);
      if (texto === "") {
        erro(coluna, "obrigatória");
        return null;
      }
      const data = dataIso(texto);
      if (data === null) {
        erro(coluna, "não é uma data válida (use DD/MM/AAAA)");
        return null;
      }
      if (data < DATA_MINIMA) {
        erro(coluna, "não pode ser anterior a 01/01/1900");
        return null;
      }
      if (coluna === "data_nascimento" && data > hoje) {
        erro(coluna, "não pode estar no futuro");
        return null;
      }
      return data;
    };
    const dataAdmissao = conferirData("data_admissao");
    const dataNascimento = conferirData("data_nascimento");

    // Referências por código
    const conferirReferencia = (
      coluna: "departamento_codigo" | "cargo_codigo" | "unidade_codigo",
      mapa: Map<string, string>,
      obrigatoria: boolean,
      inexistente: string,
    ): string | undefined => {
      const codigo = v(coluna).toUpperCase();
      if (codigo === "") {
        if (obrigatoria) erro(coluna, "obrigatório");
        return undefined;
      }
      const id = mapa.get(codigo);
      if (id === undefined) erro(coluna, inexistente);
      return id;
    };
    const departamentoId = conferirReferencia(
      "departamento_codigo",
      departamentos,
      true,
      "não há departamento ativo com esse código na empresa",
    );
    const cargoId = conferirReferencia(
      "cargo_codigo",
      cargos,
      true,
      "não há cargo ativo com esse código na empresa",
    );
    const unidadeId = conferirReferencia(
      "unidade_codigo",
      unidades,
      false,
      "não há unidade ativa com esse código na empresa",
    );

    // Matrícula (opcional; única no arquivo)
    const matricula = v("matricula").toUpperCase();
    if (matricula !== "") {
      if (!PADRAO_MATRICULA.test(matricula)) {
        erro("matricula", "use de 2 a 32 letras, números, hífen ou sublinhado");
      } else {
        const primeira = matriculaVistaEm.get(matricula);
        if (primeira !== undefined)
          erro("matricula", `repetida no arquivo (linha ${primeira})`);
        else matriculaVistaEm.set(matricula, lida.numero);
      }
    }

    if (lida.sobra)
      erro("linha", "tem mais valores que as colunas do cabeçalho");

    // A mesma pessoa duas vezes no arquivo seria admitida duas vezes.
    const chave = [
      normalizar(nome),
      tipo ?? normalizar(textoTipo),
      dataAdmissao ?? v("data_admissao"),
      dataNascimento ?? v("data_nascimento"),
      v("departamento_codigo").toUpperCase(),
      v("cargo_codigo").toUpperCase(),
      matricula,
      v("unidade_codigo").toUpperCase(),
    ].join("\u0000");
    const original = linhaVistaEm.get(chave);
    if (original !== undefined) erro("linha", `repete a linha ${original}`);
    else linhaVistaEm.set(chave, lida.numero);

    if (
      erros.length > 0 ||
      tipo === undefined ||
      dataAdmissao === null ||
      dataNascimento === null ||
      departamentoId === undefined ||
      cargoId === undefined
    ) {
      return { numero: lida.numero, erros, admissao: null };
    }
    return {
      numero: lida.numero,
      erros,
      admissao: {
        nome,
        tipo,
        dataAdmissao,
        dataNascimento,
        departamentoId,
        cargoId,
        ...(unidadeId ? { unidadeId } : {}),
        ...(matricula ? { matricula } : {}),
      },
    };
  });
}

// ---------------------------------------------------------------- envio

/**
 * O corpo da admissão: o mesmo contrato do cadastro individual (T179), com
 * o motivo de admissão inicial e, no perfil, só a data de nascimento (os
 * demais campos vão vazios, como `null`, igual ao cadastro individual sem
 * eles). Opcional vazio fica fora do corpo; endereço e contatos nunca vão.
 */
export function montarAdmissao(
  linha: AdmissaoDaLinha,
  empresaId: string,
): AdmitirColaboradorDto {
  return {
    nome: linha.nome,
    empresaId,
    tipo: linha.tipo,
    dataAdmissao: linha.dataAdmissao,
    motivoCodigo: "admissao_inicial",
    departamentoId: linha.departamentoId,
    cargoId: linha.cargoId,
    ...(linha.matricula ? { matricula: linha.matricula } : {}),
    ...(linha.unidadeId ? { unidadeOrganizacionalId: linha.unidadeId } : {}),
    perfilPessoal: blocoPerfil({
      ...PERFIL_VAZIO,
      dataNascimento: linha.dataNascimento,
    }),
  };
}

// ---------------------------------------------------------------- relatório

export interface ItemDoRelatorio {
  readonly numero: number;
  readonly campo: string;
  readonly motivo: string;
}

function celula(texto: string): string {
  return /[;"\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

/** CSV de erros: linha, campo e motivo — nenhum valor da planilha. */
export function relatorioDeErros(itens: readonly ItemDoRelatorio[]): string {
  return (
    BOM +
    [
      "linha;campo;motivo",
      ...itens.map((item) =>
        [String(item.numero), item.campo, item.motivo].map(celula).join(";"),
      ),
    ].join(FIM_DE_LINHA) +
    FIM_DE_LINHA
  );
}
