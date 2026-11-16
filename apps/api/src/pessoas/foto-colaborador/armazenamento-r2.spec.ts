import { ArmazenamentoIndisponivel } from "./armazenamento-de-objetos";
import { ArmazenamentoR2 } from "./armazenamento-r2";

/**
 * T209 — adaptador do Cloudflare R2. `fetch` é simulado: nenhum teste fala
 * com o bucket. Credenciais sintéticas.
 */
const AMBIENTE = {
  R2_ACCESS_KEY_ID: "chave-sintetica",
  R2_SECRET_ACCESS_KEY: "segredo-sintetico-nao-real",
  R2_BUCKET: "bucket-sintetico",
  R2_ENDPOINT: "https://conta-sintetica.r2.example.test",
};
const CHAVE =
  "v1/empresas/11111111-1111-4111-8111-111111111111/colaboradores/22222222-2222-4222-8222-222222222222/foto/33333333-3333-4333-8333-333333333333/foto-256.webp";

describe("ArmazenamentoR2", () => {
  const original = { ...process.env };
  let chamadas: { url: string; init: RequestInit }[];

  function responder(status: number, corpo = "") {
    global.fetch = jest.fn(async (url: string | URL, init?: RequestInit) => {
      chamadas.push({ url: String(url), init: init ?? {} });
      return new Response(status === 204 ? null : corpo, { status });
    }) as unknown as typeof fetch;
  }

  beforeEach(() => {
    chamadas = [];
    Object.assign(process.env, AMBIENTE);
  });
  afterEach(() => {
    process.env = { ...original };
  });

  it("PUT no caminho bucket/chave, assinado, com o tipo e o hash do corpo", async () => {
    responder(200);
    await new ArmazenamentoR2().gravar(
      CHAVE,
      Buffer.from("webp"),
      "image/webp",
    );
    const { url, init } = chamadas[0]!;
    expect(init.method).toBe("PUT");
    expect(url).toBe(
      `https://conta-sintetica.r2.example.test/bucket-sintetico/${CHAVE}`,
    );
    const cabecalhos = init.headers as Record<string, string>;
    expect(cabecalhos.authorization).toMatch(
      /^AWS4-HMAC-SHA256 Credential=chave-sintetica\/\d{8}\/auto\/s3\/aws4_request,SignedHeaders=host;x-amz-content-sha256;x-amz-date,Signature=[0-9a-f]{64}$/,
    );
    expect(cabecalhos["content-type"]).toBe("image/webp");
    expect(cabecalhos["x-amz-content-sha256"]).toMatch(/^[0-9a-f]{64}$/);
    // O segredo nunca viaja: só a assinatura.
    expect(JSON.stringify(init)).not.toContain("segredo-sintetico");
  });

  it("GET devolve os bytes; 404 vira nulo", async () => {
    responder(200, "bytes");
    expect((await new ArmazenamentoR2().ler(CHAVE))?.toString()).toBe("bytes");
    responder(404);
    expect(await new ArmazenamentoR2().ler(CHAVE)).toBeNull();
  });

  it("DELETE aceita 204 e 404 (idempotente)", async () => {
    responder(204);
    await expect(new ArmazenamentoR2().apagar(CHAVE)).resolves.toBeUndefined();
    responder(404);
    await expect(new ArmazenamentoR2().apagar(CHAVE)).resolves.toBeUndefined();
  });

  it("erro do provedor ou da rede vira indisponível, sem vazar configuração", async () => {
    responder(500);
    await expect(
      new ArmazenamentoR2().gravar(CHAVE, Buffer.from("x"), "image/webp"),
    ).rejects.toBeInstanceOf(ArmazenamentoIndisponivel);
    global.fetch = jest.fn(async () => {
      throw new Error("ECONNRESET segredo-sintetico-nao-real");
    }) as unknown as typeof fetch;
    const erro = await new ArmazenamentoR2().ler(CHAVE).catch((e: Error) => e);
    expect(erro).toBeInstanceOf(ArmazenamentoIndisponivel);
    expect(String((erro as Error).message)).not.toContain("segredo");
  });

  it("sem configuração completa, nada é pedido", async () => {
    delete process.env.R2_BUCKET;
    responder(200);
    await expect(new ArmazenamentoR2().ler(CHAVE)).rejects.toEqual(
      new ArmazenamentoIndisponivel("armazenamento_nao_configurado"),
    );
    expect(chamadas).toHaveLength(0);
  });

  it("endpoint sem HTTPS é recusado", async () => {
    process.env.R2_ENDPOINT = "http://inseguro.example.test";
    responder(200);
    await expect(new ArmazenamentoR2().ler(CHAVE)).rejects.toBeInstanceOf(
      ArmazenamentoIndisponivel,
    );
    expect(chamadas).toHaveLength(0);
  });
});
