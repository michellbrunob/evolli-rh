import { randomBytes } from "node:crypto";
import { decryptAesGcm, encryptAesGcm } from "./aes-gcm-cipher.util";

describe("AES-256-GCM cipher", () => {
  const key = randomBytes(32);

  it("cifra e decifra corretamente", () => {
    const plaintext = Buffer.from("segredo-totp-de-teste", "utf8");
    const encrypted = encryptAesGcm(plaintext, key);
    const decrypted = decryptAesGcm(encrypted, key);
    expect(decrypted.toString("utf8")).toBe("segredo-totp-de-teste");
  });

  it("payload cifrado não contém o texto original em claro", () => {
    const secret = "IZJSUU2ECN4BIJBEXXXX";
    const encrypted = encryptAesGcm(Buffer.from(secret, "utf8"), key);
    expect(encrypted.toString("utf8")).not.toContain(secret);
    expect(encrypted.toString("base64")).not.toContain(
      Buffer.from(secret).toString("base64"),
    );
  });

  it("IV é aleatório — duas cifragens do mesmo texto produzem payloads diferentes", () => {
    const plaintext = Buffer.from("mesmo-texto", "utf8");
    const a = encryptAesGcm(plaintext, key);
    const b = encryptAesGcm(plaintext, key);
    expect(a.equals(b)).toBe(false);
  });

  it("rejeita chave de tamanho errado", () => {
    const badKey = randomBytes(16);
    expect(() => encryptAesGcm(Buffer.from("x"), badKey)).toThrow();
  });

  it("decrypt falha se o payload foi adulterado (authTag não bate)", () => {
    const encrypted = encryptAesGcm(Buffer.from("dado-integro"), key);
    const tampered = Buffer.from(encrypted);
    tampered[tampered.length - 1] = tampered[tampered.length - 1]! ^ 0xff;
    expect(() => decryptAesGcm(tampered, key)).toThrow();
  });

  it("decrypt falha com chave diferente da usada para cifrar", () => {
    const encrypted = encryptAesGcm(Buffer.from("dado"), key);
    const otherKey = randomBytes(32);
    expect(() => decryptAesGcm(encrypted, otherKey)).toThrow();
  });
});
