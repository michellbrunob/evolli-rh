import { AccessRole, AuditAction, AuditResult } from "@prisma/client";

/** Runtime array dos valores do enum `AuditAction`, para validação (`@IsIn`). */
export const AUDIT_ACTIONS = [
  "login_succeeded",
  "login_failed",
  "logout",
  "session_revoked",
  "session_expired",
  "password_reset_requested",
  "password_reset_completed",
  "user_created",
  "user_role_changed",
  "user_disabled",
  "authorization_denied",
  "rate_limit_blocked",
  "audit_log_read",
] as const satisfies readonly AuditAction[];

/**
 * Tipo do recurso auditado — união de tipos no código, não enum de banco
 * (mesmo padrão de `AuthorizationResource`, ver
 * `auth/authorization/permission.types.ts`): extensível por módulo futuro
 * sem exigir migration. `action`/`result` são fechados por enum de banco
 * (ADR 0004 §5) porque representam a semântica de segurança do evento;
 * `resource` é só a etiqueta do tipo de dado afetado.
 */
export type AuditResource =
  | "access_user"
  | "access_session"
  | "access_password_reset_token"
  | "access_login_attempt"
  | "audit_event";

export type RecordAuditEventInput =
  | {
      actorType: "user";
      actorUserId: string;
      actorRole: AccessRole;
      companyId?: string | null;
      unitId?: string | null;
      teamId?: string | null;
      action: AuditAction;
      resource: AuditResource;
      resourceId?: string | null;
      ip: string | null;
      userAgent: string | null;
      result: AuditResult;
      requestId: string;
      correlationId?: string | null;
    }
  | {
      actorType: "system";
      /** Identificador técnico fixo da origem, ex.: "auth-service:login". */
      actorSystemId: string;
      companyId?: string | null;
      unitId?: string | null;
      teamId?: string | null;
      action: AuditAction;
      resource: AuditResource;
      resourceId?: string | null;
      ip: string | null;
      userAgent: string | null;
      result: AuditResult;
      requestId: string;
      correlationId?: string | null;
    };
