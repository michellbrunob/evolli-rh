/**
 * T215 — regras puras dos turnos da escala: as 12 cores, a sigla padrão e
 * as contas do dia (horas líquidas, intervalo, resumo).
 */
import type { TabelaHorarioApi } from "../../../api/horariosClient";

export const CORES_DE_TURNO = [
  { codigo: "azul", nome: "Azul" },
  { codigo: "laranja", nome: "Laranja" },
  { codigo: "cinza", nome: "Cinza" },
  { codigo: "verde", nome: "Verde" },
  { codigo: "verde_agua", nome: "Verde-água" },
  { codigo: "roxo", nome: "Roxo" },
  { codigo: "indigo", nome: "Índigo" },
  { codigo: "tangerina", nome: "Tangerina" },
  { codigo: "ciano", nome: "Ciano" },
  { codigo: "oliva", nome: "Oliva" },
  { codigo: "mostarda", nome: "Mostarda" },
  { codigo: "violeta", nome: "Violeta" },
] as const;

/** `var(--turno-…)` da cor; desconhecida vira cinza. */
export function corDoTurno(cor: string | undefined | null): string {
  const conhecida = CORES_DE_TURNO.some((c) => c.codigo === cor);
  return `var(--turno-${(conhecida ? cor! : "cinza").replace("_", "-")})`;
}

export const INTERVALOS = [
  { minutos: 0, rotulo: "Sem intervalo" },
  { minutos: 15, rotulo: "15 min" },
  { minutos: 30, rotulo: "30 min" },
  { minutos: 45, rotulo: "45 min" },
  { minutos: 60, rotulo: "1 h" },
  { minutos: 90, rotulo: "1 h 30" },
  { minutos: 120, rotulo: "2 h" },
] as const;

export const DIAS = [
  { dia: "segunda", nome: "Segunda", curto: "seg" },
  { dia: "terca", nome: "Terça", curto: "ter" },
  { dia: "quarta", nome: "Quarta", curto: "qua" },
  { dia: "quinta", nome: "Quinta", curto: "qui" },
  { dia: "sexta", nome: "Sexta", curto: "sex" },
  { dia: "sabado", nome: "Sábado", curto: "sáb" },
  { dia: "domingo", nome: "Domingo", curto: "dom" },
] as const;

export interface Periodo {
  readonly inicio: string;
  readonly fim: string;
}

/** Iniciais das duas primeiras palavras (ou a primeira letra). */
export function siglaDoNome(nome: string): string {
  const palavras = nome
    .trim()
    .split(/\s+/)
    .map((p) => p.replace(/[^A-Za-zÀ-ÿ0-9]/g, ""))
    .filter(Boolean);
  if (palavras.length === 0) return "";
  const sigla =
    palavras.length > 1
      ? `${palavras[0]![0]}${palavras[1]![0]}`
      : palavras[0]!.slice(0, 1);
  return sigla.toUpperCase();
}

export function minutos(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** "8h00", "5h45". */
export function horasCompactas(total: number): string {
  return `${Math.floor(total / 60)}h${String(total % 60).padStart(2, "0")}`;
}

/** "8 h", "5 h 45", "15 min". */
export function horasLegiveis(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")}`;
}

export function rotuloDoIntervalo(minutosDeIntervalo: number): string {
  return (
    INTERVALOS.find((i) => i.minutos === minutosDeIntervalo)?.rotulo ??
    horasLegiveis(minutosDeIntervalo)
  );
}

/**
 * Minutos de trabalho de um dia: a soma dos períodos menos o intervalo
 * quando há um período só (com mais de um, a pausa é o vão entre eles).
 */
export function trabalhoNoDia(
  periodos: readonly Periodo[],
  intervaloMinutos: number,
): number {
  const soma = periodos.reduce(
    (total, p) => total + minutos(p.fim) - minutos(p.inicio),
    0,
  );
  return periodos.length === 1 ? Math.max(0, soma - intervaloMinutos) : soma;
}

/** A pausa do dia: o intervalo (um período) ou os vãos entre os períodos. */
export function pausaDoDia(
  periodos: readonly Periodo[],
  intervaloMinutos: number,
): number {
  if (periodos.length <= 1) return periodos.length === 1 ? intervaloMinutos : 0;
  const ordenados = [...periodos].sort(
    (a, b) => minutos(a.inicio) - minutos(b.inicio),
  );
  let pausa = 0;
  for (let i = 1; i < ordenados.length; i += 1) {
    pausa += minutos(ordenados[i]!.inicio) - minutos(ordenados[i - 1]!.fim);
  }
  return pausa;
}

/** "08:00–17:00" do primeiro início ao último fim. */
export function faixa(periodos: readonly Periodo[]): string {
  if (periodos.length === 0) return "";
  const ordenados = [...periodos].sort(
    (a, b) => minutos(a.inicio) - minutos(b.inicio),
  );
  return `${ordenados[0]!.inicio}–${ordenados[ordenados.length - 1]!.fim}`;
}

/** Os períodos de cada dia de um turno, como o servidor os projeta. */
export function periodosPorDia(
  t: Pick<TabelaHorarioApi, "periodos">,
): Map<string, Periodo[]> {
  const mapa = new Map<string, Periodo[]>();
  for (const p of t.periodos) {
    const lista = mapa.get(p.dia) ?? [];
    lista.push({ inicio: p.inicio, fim: p.fim });
    mapa.set(p.dia, lista);
  }
  return mapa;
}

/** O dia típico do turno (o primeiro com trabalho). */
export function diaTipico(t: Pick<TabelaHorarioApi, "periodos">): Periodo[] {
  const mapa = periodosPorDia(t);
  for (const d of DIAS) {
    const lista = mapa.get(d.dia);
    if (lista && lista.length > 0) return lista;
  }
  return [];
}

/** "Em uso": "Sem uso", "1 pessoa", "2 pessoas". */
export function rotuloDeUso(emUso: number | undefined): string {
  if (!emUso) return "Sem uso";
  return emUso === 1 ? "1 pessoa" : `${emUso} pessoas`;
}

/** "Seg a sex 08:00–17:00 · sáb e dom folga". */
export function resumoPorDia(
  dias: ReadonlyMap<string, readonly Periodo[]>,
): string {
  const trabalho = DIAS.filter((d) => (dias.get(d.dia)?.length ?? 0) > 0);
  const folga = DIAS.filter((d) => (dias.get(d.dia)?.length ?? 0) === 0);
  if (trabalho.length === 0) return "Sem dias de trabalho";
  const faixas = new Set(trabalho.map((d) => faixa(dias.get(d.dia)!)));
  const seguidos = trabalho.every(
    (d, i) => i === 0 || DIAS.indexOf(d) === DIAS.indexOf(trabalho[i - 1]!) + 1,
  );
  const nomes =
    seguidos && trabalho.length > 1
      ? `${trabalho[0]!.curto} a ${trabalho[trabalho.length - 1]!.curto}`
      : trabalho.map((d) => d.curto).join(", ");
  const horario =
    faixas.size === 1 ? ` ${[...faixas][0]}` : " (horários diferentes)";
  const partes = [
    `${nomes.charAt(0).toUpperCase()}${nomes.slice(1)}${horario}`,
  ];
  if (folga.length > 0) {
    const nomesFolga = folga.map((d) => d.curto);
    partes.push(
      `${nomesFolga.length > 1 ? `${nomesFolga.slice(0, -1).join(", ")} e ${nomesFolga[nomesFolga.length - 1]}` : nomesFolga[0]} folga`,
    );
  }
  return partes.join(" · ");
}
