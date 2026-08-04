import { randomBytes } from "node:crypto";
import { ConfigService } from "@nestjs/config";
import { MfaChallengeService } from "./mfa-challenge.service";

function createConfigService(key: string): ConfigService {
  return {
    getOrThrow: () => key,
  } as unknown as ConfigService;
}

describe("MfaChallengeService", () => {
  const key = randomBytes(32).toString("base64");
  const service = new MfaChallengeService(createConfigService(key));

  it("emite e valida um token com o mesmo propósito", () => {
    const token = service.issue("user-1", "mfa_verify");
    const payload = service.verify(token, "mfa_verify");
    expect(payload).not.toBeNull();
    expect(payload?.sub).toBe("user-1");
    expect(payload?.purpose).toBe("mfa_verify");
  });

  it("rejeita se o propósito não bate", () => {
    const token = service.issue("user-1", "mfa_enroll");
    expect(service.verify(token, "mfa_verify")).toBeNull();
  });

  it("rejeita token adulterado (assinatura não bate)", () => {
    const token = service.issue("user-1", "mfa_verify");
    const tampered = token.slice(0, -1) + (token.endsWith("A") ? "B" : "A");
    expect(service.verify(tampered, "mfa_verify")).toBeNull();
  });

  it("rejeita token assinado com outra chave", () => {
    const otherService = new MfaChallengeService(
      createConfigService(randomBytes(32).toString("base64")),
    );
    const token = otherService.issue("user-1", "mfa_verify");
    expect(service.verify(token, "mfa_verify")).toBeNull();
  });

  it("rejeita token malformado", () => {
    expect(service.verify("nao-e-um-token-valido", "mfa_verify")).toBeNull();
  });
});
