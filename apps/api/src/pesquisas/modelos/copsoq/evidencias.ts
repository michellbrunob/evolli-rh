import { createHash } from "node:crypto";

/**
 * T216 — arquivos de evidência das etapas da conformidade com a NR-1 (ata,
 * lista de presença, apresentação, PGR assinado, certificados). Funções
 * puras: conferir o arquivo ANTES de qualquer gravação, no padrão dos
 * documentos do colaborador (T213, ADR 0021), e montar o registro guardado
 * no acompanhamento da pesquisa.
 *
 * - formatos: PDF, imagem (JPG, PNG, WEBP) e apresentação (PPTX);
 * - extensão, tipo declarado e conteúdo real precisam apontar o mesmo
 *   formato; estrutura mínima inteira; apresentação com macro é recusada;
 * - até 20 MB por arquivo e 10 arquivos por etapa;
 * - o nome mostrado é o do arquivo, limpo (sem caminho nem controle) — a
 *   chave do objeto só tem ids internos.
 */
export type FormatoDaEvidencia = "pdf" | "jpg" | "png" | "webp" | "pptx";

export const EVIDENCIA_LIMITE_BYTES = 20 * 1024 * 1024;
export const EVIDENCIAS_POR_ETAPA = 10;
export const NOME_DA_EVIDENCIA_MAXIMO = 120;

export const TIPO_DO_FORMATO_DA_EVIDENCIA: Readonly<
  Record<FormatoDaEvidencia, string>
> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

const EXTENSOES: Readonly<Record<string, FormatoDaEvidencia>> = {
  pdf: "pdf",
  jpg: "jpg",
  jpeg: "jpg",
  png: "png",
  webp: "webp",
  pptx: "pptx",
};

const TIPOS: Readonly<Record<string, FormatoDaEvidencia>> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  [TIPO_DO_FORMATO_DA_EVIDENCIA.pptx]: "pptx",
};

export type MotivoDaRecusaDaEvidencia =
  | "evidencia_arquivo_vazio"
  | "evidencia_arquivo_grande_demais"
  | "evidencia_formato_invalido"
  | "evidencia_arquivo_malformado"
  | "evidencia_com_macro";

export class EvidenciaRecusada extends Error {
  constructor(readonly motivo: MotivoDaRecusaDaEvidencia) {
    super(motivo);
    this.name = "EvidenciaRecusada";
  }
}

const ASSINATURA_PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const FIM_PNG = Buffer.from([0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]);
const ZIP_LOCAL = [0x50, 0x4b, 0x03, 0x04];
const ZIP_FIM_DO_DIRETORIO = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
/** O fim do diretório central tem 22 bytes, mais um comentário opcional. */
const ZIP_JANELA_DO_FIM = 22 + 0xffff;

function comeca(bytes: Buffer, assinatura: readonly number[]): boolean {
  return (
    bytes.length >= assinatura.length &&
    assinatura.every((byte, i) => bytes[i] === byte)
  );
}

/** O formato pelo CONTEÚDO, ou `null` se não for nenhum dos aceitos. */
export function formatoDaEvidenciaPeloConteudo(
  bytes: Buffer,
): FormatoDaEvidencia | null {
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
  if (comeca(bytes, ZIP_LOCAL)) return "pptx";
  return null;
}

function estruturaCompleta(bytes: Buffer, formato: FormatoDaEvidencia) {
  switch (formato) {
    case "pdf":
      return bytes
        .subarray(Math.max(0, bytes.length - 1024))
        .includes(Buffer.from("%%EOF"));
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
      const declarado = bytes.readUInt32LE(4) + 8;
      return (
        declarado === bytes.length ||
        (declarado % 2 === 1 && declarado + 1 === bytes.length)
      );
    }
    case "pptx":
      return (
        bytes
          .subarray(Math.max(0, bytes.length - ZIP_JANELA_DO_FIM))
          .includes(ZIP_FIM_DO_DIRETORIO) &&
        bytes.includes(Buffer.from("[Content_Types].xml")) &&
        bytes.includes(Buffer.from("ppt/presentation.xml"))
      );
  }
}

export interface ArquivoDaEvidencia {
  readonly bytes: Buffer;
  readonly extensao: string;
  readonly tipoDeclarado: string;
}

export interface EvidenciaConferida {
  readonly formato: FormatoDaEvidencia;
  readonly tamanhoBytes: number;
  readonly hashSha256: string;
}

export function conferirArquivoDaEvidencia(
  arquivo: ArquivoDaEvidencia,
): EvidenciaConferida {
  const { bytes } = arquivo;
  if (bytes.length === 0)
    throw new EvidenciaRecusada("evidencia_arquivo_vazio");
  if (bytes.length > EVIDENCIA_LIMITE_BYTES) {
    throw new EvidenciaRecusada("evidencia_arquivo_grande_demais");
  }
  const pelaExtensao =
    EXTENSOES[arquivo.extensao.trim().replace(/^\./, "").toLowerCase()];
  const peloTipo = TIPOS[arquivo.tipoDeclarado.trim().toLowerCase()];
  const peloConteudo = formatoDaEvidenciaPeloConteudo(bytes);
  if (
    peloConteudo === null ||
    pelaExtensao !== peloConteudo ||
    peloTipo !== peloConteudo
  ) {
    throw new EvidenciaRecusada("evidencia_formato_invalido");
  }
  if (!estruturaCompleta(bytes, peloConteudo)) {
    throw new EvidenciaRecusada("evidencia_arquivo_malformado");
  }
  if (
    peloConteudo === "pptx" &&
    bytes.includes(Buffer.from("vbaProject.bin"))
  ) {
    throw new EvidenciaRecusada("evidencia_com_macro");
  }
  return {
    formato: peloConteudo,
    tamanhoBytes: bytes.length,
    hashSha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

/**
 * O nome mostrado: o nome enviado (codificado para URL no cabeçalho), sem
 * caminho, controle ou aspas, até 120 caracteres; vazio ou inválido vira
 * "evidencia.<ext>". A extensão é sempre a do formato conferido.
 */
export function nomeDaEvidencia(
  bruto: string | undefined,
  formato: FormatoDaEvidencia,
): string {
  let nome = "";
  try {
    nome = decodeURIComponent(bruto ?? "");
  } catch {
    nome = "";
  }
  const base = nome
    .split(/[\\/]/)
    .pop()!
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f"<>|*?:]/g, "")
    .replace(/\.[^.]*$/, "")
    .replace(/\s+/g, " ")
    .trim();
  const ext = formato;
  const corpo = [...base].slice(0, NOME_DA_EVIDENCIA_MAXIMO - ext.length - 1);
  return `${corpo.join("").trim() || "evidencia"}.${ext}`;
}

/** A chave do objeto: só ids internos, nunca nome de arquivo ou pessoa. */
export function chaveDaEvidencia(
  empresaId: string,
  pesquisaId: string,
  etapa: string,
  arquivoId: string,
): string {
  return `v1/empresas/${empresaId}/pesquisas/${pesquisaId}/evidencias/${etapa}/${arquivoId}`;
}

/** "Content-Disposition" do download: nome ASCII e o nome em UTF-8. */
export function disposicaoDoDownload(nome: string): string {
  const ascii =
    nome
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\x20-\x7e]/g, "_")
      .replace(/["\\]/g, "_") || "evidencia";
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nome)}`;
}
