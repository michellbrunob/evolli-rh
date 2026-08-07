import { AccessRole } from "@prisma/client";

/**
 * Recursos organizacionais da Etapa 1 — Fatia 1 (spec §8, ADR 0006).
 * Nomenclatura em português (ADR 0006, Emenda 1). Departamento e Area
 * aparecem aqui como **recurso** (o que é acessado), nunca como **escopo**
 * (o que delimita o acesso) — o escopo continua sendo só `empresa`
 * (Baseline V1, item 2).
 */
export const ORGANIZATIONAL_RESOURCES = [
  "empresa",
  "unidade_organizacional",
  "departamento",
  "area",
  "equipe",
  "cargo",
  "centro_custo",
] as const;

export type OrganizationalResource = (typeof ORGANIZATIONAL_RESOURCES)[number];

/**
 * Recursos de Colaboradores e Vida Funcional (Etapa 1 — Fatia 2, ADR 0007).
 *
 * `dado_restrito_colaborador` **não** aparece aqui: dado restrito ficou
 * inteiramente fora desta fatia (Baseline V1, item 5), e criar o recurso sem
 * o dado seria conceder superfície de autorização a algo que não existe.
 */
export const PESSOAS_RESOURCES = [
  "colaborador",
  "vinculo_funcional",
  "movimentacao_funcional",
  "alocacao_organizacional",
] as const;

export type PessoasResource = (typeof PESSOAS_RESOURCES)[number];

/**
 * Recursos/ações desta fatia (matriz §3 da spec). Módulos futuros (Etapa 1+)
 * estendem este union — nunca reduzem o que já está aqui.
 */
export type AuthorizationResource =
  | "own_account"
  | "other_account"
  | "access_log"
  | "user_role"
  | OrganizationalResource
  | PessoasResource;

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
  /**
   * Empresa do alvo. `undefined` significa **alvo ainda não resolvido** — é o
   * estado em que o `AuthorizationGuard` chama o avaliador para recursos
   * organizacionais, já que a entidade só é carregada dentro do service. Ver
   * `evaluateOrganizacao` em rbac.evaluator.ts para o que cada fase decide.
   */
  targetCompanyId?: string | null;
  /** Só relevante para resource "user_role" + action "alter". */
  targetNewRole?: AccessRole;
}

export function isOrganizationalResource(
  resource: AuthorizationResource,
): resource is OrganizationalResource {
  return (ORGANIZATIONAL_RESOURCES as readonly string[]).includes(resource);
}

export function isPessoasResource(
  resource: AuthorizationResource,
): resource is PessoasResource {
  return (PESSOAS_RESOURCES as readonly string[]).includes(resource);
}
