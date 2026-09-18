import { NotFoundException } from "@nestjs/common";
import { MfaEnabledGuard } from "./mfa-enabled.guard";
import { MfaConfigService } from "./mfa-config.service";

/**
 * T131 — com o MFA desativado, o portão nega TODA rota de MFA com 404 (recurso
 * indisponível de forma coerente, sem revelar implementação interna). Ativado,
 * deixa passar.
 */
function guardCom(enabled: boolean): MfaEnabledGuard {
  const mfaConfig = { isEnabled: () => enabled } as unknown as MfaConfigService;
  return new MfaEnabledGuard(mfaConfig);
}

describe("MfaEnabledGuard", () => {
  it("lança 404 quando o MFA está desativado", () => {
    expect(() => guardCom(false).canActivate()).toThrow(NotFoundException);
  });

  it("libera quando o MFA está ativado", () => {
    expect(guardCom(true).canActivate()).toBe(true);
  });
});
