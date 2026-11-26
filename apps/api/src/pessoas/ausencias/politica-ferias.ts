/**
 * T215 — Políticas de férias (como a referência, 2026-11-26): as regras que
 * a empresa confere em cada registro de férias, além dos pisos da CLT. Nada
 * aqui bloqueia: o que não segue a política é apontado, e quem registra
 * decide — informando o motivo.
 *
 * Dias civis `AAAA-MM-DD`. Feriados: os nacionais de data fixa (os mesmos
 * do cálculo dos dias úteis).
 */
import {
  type Dia,
  dataDoDia,
  diaDaVolta,
  diasCorridos,
  ehFeriadoNacional,
  somarDias,
  somarMeses,
} from "./calculo-ausencias";

export interface BloqueioDaPolitica {
  nome: string;
  inicio: Dia;
  fim: Dia;
  /** Repete todo ano nas mesmas datas. */
  todoAno: boolean;
}

export interface RegrasDaPolitica {
  antecedenciaMinimaDias: number | null;
  antecedenciaMaximaMeses: number | null;
  alemDoSaldo: "nao_aceitar" | "aceitar";
  duracaoMinimaDias: number | null;
  duracaoMaximaDias: number | null;
  periodosPorAno: number | null;
  periodoMaiorDias: number | null;
  intervaloDias: number | null;
  inicioNaoAntesDeDescanso: boolean;
  inicioNaoNoFimDeSemana: boolean;
  voltaNaoNaSexta: boolean;
  voltaNaoNaVespera: boolean;
  bloqueios: BloqueioDaPolitica[];
  /** Até N pessoas do mesmo departamento fora ao mesmo tempo. */
  foraAoMesmoTempo: number | null;
}

export const REGRAS_VAZIAS: RegrasDaPolitica = {
  antecedenciaMinimaDias: null,
  antecedenciaMaximaMeses: null,
  alemDoSaldo: "nao_aceitar",
  duracaoMinimaDias: null,
  duracaoMaximaDias: null,
  periodosPorAno: null,
  periodoMaiorDias: null,
  intervaloDias: null,
  inicioNaoAntesDeDescanso: false,
  inicioNaoNoFimDeSemana: false,
  voltaNaoNaSexta: false,
  voltaNaoNaVespera: false,
  bloqueios: [],
  foraAoMesmoTempo: null,
};

export type ViolacaoDaPolitica =
  | { regra: "antecedencia_minima"; dias: number; minimo: number }
  | { regra: "antecedencia_maxima"; meses: number; maximo: number }
  | { regra: "duracao_minima"; dias: number; minimo: number }
  | { regra: "duracao_maxima"; dias: number; maximo: number }
  | { regra: "periodos_por_ano"; ordem: number; maximo: number }
  | { regra: "periodo_maior"; minimo: number }
  | { regra: "intervalo"; dias: number; minimo: number }
  | {
      regra: "inicio_antes_de_descanso";
      antesDe: "domingo" | "feriado";
      dia: Dia;
    }
  | { regra: "inicio_no_descanso"; dia: Dia }
  | { regra: "volta_na_sexta"; dia: Dia }
  | { regra: "volta_na_vespera"; dia: Dia }
  | { regra: "bloqueio"; nome: string; inicio: Dia; fim: Dia }
  | { regra: "alem_do_saldo" }
  | { regra: "equipe"; fora: number; maximo: number };

const diaDaSemana = (dia: Dia) => dataDoDia(dia).getUTCDay();
const ehDescanso = (dia: Dia) =>
  diaDaSemana(dia) === 0 || diaDaSemana(dia) === 6 || ehFeriadoNacional(dia);

/** Dias entre duas datas (b − a). */
function diasEntre(a: Dia, b: Dia): number {
  return diasCorridos(a, b) - 1;
}

/** Meses completos de `a` até `b`. */
function mesesEntre(a: Dia, b: Dia): number {
  let meses = 0;
  while (somarMeses(a, meses + 1) <= b) meses += 1;
  return meses;
}

