import { ForbiddenException } from "@nestjs/common";
import { AccessUser } from "@prisma/client";
import { evaluatePermission } from "../auth/authorization/rbac.evaluator";
import {
  AuthorizationAction,
  AuthorizationResource,
} from "../auth/authorization/permission.types";

export type { AuthorizationAction, AuthorizationResource };

/**
 * Escopo do módulo de ponto.
 *
 * Como em pessoas, e pela mesma razão, **não existe variante global**: nenhum
 * papel opera este domínio fora de uma empresa. `admin_tecnico` é negado
 * (Baseline Jornada V1, decisão 5), então "acesso amplo" não é um caso que
 * possa ser esquecido — ele não existe no domínio de tipos.
 */
export interface EscopoPonto {
  empresaId: string;
}

/**
 * Deriva o escopo **da sessão autenticada**, nunca do corpo ou da query.
 *
 * O `AuthorizationGuard` já nega os papéis sem capacidade antes de o service
 * rodar; esta função é defesa em profundidade, para que ausência de escopo
 * jamais degrade para "sem filtro".
 */
export function resolverEscopoPonto(actor: AccessUser): EscopoPonto {
  if (actor.role !== "rh" && actor.role !== "dp") {
    // Inclui `admin_tecnico`, `gestor` e `colaborador`: negados neste domínio
    // por decisão explícita, cada um por um motivo próprio (ver
    // `evaluatePonto` em rbac.evaluator.ts).
    throw new ForbiddenException();
  }

  if (actor.companyId === null) {
    throw new ForbiddenException();
  }

  return { empresaId: actor.companyId };
}

/**
 * Fase 2 da avaliação: reavalia a permissão com a empresa **do vínculo** já
 * resolvida. Retorna booleano em vez de lançar, porque quem nega precisa
 * registrar o evento `denied` antes de responder 404.
 */
export function podeAcessarPonto(
  actor: AccessUser,
  resource: AuthorizationResource,
  action: AuthorizationAction,
  targetCompanyId: string,
): boolean {
  return evaluatePermission(
    { userId: actor.id, role: actor.role, companyId: actor.companyId },
    { resource, action, targetCompanyId },
  );
}

/** Deslocamento de paginação, com página 1-indexada. */
export function deslocamento(pagina: number, tamanhoPagina: number): number {
  return (pagina - 1) * tamanhoPagina;
}
