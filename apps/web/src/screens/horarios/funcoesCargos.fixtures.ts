/**
 * Dados sintéticos de "Cadastros > Funções e cargos" (T080).
 *
 * Amostra puramente demonstrativa de como o RH poderá consultar referências
 * organizacionais de função e cargo por empresa/unidade e departamento/
 * estrutura técnica — sem conceder permissão de acesso, sem alterar vínculo,
 * remuneração, jornada, escala, Banco de Horas, Folha ou qualquer dado real.
 * Nenhuma linha representa um vínculo real; todas seguem como referência em
 * revisão, aguardando decisão ou histórico ilustrativo.
 */

export type SituacaoFuncaoCargo =
  | "referencia_em_revisao_exemplo"
  | "aguardando_decisao_exemplo"
  | "historico_ilustrativo";

export interface FuncaoCargoExemplo {
  readonly id: string;
  readonly funcao: string;
  readonly cargo: string;
  readonly empresaUnidadeTecnica: string;
  readonly departamentoEstruturaTecnica: string;
  readonly situacao: SituacaoFuncaoCargo;
  readonly responsavelTecnico: string;
  readonly trilhaAuditoria: string;
  readonly camposPendentes: readonly string[];
}

export const ROTULO_SITUACAO_FUNCAO_CARGO: Record<SituacaoFuncaoCargo, string> =
  {
    referencia_em_revisao_exemplo: "Referência em revisão (exemplo)",
    aguardando_decisao_exemplo: "Aguardando decisão (exemplo)",
    historico_ilustrativo: "Histórico ilustrativo",
  };

export const FUNCOES_CARGOS_EXEMPLO: readonly FuncaoCargoExemplo[] = [
  {
    id: "FC-2026-0001",
    funcao: "Função de referência A (exemplo)",
    cargo: "Cargo de referência A (exemplo)",
    empresaUnidadeTecnica: "Unidade U-01 (exemplo)",
    departamentoEstruturaTecnica: "Departamento D-01 (exemplo)",
    situacao: "referencia_em_revisao_exemplo",
    responsavelTecnico: "RT-Funcoes-01 (exemplo)",
    trilhaAuditoria: "1 evento registrado (exemplo)",
    camposPendentes: [
      "Vínculo com centro de custo (exemplo)",
      "Nível hierárquico (exemplo)",
    ],
  },
  {
    id: "FC-2026-0002",
    funcao: "Função de referência B (exemplo)",
    cargo: "Cargo de referência B (exemplo)",
    empresaUnidadeTecnica: "Unidade U-02 (exemplo)",
    departamentoEstruturaTecnica: "Departamento D-02 (exemplo)",
    situacao: "referencia_em_revisao_exemplo",
    responsavelTecnico: "RT-Funcoes-02 (exemplo)",
    trilhaAuditoria: "1 evento registrado (exemplo)",
    camposPendentes: ["Faixa salarial de referência (exemplo)"],
  },
  {
    id: "FC-2026-0003",
    funcao: "Função de referência A (exemplo)",
    cargo: "Cargo de referência C (exemplo)",
    empresaUnidadeTecnica: "Unidade U-01 (exemplo)",
    departamentoEstruturaTecnica: "Departamento D-03 (exemplo)",
    situacao: "aguardando_decisao_exemplo",
    responsavelTecnico: "RT-Funcoes-01 (exemplo)",
    trilhaAuditoria: "2 eventos registrados (exemplo)",
    camposPendentes: [
      "Aprovação de nomenclatura (exemplo)",
      "Vínculo com centro de custo (exemplo)",
    ],
  },
  {
    id: "FC-2026-0004",
    funcao: "Função de referência C (exemplo)",
    cargo: "Cargo de referência A (exemplo)",
    empresaUnidadeTecnica: "Unidade U-03 (exemplo)",
    departamentoEstruturaTecnica: "Departamento D-01 (exemplo)",
    situacao: "aguardando_decisao_exemplo",
    responsavelTecnico: "RT-Funcoes-03 (exemplo)",
    trilhaAuditoria: "2 eventos registrados (exemplo)",
    camposPendentes: ["Nível hierárquico (exemplo)"],
  },
  {
    id: "FC-2026-0005",
    funcao: "Função de referência B (exemplo)",
    cargo: "Cargo de referência C (exemplo)",
    empresaUnidadeTecnica: "Unidade U-02 (exemplo)",
    departamentoEstruturaTecnica: "Departamento D-02 (exemplo)",
    situacao: "referencia_em_revisao_exemplo",
    responsavelTecnico: "RT-Funcoes-02 (exemplo)",
    trilhaAuditoria: "1 evento registrado (exemplo)",
    camposPendentes: [],
  },
  {
    id: "FC-2026-0006",
    funcao: "Função de referência C (exemplo)",
    cargo: "Cargo de referência B (exemplo)",
    empresaUnidadeTecnica: "Unidade U-01 (exemplo)",
    departamentoEstruturaTecnica: "Departamento D-03 (exemplo)",
    situacao: "aguardando_decisao_exemplo",
    responsavelTecnico: "RT-Funcoes-01 (exemplo)",
    trilhaAuditoria: "2 eventos registrados (exemplo)",
    camposPendentes: ["Faixa salarial de referência (exemplo)"],
  },
  {
    id: "FC-2025-0001",
    funcao: "Função de referência A (exemplo)",
    cargo: "Cargo de referência A (exemplo)",
    empresaUnidadeTecnica: "Unidade U-03 (exemplo)",
    departamentoEstruturaTecnica: "Departamento D-01 (exemplo)",
    situacao: "historico_ilustrativo",
    responsavelTecnico: "RT-Funcoes-03 (exemplo)",
    trilhaAuditoria: "3 eventos registrados (exemplo)",
    camposPendentes: [],
  },
  {
    id: "FC-2025-0002",
    funcao: "Função de referência B (exemplo)",
    cargo: "Cargo de referência B (exemplo)",
    empresaUnidadeTecnica: "Unidade U-02 (exemplo)",
    departamentoEstruturaTecnica: "Departamento D-02 (exemplo)",
    situacao: "historico_ilustrativo",
    responsavelTecnico: "RT-Funcoes-02 (exemplo)",
    trilhaAuditoria: "3 eventos registrados (exemplo)",
    camposPendentes: [],
  },
];
