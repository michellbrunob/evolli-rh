import {
  generateRecoveryCode,
  normalizeRecoveryCode,
} from "./recovery-code.util";

describe("generateRecoveryCode", () => {
  it("gera o formato XXXXX-XXXXX (Crockford, sem I/L/O/U)", () => {
    for (let i = 0; i < 50; i += 1) {
      const code = generateRecoveryCode();
      expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]{5}$/u);
    }
  });

  it("gera códigos distintos (alta entropia)", () => {
    const codes = new Set(
      Array.from({ length: 100 }, () => generateRecoveryCode()),
    );
    // Colisão em 100 códigos de ~50 bits é praticamente impossível.
    expect(codes.size).toBe(100);
  });
});

describe("normalizeRecoveryCode", () => {
  it("remove hífen e espaços e sobe para maiúsculas", () => {
    expect(normalizeRecoveryCode("ab3de-fg7hj")).toBe("AB3DEFG7HJ");
    expect(normalizeRecoveryCode("  AB3DE FG7HJ  ")).toBe("AB3DEFG7HJ");
  });

  it("um código digitado com e sem hífen normaliza para o mesmo valor", () => {
    const code = generateRecoveryCode();
    expect(normalizeRecoveryCode(code)).toBe(
      normalizeRecoveryCode(code.replace("-", "")),
    );
  });
});
