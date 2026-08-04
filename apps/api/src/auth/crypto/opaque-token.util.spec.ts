import { generateOpaqueToken, hashOpaqueToken } from "./opaque-token.util";

describe("opaque token util", () => {
  it("gera tokens diferentes a cada chamada, com alta entropia", () => {
    const a = generateOpaqueToken();
    const b = generateOpaqueToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(40); // 256 bits em base64url
  });

  it("hash é determinístico para o mesmo token", () => {
    const token = generateOpaqueToken();
    expect(hashOpaqueToken(token)).toBe(hashOpaqueToken(token));
  });

  it("hash de tokens diferentes é diferente", () => {
    const a = generateOpaqueToken();
    const b = generateOpaqueToken();
    expect(hashOpaqueToken(a)).not.toBe(hashOpaqueToken(b));
  });

  it("hash nunca contém o token bruto", () => {
    const token = generateOpaqueToken();
    expect(hashOpaqueToken(token)).not.toContain(token);
  });
});
