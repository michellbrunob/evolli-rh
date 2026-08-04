import { AccessRole } from "@prisma/client";

/**
 * Recursos/ações desta fatia (matriz §3 da spec). Módulos futuros (Etapa 1+)
 * estendem este union — nunca reduzem o que já está aqui.
 */
export type AuthorizationResource =
  "own_account" | "other_account" | "access_log" | "user_role";

export type AuthorizationAction = "read" | "manage" | "alter" | "create";

export interface AuthorizationSubject {
  userId: string;
  role: AccessRole;
  companyId: string | null;
}

export interface AuthorizationTarget {
  resource: AuthorizationResource;
  action: AuthorizationAction;
  targetUserId?: string;
  targetCompanyId?: string | null;
  /** Só relevante para resource "user_role" + action "alter". */
  targetNewRole?: AccessRole;
}
