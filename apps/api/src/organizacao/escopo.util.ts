import { ForbiddenException } from "@nestjs/common";
import { AccessUser } from "@prisma/client";

/**
 * Escopo organizacional efetivo do ator (spec §5).
 *
 * `empresaId` continua sendo a **única** fronteira de autorização
 * (ADR 0005 decisão 3, reafirmada pela Baseline V1 item 2). Departamento,
 * área e equipe são estrutura — nunca delimitam acesso nesta fatia.
 */
export type EscopoOrganizacional =
  { global: true } | { global: false; empresaId: string };

/**
 * Deriva o escopo **da sessão autenticada**, nunca do corpo ou da query da
 * requisição (spec §10, "escopo nunca vem do cliente").
 */
export function resolverEscopo(actor: AccessUser): EscopoOrganizacional {
  if (actor.role === "admin_tecnico") {
    // Exceção temporária, condicionada e auditada (Emenda 1 da ADR 0005).
    // Toda leitura com este escopo gera evento (spec §9, RI-2).
    return { global: true };
  }

  if (actor.companyId === null) {
    // Inalcançável na prática: o `AuthorizationGuard` já nega papel escopado
    // sem empresa atribuída. Mantido como defesa em profundidade para que a
    // ausência de escopo nunca degrade para "sem filtro".
    throw new ForbiddenException();
  }

  return { global: false, empresaId: actor.companyId };
}

/**
 * Filtro de empresa aplicado a **toda** consulta de entidade que possui
 * `empresaId` próprio. É isto que torna o isolamento estrutural em vez de
 * depender de o service lembrar de checar: fora do escopo, a linha não é
 * encontrada — e "não encontrada" vira 404, nunca 403 (anti-enumeração).
 */
export function filtroEmpresa(escopo: EscopoOrganizacional): {
  empresaId?: string;
} {
  return escopo.global ? {} : { empresaId: escopo.empresaId };
}

/**
 * Mesma função para `Area`, que não tem `empresaId` próprio: a empresa é
 * sempre a do departamento pai (spec §3.3), então o filtro atravessa a
 * relação.
 */
export function filtroEmpresaViaDepartamento(escopo: EscopoOrganizacional): {
  departamento?: { empresaId: string };
} {
  return escopo.global ? {} : { departamento: { empresaId: escopo.empresaId } };
}

/**
 * Intersecção entre o filtro pedido pelo cliente e o escopo do ator. Um ator
 * escopado que peça outra empresa não recebe erro (que confirmaria a
 * existência dela) — recebe página vazia.
 */
export function intersectarEmpresaSolicitada(
  escopo: EscopoOrganizacional,
  empresaIdSolicitada: string | undefined,
): { empresaId?: string } | null {
  if (empresaIdSolicitada === undefined) {
    return filtroEmpresa(escopo);
  }
  if (escopo.global) {
    return { empresaId: empresaIdSolicitada };
  }
  return escopo.empresaId === empresaIdSolicitada
    ? { empresaId: escopo.empresaId }
    : null;
}
