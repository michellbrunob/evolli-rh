/**
 * Dados sintéticos de "Pessoas > Solicitações" (T091).
 *
 * Amostra puramente demonstrativa do catálogo e acompanhamento de
 * referências técnicas de solicitação por tipo e escopo técnico — sem abrir,
 * aprovar, recusar, cancelar, efetivar, assinar, anexar, notificar, importar,
 * exportar ou integrar solicitações reais. Nenhuma linha representa uma
 * solicitação ativa, aprovada ou concluída; todas seguem como referência em
 * revisão, aguardando decisão ou histórico ilustrativo.
 */

export type SituacaoSolicitacoes =
  | "referencia_em_revisao_exemplo"
  | "aguardando_decisao_exemplo"
  | "historico_ilustrativo";

export interface SolicitacaoExemplo {
  readonly id: string;
  readonly tipoSolicitacao: string;
  readonly periodoIlustrativo: string;
  readonly escopoTecnico: string;
  readonly situacao: SituacaoSolicitacoes;
  readonly encaminhamentoReferencia: string;
  readonly responsavelTecnico: string;
  readonly trilhaAuditoria: string;
  readonly descricaoReferencia: string;
  readonly camposPendentes: readonly string[];
}

export const ROTULO_SITUACAO_SOLICITACOES: Record<
  SituacaoSolicitacoes,
  string
> = {
  referencia_em_revisao_exemplo: "Referência em revisão (exemplo)",
  aguardando_decisao_exemplo: "Aguardando decisão (exemplo)",
  historico_ilustrativo: "Histórico ilustrativo",
};

export const SOLICITACOES_EXEMPLO: readonly SolicitacaoExemplo[] = [
  {
    id: "SOL-2026-0001",
    tipoSolicitacao: "Tipo de referência R-01 (exemplo)",
    periodoIlustrativo: "Período P-01 (exemplo)",
    escopoTecnico: "Escopo E-01 (exemplo)",
    situacao: "referencia_em_revisao_exemplo",
    encaminhamentoReferencia: "Em validação técnica (exemplo)",
    responsavelTecnico: "RT-Solicitacoes-01 (exemplo)",
    trilhaAuditoria: "1 evento registrado (exemplo)",
    descricaoReferencia:
      "Registro de referência técnica de acompanhamento de solicitação (exemplo ilustrativo, sem abertura, aprovação ou recusa real).",
    camposPendentes: ["Validação RH (exemplo)"],
  },
  {
    id: "SOL-2026-0002",
    tipoSolicitacao: "Tipo de referência R-02 (exemplo)",
    periodoIlustrativo: "Período P-02 (exemplo)",
    escopoTecnico: "Escopo E-02 (exemplo)",
    situacao: "referencia_em_revisao_exemplo",
    encaminhamentoReferencia: "Em validação técnica (exemplo)",
    responsavelTecnico: "RT-Solicitacoes-02 (exemplo)",
    trilhaAuditoria: "1 evento registrado (exemplo)",
    descricaoReferencia:
      "Registro de referência técnica de acompanhamento de solicitação (exemplo ilustrativo, sem abertura, aprovação ou recusa real).",
    camposPendentes: [],
  },
  {
    id: "SOL-2026-0003",
    tipoSolicitacao: "Tipo de referência R-01 (exemplo)",
    periodoIlustrativo: "Período P-03 (exemplo)",
    escopoTecnico: "Escopo E-01 (exemplo)",
    situacao: "aguardando_decisao_exemplo",
    encaminhamentoReferencia: "Aguardando retorno da unidade (exemplo)",
    responsavelTecnico: "RT-Solicitacoes-01 (exemplo)",
    trilhaAuditoria: "2 eventos registrados (exemplo)",
    descricaoReferencia:
      "Registro de referência técnica aguardando decisão formal (exemplo ilustrativo, sem abertura, aprovação ou recusa real).",
    camposPendentes: [
      "Validação RH (exemplo)",
      "Reconhecimento formal (exemplo)",
    ],
  },
  {
    id: "SOL-2026-0004",
    tipoSolicitacao: "Tipo de referência R-03 (exemplo)",
    periodoIlustrativo: "Período P-04 (exemplo)",
    escopoTecnico: "Escopo E-03 (exemplo)",
    situacao: "aguardando_decisao_exemplo",
    encaminhamentoReferencia: "Aguardando retorno da unidade (exemplo)",
    responsavelTecnico: "RT-Solicitacoes-03 (exemplo)",
    trilhaAuditoria: "2 eventos registrados (exemplo)",
    descricaoReferencia:
      "Registro de referência técnica aguardando decisão formal (exemplo ilustrativo, sem abertura, aprovação ou recusa real).",
    camposPendentes: ["Aprovação de referência (exemplo)"],
  },
  {
    id: "SOL-2026-0005",
    tipoSolicitacao: "Tipo de referência R-02 (exemplo)",
    periodoIlustrativo: "Período P-05 (exemplo)",
    escopoTecnico: "Escopo E-02 (exemplo)",
    situacao: "referencia_em_revisao_exemplo",
    encaminhamentoReferencia: "Em validação técnica (exemplo)",
    responsavelTecnico: "RT-Solicitacoes-02 (exemplo)",
    trilhaAuditoria: "1 evento registrado (exemplo)",
    descricaoReferencia:
      "Registro de referência técnica de acompanhamento de solicitação (exemplo ilustrativo, sem abertura, aprovação ou recusa real).",
    camposPendentes: [],
  },
  {
    id: "SOL-2025-0001",
    tipoSolicitacao: "Tipo de referência R-01 (exemplo)",
    periodoIlustrativo: "Período P-06 (exemplo)",
    escopoTecnico: "Escopo E-03 (exemplo)",
    situacao: "historico_ilustrativo",
    encaminhamentoReferencia: "Registrado como histórico (exemplo)",
    responsavelTecnico: "RT-Solicitacoes-03 (exemplo)",
    trilhaAuditoria: "3 eventos registrados (exemplo)",
    descricaoReferencia:
      "Exemplo de referência já registrada como histórico ilustrativo, sem efeito real sobre vínculo, ponto, Banco de Horas ou Folha.",
    camposPendentes: [],
  },
  {
    id: "SOL-2025-0002",
    tipoSolicitacao: "Tipo de referência R-04 (exemplo)",
    periodoIlustrativo: "Período P-07 (exemplo)",
    escopoTecnico: "Escopo E-01 (exemplo)",
    situacao: "historico_ilustrativo",
    encaminhamentoReferencia: "Registrado como histórico (exemplo)",
    responsavelTecnico: "RT-Solicitacoes-01 (exemplo)",
    trilhaAuditoria: "3 eventos registrados (exemplo)",
    descricaoReferencia:
      "Exemplo de referência já registrada como histórico ilustrativo, sem efeito real sobre vínculo, ponto, Banco de Horas ou Folha.",
    camposPendentes: [],
  },
];
