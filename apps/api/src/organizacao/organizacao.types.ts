import { AccessUser, AuditAction, StatusOrganizacional } from "@prisma/client";
import { SessionRequestMetadata } from "../auth/session/session.service";

/** Ator + contexto de requisição para a trilha de auditoria (ADR 0004). */
export interface OrganizacaoAuditContext {
  actor: AccessUser;
  metadata: SessionRequestMetadata;
}

/** Página de resultados. Nomenclatura em português (ADR 0006, Emenda 1). */
export interface ResultadoPaginado<T> {
  itens: T[];
  pagina: number;
  tamanhoPagina: number;
  total: number;
}

/**
 * Verbos de auditoria de uma entidade organizacional. Fixos por entidade e
 * declarados explicitamente — nunca montados por concatenação de string, para
 * que a lista fechada do enum continue verificável em tempo de compilação
 * (ADR 0004 §5).
 *
 * Não há verbo de reativação: esta fatia expõe apenas inativação (ver spec
 * §12, "o que não entra nesta versão").
 */
export interface VerbosAuditoria {
  criada: AuditAction;
  atualizada: AuditAction;
  inativada: AuditAction;
}

/** Representação de saída comum a todos os nós organizacionais. */
export interface NoOrganizacional {
  id: string;
  codigo: string;
  nome: string;
  status: StatusOrganizacional;
  criadoEm: Date;
  atualizadoEm: Date;
}

export const TAMANHO_PAGINA_PADRAO = 20;
export const TAMANHO_PAGINA_MAXIMO = 100;
