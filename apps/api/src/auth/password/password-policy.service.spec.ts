import { PasswordPolicyService } from "./password-policy.service";

describe("PasswordPolicyService", () => {
  const service = new PasswordPolicyService();

  it("aceita senha com 15+ caracteres, sem exigir composição", () => {
    expect(service.isValid("uma passphrase longa o suficiente")).toBe(true);
    expect(service.isValid("xkqjbwplsmvzfhc")).toBe(true); // 15 chars, sem símbolo/maiúscula
  });

  it("permite Unicode e espaço no comprimento (contagem por code point)", () => {
    // emoji + espaço, 15 "caracteres" em code points
    const withEmoji = "🔒 senha segura 🔑".padEnd(15, "x");
    expect(Array.from(withEmoji).length).toBeGreaterThanOrEqual(15);
    expect(service.isValid(withEmoji)).toBe(true);
  });

  it("rejeita senha com menos de 15 caracteres", () => {
    const violations = service.validate("curta1234567");
    expect(violations).toContainEqual({ code: "too_short" });
  });

  it("suporta pelo menos 64 caracteres sem rejeitar por tamanho", () => {
    const password64 = "a".repeat(64);
    expect(service.validate(password64)).not.toContainEqual({
      code: "too_long",
    });
  });

  it("rejeita senha acima do teto técnico (256)", () => {
    const tooLong = "a".repeat(257);
    expect(service.validate(tooLong)).toContainEqual({ code: "too_long" });
  });

  it("rejeita senha comum/vazada mesmo com 15+ caracteres", () => {
    const violations = service.validate("correcthorsebatterystaple");
    expect(violations).toContainEqual({ code: "common_password" });
  });

  it("checagem de senha comum é case-insensitive", () => {
    expect(service.isValid("CorrectHorseBatteryStaple")).toBe(false);
  });
});
