/**
 * Valores runtime de `AccessUserStatus` (schema.prisma), para validação
 * (`@IsIn`) — mesmo padrão de `ACCESS_ROLES` (`../auth/access-roles.const.ts`).
 */
export const ACCESS_USER_STATUSES = ["active", "disabled", "locked"] as const;
