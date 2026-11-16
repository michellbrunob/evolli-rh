import { assinarSigV4, hashSha256Hex } from "./assinatura-sigv4";

/**
 * T209 — assinatura AWS SigV4, a que o Cloudflare R2 aceita na API S3.
 * Conferida contra o exemplo publicado pela AWS para o S3 ("GET Object",
 * credenciais de exemplo da documentação — nenhuma credencial real).
 */
describe("assinarSigV4", () => {
  it("reproduz o exemplo oficial da AWS (GET Object com Range)", () => {
    const autorizacao = assinarSigV4({
      metodo: "GET",
      caminho: "/test.txt",
      cabecalhos: {
        host: "examplebucket.s3.amazonaws.com",
        range: "bytes=0-9",
        "x-amz-content-sha256": hashSha256Hex(Buffer.alloc(0)),
        "x-amz-date": "20130524T000000Z",
      },
      hashDoCorpo: hashSha256Hex(Buffer.alloc(0)),
      regiao: "us-east-1",
      servico: "s3",
      chaveDeAcesso: "AKIAIOSFODNN7EXAMPLE",
      segredo: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    });
    expect(autorizacao).toBe(
      "AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request,SignedHeaders=host;range;x-amz-content-sha256;x-amz-date,Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41",
    );
  });

  it("o hash do corpo vazio é o conhecido", () => {
    expect(hashSha256Hex(Buffer.alloc(0))).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });
});
