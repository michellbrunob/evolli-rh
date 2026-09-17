import { randomBytes } from "node:crypto";
import {
  loadTotpEncryptionKey,
  MFA_TOTP_KEY_CURRENT_VERSION,
  MFA_TOTP_KEY_ENV,
  TotpSecretCipher,
} from "./totp-secret-cipher";

const chaveValida = randomBytes(32).toString("base64");

function envCom(chave?: string): NodeJS.ProcessEnv {
  return chave === undefined ? {} : { [MFA_TOTP_KEY_ENV]: chave };
}

describe("loadTotpEncryptionKey — fail-closed", () => {
  it("lança quando a chave está ausente", () => {
    expect(() => loadTotpEncryptionKey(envCom())).toThrow();
  });

  it("lança quando o tamanho é inadequado (não 32 bytes)", () => {
    const curta = randomBytes(16).toString("base64");
    expect(() => loadTotpEncryptionKey(envCom(curta))).toThrow();
  });

  it("aceita uma chave Base64 de 32 bytes", () => {
    expect(loadTotpEncryptionKey(envCom(chaveValida)).length).toBe(32);
  });

  it("a mensagem de erro nunca contém o valor da chave", () => {
    const curta = randomBytes(16).toString("base64");
    try {
      loadTotpEncryptionKey(envCom(curta));
      throw new Error("deveria ter lançado");
    } catch (err) {
      expect((err as Error).message).not.toContain(curta);
    }
  });
});

describe("TotpSecretCipher (AES-256-GCM)", () => {
  it("cifra e decifra ida e volta (round-trip)", () => {
    const cipher = new TotpSecretCipher(envCom(chaveValida));
    const envelope = cipher.encrypt("GEZDGNBVGY3TQOJQ");
    expect(cipher.decrypt(envelope)).toBe("GEZDGNBVGY3TQOJQ");
  });

  it("nunca produz o mesmo ciphertext/IV para o mesmo texto (IV aleatório)", () => {
    const cipher = new TotpSecretCipher(envCom(chaveValida));
    const a = cipher.encrypt("mesmo-segredo");
    const b = cipher.encrypt("mesmo-segredo");
    expect(a.iv.equals(b.iv)).toBe(false);
    expect(a.ciphertext.equals(b.ciphertext)).toBe(false);
  });

  it("o ciphertext não contém o texto claro", () => {
    const cipher = new TotpSecretCipher(envCom(chaveValida));
    const envelope = cipher.encrypt("SEGREDOCLARO");
    expect(envelope.ciphertext.toString("utf8")).not.toContain("SEGREDOCLARO");
    expect(envelope.ciphertext.toString("latin1")).not.toContain(
      "SEGREDOCLARO",
    );
  });

  it("falha ao decifrar se o authTag foi adulterado (integridade GCM)", () => {
    const cipher = new TotpSecretCipher(envCom(chaveValida));
    const envelope = cipher.encrypt("GEZDGNBVGY3TQOJQ");
    const adulterado = { ...envelope, authTag: Buffer.from(envelope.authTag) };
    adulterado.authTag[0] = adulterado.authTag[0]! ^ 0xff;
    expect(() => cipher.decrypt(adulterado)).toThrow();
  });

  it("falha ao decifrar com keyVersion desconhecida (fail-closed)", () => {
    const cipher = new TotpSecretCipher(envCom(chaveValida));
    const envelope = cipher.encrypt("GEZDGNBVGY3TQOJQ");
    expect(() => cipher.decrypt({ ...envelope, keyVersion: 999 })).toThrow();
  });

  it("outra chave não decifra (confidencialidade)", () => {
    const cipherA = new TotpSecretCipher(envCom(chaveValida));
    const cipherB = new TotpSecretCipher(
      envCom(randomBytes(32).toString("base64")),
    );
    const envelope = cipherA.encrypt("GEZDGNBVGY3TQOJQ");
    expect(() => cipherB.decrypt(envelope)).toThrow();
  });

  it("selfTest confirma o round-trip com a chave configurada", () => {
    const cipher = new TotpSecretCipher(envCom(chaveValida));
    expect(cipher.selfTest()).toBe(true);
  });

  it("fail-closed no uso: sem chave, encrypt lança (não no construtor)", () => {
    const cipher = new TotpSecretCipher(envCom());
    expect(() => cipher.encrypt("x")).toThrow();
  });

  it("cifra com a versão de chave corrente", () => {
    const cipher = new TotpSecretCipher(envCom(chaveValida));
    expect(cipher.encrypt("x").keyVersion).toBe(MFA_TOTP_KEY_CURRENT_VERSION);
  });
});
