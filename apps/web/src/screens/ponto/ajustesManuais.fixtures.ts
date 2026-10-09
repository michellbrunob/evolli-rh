/**
 * Dados sintéticos de "Ponto > Ajustes manuais" (T077).
 *
 * Amostra puramente demonstrativa de como o RH poderá revisar solicitações
 * de ajuste de marcação — sem apagar a marcação original, sem persistir
 * dados e sem executar qualquer regra trabalhista. Categorias, motivos,
 * situações e horários são todos ilustrativos; nenhum valor representa um
 * catálogo aprovado de RH/Jurídico nem uma marcação real.
 */

export type TipoAjuste =
  | "marcacao_ausente"
  | "divergencia_tecnica"
  | "ajuste_jornada"
  | "justificativa_pendente";

export type SituacaoAjuste =
  | "solicitado"
  | "em_revisao_rh"
  | "aguardando_justificativa"
  | "registrado_como_aditivo";

export type ValidacaoGestorAjuste =
  "pendente" | "recomendado" | "nao_recomendado";

export interface AjusteManualExemplo {
  readonly id: string;
  readonly periodoIlustrativo: string;
  readonly vinculoTecnico: string;
  readonly tipoAjuste: TipoAjuste;
  readonly motivoCodificado: string;
  readonly situacao: SituacaoAjuste;
  readonly validacaoGestor: ValidacaoGestorAjuste;
  readonly trilhaResumo: string;
  readonly horarioOriginalIlustrativo: string;
  readonly horarioPropostoIlustrativo: string;
  readonly descricaoSintetica: string;
}

export const ROTULO_TIPO_AJUSTE: Record<TipoAjuste, string> = {
  marcacao_ausente: "Marcação ausente",
  divergencia_tecnica: "Divergência técnica",
  ajuste_jornada: "Ajuste de jornada",
  justificativa_pendente: "Justificativa pendente",
};

export const ROTULO_SITUACAO_AJUSTE: Record<SituacaoAjuste, string> = {
  solicitado: "Solicitado",
  em_revisao_rh: "Em revisão do RH",
  aguardando_justificativa: "Aguardando justificativa",
  registrado_como_aditivo: "Registrado como aditivo (exemplo)",
};

export const ROTULO_VALIDACAO_GESTOR: Record<ValidacaoGestorAjuste, string> = {
  pendente: "Pendente",
  recomendado: "Recomendado pelo gestor",
  nao_recomendado: "Não recomendado pelo gestor",
};

export const AJUSTES_MANUAIS_EXEMPLO: readonly AjusteManualExemplo[] = [
  {
    id: "AJU-2026-0001",
    periodoIlustrativo: "2026-02-11",
    vinculoTecnico: "V-014",
    tipoAjuste: "marcacao_ausente",
    motivoCodificado: "MARCACAO_AUSENTE_DEMO",
    situacao: "solicitado",
    validacaoGestor: "pendente",
    trilhaResumo: "1 evento registrado (exemplo)",
    horarioOriginalIlustrativo: "Sem marcação registrada (exemplo)",
    horarioPropostoIlustrativo: "08:00 (ilustrativo)",
    descricaoSintetica:
      "Colaborador reporta marcação ausente no dia (exemplo ilustrativo).",
  },
  {
    id: "AJU-2026-0002",
    periodoIlustrativo: "2026-03-06",
    vinculoTecnico: "V-027",
    tipoAjuste: "divergencia_tecnica",
    motivoCodificado: "DIVERGENCIA_TECNICA_DEMO",
    situacao: "em_revisao_rh",
    validacaoGestor: "pendente",
    trilhaResumo: "2 eventos registrados (exemplo)",
    horarioOriginalIlustrativo: "08:32 (ilustrativo)",
    horarioPropostoIlustrativo: "08:00 (ilustrativo)",
    descricaoSintetica:
      "RH revisa divergência entre relógio e sistema (exemplo ilustrativo).",
  },
  {
    id: "AJU-2026-0003",
    periodoIlustrativo: "2026-04-14",
    vinculoTecnico: "V-033",
    tipoAjuste: "ajuste_jornada",
    motivoCodificado: "AJUSTE_JORNADA_DEMO",
    situacao: "aguardando_justificativa",
    validacaoGestor: "pendente",
    trilhaResumo: "1 evento registrado (exemplo)",
    horarioOriginalIlustrativo: "17:48 (ilustrativo)",
    horarioPropostoIlustrativo: "18:00 (ilustrativo)",
    descricaoSintetica:
      "Ajuste de encerramento de jornada aguardando justificativa (exemplo ilustrativo).",
  },
  {
    id: "AJU-2026-0004",
    periodoIlustrativo: "2026-05-19",
    vinculoTecnico: "V-041",
    tipoAjuste: "justificativa_pendente",
    motivoCodificado: "JUSTIFICATIVA_PENDENTE_DEMO",
    situacao: "aguardando_justificativa",
    validacaoGestor: "nao_recomendado",
    trilhaResumo: "2 eventos registrados (exemplo)",
    horarioOriginalIlustrativo: "12:05 (ilustrativo)",
    horarioPropostoIlustrativo: "12:00 (ilustrativo)",
    descricaoSintetica:
      "Justificativa do colaborador ainda pendente de anexo técnico (exemplo ilustrativo).",
  },
  {
    id: "AJU-2025-0001",
    periodoIlustrativo: "2025-07-09",
    vinculoTecnico: "V-058",
    tipoAjuste: "marcacao_ausente",
    motivoCodificado: "MARCACAO_AUSENTE_DEMO",
    situacao: "registrado_como_aditivo",
    validacaoGestor: "recomendado",
    trilhaResumo: "3 eventos registrados (exemplo)",
    horarioOriginalIlustrativo: "Sem marcação registrada (exemplo)",
    horarioPropostoIlustrativo: "08:15 (ilustrativo)",
    descricaoSintetica:
      "Exemplo de ajuste já registrado como evento aditivo, sem substituir a marcação original.",
  },
  {
    id: "AJU-2025-0002",
    periodoIlustrativo: "2025-10-06",
    vinculoTecnico: "V-062",
    tipoAjuste: "divergencia_tecnica",
    motivoCodificado: "DIVERGENCIA_TECNICA_DEMO",
    situacao: "registrado_como_aditivo",
    validacaoGestor: "recomendado",
    trilhaResumo: "3 eventos registrados (exemplo)",
    horarioOriginalIlustrativo: "09:10 (ilustrativo)",
    horarioPropostoIlustrativo: "09:00 (ilustrativo)",
    descricaoSintetica:
      "Exemplo de divergência técnica já registrada como evento aditivo (exemplo ilustrativo).",
  },
  {
    id: "AJU-2026-0005",
    periodoIlustrativo: "2026-11-04",
    vinculoTecnico: "V-070",
    tipoAjuste: "ajuste_jornada",
    motivoCodificado: "AJUSTE_JORNADA_DEMO",
    situacao: "em_revisao_rh",
    validacaoGestor: "recomendado",
    trilhaResumo: "2 eventos registrados (exemplo)",
    horarioOriginalIlustrativo: "13:02 (ilustrativo)",
    horarioPropostoIlustrativo: "13:00 (ilustrativo)",
    descricaoSintetica:
      "RH revisa recomendação do gestor para ajuste de jornada (exemplo ilustrativo).",
  },
];
