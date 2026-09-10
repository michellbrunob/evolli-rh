/**
 * Dados sintéticos de "Cadastros > Motivos de ausência e justificativas"
 * (T081).
 *
 * Amostra puramente demonstrativa de como o RH poderá consultar referências
 * de motivo de ausência e justificativa por escopo organizacional técnico —
 * sem efetivar abono, ajuste, lançamento ou alteração de ponto. Nenhuma
 * linha representa um item aprovado, ativo, aplicado ou operacional; todas
 * seguem como referência em revisão, aguardando decisão ou histórico
 * ilustrativo.
 */

export type TipoReferenciaMotivoJustificativa =
  "motivo_ausencia" | "justificativa";

export type SituacaoMotivoJustificativa =
  | "referencia_em_revisao_exemplo"
  | "aguardando_decisao_exemplo"
  | "historico_ilustrativo";

export interface MotivoJustificativaExemplo {
  readonly id: string;
  readonly tipoReferencia: TipoReferenciaMotivoJustificativa;
  readonly motivoJustificativa: string;
  readonly escopoOrganizacionalTecnico: string;
  readonly exigenciaEvidencia: string;
  readonly situacao: SituacaoMotivoJustificativa;
  readonly responsavelTecnico: string;
  readonly trilhaAuditoria: string;
  readonly descricaoReferencia: string;
  readonly evidenciaIlustrativa: string;
  readonly camposPendentes: readonly string[];
}

export const ROTULO_TIPO_REFERENCIA: Record<
  TipoReferenciaMotivoJustificativa,
  string
> = {
  motivo_ausencia: "Motivo de ausência (exemplo)",
  justificativa: "Justificativa (exemplo)",
};

export const ROTULO_SITUACAO_MOTIVO_JUSTIFICATIVA: Record<
  SituacaoMotivoJustificativa,
  string
> = {
  referencia_em_revisao_exemplo: "Referência em revisão (exemplo)",
  aguardando_decisao_exemplo: "Aguardando decisão (exemplo)",
  historico_ilustrativo: "Histórico ilustrativo",
};

