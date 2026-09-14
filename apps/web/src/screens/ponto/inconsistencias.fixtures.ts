/**
 * Dados sintéticos de "Ponto > Inconsistências" (T096).
 *
 * Amostra puramente demonstrativa de referências técnicas de inconsistência
 * de ponto — sem criar, editar, corrigir, ajustar, aprovar, recusar,
 * bloquear, fechar, reabrir, calcular, compensar, salvar, importar, exportar
 * ou integrar inconsistência real. Nenhuma linha altera marcação original,
 * ponto, vínculo, Banco de Horas, remuneração, benefícios, documentos,
 * permissões ou acessos.
 */

export type TipoInconsistencia =
  | "marcacao_ausente_exemplo"
  | "jornada_incompleta_exemplo"
  | "marcacao_fora_referencia_exemplo"
  | "compensacao_pendente_exemplo"
  | "dado_importacao_nao_associado_exemplo";

export const ROTULO_TIPO_INCONSISTENCIA: Record<TipoInconsistencia, string> = {
  marcacao_ausente_exemplo: "Marcação ausente (exemplo)",
  jornada_incompleta_exemplo: "Jornada incompleta (exemplo)",
  marcacao_fora_referencia_exemplo: "Marcação fora de referência (exemplo)",
  compensacao_pendente_exemplo: "Compensação pendente (exemplo)",
  dado_importacao_nao_associado_exemplo:
    "Dado de importação não associado (exemplo)",
};

export type PrioridadeInconsistencia =
  "baixa_exemplo" | "media_exemplo" | "alta_exemplo";

export const ROTULO_PRIORIDADE_INCONSISTENCIA: Record<
  PrioridadeInconsistencia,
  string
> = {
  baixa_exemplo: "Prioridade baixa (exemplo)",
  media_exemplo: "Prioridade média (exemplo)",
  alta_exemplo: "Prioridade alta (exemplo)",
};

export type SituacaoInconsistencia =
  | "aguardando_analise_exemplo"
  | "em_verificacao_exemplo"
  | "historico_ilustrativo";

export const ROTULO_SITUACAO_INCONSISTENCIA: Record<
  SituacaoInconsistencia,
  string
> = {
  aguardando_analise_exemplo: "Aguardando análise (exemplo)",
  em_verificacao_exemplo: "Em verificação (exemplo)",
  historico_ilustrativo: "Histórico ilustrativo",
};

export interface InconsistenciaExemplo {
  readonly id: string;
  readonly tipoInconsistencia: TipoInconsistencia;
  readonly periodoIlustrativo: string;
  readonly escopoTecnico: string;
  readonly prioridade: PrioridadeInconsistencia;
  readonly situacao: SituacaoInconsistencia;
  readonly encaminhamentoReferencia: string;
  readonly trilhaAuditoria: string;
  readonly descricaoReferencia: string;
  readonly camposPendentes: readonly string[];
}

