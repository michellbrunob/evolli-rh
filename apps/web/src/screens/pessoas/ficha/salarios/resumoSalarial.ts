import type { AlteracaoSalarialApi } from "../../../../api/salariosClient";
import { formatarMesAbreviado } from "../../../../format/data";

/**
 * T215 — as contas da aba Salários da ficha. As alterações chegam da mais
 * nova para a mais antiga (a primeira é a vigente), como a API devolve.
 */

function partes(dia: string): [number, number, number] {
  return dia.slice(0, 10).split("-").map(Number) as [number, number, number];
}

/** Meses completos entre dois dias civis (nunca negativo). */
export function mesesEntre(de: string, ate: string): number {
  const [a1, m1, d1] = partes(de);
  const [a2, m2, d2] = partes(ate);
  let total = (a2 - a1) * 12 + (m2 - m1);
  if (d2 < d1) total -= 1;
  return Math.max(0, total);
}

/** "nov/26". */
export const mesCurto = formatarMesAbreviado;

/** "Menos de 1 mês", "7 meses", "1 ano e 2 meses". */
export function duracaoDoPeriodo(inicio: string, fim: string): string {
  const total = mesesEntre(inicio, fim);
  const anos = Math.floor(total / 12);
  const meses = total % 12;
  if (total === 0) return "Menos de 1 mês";
  const a = anos === 1 ? "1 ano" : `${anos} anos`;
  const m = meses === 1 ? "1 mês" : `${meses} meses`;
  if (anos === 0) return m;
  if (meses === 0) return a;
  return `${a} e ${m}`;
}

/** "0m", "5m", "1a", "1a 2m"; sem valor, "—". */
export function tempoCurto(meses: number | null): string {
  if (meses === null) return "—";
  const anos = Math.floor(meses / 12);
  const resto = meses % 12;
  if (anos === 0) return `${resto}m`;
  return resto === 0 ? `${anos}a` : `${anos}a ${resto}m`;
}

/** Percentual de cada alteração sobre a anterior (a mais antiga: `null`). */
export function percentualSobreAnterior(
  alteracoes: readonly AlteracaoSalarialApi[],
): Map<string, number | null> {
  const resultado = new Map<string, number | null>();
  alteracoes.forEach((a, i) => {
    const anterior = alteracoes[i + 1];
    resultado.set(
      a.id,
      anterior
        ? (Number(a.salarioBruto) / Number(anterior.salarioBruto) - 1) * 100
        : null,
    );
  });
  return resultado;
}

export interface ResumoSalarial {
  /** Alterações depois da primeira. */
  reajustes: number;
  /** Do primeiro registro ao vigente, em %; sem reajuste, `null`. */
  aumentoAcumulado: number | null;
  /** Média dos percentuais de cada reajuste; sem reajuste, `null`. */
  mediaPorReajuste: number | null;
  /** Desde o início do período vigente; sem salário, `null`. */
  mesesNoSalarioAtual: number | null;
}

export function resumoSalarial(
  alteracoes: readonly AlteracaoSalarialApi[],
  hoje: string,
): ResumoSalarial {
  const vigente = alteracoes[0];
  const primeiro = alteracoes[alteracoes.length - 1];
  if (!vigente || !primeiro) {
    return {
      reajustes: 0,
      aumentoAcumulado: null,
      mediaPorReajuste: null,
      mesesNoSalarioAtual: null,
    };
  }
  const reajustes = alteracoes.length - 1;
  const percentuais = [...percentualSobreAnterior(alteracoes).values()].filter(
    (p): p is number => p !== null,
  );
  return {
    reajustes,
    aumentoAcumulado:
      reajustes === 0
        ? null
        : (Number(vigente.salarioBruto) / Number(primeiro.salarioBruto) - 1) *
          100,
    mediaPorReajuste:
      reajustes === 0
        ? null
        : percentuais.reduce((s, p) => s + p, 0) / percentuais.length,
    mesesNoSalarioAtual: mesesEntre(vigente.vigenciaInicio, hoje),
  };
}

export interface PontoDoGrafico {
  dia: string;
  valor: number;
}

/**
 * Degraus do salário: cada período vai do seu início ao início do seguinte
 * (ou hoje, no vigente).
 */
export function pontosDoGrafico(
  alteracoes: readonly AlteracaoSalarialApi[],
  hoje: string,
): PontoDoGrafico[] {
  const antigas = [...alteracoes].reverse();
  const pontos: PontoDoGrafico[] = [];
  antigas.forEach((a, i) => {
    const valor = Number(a.salarioBruto);
    const seguinte = antigas[i + 1];
    pontos.push({ dia: a.vigenciaInicio, valor });
    const fim = seguinte ? seguinte.vigenciaInicio : hoje;
    pontos.push({
      dia: fim < a.vigenciaInicio ? a.vigenciaInicio : fim,
      valor,
    });
  });
  return pontos;
}
