/**
 * Dados sintéticos de "Solicitações > Central do RH" (T068).
 *
 * Catálogo de tipos e estados **compatível** com a Central de Solicitações do
 * Colaborador já especificada e implementada (T065/T066,
 * `docs/modules/etapa3-central-solicitacoes-colaborador-contrato-v1.md`,
 * `apps/api/src/solicitacoes/`) — mas esta tela **não** importa nem chama
 * aquele núcleo: é puramente visual, com amostra própria. Nenhuma ação aqui
 * cria, altera, encaminha, persiste ou integra nenhuma solicitação real.
 */

export type TipoSolicitacaoRH =
  | "contestacao_ajuste_ponto"
  | "ausencia"
  | "ferias"
  | "atualizacao_cadastral"
  | "documento";

export type EstadoSolicitacaoRH =
  | "rascunho"
  | "enviada"
  | "em_revisao_rh"
  | "aguardando_informacao"
  | "encaminhada_para_operacao_rh"
  | "recusada"
  | "cancelada";

export type PrioridadeSolicitacaoRH = "informativa" | "atencao" | "critica";

export interface SolicitacaoRHExemplo {
  readonly id: string;
  readonly vinculoRef: string;
  readonly tipo: TipoSolicitacaoRH;
  readonly periodoReferencia: string | null;
  readonly situacao: EstadoSolicitacaoRH;
  readonly prioridade: PrioridadeSolicitacaoRH;
  readonly motivoCodificado: string;
  readonly detalhe: string;
}

export const ROTULO_TIPO_RH: Record<TipoSolicitacaoRH, string> = {
  contestacao_ajuste_ponto: "Contestação de ajuste de ponto",
  ausencia: "Ausência",
  ferias: "Férias",
  atualizacao_cadastral: "Atualização cadastral",
  documento: "Documento",
};

export const ROTULO_ESTADO_RH: Record<EstadoSolicitacaoRH, string> = {
  rascunho: "Rascunho",
  enviada: "Enviada",
  em_revisao_rh: "Em revisão RH",
  aguardando_informacao: "Aguardando informação",
  encaminhada_para_operacao_rh: "Encaminhada ao RH",
  recusada: "Recusada",
  cancelada: "Cancelada",
};

export const ROTULO_PRIORIDADE_RH: Record<PrioridadeSolicitacaoRH, string> = {
  informativa: "Informativa",
  atencao: "Atenção",
  critica: "Crítica",
};

/** `dd/mm/aaaa` a partir de `AAAA-MM-DD` — sem fuso/hora. */
export function formatarDataBr(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

export const SOLICITACOES_RH_EXEMPLO: readonly SolicitacaoRHExemplo[] = [
  {
    id: "SOL-DEMO-0001",
    vinculoRef: "V-001",
    tipo: "contestacao_ajuste_ponto",
    periodoReferencia: "2026-08-10",
    situacao: "em_revisao_rh",
    prioridade: "atencao",
    motivoCodificado: "DIVERGENCIA_MARCACAO_DEMO",
    detalhe:
      "Colaborador contesta um registro de ponto do período (exemplo ilustrativo). O RH está revisando.",
  },
  {
    id: "SOL-DEMO-0002",
    vinculoRef: "V-014",
    tipo: "documento",
    periodoReferencia: null,
    situacao: "aguardando_informacao",
    prioridade: "informativa",
    motivoCodificado: "SEGUNDA_VIA_DEMO",
    detalhe:
      "RH aguarda informação adicional do colaborador para prosseguir (exemplo ilustrativo).",
  },
  {
    id: "SOL-DEMO-0003",
    vinculoRef: "V-007",
    tipo: "ferias",
    periodoReferencia: "2026-09-01",
    situacao: "encaminhada_para_operacao_rh",
    prioridade: "atencao",
    motivoCodificado: "PERIODO_FERIAS_DEMO",
    detalhe:
      "Solicitação já encaminhada ao fluxo operacional do RH (exemplo ilustrativo). Nenhuma mutação foi feita por este encaminhamento.",
  },
  {
    id: "SOL-DEMO-0004",
    vinculoRef: "V-022",
    tipo: "atualizacao_cadastral",
    periodoReferencia: null,
    situacao: "enviada",
    prioridade: "informativa",
    motivoCodificado: "DADO_CADASTRAL_DESATUALIZADO_DEMO",
    detalhe:
      "Colaborador enviou a solicitação; aguarda início da triagem do RH (exemplo ilustrativo).",
  },
  {
    id: "SOL-DEMO-0005",
    vinculoRef: "V-033",
    tipo: "ausencia",
    periodoReferencia: "2026-07-22",
    situacao: "recusada",
    prioridade: "critica",
    motivoCodificado: "AUSENCIA_PROGRAMADA_DEMO",
    detalhe:
      "Solicitação recusada pelo RH, com motivo codificado (exemplo ilustrativo).",
  },
  {
    id: "SOL-DEMO-0006",
    vinculoRef: "V-041",
    tipo: "contestacao_ajuste_ponto",
    periodoReferencia: "2026-08-15",
    situacao: "rascunho",
    prioridade: "informativa",
    motivoCodificado: "DIVERGENCIA_MARCACAO_DEMO",
    detalhe:
      "Rascunho ainda não enviado pelo colaborador (exemplo ilustrativo).",
  },
  {
    id: "SOL-DEMO-0007",
    vinculoRef: "V-058",
    tipo: "ferias",
    periodoReferencia: "2026-06-01",
    situacao: "cancelada",
    prioridade: "informativa",
    motivoCodificado: "PERIODO_FERIAS_DEMO",
    detalhe:
      "Solicitação cancelada pelo próprio colaborador (exemplo ilustrativo).",
  },
];
