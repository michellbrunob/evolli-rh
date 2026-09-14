/**
 * Dados sintéticos de "Pessoas > Afastamentos" (T094).
 *
 * Amostra puramente demonstrativa de referências de acompanhamento por
 * categoria, visibilidade prevista e escopo técnico — sem identificar,
 * registrar, validar, diagnosticar, aprovar, conceder, retornar, calcular,
 * pagar, descontar, importar, exportar ou integrar afastamento real. Nenhuma
 * linha representa uma pessoa identificável, dado clínico ou afastamento
 * efetivado; todas seguem como referência em revisão, aguardando decisão ou
 * histórico ilustrativo.
 */

export type SituacaoAfastamentos =
  | "referencia_em_revisao_exemplo"
  | "aguardando_decisao_exemplo"
  | "historico_ilustrativo";

export interface AfastamentoExemplo {
  readonly id: string;
  readonly categoriaReferencia: string;
  readonly periodoIlustrativo: string;
  readonly visibilidadePrevista: string;
  readonly escopoTecnico: string;
  readonly situacao: SituacaoAfastamentos;
  readonly responsavelTecnico: string;
  readonly trilhaAuditoria: string;
  readonly descricaoReferencia: string;
  readonly camposPendentes: readonly string[];
}

export const ROTULO_SITUACAO_AFASTAMENTOS: Record<
  SituacaoAfastamentos,
  string
> = {
  referencia_em_revisao_exemplo: "Referência em revisão (exemplo)",
  aguardando_decisao_exemplo: "Aguardando decisão (exemplo)",
  historico_ilustrativo: "Histórico ilustrativo",
};

export const AFASTAMENTOS_EXEMPLO: readonly AfastamentoExemplo[] = [
  {
    id: "AFA-2026-0001",
    categoriaReferencia: "Categoria de referência A-01 (exemplo)",
    periodoIlustrativo: "Período P-01 (exemplo)",
    visibilidadePrevista: "RH da unidade (exemplo)",
    escopoTecnico: "Escopo E-01 (exemplo)",
    situacao: "referencia_em_revisao_exemplo",
    responsavelTecnico: "RT-Afastamentos-01 (exemplo)",
    trilhaAuditoria: "1 evento registrado (exemplo)",
    descricaoReferencia:
      "Registro de referência técnica de acompanhamento (exemplo ilustrativo, sem identificação, registro ou validação real).",
    camposPendentes: ["Validação RH (exemplo)"],
  },
  {
    id: "AFA-2026-0002",
    categoriaReferencia: "Categoria de referência A-02 (exemplo)",
    periodoIlustrativo: "Período P-02 (exemplo)",
    visibilidadePrevista: "RH e auditoria (exemplo)",
    escopoTecnico: "Escopo E-02 (exemplo)",
    situacao: "referencia_em_revisao_exemplo",
    responsavelTecnico: "RT-Afastamentos-02 (exemplo)",
    trilhaAuditoria: "1 evento registrado (exemplo)",
    descricaoReferencia:
      "Registro de referência técnica de acompanhamento (exemplo ilustrativo, sem identificação, registro ou validação real).",
    camposPendentes: [],
  },
  {
    id: "AFA-2026-0003",
    categoriaReferencia: "Categoria de referência A-01 (exemplo)",
    periodoIlustrativo: "Período P-03 (exemplo)",
    visibilidadePrevista: "Somente RH central (exemplo)",
    escopoTecnico: "Escopo E-01 (exemplo)",
    situacao: "aguardando_decisao_exemplo",
    responsavelTecnico: "RT-Afastamentos-01 (exemplo)",
    trilhaAuditoria: "2 eventos registrados (exemplo)",
    descricaoReferencia:
      "Registro de referência técnica aguardando decisão formal (exemplo ilustrativo, sem identificação, registro ou validação real).",
    camposPendentes: [
      "Validação RH (exemplo)",
      "Reconhecimento formal (exemplo)",
    ],
  },
  {
    id: "AFA-2026-0004",
    categoriaReferencia: "Categoria de referência A-03 (exemplo)",
    periodoIlustrativo: "Período P-04 (exemplo)",
    visibilidadePrevista: "RH da unidade (exemplo)",
    escopoTecnico: "Escopo E-03 (exemplo)",
    situacao: "aguardando_decisao_exemplo",
    responsavelTecnico: "RT-Afastamentos-03 (exemplo)",
    trilhaAuditoria: "2 eventos registrados (exemplo)",
    descricaoReferencia:
      "Registro de referência técnica aguardando decisão formal (exemplo ilustrativo, sem identificação, registro ou validação real).",
    camposPendentes: ["Aprovação de referência (exemplo)"],
  },
  {
    id: "AFA-2026-0005",
    categoriaReferencia: "Categoria de referência A-02 (exemplo)",
    periodoIlustrativo: "Período P-05 (exemplo)",
    visibilidadePrevista: "RH e auditoria (exemplo)",
    escopoTecnico: "Escopo E-02 (exemplo)",
    situacao: "referencia_em_revisao_exemplo",
    responsavelTecnico: "RT-Afastamentos-02 (exemplo)",
    trilhaAuditoria: "1 evento registrado (exemplo)",
    descricaoReferencia:
      "Registro de referência técnica de acompanhamento (exemplo ilustrativo, sem identificação, registro ou validação real).",
    camposPendentes: [],
  },
  {
    id: "AFA-2025-0001",
    categoriaReferencia: "Categoria de referência A-01 (exemplo)",
    periodoIlustrativo: "Período P-06 (exemplo)",
    visibilidadePrevista: "Somente RH central (exemplo)",
    escopoTecnico: "Escopo E-03 (exemplo)",
    situacao: "historico_ilustrativo",
    responsavelTecnico: "RT-Afastamentos-03 (exemplo)",
    trilhaAuditoria: "3 eventos registrados (exemplo)",
    descricaoReferencia:
      "Exemplo de referência já registrada como histórico ilustrativo, sem efeito real sobre vínculo, jornada, benefícios ou Folha.",
    camposPendentes: [],
  },
  {
    id: "AFA-2025-0002",
    categoriaReferencia: "Categoria de referência A-04 (exemplo)",
    periodoIlustrativo: "Período P-07 (exemplo)",
    visibilidadePrevista: "RH da unidade (exemplo)",
    escopoTecnico: "Escopo E-01 (exemplo)",
    situacao: "historico_ilustrativo",
    responsavelTecnico: "RT-Afastamentos-01 (exemplo)",
    trilhaAuditoria: "3 eventos registrados (exemplo)",
    descricaoReferencia:
      "Exemplo de referência já registrada como histórico ilustrativo, sem efeito real sobre vínculo, jornada, benefícios ou Folha.",
    camposPendentes: [],
  },
];
