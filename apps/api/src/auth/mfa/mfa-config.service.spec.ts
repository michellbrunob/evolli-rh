import { ConfigService } from "@nestjs/config";
import { MfaConfigService } from "./mfa-config.service";

/**
 * T131 — o interruptor de servidor do MFA vem SOMENTE da configuração validada
 * (`MFA_ENABLED`), nunca do navegador/query/banco. `isEnabled()` é `true`
 * apenas quando o valor booleano validado é exatamente `true`.
 */
function comConfig(valor: unknown): MfaConfigService {
  const config = {
    get: (chave: string) => (chave === "MFA_ENABLED" ? valor : undefined),
  } as unknown as ConfigService;
  return new MfaConfigService(config);
}

describe("MfaConfigService", () => {
  it("habilitado quando o booleano validado é true", () => {
    expect(comConfig(true).isEnabled()).toBe(true);
  });

  it('habilitado quando o ConfigService devolve a string "true" (valor cru de process.env)', () => {
    // env.validation já restringe o valor a "true"/"false"; reconhecer a string
    // "true" cobre o caso de o ConfigService devolver o valor cru, não o
    // transformado.
    expect(comConfig("true").isEnabled()).toBe(true);
  });

  it("desabilitado quando false (booleano ou string)", () => {
    expect(comConfig(false).isEnabled()).toBe(false);
    expect(comConfig("false").isEnabled()).toBe(false);
  });

  it("desabilitado quando ausente (undefined)", () => {
    expect(comConfig(undefined).isEnabled()).toBe(false);
  });

  it("não é ligado por outros valores truthy (nunca liga por engano)", () => {
    expect(comConfig(1).isEnabled()).toBe(false);
    expect(comConfig("1").isEnabled()).toBe(false);
    expect(comConfig("TRUE").isEnabled()).toBe(false);
  });
});
