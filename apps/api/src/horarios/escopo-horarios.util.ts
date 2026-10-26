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
 * Escopo de **mutação** de horários (T037): **RH e mais ninguém**, restrito à
 * própria empresa. Diferente de ponto (RH+DP): aqui DP também é negado. Não há
 * variante global de mutação — `master_tecnico` só lê.
 *
 * Deriva o escopo **da sessão autenticada**, nunca do corpo ou da query. O
 * `AuthorizationGuard` já nega os papéis sem capacidade antes de o service
 * rodar; esta função é defesa em profundidade, para que ausência de escopo
 * jamais degrade para "sem filtro".
 */
export interface EscopoHorarios {
  empresaId: string;
}

export function resolverEscopoHorarios(actor: AccessUser): EscopoHorarios {
  if (actor.role !== "rh") {
    // Inclui `dp`, `gestor`, `colaborador`, `admin_tecnico` e `master_tecnico`:
    // nenhum cria, altera, desativa ou vincula horário.
    throw new ForbiddenException();
  }
  if (actor.companyId === null) {
    throw new ForbiddenException();
  }
  return { empresaId: actor.companyId };
}

/**
 * Escopo de **LEITURA** de horários. Variante global exclusiva do
 * `master_tecnico` (T030); RH continua preso à própria empresa. A leitura é
 * auditada por si (`horarios.consultado`), inclusive a global do Master.
 */
export type EscopoLeituraHorarios =
  { global: true } | { global: false; empresaId: string };

export function resolverEscopoLeituraHorarios(
  actor: AccessUser,
): EscopoLeituraHorarios {
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
/**
 * T182 — escopo de LEITURA do catálogo de jornadas (tabelas de horário): o de
 * `resolverEscopoLeituraHorarios` e, além dele, o DP, sempre na própria
 * empresa. Só para `tabela_horario`: o vínculo de horário com o colaborador
 * continua com o escopo de antes.
 */
export function resolverEscopoLeituraTabelas(
  actor: AccessUser,
): EscopoLeituraHorarios {
  if (actor.role === "dp") {
    if (actor.companyId === null) {
      throw new ForbiddenException();
    }
    return { global: false, empresaId: actor.companyId };
  }
  return resolverEscopoLeituraHorarios(actor);
}

export function filtroEmpresaLeituraHorarios(escopo: EscopoLeituraHorarios): {
  empresaId?: string;
} {
  return escopo.global ? {} : { empresaId: escopo.empresaId };
}

/**
 * Reavaliação de LEITURA global-aware (fase 2). Escopado: empresa como
 * fronteira. Global (Master): capacidade sem empresa-alvo — leitura concedida.
 */
export function podeConsultarHorarios(
  actor: AccessUser,
  resource: AuthorizationResource,
  action: AuthorizationAction,
  escopo: EscopoLeituraHorarios,
): boolean {
  return evaluatePermission(
    { userId: actor.id, role: actor.role, companyId: actor.companyId },
    escopo.global
      ? { resource, action }
      : { resource, action, targetCompanyId: escopo.empresaId },
  );
}

/**
 * Fase 2 da avaliação: reavalia a permissão com a empresa da entidade já
 * resolvida. Retorna booleano em vez de lançar, porque quem nega precisa
 * registrar o evento `denied` antes de responder 404.
 */
export function podeAcessarHorarios(
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
