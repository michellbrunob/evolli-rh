import { MfaConfigService } from "./mfa-config.service";

/**
 * T131 — o interruptor de servidor do MFA vem SOMENTE da variável de ambiente
 * `MFA_ENABLED`, nunca do navegador/query/banco. `isEnabled()` é `true` apenas
 * quando o valor é exatamente a string `"true"` (o `env.validation.ts` já
 * garante no boot que só `"true"`/`"false"` são aceitos).
 */
function comEnv(valor: string | undefined): MfaConfigService {
  const env = (
    valor === undefined ? {} : { MFA_ENABLED: valor }
  ) as NodeJS.ProcessEnv;
  return new MfaConfigService(env);
}

describe("MfaConfigService", () => {
  it('habilitado quando MFA_ENABLED é exatamente "true"', () => {
    expect(comEnv("true").isEnabled()).toBe(true);
  });

  it('desabilitado quando "false"', () => {
    expect(comEnv("false").isEnabled()).toBe(false);
  });

  it("desabilitado quando ausente (undefined)", () => {
    expect(comEnv(undefined).isEnabled()).toBe(false);
  });

  it("não é ligado por outros valores (nunca liga por engano)", () => {
    expect(comEnv("1").isEnabled()).toBe(false);
    expect(comEnv("TRUE").isEnabled()).toBe(false);
    expect(comEnv("yes").isEnabled()).toBe(false);
  });
});
