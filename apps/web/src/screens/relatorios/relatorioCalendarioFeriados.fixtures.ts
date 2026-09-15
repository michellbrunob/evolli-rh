/**
 * Dados sintéticos de "Relatórios > Calendário de Feriados" (T102).
 *
 * Amostra puramente demonstrativa de referências técnicas de calendário por
 * categoria, escopo técnico e abrangência ilustrativa — sem criar, editar,
 * importar, ativar, desativar, aplicar, atribuir, recalcular, marcar,
 * ajustar, compensar, fechar, salvar, gerar, exportar ou integrar calendário
 * real. Nenhuma linha representa nome oficial de feriado, data real,
 * localidade real, pessoa, empresa ou unidade real; todas seguem como
 * referência em revisão, aguardando decisão ou histórico ilustrativo.
 */

export type SituacaoRelatorioCalendarioFeriados =
  | "referencia_em_revisao_exemplo"
  | "aguardando_decisao_exemplo"
  | "historico_ilustrativo";

export const ROTULO_SITUACAO_RELATORIO_CALENDARIO_FERIADOS: Record<
  SituacaoRelatorioCalendarioFeriados,
  string
> = {
  referencia_em_revisao_exemplo: "Referência em revisão (exemplo)",
  aguardando_decisao_exemplo: "Aguardando decisão (exemplo)",
  historico_ilustrativo: "Histórico ilustrativo",
};

export interface RelatorioCalendarioFeriadoExemplo {
  readonly id: string;
  readonly periodoIlustrativo: string;
  readonly categoriaReferencia: string;
  readonly escopoTecnico: string;
  readonly abrangenciaIlustrativa: string;
  readonly situacao: SituacaoRelatorioCalendarioFeriados;
  readonly responsavelTecnico: string;
  readonly trilhaAuditoria: string;
  readonly descricaoReferencia: string;
  readonly camposPendentes: readonly string[];
}

export const RELATORIO_CALENDARIO_FERIADOS_EXEMPLO: readonly RelatorioCalendarioFeriadoExemplo[] =
  [
    {
      id: "CFR-2026-0001",
      periodoIlustrativo: "Período P-01 (exemplo)",
      categoriaReferencia: "Categoria de referência C-01 (exemplo)",
      escopoTecnico: "Escopo E-01 (exemplo)",
      abrangenciaIlustrativa: "Abrangência ilustrativa A-01 (exemplo)",
      situacao: "referencia_em_revisao_exemplo",
      responsavelTecnico: "RT-Calendario-01 (exemplo)",
      trilhaAuditoria: "1 evento registrado (exemplo)",
      descricaoReferencia:
        "Registro de referência técnica de calendário (exemplo ilustrativo, sem criação, importação ou ativação real).",
      camposPendentes: ["Validação RH (exemplo)"],
    },
    {
      id: "CFR-2026-0002",
      periodoIlustrativo: "Período P-02 (exemplo)",
      categoriaReferencia: "Categoria de referência C-02 (exemplo)",
      escopoTecnico: "Escopo E-02 (exemplo)",
      abrangenciaIlustrativa: "Abrangência ilustrativa A-02 (exemplo)",
      situacao: "referencia_em_revisao_exemplo",
      responsavelTecnico: "RT-Calendario-02 (exemplo)",
      trilhaAuditoria: "1 evento registrado (exemplo)",
      descricaoReferencia:
        "Registro de referência técnica de calendário (exemplo ilustrativo, sem criação, importação ou ativação real).",
      camposPendentes: [],
    },
    {
      id: "CFR-2026-0003",
      periodoIlustrativo: "Período P-03 (exemplo)",
      categoriaReferencia: "Categoria de referência C-01 (exemplo)",
      escopoTecnico: "Escopo E-01 (exemplo)",
      abrangenciaIlustrativa: "Abrangência ilustrativa A-01 (exemplo)",
      situacao: "aguardando_decisao_exemplo",
      responsavelTecnico: "RT-Calendario-01 (exemplo)",
      trilhaAuditoria: "2 eventos registrados (exemplo)",
      descricaoReferencia:
        "Registro de referência técnica aguardando decisão formal (exemplo ilustrativo, sem criação, importação ou ativação real).",
      camposPendentes: [
        "Validação RH (exemplo)",
        "Reconhecimento formal (exemplo)",
      ],
    },
    {
      id: "CFR-2026-0004",
      periodoIlustrativo: "Período P-04 (exemplo)",
      categoriaReferencia: "Categoria de referência C-03 (exemplo)",
      escopoTecnico: "Escopo E-03 (exemplo)",
      abrangenciaIlustrativa: "Abrangência ilustrativa A-03 (exemplo)",
      situacao: "aguardando_decisao_exemplo",
      responsavelTecnico: "RT-Calendario-03 (exemplo)",
      trilhaAuditoria: "2 eventos registrados (exemplo)",
      descricaoReferencia:
        "Registro de referência técnica aguardando decisão formal (exemplo ilustrativo, sem criação, importação ou ativação real).",
      camposPendentes: ["Aprovação de referência (exemplo)"],
    },
    {
      id: "CFR-2026-0005",
      periodoIlustrativo: "Período P-05 (exemplo)",
      categoriaReferencia: "Categoria de referência C-02 (exemplo)",
      escopoTecnico: "Escopo E-02 (exemplo)",
      abrangenciaIlustrativa: "Abrangência ilustrativa A-02 (exemplo)",
      situacao: "referencia_em_revisao_exemplo",
      responsavelTecnico: "RT-Calendario-02 (exemplo)",
      trilhaAuditoria: "1 evento registrado (exemplo)",
      descricaoReferencia:
        "Registro de referência técnica de calendário (exemplo ilustrativo, sem criação, importação ou ativação real).",
      camposPendentes: [],
    },
    {
      id: "CFR-2025-0001",
      periodoIlustrativo: "Período P-06 (exemplo)",
      categoriaReferencia: "Categoria de referência C-01 (exemplo)",
      escopoTecnico: "Escopo E-03 (exemplo)",
      abrangenciaIlustrativa: "Abrangência ilustrativa A-04 (exemplo)",
      situacao: "historico_ilustrativo",
      responsavelTecnico: "RT-Calendario-03 (exemplo)",
      trilhaAuditoria: "3 eventos registrados (exemplo)",
      descricaoReferencia:
        "Exemplo de referência já registrada como histórico ilustrativo, sem efeito real sobre unidade, escala, jornada ou ponto.",
      camposPendentes: [],
    },
    {
      id: "CFR-2025-0002",
      periodoIlustrativo: "Período P-07 (exemplo)",
      categoriaReferencia: "Categoria de referência C-04 (exemplo)",
      escopoTecnico: "Escopo E-01 (exemplo)",
      abrangenciaIlustrativa: "Abrangência ilustrativa A-01 (exemplo)",
      situacao: "historico_ilustrativo",
      responsavelTecnico: "RT-Calendario-01 (exemplo)",
      trilhaAuditoria: "3 eventos registrados (exemplo)",
      descricaoReferencia:
        "Exemplo de referência já registrada como histórico ilustrativo, sem efeito real sobre unidade, escala, jornada ou ponto.",
      camposPendentes: [],
    },
  ];
