import { StatusAusencia, TipoAusencia, TipoVinculo } from "@prisma/client";

/**
 * T215 — Férias e ausências: cálculos puros sobre dias civis (`AAAA-MM-DD`),
 * sem fuso — "hoje" é sempre o dia civil de São Paulo.
 *
 * **Feriados:** o servidor não tem calendário de feriados cadastrado. Valem
 * os NACIONAIS fixos por lei (Lei 662/1949, Lei 6.802/1980 e Lei
 * 14.759/2023); estaduais, municipais e móveis ficam para quando houver o
 * cadastro. Dia útil = segunda a sexta que não é feriado nacional.
 *
 * **Férias (CLT):** períodos aquisitivos de 12 meses desde a admissão do
 * vínculo principal (art. 130), prazo de gozo de 12 meses depois do fim
 * (art. 134), abono de até 1/3 do direito, no máximo 10 dias, pedido até 15
 * dias antes do fim do período aquisitivo (art. 143).
 */

export type Dia = string;

const DIA = /^(\d{4})-(\d{2})-(\d{2})$/;

function paraData(dia: Dia): Date {
  const m = DIA.exec(dia);
  if (!m) throw new Error("dia inválido");
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

function paraDia(data: Date): Dia {
  return data.toISOString().slice(0, 10);
}

/** O dia civil (`AAAA-MM-DD`) de uma data gravada como `@db.Date`. */
export function diaDe(data: Date): Dia {
  return paraDia(data);
}

/** O `Date` de um dia civil, para gravar em coluna `@db.Date`. */
export function dataDoDia(dia: Dia): Date {
  return paraData(dia);
}

/** O dia civil de São Paulo no instante dado. */
export function hojeEmSaoPaulo(agora: Date = new Date()): Dia {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agora);
}

export function somarDias(dia: Dia, n: number): Dia {
  const d = paraData(dia);
  d.setUTCDate(d.getUTCDate() + n);
  return paraDia(d);
}

/** Soma meses; o dia que não existe no mês de chegada vira o último dele. */
export function somarMeses(dia: Dia, n: number): Dia {
  const d = paraData(dia);
  const alvo = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
  const ultimo = new Date(
    Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0),
  ).getUTCDate();
  alvo.setUTCDate(Math.min(d.getUTCDate(), ultimo));
  return paraDia(alvo);
}

/** Dias corridos, contando o primeiro e o último. */
export function diasCorridos(inicio: Dia, fim: Dia): number {
  return (
    Math.round((paraData(fim).getTime() - paraData(inicio).getTime()) / 864e5) +
    1
  );
}

/** Feriados nacionais fixos (mês-dia). */
const FERIADOS_NACIONAIS = new Set([
  "01-01", // Confraternização Universal
  "04-21", // Tiradentes
  "05-01", // Dia do Trabalho
  "09-07", // Independência
  "10-12", // Nossa Senhora Aparecida
  "11-02", // Finados
  "11-15", // Proclamação da República
  "11-20", // Dia Nacional de Zumbi e da Consciência Negra
  "12-25", // Natal
]);

export function ehFeriadoNacional(dia: Dia): boolean {
  return FERIADOS_NACIONAIS.has(dia.slice(5));
}

export function ehDiaUtil(dia: Dia): boolean {
  const semana = paraData(dia).getUTCDay();
  return semana !== 0 && semana !== 6 && !ehFeriadoNacional(dia);
}

export function diasUteis(inicio: Dia, fim: Dia): number {
  let total = 0;
  for (let d = inicio; d <= fim; d = somarDias(d, 1)) {
    if (ehDiaUtil(d)) total += 1;
  }
  return total;
}

/** A volta ao trabalho: o primeiro dia útil depois do último dia. */
export function diaDaVolta(fim: Dia): Dia {
  let d = somarDias(fim, 1);
  while (!ehDiaUtil(d)) d = somarDias(d, 1);
  return d;
}

/**
 * T215 — a regra de férias pelo tipo do vínculo (decisão da empresa,
 * 2026-11-23/24):
 * - `calculada`: CLT e Estágio — saldo automático (períodos aquisitivos);
 * - `sem_ferias`: PJ e Freelancer — não entram em férias;
 * - `sem_regra`: Aprendiz e os tipos ainda não decididos — sem cálculo
 *   automático; férias entram sem conferir saldo, sem período e sem venda.
 */
export type RegraDeFerias = "calculada" | "sem_ferias" | "sem_regra";

