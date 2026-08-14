import { ForbiddenException } from "@nestjs/common";
import { AccessUser } from "@prisma/client";
import { evaluatePermission } from "../auth/authorization/rbac.evaluator";
import {
  AuthorizationAction,
  AuthorizationResource,
} from "../auth/authorization/permission.types";

export type { AuthorizationAction, AuthorizationResource };

/**
 * Escopo do módulo de documentos (metadados).
 *
 * Igual ao de pessoas e por decisão idêntica: **não existe variante global**
 * (ADR 0011, decisão 5). Nenhum papel opera este domínio fora de uma empresa —
 * a exceção de acesso amplo do `admin_tecnico` (Emenda 1 da ADR 0005) foi
 * concedida sobre estrutura sem dado pessoal e não se estende a documento de
 * colaborador (ADR 0011, decisão 6). O tipo ser um objeto simples, não uma
 * união com `{ global: true }`, torna "esqueci de tratar o caso global"
 * impossível — o caso não existe no domínio de tipos.
 */
export interface EscopoDocumentos {
  empresaId: string;
}

/**
 * Deriva o escopo **da sessão autenticada**, nunca do corpo ou da query. O
 * `AuthorizationGuard` já nega os papéis sem capacidade antes de o service
 * rodar; esta função é defesa em profundidade, para que ausência de escopo
 * jamais degrade para "sem filtro".
 *
 * Aceita `rh` e `dp` (ambos operam o domínio); a restrição de que só `rh` cria
 * ou altera o catálogo é aplicada pelo avaliador RBAC/ABAC (fase 1, no guard) e
 * reavaliada por `podeAcessarDocumentos` (fase 2), não aqui.
 */
export function resolverEscopoDocumentos(actor: AccessUser): EscopoDocumentos {
  if (actor.role !== "rh" && actor.role !== "dp") {
    // Inclui `admin_tecnico`: negado neste domínio por decisão explícita.
    throw new ForbiddenException();
  }

  if (actor.companyId === null) {
    throw new ForbiddenException();
  }

  return { empresaId: actor.companyId };
}

/**
 * Fase 2 da avaliação: reavalia a permissão com a empresa do documento já
 * resolvida. Retorna booleano em vez de lançar, porque quem nega precisa
 * registrar o evento `denied` antes de responder 404 (ADR 0011, decisão 5).
 */
export function podeAcessarDocumentos(
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

/**
 * Intersecção entre o filtro pedido pelo cliente e o escopo do ator. Um ator
 * que peça outra empresa recebe **página vazia**, nunca erro — erro confirmaria
 * a existência da empresa (anti-enumeração).
 */
export function intersectarEmpresaSolicitada(
  escopo: EscopoDocumentos,
  empresaIdSolicitada: string | undefined,
): { empresaId: string } | null {
  if (empresaIdSolicitada === undefined) {
    return { empresaId: escopo.empresaId };
  }
  return escopo.empresaId === empresaIdSolicitada
    ? { empresaId: escopo.empresaId }
    : null;
}

/** Deslocamento de paginação, com página 1-indexada. */
export function deslocamento(pagina: number, tamanhoPagina: number): number {
  return (pagina - 1) * tamanhoPagina;
}
