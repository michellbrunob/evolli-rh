/**
 * Dados sintéticos de "Ponto > Escalas e jornadas" (T095).
 *
 * Amostra puramente demonstrativa de referências técnicas de escala e
 * jornada por tipo de referência e escopo técnico — sem criar, atribuir,
 * ativar, desativar, calcular, marcar, ajustar, compensar, fechar, reabrir,
 * importar, exportar ou integrar escala/jornada real. Nenhuma linha
 * representa uma jornada aplicada, ativa ou marcação real; todas seguem
 * como referência em revisão, aguardando decisão ou histórico ilustrativo.
 */

export type SituacaoEscalasJornadas =
  | "referencia_em_revisao_exemplo"
  | "aguardando_decisao_exemplo"
  | "historico_ilustrativo";

export interface EscalaJornadaExemplo {
  readonly id: string;
  readonly jornadaIlustrativa: string;
  readonly tipoReferencia: string;
  readonly periodoIlustrativo: string;
  readonly escopoTecnico: string;
  readonly situacao: SituacaoEscalasJornadas;
  readonly responsavelTecnico: string;
  readonly trilhaAuditoria: string;
  readonly descricaoReferencia: string;
  readonly camposPendentes: readonly string[];
}

export const ROTULO_SITUACAO_ESCALAS_JORNADAS: Record<
  SituacaoEscalasJornadas,
  string
> = {
  referencia_em_revisao_exemplo: "Referência em revisão (exemplo)",
  aguardando_decisao_exemplo: "Aguardando decisão (exemplo)",
  historico_ilustrativo: "Histórico ilustrativo",
};

export const ESCALAS_JORNADAS_EXEMPLO: readonly EscalaJornadaExemplo[] = [
  {
    id: "ESJ-2026-0001",
    jornadaIlustrativa: "Jornada ilustrativa J-01 (exemplo)",
    tipoReferencia: "Tipo de referência T-01 (exemplo)",
    periodoIlustrativo: "Período P-01 (exemplo)",
    escopoTecnico: "Escopo E-01 (exemplo)",
    situacao: "referencia_em_revisao_exemplo",
    responsavelTecnico: "RT-Escalas-01 (exemplo)",
    trilhaAuditoria: "1 evento registrado (exemplo)",
    descricaoReferencia:
      "Registro de referência técnica de escala e jornada (exemplo ilustrativo, sem criação, atribuição ou ativação real).",
    camposPendentes: ["Validação RH (exemplo)"],
  },
  {
    id: "ESJ-2026-0002",
    jornadaIlustrativa: "Jornada ilustrativa J-02 (exemplo)",
    tipoReferencia: "Tipo de referência T-02 (exemplo)",
    periodoIlustrativo: "Período P-02 (exemplo)",
    escopoTecnico: "Escopo E-02 (exemplo)",
    situacao: "referencia_em_revisao_exemplo",
    responsavelTecnico: "RT-Escalas-02 (exemplo)",
    trilhaAuditoria: "1 evento registrado (exemplo)",
    descricaoReferencia:
      "Registro de referência técnica de escala e jornada (exemplo ilustrativo, sem criação, atribuição ou ativação real).",
    camposPendentes: [],
  },
  {
    id: "ESJ-2026-0003",
    jornadaIlustrativa: "Jornada ilustrativa J-01 (exemplo)",
    tipoReferencia: "Tipo de referência T-03 (exemplo)",
    periodoIlustrativo: "Período P-03 (exemplo)",
    escopoTecnico: "Escopo E-01 (exemplo)",
    situacao: "aguardando_decisao_exemplo",
    responsavelTecnico: "RT-Escalas-01 (exemplo)",
    trilhaAuditoria: "2 eventos registrados (exemplo)",
    descricaoReferencia:
      "Registro de referência técnica aguardando decisão formal (exemplo ilustrativo, sem criação, atribuição ou ativação real).",
    camposPendentes: [
      "Validação RH (exemplo)",
      "Reconhecimento formal (exemplo)",
    ],
  },
  {
    id: "ESJ-2026-0004",
    jornadaIlustrativa: "Jornada ilustrativa J-03 (exemplo)",
    tipoReferencia: "Tipo de referência T-04 (exemplo)",
    periodoIlustrativo: "Período P-04 (exemplo)",
    escopoTecnico: "Escopo E-03 (exemplo)",
    situacao: "aguardando_decisao_exemplo",
    responsavelTecnico: "RT-Escalas-03 (exemplo)",
    trilhaAuditoria: "2 eventos registrados (exemplo)",
    descricaoReferencia:
      "Registro de referência técnica aguardando decisão formal (exemplo ilustrativo, sem criação, atribuição ou ativação real).",
    camposPendentes: ["Aprovação de referência (exemplo)"],
  },
  {
    id: "ESJ-2026-0005",
    jornadaIlustrativa: "Jornada ilustrativa J-02 (exemplo)",
    tipoReferencia: "Tipo de referência T-01 (exemplo)",
    periodoIlustrativo: "Período P-05 (exemplo)",
    escopoTecnico: "Escopo E-02 (exemplo)",
    situacao: "referencia_em_revisao_exemplo",
    responsavelTecnico: "RT-Escalas-02 (exemplo)",
    trilhaAuditoria: "1 evento registrado (exemplo)",
    descricaoReferencia:
      "Registro de referência técnica de escala e jornada (exemplo ilustrativo, sem criação, atribuição ou ativação real).",
    camposPendentes: [],
  },
  {
    id: "ESJ-2025-0001",
    jornadaIlustrativa: "Jornada ilustrativa J-01 (exemplo)",
    tipoReferencia: "Tipo de referência T-02 (exemplo)",
    periodoIlustrativo: "Período P-06 (exemplo)",
    escopoTecnico: "Escopo E-03 (exemplo)",
    situacao: "historico_ilustrativo",
    responsavelTecnico: "RT-Escalas-03 (exemplo)",
    trilhaAuditoria: "3 eventos registrados (exemplo)",
    descricaoReferencia:
      "Exemplo de referência já registrada como histórico ilustrativo, sem efeito real sobre ponto, marcação ou Banco de Horas.",
    camposPendentes: [],
  },
  {
    id: "ESJ-2025-0002",
    jornadaIlustrativa: "Jornada ilustrativa J-04 (exemplo)",
    tipoReferencia: "Tipo de referência T-03 (exemplo)",
    periodoIlustrativo: "Período P-07 (exemplo)",
    escopoTecnico: "Escopo E-01 (exemplo)",
    situacao: "historico_ilustrativo",
    responsavelTecnico: "RT-Escalas-01 (exemplo)",
    trilhaAuditoria: "3 eventos registrados (exemplo)",
    descricaoReferencia:
      "Exemplo de referência já registrada como histórico ilustrativo, sem efeito real sobre ponto, marcação ou Banco de Horas.",
    camposPendentes: [],
  },
];
