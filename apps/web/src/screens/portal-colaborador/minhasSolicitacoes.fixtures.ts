/**
 * Dados sintéticos de "Portal do Colaborador > Minhas solicitações" (T067).
 *
 * Catálogo de tipos e estados **compatível** com a Central de Solicitações do
 * Colaborador já especificada e implementada (T065/T066,
 * `docs/modules/etapa3-central-solicitacoes-colaborador-contrato-v1.md`,
 * `apps/api/src/solicitacoes/`) — mas esta tela **não** importa nem chama
 * aquele núcleo: é puramente visual, com amostra própria. Nenhum envio daqui
 * cria, altera, encaminha, persiste ou integra nenhuma solicitação real.
 */

export type TipoSolicitacaoExemplo =
  | "contestacao_ajuste_ponto"
  | "ausencia"
  | "ferias"
  | "atualizacao_cadastral"
  | "documento";

export type EstadoSolicitacaoExemplo =
  | "rascunho"
  | "enviada"
  | "em_revisao_rh"
  | "aguardando_informacao"
  | "encaminhada_para_operacao_rh"
  | "recusada"
  | "cancelada";

export interface SolicitacaoExemplo {
  readonly id: string;
  readonly tipo: TipoSolicitacaoExemplo;
  readonly periodoReferencia: string | null;
  readonly situacao: EstadoSolicitacaoExemplo;
  readonly refAuditoria: string;
  readonly detalhe: string;
}

export const ROTULO_TIPO_SOLICITACAO: Record<TipoSolicitacaoExemplo, string> = {
  contestacao_ajuste_ponto: "Contestação de ajuste de ponto",
  ausencia: "Ausência",
  ferias: "Férias",
  atualizacao_cadastral: "Atualização cadastral",
  documento: "Documento",
};

export const ROTULO_ESTADO_SOLICITACAO: Record<
  EstadoSolicitacaoExemplo,
  string
> = {
  rascunho: "Rascunho",
  enviada: "Enviada",
  em_revisao_rh: "Em revisão RH",
  aguardando_informacao: "Aguardando informação",
  encaminhada_para_operacao_rh: "Encaminhada ao RH",
  recusada: "Recusada",
  cancelada: "Cancelada",
};

/** `dd/mm/aaaa` a partir de `AAAA-MM-DD` — sem fuso/hora. */
export function formatarDataBr(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

export const SOLICITACOES_EXEMPLO: readonly SolicitacaoExemplo[] = [
  {
    id: "SOL-DEMO-0001",
    tipo: "contestacao_ajuste_ponto",
    periodoReferencia: "2026-08-10",
    situacao: "encaminhada_para_operacao_rh",
    refAuditoria: "AUD-DEMO-0001",
    detalhe:
      "Contestação enviada e já encaminhada ao RH (exemplo ilustrativo). O encaminhamento não altera marcação nem saldo.",
  },
  {
    id: "SOL-DEMO-0002",
    tipo: "documento",
    periodoReferencia: null,
    situacao: "em_revisao_rh",
    refAuditoria: "AUD-DEMO-0002",
    detalhe:
      "Solicitação de documento em revisão pelo RH (exemplo ilustrativo). Sem anexo ou envio de arquivo.",
  },
  {
    id: "SOL-DEMO-0003",
    tipo: "ferias",
    periodoReferencia: "2026-09-01",
    situacao: "aguardando_informacao",
    refAuditoria: "AUD-DEMO-0003",
    detalhe:
      "RH aguarda informação adicional sobre esta solicitação (exemplo ilustrativo).",
  },
  {
    id: "SOL-DEMO-0004",
    tipo: "atualizacao_cadastral",
    periodoReferencia: null,
    situacao: "rascunho",
    refAuditoria: "AUD-DEMO-0004",
    detalhe:
      "Rascunho ainda não enviado pelo colaborador (exemplo ilustrativo).",
  },
  {
    id: "SOL-DEMO-0005",
    tipo: "ausencia",
    periodoReferencia: "2026-07-22",
    situacao: "recusada",
    refAuditoria: "AUD-DEMO-0005",
    detalhe:
      "Solicitação recusada pelo RH, com motivo codificado (exemplo ilustrativo).",
  },
];
