/**
 * Dados sintéticos de "Portal do Colaborador > Minha jornada" (T067).
 *
 * Ilustra, apenas visualmente, o mesmo tipo de panorama já demonstrado em
 * `Ponto > Visão do período` (T063) — sob a ótica do colaborador. Nenhum
 * cálculo real: valores fixos, sem relação com nenhum núcleo de `apps/api`.
 */

export const PERIODO_JORNADA_EXEMPLO = {
  inicio: "2026-06-26",
  fim: "2026-07-25",
} as const;

export interface ResumoJornadaPortalExemplo {
  readonly jornadaPrevistaMinutos: number;
  readonly jornadaComputadaMinutos: number;
}

export const RESUMO_JORNADA_PORTAL_EXEMPLO: ResumoJornadaPortalExemplo = {
  jornadaPrevistaMinutos: 480,
  jornadaComputadaMinutos: 545,
};

export interface ResumoBancoHorasPortalExemplo {
  readonly creditoMinutos: number;
  readonly debitoMinutos: number;
  readonly saldoDerivadoMinutos: number;
}

export const RESUMO_BANCO_HORAS_PORTAL_EXEMPLO: ResumoBancoHorasPortalExemplo =
  {
    creditoMinutos: 90,
    debitoMinutos: 25,
    saldoDerivadoMinutos: 65,
  };

export interface ApontamentoPortalExemplo {
  readonly dia: string;
  readonly rotulo: string;
}

export const APONTAMENTOS_PORTAL_EXEMPLO: readonly ApontamentoPortalExemplo[] =
  [{ dia: "2026-07-10", rotulo: "Jornada acima do limite diário (alerta)" }];

/** `dd/mm/aaaa` a partir de `AAAA-MM-DD` — sem fuso/hora. */
export function formatarDataBr(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}