export const INCONSISTENCIAS_EXEMPLO: readonly InconsistenciaExemplo[] = [
  {
    id: "INC-2026-0001",
    tipoInconsistencia: "marcacao_ausente_exemplo",
    periodoIlustrativo: "Período P-01 (exemplo)",
    escopoTecnico: "Escopo E-01 (exemplo)",
    prioridade: "alta_exemplo",
    situacao: "aguardando_analise_exemplo",
    encaminhamentoReferencia: "Encaminhado a RH (exemplo)",
    trilhaAuditoria: "1 evento registrado (exemplo)",
    descricaoReferencia:
      "Registro de referência técnica de inconsistência de ponto (exemplo ilustrativo, sem correção, ajuste ou aprovação real).",
    camposPendentes: ["Análise RH (exemplo)"],
  },
  {
    id: "INC-2026-0002",
    tipoInconsistencia: "jornada_incompleta_exemplo",
    periodoIlustrativo: "Período P-02 (exemplo)",
    escopoTecnico: "Escopo E-02 (exemplo)",
    prioridade: "media_exemplo",
    situacao: "em_verificacao_exemplo",
    encaminhamentoReferencia: "Encaminhado a liderança técnica (exemplo)",
    trilhaAuditoria: "2 eventos registrados (exemplo)",
    descricaoReferencia:
      "Registro de referência técnica de inconsistência de ponto (exemplo ilustrativo, sem correção, ajuste ou aprovação real).",
    camposPendentes: [],
  },
  {
    id: "INC-2026-0003",
    tipoInconsistencia: "marcacao_fora_referencia_exemplo",
    periodoIlustrativo: "Período P-03 (exemplo)",
    escopoTecnico: "Escopo E-01 (exemplo)",
    prioridade: "alta_exemplo",
    situacao: "aguardando_analise_exemplo",
    encaminhamentoReferencia: "Sem encaminhamento definido (exemplo)",
    trilhaAuditoria: "1 evento registrado (exemplo)",
    descricaoReferencia:
      "Registro de referência técnica aguardando análise formal (exemplo ilustrativo, sem correção, ajuste ou aprovação real).",
    camposPendentes: ["Análise RH (exemplo)", "Confirmação técnica (exemplo)"],
  },
  {
    id: "INC-2026-0004",
    tipoInconsistencia: "compensacao_pendente_exemplo",
    periodoIlustrativo: "Período P-04 (exemplo)",
    escopoTecnico: "Escopo E-03 (exemplo)",
    prioridade: "media_exemplo",
    situacao: "em_verificacao_exemplo",
    encaminhamentoReferencia: "Encaminhado a RH (exemplo)",
    trilhaAuditoria: "2 eventos registrados (exemplo)",
    descricaoReferencia:
      "Registro de referência técnica em verificação (exemplo ilustrativo, sem correção, ajuste ou aprovação real).",
    camposPendentes: ["Confirmação técnica (exemplo)"],
  },
  {
    id: "INC-2026-0005",
    tipoInconsistencia: "dado_importacao_nao_associado_exemplo",
    periodoIlustrativo: "Período P-05 (exemplo)",
    escopoTecnico: "Escopo E-02 (exemplo)",
    prioridade: "baixa_exemplo",
    situacao: "aguardando_analise_exemplo",
    encaminhamentoReferencia: "Sem encaminhamento definido (exemplo)",
    trilhaAuditoria: "1 evento registrado (exemplo)",
    descricaoReferencia:
      "Registro de referência técnica de dado de importação não associado (exemplo ilustrativo, sem correção, ajuste ou aprovação real).",
    camposPendentes: [],
  },
  {
    id: "INC-2025-0001",
    tipoInconsistencia: "marcacao_ausente_exemplo",
    periodoIlustrativo: "Período P-06 (exemplo)",
    escopoTecnico: "Escopo E-03 (exemplo)",
    prioridade: "baixa_exemplo",
    situacao: "historico_ilustrativo",
    encaminhamentoReferencia: "Encaminhado a RH (exemplo)",
    trilhaAuditoria: "3 eventos registrados (exemplo)",
    descricaoReferencia:
      "Exemplo de referência já registrada como histórico ilustrativo, sem efeito real sobre ponto, marcação ou Banco de Horas.",
    camposPendentes: [],
  },
  {
    id: "INC-2025-0002",
    tipoInconsistencia: "jornada_incompleta_exemplo",
    periodoIlustrativo: "Período P-07 (exemplo)",
    escopoTecnico: "Escopo E-01 (exemplo)",
    prioridade: "media_exemplo",
    situacao: "historico_ilustrativo",
    encaminhamentoReferencia: "Encaminhado a liderança técnica (exemplo)",
    trilhaAuditoria: "3 eventos registrados (exemplo)",
    descricaoReferencia:
      "Exemplo de referência já registrada como histórico ilustrativo, sem efeito real sobre ponto, marcação ou Banco de Horas.",
    camposPendentes: [],
  },
];
