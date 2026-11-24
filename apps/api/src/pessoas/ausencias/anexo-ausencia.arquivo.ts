import { createHash } from "node:crypto";

/**
 * T215 — conferência do arquivo do ANEXO de uma ausência (atestado ou
 * documento), ANTES de qualquer gravação, no padrão da T213 (ADR 0021):
 *
 * - extensão, tipo declarado e conteúdo real (assinatura) precisam apontar o
 *   mesmo formato — os da referência: PDF, JPG, PNG, WEBP, HEIC, HEIF, DOC e
 *   DOCX;
 * - estrutura mínima de cada formato, para recusar arquivo cortado ou
 *   malformado;
 * - documento do Word com macro é recusado (DOCX com `vbaProject.bin`; DOC
 *   com armazenamento de VBA ou de macros);
 * - até 10 MB.
 *
 * O nome original do arquivo nunca chega aqui: só a extensão.
 */
export type FormatoAnexoAusencia =
  "pdf" | "jpg" | "png" | "webp" | "heic" | "heif" | "doc" | "docx";

export const FORMATOS_ANEXO_AUSENCIA: readonly FormatoAnexoAusencia[] = [
  "pdf",
  "jpg",
  "png",
  "webp",
  "heic",
  "heif",
  "doc",
  "docx",
];

export const ANEXO_AUSENCIA_LIMITE_BYTES = 10 * 1024 * 1024;

/** O tipo devolvido no download. */
export const TIPO_DO_FORMATO_ANEXO: Readonly<
  Record<FormatoAnexoAusencia, string>
> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

/** A extensão do arquivo baixado. */
export const EXTENSAO_DO_FORMATO_ANEXO: Readonly<
  Record<FormatoAnexoAusencia, string>
> = {
  pdf: "pdf",
  jpg: "jpg",
  png: "png",
  webp: "webp",
  heic: "heic",
  heif: "heif",
  doc: "doc",
  docx: "docx",
};

export type MotivoDaRecusaDoAnexo =
  | "anexo_arquivo_vazio"
  | "anexo_arquivo_grande_demais"
  | "anexo_formato_invalido"
  | "anexo_arquivo_malformado"
  | "anexo_com_macro";

export class AnexoRecusado extends Error {
  constructor(readonly motivo: MotivoDaRecusaDoAnexo) {
    super(motivo);
    this.name = "AnexoRecusado";
  }
}

const EXTENSOES: Readonly<Record<string, FormatoAnexoAusencia>> = {
  pdf: "pdf",
  jpg: "jpg",
  jpeg: "jpg",
  png: "png",
  webp: "webp",
  heic: "heic",
  heif: "heif",
  doc: "doc",
  docx: "docx",
};

const TIPOS: Readonly<Record<string, FormatoAnexoAusencia>> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
};

/** Navegadores às vezes não informam o tipo de HEIC/HEIF. */
const TIPO_GENERICO = "application/octet-stream";

const ASSINATURA_PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const FIM_PNG = Buffer.from([0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]);
const ASSINATURA_OLE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const ZIP_LOCAL = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const ZIP_FIM_DO_DIRETORIO = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
/** O fim do diretório central tem 22 bytes, mais um comentário opcional. */
const ZIP_JANELA_DO_FIM = 22 + 0xffff;
const DOC_TAMANHO_MINIMO = 512;

const MARCAS_HEIC = new Set(["heic", "heix", "hevc", "hevx", "heim", "heis"]);
const MARCAS_HEIF = new Set(["mif1", "msf1", "heif"]);

function comeca(bytes: Buffer, assinatura: readonly number[]): boolean {
  return (
    bytes.length >= assinatura.length &&
    assinatura.every((byte, i) => bytes[i] === byte)
  );
}

/** As marcas da caixa `ftyp` (principal e compatíveis), ou `null`. */
function marcasDoFtyp(bytes: Buffer): string[] | null {
  if (bytes.length < 16) return null;
  if (bytes.subarray(4, 8).toString("latin1") !== "ftyp") return null;
  const tamanho = bytes.readUInt32BE(0);
  if (tamanho < 16 || tamanho > bytes.length) return null;
  const marcas = [bytes.subarray(8, 12).toString("latin1")];
  for (let i = 16; i + 4 <= tamanho; i += 4) {
    marcas.push(bytes.subarray(i, i + 4).toString("latin1"));
  }
  return marcas;
}

