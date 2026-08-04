import { randomBytes } from "node:crypto";
import { ConfigService } from "@nestjs/config";
import { MfaSecretCipherService } from "./mfa-secret-cipher.service";

function createConfigService(key: string): ConfigService {
  return {
    getOrThrow: () => key,
  } as unknown as ConfigService;
}

describe("MfaSecretCipherService", () => {
  it("cifra e decifra o segredo TOTP", () => {
    const key = randomBytes(32).toString("base64");
    const service = new MfaSecretCipherService(createConfigService(key));

    const encrypted = service.encrypt("IZJSUU2ECN4BIJBE");
    expect(encrypted.toString("utf8")).not.toContain("IZJSUU2ECN4BIJBE");
    expect(service.decrypt(encrypted)).toBe("IZJSUU2ECN4BIJBE");
  });
});
