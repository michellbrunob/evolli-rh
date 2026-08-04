import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const KEY_BYTES = 32;

/**
 * Cifra AES-256-GCM com chave externa ao banco (ADR 0003 §7). O resultado é
 * um único buffer `iv (12) || authTag (16) || ciphertext`, persistido em uma
 * coluna `bytea` — evita colunas extras só para IV/tag.
 */
export function encryptAesGcm(plaintext: Buffer, key: Buffer): Buffer {
  assertKeyLength(key);

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, authTag, ciphertext]);
}

export function decryptAesGcm(payload: Buffer, key: Buffer): Buffer {
  assertKeyLength(key);

  if (payload.length < IV_BYTES + AUTH_TAG_BYTES) {
    throw new Error("Payload cifrado inválido: tamanho insuficiente.");
  }

  const iv = payload.subarray(0, IV_BYTES);
  const authTag = payload.subarray(IV_BYTES, IV_BYTES + AUTH_TAG_BYTES);
  const ciphertext = payload.subarray(IV_BYTES + AUTH_TAG_BYTES);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

function assertKeyLength(key: Buffer): void {
  if (key.length !== KEY_BYTES) {
    throw new Error(
      `Chave de cifragem AES-256-GCM deve ter ${KEY_BYTES} bytes.`,
    );
  }
}
