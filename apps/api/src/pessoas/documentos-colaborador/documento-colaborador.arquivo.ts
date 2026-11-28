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
 *   mesmo formato — PDF, JPG ou PNG; T217: também DOC, DOCX e WebP (sem HEIC);
 * - estrutura mínima de cada formato (fim do arquivo), para recusar arquivo
 *   cortado ou malformado;
 * - T217: DOC e DOCX com macro são recusados (`documento_com_macro`);
 * - até 10 MB.
 *
 * T217: o nome original do arquivo é guardado só como metadado de exibição
 * (`nomeOriginalDoCabecalho`), saneado; a conferência continua pela extensão.
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
  | "documento_com_macro"
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
  doc: "doc",
  docx: "docx",
  webp: "webp",
};

const TIPOS: Readonly<Record<string, FormatoDocumentoColaborador>> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
  "image/webp": "webp",
};

export const TIPO_DO_FORMATO: Readonly<
  Record<FormatoDocumentoColaborador, string>
> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  png: "image/png",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  webp: "image/webp",
};

const ASSINATURA_PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const FIM_PNG = Buffer.from([0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]);

/** T217 — Word antigo: contêiner OLE (Compound File). */
const ASSINATURA_OLE = Buffer.from([
  0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1,
]);
/** T217 — o fluxo de texto do Word no diretório do OLE (UTF-16). */
const FLUXO_WORD = Buffer.from("WordDocument", "utf16le");
/** T217 — fluxos de macro do OLE (UTF-16). */
const MACROS_OLE = [
  Buffer.from("_VBA_PROJECT", "utf16le"),
  Buffer.from("Macros", "utf16le"),
  Buffer.from("VBA", "utf16le"),
];
const SETOR_OLE = 512;

/** T217 — Word atual: pacote ZIP com o índice de tipos e o corpo do texto. */
const ASSINATURA_ZIP = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const FIM_DO_DIRETORIO_ZIP = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
const INDICE_DOCX = Buffer.from("[Content_Types].xml", "latin1");
const CORPO_DOCX = Buffer.from("word/document.xml", "latin1");
const MACRO_DOCX = Buffer.from("vbaProject.bin", "latin1");
/** Registro de fim de diretório (22) + comentário máximo (65535). */
const BUSCA_DO_FIM_ZIP = 22 + 0xffff;

const comeca = (bytes: Buffer, assinatura: Buffer) =>
  bytes.length >= assinatura.length &&
  bytes.subarray(0, assinatura.length).equals(assinatura);

/** O formato pelo CONTEÚDO, ou `null` se não for nenhum dos aceitos. */
export function formatoPeloConteudo(
  bytes: Buffer,
): FormatoDocumentoColaborador | null {
  if (bytes.subarray(0, 5).toString("latin1") === "%PDF-") return "pdf";
  if (comeca(bytes, ASSINATURA_OLE)) {
    return bytes.includes(FLUXO_WORD) ? "doc" : null;
  }
  if (comeca(bytes, ASSINATURA_ZIP)) {
    return bytes.includes(INDICE_DOCX) && bytes.includes(CORPO_DOCX)
      ? "docx"
      : null;
  }
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString("latin1") === "RIFF" &&
    bytes.subarray(8, 12).toString("latin1") === "WEBP"
  ) {
    return "webp";
  }
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

/** T217 — DOC e DOCX com macro: risco de código, recusado. */
function temMacro(
  bytes: Buffer,
  formato: FormatoDocumentoColaborador,
): boolean {
  if (formato === "doc") return MACROS_OLE.some((m) => bytes.includes(m));
  if (formato === "docx") return bytes.includes(MACRO_DOCX);
  return false;
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
  if (formato === "doc") {
    // Cabeçalho de 512 e setores inteiros: arquivo cortado fica fora.
    return bytes.length >= 3 * SETOR_OLE && bytes.length % SETOR_OLE === 0;
  }
  if (formato === "docx") {
    // O registro de fim do diretório central fecha o pacote.
    const fim = bytes.subarray(Math.max(0, bytes.length - BUSCA_DO_FIM_ZIP));
    return fim.includes(FIM_DO_DIRETORIO_ZIP);
  }
  if (formato === "webp") {
    // O tamanho declarado no RIFF cobre exatamente o resto do arquivo.
    return bytes.readUInt32LE(4) + 8 === bytes.length;
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
  if (temMacro(bytes, peloConteudo)) {
    throw new DocumentoRecusado("documento_com_macro");
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
> = {
  pdf: "pdf",
  jpg: "jpg",
  png: "png",
  doc: "doc",
  docx: "docx",
  webp: "webp",
};

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

/** T217 — tamanho máximo do nome original guardado (caracteres). */
export const NOME_ORIGINAL_MAXIMO = 255;

const INVISIVEIS = /[\p{Cc}\p{Cf}]/gu;

/**
 * T217 — o nome original do arquivo, vindo do cabeçalho (codificado com
 * `encodeURIComponent`), saneado para exibição: só o último trecho do
 * caminho, sem caracteres de controle ou invisíveis, espaços simples e até
 * 255 caracteres (cortado antes da extensão, que fica). É metadado: nunca
 * recusa o envio — ausente, vazio ou malformado vira `null`.
 */
export function nomeOriginalDoCabecalho(
  bruto: string | undefined,
): string | null {
  if (!bruto) return null;
  let nome: string;
  try {
    nome = decodeURIComponent(bruto);
  } catch {
    return null;
  }
  const ultimo = nome.normalize("NFC").split(/[\\/]/).pop() ?? "";
  const limpo = ultimo.replace(INVISIVEIS, "").replace(/\s+/gu, " ").trim();
  if (limpo === "") return null;
  const letras = [...limpo];
  if (letras.length <= NOME_ORIGINAL_MAXIMO) return limpo;
  const ponto = limpo.lastIndexOf(".");
  const extensao = ponto > 0 ? [...limpo.slice(ponto)] : [];
  const sufixo = extensao.length <= 16 ? extensao : [];
  return [
    ...letras.slice(0, NOME_ORIGINAL_MAXIMO - sufixo.length),
    ...sufixo,
  ].join("");
}