export const MOTIVOS_AUSENCIA_JUSTIFICATIVAS_EXEMPLO: readonly MotivoJustificativaExemplo[] =
  [
    {
      id: "MAJ-2026-0001",
      tipoReferencia: "motivo_ausencia",
      motivoJustificativa: "Motivo de referência A (exemplo)",
      escopoOrganizacionalTecnico: "Unidade U-01 (exemplo)",
      exigenciaEvidencia: "Evidência ilustrativa pendente (exemplo)",
      situacao: "referencia_em_revisao_exemplo",
      responsavelTecnico: "RT-Justificativas-01 (exemplo)",
      trilhaAuditoria: "1 evento registrado (exemplo)",
      descricaoReferencia:
        "Registro de referência técnica para motivo de ausência (exemplo ilustrativo).",
      evidenciaIlustrativa:
        "Evidência ilustrativa: registro técnico pendente (exemplo, sem documento ou dado médico).",
      camposPendentes: [
        "Reconhecimento formal (exemplo)",
        "Validação RH (exemplo)",
      ],
    },
    {
      id: "MAJ-2026-0002",
      tipoReferencia: "justificativa",
      motivoJustificativa: "Justificativa de referência A (exemplo)",
      escopoOrganizacionalTecnico: "Unidade U-02 (exemplo)",
      exigenciaEvidencia: "Evidência não exigida (exemplo)",
      situacao: "referencia_em_revisao_exemplo",
      responsavelTecnico: "RT-Justificativas-02 (exemplo)",
      trilhaAuditoria: "1 evento registrado (exemplo)",
      descricaoReferencia:
        "Registro de referência técnica para justificativa (exemplo ilustrativo).",
      evidenciaIlustrativa:
        "Evidência ilustrativa: não exigida para este tipo de referência (exemplo).",
      camposPendentes: ["Validação RH (exemplo)"],
    },
    {
      id: "MAJ-2026-0003",
      tipoReferencia: "motivo_ausencia",
      motivoJustificativa: "Motivo de referência B (exemplo)",
      escopoOrganizacionalTecnico: "Unidade U-01 (exemplo)",
      exigenciaEvidencia: "Evidência ilustrativa pendente (exemplo)",
      situacao: "aguardando_decisao_exemplo",
      responsavelTecnico: "RT-Justificativas-01 (exemplo)",
      trilhaAuditoria: "2 eventos registrados (exemplo)",
      descricaoReferencia:
        "Registro de referência técnica aguardando decisão formal (exemplo ilustrativo).",
      evidenciaIlustrativa:
        "Evidência ilustrativa: registro técnico pendente (exemplo, sem documento ou dado médico).",
      camposPendentes: ["Reconhecimento formal (exemplo)", "Abono (exemplo)"],
    },
    {
      id: "MAJ-2026-0004",
      tipoReferencia: "justificativa",
      motivoJustificativa: "Justificativa de referência B (exemplo)",
      escopoOrganizacionalTecnico: "Unidade U-03 (exemplo)",
      exigenciaEvidencia: "Evidência ilustrativa pendente (exemplo)",
      situacao: "aguardando_decisao_exemplo",
      responsavelTecnico: "RT-Justificativas-03 (exemplo)",
      trilhaAuditoria: "2 eventos registrados (exemplo)",
      descricaoReferencia:
        "Registro de referência técnica aguardando decisão formal (exemplo ilustrativo).",
      evidenciaIlustrativa:
        "Evidência ilustrativa: registro técnico pendente (exemplo, sem documento ou dado médico).",
      camposPendentes: ["Aprovação de referência (exemplo)"],
    },
    {
      id: "MAJ-2026-0005",
      tipoReferencia: "motivo_ausencia",
      motivoJustificativa: "Motivo de referência C (exemplo)",
      escopoOrganizacionalTecnico: "Unidade U-02 (exemplo)",
      exigenciaEvidencia: "Evidência não exigida (exemplo)",
      situacao: "referencia_em_revisao_exemplo",
      responsavelTecnico: "RT-Justificativas-02 (exemplo)",
      trilhaAuditoria: "1 evento registrado (exemplo)",
      descricaoReferencia:
        "Registro de referência técnica para motivo de ausência (exemplo ilustrativo).",
      evidenciaIlustrativa:
        "Evidência ilustrativa: não exigida para este tipo de referência (exemplo).",
      camposPendentes: [],
    },
    {
      id: "MAJ-2026-0006",
      tipoReferencia: "justificativa",
      motivoJustificativa: "Justificativa de referência C (exemplo)",
      escopoOrganizacionalTecnico: "Unidade U-01 (exemplo)",
      exigenciaEvidencia: "Evidência ilustrativa registrada (exemplo)",
      situacao: "aguardando_decisao_exemplo",
      responsavelTecnico: "RT-Justificativas-01 (exemplo)",
      trilhaAuditoria: "2 eventos registrados (exemplo)",
      descricaoReferencia:
        "Registro de referência técnica aguardando decisão formal (exemplo ilustrativo).",
      evidenciaIlustrativa:
        "Evidência ilustrativa: registro técnico já lançado (exemplo, sem documento ou dado médico).",
      camposPendentes: ["Validação RH (exemplo)"],
    },
    {
      id: "MAJ-2025-0001",
      tipoReferencia: "motivo_ausencia",
      motivoJustificativa: "Motivo de referência A (exemplo)",
      escopoOrganizacionalTecnico: "Unidade U-03 (exemplo)",
      exigenciaEvidencia: "Evidência ilustrativa registrada (exemplo)",
      situacao: "historico_ilustrativo",
      responsavelTecnico: "RT-Justificativas-03 (exemplo)",
      trilhaAuditoria: "3 eventos registrados (exemplo)",
      descricaoReferencia:
        "Exemplo de referência já registrada como histórico ilustrativo, sem efeito operacional.",
      evidenciaIlustrativa:
        "Evidência ilustrativa: registro técnico já lançado (exemplo, sem documento ou dado médico).",
      camposPendentes: [],
    },
    {
      id: "MAJ-2025-0002",
      tipoReferencia: "justificativa",
      motivoJustificativa: "Justificativa de referência A (exemplo)",
      escopoOrganizacionalTecnico: "Unidade U-02 (exemplo)",
      exigenciaEvidencia: "Evidência ilustrativa registrada (exemplo)",
      situacao: "historico_ilustrativo",
      responsavelTecnico: "RT-Justificativas-02 (exemplo)",
      trilhaAuditoria: "3 eventos registrados (exemplo)",
      descricaoReferencia:
        "Exemplo de referência já registrada como histórico ilustrativo, sem efeito operacional.",
      evidenciaIlustrativa:
        "Evidência ilustrativa: registro técnico já lançado (exemplo, sem documento ou dado médico).",
      camposPendentes: [],
    },
  ];
