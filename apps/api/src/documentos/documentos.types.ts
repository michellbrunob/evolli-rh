import { AccessUser } from "@prisma/client";
import { SessionRequestMetadata } from "../auth/session/session.service";

/** Ator + contexto de requisição para a trilha de auditoria (ADR 0004). */
export interface DocumentosAuditContext {
  actor: AccessUser;
  metadata: SessionRequestMetadata;
}

/** Página de resultados. Mesmo formato dos módulos organizacional e de pessoas. */
export interface ResultadoPaginado<T> {
  itens: T[];
  pagina: number;
  tamanhoPagina: number;
  total: number;
}

export const TAMANHO_PAGINA_PADRAO = 20;
export const TAMANHO_PAGINA_MAXIMO = 100;
