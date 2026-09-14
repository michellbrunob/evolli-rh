/**
 * Dados sintéticos de "Relatórios > Justificativas" (T100).
 *
 * Amostra puramente demonstrativa de referências técnicas de justificativa
 * para consulta consolidada do RH — sem criar, editar, gerar, enviar,
 * anexar, receber, validar, aprovar, recusar, abonar, ajustar, fechar,
 * assinar, exportar, salvar, importar ou integrar justificativa real.
 * Nenhuma linha representa pessoa identificável, dado clínico, CID,
 * atestado, laudo, documento ou período real; todas seguem como referência
 * em revisão, aguardando decisão ou histórico ilustrativo.
 */

export type SituacaoRelatorioJustificativas =
  | "referencia_em_revisao_exemplo"
  | "aguardando_decisao_exemplo"
  | "historico_ilustrativo";

export const ROTULO_SITUACAO_RELATORIO_JUSTIFICATIVAS: Record<
  SituacaoRelatorioJustificativas,
  string
> = {
  referencia_em_revisao_exemplo: "Referência em revisão (exemplo)",
  aguardando_decisao_exemplo: "Aguardando decisão (exemplo)",
  historico_ilustrativo: "Histórico ilustrativo",
};

export interface RelatorioJustificativaExemplo {
  readonly id: string;
  readonly categoriaReferencia: string;
  readonly periodoIlustrativo: string;
  readonly visibilidadePrevista: string;
  readonly escopoTecnico: string;
  readonly situacao: SituacaoRelatorioJustificativas;
  readonly encaminhamentoReferencia: string;
  readonly trilhaAuditoria: string;
  readonly descricaoReferencia: string;
  readonly camposPendentes: readonly string[];
}

export const RELATORIO_JUSTIFICATIVAS_EXEMPLO: readonly RelatorioJustificativaExemplo[] =
  [
    {
      id: "RJU-2026-0001",
      categoriaReferencia: "Categoria de referência C-01 (exemplo)",
      periodoIlustrativo: "Período P-01 (exemplo)",
      visibilidadePrevista: "RH da unidade (exemplo)",
      escopoTecnico: "Escopo E-01 (exemplo)",
      situacao: "referencia_em_revisao_exemplo",
      encaminhamentoReferencia: "Encaminhado a RH (exemplo)",
      trilhaAuditoria: "1 evento registrado (exemplo)",
      descricaoReferencia:
        "Registro de referência técnica de justificativa (exemplo ilustrativo, sem geração, envio ou validação real).",
      camposPendentes: ["Validação RH (exemplo)"],
    },
    {
      id: "RJU-2026-0002",
      categoriaReferencia: "Categoria de referência C-02 (exemplo)",
      periodoIlustrativo: "Período P-02 (exemplo)",
      visibilidadePrevista: "RH e auditoria (exemplo)",
      escopoTecnico: "Escopo E-02 (exemplo)",
      situacao: "referencia_em_revisao_exemplo",
      encaminhamentoReferencia: "Encaminhado a liderança técnica (exemplo)",
      trilhaAuditoria: "1 evento registrado (exemplo)",
      descricaoReferencia:
        "Registro de referência técnica de justificativa (exemplo ilustrativo, sem geração, envio ou validação real).",
      camposPendentes: [],
    },
    {
      id: "RJU-2026-0003",
      categoriaReferencia: "Categoria de referência C-01 (exemplo)",
      periodoIlustrativo: "Período P-03 (exemplo)",
      visibilidadePrevista: "Somente RH central (exemplo)",
      escopoTecnico: "Escopo E-01 (exemplo)",
      situacao: "aguardando_decisao_exemplo",
      encaminhamentoReferencia: "Sem encaminhamento definido (exemplo)",
      trilhaAuditoria: "2 eventos registrados (exemplo)",
      descricaoReferencia:
        "Registro de referência técnica aguardando decisão formal (exemplo ilustrativo, sem geração, envio ou validação real).",
      camposPendentes: [
        "Validação RH (exemplo)",
        "Reconhecimento formal (exemplo)",
      ],
    },
    {
      id: "RJU-2026-0004",
      categoriaReferencia: "Categoria de referência C-03 (exemplo)",
      periodoIlustrativo: "Período P-04 (exemplo)",
      visibilidadePrevista: "RH da unidade (exemplo)",
      escopoTecnico: "Escopo E-03 (exemplo)",
      situacao: "aguardando_decisao_exemplo",
      encaminhamentoReferencia: "Encaminhado a RH (exemplo)",
      trilhaAuditoria: "2 eventos registrados (exemplo)",
      descricaoReferencia:
        "Registro de referência técnica aguardando decisão formal (exemplo ilustrativo, sem geração, envio ou validação real).",
      camposPendentes: ["Aprovação de referência (exemplo)"],
    },
    {
      id: "RJU-2026-0005",
      categoriaReferencia: "Categoria de referência C-02 (exemplo)",
      periodoIlustrativo: "Período P-05 (exemplo)",
      visibilidadePrevista: "RH e auditoria (exemplo)",
      escopoTecnico: "Escopo E-02 (exemplo)",
      situacao: "referencia_em_revisao_exemplo",
      encaminhamentoReferencia: "Sem encaminhamento definido (exemplo)",
      trilhaAuditoria: "1 evento registrado (exemplo)",
      descricaoReferencia:
        "Registro de referência técnica de justificativa (exemplo ilustrativo, sem geração, envio ou validação real).",
      camposPendentes: [],
    },
    {
      id: "RJU-2025-0001",
      categoriaReferencia: "Categoria de referência C-01 (exemplo)",
      periodoIlustrativo: "Período P-06 (exemplo)",
      visibilidadePrevista: "Somente RH central (exemplo)",
      escopoTecnico: "Escopo E-03 (exemplo)",
      situacao: "historico_ilustrativo",
      encaminhamentoReferencia: "Encaminhado a RH (exemplo)",
      trilhaAuditoria: "3 eventos registrados (exemplo)",
      descricaoReferencia:
        "Exemplo de referência já registrada como histórico ilustrativo, sem efeito real sobre marcação, ponto, jornada ou Banco de Horas.",
      camposPendentes: [],
    },
    {
      id: "RJU-2025-0002",
      categoriaReferencia: "Categoria de referência C-04 (exemplo)",
      periodoIlustrativo: "Período P-07 (exemplo)",
      visibilidadePrevista: "RH da unidade (exemplo)",
      escopoTecnico: "Escopo E-01 (exemplo)",
      situacao: "historico_ilustrativo",
      encaminhamentoReferencia: "Encaminhado a liderança técnica (exemplo)",
      trilhaAuditoria: "3 eventos registrados (exemplo)",
      descricaoReferencia:
        "Exemplo de referência já registrada como histórico ilustrativo, sem efeito real sobre marcação, ponto, jornada ou Banco de Horas.",
      camposPendentes: [],
    },
  ];
