import { randomBytes } from "node:crypto";

/**
 * Códigos de recuperação de uso único (T125).
 *
 * Cada código tem alta entropia (gerado pelo servidor), mas é digitado por um
 * humano em um fluxo raro — a proteção **em repouso** usa Argon2id (o hash
 * "forte" do repo, ver `password-hash.service.ts` e o comentário de
 * `opaque-token.util.ts`), nunca SHA-256 rápido. São exibidos **uma única
 * vez** na confirmação do fator; o banco guarda somente o hash Argon2id.
 *
 * Formato: 10 caracteres Base32 (Crockford, sem I/L/O/U para evitar confusão
 * de leitura), agrupados como `XXXXX-XXXXX`. ~50 bits por código.
 */

const CROCKFORD_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // sem I, L, O, U
const RECOVERY_CODE_CHARS = 10;

/** Gera um código de recuperação legível (`XXXXX-XXXXX`). */
export function generateRecoveryCode(): string {
  const bytes = randomBytes(RECOVERY_CODE_CHARS);
  let code = "";
  for (let i = 0; i < RECOVERY_CODE_CHARS; i += 1) {
    code += CROCKFORD_ALPHABET[bytes[i]! % CROCKFORD_ALPHABET.length];
  }
  return `${code.slice(0, 5)}-${code.slice(5)}`;
}

/**
 * Normaliza o código digitado antes de comparar: maiúsculas, sem espaços nem
 * hífens. Torna a verificação tolerante ao formato que o usuário digitar
 * (com ou sem o hífen) sem afetar a entropia.
 */
export function normalizeRecoveryCode(input: string): string {
  return input.toUpperCase().replace(/[\s-]/gu, "");
}
