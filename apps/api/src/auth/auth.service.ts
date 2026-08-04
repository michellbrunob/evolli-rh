import {
  BadRequestException,
  Inject,
  Injectable,
  UnauthorizedException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { AccessUser } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import { PasswordHashService } from "./password/password-hash.service";
import { PasswordPolicyService } from "./password/password-policy.service";
import { TotpService } from "./mfa/totp.service";
import { MfaSecretCipherService } from "./mfa/mfa-secret-cipher.service";
import { RecoveryCodeService } from "./mfa/recovery-code.service";
import {
  MfaChallengePayload,
  MfaChallengeService,
} from "./mfa/mfa-challenge.service";
import {
  IssuedSession,
  SessionRequestMetadata,
  SessionService,
} from "./session/session.service";
import { RateLimitService } from "./rate-limit/rate-limit.service";
import {
  CREDENTIAL_VERIFIER,
  CredentialVerifier,
} from "./credential/credential-verifier.interface";
import {
  EMAIL_NOTIFIER,
  EmailNotifier,
} from "./email/email-notifier.interface";
import {
  generateOpaqueToken,
  hashOpaqueToken,
} from "./crypto/opaque-token.util";
import { normalizeEmail } from "./normalize-email.util";

const PASSWORD_RESET_TOKEN_TTL_MS = 20 * 60 * 1000; // 20 min (janela §4: 15–30 min)

export type LoginOutcome =
  | { status: "mfa_enrollment_required"; challengeToken: string }
  | { status: "mfa_verification_required"; challengeToken: string };

export interface MfaCompletionResult {
  issuedSession: IssuedSession;
  recoveryCodes?: string[];
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CREDENTIAL_VERIFIER)
    private readonly credentialVerifier: CredentialVerifier,
    private readonly rateLimitService: RateLimitService,
    private readonly mfaChallengeService: MfaChallengeService,
    private readonly totpService: TotpService,
    private readonly mfaSecretCipher: MfaSecretCipherService,
    private readonly recoveryCodeService: RecoveryCodeService,
    private readonly sessionService: SessionService,
    private readonly passwordHashService: PasswordHashService,
    private readonly passwordPolicyService: PasswordPolicyService,
    @Inject(EMAIL_NOTIFIER) private readonly emailNotifier: EmailNotifier,
  ) {}

  async login(
    email: string,
    password: string,
    ip: string | null,
  ): Promise<LoginOutcome> {
    await this.rateLimitService.assertLoginNotRateLimited(email, ip);

    const result = await this.credentialVerifier.verify(email, password);
    await this.rateLimitService.recordLoginAttempt(
      email,
      ip,
      result.outcome === "valid",
    );

    if (result.outcome !== "valid" || !result.user) {
      // Mesma resposta para credencial errada, conta inexistente,
      // desativada ou bloqueada — evita enumeração (spec §6).
      throw new UnauthorizedException();
    }

    const user = result.user;
    if (!user.mfaEnabled) {
      return {
        status: "mfa_enrollment_required",
        challengeToken: this.mfaChallengeService.issue(user.id, "mfa_enroll"),
      };
    }

    return {
      status: "mfa_verification_required",
      challengeToken: this.mfaChallengeService.issue(user.id, "mfa_verify"),
    };
  }

  async startMfaEnrollment(
    challengeToken: string,
  ): Promise<{ otpauthUri: string; challengeToken: string }> {
    const payload = this.requireChallenge(challengeToken, "mfa_enroll");
    const user = await this.requireUserById(payload.sub);

    const secret = this.totpService.generateSecret();
    const encrypted = this.mfaSecretCipher.encrypt(secret);

    await this.prisma.accessUser.update({
      where: { id: user.id },
      data: { mfaSecretEncrypted: encrypted },
    });

    return {
      otpauthUri: this.totpService.buildOtpAuthUri(user.email, secret),
      challengeToken: this.mfaChallengeService.issue(user.id, "mfa_enroll"),
    };
  }

  async confirmMfaEnrollment(
    challengeToken: string,
    code: string,
    metadata: SessionRequestMetadata,
  ): Promise<MfaCompletionResult> {
    const payload = this.requireChallenge(challengeToken, "mfa_enroll");
    const user = await this.requireUserById(payload.sub);

    await this.rateLimitService.assertMfaNotRateLimited(
      user.email,
      metadata.ip,
    );

    if (!user.mfaSecretEncrypted) {
      throw new UnauthorizedException();
    }

    const secret = this.mfaSecretCipher.decrypt(user.mfaSecretEncrypted);
    const valid = this.totpService.verify(code, secret);
    await this.rateLimitService.recordMfaAttempt(
      user.email,
      metadata.ip,
      valid,
    );

    if (!valid) {
      throw new UnauthorizedException();
    }

    const recoveryCodes = this.recoveryCodeService.generateCodes();
    // Hash (Argon2id, assíncrono) precisa terminar ANTES de montar as
    // chamadas do $transaction — passar uma Promise já resolvida (await
    // solto) para $transaction executaria fora da transação.
    const recoveryCodeHashes = await Promise.all(
      recoveryCodes.map((code) => this.recoveryCodeService.hashCode(code)),
    );

    await this.prisma.$transaction([
      this.prisma.accessUser.update({
        where: { id: user.id },
        data: { mfaEnabled: true },
      }),
      ...recoveryCodeHashes.map((codeHash) =>
        this.prisma.accessMfaRecoveryCode.create({
          data: { userId: user.id, codeHash },
        }),
      ),
    ]);

    const issuedSession = await this.sessionService.issue(user.id, metadata);
    return { issuedSession, recoveryCodes };
  }

  async verifyMfa(
    challengeToken: string,
    code: string,
    metadata: SessionRequestMetadata,
  ): Promise<MfaCompletionResult> {
    const payload = this.requireChallenge(challengeToken, "mfa_verify");
    const user = await this.requireUserById(payload.sub);

    await this.rateLimitService.assertMfaNotRateLimited(
      user.email,
      metadata.ip,
    );

    if (!user.mfaSecretEncrypted) {
      throw new UnauthorizedException();
    }

    const secret = this.mfaSecretCipher.decrypt(user.mfaSecretEncrypted);
    const valid = this.totpService.verify(code, secret);
    await this.rateLimitService.recordMfaAttempt(
      user.email,
      metadata.ip,
      valid,
    );

    if (!valid) {
      throw new UnauthorizedException();
    }

    const issuedSession = await this.sessionService.issue(user.id, metadata);
    return { issuedSession };
  }

  /** Reset de MFA de terceiro — sempre reautentica do zero no próximo login. */
  async resetMfaForUser(targetUserId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.accessUser.update({
        where: { id: targetUserId },
        data: { mfaEnabled: false, mfaSecretEncrypted: null },
      }),
      this.prisma.accessMfaRecoveryCode.deleteMany({
        where: { userId: targetUserId },
      }),
    ]);
    await this.sessionService.revokeAllForUser(
      targetUserId,
      "mfa_reset_by_admin",
    );
  }

  async requestPasswordReset(email: string, ip: string | null): Promise<void> {
    const normalized = normalizeEmail(email);
    await this.rateLimitService.assertLoginNotRateLimited(
      `reset:${normalized}`,
      ip,
    );

    const user = await this.prisma.accessUser.findUnique({
      where: { email: normalized },
    });

    if (user) {
      const token = generateOpaqueToken();
      await this.prisma.accessPasswordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hashOpaqueToken(token),
          expiresAt: new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS),
        },
      });
      await this.emailNotifier.notifyPasswordResetRequested(user.email, token);
    }

    // Sempre grava tentativa "bem-sucedida" (não é rate limit de força
    // bruta de senha, é limite de disparo do fluxo) e sempre retorna igual,
    // exista ou não o e-mail — evita enumeração (spec §6).
    await this.rateLimitService.recordLoginAttempt(
      `reset:${normalized}`,
      ip,
      true,
    );
  }

  async resetPassword(
    token: string,
    newPassword: string,
    ip: string | null,
  ): Promise<void> {
    await this.rateLimitService.assertLoginNotRateLimited(
      `pwreset-attempt:${ip ?? "unknown"}`,
      ip,
    );

    if (!this.passwordPolicyService.isValid(newPassword)) {
      await this.rateLimitService.recordLoginAttempt(
        `pwreset-attempt:${ip ?? "unknown"}`,
        ip,
        false,
      );
      throw new UnprocessableEntityException();
    }

    const tokenHash = hashOpaqueToken(token);
    const resetToken = await this.prisma.accessPasswordResetToken.findFirst({
      where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
    });

    if (!resetToken) {
      await this.rateLimitService.recordLoginAttempt(
        `pwreset-attempt:${ip ?? "unknown"}`,
        ip,
        false,
      );
      throw new BadRequestException();
    }

    await this.rateLimitService.recordLoginAttempt(
      `pwreset-attempt:${ip ?? "unknown"}`,
      ip,
      true,
    );

    const passwordHash = await this.passwordHashService.hash(newPassword);

    await this.prisma.$transaction([
      this.prisma.accessUser.update({
        where: { id: resetToken.userId },
        data: { passwordHash },
      }),
      this.prisma.accessPasswordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
    ]);

    await this.sessionService.revokeAllForUser(
      resetToken.userId,
      "password_reset",
    );
  }

  private requireChallenge(
    token: string,
    purpose: "mfa_enroll" | "mfa_verify",
  ): MfaChallengePayload {
    const payload = this.mfaChallengeService.verify(token, purpose);
    if (!payload) {
      throw new UnauthorizedException();
    }
    return payload;
  }

  private async requireUserById(userId: string): Promise<AccessUser> {
    const user = await this.prisma.accessUser.findUnique({
      where: { id: userId },
    });
    if (!user || user.status !== "active") {
      throw new UnauthorizedException();
    }
    return user;
  }
}
