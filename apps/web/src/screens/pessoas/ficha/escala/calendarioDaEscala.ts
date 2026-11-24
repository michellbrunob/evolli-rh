/**
 * T215 — o calendário de um padrão de escala, em funções puras (dia civil
 * `AAAA-MM-DD`, aritmética em UTC, sem fuso):
 *
 * - em que dias a pessoa trabalha e com qual turno (o do dia ou, no 12x36
 *   com turno da noite, o da noite: um mês de dia, o seguinte de noite);
 * - horas por semana: as horas trabalhadas nos 28 dias a partir da data em
 *   que o padrão vale, divididas por 4, com as horas LÍQUIDAS do turno (sem
 *   o intervalo; sem turno fixo, zero);
 * - dias para benefícios no mês: os dias úteis no 5x2 e em "outra"; nos
 *   demais, a proporção de trabalho do ciclo sobre os dias do mês.
 */
import { modeloDe } from "./modelosDeEscala";

export interface PeriodoDoTurno {
  readonly dia: string;
  readonly inicio: string;
  readonly fim: string;
}

export interface PadraoDeEscala {
  readonly modelo: string;
  /** A grade do turno; `null` = sem turno fixo. */
  readonly turno: readonly PeriodoDoTurno[] | null;
  readonly turnoNoite: readonly PeriodoDoTurno[] | null;
  readonly folgaSemanal: number | null;
  readonly diasTrabalho: readonly number[];
  readonly inicioCiclo: string | null;
  readonly vigenciaInicio: string;
}

