import {
  ConflictException,
  Injectable,
  UnauthorizedException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { AccessUser } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { AuditService } from "../../audit/audit.service";
import { SessionRequestMetadata } from "../session/session.service";
import { IssuedSession, SessionService } from "../session/session.service";
import { PasswordHashService } from "../password/password-hash.service";
import {
  generateOpaqueToken,
  hashOpaqueToken,
} from "../crypto/opaque-token.util";
import { TotpSecretCipher } from "./crypto/totp-secret-cipher";
import {
  buildOtpauthUri,
  generateTotpSecretBase32,
  verifyTotpCode,
} from "./crypto/totp.util";
import {
  generateRecoveryCode,
  normalizeRecoveryCode,
} from "./crypto/recovery-code.util";
import {
  MFA_CHALLENGE_TTL_MS,
  MFA_RECOVERY_CODE_COUNT,
  MFA_TOTP_ISSUER,
} from "./mfa.constants";

/** Material de provisionamento — entregue SÓ no início do cadastro. */
export interface EnrollmentMaterial {
  secretBase32: string;
  otpauthUri: string;
}

/** Tentativas de código por challenge antes de invalidá-lo (anti-brute-force
 * contido na própria linha do challenge — não é subsistema de rate limit). */
const MFA_CHALLENGE_MAX_ATTEMPTS = 5;

@Injectable()
export class MfaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cipher: TotpSecretCipher,
    private readonly passwordHashService: PasswordHashService,
    private readonly sessionService: SessionService,
    private readonly auditService: AuditService,
  ) {}

  /** Se a conta tem um fator TOTP ATIVO (decide se o login exige 2º fator). */
  async hasActiveTotp(userId: string): Promise<boolean> {
    const factor = await this.prisma.accessMfaTotp.findUnique({
      where: { userId },
      select: { status: true },
    });
    return factor?.status === "active";
  }

  /**
   * Inicia o cadastro (autenticado): gera um segredo novo, cifra-o em repouso
   * e o deixa como `pending`. Devolve o material de provisionamento — a ÚNICA
   * etapa em que o segredo/URI saem do servidor. Se já houver fator ativo,
   * recusa (é preciso reset administrativo antes de reconfigurar).
   */
  async startEnrollment(
    actor: AccessUser,
    metadata: SessionRequestMetadata,
  ): Promise<EnrollmentMaterial> {
    const existente = await this.prisma.accessMfaTotp.findUnique({
      where: { userId: actor.id },
      select: { status: true },
    });
    if (existente?.status === "active") {
      // Já configurado — reconfigurar exige reset (nunca sobrescreve em silêncio).
      throw new ConflictException();
    }

    const secretBase32 = generateTotpSecretBase32();
    const envelope = this.cipher.encrypt(secretBase32);

    await this.prisma.accessMfaTotp.upsert({
      where: { userId: actor.id },
      create: {
        userId: actor.id,
        status: "pending",
        secretCiphertext: envelope.ciphertext,
        secretIv: envelope.iv,
        secretAuthTag: envelope.authTag,
        keyVersion: envelope.keyVersion,
      },
      update: {
        status: "pending",
        secretCiphertext: envelope.ciphertext,
        secretIv: envelope.iv,
        secretAuthTag: envelope.authTag,
        keyVersion: envelope.keyVersion,
        confirmedAt: null,
      },
    });

    await this.auditService.record({
      actorType: "user",
      actorUserId: actor.id,
      actorRole: actor.role,
      companyId: actor.companyId,
      action: "mfa_enrollment_started",
      resource: "access_mfa",
      resourceId: actor.id,
      ip: metadata.ip,
      userAgent: metadata.userAgent,
      result: "success",
      requestId: metadata.requestId,
    });

    return {
      secretBase32,
      otpauthUri: buildOtpauthUri({
        secretBase32,
        accountName: actor.email,
        issuer: MFA_TOTP_ISSUER,
      }),
    };
  }

  /**
   * Confirma o cadastro: valida um código TOTP contra o segredo pendente e,
   * só então, ativa o fator e gera os 10 códigos de recuperação (exibidos uma
   * única vez). Nunca retorna o segredo. Tudo em uma transação.
   */
  async confirmEnrollment(
    actor: AccessUser,
    code: string,
    metadata: SessionRequestMetadata,
  ): Promise<{ recoveryCodes: string[] }> {
    const factor = await this.prisma.accessMfaTotp.findUnique({
      where: { userId: actor.id },
    });
    if (!factor || factor.status !== "pending") {
      // Sem cadastro em andamento — genérico, não distingue estados.
      throw new UnprocessableEntityException();
    }

    const secretBase32 = this.cipher.decrypt({
      ciphertext: factor.secretCiphertext,
      iv: factor.secretIv,
      authTag: factor.secretAuthTag,
      keyVersion: factor.keyVersion,
    });

    if (!verifyTotpCode(secretBase32, code)) {
      throw new UnprocessableEntityException();
    }

    const plainCodes = Array.from(
      { length: MFA_RECOVERY_CODE_COUNT },
      generateRecoveryCode,
    );
    const hashes = await Promise.all(
      plainCodes.map((c) =>
        this.passwordHashService.hash(normalizeRecoveryCode(c)),
      ),
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.accessMfaTotp.update({
        where: { userId: actor.id },
        data: { status: "active", confirmedAt: new Date() },
      });
      // Substitui qualquer código anterior por um lote novo de 10.
      await tx.accessMfaRecoveryCode.deleteMany({
        where: { userId: actor.id },
      });
      await tx.accessMfaRecoveryCode.createMany({
        data: hashes.map((codeHash) => ({ userId: actor.id, codeHash })),
      });
      await this.auditService.record(
        {
          actorType: "user",
          actorUserId: actor.id,
          actorRole: actor.role,
          companyId: actor.companyId,
          action: "mfa_confirmed",
          resource: "access_mfa",
          resourceId: actor.id,
          ip: metadata.ip,
          userAgent: metadata.userAgent,
          result: "success",
          requestId: metadata.requestId,
        },
        tx,
      );
    });

    return { recoveryCodes: plainCodes };
  }

  /**
   * Cria um challenge de login opaco (uso único, 5 min). Chamado quando a
   * senha está correta mas a conta tem MFA ativo — nenhuma sessão nasce ainda.
   * Retorna só o token bruto (o banco guarda apenas o hash).
   */
  async createLoginChallenge(
    userId: string,
    metadata: SessionRequestMetadata,
  ): Promise<string> {
    const token = generateOpaqueToken();
    await this.prisma.accessMfaChallenge.create({
      data: {
        userId,
        tokenHash: hashOpaqueToken(token),
        expiresAt: new Date(Date.now() + MFA_CHALLENGE_TTL_MS),
        ip: metadata.ip ?? null,
        userAgent: metadata.userAgent ?? null,
      },
    });
    return token;
  }

  /**
   * Verifica o 2º fator e, em caso de sucesso, consome o challenge e emite a
   * sessão plena — tudo em uma transação (challenge consumido e sessão criada
   * juntos, ou nada). Aceita código TOTP (±1 intervalo) ou código de
   * recuperação (uso único). Falhas nunca enumeram conta/fator/estado: sempre
   * `UnauthorizedException` genérica.
   */
  async completeMfaLogin(
    challengeToken: string,
    code: string,
    metadata: SessionRequestMetadata,
  ): Promise<IssuedSession> {
    const challenge = await this.prisma.accessMfaChallenge.findUnique({
      where: { tokenHash: hashOpaqueToken(challengeToken) },
      include: { user: true },
    });

    const now = new Date();
    if (
      !challenge ||
      challenge.consumedAt !== null ||
      challenge.expiresAt <= now
    ) {
      // Challenge inexistente, já usado ou expirado — genérico, sem auditar
      // por usuário (pode não haver um confiável).
      throw new UnauthorizedException();
    }

    const factor = await this.prisma.accessMfaTotp.findUnique({
      where: { userId: challenge.userId },
    });

    let ok = false;
    let usedRecovery = false;

    if (factor && factor.status === "active") {
      const secretBase32 = this.cipher.decrypt({
        ciphertext: factor.secretCiphertext,
        iv: factor.secretIv,
        authTag: factor.secretAuthTag,
        keyVersion: factor.keyVersion,
      });
      ok = verifyTotpCode(secretBase32, code);
    }

    let recoveryCodeId: string | null = null;
    if (!ok) {
      recoveryCodeId = await this.matchRecoveryCode(challenge.userId, code);
      if (recoveryCodeId) {
        ok = true;
        usedRecovery = true;
      }
    }

    if (!ok) {
      await this.registerFailedAttempt(challenge.id, challenge.attemptCount);
      await this.auditService.record({
        actorType: "user",
        actorUserId: challenge.user.id,
        actorRole: challenge.user.role,
        companyId: challenge.user.companyId,
        action: "mfa_challenge_failed",
        resource: "access_mfa",
        resourceId: challenge.user.id,
        ip: metadata.ip,
        userAgent: metadata.userAgent,
        result: "failure",
        requestId: metadata.requestId,
      });
      throw new UnauthorizedException();
    }

    const user = challenge.user;
    return this.prisma.$transaction(async (tx) => {
      // Consumo condicional (uso único, anti-replay): só um verificador
      // vence a corrida — se outro já consumiu, `count` volta 0 e abortamos.
      const consumed = await tx.accessMfaChallenge.updateMany({
        where: { id: challenge.id, consumedAt: null },
        data: { consumedAt: new Date() },
      });
      if (consumed.count !== 1) {
        throw new UnauthorizedException();
      }

      if (usedRecovery && recoveryCodeId) {
        await tx.accessMfaRecoveryCode.updateMany({
          where: { id: recoveryCodeId, usedAt: null },
          data: { usedAt: new Date() },
        });
        await this.auditService.record(
          {
            actorType: "user",
            actorUserId: user.id,
            actorRole: user.role,
            companyId: user.companyId,
            action: "mfa_recovery_code_used",
            resource: "access_mfa",
            resourceId: user.id,
            ip: metadata.ip,
            userAgent: metadata.userAgent,
            result: "success",
            requestId: metadata.requestId,
          },
          tx,
        );
      }

      const issued = await this.sessionService.issue(user.id, metadata, tx);
      await this.auditService.record(
        {
          actorType: "user",
          actorUserId: user.id,
          actorRole: user.role,
          companyId: user.companyId,
          action: "mfa_challenge_succeeded",
          resource: "access_mfa",
          resourceId: user.id,
          ip: metadata.ip,
          userAgent: metadata.userAgent,
          result: "success",
          requestId: metadata.requestId,
        },
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
          resourceId: issued.session.id,
          ip: metadata.ip,
          userAgent: metadata.userAgent,
          result: "success",
          requestId: metadata.requestId,
        },
        tx,
      );
      return issued;
    });
  }

  /**
   * Redefinição administrativa (T125): remove o fator, invalida challenges,
   * apaga os códigos de recuperação e revoga TODAS as sessões do alvo, numa
   * transação. Nunca lê nem expõe o segredo/códigos — só os destrói. A conta
   * fica obrigada a configurar MFA de novo. Autorização (só master_tecnico e
   * RH, escopo de empresa) é aplicada pelo `AuthorizationGuard` antes daqui.
   */
  async resetForUser(
    targetUser: AccessUser,
    actor: AccessUser,
    metadata: SessionRequestMetadata,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.accessMfaTotp.deleteMany({ where: { userId: targetUser.id } });
      await tx.accessMfaRecoveryCode.deleteMany({
        where: { userId: targetUser.id },
      });
      await tx.accessMfaChallenge.updateMany({
        where: { userId: targetUser.id, consumedAt: null },
        data: { consumedAt: new Date() },
      });
      await this.sessionService.revokeAllForUser(
        targetUser.id,
        "mfa_reset_by_admin",
        undefined,
        tx,
      );
      await this.auditService.record(
        {
          actorType: "user",
          actorUserId: actor.id,
          actorRole: actor.role,
          companyId: actor.companyId,
          action: "mfa_reset_by_admin",
          resource: "access_mfa",
          resourceId: targetUser.id,
          ip: metadata.ip,
          userAgent: metadata.userAgent,
          result: "success",
          requestId: metadata.requestId,
        },
        tx,
      );
    });
  }

  /**
   * Compara o código contra os códigos de recuperação não usados do usuário
   * (Argon2id). Retorna o id do código que casou, ou null. Percorre todos os
   * candidatos mesmo após um acerto para não vazar por timing quantos existem.
   */
  private async matchRecoveryCode(
    userId: string,
    code: string,
  ): Promise<string | null> {
    const normalized = normalizeRecoveryCode(code);
    const candidates = await this.prisma.accessMfaRecoveryCode.findMany({
      where: { userId, usedAt: null },
    });
    let matchedId: string | null = null;
    for (const candidate of candidates) {
      const isMatch = await this.passwordHashService.verify(
        candidate.codeHash,
        normalized,
      );
      if (isMatch && matchedId === null) {
        matchedId = candidate.id;
      }
    }
    return matchedId;
  }

  /**
   * Incrementa o contador de tentativas do challenge; ao atingir o teto,
   * invalida-o (o usuário reinicia o login). Contido na própria linha do
   * challenge — não é subsistema de rate limit.
   */
  private async registerFailedAttempt(
    challengeId: string,
    currentAttempts: number,
  ): Promise<void> {
    const next = currentAttempts + 1;
    await this.prisma.accessMfaChallenge.updateMany({
      where: { id: challengeId, consumedAt: null },
      data: {
        attemptCount: next,
        ...(next >= MFA_CHALLENGE_MAX_ATTEMPTS
          ? { consumedAt: new Date() }
          : {}),
      },
    });
  }
}
