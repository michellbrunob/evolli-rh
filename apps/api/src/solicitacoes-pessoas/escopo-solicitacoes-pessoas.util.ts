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
 * Escopo de **MUTAÇÃO** da Central. Objeto simples, sem variante global: por
 * `PD-SOL-01` só o `rh` opera, e só na própria empresa. Não existir o caso
 * global no domínio de tipos torna "esqueci de tratar o caso global"
 * impossível.
 */
export interface EscopoSolicitacoesPessoas {
  empresaId: string;
}

/**
 * Deriva o escopo **da sessão autenticada**, nunca do corpo ou da query. O
 * `AuthorizationGuard` já nega os papéis sem capacidade antes de o service
 * rodar; esta função é defesa em profundidade, para que ausência de escopo
 * jamais degrade para "sem filtro".
 */
export function resolverEscopoSolicitacoesPessoas(
  actor: AccessUser,
): EscopoSolicitacoesPessoas {
  if (actor.role !== "rh") {
    // Inclui `dp`, `gestor`, `colaborador`, `admin_tecnico` e `master_tecnico`:
    // nenhum MUTA a Central (`PD-SOL-01`; ADR 0012 d.3 para o Master).
    throw new ForbiddenException();
  }

  if (actor.companyId === null) {
    throw new ForbiddenException();
  }

  return { empresaId: actor.companyId };
}

/**
 * Escopo de **LEITURA**. Variante global exclusiva do `master_tecnico` (perfil
 * global controlado; Constituição, Princípio II); `rh` segue preso à própria
 * empresa. A leitura global é auditada de forma fail-safe.
 */
export type EscopoLeituraSolicitacoesPessoas =
  { global: true } | { global: false; empresaId: string };

export function resolverEscopoLeituraSolicitacoesPessoas(
  actor: AccessUser,
): EscopoLeituraSolicitacoesPessoas {
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
  if (!papelTemPoliticaGlobal(actor.role) && actor.role !== "rh") {
    throw new ForbiddenException();
  }
  if (actor.companyId === null) {
    throw new ForbiddenException();
  }
  return { global: false, empresaId: actor.companyId };
}

/** Filtro por `empresa_id` para leitura. Global (Master): sem filtro. */
export function filtroEmpresaLeituraSolicitacoesPessoas(
  escopo: EscopoLeituraSolicitacoesPessoas,
): { empresaId?: string } {
  return escopo.global ? {} : { empresaId: escopo.empresaId };
}

/**
 * Reavaliação de LEITURA global-aware (fase 2). Escopado: empresa como
 * fronteira. Global (Master): capacidade sem empresa-alvo — leitura concedida,
 * mutação negada pelo próprio avaliador.
 */
export function podeConsultarSolicitacoesPessoas(
  actor: AccessUser,
  resource: AuthorizationResource,
  action: AuthorizationAction,
  escopo: EscopoLeituraSolicitacoesPessoas,
): boolean {
  return evaluatePermission(
    { userId: actor.id, role: actor.role, companyId: actor.companyId },
    escopo.global
      ? { resource, action }
      : { resource, action, targetCompanyId: escopo.empresaId },
  );
}

/**
 * Fase 2 da avaliação: reavalia a permissão com a empresa do recurso já
 * resolvida. Retorna booleano em vez de lançar, porque quem nega precisa
 * registrar o evento `denied` antes de responder 404 (anti-enumeração,
 * ADR 0006).
 */
export function podeAcessarSolicitacoesPessoas(
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
export function intersectarLeituraSolicitacoesPessoas(
  escopo: EscopoLeituraSolicitacoesPessoas,
  empresaIdSolicitada: string | undefined,
): { empresaId?: string } | null {
  if (empresaIdSolicitada === undefined) {
    return filtroEmpresaLeituraSolicitacoesPessoas(escopo);
  }
  if (escopo.global) {
    return { empresaId: empresaIdSolicitada };
  }
  return escopo.empresaId === empresaIdSolicitada
    ? { empresaId: escopo.empresaId }
    : null;
}

/** Deslocamento de paginação, com página 1-indexada. */
export function deslocamento(pagina: number, tamanhoPagina: number): number {
  return (pagina - 1) * tamanhoPagina;
}

/**
 * Converte `"AAAA-MM-DD"` em `Date` UTC, rejeitando data que não existe no
 * calendário (ex.: `2026-02-30`, que o construtor de `Date` silenciosamente
 * transformaria em 2 de março). O formato já foi validado pelo DTO; aqui se
 * verifica a existência real do dia.
 */
export function parsearDiaReferencia(valor: string): Date | null {
  const data = new Date(`${valor}T00:00:00.000Z`);
  if (Number.isNaN(data.getTime())) {
    return null;
  }
  return data.toISOString().slice(0, 10) === valor ? data : null;
}
