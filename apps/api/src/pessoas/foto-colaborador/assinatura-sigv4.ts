import { createHash, createHmac } from "node:crypto";

/**
 * T209 — assinatura AWS Signature Version 4, a que o Cloudflare R2 aceita
 * na API compatível com S3 (região `auto`, serviço `s3`). Implementada com o
 * `crypto` do Node, sem dependência nova; conferida contra o exemplo oficial
 * da AWS (`assinatura-sigv4.spec.ts`).
 *
 * Só o necessário para PUT, GET e DELETE de UM objeto: sem query string,
 * cabeçalhos assinados em minúsculas, corpo com hash explícito.
 */
export function hashSha256Hex(dados: Buffer | string): string {
  return createHash("sha256").update(dados).digest("hex");
}

function hmac(chave: Buffer | string, dados: string): Buffer {
  return createHmac("sha256", chave).update(dados, "utf8").digest();
}

/** Codifica cada segmento do caminho (RFC 3986), mantendo as barras. */
export function codificarCaminho(caminho: string): string {
  return caminho
    .split("/")
    .map((segmento) =>
      encodeURIComponent(segmento).replace(
        /[!'()*]/g,
        (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
      ),
    )
    .join("/");
}

export interface PedidoParaAssinar {
  readonly metodo: "GET" | "PUT" | "DELETE";
  /** Já codificado (`codificarCaminho`). */
  readonly caminho: string;
  /** Nomes em minúsculas; precisa conter `host` e `x-amz-date`. */
  readonly cabecalhos: Readonly<Record<string, string>>;
  readonly hashDoCorpo: string;
  readonly regiao: string;
  readonly servico: string;
  readonly chaveDeAcesso: string;
  readonly segredo: string;
}

/** O valor do cabeçalho `Authorization`. */
export function assinarSigV4(pedido: PedidoParaAssinar): string {
  const dataHora = pedido.cabecalhos["x-amz-date"];
  if (!dataHora) throw new Error("x-amz-date ausente");
  const dia = dataHora.slice(0, 8);
  const nomes = Object.keys(pedido.cabecalhos)
    .map((n) => n.toLowerCase())
    .sort();
  const canonicos = nomes
    .map((n) => `${n}:${String(pedido.cabecalhos[n]).trim()}\n`)
    .join("");
  const assinados = nomes.join(";");
  const pedidoCanonico = [
    pedido.metodo,
    pedido.caminho,
    "",
    canonicos,
    assinados,
    pedido.hashDoCorpo,
  ].join("\n");
  const escopo = `${dia}/${pedido.regiao}/${pedido.servico}/aws4_request`;
  const textoParaAssinar = [
    "AWS4-HMAC-SHA256",
    dataHora,
    escopo,
    hashSha256Hex(pedidoCanonico),
  ].join("\n");
  const chaveData = hmac(`AWS4${pedido.segredo}`, dia);
  const chaveRegiao = hmac(chaveData, pedido.regiao);
  const chaveServico = hmac(chaveRegiao, pedido.servico);
  const chaveAssinatura = hmac(chaveServico, "aws4_request");
  const assinatura = createHmac("sha256", chaveAssinatura)
    .update(textoParaAssinar, "utf8")
    .digest("hex");
  return `AWS4-HMAC-SHA256 Credential=${pedido.chaveDeAcesso}/${escopo},SignedHeaders=${assinados},Signature=${assinatura}`;
}