const DIA_DA_API = [
  "",
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

function diaDe(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function somarDias(dia: string, n: number): string {
  return diaDe(utc(dia) + n * MS_DIA);
}

function diasEntre(de: string, ate: string): number {
  return Math.round((utc(ate) - utc(de)) / MS_DIA);
}

/** 1 = segunda … 7 = domingo. */
export function diaDaSemana(dia: string): number {
  const d = new Date(utc(dia)).getUTCDay();
  return d === 0 ? 7 : d;
}

function minutos(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function liquidoPorDia(turno: readonly PeriodoDoTurno[]): Map<string, number> {
  const porDia = new Map<string, number>();
  for (const p of turno) {
    porDia.set(
      p.dia,
      (porDia.get(p.dia) ?? 0) + minutos(p.fim) - minutos(p.inicio),
    );
  }
  return porDia;
}

/** A jornada tem o mesmo horário em todos os dias de trabalho? */
function uniforme(turno: readonly PeriodoDoTurno[]): string | null {
  const assinaturas = new Set<string>();
  for (const dia of new Set(turno.map((p) => p.dia))) {
    assinaturas.add(
      turno
        .filter((p) => p.dia === dia)
        .map((p) => `${p.inicio}-${p.fim}`)
        .sort()
        .join(","),
    );
  }
  return assinaturas.size === 1 ? (turno[0]?.dia ?? null) : null;
}

/**
 * Minutos líquidos do turno no dia. Jornada com o mesmo horário em todo dia
 * de trabalho vale para qualquer dia da escala (revezamento, plantão); a que
 * muda por dia da semana segue o dia (o dia sem período é folga do turno).
 */
export function minutosDoTurno(
  turno: readonly PeriodoDoTurno[] | null,
  dia: string,
): number {
  if (!turno || turno.length === 0) return 0;
  const porDia = liquidoPorDia(turno);
  const igual = uniforme(turno);
  if (igual !== null) return porDia.get(igual) ?? 0;
  return porDia.get(DIA_DA_API[diaDaSemana(dia)]!) ?? 0;
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

/** Trabalha no dia? `"dia"`, `"noite"` (turno da noite) ou `null` (folga). */
export function trabalhoNoDia(
  p: PadraoDeEscala,
  dia: string,
): "dia" | "noite" | null {
  const modelo = modeloDe(p.modelo);
  if (!modelo) return null;
  const semana = diaDaSemana(dia);
  switch (modelo.tipo) {
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
      return modelo.diasFixos.includes(semana) ? "dia" : null;
    }
    case "outra":
      return p.diasTrabalho.includes(semana) ? "dia" : null;
    case "revezamento":
    case "embarque": {
      const ciclo = modelo.trabalho + modelo.folga;
      const n = diasEntre(p.inicioCiclo ?? p.vigenciaInicio, dia);
      return ((n % ciclo) + ciclo) % ciclo < modelo.trabalho ? "dia" : null;
    }
    case "plantao": {
      const inicio = p.inicioCiclo ?? p.vigenciaInicio;
      const ciclo = modelo.trabalho + modelo.folga; // horas
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

/** Minutos trabalhados no dia (0 na folga). */
export function minutosNoDia(p: PadraoDeEscala, dia: string): number {
  const t = trabalhoNoDia(p, dia);
  if (t === null) return 0;
  return minutosDoTurno(t === "noite" ? p.turnoNoite : p.turno, dia);
}

/** Minutos por semana: os 28 dias a partir de `base`, divididos por 4. */
export function horasPorSemana(p: PadraoDeEscala, base: string): number {
  let total = 0;
  for (let i = 0; i < 28; i += 1) total += minutosNoDia(p, somarDias(base, i));
  return Math.round(total / 4);
}

/** "40 h", "22 h 23". */
export function formatarHoras(totalMinutos: number): string {
  const h = Math.floor(totalMinutos / 60);
  const m = totalMinutos % 60;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")}`;
}

const FERIADOS_NACIONAIS = new Set([
  "01-01",
  "04-21",
  "05-01",
  "09-07",
  "10-12",
  "11-02",
  "11-15",
  "11-20",
  "12-25",
]);

function diasDoMes(mes: string): number {
  const [ano, m] = mes.split("-").map(Number);
  return new Date(Date.UTC(ano!, m!, 0)).getUTCDate();
}

/** Segunda a sexta, sem os feriados nacionais de data fixa. */
export function diasUteisDoMes(mes: string): number {
  let total = 0;
  for (let d = 1; d <= diasDoMes(mes); d += 1) {
    const dia = `${mes}-${String(d).padStart(2, "0")}`;
    if (diaDaSemana(dia) <= 5 && !FERIADOS_NACIONAIS.has(dia.slice(5))) {
      total += 1;
    }
  }
  return total;
}

/**
 * Dias para os benefícios pagos por dia, no mês (`AAAA-MM`). Sem escala, no
 * 5x2 e em "outra": os dias úteis.
 */
export function diasNoMes(modelo: string | null, mes: string): number {
  const m = modeloDe(modelo);
  if (!m || m.codigo === "5x2" || m.tipo === "outra") {
    return diasUteisDoMes(mes);
  }
  const dias = diasDoMes(mes);
  let proporcao: number;
  if (m.tipo === "semanal") {
    proporcao =
      m.codigo === "6x1"
        ? 6 / 7
        : m.codigo === "semana_espanhola"
          ? 5.5 / 7
          : m.diasFixos.length / 7;
  } else if (m.tipo === "plantao") {
    proporcao = 24 / (m.trabalho + m.folga);
  } else {
    proporcao = m.trabalho / (m.trabalho + m.folga);
  }
  return Math.round(dias * proporcao);
}

export interface DiaDaEscala {
  readonly dia: string;
  readonly trabalho: "dia" | "noite" | null;
  readonly minutos: number;
}

/** Os `n` dias a partir de `inicio`. */
export function proximosDias(
  p: PadraoDeEscala,
  inicio: string,
  n: number,
): DiaDaEscala[] {
  return Array.from({ length: n }, (_, i) => {
    const dia = somarDias(inicio, i);
    return {
      dia,
      trabalho: trabalhoNoDia(p, dia),
      minutos: minutosNoDia(p, dia),
    };
  });
}
