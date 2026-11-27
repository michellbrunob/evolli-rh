/**
 * T215 — "Importar valores" de um benefício (como a referência): o modelo
 * `.xlsx` já preenchido com o CPF e os valores atuais de cada pessoa, e a
 * leitura da planilha devolvida (`.xlsx` ou `.csv`). Tudo no navegador; a
 * conferência por CPF é do servidor.
 */
import type {
  ColunaDaImportacao,
  LinhaDaPlanilhaDto,
  PessoaDoBeneficioApi,
  RegrasDoBeneficioApi,
  TipoDeValorBeneficio,
} from "../../api/beneficiosClient";
import {
  type AbaXlsx,
  lerAbasXlsx,
  montarXlsx,
  pareceXlsx,
} from "../pessoas/importacao/planilhaXlsx";
import { nomeDaEscala } from "./textosDosBeneficios";

export const LIMITE_DE_BYTES_DA_PLANILHA = 5 * 1024 * 1024;
export const LIMITE_DE_LINHAS_DA_PLANILHA = 1000;
export const ABA_DE_VALORES = "Valores";

export const ROTULO_DA_COLUNA: Readonly<Record<ColunaDaImportacao, string>> = {
  dias: "Dias no mês",
  valorDia: "Valor por dia",
  valorMes: "Valor do mês",
  coparticipacao: "Coparticipação",
  antecipado: "Valor antecipado",
};

/** As colunas de valor da planilha (as mesmas que o servidor confere). */
export function colunasDaImportacao(
  tipo: TipoDeValorBeneficio,
  r: RegrasDoBeneficioApi,
): ColunaDaImportacao[] {
  switch (tipo) {
    case "dia_util":
      return ["dias", "valorDia"];
    case "fixo":
      return ["valorMes"];
    case "individual":
      return r.individualModo === "livre" ? ["valorMes"] : [];
    case "faixa_etaria":
      return r.coparticipacao ? ["coparticipacao"] : [];
    case "antecipacao":
      return r.antecipacao?.modo === "variavel" ? ["antecipado"] : [];
    default:
      return [];
  }
}

/** "dias no mês e valor por dia", "coparticipação". */
export function oQueAtualiza(colunas: readonly ColunaDaImportacao[]): string {
  const nomes = colunas.map((c) => ROTULO_DA_COLUNA[c].toLowerCase());
  return nomes.length > 1
    ? `${nomes.slice(0, -1).join(", ")} e ${nomes.at(-1)}`
    : (nomes[0] ?? "");
}

