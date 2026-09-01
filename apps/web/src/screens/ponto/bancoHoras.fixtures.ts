/**
 * Dados sintéticos de "Ponto > Banco de Horas" (T069).
 *
 * Ilustra, apenas visualmente, o mesmo tipo de extrato já validado no núcleo
 * puro de Banco de Horas (T052, `apps/api/src/ponto/banco-horas/`) — mas esta
 * tela **não** importa nem chama aquele núcleo: é puramente visual, com
 * amostra própria em memória. Crédito e débito são sempre **separados**; o
 * saldo é apenas **derivado** da soma dos dois, nunca um evento "líquido".
 */

/** Natureza do movimento — crédito soma ao saldo, débito subtrai. */
export type NaturezaMovimentoExemplo = "credito" | "debito";

/**
 * Origem técnica do movimento — mesmo catálogo conceitual já usado no núcleo
 * de Banco de Horas (T052). Rótulo técnico, nunca dado pessoal/financeiro.
 */
export type OrigemMovimentoExemplo =
  | "apuracao_credito_extra"
  | "apuracao_debito_atraso_saida"
  | "apuracao_debito_falta"
  | "movimento_sintetico";

export interface MovimentoBancoHorasExemplo {
  readonly id: string;
  readonly dataReferencia: string;
  readonly natureza: NaturezaMovimentoExemplo;
  readonly origem: OrigemMovimentoExemplo;
  readonly minutos: number;
}

export const ROTULO_ORIGEM_MOVIMENTO: Record<OrigemMovimentoExemplo, string> = {
  apuracao_credito_extra: "Crédito de hora extra (apuração)",
  apuracao_debito_atraso_saida: "Débito de atraso/saída antecipada (apuração)",
  apuracao_debito_falta: "Débito de falta (apuração)",
  movimento_sintetico: "Movimento sintético (exemplo avulso)",
};

/** `dd/mm/aaaa` a partir de `AAAA-MM-DD` — sem fuso/hora. */
export function formatarDataBr(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

export const EXTRATO_BANCO_HORAS_EXEMPLO: readonly MovimentoBancoHorasExemplo[] =
  [
    {
      id: "AP-2026-08-11-V001-C",
      dataReferencia: "2026-08-11",
      natureza: "credito",
      origem: "apuracao_credito_extra",
      minutos: 90,
    },
    {
      id: "AP-2026-08-12-V001-D",
      dataReferencia: "2026-08-12",
      natureza: "debito",
      origem: "apuracao_debito_atraso_saida",
      minutos: 25,
    },
    {
      id: "AP-2026-08-14-V001-C",
      dataReferencia: "2026-08-14",
      natureza: "credito",
      origem: "apuracao_credito_extra",
      minutos: 40,
    },
    {
      id: "AP-2026-08-18-V001-D",
      dataReferencia: "2026-08-18",
      natureza: "debito",
      origem: "apuracao_debito_falta",
      minutos: 480,
    },
    {
      id: "MOV-DEMO-0001",
      dataReferencia: "2026-08-20",
      natureza: "credito",
      origem: "movimento_sintetico",
      minutos: 15,
    },
  ];

/** Totais separados e saldo derivado (exemplo) — sempre em minutos. */
export interface ResumoBancoHorasExtratoExemplo {
  readonly totalCreditoMinutos: number;
  readonly totalDebitoMinutos: number;
  readonly saldoDerivadoMinutos: number;
}

export const RESUMO_EXTRATO_EXEMPLO: ResumoBancoHorasExtratoExemplo = {
  totalCreditoMinutos: 145,
  totalDebitoMinutos: 505,
  saldoDerivadoMinutos: -360,
};

/** Limiares ilustrativos dos alertas — só informativos, nunca bloqueiam nada. */
export const LIMIAR_ALERTA_ALTO_MINUTOS = 2280; // +38h (exemplo)
export const LIMIAR_ALERTA_NEGATIVO_MINUTOS = -1440; // −24h (exemplo)
