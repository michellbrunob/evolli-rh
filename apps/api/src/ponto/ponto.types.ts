import { AccessUser, TipoEventoPonto } from "@prisma/client";
import { SessionRequestMetadata } from "../auth/session/session.service";

/** Ator + contexto de requisição para a trilha de auditoria (ADR 0004). */
export interface PontoAuditContext {
  actor: AccessUser;
  metadata: SessionRequestMetadata;
}

/** Página de resultados. Mesmo formato já usado em organizacao e pessoas. */
export interface ResultadoPaginado<T> {
  itens: T[];
  pagina: number;
  tamanhoPagina: number;
  total: number;
}

export const TAMANHO_PAGINA_PADRAO = 20;
export const TAMANHO_PAGINA_MAXIMO = 100;

/**
 * Valor **efetivo** de um evento de ponto: o original, com os ajustes já
 * aplicados em ordem.
 *
 * Existe como tipo próprio porque "o que está gravado" e "o que vale hoje" são
 * coisas diferentes neste módulo por desenho — o evento é imutável, então o
 * valor corrente nunca sobrescreve o original, é sempre derivado dele mais a
 * cadeia de ajustes.
 */
export interface ValorEfetivoPonto {
  tipo: TipoEventoPonto;
  momento: Date;
  /** `true` quando algum ajuste declarou que o evento não deveria existir. */
  anulado: boolean;
  /** Quantos ajustes existem — 0 significa "vale o original, intacto". */
  totalAjustes: number;
}