/** O bloqueio nas datas do pedido (todo ano: no ano de cada dia do pedido). */
function bloqueioQueEncosta(
  b: BloqueioDaPolitica,
  inicio: Dia,
  fim: Dia,
): { inicio: Dia; fim: Dia } | null {
  const cruza = (x: Dia, y: Dia) => x <= fim && inicio <= y;
  if (!b.todoAno) return cruza(b.inicio, b.fim) ? b : null;
  const anoDe = Number(inicio.slice(0, 4));
  const anoAte = Number(fim.slice(0, 4));
  const viraOAno = b.fim.slice(5) < b.inicio.slice(5);
  for (let ano = anoDe - 1; ano <= anoAte; ano += 1) {
    const de = `${ano}-${b.inicio.slice(5)}`;
    const ate = `${viraOAno ? ano + 1 : ano}-${b.fim.slice(5)}`;
    if (cruza(de, ate)) return { inicio: de, fim: ate };
  }
  return null;
}

export function violacoesDaPolitica(entrada: {
  regras: RegrasDaPolitica;
  hoje: Dia;
  inicio: Dia;
  fim: Dia;
  /** Saldo do período depois destas férias (negativo = além do saldo). */
  saldoDepois: number;
  /** As outras férias no mesmo período aquisitivo. */
  outrasFerias: readonly { inicio: Dia; fim: Dia }[];
  /** Pessoas do mesmo departamento já fora nessas datas. */
  foraNaEquipe: number;
}): ViolacaoDaPolitica[] {
  const r = entrada.regras;
  const v: ViolacaoDaPolitica[] = [];
  const { inicio, fim } = entrada;
  const dias = diasCorridos(inicio, fim);

  // Pedido.
  const antecedencia = diasEntre(entrada.hoje, inicio);
  if (
    r.antecedenciaMinimaDias !== null &&
    antecedencia < r.antecedenciaMinimaDias
  ) {
    v.push({
      regra: "antecedencia_minima",
      dias: antecedencia,
      minimo: r.antecedenciaMinimaDias,
    });
  }
  if (
    r.antecedenciaMaximaMeses !== null &&
    inicio > somarMeses(entrada.hoje, r.antecedenciaMaximaMeses)
  ) {
    v.push({
      regra: "antecedencia_maxima",
      meses: mesesEntre(entrada.hoje, inicio),
      maximo: r.antecedenciaMaximaMeses,
    });
  }

  // Divisão em períodos.
  if (r.duracaoMinimaDias !== null && dias < r.duracaoMinimaDias) {
    v.push({ regra: "duracao_minima", dias, minimo: r.duracaoMinimaDias });
  }
  if (r.duracaoMaximaDias !== null && dias > r.duracaoMaximaDias) {
    v.push({ regra: "duracao_maxima", dias, maximo: r.duracaoMaximaDias });
  }
  const ordem = entrada.outrasFerias.length + 1;
  if (r.periodosPorAno !== null && ordem > r.periodosPorAno) {
    v.push({ regra: "periodos_por_ano", ordem, maximo: r.periodosPorAno });
  }
  if (
    r.periodoMaiorDias !== null &&
    dias < r.periodoMaiorDias &&
    !entrada.outrasFerias.some(
      (f) => diasCorridos(f.inicio, f.fim) >= r.periodoMaiorDias!,
    ) &&
    entrada.saldoDepois < r.periodoMaiorDias
  ) {
    v.push({ regra: "periodo_maior", minimo: r.periodoMaiorDias });
  }
  if (r.intervaloDias !== null && entrada.outrasFerias.length > 0) {
    const folgas = entrada.outrasFerias.map((f) =>
      f.fim < inicio
        ? diasEntre(f.fim, inicio) - 1
        : diasEntre(fim, f.inicio) - 1,
    );
    const menor = Math.min(...folgas);
    if (menor >= 0 && menor < r.intervaloDias) {
      v.push({ regra: "intervalo", dias: menor, minimo: r.intervaloDias });
    }
  }

  // Datas.
  if (r.inicioNaoAntesDeDescanso) {
    for (const d of [1, 2]) {
      const dia = somarDias(inicio, d);
      if (diaDaSemana(dia) === 0) {
        v.push({ regra: "inicio_antes_de_descanso", antesDe: "domingo", dia });
        break;
      }
      if (ehFeriadoNacional(dia)) {
        v.push({ regra: "inicio_antes_de_descanso", antesDe: "feriado", dia });
        break;
      }
    }
  }
  if (r.inicioNaoNoFimDeSemana && ehDescanso(inicio)) {
    v.push({ regra: "inicio_no_descanso", dia: inicio });
  }
  const volta = diaDaVolta(fim);
  if (r.voltaNaoNaSexta && diaDaSemana(volta) === 5) {
    v.push({ regra: "volta_na_sexta", dia: volta });
  }
  if (r.voltaNaoNaVespera && ehFeriadoNacional(somarDias(volta, 1))) {
    v.push({ regra: "volta_na_vespera", dia: volta });
  }
  for (const b of r.bloqueios) {
    const encosta = bloqueioQueEncosta(b, inicio, fim);
    if (encosta) v.push({ regra: "bloqueio", nome: b.nome, ...encosta });
  }

  // Saldo e equipe.
  if (r.alemDoSaldo === "nao_aceitar" && entrada.saldoDepois < 0) {
    v.push({ regra: "alem_do_saldo" });
  }
  if (
    r.foraAoMesmoTempo !== null &&
    entrada.foraNaEquipe >= r.foraAoMesmoTempo
  ) {
    v.push({
      regra: "equipe",
      fora: entrada.foraNaEquipe,
      maximo: r.foraAoMesmoTempo,
    });
  }
  return v;
}

