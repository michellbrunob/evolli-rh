import { MODELOS_DE_ESCALA, type TipoDeEscala } from "./padrao-escala";

/**
 * T215 — o dia de uma pessoa pelos padrões de escala dela, no SERVIDOR, com a
 * MESMA regra da célula do quadro e da aba Escala da ficha (web:
 * `calendarioDaEscala.trabalhoNoDia`, `diaDaEscala.resolverDia` e
 * `quadroDaEscala.celulaDoDia`):
 *
 * - o padrão que vale no dia (vigência `[início, fim)`);
 * - trabalho com o turno do dia (no 12x36 com turno da noite: um mês de dia,
 *   o seguinte de noite); jornada que muda por dia da semana e não tem
 *   período no dia é folga do turno;
 * - DSR: a folga escolhida no 6x1 e o domingo nas semanas fixas e em
 *   "outra"; nos revezamentos, plantões e embarque, a folga é do ciclo.
 *
 * Dia civil `AAAA-MM-DD`, aritmética em UTC, sem fuso. Usado por Publicar
 * (grava o dia resolvido) e por Benefícios (conta os dias de trabalho).
 */

export interface PeriodoDoTurno {
  readonly dia: string;
  readonly inicio: string;
  readonly fim: string;
}

export interface TurnoDoPadrao {
  readonly id: string;
  readonly intervaloMinutos: number;
  readonly periodos: readonly PeriodoDoTurno[];
}

export interface PadraoDoDia {
  readonly modelo: string;
  readonly turno: TurnoDoPadrao | null;
  readonly turnoNoite: TurnoDoPadrao | null;
  readonly folgaSemanal: number | null;
  readonly diasTrabalho: readonly number[];
  readonly inicioCiclo: string | null;
  readonly vigenciaInicio: string;
  /** O primeiro dia SEM o padrão, ou `null` (aberto). */
  readonly vigenciaFim: string | null;
}

export interface DiaDoPadrao {
  readonly tipo: "trabalho" | "folga" | "dsr";
  /** No trabalho: o turno, ou `null` (sem turno fixo). */
  readonly tabelaHorarioId: string | null;
  readonly periodos: { inicio: string; fim: string }[];
  readonly intervaloMinutos: number;
}

const DIAS_FIXOS: Readonly<Record<string, readonly number[]>> = {
  "5x2": [1, 2, 3, 4, 5],
  "6x1": [1, 2, 3, 4, 5, 6, 7],
  semana_espanhola: [1, 2, 3, 4, 5],
  "4x3": [1, 2, 3, 4],
  fim_de_semana: [6, 7],
};

const DIA_DA_API = [
  "segunda",
  "terca",
  "quarta",
  "quinta",
  "sexta",
  "sabado",
  "domingo",
];

const MS_DIA = 24 * 60 * 60 * 1000;

function utc(dia: string): number {
  return Date.UTC(
    Number(dia.slice(0, 4)),
    Number(dia.slice(5, 7)) - 1,
    Number(dia.slice(8, 10)),
  );
}

export function somarDias(dia: string, n: number): string {
  return new Date(utc(dia) + n * MS_DIA).toISOString().slice(0, 10);
}

function diasEntre(de: string, ate: string): number {
  return Math.round((utc(ate) - utc(de)) / MS_DIA);
}

/** 1 = segunda … 7 = domingo. */
export function diaDaSemana(dia: string): number {
  const d = new Date(utc(dia)).getUTCDay();
  return d === 0 ? 7 : d;
}

function segundaDaSemana(dia: string): string {
  return somarDias(dia, 1 - diaDaSemana(dia));
}

function mesesEntre(de: string, ate: string): number {
  return (
    (Number(ate.slice(0, 4)) - Number(de.slice(0, 4))) * 12 +
    Number(ate.slice(5, 7)) -
    Number(de.slice(5, 7))
  );
}

function tipoDo(modelo: string): TipoDeEscala | null {
  return (
    (MODELOS_DE_ESCALA as Record<string, { tipo: TipoDeEscala }>)[modelo]
      ?.tipo ?? null
  );
}

/** Dias (revezamento, embarque) ou horas (plantão) de trabalho e de folga. */
function cicloDo(modelo: string): [number, number] {
  const m = /^(\d+)x(\d+)$/.exec(modelo);
  return m ? [Number(m[1]), Number(m[2])] : [0, 0];
}

