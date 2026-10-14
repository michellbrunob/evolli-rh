import { ForbiddenException } from "@nestjs/common";
import { AccessUser } from "@prisma/client";
import { atorOperaEmEscopoGlobal } from "../auth/session/contexto-empresarial";

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
  // T163 — global é condição de CONTEXTO, não de papel.
  //
  // Antes desta tarefa a condição era `actor.role === "master_tecnico"`, e o
  // E2E da T163 mediu o efeito: o Master selecionava a empresa D e continuava
  // enxergando as duas, porque o ramo global curto-circuitava o contexto. Com
  // empresa ativa, o Master opera DENTRO dela — sem seleção, `companyId` é
  // nulo e o comportamento é idêntico ao anterior.
  if (atorOperaEmEscopoGlobal(actor)) {
    // `master_tecnico`: perfil global controlado (T030; Constituição, Princípio
    // II) — o ÚNICO acesso global standing (ADR 0012). Opera a estrutura em
    // escopo global; toda consulta ampla gera evento (spec §9, RI-2;
    // registrarConsultaAmpla, fail-safe). `admin_tecnico` NÃO é mais global
    // (CG-RBAC-01): é negado no guard (evaluateOrganizacao) antes de chegar
    // aqui; se chegasse, cai no ForbiddenException abaixo (companyId nulo).
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
