import { Injectable } from "@nestjs/common";
import { isCommonPassword } from "./common-passwords";

// Decisão fechada (ADR 0003 §4): mínimo 15, suporta pelo menos 64. O teto de
// 256 é só limite técnico anti-abuso (payload/DoS), bem acima do exigido —
// não é "expiração/composição arbitrária" alguma.
export const PASSWORD_MIN_LENGTH = 15;
export const PASSWORD_MAX_LENGTH = 256;

export interface PasswordPolicyViolation {
  code: "too_short" | "too_long" | "common_password";
}

/**
 * Sem exigência de composição (maiúscula/símbolo) e sem expiração periódica
 * — decisão fechada, NIST 800-63B. Unicode e espaço são permitidos: o
 * comprimento é contado em code points, não em bytes/UTF-16 units, para não
 * penalizar caractere fora do BMP.
 */
@Injectable()
export class PasswordPolicyService {
  validate(plaintext: string): PasswordPolicyViolation[] {
    const violations: PasswordPolicyViolation[] = [];
    const length = Array.from(plaintext).length;

    if (length < PASSWORD_MIN_LENGTH) {
      violations.push({ code: "too_short" });
    }
    if (length > PASSWORD_MAX_LENGTH) {
      violations.push({ code: "too_long" });
    }
    if (isCommonPassword(plaintext)) {
      violations.push({ code: "common_password" });
    }

    return violations;
  }

  isValid(plaintext: string): boolean {
    return this.validate(plaintext).length === 0;
  }
}
