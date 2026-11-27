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

/**
 * T215 — por que a contagem recomeçou (como a referência, 2026-11-26):
 * férias coletivas (CLT, art. 140), perda do direito (art. 133) ou outro
 * motivo combinado com a contabilidade.
 */
export type MotivoReinicio = "ferias_coletivas" | "perda_direito" | "outro";

export interface ReinicioDoSaldo {
  /** Primeiro dia do novo período. */
  inicio: Dia;
  motivo: MotivoReinicio;
  /** Dias que o período encurtado deu; nulo = calculado. */
  dias: number | null;
}

export interface PeriodoAquisitivo {
  inicio: Dia;
  fim: Dia;
  direito: number;
  solicitados: number;
  disponiveis: number;
  prazoGozo: Dia;
  situacao: SituacaoDoPeriodo;
  /** Encurtado por um reinício: o motivo e quando começa o novo. */
  encurtado: { motivo: MotivoReinicio; novoInicio: Dia } | null;
}

/**
 * Férias proporcionais (CLT, art. 146, parágrafo único): 1/12 do direito por
 * mês trabalhado; a fração de 15 dias ou mais conta como mês inteiro.
 */
export function diasProporcionais(
  inicio: Dia,
  fim: Dia,
  direito: number,
): number {
  const fimExclusivo = somarDias(fim, 1);
  let meses = 0;
  while (somarMeses(inicio, meses + 1) <= fimExclusivo) meses += 1;
  const sobra = somarMeses(inicio, meses);
  if (sobra <= fim && diasCorridos(sobra, fim) >= 15) meses += 1;
  return Math.min(direito, Math.round((meses * direito) / 12));
}

/**
 * Os períodos aquisitivos desde a admissão até o que contém `ate` (inclusive
 * o em aquisição). Solicitados: dias das férias que ocupam saldo naquele
 * período, mais os dias vendidos. Cada reinício encurta o período em que cai
 * (o direito vira o informado, ou o proporcional; na perda do direito, 0) e a
 * contagem de 12 meses recomeça dele.
 */
export function periodosAquisitivos(entrada: {
  admissao: Dia;
  ate: Dia;
  hoje: Dia;
  direito: number;
  ausencias: readonly AusenciaDoSaldo[];
  reinicios?: readonly ReinicioDoSaldo[];
}): PeriodoAquisitivo[] {
  const reinicios = [...(entrada.reinicios ?? [])]
    .filter((r) => r.inicio > entrada.admissao)
    .sort((a, b) => (a.inicio < b.inicio ? -1 : a.inicio > b.inicio ? 1 : 0));
  const periodos: PeriodoAquisitivo[] = [];
  let ancora = entrada.admissao;
  let k = 0;
  let r = 0;
  for (;;) {
    let inicio = somarMeses(ancora, 12 * k);
    // Reinício no próprio início de um período: só recomeça dali.
    while (r < reinicios.length && reinicios[r]!.inicio <= inicio) {
      if (reinicios[r]!.inicio === inicio) {
        ancora = inicio;
        k = 0;
      }
      r += 1;
    }
    inicio = somarMeses(ancora, 12 * k);
    if (inicio > entrada.ate) break;
    let fim = somarDias(somarMeses(ancora, 12 * (k + 1)), -1);
    let direito = entrada.direito;
    let encurtado: PeriodoAquisitivo["encurtado"] = null;
    const reinicio = reinicios[r];
    if (reinicio && reinicio.inicio <= fim) {
      fim = somarDias(reinicio.inicio, -1);
      direito =
        reinicio.dias ??
        (reinicio.motivo === "perda_direito"
          ? 0
          : diasProporcionais(inicio, fim, entrada.direito));
      encurtado = { motivo: reinicio.motivo, novoInicio: reinicio.inicio };
      ancora = reinicio.inicio;
      k = -1;
      r += 1;
    }
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
    const disponiveis = Math.max(0, direito - solicitados);
    const situacao: SituacaoDoPeriodo =
      entrada.hoje <= fim
        ? "em_aquisicao"
        : entrada.hoje > prazoGozo && disponiveis > 0
          ? "vencido"
          : "disponivel";
    periodos.push({
      inicio,
      fim,
      direito,
      solicitados,
      disponiveis,
      prazoGozo,
      situacao,
      encurtado,
    });
    k += 1;
  }
  return periodos;
}

/**
 * O período que a ficha mostra: o mais antigo já completo com saldo
 * (disponível ou vencido); senão, o encurtado logo antes do período em curso
 * (como a referência mostra a perda do direito); senão, o em curso.
 */
export function indiceDoPeriodoAtual(
  periodos: readonly PeriodoAquisitivo[],
  hoje: Dia,
): number | null {
  if (periodos.length === 0) return null;
  const comSaldo = periodos.findIndex(
    (p) => p.situacao !== "em_aquisicao" && p.disponiveis > 0,
  );
  if (comSaldo >= 0) return comSaldo;
  const emCurso = periodos.findIndex((p) => p.inicio <= hoje && hoje <= p.fim);
  if (emCurso > 0 && periodos[emCurso - 1]!.encurtado) return emCurso - 1;
  return emCurso >= 0 ? emCurso : periodos.length - 1;
}

