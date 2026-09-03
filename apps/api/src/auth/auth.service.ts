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
import { AuditService } from "../audit/audit.service";

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
    private readonly auditService: AuditService,
  ) {}

  async login(
    email: string,
    password: string,
    metadata: SessionRequestMetadata,
  ): Promise<IssuedSession> {
    await this.rateLimitService.assertNotRateLimited(
      email,
      metadata.ip,
      metadata.requestId,
    );

    const result = await this.credentialVerifier.verify(email, password);
    await this.rateLimitService.recordAttempt(
      email,
      metadata.ip,
      result.outcome === "valid",
    );

    if (result.outcome !== "valid" || !result.user) {
      // Best-effort (ADR 0004 §2) — falha ao auditar nunca muda a negação.
      await this.auditService.record(
        result.user
          ? {
              actorType: "user",
              actorUserId: result.user.id,
              actorRole: result.user.role,
              companyId: result.user.companyId,
              action: "login_failed",
              resource: "access_user",
              resourceId: result.user.id,
              ip: metadata.ip,
              userAgent: metadata.userAgent,
              result: "failure",
              requestId: metadata.requestId,
            }
          : {
              actorType: "system",
              actorSystemId: "auth-service:login",
              action: "login_failed",
              resource: "access_user",
              resourceId: null,
              ip: metadata.ip,
              userAgent: metadata.userAgent,
              result: "failure",
              requestId: metadata.requestId,
            },
      );

      // Mesma resposta para credencial errada, conta inexistente,
      // desativada ou bloqueada — evita enumeração (spec §6).
      throw new UnauthorizedException();
    }

    const user = result.user;

    // Ação sensível bem-sucedida: emissão da sessão e evento de auditoria
    // na mesma transação (ADR 0004 §2) — ou os dois persistem, ou nenhum.
    // O cookie só é emitido pelo controller depois que este método retorna,
    // ou seja, só depois do commit — nunca antes.
    const issued = await this.prisma.$transaction(async (tx) => {
      const issuedSession = await this.sessionService.issue(
        user.id,
        metadata,
        tx,
      );
      await this.auditService.record(
        {
          actorType: "user",
          actorUserId: user.id,
          actorRole: user.role,
          companyId: user.companyId,
          action: "login_succeeded",
          resource: "access_session",
          resourceId: issuedSession.session.id,
          ip: metadata.ip,
          userAgent: metadata.userAgent,
          result: "success",
          requestId: metadata.requestId,
        },
        tx,
      );
      return issuedSession;
    });

    return issued;
  }

  async requestPasswordReset(
    email: string,
    metadata: SessionRequestMetadata,
  ): Promise<void> {
    const normalized = normalizeEmail(email);
    // Limite ESPECÍFICO de recuperação de senha: conta toda solicitação da
    // janela (e-mail normalizado + IP), não só as "falhadas". Se reutilizasse
    // `assertNotRateLimited` (regra de falha de login), o disparo do fluxo —
    // que sempre grava tentativa "bem-sucedida" — nunca contaria, deixando o
    // endpoint público sem limite efetivo.
    await this.rateLimitService.assertRequestRateNotExceeded(
      `reset:${normalized}`,
      metadata.ip,
      metadata.requestId,
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

    // Sempre grava a tentativa (uma por solicitação) — o limite de disparo do
    // fluxo (`assertRequestRateNotExceeded`) conta TODAS as solicitações da
    // janela, não só falhas, então cada requisição conta independentemente de
    // existir conta, enviar e-mail ou o fluxo ser tratado como bem-sucedido. A
    // resposta pública segue uniforme, exista ou não o e-mail — evita
    // enumeração (spec §6).
    await this.rateLimitService.recordAttempt(
      `reset:${normalized}`,
      metadata.ip,
      true,
    );

    // Resultado sempre "success" na auditoria também — o próprio ato de
    // solicitar (não a existência do e-mail) é o que se audita, mesma
    // proteção anti-enumeração da resposta HTTP (spec §6).
    await this.auditService.record(
      user
        ? {
            actorType: "user",
            actorUserId: user.id,
            actorRole: user.role,
            companyId: user.companyId,
            action: "password_reset_requested",
            resource: "access_user",
            resourceId: user.id,
            ip: metadata.ip,
            userAgent: metadata.userAgent,
            result: "success",
            requestId: metadata.requestId,
          }
        : {
            actorType: "system",
            actorSystemId: "auth-service:password-reset",
            action: "password_reset_requested",
            resource: "access_user",
            resourceId: null,
            ip: metadata.ip,
            userAgent: metadata.userAgent,
            result: "success",
            requestId: metadata.requestId,
          },
    );
  }

  async resetPassword(
    token: string,
    newPassword: string,
    metadata: SessionRequestMetadata,
  ): Promise<void> {
    await this.rateLimitService.assertNotRateLimited(
      `pwreset-attempt:${metadata.ip ?? "unknown"}`,
      metadata.ip,
      metadata.requestId,
    );

    if (!this.passwordPolicyService.isValid(newPassword)) {
      await this.rateLimitService.recordAttempt(
        `pwreset-attempt:${metadata.ip ?? "unknown"}`,
        metadata.ip,
        false,
      );
      await this.auditFailedResetCompletion(metadata);
      throw new UnprocessableEntityException();
    }

    const tokenHash = hashOpaqueToken(token);
    const resetToken = await this.prisma.accessPasswordResetToken.findFirst({
      where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
      include: { user: true },
    });

    if (!resetToken) {
      await this.rateLimitService.recordAttempt(
        `pwreset-attempt:${metadata.ip ?? "unknown"}`,
        metadata.ip,
        false,
      );
      await this.auditFailedResetCompletion(metadata);
      throw new BadRequestException();
    }

    await this.rateLimitService.recordAttempt(
      `pwreset-attempt:${metadata.ip ?? "unknown"}`,
      metadata.ip,
      true,
    );

    const passwordHash = await this.passwordHashService.hash(newPassword);

    // Ação sensível bem-sucedida: senha, consumo do token, revogação de
    // TODAS as sessões ativas e os dois eventos correspondentes
    // (password_reset_completed, session_revoked) na mesma transação
    // (ADR 0004 §2) — ou tudo persiste, ou nada.
    await this.prisma.$transaction(async (tx) => {
      await tx.accessUser.update({
        where: { id: resetToken.userId },
        data: { passwordHash },
      });
      await tx.accessPasswordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      });
      await this.auditService.record(
        {
          actorType: "user",
          actorUserId: resetToken.user.id,
          actorRole: resetToken.user.role,
          companyId: resetToken.user.companyId,
          action: "password_reset_completed",
          resource: "access_user",
          resourceId: resetToken.userId,
          ip: metadata.ip,
          userAgent: metadata.userAgent,
          result: "success",
          requestId: metadata.requestId,
        },
        tx,
      );

      await this.sessionService.revokeAllForUser(
        resetToken.userId,
        "password_reset",
        undefined,
        tx,
      );
      await this.auditService.record(
        {
          actorType: "user",
          actorUserId: resetToken.user.id,
          actorRole: resetToken.user.role,
          companyId: resetToken.user.companyId,
          action: "session_revoked",
          resource: "access_session",
          resourceId: resetToken.userId,
          ip: metadata.ip,
          userAgent: metadata.userAgent,
          result: "success",
          requestId: metadata.requestId,
        },
        tx,
      );
    });
  }

  private async auditFailedResetCompletion(
    metadata: SessionRequestMetadata,
  ): Promise<void> {
    await this.auditService.record({
      actorType: "system",
      actorSystemId: "auth-service:password-reset",
      action: "password_reset_completed",
      resource: "access_password_reset_token",
      resourceId: null,
      ip: metadata.ip,
      userAgent: metadata.userAgent,
      result: "failure",
      requestId: metadata.requestId,
    });
  }
}
