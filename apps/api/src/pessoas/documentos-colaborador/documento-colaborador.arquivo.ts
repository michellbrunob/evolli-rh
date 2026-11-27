import { createHash } from "node:crypto";
import type {
  CategoriaDocumentoColaborador,
  FormatoDocumentoColaborador,
} from "@prisma/client";

/**
 * T213 — conferência do arquivo de um documento do colaborador (ADR 0021),
 * ANTES de qualquer gravação:
 *
 * - extensão, tipo declarado e conteúdo real (assinatura) precisam apontar o
 *   mesmo formato — PDF, JPG ou PNG;
 * - estrutura mínima de cada formato (fim do arquivo), para recusar arquivo
 *   cortado ou malformado;
 * - até 10 MB.
 *
 * O nome original do arquivo nunca chega aqui: só a extensão.
 */
export const DOCUMENTO_LIMITE_BYTES = 10 * 1024 * 1024;

/** Limites de quantidade (documentos não removidos). */
export const DOCUMENTOS_POR_CATEGORIA = 5;
export const DOCUMENTOS_POR_COLABORADOR = 30;

export const NOME_OUTROS_MAXIMO = 60;

export const CATEGORIAS_DO_DOCUMENTO: readonly CategoriaDocumentoColaborador[] =
  [
    "rg",
    "cpf",
    "comprovante_endereco",
    "carteira_trabalho",
    "certidoes",
    "outros",
  ];

export type MotivoDaRecusaDoDocumento =
  | "documento_arquivo_vazio"
  | "documento_arquivo_grande_demais"
  | "documento_formato_invalido"
  | "documento_arquivo_malformado"
  | "documento_categoria_invalida"
  | "documento_nome_obrigatorio"
  | "documento_nome_invalido"
  | "documento_nome_nao_permitido";

export class DocumentoRecusado extends Error {
  constructor(readonly motivo: MotivoDaRecusaDoDocumento) {
    super(motivo);
    this.name = "DocumentoRecusado";
  }
}

const EXTENSOES: Readonly<Record<string, FormatoDocumentoColaborador>> = {
  pdf: "pdf",
  jpg: "jpg",
  jpeg: "jpg",
  png: "png",
};

const TIPOS: Readonly<Record<string, FormatoDocumentoColaborador>> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
};

export const TIPO_DO_FORMATO: Readonly<
  Record<FormatoDocumentoColaborador, string>
> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  png: "image/png",
};

const ASSINATURA_PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const FIM_PNG = Buffer.from([0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]);

/** O formato pelo CONTEÚDO, ou `null` se não for nenhum dos aceitos. */
export function formatoPeloConteudo(
  bytes: Buffer,
): FormatoDocumentoColaborador | null {
  if (bytes.subarray(0, 5).toString("latin1") === "%PDF-") return "pdf";
  if (
    bytes.length >= 8 &&
    ASSINATURA_PNG.every((byte, i) => bytes[i] === byte)
  ) {
    return "png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    if (bytes[2] === 0xff) return "jpg";
  }
  return null;
}

/** A estrutura mínima do formato está inteira (fim do arquivo presente). */
function estruturaCompleta(
  bytes: Buffer,
  formato: FormatoDocumentoColaborador,
): boolean {
  if (formato === "pdf") {
    // O marcador de fim pode vir seguido de quebra de linha ou espaços.
    const fim = bytes.subarray(Math.max(0, bytes.length - 1024));
    return fim.includes(Buffer.from("%%EOF"));
  }
  if (formato === "png") {
    // O chunk IEND (tipo + CRC fixo) fecha o arquivo.
    return bytes.subarray(bytes.length - 8).equals(FIM_PNG);
  }
  // JPEG: o marcador EOI (FF D9) nos últimos bytes (tolera preenchimento).
  const fim = bytes.subarray(Math.max(0, bytes.length - 32));
  for (let i = fim.length - 2; i >= 0; i -= 1) {
    if (fim[i] === 0xff && fim[i + 1] === 0xd9) return true;
  }
  return false;
}

export interface ArquivoDoDocumento {
  readonly bytes: Buffer;
  readonly extensao: string;
  readonly tipoDeclarado: string;
}

export interface ArquivoConferido {
  readonly formato: FormatoDocumentoColaborador;
  readonly tamanhoBytes: number;
  readonly hashSha256: string;
}

export function conferirArquivoDoDocumento(
  arquivo: ArquivoDoDocumento,
): ArquivoConferido {
  const { bytes } = arquivo;
  if (bytes.length === 0)
    throw new DocumentoRecusado("documento_arquivo_vazio");
  if (bytes.length > DOCUMENTO_LIMITE_BYTES) {
    throw new DocumentoRecusado("documento_arquivo_grande_demais");
  }
  const pelaExtensao =
    EXTENSOES[arquivo.extensao.trim().replace(/^\./, "").toLowerCase()];
  const peloTipo = TIPOS[arquivo.tipoDeclarado.trim().toLowerCase()];
  const peloConteudo = formatoPeloConteudo(bytes);
  if (
    !pelaExtensao ||
    !peloTipo ||
    !peloConteudo ||
    pelaExtensao !== peloTipo ||
    peloTipo !== peloConteudo
  ) {
    throw new DocumentoRecusado("documento_formato_invalido");
  }
  if (!estruturaCompleta(bytes, peloConteudo)) {
    throw new DocumentoRecusado("documento_arquivo_malformado");
  }
  return {
    formato: peloConteudo,
    tamanhoBytes: bytes.length,
    hashSha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

/** Categoria aceita e, só em "outros", o nome curto (sem controle). */
export function conferirCategoriaENome(
  categoriaBruta: string | undefined,
  nomeBruto: string | undefined,
): {
  categoria: CategoriaDocumentoColaborador;
  nomeOutros: string | null;
} {
  const categoria = (
    categoriaBruta ?? ""
  ).trim() as CategoriaDocumentoColaborador;
  if (!CATEGORIAS_DO_DOCUMENTO.includes(categoria)) {
    throw new DocumentoRecusado("documento_categoria_invalida");
  }
  const nome = (nomeBruto ?? "").trim();
  if (categoria !== "outros") {
    if (nome !== "")
      throw new DocumentoRecusado("documento_nome_nao_permitido");
    return { categoria, nomeOutros: null };
  }
  if (nome === "") throw new DocumentoRecusado("documento_nome_obrigatorio");
  if (
    [...nome].length > NOME_OUTROS_MAXIMO ||
    // eslint-disable-next-line no-control-regex
    /[\u0000-\u001f\u007f]/.test(nome)
  ) {
    throw new DocumentoRecusado("documento_nome_invalido");
  }
  return { categoria, nomeOutros: nome };
}

const EXTENSAO_DO_FORMATO: Readonly<
  Record<FormatoDocumentoColaborador, string>
> = { pdf: "pdf", jpg: "jpg", png: "png" };

/**
 * Nome neutro do download: `categoria-AAAA-MM-DD.ext` (data da versão, em
 * UTC). Nunca o nome original nem o nome livre de "outros".
 */
export function nomeDoDownload(
  categoria: CategoriaDocumentoColaborador,
  formato: FormatoDocumentoColaborador,
  data: Date,
): string {
  const dia = data.toISOString().slice(0, 10);
  return `${categoria.replace(/_/g, "-")}-${dia}.${EXTENSAO_DO_FORMATO[formato]}`;
}