/** O formato pelo CONTEÚDO, ou `null` se não for nenhum dos aceitos. */
export function formatoDoAnexoPeloConteudo(
  bytes: Buffer,
): FormatoAnexoAusencia | null {
  if (bytes.subarray(0, 5).toString("latin1") === "%PDF-") return "pdf";
  if (comeca(bytes, ASSINATURA_PNG)) return "png";
  if (comeca(bytes, [0xff, 0xd8, 0xff])) return "jpg";
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString("latin1") === "RIFF" &&
    bytes.subarray(8, 12).toString("latin1") === "WEBP"
  ) {
    return "webp";
  }
  const marcas = marcasDoFtyp(bytes);
  if (marcas) {
    if (marcas.some((m) => MARCAS_HEIC.has(m))) return "heic";
    if (marcas.some((m) => MARCAS_HEIF.has(m))) return "heif";
    return null;
  }
  if (comeca(bytes, ASSINATURA_OLE)) return "doc";
  if (comeca(bytes, [...ZIP_LOCAL])) return "docx";
  return null;
}

/** A estrutura mínima do formato está inteira. */
function estruturaCompleta(
  bytes: Buffer,
  formato: FormatoAnexoAusencia,
): boolean {
  switch (formato) {
    case "pdf": {
      const fim = bytes.subarray(Math.max(0, bytes.length - 1024));
      return fim.includes(Buffer.from("%%EOF"));
    }
    case "png":
      return (
        bytes.length >= 16 && bytes.subarray(bytes.length - 8).equals(FIM_PNG)
      );
    case "jpg": {
      const fim = bytes.subarray(Math.max(0, bytes.length - 32));
      for (let i = fim.length - 2; i >= 0; i -= 1) {
        if (fim[i] === 0xff && fim[i + 1] === 0xd9) return true;
      }
      return false;
    }
    case "webp": {
      // O tamanho do RIFF conta tudo depois dos 8 bytes iniciais (com o
      // byte de preenchimento, se ímpar).
      const declarado = bytes.readUInt32LE(4) + 8;
      return (
        declarado === bytes.length ||
        (declarado % 2 === 1 && declarado + 1 === bytes.length)
      );
    }
    case "heic":
    case "heif":
      // A caixa `ftyp` já foi lida inteira; depois dela, algum conteúdo.
      return bytes.length > bytes.readUInt32BE(0);
    case "doc":
      return bytes.length >= DOC_TAMANHO_MINIMO;
    case "docx": {
      const fim = bytes.subarray(Math.max(0, bytes.length - ZIP_JANELA_DO_FIM));
      return (
        fim.includes(ZIP_FIM_DO_DIRETORIO) &&
        bytes.includes(Buffer.from("[Content_Types].xml")) &&
        bytes.includes(Buffer.from("word/document.xml"))
      );
    }
  }
}

/** Documento do Word com macro (o antivírus confere o resto). */
function temMacro(bytes: Buffer, formato: FormatoAnexoAusencia): boolean {
  if (formato === "docx") {
    return bytes.includes(Buffer.from("vbaProject.bin"));
  }
  if (formato === "doc") {
    return ["_VBA_PROJECT", "Macros", "VBA"].some((nome) =>
      bytes.includes(Buffer.from(nome, "utf16le")),
    );
  }
  return false;
}

export interface ArquivoDoAnexo {
  readonly bytes: Buffer;
  readonly extensao: string;
  readonly tipoDeclarado: string;
}

export interface AnexoConferido {
  readonly formato: FormatoAnexoAusencia;
  readonly tamanhoBytes: number;
  readonly hashSha256: string;
}

export function conferirArquivoDoAnexo(
  arquivo: ArquivoDoAnexo,
): AnexoConferido {
  const { bytes } = arquivo;
  if (bytes.length === 0) throw new AnexoRecusado("anexo_arquivo_vazio");
  if (bytes.length > ANEXO_AUSENCIA_LIMITE_BYTES) {
    throw new AnexoRecusado("anexo_arquivo_grande_demais");
  }
  const pelaExtensao =
    EXTENSOES[arquivo.extensao.trim().replace(/^\./, "").toLowerCase()];
  const tipo = arquivo.tipoDeclarado.trim().toLowerCase();
  const peloConteudo = formatoDoAnexoPeloConteudo(bytes);
  const tipoConfere =
    TIPOS[tipo] === peloConteudo ||
    (tipo === TIPO_GENERICO &&
      (peloConteudo === "heic" || peloConteudo === "heif"));
  if (peloConteudo === null || pelaExtensao !== peloConteudo || !tipoConfere) {
    throw new AnexoRecusado("anexo_formato_invalido");
  }
  if (!estruturaCompleta(bytes, peloConteudo)) {
    throw new AnexoRecusado("anexo_arquivo_malformado");
  }
  if (temMacro(bytes, peloConteudo)) {
    throw new AnexoRecusado("anexo_com_macro");
  }
  return {
    formato: peloConteudo,
    tamanhoBytes: bytes.length,
    hashSha256: createHash("sha256").update(bytes).digest("hex"),
  };
}