/** Trabalha no dia? `"dia"`, `"noite"` (turno da noite) ou `null` (folga). */
export function trabalhoNoDia(
  p: PadraoDoDia,
  dia: string,
): "dia" | "noite" | null {
  const tipo = tipoDo(p.modelo);
  if (tipo === null) return null;
  const semana = diaDaSemana(dia);
  switch (tipo) {
    case "semanal": {
      if (p.modelo === "6x1") {
        return semana === (p.folgaSemanal ?? 7) ? null : "dia";
      }
      if (p.modelo === "semana_espanhola" && semana === 6) {
        const semanas =
          diasEntre(segundaDaSemana(p.vigenciaInicio), segundaDaSemana(dia)) /
          7;
        return ((semanas % 2) + 2) % 2 === 0 ? "dia" : null;
      }
      return (DIAS_FIXOS[p.modelo] ?? []).includes(semana) ? "dia" : null;
    }
    case "outra":
      return p.diasTrabalho.includes(semana) ? "dia" : null;
    case "revezamento":
    case "embarque": {
      const [trabalho, folga] = cicloDo(p.modelo);
      const ciclo = trabalho + folga;
      const n = diasEntre(p.inicioCiclo ?? p.vigenciaInicio, dia);
      return ((n % ciclo) + ciclo) % ciclo < trabalho ? "dia" : null;
    }
    case "plantao": {
      const inicio = p.inicioCiclo ?? p.vigenciaInicio;
      const [trabalho, folga] = cicloDo(p.modelo);
      const ciclo = trabalho + folga; // horas
      const n = diasEntre(inicio, dia);
      // Algum plantão começa neste dia? (k·ciclo horas cai em [n, n+1) dias)
      const k = Math.ceil((n * 24) / ciclo);
      if (k * ciclo >= (n + 1) * 24) return null;
      if (p.modelo === "12x36" && p.turnoNoite) {
        const meses = mesesEntre(inicio, dia);
        return ((meses % 2) + 2) % 2 === 1 ? "noite" : "dia";
      }
      return "dia";
    }
  }
}

/** O padrão que vale no dia, entre todos. */
export function padraoDoDia<P extends PadraoDoDia>(
  escalas: readonly P[],
  dia: string,
): P | null {
  return (
    escalas.find(
      (e) =>
        e.vigenciaInicio <= dia &&
        (e.vigenciaFim === null || dia < e.vigenciaFim),
    ) ?? null
  );
}

/** Os períodos do turno no dia (jornada igual todo dia vale para qualquer dia). */
export function periodosNoDia(
  turno: TurnoDoPadrao,
  dia: string,
): PeriodoDoTurno[] {
  const porDia = new Map<string, PeriodoDoTurno[]>();
  for (const p of turno.periodos) {
    porDia.set(p.dia, [...(porDia.get(p.dia) ?? []), p]);
  }
  const assinaturas = new Set(
    [...porDia.values()].map((ps) =>
      ps
        .map((p) => `${p.inicio}-${p.fim}`)
        .sort()
        .join(","),
    ),
  );
  const lista =
    assinaturas.size === 1
      ? [...porDia.values()][0]!
      : (porDia.get(DIA_DA_API[diaDaSemana(dia) - 1]!) ?? []);
  return [...lista].sort((a, b) => a.inicio.localeCompare(b.inicio));
}

/**
 * O dia pelo padrão (a célula do quadro sem nada gravado), ou `null` quando
 * nenhum padrão vale no dia ("sem escala").
 */
export function resolverDiaDoPadrao(
  escalas: readonly PadraoDoDia[],
  dia: string,
): DiaDoPadrao | null {
  const e = padraoDoDia(escalas, dia);
  if (!e) return null;
  const vazio = { tabelaHorarioId: null, periodos: [], intervaloMinutos: 0 };
  const t = trabalhoNoDia(e, dia);
  if (t === null) {
    const tipo = tipoDo(e.modelo);
    const dsr =
      e.modelo === "6x1"
        ? diaDaSemana(dia) === (e.folgaSemanal ?? 7)
        : (tipo === "semanal" || tipo === "outra") && diaDaSemana(dia) === 7;
    return { ...vazio, tipo: dsr ? "dsr" : "folga" };
  }
  const turno = t === "noite" ? e.turnoNoite : e.turno;
  if (turno === null) return { ...vazio, tipo: "trabalho" };
  const periodos = periodosNoDia(turno, dia);
  // Jornada que muda por dia da semana e não tem período hoje: folga do turno.
  if (periodos.length === 0) return { ...vazio, tipo: "folga" };
  return {
    tipo: "trabalho",
    tabelaHorarioId: turno.id,
    periodos: periodos.map((p) => ({ inicio: p.inicio, fim: p.fim })),
    intervaloMinutos: periodos.length === 1 ? turno.intervaloMinutos : 0,
  };
}
