/**
 * Dados sintéticos de "Pessoas > Histórico funcional" (T088).
 *
 * Amostra puramente demonstrativa de como o RH poderá consultar referências
 * de vínculo e movimentação funcional por referência organizacional — sem
 * criar, alterar, reconhecer, aprovar ou encerrar vínculo, cargo, função,
 * salário, jornada, ponto, documentos, Banco de Horas, Folha, permissão ou
 * acesso. Nenhuma linha representa um vínculo ou evento ativo, aprovado,
 * operacional ou aplicado; todas seguem como referência em revisão,
 * aguardando decisão ou histórico ilustrativo.
 */

export type SituacaoHistoricoFuncional =
  | "referencia_em_revisao_exemplo"
  | "aguardando_decisao_exemplo"
  | "historico_ilustrativo";

export interface HistoricoFuncionalExemplo {
  readonly id: string;
  readonly vinculoTecnico: string;
  readonly tipoEventoIlustrativo: string;
  readonly referenciaOrganizacional: string;
  readonly periodoIlustrativo: string;
  readonly situacao: SituacaoHistoricoFuncional;
  readonly responsavelTecnico: string;
  readonly trilhaAuditoria: string;
  readonly descricaoReferencia: string;
  readonly camposPendentes: readonly string[];
}

export const ROTULO_SITUACAO_HISTORICO_FUNCIONAL: Record<
  SituacaoHistoricoFuncional,
  string
> = {
  referencia_em_revisao_exemplo: "Referência em revisão (exemplo)",
  aguardando_decisao_exemplo: "Aguardando decisão (exemplo)",
  historico_ilustrativo: "Histórico ilustrativo",
};

export const HISTORICO_FUNCIONAL_EXEMPLO: readonly HistoricoFuncionalExemplo[] =
  [
    {
      id: "HF-2026-0001",
      vinculoTecnico: "Vínculo V-01 (exemplo)",
      tipoEventoIlustrativo: "Admissão ilustrativa (exemplo)",
      referenciaOrganizacional: "Org O-01 (exemplo)",
      periodoIlustrativo: "Período P-01 (exemplo)",
      situacao: "referencia_em_revisao_exemplo",
      responsavelTecnico: "RT-Historico-01 (exemplo)",
      trilhaAuditoria: "1 evento registrado (exemplo)",
      descricaoReferencia:
        "Registro de referência técnica de vínculo e movimentação funcional (exemplo ilustrativo, sem alteração real de cargo, salário ou vínculo).",
      camposPendentes: ["Validação RH (exemplo)"],
    },
    {
      id: "HF-2026-0002",
      vinculoTecnico: "Vínculo V-02 (exemplo)",
      tipoEventoIlustrativo: "Transferência ilustrativa (exemplo)",
      referenciaOrganizacional: "Org O-02 (exemplo)",
      periodoIlustrativo: "Período P-02 (exemplo)",
      situacao: "referencia_em_revisao_exemplo",
      responsavelTecnico: "RT-Historico-02 (exemplo)",
      trilhaAuditoria: "1 evento registrado (exemplo)",
      descricaoReferencia:
        "Registro de referência técnica de vínculo e movimentação funcional (exemplo ilustrativo, sem alteração real de cargo, salário ou vínculo).",
      camposPendentes: [],
    },
    {
      id: "HF-2026-0003",
      vinculoTecnico: "Vínculo V-01 (exemplo)",
      tipoEventoIlustrativo: "Promoção ilustrativa (exemplo)",
      referenciaOrganizacional: "Org O-01 (exemplo)",
      periodoIlustrativo: "Período P-03 (exemplo)",
      situacao: "aguardando_decisao_exemplo",
      responsavelTecnico: "RT-Historico-01 (exemplo)",
      trilhaAuditoria: "2 eventos registrados (exemplo)",
      descricaoReferencia:
        "Registro de referência técnica aguardando decisão formal (exemplo ilustrativo, sem alteração real de cargo, salário ou vínculo).",
      camposPendentes: [
        "Validação RH (exemplo)",
        "Reconhecimento formal (exemplo)",
      ],
    },
    {
      id: "HF-2026-0004",
      vinculoTecnico: "Vínculo V-03 (exemplo)",
      tipoEventoIlustrativo: "Afastamento ilustrativo (exemplo)",
      referenciaOrganizacional: "Org O-03 (exemplo)",
      periodoIlustrativo: "Período P-04 (exemplo)",
      situacao: "aguardando_decisao_exemplo",
      responsavelTecnico: "RT-Historico-03 (exemplo)",
      trilhaAuditoria: "2 eventos registrados (exemplo)",
      descricaoReferencia:
        "Registro de referência técnica aguardando decisão formal (exemplo ilustrativo, sem alteração real de cargo, salário ou vínculo).",
      camposPendentes: ["Aprovação de referência (exemplo)"],
    },
    {
      id: "HF-2026-0005",
      vinculoTecnico: "Vínculo V-02 (exemplo)",
      tipoEventoIlustrativo: "Retorno ilustrativo (exemplo)",
      referenciaOrganizacional: "Org O-02 (exemplo)",
      periodoIlustrativo: "Período P-05 (exemplo)",
      situacao: "referencia_em_revisao_exemplo",
      responsavelTecnico: "RT-Historico-02 (exemplo)",
      trilhaAuditoria: "1 evento registrado (exemplo)",
      descricaoReferencia:
        "Registro de referência técnica de vínculo e movimentação funcional (exemplo ilustrativo, sem alteração real de cargo, salário ou vínculo).",
      camposPendentes: [],
    },
    {
      id: "HF-2025-0001",
      vinculoTecnico: "Vínculo V-01 (exemplo)",
      tipoEventoIlustrativo: "Admissão ilustrativa (exemplo)",
      referenciaOrganizacional: "Org O-03 (exemplo)",
      periodoIlustrativo: "Período P-06 (exemplo)",
      situacao: "historico_ilustrativo",
      responsavelTecnico: "RT-Historico-03 (exemplo)",
      trilhaAuditoria: "3 eventos registrados (exemplo)",
      descricaoReferencia:
        "Exemplo de referência já registrada como histórico ilustrativo, sem efeito real sobre vínculo, cargo, salário ou Folha.",
      camposPendentes: [],
    },
    {
      id: "HF-2025-0002",
      vinculoTecnico: "Vínculo V-04 (exemplo)",
      tipoEventoIlustrativo: "Desligamento ilustrativo (exemplo)",
      referenciaOrganizacional: "Org O-01 (exemplo)",
      periodoIlustrativo: "Período P-07 (exemplo)",
      situacao: "historico_ilustrativo",
      responsavelTecnico: "RT-Historico-01 (exemplo)",
      trilhaAuditoria: "3 eventos registrados (exemplo)",
      descricaoReferencia:
        "Exemplo de referência já registrada como histórico ilustrativo, sem efeito real sobre vínculo, cargo, salário ou Folha.",
      camposPendentes: [],
    },
  ];
