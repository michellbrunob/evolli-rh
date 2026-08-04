import { randomBytes } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { PasswordHashService } from "../password/password-hash.service";

const RECOVERY_CODE_COUNT = 10;
const RECOVERY_CODE_GROUP_LENGTH = 5;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem 0/O/1/I

/**
 * Códigos de recuperação MFA: uso único, hash com Argon2id (mesmo tratamento
 * de segredo de baixa entropia que senha — ver password-hash.service.ts),
 * nunca armazenados/logados em claro.
 */
@Injectable()
export class RecoveryCodeService {
  constructor(private readonly passwordHashService: PasswordHashService) {}

  generateCodes(count: number = RECOVERY_CODE_COUNT): string[] {
    return Array.from({ length: count }, () => this.generateSingleCode());
  }

  async hashCode(code: string): Promise<string> {
    return this.passwordHashService.hash(this.normalize(code));
  }

  async verifyCode(hash: string, code: string): Promise<boolean> {
    return this.passwordHashService.verify(hash, this.normalize(code));
  }

  private generateSingleCode(): string {
    const groupA = this.randomGroup();
    const groupB = this.randomGroup();
    return `${groupA}-${groupB}`;
  }

  private randomGroup(): string {
    const bytes = randomBytes(RECOVERY_CODE_GROUP_LENGTH);
    let group = "";
    for (const byte of bytes) {
      group += CODE_ALPHABET[byte % CODE_ALPHABET.length];
    }
    return group;
  }

  private normalize(code: string): string {
    return code.trim().toUpperCase();
  }
}
