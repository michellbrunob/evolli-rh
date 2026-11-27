import { AccessUser, TipoVinculo } from "@prisma/client";
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
  /**
   * T199 — grupos EXCLUSIVOS, com prioridade ativo > previsto > encerrado
   * (N-1): `ativos + emAdmissao + desligados = total`.
   */
  emAdmissao: number;
  desligados: number;
  /** T199 — colaboradores com algum vínculo no escopo. */
  total: number;
  /**
   * T215 — desativados na empresa (lixeira do "Editar colaborador"): fora de
   * Ativos, Em admissão e Desligados; só em Todos. Com eles, a soma dos
   * grupos volta a fechar: `ativos + emAdmissao + desligados + desativados =
   * total`.
   */
  desativados: number;
  /**
   * T199 — ativos pelo tipo do vínculo PRINCIPAL ativo (N-2): a soma é
   * `ativos`. Todos os tipos presentes, com zero quando não há ninguém.
   */
  ativosPorTipo: Record<TipoVinculo, number>;
  /**
   * T215 — cartão "Colaboradores ativos" da página inicial: pessoas com
   * vínculo ATIVO admitido no mês civil de hoje (America/Sao_Paulo).
   */
  admitidosNoMes: number;
  /** T215 — pessoas com vínculo encerrado no ano civil de hoje. */
  desligadosNoAno: number;
  /**
   * T215 — ativos ao fim de cada um dos 6 meses até hoje, o mais antigo
   * primeiro; o mês atual fecha hoje. Pela admissão e pelo desligamento dos
   * vínculos; quem está desativado na empresa fica fora.
   */
  serieAtivos: number[];
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
