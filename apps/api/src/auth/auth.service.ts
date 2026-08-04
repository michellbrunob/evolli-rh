import {
  BadRequestException,
  Inject,
  Injectable,
  UnauthorizedException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { PasswordHashService } from "./password/password-hash.service";
import { PasswordPolicyService } from "./password/password-policy.service";
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

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CREDENTIAL_VERIFIER)
    private readonly credentialVerifier: CredentialVerifier,
    private readonly rateLimitService: RateLimitService,
    private readonly sessionService: SessionService,
    private readonly passwordHashService: PasswordHashService,
    private readonly passwordPolicyService: PasswordPolicyService,
    @Inject(EMAIL_NOTIFIER) private readonly emailNotifier: EmailNotifier,
  ) {}

  async login(
    email: string,
    password: string,
    metadata: SessionRequestMetadata,
  ): Promise<IssuedSession> {
    await this.rateLimitService.assertNotRateLimited(email, metadata.ip);

    const result = await this.credentialVerifier.verify(email, password);
    await this.rateLimitService.recordAttempt(
      email,
      metadata.ip,
      result.outcome === "valid",
    );

    if (result.outcome !== "valid" || !result.user) {
      // Mesma resposta para credencial errada, conta inexistente,
      // desativada ou bloqueada — evita enumeração (spec §6).
      throw new UnauthorizedException();
    }

    return this.sessionService.issue(result.user.id, metadata);
  }

  async requestPasswordReset(email: string, ip: string | null): Promise<void> {
    const normalized = normalizeEmail(email);
    await this.rateLimitService.assertNotRateLimited(`reset:${normalized}`, ip);

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
    await this.rateLimitService.recordAttempt(`reset:${normalized}`, ip, true);
  }

  async resetPassword(
    token: string,
    newPassword: string,
    ip: string | null,
  ): Promise<void> {
    await this.rateLimitService.assertNotRateLimited(
      `pwreset-attempt:${ip ?? "unknown"}`,
      ip,
    );

    if (!this.passwordPolicyService.isValid(newPassword)) {
      await this.rateLimitService.recordAttempt(
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
      await this.rateLimitService.recordAttempt(
        `pwreset-attempt:${ip ?? "unknown"}`,
        ip,
        false,
      );
      throw new BadRequestException();
    }

    await this.rateLimitService.recordAttempt(
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
}
