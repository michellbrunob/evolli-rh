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
    // Inclui `admin_tecnico`, `gestor`, `colaborador` e `master_tecnico`:
    // nenhum registra ponto (mutação). `master_tecnico` só LÊ — ver o resolver
    // de leitura abaixo.
    throw new ForbiddenException();
  }

  if (actor.companyId === null) {
    throw new ForbiddenException();
  }

  return { empresaId: actor.companyId };
}

/**
 * Escopo de **LEITURA** de ponto (T030). Variante global exclusiva do
 * `master_tecnico` (perfil global controlado; Constituição, Princípio II);
 * rh/dp continuam presos à própria empresa. A leitura de ponto é auditada por
 * si (`ponto.consultado`), inclusive a global do Master.
 */
export type EscopoLeituraPonto =
  { global: true } | { global: false; empresaId: string };

export function resolverEscopoLeituraPonto(
  actor: AccessUser,
): EscopoLeituraPonto {
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

/** Filtro por `empresa_id` para leitura. Global (Master): sem filtro. */
export function filtroEmpresaLeituraPonto(escopo: EscopoLeituraPonto): {
  empresaId?: string;
} {
  return escopo.global ? {} : { empresaId: escopo.empresaId };
}

/**
 * Reavaliação de LEITURA global-aware (fase 2). Escopado: empresa como
 * fronteira. Global (Master): capacidade sem empresa-alvo — leitura concedida,
 * mutação negada.
 */
export function podeConsultarPonto(
  actor: AccessUser,
  resource: AuthorizationResource,
  action: AuthorizationAction,
  escopo: EscopoLeituraPonto,
): boolean {
  return evaluatePermission(
    { userId: actor.id, role: actor.role, companyId: actor.companyId },
    escopo.global
      ? { resource, action }
      : { resource, action, targetCompanyId: escopo.empresaId },
  );
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