export function regraDeFeriasDoTipo(tipo: TipoVinculo): RegraDeFerias {
  if (tipo === "clt" || tipo === "estagio") return "calculada";
  if (tipo === "pj" || tipo === "freelancer") return "sem_ferias";
  return "sem_regra";
}

/** Direito anual: 30 dias só onde a regra é calculada; os demais, 0. */
export function direitoDoTipo(tipo: TipoVinculo): number {
  return regraDeFeriasDoTipo(tipo) === "calculada" ? 30 : 0;
}

/** Status em que a ausência ocupa a agenda (e, nas férias, o saldo). */
export const STATUS_QUE_OCUPAM: readonly StatusAusencia[] = [
  "aguardando_gestor",
  "aguardando_rh",
  "aprovada",
  "cancelamento_pedido",
  "ajuste_sugerido",
];

export interface AusenciaDoSaldo {
  tipo: TipoAusencia;
  status: StatusAusencia;
  inicio: Dia;
  fim: Dia | null;
  diasVendidos: number;
  periodoAquisitivoInicio: Dia | null;
}

export type SituacaoDoPeriodo = "em_aquisicao" | "disponivel" | "vencido";

export interface PeriodoAquisitivo {
  inicio: Dia;
  fim: Dia;
  direito: number;
  solicitados: number;
  disponiveis: number;
  prazoGozo: Dia;
  situacao: SituacaoDoPeriodo;
}

/**
 * Os períodos aquisitivos desde a admissão até o que contém `ate` (inclusive
 * o em aquisição). Solicitados: dias das férias que ocupam saldo naquele
 * período, mais os dias vendidos.
 */
export function periodosAquisitivos(entrada: {
  admissao: Dia;
  ate: Dia;
  hoje: Dia;
  direito: number;
  ausencias: readonly AusenciaDoSaldo[];
}): PeriodoAquisitivo[] {
  const periodos: PeriodoAquisitivo[] = [];
  for (let k = 0; ; k += 1) {
    const inicio = somarMeses(entrada.admissao, 12 * k);
    if (inicio > entrada.ate) break;
    const fim = somarDias(somarMeses(entrada.admissao, 12 * (k + 1)), -1);
    const prazoGozo = somarMeses(fim, 12);
    const solicitados = entrada.ausencias
      .filter(
        (a) =>
          a.tipo === "ferias" &&
          STATUS_QUE_OCUPAM.includes(a.status) &&
          a.periodoAquisitivoInicio === inicio &&
          a.fim !== null,
      )
      .reduce((s, a) => s + diasCorridos(a.inicio, a.fim!) + a.diasVendidos, 0);
    const disponiveis = Math.max(0, entrada.direito - solicitados);
    const situacao: SituacaoDoPeriodo =
      entrada.hoje <= fim
        ? "em_aquisicao"
        : entrada.hoje > prazoGozo && disponiveis > 0
          ? "vencido"
          : "disponivel";
    periodos.push({
      inicio,
      fim,
      direito: entrada.direito,
      solicitados,
      disponiveis,
      prazoGozo,
      situacao,
    });
  }
  return periodos;
}

/**
 * De que período as férias que começam em `inicio` descontam: o mais antigo
 * já completo antes do início, ainda dentro do prazo de gozo, com saldo; ou
 * o pedido (`pedido`), se ele cumprir as mesmas condições.
 */
export function periodoParaFerias(
  periodos: readonly PeriodoAquisitivo[],
  inicio: Dia,
  pedido?: Dia | null,
): PeriodoAquisitivo | null {
  const serve = (p: PeriodoAquisitivo) =>
    p.fim < inicio && inicio <= p.prazoGozo && p.direito > 0;
  if (pedido) {
    const p = periodos.find((x) => x.inicio === pedido);
    return p && serve(p) ? p : null;
  }
  return periodos.find((p) => serve(p) && p.disponiveis > 0) ?? null;
}

/** Até 1/3 do direito, no máximo 10 dias (CLT, art. 143). */
export function maxVendaveis(direito: number): number {
  return Math.min(10, Math.floor(direito / 3));
}

/** Pedido do abono até 15 dias antes do fim do período (art. 143, § 1º). */
export function prazoDoAbono(periodo: { inicio: Dia; fim: Dia }): Dia {
  return somarDias(periodo.fim, -15);
}

/** Dois intervalos se cruzam (fim nulo = sem data de volta). */
export function seSobrepoem(
  a: { inicio: Dia; fim: Dia | null },
  b: { inicio: Dia; fim: Dia | null },
): boolean {
  const fimA = a.fim ?? "9999-12-31";
  const fimB = b.fim ?? "9999-12-31";
  return a.inicio <= fimB && b.inicio <= fimA;
}