export function formatarCpf(cpf: string | null): string {
  if (!cpf || !/^\d{11}$/.test(cpf)) return cpf ?? "";
  return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`;
}

const reais = (centavos: number | null) =>
  centavos === null ? "" : Math.round(centavos) / 100;

function valorAtual(
  p: PessoaDoBeneficioApi,
  c: ColunaDaImportacao,
): string | number {
  switch (c) {
    case "dias":
      return p.dias ?? "";
    case "valorDia":
      return reais(p.valorDia);
    case "valorMes":
      return reais(p.valor);
    case "coparticipacao":
      return p.coparticipacao ?? 0;
    case "antecipado":
      return p.antecipado ?? 0;
  }
}

/** O modelo: aba Valores (com as pessoas e os valores de hoje) e Instruções. */
export function modeloDeValores(
  colunas: readonly ColunaDaImportacao[],
  pessoas: readonly PessoaDoBeneficioApi[],
  mes: string,
): Uint8Array {
  const comEscala = colunas.includes("dias");
  const cabecalho = [
    "CPF",
    "Colaborador",
    ...(comEscala ? ["Escala"] : []),
    ...colunas.map((c) => ROTULO_DA_COLUNA[c]),
  ];
  const abas: AbaXlsx[] = [
    {
      nome: ABA_DE_VALORES,
      cabecalho: true,
      colunasTexto: false,
      larguras: [18, 34, ...(comEscala ? [16] : []), ...colunas.map(() => 18)],
      linhas: [
        cabecalho,
        ...pessoas.map((p) => [
          formatarCpf(p.cpf),
          p.nome,
          ...(comEscala ? [nomeDaEscala(p.escala)] : []),
          ...colunas.map((c) => valorAtual(p, c)),
        ]),
      ],
    },
    {
      nome: "Instruções",
      quebrarTexto: true,
      larguras: [100],
      linhas: [
        [`Valores de ${mes}. Um mês por planilha.`],
        ["Mude só o que precisar. Linhas sem mudança são ignoradas."],
        [
          `Obrigatórios: CPF e ${colunas.length > 1 ? `pelo menos um entre ${oQueAtualiza(colunas)}` : oQueAtualiza(colunas)}.`,
        ],
        ["Valores em reais, com vírgula nos centavos (ex.: 30,00)."],
        ["Não renomeie nem apague o cabeçalho da aba Valores."],
      ],
    },
  ];
  return montarXlsx(abas);
}

/** Sem acento, minúsculas, sem espaços duplos: para casar o cabeçalho. */
function normal(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** CSV com `;` ou `,`, aspas e quebras dentro de aspas. */
export function lerCsv(texto: string): string[][] {
  const limpo = texto.replace(/^\uFEFF/, "");
  const primeira = limpo.split(/\r?\n/, 1)[0] ?? "";
  const sep =
    (primeira.match(/;/g)?.length ?? 0) >= (primeira.match(/,/g)?.length ?? 0)
      ? ";"
      : ",";
  const linhas: string[][] = [];
  let linha: string[] = [];
  let campo = "";
  let aspas = false;
  for (let i = 0; i < limpo.length; i += 1) {
    const ch = limpo[i]!;
    if (aspas) {
      if (ch === '"' && limpo[i + 1] === '"') {
        campo += '"';
        i += 1;
      } else if (ch === '"') aspas = false;
      else campo += ch;
    } else if (ch === '"') aspas = true;
    else if (ch === sep) {
      linha.push(campo);
      campo = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && limpo[i + 1] === "\n") i += 1;
      linha.push(campo);
      linhas.push(linha);
      linha = [];
      campo = "";
    } else campo += ch;
  }
  if (campo !== "" || linha.length > 0) {
    linha.push(campo);
    linhas.push(linha);
  }
  return linhas;
}

export type PlanilhaDeValoresLida =
  | {
      readonly linhas: LinhaDaPlanilhaDto[];
      /** O nome escrito na planilha, por linha (só para a tela). */
      readonly nomes: Readonly<Record<number, string>>;
    }
  | { readonly erro: string };

/** As linhas da planilha (texto de cada célula), para a conferência. */
export function lerLinhasDeValores(
  tabela: readonly (readonly string[])[],
  colunas: readonly ColunaDaImportacao[],
): PlanilhaDeValoresLida {
  const cabecalho = (tabela[0] ?? []).map(normal);
  const iCpf = cabecalho.indexOf("cpf");
  if (iCpf < 0) {
    return {
      erro: "A planilha não tem a coluna CPF. Use o modelo, sem mudar o cabeçalho.",
    };
  }
  const indices = colunas.map((c) => ({
    coluna: c,
    i: cabecalho.indexOf(normal(ROTULO_DA_COLUNA[c])),
  }));
  if (indices.every((x) => x.i < 0)) {
    return {
      erro: `A planilha não tem a coluna ${colunas.map((c) => ROTULO_DA_COLUNA[c]).join(" nem ")}. Use o modelo, sem mudar o cabeçalho.`,
    };
  }
  const iNome = cabecalho.findIndex((c) => c === "colaborador" || c === "nome");
  const linhas: LinhaDaPlanilhaDto[] = [];
  const nomes: Record<number, string> = {};
  tabela.slice(1).forEach((celulas, k) => {
    if (celulas.every((c) => (c ?? "").trim() === "")) return;
    const valores: LinhaDaPlanilhaDto["valores"] = {};
    for (const { coluna, i } of indices) {
      if (i >= 0) valores[coluna] = (celulas[i] ?? "").trim() || null;
    }
    linhas.push({ linha: k + 2, cpf: (celulas[iCpf] ?? "").trim(), valores });
    const nome = iNome >= 0 ? (celulas[iNome] ?? "").trim() : "";
    if (nome) nomes[k + 2] = nome;
  });
  if (linhas.length === 0) {
    return { erro: "A planilha não tem nenhuma linha preenchida." };
  }
  if (linhas.length > LIMITE_DE_LINHAS_DA_PLANILHA) {
    return {
      erro: `A planilha tem mais de ${LIMITE_DE_LINHAS_DA_PLANILHA} linhas. Divida em arquivos menores.`,
    };
  }
  return { linhas, nomes };
}

/** Os bytes do arquivo, lidos só nesta aba (FileReader: vale em todo lugar). */
function lerBytes(arquivo: File): Promise<Uint8Array> {
  return new Promise((resolver, rejeitar) => {
    const leitor = new FileReader();
    leitor.onload = () =>
      resolver(new Uint8Array(leitor.result as ArrayBuffer));
    leitor.onerror = () => rejeitar(leitor.error);
    leitor.readAsArrayBuffer(arquivo);
  });
}

/** Lê o arquivo escolhido (`.xlsx` ou `.csv`, até 5 MB). */
export async function lerArquivoDeValores(
  arquivo: File,
  colunas: readonly ColunaDaImportacao[],
): Promise<PlanilhaDeValoresLida> {
  if (arquivo.size > LIMITE_DE_BYTES_DA_PLANILHA) {
    return { erro: "O arquivo passa de 5 MB. Envie uma planilha menor." };
  }
  if (!/\.(xlsx|csv)$/i.test(arquivo.name)) {
    return { erro: "Envie um arquivo .xlsx ou .csv." };
  }
  const bytes = await lerBytes(arquivo);
  if (pareceXlsx(arquivo.name, bytes)) {
    try {
      const abas = await lerAbasXlsx(bytes);
      const tabela = abas[ABA_DE_VALORES] ?? Object.values(abas)[0] ?? [];
      return lerLinhasDeValores(tabela, colunas);
    } catch {
      return { erro: "Não foi possível ler a planilha. Confira o arquivo." };
    }
  }
  return lerLinhasDeValores(
    lerCsv(new TextDecoder("utf-8").decode(bytes)),
    colunas,
  );
}

/** "beneficio-vr-teste-2026-11" (para o nome dos arquivos). */
export function baseDoArquivo(nome: string, competencia: string): string {
  const base = nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${base || "beneficio"}-${competencia}`;
}

/**
 * Os CPFs de um texto colado (um por linha, separados por vírgula, ponto e
 * vírgula ou tabulação, com ou sem máscara), sem repetir; só os de 11
 * dígitos (9 ou 10: o Excel tirou os zeros da frente).
 */
export function cpfsDoTexto(texto: string): string[] {
  const vistos = new Set<string>();
  for (const pedaco of texto.split(/[\n\r;,\t ]+/)) {
    let d = pedaco.replace(/\D/g, "");
    if (d.length === 9 || d.length === 10) d = d.padStart(11, "0");
    if (d.length === 11) vistos.add(d);
  }
  return [...vistos];
}
