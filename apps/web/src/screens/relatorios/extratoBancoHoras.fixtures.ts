/**
 * Dados sintéticos de "Relatórios > Extrato de Banco de Horas" (T098).
 *
 * Amostra puramente demonstrativa de referências técnicas de extrato de
 * Banco de Horas por período, tipo de referência e situação — sem criar,
 * editar, calcular, movimentar, compensar, quitar, fechar, reabrir, pagar,
 * descontar, salvar, gerar, exportar, importar ou integrar extrato real.
 * Crédito, débito e saldo são textos ilustrativos não numéricos, sem fórmula
 * ou cálculo — nenhuma linha representa saldo operacional, horário real ou
 * valor monetário; todas seguem como referência em revisão, aguardando
 * decisão ou histórico ilustrativo.
 */

export type TipoReferenciaExtrato =
  | "credito_ilustrativo_exemplo"
  | "debito_ilustrativo_exemplo"
  | "ajuste_ilustrativo_exemplo";

export const ROTULO_TIPO_REFERENCIA_EXTRATO: Record<
  TipoReferenciaExtrato,
  string
> = {
  credito_ilustrativo_exemplo: "Crédito ilustrativo (exemplo)",
  debito_ilustrativo_exemplo: "Débito ilustrativo (exemplo)",
  ajuste_ilustrativo_exemplo: "Ajuste ilustrativo (exemplo)",
};

export type SituacaoExtrato =
  | "referencia_em_revisao_exemplo"
  | "aguardando_decisao_exemplo"
  | "historico_ilustrativo";

export const ROTULO_SITUACAO_EXTRATO: Record<SituacaoExtrato, string> = {
  referencia_em_revisao_exemplo: "Referência em revisão (exemplo)",
  aguardando_decisao_exemplo: "Aguardando decisão (exemplo)",
  historico_ilustrativo: "Histórico ilustrativo",
};

export interface ExtratoBancoHorasExemplo {
  readonly id: string;
  readonly periodoIlustrativo: string;
  readonly tipoReferencia: TipoReferenciaExtrato;
  readonly creditoIlustrativo: string;
  readonly debitoIlustrativo: string;
  readonly saldoReferencia: string;
  readonly situacao: SituacaoExtrato;
  readonly trilhaAuditoria: string;
  readonly descricaoReferencia: string;
  readonly camposPendentes: readonly string[];
}

export const EXTRATO_BANCO_HORAS_EXEMPLO: readonly ExtratoBancoHorasExemplo[] =
  [
    {
      id: "EXT-2026-0001",
      periodoIlustrativo: "Período P-01 (exemplo)",
      tipoReferencia: "credito_ilustrativo_exemplo",
      creditoIlustrativo: "Crédito ilustrativo presente (exemplo)",
      debitoIlustrativo: "Sem débito ilustrativo (exemplo)",
      saldoReferencia: "Referência positiva (exemplo)",
      situacao: "referencia_em_revisao_exemplo",
      trilhaAuditoria: "1 evento registrado (exemplo)",
      descricaoReferencia:
        "Registro de referência técnica de extrato (exemplo ilustrativo, sem cálculo, movimentação ou compensação real).",
      camposPendentes: ["Validação RH (exemplo)"],
    },
    {
      id: "EXT-2026-0002",
      periodoIlustrativo: "Período P-02 (exemplo)",
      tipoReferencia: "debito_ilustrativo_exemplo",
      creditoIlustrativo: "Sem crédito ilustrativo (exemplo)",
      debitoIlustrativo: "Débito ilustrativo presente (exemplo)",
      saldoReferencia: "Referência negativa (exemplo)",
      situacao: "referencia_em_revisao_exemplo",
      trilhaAuditoria: "1 evento registrado (exemplo)",
      descricaoReferencia:
        "Registro de referência técnica de extrato (exemplo ilustrativo, sem cálculo, movimentação ou compensação real).",
      camposPendentes: [],
    },
    {
      id: "EXT-2026-0003",
      periodoIlustrativo: "Período P-03 (exemplo)",
      tipoReferencia: "credito_ilustrativo_exemplo",
      creditoIlustrativo: "Crédito ilustrativo presente (exemplo)",
      debitoIlustrativo: "Sem débito ilustrativo (exemplo)",
      saldoReferencia: "Referência positiva (exemplo)",
      situacao: "aguardando_decisao_exemplo",
      trilhaAuditoria: "2 eventos registrados (exemplo)",
      descricaoReferencia:
        "Registro de referência técnica aguardando decisão formal (exemplo ilustrativo, sem cálculo, movimentação ou compensação real).",
      camposPendentes: [
        "Validação RH (exemplo)",
        "Reconhecimento formal (exemplo)",
      ],
    },
    {
      id: "EXT-2026-0004",
      periodoIlustrativo: "Período P-04 (exemplo)",
      tipoReferencia: "ajuste_ilustrativo_exemplo",
      creditoIlustrativo: "Sem crédito ilustrativo (exemplo)",
      debitoIlustrativo: "Sem débito ilustrativo (exemplo)",
      saldoReferencia: "Referência neutra (exemplo)",
      situacao: "aguardando_decisao_exemplo",
      trilhaAuditoria: "2 eventos registrados (exemplo)",
      descricaoReferencia:
        "Registro de referência técnica aguardando decisão formal (exemplo ilustrativo, sem cálculo, movimentação ou compensação real).",
      camposPendentes: ["Aprovação de referência (exemplo)"],
    },
    {
      id: "EXT-2026-0005",
      periodoIlustrativo: "Período P-05 (exemplo)",
      tipoReferencia: "debito_ilustrativo_exemplo",
      creditoIlustrativo: "Sem crédito ilustrativo (exemplo)",
      debitoIlustrativo: "Débito ilustrativo presente (exemplo)",
      saldoReferencia: "Referência negativa (exemplo)",
      situacao: "referencia_em_revisao_exemplo",
      trilhaAuditoria: "1 evento registrado (exemplo)",
      descricaoReferencia:
        "Registro de referência técnica de extrato (exemplo ilustrativo, sem cálculo, movimentação ou compensação real).",
      camposPendentes: [],
    },
    {
      id: "EXT-2025-0001",
      periodoIlustrativo: "Período P-06 (exemplo)",
      tipoReferencia: "credito_ilustrativo_exemplo",
      creditoIlustrativo: "Crédito ilustrativo presente (exemplo)",
      debitoIlustrativo: "Sem débito ilustrativo (exemplo)",
      saldoReferencia: "Referência positiva (exemplo)",
      situacao: "historico_ilustrativo",
      trilhaAuditoria: "3 eventos registrados (exemplo)",
      descricaoReferencia:
        "Exemplo de referência já registrada como histórico ilustrativo, sem efeito real sobre crédito, débito, saldo ou Folha.",
      camposPendentes: [],
    },
    {
      id: "EXT-2025-0002",
      periodoIlustrativo: "Período P-07 (exemplo)",
      tipoReferencia: "debito_ilustrativo_exemplo",
      creditoIlustrativo: "Sem crédito ilustrativo (exemplo)",
      debitoIlustrativo: "Débito ilustrativo presente (exemplo)",
      saldoReferencia: "Referência negativa (exemplo)",
      situacao: "historico_ilustrativo",
      trilhaAuditoria: "3 eventos registrados (exemplo)",
      descricaoReferencia:
        "Exemplo de referência já registrada como histórico ilustrativo, sem efeito real sobre crédito, débito, saldo ou Folha.",
      camposPendentes: [],
    },
  ];
