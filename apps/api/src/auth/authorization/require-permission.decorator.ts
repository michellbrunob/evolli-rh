import { SetMetadata } from "@nestjs/common";
import { AuthorizationAction, AuthorizationResource } from "./permission.types";

export const PERMISSION_METADATA_KEY = "evolli:required-permission";

export interface RequiredPermission {
  resource: AuthorizationResource;
  action: AuthorizationAction;
}

/**
 * Declara a permissão exigida por um handler — o AuthorizationGuard resolve
 * o alvo (usuário-alvo via `:id` de rota, quando aplicável) e chama o
 * avaliador RBAC/ABAC. Módulos futuros só usam este decorator, sem
 * reimplementar a checagem (spec §5).
 */
export const RequirePermission = (
  resource: AuthorizationResource,
  action: AuthorizationAction,
) => SetMetadata(PERMISSION_METADATA_KEY, { resource, action });
