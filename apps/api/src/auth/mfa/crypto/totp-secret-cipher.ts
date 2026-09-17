import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

/**
 * Cifragem em repouso do segredo TOTP com AES-256-GCM (ADR 0003 decisão 7).
 *
 * A chave vive **exclusivamente** na variável de ambiente
 * `MFA_TOTP_ENCRYPTION_KEY` (Base64 de 32 bytes = 256 bits), fornecida pelo
 * cofre/plataforma — nunca no banco, log, resposta HTTP ou trilha de
 * auditoria (DS-SEC-01/DS-MFA-04). O `keyVersion` por registro permite
 * rotação futura sem downtime (T123): decifra com a versão do registro, cifra
 * com a corrente.
 *
 * **Fail-closed:** ausência, formato inválido ou tamanho incorreto da chave
 * lança na inicialização deste serviço; nenhuma operação de MFA prossegue sem
 * uma chave válida. Este serviço nunca loga o valor da chave nem o segredo.
 */

/** Nome da variável de ambiente que carrega a chave (só o NOME, nunca o valor). */
export const MFA_TOTP_KEY_ENV = "MFA_TOTP_ENCRYPTION_KEY";
const AES_256_KEY_BYTES = 32;
const GCM_IV_BYTES = 12; // 96 bits — recomendado para AES-GCM (NIST SP 800-38D).
const GCM_TAG_BYTES = 16;
/** Versão corrente de escrita. Registros antigos guardam a sua própria versão. */
export const MFA_TOTP_KEY_CURRENT_VERSION = 1;

export interface CipherEnvelope {
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
  keyVersion: number;
}

/**
 * Resolve e valida a chave a partir do ambiente. Exportada para o schema de
 * env poder falhar cedo em produção; lança mensagem genérica, **sem** incluir
 * o valor da chave.
 */
export function loadTotpEncryptionKey(
  env: NodeJS.ProcessEnv = process.env,
): Buffer {
  const raw = env[MFA_TOTP_KEY_ENV];
  if (typeof raw !== "string" || raw.length === 0) {
    throw new Error(
      `${MFA_TOTP_KEY_ENV} ausente: a chave de cifragem do segredo TOTP é obrigatória.`,
    );
  }
  let key: Buffer;
  try {
    key = Buffer.from(raw, "base64");
  } catch {
    throw new Error(`${MFA_TOTP_KEY_ENV} inválida: não é Base64.`);
  }
  if (key.length !== AES_256_KEY_BYTES) {
    throw new Error(
      `${MFA_TOTP_KEY_ENV} inválida: são necessários ${AES_256_KEY_BYTES} bytes (256 bits).`,
    );
  }
  return key;
}

export class TotpSecretCipher {
  private cachedKey: Buffer | null = null;

  /**
   * @param env fonte das variáveis de ambiente (injetável em teste).
   *
   * O construtor **não** carrega a chave: a API precisa subir em
   * desenvolvimento/teste mesmo sem `MFA_TOTP_ENCRYPTION_KEY` (MFA só é
   * exercido quando configurado). A chave é resolvida de forma preguiçosa no
   * primeiro uso — se estiver ausente/inválida, a operação de MFA falha de
   * modo seguro ali (fail-closed no uso), nunca liberando acesso sem fator.
   * Em produção, `env.validation.ts` já exige a chave no boot.
   */
  constructor(private readonly env: NodeJS.ProcessEnv = process.env) {}

  private key(): Buffer {
    if (this.cachedKey === null) {
      this.cachedKey = loadTotpEncryptionKey(this.env);
    }
    return this.cachedKey;
  }

  /** Cifra o segredo (Base32) → envelope, sempre com a versão corrente. */
  encrypt(plaintext: string): CipherEnvelope {
    const iv = randomBytes(GCM_IV_BYTES);
    const cipher = createCipheriv("aes-256-gcm", this.key(), iv);
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, "utf8"),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    return {
      ciphertext,
      iv,
      authTag,
      keyVersion: MFA_TOTP_KEY_CURRENT_VERSION,
    };
  }

  /**
   * Decifra o envelope. Fail-closed: `keyVersion` desconhecida, `authTag`
   * adulterado ou envelope corrompido lançam — nunca devolve texto parcial ou
   * silenciosamente "vazio".
   */
  decrypt(envelope: CipherEnvelope): string {
    if (envelope.keyVersion !== MFA_TOTP_KEY_CURRENT_VERSION) {
      throw new Error(
        `keyVersion desconhecida (${envelope.keyVersion}): não há chave para decifrar este registro.`,
      );
    }
    if (envelope.authTag.length !== GCM_TAG_BYTES) {
      throw new Error("authTag com tamanho inválido.");
    }
    const decipher = createDecipheriv("aes-256-gcm", this.key(), envelope.iv);
    decipher.setAuthTag(envelope.authTag);
    return Buffer.concat([
      decipher.update(envelope.ciphertext),
      decipher.final(),
    ]).toString("utf8");
  }

  /**
   * Prova de disponibilidade da chave, sem expor nada: cifra e decifra um
   * valor sintético e confirma o round-trip. Usado no boot/readiness
   * (fail-closed) para garantir que a chave configurada realmente funciona.
   */
  selfTest(): boolean {
    const amostra = "self-test-nao-secreto";
    const round = this.decrypt(this.encrypt(amostra));
    const a = Buffer.from(round, "utf8");
    const b = Buffer.from(amostra, "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
  }
}
