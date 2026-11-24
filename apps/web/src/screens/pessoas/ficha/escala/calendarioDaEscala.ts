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
  /**
   * T215 — intervalo do turno (minutos), descontado no dia de UM período
   * corrido (com dois ou mais períodos, a pausa é o vão entre eles).
   */
  readonly intervaloTurno?: number;
  readonly intervaloTurnoNoite?: number;
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

function liquidoPorDia(
  turno: readonly PeriodoDoTurno[],
  intervalo: number,
): Map<string, number> {
  const porDia = new Map<string, number>();
  const quantos = new Map<string, number>();
  for (const p of turno) {
    porDia.set(
      p.dia,
      (porDia.get(p.dia) ?? 0) + minutos(p.fim) - minutos(p.inicio),
    );
    quantos.set(p.dia, (quantos.get(p.dia) ?? 0) + 1);
  }
  for (const [dia, total] of porDia) {
    if (quantos.get(dia) === 1) porDia.set(dia, Math.max(0, total - intervalo));
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
  intervalo = 0,
): number {
  if (!turno || turno.length === 0) return 0;
  const porDia = liquidoPorDia(turno, intervalo);
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
  return t === "noite"
    ? minutosDoTurno(p.turnoNoite, dia, p.intervaloTurnoNoite ?? 0)
    : minutosDoTurno(p.turno, dia, p.intervaloTurno ?? 0);
}

/**
 * T215 — EC 141/2026: o limite constitucional da jornada semanal cai de 44 h
 * para 42 h dois meses depois da publicação e para 40 h um ano depois
 * (datas da transição; editáveis nas Regras da escala quando elas existirem).
 */
export const TRANSICAO_EC_141: readonly {
  readonly desde: string;
  readonly horas: number;
}[] = [
  { desde: "2026-12-16", horas: 42 },
  { desde: "2027-12-16", horas: 40 },
];

/** Limite legal da jornada semanal (horas) no dia. */
export function limiteLegalSemanal(dia: string): number {
  let horas = 44;
  for (const etapa of TRANSICAO_EC_141)
    if (dia >= etapa.desde) horas = etapa.horas;
  return horas;
}

/**
 * T215 — "Jornada por semana" da Escala atual, como na referência: a
 * jornada do contrato e o limite legal da data — vale o menor. Em minutos.
 */
export function jornadaPorSemana(
  jornadaContratoHoras: number | null | undefined,
  dia: string,
): number {
  const legal = limiteLegalSemanal(dia);
  const contrato =
    jornadaContratoHoras != null && jornadaContratoHoras > 0
      ? jornadaContratoHoras
      : legal;
  return Math.min(contrato, legal) * 60;
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

/** Feriados nacionais de data fixa (mês-dia → nome). */
const NOMES_DOS_FERIADOS: Record<string, string> = {
  "01-01": "Confraternização Universal",
  "04-21": "Tiradentes",
  "05-01": "Dia do Trabalho",
  "09-07": "Independência do Brasil",
  "10-12": "Nossa Senhora Aparecida",
  "11-02": "Finados",
  "11-15": "Proclamação da República",
  "11-20": "Dia Nacional de Zumbi e da Consciência Negra",
  "12-25": "Natal",
};
const FERIADOS_NACIONAIS = new Set(Object.keys(NOMES_DOS_FERIADOS));

/** O nome do feriado nacional de data fixa no dia, ou `null`. */
export function feriadoDe(dia: string): string | null {
  return NOMES_DOS_FERIADOS[dia.slice(5)] ?? null;
}

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
/** Sem escala, 5x2 e "outra" contam os dias úteis (fora do catálogo). */
export function beneficioPelosDiasUteis(modelo: string | null): boolean {
  const m = modeloDe(modelo);
  return !m || m.codigo === "5x2" || m.tipo === "outra";
}

export function diasNoMes(modelo: string | null, mes: string): number {
  const m = modeloDe(modelo);
  if (!m || beneficioPelosDiasUteis(modelo)) {
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

/**
 * T215 — avisos de legislação mostrados na gaveta do padrão (não impedem
 * salvar; o RH decide com acordo, convenção ou banco de horas):
 *
 * - limite semanal: a soma do padrão acima do menor entre a jornada do
 *   contrato e o limite legal da data (EC 141/2026) — o excedente é extra;
 * - mais de 10 h num dia (8 h normais + até 2 h extras, CLT, art. 59);
 * - intervalo (CLT, art. 71): acima de 6 h de trabalho, de 1 h a 2 h; de 4 h
 *   a 6 h, 15 min; acima de 2 h só com acordo escrito ou convenção;
 * - descanso de 11 h entre um dia de trabalho e o seguinte (CLT, art. 66).
 *
 * O 12x36 segue o art. 59-A (12 h com 36 h de descanso, intervalos
 * observados ou indenizados): nenhum desses avisos se aplica a ele.
 */
export function avisosDaJornada(
  p: PadraoDeEscala,
  limiteSemanalHoras: number,
  base: string,
): string[] {
  if (p.modelo === "12x36" || !p.turno || p.turno.length === 0) return [];
  const avisos: string[] = [];
  const semanal = horasPorSemana(p, base);
  if (semanal > limiteSemanalHoras * 60) {
    avisos.push(
      `Este padrão soma ${formatarHoras(semanal)} por semana, acima do limite de ${limiteSemanalHoras} h (jornada do contrato e EC 141/2026). O que passar disso é hora extra.`,
    );
  }
  let maiorDia = 0;
  let semIntervaloLongo = false;
  let semPausaCurta = false;
  let intervaloLongo = false;
  let descansoCurto = false;
  const turnos: [readonly PeriodoDoTurno[] | null, number][] = [
    [p.turno, p.intervaloTurno ?? 0],
    [p.turnoNoite, p.intervaloTurnoNoite ?? 0],
  ];
  for (const [turno, intervalo] of turnos) {
    if (!turno) continue;
    for (const dia of new Set(turno.map((x) => x.dia))) {
      const periodos = turno
        .filter((x) => x.dia === dia)
        .map((x) => [minutos(x.inicio), minutos(x.fim)] as const)
        .sort((a, b) => a[0] - b[0]);
      const bruto = periodos.reduce((t, [i, f]) => t + f - i, 0);
      let pausa = 0;
      for (let k = 1; k < periodos.length; k += 1) {
        pausa += periodos[k]![0] - periodos[k - 1]![1];
      }
      if (periodos.length === 1) pausa = intervalo;
      const trabalho = periodos.length === 1 ? bruto - intervalo : bruto;
      const extensao = periodos[periodos.length - 1]![1] - periodos[0]![0];
      maiorDia = Math.max(maiorDia, trabalho);
      if (trabalho > 360 && pausa < 60) semIntervaloLongo = true;
      else if (trabalho > 240 && trabalho <= 360 && pausa < 15) {
        semPausaCurta = true;
      }
      if (pausa > 120) intervaloLongo = true;
      if (24 * 60 - extensao < 11 * 60) descansoCurto = true;
    }
  }
  if (semIntervaloLongo) {
    avisos.push(
      "Turno com mais de 6 h de trabalho precisa de intervalo de 1 h a 2 h (CLT, art. 71).",
    );
  }
  if (semPausaCurta) {
    avisos.push(
      "Turno de 4 h a 6 h precisa de pausa de 15 min (CLT, art. 71, § 1º).",
    );
  }
  if (intervaloLongo) {
    avisos.push(
      "Intervalo acima de 2 h só vale com acordo escrito ou convenção coletiva (CLT, art. 71).",
    );
  }
  if (maiorDia > 600) {
    avisos.push(
      `Há dia com ${formatarHoras(maiorDia)} de trabalho: acima de 10 h por dia (8 h normais + 2 h extras, CLT, art. 59).`,
    );
  }
  if (descansoCurto) {
    avisos.push(
      "Fica menos de 11 h de descanso entre um dia de trabalho e o seguinte (CLT, art. 66).",
    );
  }
  return avisos;
}
