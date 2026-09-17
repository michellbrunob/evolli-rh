import {
  base32Decode,
  base32Encode,
  buildOtpauthUri,
  hotpCode,
  totpCodeForEpoch,
  TOTP_PERIOD_SECONDS,
  verifyTotpCode,
} from "./totp.util";

/**
 * Vetores oficiais RFC 4226 (Appendix D): segredo ASCII "12345678901234567890"
 * (Base32 = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"), HOTP-SHA1, 6 dígitos.
 */
const RFC4226_SECRET_ASCII = "12345678901234567890";
const RFC4226_SECRET_BASE32 = base32Encode(
  Buffer.from(RFC4226_SECRET_ASCII, "ascii"),
);
const RFC4226_CODES = [
  "755224",
  "287082",
  "359152",
  "969429",
  "338314",
  "254676",
  "287922",
  "162583",
  "399871",
  "520489",
];

describe("Base32 (RFC 4648)", () => {
  it("codifica e decodifica ida e volta", () => {
    const original = Buffer.from("12345678901234567890", "ascii");
    expect(base32Decode(base32Encode(original)).equals(original)).toBe(true);
  });

  it("casa com o Base32 conhecido do segredo RFC 4226", () => {
    expect(RFC4226_SECRET_BASE32).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
  });

  it("lança em caractere fora do alfabeto Base32", () => {
    expect(() => base32Decode("!!!invalido!!!")).toThrow();
  });
});

describe("HOTP (RFC 4226 Appendix D)", () => {
  it("reproduz os 10 vetores oficiais", () => {
    RFC4226_CODES.forEach((esperado, counter) => {
      expect(hotpCode(RFC4226_SECRET_BASE32, counter)).toBe(esperado);
    });
  });
});

describe("verifyTotpCode — tolerância ±1 intervalo", () => {
  const secret = base32Encode(
    Buffer.from("segredo-de-teste-sintetico", "utf8"),
  );
  const t0 = 1_700_000_000_000; // instante fixo (ms)

  it("aceita o código do intervalo atual", () => {
    const code = totpCodeForEpoch(secret, t0);
    expect(verifyTotpCode(secret, code, t0)).toBe(true);
  });

  it("aceita o código do intervalo ANTERIOR (delta -1)", () => {
    const code = totpCodeForEpoch(secret, t0 - TOTP_PERIOD_SECONDS * 1000);
    expect(verifyTotpCode(secret, code, t0)).toBe(true);
  });

  it("aceita o código do intervalo SEGUINTE (delta +1)", () => {
    const code = totpCodeForEpoch(secret, t0 + TOTP_PERIOD_SECONDS * 1000);
    expect(verifyTotpCode(secret, code, t0)).toBe(true);
  });

  it("REJEITA o código de 2 intervalos atrás (fora da janela)", () => {
    const code = totpCodeForEpoch(secret, t0 - 2 * TOTP_PERIOD_SECONDS * 1000);
    expect(verifyTotpCode(secret, code, t0)).toBe(false);
  });

  it("REJEITA o código de 2 intervalos à frente (fora da janela)", () => {
    const code = totpCodeForEpoch(secret, t0 + 2 * TOTP_PERIOD_SECONDS * 1000);
    expect(verifyTotpCode(secret, code, t0)).toBe(false);
  });

  it("rejeita formato inválido sem lançar", () => {
    expect(verifyTotpCode(secret, "abc", t0)).toBe(false);
    expect(verifyTotpCode(secret, "12345", t0)).toBe(false);
    expect(verifyTotpCode(secret, "1234567", t0)).toBe(false);
    expect(verifyTotpCode(secret, "", t0)).toBe(false);
  });
});

describe("buildOtpauthUri", () => {
  it("monta um otpauth://totp válido com emissor e segredo", () => {
    const uri = buildOtpauthUri({
      secretBase32: "GEZDGNBVGY3TQOJQ",
      accountName: "pessoa@example.test",
      issuer: "Evolli RH",
    });
    expect(uri.startsWith("otpauth://totp/")).toBe(true);
    expect(uri).toContain("secret=GEZDGNBVGY3TQOJQ");
    expect(uri).toContain("issuer=Evolli+RH");
    expect(uri).toContain("algorithm=SHA1");
    expect(uri).toContain("digits=6");
    expect(uri).toContain("period=30");
  });
});
