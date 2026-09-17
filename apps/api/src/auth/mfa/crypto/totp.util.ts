import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * TOTP (RFC 6238) sobre HOTP (RFC 4226), compatível com Google Authenticator,
 * Microsoft Authenticator e apps equivalentes: HMAC-SHA1, período de 30s,
 * 6 dígitos, segredo em Base32 (RFC 4648).
 *
 * Implementado diretamente sobre `node:crypto` — a biblioteca criptográfica
 * consolidada da plataforma (mesmo critério de `crypto/opaque-token.util.ts`,
 * que usa `node:crypto` puro em vez de uma dependência de terceiros). O
 * algoritmo é curto, determinístico e verificável contra os vetores oficiais
 * do RFC 4226/6238 (ver `totp.util.spec.ts`), o que dá mais garantia de
 * correção do que embutir uma dependência externa cuja API precisaríamos
 * dominar. Nenhum segredo aqui é logado, retornado após a confirmação, nem
 * persistido em claro — a persistência é sempre do ciphertext AES-256-GCM
 * (ver `totp-secret-cipher.ts`).
 */

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export const TOTP_PERIOD_SECONDS = 30;
export const TOTP_DIGITS = 6;
/** Tolerância de ±1 intervalo (T125): aceita o passo anterior, o atual e o próximo. */
export const TOTP_WINDOW_STEPS = 1;
/** 20 bytes = 160 bits — recomendação do RFC 4226 §4 para o segredo HOTP/TOTP. */
const TOTP_SECRET_BYTES = 20;

/** Gera um segredo TOTP novo, já em Base32 (formato que o app autenticador lê). */
export function generateTotpSecretBase32(): string {
  return base32Encode(randomBytes(TOTP_SECRET_BYTES));
}

/** Base32 (RFC 4648, alfabeto padrão, sem padding) — formato dos apps TOTP. */
export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

/**
 * Decodifica Base32 → bytes. Lança em qualquer caractere fora do alfabeto —
 * um segredo malformado nunca é tratado como "vazio válido".
 */
export function base32Decode(input: string): Buffer {
  const normalized = input
    .replace(/=+$/u, "")
    .toUpperCase()
    .replace(/\s/gu, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of normalized) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) {
      throw new Error("Segredo TOTP com caractere Base32 inválido.");
    }
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** Contador HOTP para o instante dado (RFC 6238: floor(epoch_s / período)). */
export function totpCounterForEpoch(epochMs: number): number {
  return Math.floor(epochMs / 1000 / TOTP_PERIOD_SECONDS);
}

/** HOTP (RFC 4226): código de `TOTP_DIGITS` dígitos para um contador. */
export function hotpCode(secretBase32: string, counter: number): string {
  const key = base32Decode(secretBase32);
  const counterBuffer = Buffer.alloc(8);
  // Contador de 64 bits big-endian. `writeBigUInt64BE` evita perda de
  // precisão em contadores grandes (datas distantes).
  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const digest = createHmac("sha1", key).update(counterBuffer).digest();
  // Truncamento dinâmico (RFC 4226 §5.3).
  const offset = digest[digest.length - 1]! & 0x0f;
  const binary =
    ((digest[offset]! & 0x7f) << 24) |
    ((digest[offset + 1]! & 0xff) << 16) |
    ((digest[offset + 2]! & 0xff) << 8) |
    (digest[offset + 3]! & 0xff);

  return (binary % 10 ** TOTP_DIGITS).toString().padStart(TOTP_DIGITS, "0");
}

/** Gera o código TOTP corrente (usado só em teste; produção nunca "gera" código do usuário). */
export function totpCodeForEpoch(
  secretBase32: string,
  epochMs: number,
): string {
  return hotpCode(secretBase32, totpCounterForEpoch(epochMs));
}

/**
 * Verifica um código TOTP com tolerância de ±`TOTP_WINDOW_STEPS` intervalos.
 * Comparação em tempo constante por passo (não vaza qual passo casou por
 * timing). Rejeita comprimento/dígitos inválidos sem lançar.
 */
export function verifyTotpCode(
  secretBase32: string,
  code: string,
  epochMs: number = Date.now(),
  windowSteps: number = TOTP_WINDOW_STEPS,
): boolean {
  if (!/^\d{6}$/u.test(code)) {
    return false;
  }
  const centro = totpCounterForEpoch(epochMs);
  let casou = false;
  // Percorre TODOS os passos da janela mesmo após um acerto — evita que o
  // tempo de resposta revele em qual passo o código bateu.
  for (let delta = -windowSteps; delta <= windowSteps; delta += 1) {
    const esperado = hotpCode(secretBase32, centro + delta);
    if (constantTimeEquals(esperado, code)) {
      casou = true;
    }
  }
  return casou;
}

function constantTimeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) {
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

/**
 * Monta o `otpauth://totp/...` URI de provisionamento (o app autenticador o lê,
 * normalmente via QR). Emitido SÓ na etapa controlada de cadastro; nunca
 * persistido nem re-exibido depois da confirmação.
 */
export function buildOtpauthUri(params: {
  secretBase32: string;
  accountName: string;
  issuer: string;
}): string {
  const label = encodeURIComponent(`${params.issuer}:${params.accountName}`);
  const query = new URLSearchParams({
    secret: params.secretBase32,
    issuer: params.issuer,
    algorithm: "SHA1",
    digits: String(TOTP_DIGITS),
    period: String(TOTP_PERIOD_SECONDS),
  });
  return `otpauth://totp/${label}?${query.toString()}`;
}
