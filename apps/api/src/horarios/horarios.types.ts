import { AccessUser } from "@prisma/client";
import { SessionRequestMetadata } from "../auth/session/session.service";

/** Ator + contexto de requisição para a trilha de auditoria (ADR 0004). */
export interface HorariosAuditContext {
  actor: AccessUser;
  metadata: SessionRequestMetadata;
}

/** Página de resultados. Mesmo formato de organizacao, pessoas e ponto. */
export interface ResultadoPaginado<T> {
  itens: T[];
  pagina: number;
  tamanhoPagina: number;
  total: number;
}

export const TAMANHO_PAGINA_PADRAO = 20;
export const TAMANHO_PAGINA_MAXIMO = 100;

/**
 * Dias da semana como catálogo **fechado**, na API. O valor persistido é um
 * inteiro 1..7 (ver `validacao-horarios.util.ts`), por exigência da EXCLUSION
 * CONSTRAINT de sobreposição de períodos (btree_gist + int4range) — mas o
 * contrato público usa o nome, mais legível e estável que um número.
 */
export const DIAS_SEMANA = [
  "segunda",
  "terca",
  "quarta",
  "quinta",
  "sexta",
  "sabado",
  "domingo",
] as const;

export type DiaSemana = (typeof DIAS_SEMANA)[number];
