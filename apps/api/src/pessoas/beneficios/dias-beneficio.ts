import { ehFeriadoNacional } from "../ausencias/calculo-ausencias";

/**
 * T215 — dias do mês (`AAAA-MM`) para os benefícios pagos por dia (como a
 * referência):
 *
 * - dias úteis: segunda a sexta, sem os feriados nacionais de data fixa, os
 *   do estado da empresa (data fixa, por lei estadual) e os municipais
 *   cadastrados nas Regras da escala (ponto facultativo não tira o dia);
 * - pela escala do cadastro (sem escala publicada no mês): a proporção de
 *   trabalho do modelo sobre os dias do mês (12x36 = 15, 6x1 = 26 em 30
 *   dias). 5x2, "outra" e sem escala contam os dias úteis (`null`).
 *
 * A mesma tabela de feriados estaduais da tela (aba Escala da ficha).
 */

const FERIADOS_ESTADUAIS: Readonly<Record<string, readonly string[]>> = {
  AC: ["01-23", "06-15", "08-06", "11-17"],
  AL: ["06-24", "06-29", "09-16"],
  AM: ["09-05"],
  AP: ["03-19", "09-13"],
  BA: ["07-02"],
  CE: ["03-25"],
  DF: ["11-30"],
  MA: ["07-28"],
  MS: ["10-11"],
  PA: ["08-15"],
  PB: ["08-05"],
  PE: ["03-06"],
  PI: ["10-19"],
  PR: ["12-19"],
  RJ: ["04-23"],
  RN: ["10-03"],
  RO: ["01-04", "06-18"],
  RR: ["10-05"],
  RS: ["09-20"],
  SE: ["07-08"],
  SP: ["07-09"],
  TO: ["03-18", "09-08", "10-05"],
};

export function feriadoEstadualFixo(dia: string, uf: string | null): boolean {
  if (!uf) return false;
  return FERIADOS_ESTADUAIS[uf]?.includes(dia.slice(5)) ?? false;
}

export function diasDoMes(competencia: string): number {
  const [ano, mes] = competencia.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

/** Segunda (1) a domingo (7). */
function diaDaSemana(dia: string): number {
  const d = new Date(`${dia}T00:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}

/** Dia útil: segunda a sexta, sem feriado nacional, estadual ou municipal. */
export function ehDiaUtil(
  dia: string,
  uf: string | null,
  municipais: ReadonlySet<string>,
): boolean {
  return (
    diaDaSemana(dia) <= 5 &&
    !ehFeriadoNacional(dia) &&
    !feriadoEstadualFixo(dia, uf) &&
    !municipais.has(dia)
  );
}

export function diasUteisDoMes(
  competencia: string,
  uf: string | null,
  feriadosMunicipais: readonly string[],
): number {
  const municipais = new Set(feriadosMunicipais);
  let total = 0;
  for (let d = 1; d <= diasDoMes(competencia); d += 1) {
    const dia = `${competencia}-${String(d).padStart(2, "0")}`;
    if (ehDiaUtil(dia, uf, municipais)) total += 1;
  }
  return total;
}

const SEMANAIS: Readonly<Record<string, number>> = {
  "6x1": 6,
  semana_espanhola: 5.5,
  "4x3": 4,
  fim_de_semana: 2,
};
const PLANTAO = new Set(["12x36", "12x60", "12x72", "18x36", "24x48", "24x72"]);

/**
 * A proporção de trabalho do modelo (dias de trabalho por dia corrido);
 * `null` = o modelo conta os dias úteis (5x2, "outra", sem escala).
 */
export function proporcaoDoModelo(modelo: string | null): number | null {
  if (!modelo || modelo === "5x2" || modelo === "outra") return null;
  if (modelo in SEMANAIS) return SEMANAIS[modelo]! / 7;
  const ciclo = /^(\d+)x(\d+)$/.exec(modelo);
  if (!ciclo) return null;
  const trabalho = Number(ciclo[1]);
  const folga = Number(ciclo[2]);
  return PLANTAO.has(modelo)
    ? 24 / (trabalho + folga)
    : trabalho / (trabalho + folga);
}

/** Os dias do mês pela proporção do modelo; `null` = contar os dias úteis. */
export function diasPeloModelo(
  modelo: string | null,
  competencia: string,
): number | null {
  const proporcao = proporcaoDoModelo(modelo);
  if (proporcao === null) return null;
  return Math.round(diasDoMes(competencia) * proporcao);
}
