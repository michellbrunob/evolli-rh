import { createHmac, timingSafeEqual } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export type MfaChallengePurpose = "mfa_enroll" | "mfa_verify";

export interface MfaChallengePayload {
  sub: string; // access_user.id
  purpose: MfaChallengePurpose;
  exp: number; // epoch seconds
}

const CHALLENGE_TTL_SECONDS = 5 * 60;
// Contexto fixo de derivação — deriva uma chave própria a partir de
// MFA_ENCRYPTION_KEY em vez de exigir um segredo novo só para este bridging
// token entre login e conclusão de MFA (mantém a superfície de segredo
// exigida igual à aprovada na spec).
const DERIVATION_CONTEXT = "evolli-rh:mfa-challenge:v1";

/**
 * Token stateless (assinado por HMAC-SHA256) que liga POST /auth/login (ou
 * /auth/mfa/enroll) à conclusão do desafio MFA, sem precisar de tabela nova.
 * Nunca concede sessão por si só — só autoriza chamar o próximo passo do
 * fluxo de MFA para o mesmo usuário, por até 5 minutos.
 */
@Injectable()
export class MfaChallengeService {
  private readonly derivedKey: Buffer;

  constructor(configService: ConfigService) {
    const masterKey = Buffer.from(
      configService.getOrThrow<string>("MFA_ENCRYPTION_KEY"),
      "base64",
    );
    this.derivedKey = createHmac("sha256", masterKey)
      .update(DERIVATION_CONTEXT)
      .digest();
  }

  issue(userId: string, purpose: MfaChallengePurpose): string {
    const payload: MfaChallengePayload = {
      sub: userId,
      purpose,
      exp: Math.floor(Date.now() / 1000) + CHALLENGE_TTL_SECONDS,
    };
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString(
      "base64url",
    );
    const signature = this.sign(payloadB64);
    return `${payloadB64}.${signature}`;
  }

  /** Retorna o payload só se assinatura, expiração e propósito baterem. */
  verify(
    token: string,
    expectedPurpose: MfaChallengePurpose,
  ): MfaChallengePayload | null {
    const parts = token.split(".");
    if (parts.length !== 2) {
      return null;
    }
    const [payloadB64, signature] = parts as [string, string];

    const expectedSignature = this.sign(payloadB64);
    if (!this.safeEqual(signature, expectedSignature)) {
      return null;
    }

    let payload: MfaChallengePayload;
    try {
      payload = JSON.parse(
        Buffer.from(payloadB64, "base64url").toString("utf8"),
      );
    } catch {
      return null;
    }

    if (payload.purpose !== expectedPurpose) {
      return null;
    }
    if (
      typeof payload.exp !== "number" ||
      payload.exp < Math.floor(Date.now() / 1000)
    ) {
      return null;
    }

    return payload;
  }

  private sign(payloadB64: string): string {
    return createHmac("sha256", this.derivedKey)
      .update(payloadB64)
      .digest("base64url");
  }

  private safeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) {
      return false;
    }
    return timingSafeEqual(bufA, bufB);
  }
}
