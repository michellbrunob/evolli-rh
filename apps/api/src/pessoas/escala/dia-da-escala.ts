import type { ErroDeCampo } from "../../common/erros/recusa-por-campo";

/**
 * T215 — a forma de um dia do quadro da escala (menu da célula e painel do
 * dia), em funções puras:
 *
 * - `trabalho`: 1 ou 2 períodos (turno partido), intervalo de 0 a 2 h e, no
 *   máximo, 1 sobreaviso depois do turno; turno opcional;
 * - `folga` e `dsr`: só a observação;
 * - `sobreaviso`: 1 ou 2 períodos, sem turno nem intervalo.
 *
 * Horário "HH:MM"; o fim antes (ou igual) do início termina no dia seguinte.
 * O segundo período começa depois do fim do primeiro; o sobreaviso não cruza
 * o trabalho. Só o motivo, nunca o valor.
 */
export const TIPOS_DE_DIA = ["trabalho", "folga", "dsr", "sobreaviso"] as const;
export type TipoDeDia = (typeof TIPOS_DE_DIA)[number];

export const INTERVALOS_ACEITOS = [0, 15, 30, 45, 60, 90, 120] as const;

export interface Periodo {
  inicio: string;
  fim: string;
}

export interface DiaInformado {
  tipo: string;
  tabelaHorarioId?: string | null;
  periodos?: Periodo[] | null;
  intervaloMinutos?: number | null;
  sobreaviso?: Periodo[] | null;
  unidadeOrganizacionalId?: string | null;
  observacao?: string | null;
}

function minutos(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** O período em minutos corridos a partir da 00:00 do dia: [início, fim). */
export function trecho(p: Periodo, base = 0): [number, number] {
  const i = minutos(p.inicio) + base;
  let f = minutos(p.fim) + base;
  if (f <= i) f += 24 * 60;
  return [i, f];
}

/** Os períodos em sequência: cada um começa no fim do anterior ou depois. */
function emSequencia(periodos: Periodo[]): [number, number][] | null {
  const trechos: [number, number][] = [];
  for (const p of periodos) {
    const anterior = trechos[trechos.length - 1];
    let t = trecho(p);
    // Começa no relógio antes do primeiro período: é do dia seguinte.
    if (anterior && t[0] < trechos[0]![0]) t = trecho(p, 24 * 60);
    if (anterior && t[0] < anterior[1]) return null;
    trechos.push(t);
  }
  return trechos;
}

function informado(valor: unknown): boolean {
  if (Array.isArray(valor)) return valor.length > 0;
  return valor !== undefined && valor !== null && valor !== 0;
}

export function conferirDia(d: DiaInformado): ErroDeCampo[] {
  const erros: ErroDeCampo[] = [];
  const periodos = d.periodos ?? [];
  const sobreaviso = d.sobreaviso ?? [];

  if (d.tipo === "folga" || d.tipo === "dsr") {
    for (const campo of [
      "tabelaHorarioId",
      "periodos",
      "intervaloMinutos",
      "sobreaviso",
      "unidadeOrganizacionalId",
    ] as const) {
      if (informado(d[campo])) erros.push({ campo, motivo: "nao_se_aplica" });
    }
    return erros;
  }

  if (d.tipo === "sobreaviso") {
    for (const campo of [
      "tabelaHorarioId",
      "intervaloMinutos",
      "sobreaviso",
    ] as const) {
      if (informado(d[campo])) erros.push({ campo, motivo: "nao_se_aplica" });
    }
  }

  if (periodos.length === 0) {
    erros.push({ campo: "periodos", motivo: "obrigatorio" });
  } else if (periodos.length > 2) {
    erros.push({ campo: "periodos", motivo: "invalido" });
  } else if (periodos.some((p) => p.inicio === p.fim)) {
    erros.push({ campo: "periodos", motivo: "invalido" });
  } else if (emSequencia(periodos) === null) {
    erros.push({ campo: "periodos", motivo: "sobreposta" });
  }

  if (d.tipo === "trabalho") {
    if (
      d.intervaloMinutos != null &&
      !(INTERVALOS_ACEITOS as readonly number[]).includes(d.intervaloMinutos)
    ) {
      erros.push({ campo: "intervaloMinutos", motivo: "invalido" });
    }
    if (sobreaviso.length > 1 || sobreaviso.some((p) => p.inicio === p.fim)) {
      erros.push({ campo: "sobreaviso", motivo: "invalido" });
    } else if (sobreaviso.length === 1 && erros.length === 0) {
      const trabalho = emSequencia(periodos)!;
      const fimDoTrabalho = trabalho[trabalho.length - 1]![1];
      // Começa antes do início do trabalho: é do dia seguinte.
      let s = trecho(sobreaviso[0]!);
      if (s[0] < trabalho[0]![0]) s = trecho(sobreaviso[0]!, 24 * 60);
      if (s[0] < fimDoTrabalho) {
        erros.push({ campo: "sobreaviso", motivo: "sobreposta" });
      }
    }
  }
  return erros;
}
