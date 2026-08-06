import { AccessUser } from "@prisma/client";
import { evaluatePermission } from "../auth/authorization/rbac.evaluator";
import {
  AuthorizationAction,
  AuthorizationResource,
} from "../auth/authorization/permission.types";

export type { AuthorizationAction, AuthorizationResource };

/**
 * Fase 2 da avaliação de autorização organizacional (ver `evaluateOrganizacao`
 * em `auth/authorization/rbac.evaluator.ts`): reavalia a permissão com a
 * empresa da entidade **já resolvida**.
 *
 * O `AuthorizationGuard` roda a fase 1 (capacidade do papel) antes do
 * service, mas não carrega a entidade organizacional — só `AccessUser`. Esta
 * função fecha o ciclo sem duplicar regra: reaproveita o mesmo avaliador
 * puro, agora com `targetCompanyId` preenchido.
 *
 * Retorna booleano em vez de lançar: quem nega precisa **registrar o evento
 * `denied`** antes de responder (spec §9/§10), e isso é responsabilidade do
 * service, que tem o contexto de auditoria em mãos.
 */
export function podeAcessar(
  actor: AccessUser,
  resource: AuthorizationResource,
  action: AuthorizationAction,
  targetCompanyId: string,
): boolean {
  return evaluatePermission(
    {
      userId: actor.id,
      role: actor.role,
      companyId: actor.companyId,
    },
    { resource, action, targetCompanyId },
  );
}