/**
 * A coluna "Principais regras" da lista: a primeira, a segunda e quantas
 * mais ("Antecedência de 30 dias" / "Até 2 períodos · e mais 4").
 */
export function principaisRegras(r: RegrasDaPolitica): {
  primeira: string;
  segunda: string | null;
  mais: number;
} {
  const t: string[] = [];
  if (r.antecedenciaMinimaDias !== null) {
    t.push(
      `Antecedência de ${r.antecedenciaMinimaDias} ${r.antecedenciaMinimaDias === 1 ? "dia" : "dias"}`,
    );
  }
  if (r.periodosPorAno !== null) {
    t.push(
      `Até ${r.periodosPorAno} ${r.periodosPorAno === 1 ? "período" : "períodos"}`,
    );
  }
  if (r.antecedenciaMaximaMeses !== null) {
    t.push(`Pedido até ${r.antecedenciaMaximaMeses} meses antes`);
  }
  if (r.duracaoMinimaDias !== null || r.duracaoMaximaDias !== null) {
    t.push("Duração de cada período");
  }
  if (r.periodoMaiorDias !== null) {
    t.push(`Um período com ${r.periodoMaiorDias} dias ou mais`);
  }
  if (r.intervaloDias !== null) t.push(`Intervalo de ${r.intervaloDias} dias`);
  if (r.alemDoSaldo === "nao_aceitar") t.push("Não aceita além do saldo");
  if (r.inicioNaoAntesDeDescanso || r.inicioNaoNoFimDeSemana) {
    t.push("Dia do início");
  }
  if (r.voltaNaoNaSexta || r.voltaNaoNaVespera) t.push("Dia da volta");
  if (r.bloqueios.length > 0) t.push("Períodos bloqueados");
  if (r.foraAoMesmoTempo !== null) t.push("Fora ao mesmo tempo");
  if (t.length === 0)
    return { primeira: "Só os pisos da lei", segunda: null, mais: 0 };
  return {
    primeira: t[0]!,
    segunda: t[1] ?? null,
    mais: Math.max(0, t.length - 2),
  };
}
