import { Injectable } from "@nestjs/common";
import * as argon2 from "argon2";

// Piso fechado na ADR 0003 §4 — só pode ser aumentado, nunca reduzido.
// Qualquer recalibração por ambiente precisa ficar documentada junto à
// configuração daquele ambiente (motivo, valor novo, data, responsável).
export const ARGON2ID_MEMORY_COST_KIB = 19 * 1024; // 19 MiB
export const ARGON2ID_TIME_COST = 2;
export const ARGON2ID_PARALLELISM = 1;

/**
 * Hash/verificação de senha e de código de recuperação MFA — ambos são
 * segredos de baixa entropia escolhidos/gerados para serem memorizáveis ou
 * anotados por humano, por isso usam Argon2id (lento, resistente a força
 * bruta offline), diferente do token opaco de sessão (ver
 * crypto/opaque-token.util.ts).
 */
@Injectable()
export class PasswordHashService {
  async hash(plaintext: string): Promise<string> {
    return argon2.hash(plaintext, {
      type: argon2.argon2id,
      memoryCost: ARGON2ID_MEMORY_COST_KIB,
      timeCost: ARGON2ID_TIME_COST,
      parallelism: ARGON2ID_PARALLELISM,
    });
  }

  async verify(hash: string, plaintext: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plaintext);
    } catch {
      // Hash malformado/incompatível — trata como não-verificado, nunca
      // propaga detalhe do driver argon2.
      return false;
    }
  }
}
