/**
 * T215 — resumo da escala a partir da grade semanal da jornada (os períodos
 * de trabalho de cada dia, como o servidor os projeta): carga semanal, dias
 * de trabalho, horário e intervalo. Funções puras, sem data nem fuso.
 */

export interface PeriodoDaGrade {
  readonly dia: string;
  readonly inicio: string;
  readonly fim: string;
}

export interface DiaDaGrade {
  readonly dia: string;
  readonly curto: string;
  readonly nome: string;
  readonly periodos: { inicio: string; fim: string }[];
  /** Minutos de trabalho no dia. */
  readonly minutos: number;
  /** Minutos entre o primeiro e o último período que não são trabalho. */
  readonly intervalo: number;
}

const DIAS = [
  { dia: "segunda", curto: "Seg", nome: "Segunda" },
  { dia: "terca", curto: "Ter", nome: "Terça" },
  { dia: "quarta", curto: "Qua", nome: "Quarta" },
  { dia: "quinta", curto: "Qui", nome: "Quinta" },
  { dia: "sexta", curto: "Sex", nome: "Sexta" },
  { dia: "sabado", curto: "Sáb", nome: "Sábado" },
  { dia: "domingo", curto: "Dom", nome: "Domingo" },
] as const;

function minutos(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Os 7 dias, de segunda a domingo; dia sem período é folga. */
export function gradeDaSemana(
  periodos: readonly PeriodoDaGrade[],
): DiaDaGrade[] {
  return DIAS.map(({ dia, curto, nome }) => {
    const doDia = periodos
      .filter((p) => p.dia === dia)
      .map((p) => ({ inicio: p.inicio, fim: p.fim }))
      .sort((a, b) => minutos(a.inicio) - minutos(b.inicio));
    const trabalhados = doDia.reduce(
      (soma, p) => soma + minutos(p.fim) - minutos(p.inicio),
      0,
    );
    const intervalo =
      doDia.length > 1
        ? minutos(doDia[doDia.length - 1]!.fim) -
          minutos(doDia[0]!.inicio) -
          trabalhados
        : 0;
    return {
      dia,
      curto,
      nome,
      periodos: doDia,
      minutos: trabalhados,
      intervalo,
    };
  });
}

/** Minutos de trabalho na semana. */
export function cargaSemanal(periodos: readonly PeriodoDaGrade[]): number {
  return gradeDaSemana(periodos).reduce((soma, d) => soma + d.minutos, 0);
}

/** "44 h", "42 h 30 min", "15 min". */
export function formatarDuracao(totalMinutos: number): string {
  const h = Math.floor(totalMinutos / 60);
  const m = totalMinutos % 60;
  if (h === 0 && m > 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

function trabalhados(periodos: readonly PeriodoDaGrade[]): DiaDaGrade[] {
  return gradeDaSemana(periodos).filter((d) => d.minutos > 0);
}

/** Quantos dias da semana têm trabalho. */
export function diasDeTrabalho(periodos: readonly PeriodoDaGrade[]): number {
  return trabalhados(periodos).length;
}

/** "Segunda a sexta", "Seg, Qua e Sex", "Sábado". */
export function resumoDosDias(periodos: readonly PeriodoDaGrade[]): string {
  const grade = gradeDaSemana(periodos);
  const indices = grade
    .map((d, i) => (d.minutos > 0 ? i : -1))
    .filter((i) => i >= 0);
  if (indices.length === 0) return "Sem dias de trabalho";
  if (indices.length === 1) return grade[indices[0]!]!.nome;
  const seguidos = indices.every(
    (v, i) => i === 0 || v === indices[i - 1]! + 1,
  );
  if (seguidos) {
    const ultimo = grade[indices[indices.length - 1]!]!.nome.toLowerCase();
    return `${grade[indices[0]!]!.nome} a ${ultimo}`;
  }
  const curtos = indices.map((i) => grade[i]!.curto);
  return `${curtos.slice(0, -1).join(", ")} e ${curtos[curtos.length - 1]}`;
}

/** "08:00–17:48" quando todos os dias de trabalho são iguais. */
export function horarioTipico(
  periodos: readonly PeriodoDaGrade[],
): string | null {
  const dias = trabalhados(periodos);
  if (dias.length === 0) return null;
  const faixas = new Set(
    dias.map(
      (d) =>
        `${d.periodos[0]!.inicio}–${d.periodos[d.periodos.length - 1]!.fim}`,
    ),
  );
  return faixas.size === 1 ? [...faixas][0]! : "Varia por dia";
}

/** "1 h por dia", "Sem intervalo" ou "Varia por dia". */
export function intervaloTipico(
  periodos: readonly PeriodoDaGrade[],
): string | null {
  const dias = trabalhados(periodos);
  if (dias.length === 0) return null;
  const intervalos = new Set(dias.map((d) => d.intervalo));
  if (intervalos.size > 1) return "Varia por dia";
  const unico = [...intervalos][0]!;
  return unico === 0 ? "Sem intervalo" : `${formatarDuracao(unico)} por dia`;
}
