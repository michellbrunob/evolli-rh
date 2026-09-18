import { MfaConfigService } from "./mfa-config.service";

/**
 * T131 — o interruptor de servidor do MFA vem SOMENTE da variável de ambiente
 * `MFA_ENABLED`, nunca do navegador/query/banco. `isEnabled()` é `true` apenas
 * quando o valor é exatamente a string `"true"` (o `env.validation.ts` já
 * garante no boot que só `"true"`/`"false"` são aceitos).
 */
describe("MfaConfigService", () => {
  const service = new MfaConfigService();
  const original = process.env.MFA_ENABLED;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.MFA_ENABLED;
    } else {
      process.env.MFA_ENABLED = original;
    }
  });

  it('habilitado quando MFA_ENABLED é exatamente "true"', () => {
    process.env.MFA_ENABLED = "true";
    expect(service.isEnabled()).toBe(true);
  });

  it('desabilitado quando "false"', () => {
    process.env.MFA_ENABLED = "false";
    expect(service.isEnabled()).toBe(false);
  });

  it("desabilitado quando ausente", () => {
    delete process.env.MFA_ENABLED;
    expect(service.isEnabled()).toBe(false);
  });

  it("não é ligado por outros valores (nunca liga por engano)", () => {
    for (const valor of ["1", "TRUE", "yes"]) {
      process.env.MFA_ENABLED = valor;
      expect(service.isEnabled()).toBe(false);
    }
  });
});
