import { authenticator } from "otplib";
import { TotpService } from "./totp.service";

describe("TotpService", () => {
  const service = new TotpService();

  it("gera segredo e URI otpauth válidos", () => {
    const secret = service.generateSecret();
    const uri = service.buildOtpAuthUri("user@example.com", secret);
    expect(uri).toMatch(/^otpauth:\/\/totp\//);
    expect(uri).toContain(encodeURIComponent("Evolli RH"));
  });

  it("verifica código válido gerado para o mesmo segredo", () => {
    const secret = service.generateSecret();
    const code = authenticator.generate(secret);
    expect(service.verify(code, secret)).toBe(true);
  });

  it("rejeita código inválido", () => {
    const secret = service.generateSecret();
    expect(service.verify("000000", secret)).toBe(false);
  });

  it("nunca lança para segredo/código malformado", () => {
    expect(() => service.verify("abc", "segredo-invalido")).not.toThrow();
    expect(service.verify("abc", "segredo-invalido")).toBe(false);
  });
});
