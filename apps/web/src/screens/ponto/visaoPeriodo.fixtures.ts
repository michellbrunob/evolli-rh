/**
 * Dados sintéticos da tela "Ponto > Visão do período" (T063).
 *
 * Ilustra, apenas visualmente, o fluxo já documentado e validado nos núcleos
 * puros de Ponto V1 (apuração, extrato/saldo de Banco de Horas, fila
 * "Verificar folhas" e fechamento/Espelho — `docs/modules/etapa3-jornada-ponto-v1-detalhada.md`,
 * `docs/decisions/prontidao-operacao-real-evolli-rh.md`). Todo valor aqui é
 * um EXEMPLO fixo, sem relação com nenhum cálculo real: esta tela não chama
 * `apps/api`, não computa nada e não persiste nada. Sem CPF, nome, empresa
 * real, arquivo AFD/TXT ou horário observado em sistema externo.
 */
import {
  formatarDataBr,
  PENDENCIAS_EXEMPLO,
  type EstadoPendencia,
} from "./verificarFolhas.fixtures";

export { formatarDataBr };

/** Estados conceituais do período (mesmo catálogo ilustrado nos contratos de
 * fechamento) — usados aqui só como rótulo de exemplo, nunca como integração
 * com o núcleo real. */
export type EstadoPeriodoExemplo =
  | "em_apuracao"
  | "em_verificacao_rh"
  | "pronto_para_fechamento"
  | "fechado_operacionalmente"
  | "espelho_emitido"
  | "conferencia_manual_pendente"
  | "conferencia_manual_registrada";

export const ROTULO_ESTADO_PERIODO: Record<EstadoPeriodoExemplo, string> = {
  em_apuracao: "Em apuração",
  em_verificacao_rh: "Em verificação RH",
  pronto_para_fechamento: "Pronto para fechamento",
  fechado_operacionalmente: "Fechado operacionalmente",
  espelho_emitido: "Espelho emitido",
  conferencia_manual_pendente: "Conferência manual pendente",
  conferencia_manual_registrada: "Conferência manual registrada",
};

/** Etapa da linha do tempo do fluxo (apuração → extrato → fila → fechamento →
 * espelho), com o marcador de progresso do exemplo. */
export interface EtapaFluxoExemplo {
  readonly id: string;
  readonly rotulo: string;
}

export const ETAPAS_FLUXO_EXEMPLO: readonly EtapaFluxoExemplo[] = [
  { id: "apuracao", rotulo: "Apuração" },
  { id: "extrato", rotulo: "Extrato" },
  { id: "verificar_folhas", rotulo: "Verificar folhas" },
  { id: "fechamento", rotulo: "Fechamento" },
  { id: "espelho", rotulo: "Espelho" },
];

/** Índice (0-based) da etapa corrente no exemplo — só ilustrativo. */
export const ETAPA_ATUAL_INDICE_EXEMPLO = 2;

/** Período de referência do exemplo: recorte "26 → 25", sem ano real de um
 * caso concreto — só o formato de competência já usado nos contratos. */
export const PERIODO_EXEMPLO = {
  inicio: "2026-06-26",
  fim: "2026-07-25",
} as const;

export const ESTADO_PERIODO_EXEMPLO: EstadoPeriodoExemplo = "em_verificacao_rh";

/** Resumo de jornada do exemplo — minutos, nunca dinheiro. */
export interface ResumoJornadaExemplo {
  readonly jornadaPrevistaMinutos: number;
  readonly jornadaComputadaMinutos: number;
  readonly apontamentosNaoFinanceiros: number;
}

export const RESUMO_JORNADA_EXEMPLO: ResumoJornadaExemplo = {
  jornadaPrevistaMinutos: 480,
  jornadaComputadaMinutos: 545,
  apontamentosNaoFinanceiros: 1,
};

/** Créditos e débitos do exemplo — sempre separados; nunca colapsados. */
export interface ResumoBancoHorasExemplo {
  readonly creditoMinutos: number;
  readonly debitoMinutos: number;
  readonly saldoDerivadoMinutos: number;
}

export const RESUMO_BANCO_HORAS_EXEMPLO: ResumoBancoHorasExemplo = {
  creditoMinutos: 90,
  debitoMinutos: 25,
  saldoDerivadoMinutos: 65,
};

/** Quantidade de pendências "a revisar" — reaproveita a mesma amostra usada em
 * "Verificar folhas", para as duas abas mostrarem números coerentes. */
export function contarPendenciasARevisar(
  pendencias: readonly {
    readonly estado: EstadoPendencia;
  }[] = PENDENCIAS_EXEMPLO,
): number {
  return pendencias.filter((item) => item.estado !== "resolvido").length;
}

/** Status conceitual do fechamento e do Espelho do exemplo (só rótulo). */
export const STATUS_FECHAMENTO_EXEMPLO = "Em verificação RH (exemplo)";
export const STATUS_ESPELHO_EXEMPLO = "Aguardando emissão (exemplo)";
