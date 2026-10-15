import { ForbiddenException } from "@nestjs/common";
import { AccessUser } from "@prisma/client";
import {
  atorOperaEmEscopoGlobal,
  papelTemPoliticaGlobal,
} from "../auth/session/contexto-empresarial";
import { evaluatePermission } from "../auth/authorization/rbac.evaluator";
import {
  AuthorizationAction,
  AuthorizationResource,
} from "../auth/authorization/permission.types";

export type { AuthorizationAction, AuthorizationResource };

/**
 * Escopo de **MUTAÇÃO** do módulo de pessoas.
 *
 * Não existe variante global aqui: nenhum papel MUTA este domínio fora de uma
 * empresa. Nem `admin_tecnico` (Emenda 1 da ADR 0005, negado em pessoas) nem
 * `master_tecnico` (T030: perfil global de LEITURA e configuração, mas **sem**
 * mutação de negócio) escrevem aqui — os dois são recusados por este resolver,
 * defesa em profundidade além da negação já feita no guard.
 *
 * O tipo ser um objeto simples — e não uma união com `{ global: true }` — é o
 * que torna "esqueci de tratar o caso global numa escrita" impossível: o caso
 * não existe no domínio de tipos das mutações.
 */
export interface EscopoPessoas {
  empresaId: string;
}

/**
 * Deriva o escopo de **mutação da sessão** autenticada, nunca do corpo/query.
 *
 * O `AuthorizationGuard` já nega os papéis sem capacidade antes de o service
 * rodar; esta função é defesa em profundidade, para que ausência de escopo
 * jamais degrade para "sem filtro".
 */
export function resolverEscopoPessoas(actor: AccessUser): EscopoPessoas {
  if (actor.role !== "rh" && actor.role !== "dp") {
    // Inclui `admin_tecnico` e `master_tecnico`: nenhum muta pessoas.
    throw new ForbiddenException();
  }

  if (actor.companyId === null) {
    throw new ForbiddenException();
  }

  return { empresaId: actor.companyId };
}

/**
 * Escopo de **LEITURA** do módulo de pessoas (T030).
 *
 * Aqui existe variante global, mas **exclusiva do `master_tecnico`** — o perfil
 * global controlado (Constituição, Princípio II). rh/dp continuam presos à
 * própria empresa. A leitura global é sempre auditada (fail-safe) pelo serviço.
 */
export type EscopoLeituraPessoas =
  { global: true } | { global: false; empresaId: string };

/** Deriva o escopo de leitura da sessão. Só `master_tecnico` é global. */
export function resolverEscopoLeituraPessoas(
  actor: AccessUser,
): EscopoLeituraPessoas {
  // T163 — global é condição de CONTEXTO, não de papel.
  //
  // Antes desta tarefa a condição era `actor.role === "master_tecnico"`, e o
  // E2E da T163 mediu o efeito: o Master selecionava a empresa D e continuava
  // enxergando as duas, porque o ramo global curto-circuitava o contexto. Com
  // empresa ativa, o Master opera DENTRO dela — sem seleção, `companyId` é
  // nulo e o comportamento é idêntico ao anterior.
  if (atorOperaEmEscopoGlobal(actor)) {
    return { global: true };
  }
  // T163 — o papel de politica global (Master) continua passando aqui quando
  // esta ESCOPADO por contexto. Sem esta clausula, selecionar uma empresa
  // transformaria o acesso global dele em 403: ele deixaria de ser global sem
  // passar a ser escopado, isto e, perderia a leitura por completo. Com
  // empresa ativa ele le DENTRO dela, que e a regra de negocio aprovada.
  if (
    !papelTemPoliticaGlobal(actor.role) &&
    actor.role !== "rh" &&
    actor.role !== "dp"
  ) {
    throw new ForbiddenException();
  }
  if (actor.companyId === null) {
    throw new ForbiddenException();
  }
  return { global: false, empresaId: actor.companyId };
}

/**
 * Filtro por empresa para entidades **sem `empresa_id` próprio** (`Colaborador`)
 * — atravessa a relação de vínculo. Global (Master): sem filtro.
 */
export function filtroVinculoEmpresa(escopo: EscopoLeituraPessoas): {
  vinculos?: { some: { empresaId: string } };
} {
  return escopo.global
    ? {}
    : { vinculos: { some: { empresaId: escopo.empresaId } } };
}

/** Filtro direto por `empresa_id` (vínculo, movimentação). Global: sem filtro. */
export function filtroEmpresaLeitura(escopo: EscopoLeituraPessoas): {
  empresaId?: string;
} {
  return escopo.global ? {} : { empresaId: escopo.empresaId };
}

/**
 * Intersecção entre o filtro pedido pelo cliente e o escopo de leitura. Um ator
 * escopado que peça outra empresa recebe **página vazia** (`null`), nunca erro —
 * erro confirmaria a existência da empresa (anti-enumeração). O ator global
 * recebe exatamente a empresa pedida, ou todas quando não filtra.
 */
export function intersectarLeitura(
  escopo: EscopoLeituraPessoas,
  empresaIdSolicitada: string | undefined,
): { empresaId?: string } | null {
  if (empresaIdSolicitada === undefined) {
    return filtroEmpresaLeitura(escopo);
  }
  if (escopo.global) {
    return { empresaId: empresaIdSolicitada };
  }
  return escopo.empresaId === empresaIdSolicitada
    ? { empresaId: escopo.empresaId }
    : null;
}

/**
 * Fase 2 da avaliação: reavalia a permissão com a empresa **do vínculo** já
 * resolvida. Retorna booleano em vez de lançar, porque quem nega precisa
 * registrar o evento `denied` antes de responder 404 (spec §9/§10).
 */
export function podeAcessarPessoas(
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
 * Reavaliação de LEITURA global-aware (fase 2). Para o ator escopado, aplica a
 * empresa resolvida (fronteira). Para o ator global (`master_tecnico`), avalia a
 * capacidade sem empresa-alvo — o avaliador concede leitura em qualquer empresa
 * e nega toda mutação.
 */
export function podeConsultarPessoas(
  actor: AccessUser,
  resource: AuthorizationResource,
  action: AuthorizationAction,
  escopo: EscopoLeituraPessoas,
): boolean {
  return evaluatePermission(
    { userId: actor.id, role: actor.role, companyId: actor.companyId },
    // Global (Master): sem empresa-alvo → o avaliador roda a fase de capacidade
    // (concede leitura, nega mutação). Escopado: com a empresa como fronteira.
    escopo.global
      ? { resource, action }
      : { resource, action, targetCompanyId: escopo.empresaId },
  );
}

/** Deslocamento de paginação, com página 1-indexada. */
export function deslocamento(pagina: number, tamanhoPagina: number): number {
  return (pagina - 1) * tamanhoPagina;
}
