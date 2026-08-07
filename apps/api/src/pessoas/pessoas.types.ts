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
