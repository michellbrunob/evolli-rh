import { Injectable, UnprocessableEntityException } from "@nestjs/common";
import { AccessRole, AccessUser } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import { PasswordHashService } from "../auth/password/password-hash.service";
import { PasswordPolicyService } from "../auth/password/password-policy.service";
import {
  SessionRequestMetadata,
  SessionService,
} from "../auth/session/session.service";
import { normalizeEmail } from "../auth/normalize-email.util";
import { toSafeUser, SafeAccessUser } from "../auth/safe-user.util";
import { AuditService } from "../audit/audit.service";

export interface CreateUserInput {
  email: string;
  password: string;
  role: AccessRole;
  companyId?: string;
  unitId?: string;
  teamId?: string;
}

/** Ator + contexto de requisição para a trilha de auditoria (ADR 0004). */
export interface AuditActorContext {
  actor: AccessUser;
  metadata: SessionRequestMetadata;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordHashService: PasswordHashService,
    private readonly passwordPolicyService: PasswordPolicyService,
    private readonly sessionService: SessionService,
    private readonly auditService: AuditService,
  ) {}

  async createUser(
    input: CreateUserInput,
    auditCtx: AuditActorContext,
  ): Promise<SafeAccessUser> {
    // Autorização já aplicada pelo AuthorizationGuard (RequirePermission
    // "user_role"/"create") antes deste método rodar.
    if (!this.passwordPolicyService.isValid(input.password)) {
      throw new UnprocessableEntityException();
    }

    const passwordHash = await this.passwordHashService.hash(input.password);

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.accessUser.create({
        data: {
          email: normalizeEmail(input.email),
          passwordHash,
          role: input.role,
          companyId: input.companyId ?? null,
          unitId: input.unitId ?? null,
          teamId: input.teamId ?? null,
        },
      });

      // Ação sensível bem-sucedida: alteração e evento de auditoria na
      // mesma transação (ADR 0004 §2).
      await this.auditService.record(
        {
          actorType: "user",
          actorUserId: auditCtx.actor.id,
          actorRole: auditCtx.actor.role,
          companyId: auditCtx.actor.companyId,
          action: "user_created",
          resource: "access_user",
          resourceId: created.id,
          ip: auditCtx.metadata.ip,
          userAgent: auditCtx.metadata.userAgent,
          result: "success",
          requestId: auditCtx.metadata.requestId,
        },
        tx,
      );

      return created;
    });

    return toSafeUser(user);
  }

  async updateRole(
    targetUserId: string,
    role: AccessRole,
    auditCtx: AuditActorContext,
  ): Promise<SafeAccessUser> {
    // Autorização já aplicada pelo AuthorizationGuard (RequirePermission
    // "user_role"/"alter") antes deste método rodar.
    //
    // Escopo IMUTÁVEL (T029): a atualização toca apenas `role`. `companyId`,
    // `unitId` e `teamId` nunca são escritos aqui — o usuário permanece na
    // empresa em que foi criado. Isso impede que um RH/DP transfira, remova ou
    // reatribua o escopo de outra empresa a partir desta rota, mesmo que algo
    // escapasse da validação de entrada (defesa em profundidade). Transferência
    // entre empresas não existe na V1.
    const user = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.accessUser.update({
        where: { id: targetUserId },
        data: {
          role,
        },
      });

      await this.auditService.record(
        {
          actorType: "user",
          actorUserId: auditCtx.actor.id,
          actorRole: auditCtx.actor.role,
          companyId: auditCtx.actor.companyId,
          action: "user_role_changed",
          resource: "access_user",
          resourceId: targetUserId,
          ip: auditCtx.metadata.ip,
          userAgent: auditCtx.metadata.userAgent,
          result: "success",
          requestId: auditCtx.metadata.requestId,
        },
        tx,
      );

      return updated;
    });

    return toSafeUser(user);
  }

  async disable(
    targetUserId: string,
    auditCtx: AuditActorContext,
  ): Promise<void> {
    // Mudança de status, revogação de TODAS as sessões ativas e os dois
    // eventos correspondentes (user_disabled, session_revoked) na mesma
    // transação (ADR 0004 §2) — ou tudo persiste, ou nada.
    await this.prisma.$transaction(async (tx) => {
      await tx.accessUser.update({
        where: { id: targetUserId },
        data: { status: "disabled" },
      });

      await this.auditService.record(
        {
          actorType: "user",
          actorUserId: auditCtx.actor.id,
          actorRole: auditCtx.actor.role,
          companyId: auditCtx.actor.companyId,
          action: "user_disabled",
          resource: "access_user",
          resourceId: targetUserId,
          ip: auditCtx.metadata.ip,
          userAgent: auditCtx.metadata.userAgent,
          result: "success",
          requestId: auditCtx.metadata.requestId,
        },
        tx,
      );

      await this.sessionService.revokeAllForUser(
        targetUserId,
        "account_disabled",
        undefined,
        tx,
      );
      await this.auditService.record(
        {
          actorType: "user",
          actorUserId: auditCtx.actor.id,
          actorRole: auditCtx.actor.role,
          companyId: auditCtx.actor.companyId,
          action: "session_revoked",
          resource: "access_session",
          resourceId: targetUserId,
          ip: auditCtx.metadata.ip,
          userAgent: auditCtx.metadata.userAgent,
          result: "success",
          requestId: auditCtx.metadata.requestId,
        },
        tx,
      );
    });
  }
}