/**
 * De que período as férias que começam em `inicio` descontam: o mais antigo
 * já completo antes do início, com saldo; ou o pedido (`pedido`), se ele
 * cumprir as mesmas condições. Período vencido (depois do prazo de gozo)
 * também serve: a CLT manda conceder, com pagamento em dobro (art. 137).
 */
export function periodoParaFerias(
  periodos: readonly PeriodoAquisitivo[],
  inicio: Dia,
  pedido?: Dia | null,
): PeriodoAquisitivo | null {
  const serve = (p: PeriodoAquisitivo) => p.fim < inicio && p.direito > 0;
  if (pedido) {
    const p = periodos.find((x) => x.inicio === pedido);
    return p && serve(p) ? p : null;
  }
  return periodos.find((p) => serve(p) && p.disponiveis > 0) ?? null;
}

/**
 * T215 — "Regras da CLT" no registro de férias (como a referência, só
 * aviso: quem registra decide):
 * - cada período com pelo menos 5 dias corridos, e um deles com 14 ou mais;
 *   até 3 períodos no mesmo período aquisitivo (art. 134, § 1º);
 * - o início não cai nos 2 dias antes do domingo (repouso semanal) nem de
 *   feriado (art. 134, § 3º; feriados nacionais de data fixa).
 */
export type AvisoClt =
  | { regra: "minimo_5"; dias: number }
  | { regra: "um_com_14" }
  | { regra: "ate_3_periodos"; ordem: number }
  | {
      regra: "inicio_antes_de_descanso";
      antesDe: "domingo" | "feriado";
      dia: Dia;
    }
  /** Dias gozados depois do prazo de gozo: pagos em dobro (art. 137). */
  | { regra: "pagamento_em_dobro"; dias: number; prazoGozo: Dia };

/** Quantos dias de `inicio` a `fim` caem depois do prazo de gozo. */
export function diasEmDobro(
  periodo: { prazoGozo: Dia },
  inicio: Dia,
  fim: Dia,
): number {
  if (fim <= periodo.prazoGozo) return 0;
  const de =
    inicio > periodo.prazoGozo ? inicio : somarDias(periodo.prazoGozo, 1);
  return diasCorridos(de, fim);
}

export function avisosDaClt(entrada: {
  inicio: Dia;
  fim: Dia;
  /** O período aquisitivo de que as férias descontam (antes delas). */
  periodo: PeriodoAquisitivo;
  /** As outras férias já lançadas nesse período (sem as vendas). */
  outrasFerias: readonly { inicio: Dia; fim: Dia }[];
  /** Os dias vendidos nestas férias (também saem do saldo). */
  diasVendidos?: number;
}): AvisoClt[] {
  const avisos: AvisoClt[] = [];
  for (const d of [1, 2]) {
    const dia = somarDias(entrada.inicio, d);
    if (dataDoDia(dia).getUTCDay() === 0) {
      avisos.push({
        regra: "inicio_antes_de_descanso",
        antesDe: "domingo",
        dia,
      });
      break;
    }
    if (ehFeriadoNacional(dia)) {
      avisos.push({
        regra: "inicio_antes_de_descanso",
        antesDe: "feriado",
        dia,
      });
      break;
    }
  }
  const dias = diasCorridos(entrada.inicio, entrada.fim);
  if (dias < 5) avisos.push({ regra: "minimo_5", dias });
  const ordem = entrada.outrasFerias.length + 1;
  if (ordem > 3) avisos.push({ regra: "ate_3_periodos", ordem });
  const jaHouve14 = entrada.outrasFerias.some(
    (f) => diasCorridos(f.inicio, f.fim) >= 14,
  );
  const sobra =
    entrada.periodo.disponiveis - dias - (entrada.diasVendidos ?? 0);
  if (dias < 14 && !jaHouve14 && sobra < 14) {
    avisos.push({ regra: "um_com_14" });
  }
  const emDobro = diasEmDobro(entrada.periodo, entrada.inicio, entrada.fim);
  if (emDobro > 0) {
    avisos.push({
      regra: "pagamento_em_dobro",
      dias: emDobro,
      prazoGozo: entrada.periodo.prazoGozo,
    });
  }
  return avisos;
}

/** Até 1/3 do direito, no máximo 10 dias (CLT, art. 143). */
export function maxVendaveis(direito: number): number {
  return Math.min(10, Math.floor(direito / 3));
}

/**
 * O que ainda dá para vender no período: o limite (1/3, no máximo 10) menos
 * o que as outras férias do mesmo período já venderam.
 */
export function vendaveisRestantes(
  direito: number,
  jaVendidos: number,
): number {
  return Math.max(0, maxVendaveis(direito) - jaVendidos);
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
