/**
 * T208 — foto de perfil da própria conta (ADR 0018, decisões FP-2 e FP-3).
 *
 * O servidor é a autoridade sobre a imagem. O navegador só mostra a prévia;
 * aqui o arquivo enviado é:
 *
 * 1. limitado a 5 MB ANTES de qualquer processamento (`lerCorpoLimitado`);
 * 2. reconhecido pelo CONTEÚDO — a assinatura de JPEG, PNG ou WebP —, nunca
 *    pela extensão ou pelo tipo declarado (nenhum dos dois chega aqui);
 * 3. medido pelo CABEÇALHO antes de decodificar: ao menos 128 × 128 px e no
 *    máximo 25 milhões de pixels, contra imagem-bomba (o mesmo teto é imposto
 *    ao decodificador);
 * 4. decodificado com falha em qualquer erro (arquivo truncado ou
 *    malformado é recusado), orientado, cortado no quadrado central, reduzido
 *    para 256 × 256 e REGRAVADO como JPEG, sem metadados (EXIF, XMP, ICC).
 *
 * O que sai é sempre uma imagem nova, gerada aqui. Os bytes enviados nunca
 * são guardados nem devolvidos.
 */
import type { Request } from "express";
import { PayloadTooLargeException } from "@nestjs/common";
import sharp from "sharp";

/** Limite do arquivo enviado (FP-2). */
export const FOTO_LIMITE_BYTES = 5 * 1024 * 1024;
/** Menor lado aceito, em pixels (FP-2). */
export const FOTO_LADO_MINIMO = 128;
/** Teto de pixels (largura × altura) contra imagem-bomba (FP-2). */
export const FOTO_PIXELS_MAXIMO = 25_000_000;
/** Lado da imagem gravada (FP-3). */
export const FOTO_LADO_GRAVADO = 256;

// A foto é dado pessoal: nada dela fica no cache de operações da libvips.
sharp.cache(false);

/** Motivos públicos de recusa da foto (422, com `codigo`). */
export type MotivoDeRecusaDaFoto =
  | "foto_formato_invalido"
  | "foto_pequena"
  | "foto_grande_demais"
  | "foto_invalida";

/** Recusa da foto por conteúdo; o controller a traduz em 422 com código. */
export class FotoRecusada extends Error {
  constructor(readonly motivo: MotivoDeRecusaDaFoto) {
    super(motivo);
    this.name = "FotoRecusada";
  }
}

type FormatoAceito = "jpeg" | "png" | "webp";

/** O formato pela assinatura do conteúdo, ou `null` se não for aceito. */
export function formatoPeloConteudo(bytes: Buffer): FormatoAceito | null {
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "jpeg";
  }
  const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length >= PNG.length && PNG.every((b, i) => bytes[i] === b)) {
    return "png";
  }
  if (
    bytes.length >= 12 &&
    bytes.toString("latin1", 0, 4) === "RIFF" &&
    bytes.toString("latin1", 8, 12) === "WEBP"
  ) {
    return "webp";
  }
  return null;
}

/**
 * Lê o corpo binário da requisição com teto de bytes. Recusa pelo
 * `Content-Length` declarado antes de ler, e de novo durante a leitura (o
 * cabeçalho pode mentir ou faltar). O excedente é descartado, nunca guardado.
 */
export function lerCorpoLimitado(
  req: Request,
  limite: number = FOTO_LIMITE_BYTES,
  descarteMaximo: number = 2 * limite,
): Promise<Buffer> {
  // Recusado pelo cabeçalho, nada é guardado; o corpo ainda é DESCARTADO até
  // o fim, para o cliente receber o 413 em vez de uma conexão derrubada no
  // meio do envio (achado no e2e). Acima de `descarteMaximo`, a conexão cai:
  // ninguém prende o servidor mandando bytes sem fim.
  const declarado = Number(req.headers["content-length"]);
  const excedeuNoCabecalho = Number.isFinite(declarado) && declarado > limite;
  return new Promise<Buffer>((resolve, reject) => {
    const partes: Buffer[] = [];
    let total = 0;
    let recusado = excedeuNoCabecalho;
    req.on("data", (parte: Buffer) => {
      total += parte.length;
      if (!recusado && total > limite) {
        recusado = true;
        partes.length = 0;
      }
      if (recusado) {
        if (total > descarteMaximo) {
          req.destroy();
          reject(new PayloadTooLargeException());
        }
        return;
      }
      partes.push(parte);
    });
    req.on("end", () => {
      if (recusado) reject(new PayloadTooLargeException());
      else resolve(Buffer.concat(partes));
    });
    req.on("error", (erro) => {
      reject(recusado ? new PayloadTooLargeException() : erro);
    });
  });
}

/**
 * Valida o arquivo pelo conteúdo e devolve a foto regravada: JPEG quadrado
 * 256 × 256, sem metadados. Lança `FotoRecusada` com o motivo.
 */
export async function normalizarFotoDePerfil(bytes: Buffer): Promise<Buffer> {
  const formato = formatoPeloConteudo(bytes);
  if (formato === null) throw new FotoRecusada("foto_formato_invalido");

  const opcoes = {
    limitInputPixels: FOTO_PIXELS_MAXIMO,
    failOn: "warning" as const,
    animated: false,
  };

  // Cabeçalho primeiro: dimensões e formato real, sem decodificar os pixels.
  let largura: number;
  let altura: number;
  try {
    const meta = await sharp(bytes, {
      ...opcoes,
      limitInputPixels: false,
    }).metadata();
    if (meta.format !== formato || !meta.width || !meta.height) {
      throw new FotoRecusada("foto_invalida");
    }
    largura = meta.width;
    altura = meta.height;
  } catch (erro) {
    if (erro instanceof FotoRecusada) throw erro;
    throw new FotoRecusada("foto_invalida");
  }
  if (largura * altura > FOTO_PIXELS_MAXIMO) {
    throw new FotoRecusada("foto_grande_demais");
  }
  if (Math.min(largura, altura) < FOTO_LADO_MINIMO) {
    throw new FotoRecusada("foto_pequena");
  }

  try {
    return await sharp(bytes, opcoes)
      .rotate()
      .resize(FOTO_LADO_GRAVADO, FOTO_LADO_GRAVADO, {
        fit: "cover",
        position: "centre",
      })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer();
  } catch {
    throw new FotoRecusada("foto_invalida");
  }
}
