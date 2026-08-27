/**
 * Construtores de AFD **exclusivamente sintético** para os testes do parser.
 *
 * Todos os valores aqui são **fictícios e inventados** para exercitar o leiaute
 * (contrato T040) — jamais extraídos de arquivo real, do Secullum ou de um
 * equipamento (contrato §9; T039). CPF, datas e contagens são sintéticos.
 *
 * TypeScript puro — sem I/O, sem persistência.
 */

import { COMPRIMENTO, VERSAO_AFD_SUPORTADA } from "./afd-layout";

/** Data/hora DH sintética e válida (fuso -0300), 24 posições. */
export const DH_SINTETICA_VALIDA = "2026-01-15T08:00:00-0300";

/** Identificador (CPF) sintético e claramente fictício — 12 posições. */
export const CPF_SINTETICO = "123456789012";

/** Segundo identificador sintético distinto, para o teste de não vazamento. */
export const CPF_SINTETICO_ALT = "987654321098";

function padZeros(valor: number, tamanho: number): string {
  return valor.toString().padStart(tamanho, "0");
}

function escrever(buffer: string[], inicio: number, valor: string): void {
  for (let k = 0; k < valor.length; k += 1) {
    buffer[inicio + k] = valor[k] ?? " ";
  }
}

/** Cabeçalho (tipo 1) sintético de 302 posições. Só os campos lidos importam. */
export function montarCabecalho(opts: { versao?: string } = {}): string {
  const versao = opts.versao ?? VERSAO_AFD_SUPORTADA;
  const buffer = new Array<string>(COMPRIMENTO.cabecalho).fill(" ");
  escrever(buffer, 0, "000000000"); // sentinela (001-009)
  escrever(buffer, 9, "1"); // tipo (010)
  escrever(buffer, 250, versao); // versão do leiaute (251-253)
  escrever(buffer, 298, "0000"); // CRC-16 (299-302) — não verificado (pendente)
  return buffer.join("");
}

/** Marcação REP-C (tipo 3). Padrões sintéticos válidos; sobrescreva p/ inválidos. */
export function montarMarcacao(opts: {
  nsr: number;
  dataHora?: string;
  cpf?: string;
  crc?: string;
}): string {
  const nsr = padZeros(opts.nsr, 9);
  const dataHora = opts.dataHora ?? DH_SINTETICA_VALIDA;
  const cpf = opts.cpf ?? CPF_SINTETICO;
  const crc = opts.crc ?? "0000";
  return `${nsr}3${dataHora}${cpf}${crc}`;
}

/** Registro genérico reconhecido (tipos 2/4/5/6/7) — sintético, sem batida. */
export function montarRegistroGenerico(opts: {
  nsr: number;
  tipo: "2" | "4" | "5" | "6" | "7";
  corpo?: string;
}): string {
  const nsr = padZeros(opts.nsr, 9);
  const corpo = opts.corpo ?? "000000000000000";
  return `${nsr}${opts.tipo}${corpo}`;
}

/** Trailer (tipo 9) de 64 posições, com as contagens declaradas. */
export function montarTrailer(
  opts: {
    tipo2?: number;
    tipo3?: number;
    tipo4?: number;
    tipo5?: number;
    tipo6?: number;
    tipo7?: number;
  } = {},
): string {
  const contagens = [
    padZeros(opts.tipo2 ?? 0, 9),
    padZeros(opts.tipo3 ?? 0, 9),
    padZeros(opts.tipo4 ?? 0, 9),
    padZeros(opts.tipo5 ?? 0, 9),
    padZeros(opts.tipo6 ?? 0, 9),
    padZeros(opts.tipo7 ?? 0, 9),
  ].join("");
  return `999999999${contagens}9`;
}

/** Junta linhas com CR+LF (inclui o terminador final) e devolve bytes latin1. */
export function montarArquivo(linhas: readonly string[]): Buffer {
  const texto = linhas.map((linha) => `${linha}\r\n`).join("");
  return Buffer.from(texto, "latin1");
}

/**
 * Arquivo sintético **válido** com `quantidade` marcações tipo 3 em NSR
 * crescente, cabeçalho e trailer coerentes.
 */
export function montarArquivoValido(quantidade: number): Buffer {
  const marcacoes: string[] = [];
  for (let i = 0; i < quantidade; i += 1) {
    marcacoes.push(montarMarcacao({ nsr: i + 1 }));
  }
  return montarArquivo([
    montarCabecalho(),
    ...marcacoes,
    montarTrailer({ tipo3: quantidade }),
  ]);
}
