import { Injectable } from "@nestjs/common";
import {
  ArmazenamentoIndisponivel,
  type ArmazenamentoDeObjetos,
} from "./armazenamento-de-objetos";
import {
  assinarSigV4,
  codificarCaminho,
  hashSha256Hex,
} from "./assinatura-sigv4";

/**
 * T209 — Cloudflare R2 privado pela API compatível com S3 (ADR 0020), com a
 * assinatura SigV4 feita aqui (`assinatura-sigv4.ts`), sem SDK.
 *
 * Configuração só por variáveis de ambiente (arquivo local ignorado):
 * `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` e `R2_ENDPOINT`
 * (ou `R2_ACCOUNT_ID`, de onde o endpoint padrão é montado). Lidas a cada
 * operação; faltando alguma, a operação falha como indisponível. Nenhum
 * valor é registrado em log ou devolvido em erro.
 *
 * O bucket é privado: não existe URL pública. Quem lê a foto é a API, depois
 * de autorizar, e devolve os bytes ao navegador.
 */
interface ConfiguracaoR2 {
  readonly endpoint: URL;
  readonly bucket: string;
  readonly chaveDeAcesso: string;
  readonly segredo: string;
}

const TEMPO_LIMITE_MS = 15_000;

function configuracao(): ConfiguracaoR2 {
  const chaveDeAcesso = process.env.R2_ACCESS_KEY_ID?.trim();
  const segredo = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const bucket = process.env.R2_BUCKET?.trim();
  const conta = process.env.R2_ACCOUNT_ID?.trim();
  const endpointBruto =
    process.env.R2_ENDPOINT?.trim() ||
    (conta ? `https://${conta}.r2.cloudflarestorage.com` : "");
  if (!chaveDeAcesso || !segredo || !bucket || !endpointBruto) {
    throw new ArmazenamentoIndisponivel("armazenamento_nao_configurado");
  }
  let endpoint: URL;
  try {
    endpoint = new URL(endpointBruto);
  } catch {
    throw new ArmazenamentoIndisponivel("armazenamento_nao_configurado");
  }
  if (endpoint.protocol !== "https:") {
    throw new ArmazenamentoIndisponivel("armazenamento_nao_configurado");
  }
  return { endpoint, bucket, chaveDeAcesso, segredo };
}

function agoraAmz(): string {
  return new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

@Injectable()
export class ArmazenamentoR2 implements ArmazenamentoDeObjetos {
  private async pedir(
    metodo: "GET" | "PUT" | "DELETE",
    chave: string,
    corpo?: Buffer,
    tipo?: string,
  ): Promise<Response> {
    const cfg = configuracao();
    const caminho = codificarCaminho(`/${cfg.bucket}/${chave}`);
    const hashDoCorpo = hashSha256Hex(corpo ?? Buffer.alloc(0));
    const cabecalhos: Record<string, string> = {
      host: cfg.endpoint.host,
      "x-amz-content-sha256": hashDoCorpo,
      "x-amz-date": agoraAmz(),
    };
    const autorizacao = assinarSigV4({
      metodo,
      caminho,
      cabecalhos,
      hashDoCorpo,
      regiao: "auto",
      servico: "s3",
      chaveDeAcesso: cfg.chaveDeAcesso,
      segredo: cfg.segredo,
    });
    try {
      return await fetch(new URL(caminho, cfg.endpoint), {
        method: metodo,
        headers: {
          ...cabecalhos,
          authorization: autorizacao,
          ...(tipo ? { "content-type": tipo } : {}),
        },
        ...(corpo ? { body: corpo } : {}),
        signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
      });
    } catch {
      // Rede, tempo esgotado: nada do pedido (nem da configuração) vaza.
      throw new ArmazenamentoIndisponivel();
    }
  }

  async gravar(chave: string, corpo: Buffer, tipo: string): Promise<void> {
    const r = await this.pedir("PUT", chave, corpo, tipo);
    await r.arrayBuffer().catch(() => undefined);
    if (!r.ok) throw new ArmazenamentoIndisponivel();
  }

  async ler(chave: string): Promise<Buffer | null> {
    const r = await this.pedir("GET", chave);
    if (r.status === 404) {
      await r.arrayBuffer().catch(() => undefined);
      return null;
    }
    if (!r.ok) {
      await r.arrayBuffer().catch(() => undefined);
      throw new ArmazenamentoIndisponivel();
    }
    return Buffer.from(await r.arrayBuffer());
  }

  async apagar(chave: string): Promise<void> {
    const r = await this.pedir("DELETE", chave);
    await r.arrayBuffer().catch(() => undefined);
    if (!r.ok && r.status !== 404) throw new ArmazenamentoIndisponivel();
  }
}
