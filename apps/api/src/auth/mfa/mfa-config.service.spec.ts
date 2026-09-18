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
  it("habilitado somente quando MFA_ENABLED validado é true", () => {
    expect(comConfig(true).isEnabled()).toBe(true);
  });

  it("desabilitado quando false", () => {
    expect(comConfig(false).isEnabled()).toBe(false);
  });

  it("desabilitado quando ausente (undefined)", () => {
    expect(comConfig(undefined).isEnabled()).toBe(false);
  });

  it("não é ligado por valores truthy que não sejam o booleano true", () => {
    // Defesa: mesmo que algo injete uma string, só o booleano true habilita.
    expect(comConfig("true").isEnabled()).toBe(false);
    expect(comConfig(1).isEnabled()).toBe(false);
  });
});
