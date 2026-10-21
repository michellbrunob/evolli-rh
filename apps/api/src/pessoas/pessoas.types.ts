import { AccessUser } from "@prisma/client";
import { SessionRequestMetadata } from "../auth/session/session.service";

/** Ator + contexto de requisição para a trilha de auditoria (ADR 0004). */
export interface PessoasAuditContext {
  actor: AccessUser;
  metadata: SessionRequestMetadata;
}

/** Página de resultados. Mesmo formato já usado no módulo organizacional. */
export interface ResultadoPaginado<T> {
  itens: T[];
  pagina: number;
  tamanhoPagina: number;
  total: number;
}

/**
 * T178 — contadores da listagem de colaboradores: o escopo inteiro da sessão
 * (a empresa ativa), sem filtros nem busca. Somá-los no cliente obrigaria a
 * baixar todas as páginas.
 */
export interface ContadoresColaboradores {
  ativos: number;
  inativos: number;
}

export const TAMANHO_PAGINA_PADRAO = 20;
export const TAMANHO_PAGINA_MAXIMO = 100;

/**
 * Campos de destino organizacional de uma movimentação — a instrução do ato,
 * materializada em `AlocacaoOrganizacional` na efetivação.
 */
export interface DestinoOrganizacional {
  unidadeOrganizacionalId: string | null;
  departamentoId: string | null;
  areaId: string | null;
  equipeId: string | null;
  cargoId: string | null;
  centroCustoId: string | null;
}
