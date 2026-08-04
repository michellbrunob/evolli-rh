import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { decryptAesGcm, encryptAesGcm } from "../crypto/aes-gcm-cipher.util";

@Injectable()
export class MfaSecretCipherService {
  private readonly key: Buffer;

  constructor(configService: ConfigService) {
    // Validado em bootstrap por env.validation.ts — sempre Base64 de 32
    // bytes aqui.
    const rawKey = configService.getOrThrow<string>("MFA_ENCRYPTION_KEY");
    this.key = Buffer.from(rawKey, "base64");
  }

  encrypt(totpSecret: string): Buffer {
    return encryptAesGcm(Buffer.from(totpSecret, "utf8"), this.key);
  }

  decrypt(payload: Buffer): string {
    return decryptAesGcm(payload, this.key).toString("utf8");
  }
}
