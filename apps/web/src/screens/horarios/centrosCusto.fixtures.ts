/**
 * Dados sintéticos de "Cadastros > Centros de custo" (T083).
 *
 * Amostra puramente demonstrativa de como o RH poderá consultar referências
 * organizacionais de centro de custo por empresa/unidade e estrutura técnica
 * — sem criar rateio, orçamento, lançamento contábil, regra de Folha ou
 * permissão de acesso real. Nenhuma linha representa um centro de custo
 * ativo, aprovado ou operacional; todas seguem como referência em revisão,
 * aguardando decisão ou histórico ilustrativo.
 */

export type SituacaoCentroCusto =
  | "referencia_em_revisao_exemplo"
  | "aguardando_decisao_exemplo"
  | "historico_ilustrativo";

export interface CentroCustoExemplo {
  readonly id: string;
  readonly codigoTecnico: string;
  readonly centroCusto: string;
  readonly empresaUnidadeTecnica: string;
  readonly estruturaDepartamentoTecnico: string;
  readonly situacao: SituacaoCentroCusto;
  readonly responsavelTecnico: string;
  readonly trilhaAuditoria: string;
  readonly descricaoReferencia: string;
  readonly camposPendentes: readonly string[];
}

export const ROTULO_SITUACAO_CENTRO_CUSTO: Record<SituacaoCentroCusto, string> =
  {
    referencia_em_revisao_exemplo: "Referência em revisão (exemplo)",
    aguardando_decisao_exemplo: "Aguardando decisão (exemplo)",
    historico_ilustrativo: "Histórico ilustrativo",
  };

export const CENTROS_CUSTO_EXEMPLO: readonly CentroCustoExemplo[] = [
  {
    id: "CC-2026-0001",
    codigoTecnico: "CTEC-001 (exemplo)",
    centroCusto: "Centro de custo de referência A (exemplo)",
    empresaUnidadeTecnica: "Unidade U-01 (exemplo)",
    estruturaDepartamentoTecnico: "Departamento técnico D-01 (exemplo)",
    situacao: "referencia_em_revisao_exemplo",
    responsavelTecnico: "RT-CentroCusto-01 (exemplo)",
    trilhaAuditoria: "1 evento registrado (exemplo)",
    descricaoReferencia:
      "Registro de referência técnica para centro de custo (exemplo ilustrativo, sem rateio ou orçamento real).",
    camposPendentes: ["Matriz de acesso (exemplo)", "Validação RH (exemplo)"],
  },
  {
    id: "CC-2026-0002",
    codigoTecnico: "CTEC-002 (exemplo)",
    centroCusto: "Centro de custo de referência B (exemplo)",
    empresaUnidadeTecnica: "Unidade U-02 (exemplo)",
    estruturaDepartamentoTecnico: "Departamento técnico D-02 (exemplo)",
    situacao: "referencia_em_revisao_exemplo",
    responsavelTecnico: "RT-CentroCusto-02 (exemplo)",
    trilhaAuditoria: "1 evento registrado (exemplo)",
    descricaoReferencia:
      "Registro de referência técnica para centro de custo (exemplo ilustrativo, sem rateio ou orçamento real).",
    camposPendentes: ["Validação RH (exemplo)"],
  },
  {
    id: "CC-2026-0003",
    codigoTecnico: "CTEC-003 (exemplo)",
    centroCusto: "Centro de custo de referência C (exemplo)",
    empresaUnidadeTecnica: "Unidade U-01 (exemplo)",
    estruturaDepartamentoTecnico: "Departamento técnico D-03 (exemplo)",
    situacao: "aguardando_decisao_exemplo",
    responsavelTecnico: "RT-CentroCusto-01 (exemplo)",
    trilhaAuditoria: "2 eventos registrados (exemplo)",
    descricaoReferencia:
      "Registro de referência técnica aguardando decisão formal (exemplo ilustrativo, sem rateio ou orçamento real).",
    camposPendentes: [
      "Matriz de acesso (exemplo)",
      "Reconhecimento formal (exemplo)",
    ],
  },
  {
    id: "CC-2026-0004",
    codigoTecnico: "CTEC-004 (exemplo)",
    centroCusto: "Centro de custo de referência D (exemplo)",
    empresaUnidadeTecnica: "Unidade U-03 (exemplo)",
    estruturaDepartamentoTecnico: "Departamento técnico D-01 (exemplo)",
    situacao: "aguardando_decisao_exemplo",
    responsavelTecnico: "RT-CentroCusto-03 (exemplo)",
    trilhaAuditoria: "2 eventos registrados (exemplo)",
    descricaoReferencia:
      "Registro de referência técnica aguardando decisão formal (exemplo ilustrativo, sem rateio ou orçamento real).",
    camposPendentes: ["Aprovação de referência (exemplo)"],
  },
  {
    id: "CC-2026-0005",
    codigoTecnico: "CTEC-005 (exemplo)",
    centroCusto: "Centro de custo de referência E (exemplo)",
    empresaUnidadeTecnica: "Unidade U-02 (exemplo)",
    estruturaDepartamentoTecnico: "Departamento técnico D-02 (exemplo)",
    situacao: "referencia_em_revisao_exemplo",
    responsavelTecnico: "RT-CentroCusto-02 (exemplo)",
    trilhaAuditoria: "1 evento registrado (exemplo)",
    descricaoReferencia:
      "Registro de referência técnica para centro de custo (exemplo ilustrativo, sem rateio ou orçamento real).",
    camposPendentes: [],
  },
  {
    id: "CC-2025-0001",
    codigoTecnico: "CTEC-006 (exemplo)",
    centroCusto: "Centro de custo de referência A (exemplo)",
    empresaUnidadeTecnica: "Unidade U-03 (exemplo)",
    estruturaDepartamentoTecnico: "Departamento técnico D-03 (exemplo)",
    situacao: "historico_ilustrativo",
    responsavelTecnico: "RT-CentroCusto-03 (exemplo)",
    trilhaAuditoria: "3 eventos registrados (exemplo)",
    descricaoReferencia:
      "Exemplo de referência já registrada como histórico ilustrativo, sem efeito contábil ou orçamentário.",
    camposPendentes: [],
  },
  {
    id: "CC-2025-0002",
    codigoTecnico: "CTEC-007 (exemplo)",
    centroCusto: "Centro de custo de referência F (exemplo)",
    empresaUnidadeTecnica: "Unidade U-01 (exemplo)",
    estruturaDepartamentoTecnico: "Departamento técnico D-02 (exemplo)",
    situacao: "historico_ilustrativo",
    responsavelTecnico: "RT-CentroCusto-01 (exemplo)",
    trilhaAuditoria: "3 eventos registrados (exemplo)",
    descricaoReferencia:
      "Exemplo de referência já registrada como histórico ilustrativo, sem efeito contábil ou orçamentário.",
    camposPendentes: [],
  },
];
