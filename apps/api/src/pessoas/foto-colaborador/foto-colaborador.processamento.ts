/**
 * T209 — foto do colaborador (ADR 0020).
 *
 * O servidor é a autoridade sobre a imagem. O que chega é conferido em três
 * camadas — extensão do arquivo, tipo declarado e a assinatura do conteúdo,
 * que precisam concordar entre si — e só PNG e JPEG passam. Depois:
 *
 * 1. teto de 5 MB antes de qualquer decodificação;
 * 2. medida pelo cabeçalho (lado mínimo e teto de pixels contra
 *    imagem-bomba, o mesmo teto imposto ao decodificador);
 * 3. decodificação com falha em qualquer erro, orientação corrigida pelo
 *    EXIF e corte quadrado central;
 * 4. três versões NOVAS em WebP (96, 256 e 512 px), sem metadados (EXIF,
 *    XMP, ICC). Nenhum conteúdo ativo sobrevive: WebP é só pixels.
 *
 * O arquivo enviado nunca é guardado nem devolvido.
 */
import { createHash } from "node:crypto";
import sharp from "sharp";
import { formatoPeloConteudo } from "../../users/perfil/foto-perfil.processamento";

export const FOTO_COLABORADOR_LIMITE_BYTES = 5 * 1024 * 1024;
export const FOTO_COLABORADOR_LADO_MINIMO = 64;
export const FOTO_COLABORADOR_PIXELS_MAXIMO = 25_000_000;
export const TAMANHOS_DA_FOTO = [96, 256, 512] as const;
export type TamanhoDaFoto = (typeof TAMANHOS_DA_FOTO)[number];

// A foto é dado pessoal: nada dela fica no cache da libvips.
sharp.cache(false);

export type MotivoDaRecusaDaFotoDoColaborador =
  | "foto_formato_invalido"
  | "foto_tipo_divergente"
  | "foto_grande_demais"
  | "foto_pequena"
  | "foto_invalida";

export class FotoDoColaboradorRecusada extends Error {
  constructor(readonly motivo: MotivoDaRecusaDaFotoDoColaborador) {
    super(motivo);
    this.name = "FotoDoColaboradorRecusada";
  }
}

const TIPO_POR_EXTENSAO: Readonly<Record<string, "image/png" | "image/jpeg">> =
  { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg" };
const TIPO_POR_CONTEUDO = { png: "image/png", jpeg: "image/jpeg" } as const;

export interface FotoEnviada {
  readonly bytes: Buffer;
  readonly tipoDeclarado: string;
  readonly extensao: string;
}

export interface FotoProcessada {
  readonly versoes: Readonly<Record<TamanhoDaFoto, Buffer>>;
  /** SHA-256 da versão de 512 px (a gerada aqui, nunca a enviada). */
  readonly hashSha256: string;
  /** Bytes da versão de 512 px. */
  readonly tamanhoBytes: number;
}

export async function processarFotoDoColaborador(
  enviada: FotoEnviada,
): Promise<FotoProcessada> {
  const extensao = enviada.extensao.trim().toLowerCase();
  const tipo = enviada.tipoDeclarado.trim().toLowerCase();
  const tipoDaExtensao = TIPO_POR_EXTENSAO[extensao];
  if (
    tipoDaExtensao === undefined ||
    (tipo !== "image/png" && tipo !== "image/jpeg")
  ) {
    throw new FotoDoColaboradorRecusada("foto_formato_invalido");
  }
  if (tipoDaExtensao !== tipo) {
    throw new FotoDoColaboradorRecusada("foto_tipo_divergente");
  }
  if (enviada.bytes.length === 0) {
    throw new FotoDoColaboradorRecusada("foto_invalida");
  }
  if (enviada.bytes.length > FOTO_COLABORADOR_LIMITE_BYTES) {
    throw new FotoDoColaboradorRecusada("foto_grande_demais");
  }
  const formato = formatoPeloConteudo(enviada.bytes);
  if (
    formato === null ||
    formato === "webp" ||
    TIPO_POR_CONTEUDO[formato] !== tipo
  ) {
    throw new FotoDoColaboradorRecusada("foto_tipo_divergente");
  }

  const entrada = () =>
    sharp(enviada.bytes, {
      limitInputPixels: FOTO_COLABORADOR_PIXELS_MAXIMO,
      failOn: "error",
      sequentialRead: true,
    });

  let largura: number;
  let altura: number;
  try {
    const meta = await entrada().metadata();
    largura = meta.width ?? 0;
    altura = meta.height ?? 0;
  } catch {
    throw new FotoDoColaboradorRecusada("foto_invalida");
  }
  if (largura * altura > FOTO_COLABORADOR_PIXELS_MAXIMO) {
    throw new FotoDoColaboradorRecusada("foto_grande_demais");
  }
  if (
    largura < FOTO_COLABORADOR_LADO_MINIMO ||
    altura < FOTO_COLABORADOR_LADO_MINIMO
  ) {
    throw new FotoDoColaboradorRecusada("foto_pequena");
  }

  let versoes: Record<TamanhoDaFoto, Buffer>;
  try {
    // Decodifica UMA vez (falha em qualquer erro), orienta e corta.
    const orientada = await entrada().rotate().toBuffer();
    const pares = await Promise.all(
      TAMANHOS_DA_FOTO.map(async (tamanho) => {
        const webp = await sharp(orientada, { failOn: "error" })
          .resize(tamanho, tamanho, { fit: "cover", position: "centre" })
          .webp({ quality: 82, effort: 4 })
          .toBuffer();
        return [tamanho, webp] as const;
      }),
    );
    versoes = Object.fromEntries(pares) as Record<TamanhoDaFoto, Buffer>;
  } catch {
    throw new FotoDoColaboradorRecusada("foto_invalida");
  }
  const principal = versoes[512];
  return {
    versoes,
    hashSha256: createHash("sha256").update(principal).digest("hex"),
    tamanhoBytes: principal.length,
  };
}
