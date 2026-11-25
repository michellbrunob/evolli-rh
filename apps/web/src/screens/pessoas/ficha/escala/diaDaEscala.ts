/**
 * T215 — o dia de uma pessoa pelos padrões de escala dela (aba Escala da
 * ficha e quadro "Escala de trabalho" usam a MESMA regra):
 *
 * - o padrão que vale no dia (vigência `[início, fim)`);
 * - trabalho (com o turno do dia ou, no 12x36 com turno da noite, o da
 *   noite), folga ou DSR;
 * - DSR: a folga escolhida no 6x1 e o domingo nas semanas fixas e em
 *   "outra"; nos revezamentos, plantões e embarque, a folga é do ciclo.
 */
import type { EscalaApi, TurnoDaEscalaApi } from "../../../../api/escalaClient";
import {
  type PadraoDeEscala,
  diaDaSemana,
  trabalhoNoDia,
} from "./calendarioDaEscala";
import { modeloDe } from "./modelosDeEscala";

export function padraoDe(e: EscalaApi): PadraoDeEscala {
  return {
    modelo: e.modelo,
    turno: e.turno?.periodos ?? null,
    turnoNoite: e.turnoNoite?.periodos ?? null,
    intervaloTurno: e.turno?.intervaloMinutos ?? 0,
    intervaloTurnoNoite: e.turnoNoite?.intervaloMinutos ?? 0,
    folgaSemanal: e.folgaSemanal,
    diasTrabalho: e.diasTrabalho,
    inicioCiclo: e.inicioCiclo,
    vigenciaInicio: e.vigenciaInicio,
  };
}

/** A escala que vale no dia, entre todas. */
export function escalaDoDia(
  escalas: readonly EscalaApi[],
  dia: string,
): EscalaApi | null {
  return (
    escalas.find(
      (e) =>
        e.vigenciaInicio <= dia &&
        (e.vigenciaFim === null || dia < e.vigenciaFim),
    ) ?? null
  );
}

export interface DiaResolvido {
  readonly tipo: "trabalho" | "folga" | "dsr" | "sem-escala";
  readonly turno: TurnoDaEscalaApi | null;
}

export function resolverDia(
  escalas: readonly EscalaApi[],
  dia: string,
): DiaResolvido {
  const e = escalaDoDia(escalas, dia);
  if (!e) return { tipo: "sem-escala", turno: null };
  const t = trabalhoNoDia(padraoDe(e), dia);
  if (t === null) {
    const tipo = modeloDe(e.modelo)?.tipo;
    const dsr =
      e.modelo === "6x1"
        ? diaDaSemana(dia) === (e.folgaSemanal ?? 7)
        : (tipo === "semanal" || tipo === "outra") && diaDaSemana(dia) === 7;
    return { tipo: dsr ? "dsr" : "folga", turno: null };
  }
  return {
    tipo: "trabalho",
    turno: t === "noite" ? e.turnoNoite : e.turno,
  };
}
