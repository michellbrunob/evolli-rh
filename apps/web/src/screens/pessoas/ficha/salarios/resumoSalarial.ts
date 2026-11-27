import type { AlteracaoSalarialApi } from "../../../../api/salariosClient";
import { formatarMesAbreviado } from "../../../../format/data";

/**
 * T215 — as contas da aba Salários da ficha. As alterações chegam da mais
 * nova para a mais antiga, como a API devolve (a primeira é a atual; numa
 * admissão futura, ainda não vigente). Percentuais em centavos inteiros.
 */

function partes(dia: string): [number, number, number] {
  return dia.slice(0, 10).split("-").map(Number) as [number, number, number];
}

/** O dia civil seguinte: "2025-12-31" → "2026-01-01". */
export function diaSeguinte(dia: string): string {
  const [a, m, d] = partes(dia);
  return new Date(Date.UTC(a, m - 1, d + 1)).toISOString().slice(0, 10);
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

/**
 * "Menos de 1 mês", "7 meses", "1 ano e 2 meses". `ultimoDia` é o último dia
 * DO período (a véspera do seguinte, ou hoje no vigente): conta inteiro, e a
 * conta vai até o dia seguinte — 01/03 a 31/12 são 10 meses.
 */
export function duracaoDoPeriodo(inicio: string, ultimoDia: string): string {
  const total = mesesEntre(inicio, diaSeguinte(ultimoDia));
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

/** "2045.00" → 204500n: centavos inteiros, sem conta em ponto flutuante. */
function centavos(valor: string): bigint {
  const [inteiro = "0", fracao = ""] = valor.trim().split(".");
  return BigInt(inteiro) * 100n + BigInt((fracao + "00").slice(0, 2));
}

/** `num / den` arredondado meio para cima, longe do zero (den > 0). */
function dividirArredondando(num: bigint, den: bigint): bigint {
  const negativo = num < 0n;
  const abs = negativo ? -num : num;
  const q = (2n * abs + den) / (2n * den);
  return negativo ? -q : q;
}

/**
 * Variação de `novo` sobre `antigo`, em DÉCIMOS de ponto percentual (23 é
 * 2,3%), em centavos inteiros e meio para cima: 2.000 → 2.045 é 2,25%, que
 * vira 23. `antigo` maior que zero (a API garante).
 */
export function variacaoEmDecimos(novo: string, antigo: string): number {
  const a = centavos(antigo);
  return Number(dividirArredondando((centavos(novo) - a) * 1000n, a));
}

/** "+2,3%", "-5,0%"; o que arredonda a zero é "0,0%", sem sinal. */
export function formatarPercentual(decimos: number): string {
  if (decimos === 0) return "0,0%";
  const abs = Math.abs(decimos);
  return `${decimos < 0 ? "-" : "+"}${Math.floor(abs / 10)},${abs % 10}%`;
}

/**
 * Percentual de cada alteração sobre a anterior, em décimos de ponto (a mais
 * antiga: `null`).
 */
export function percentualSobreAnterior(
  alteracoes: readonly AlteracaoSalarialApi[],
): Map<string, number | null> {
  const resultado = new Map<string, number | null>();
  alteracoes.forEach((a, i) => {
    const anterior = alteracoes[i + 1];
    resultado.set(
      a.id,
      anterior
        ? variacaoEmDecimos(a.salarioBruto, anterior.salarioBruto)
        : null,
    );
  });
  return resultado;
}

/**
 * Os REAJUSTES: só as alterações em que o salário sobe. Redução e troca só
 * de cargo (mesmo salário) são alteração, não reajuste.
 */
export function idsDeReajuste(
  alteracoes: readonly AlteracaoSalarialApi[],
): Set<string> {
  const ids = new Set<string>();
  alteracoes.forEach((a, i) => {
    const anterior = alteracoes[i + 1];
    if (
      anterior &&
      centavos(a.salarioBruto) > centavos(anterior.salarioBruto)
    ) {
      ids.add(a.id);
    }
  });
  return ids;
}

export interface ResumoSalarial {
  /** Alterações em que o salário subiu. */
  reajustes: number;
  /**
   * Do primeiro registro ao mais novo, em décimos de ponto (pode ser
   * negativo); com um registro só, `null`.
   */
  aumentoAcumulado: number | null;
  /** Média dos percentuais dos reajustes, em décimos; sem reajuste, `null`. */
  mediaPorReajuste: number | null;
  /**
   * Desde o início do período atual, contando hoje; sem salário ou antes da
   * admissão, `null`.
   */
  mesesNoSalarioAtual: number | null;
}

/** Precisão da média antes de arredondar a décimos. */
const ESCALA_DA_MEDIA = 1_000_000n;

export function resumoSalarial(
  alteracoes: readonly AlteracaoSalarialApi[],
  hoje: string,
): ResumoSalarial {
  const atual = alteracoes[0];
  const primeiro = alteracoes[alteracoes.length - 1];
  if (!atual || !primeiro) {
    return {
      reajustes: 0,
      aumentoAcumulado: null,
      mediaPorReajuste: null,
      mesesNoSalarioAtual: null,
    };
  }
  // Média dos reajustes com folga de precisão (milionésimos de décimo),
  // arredondada a décimos no fim, meio para cima.
  let soma = 0n;
  let reajustes = 0;
  alteracoes.forEach((a, i) => {
    const anterior = alteracoes[i + 1];
    if (!anterior) return;
    const de = centavos(anterior.salarioBruto);
    const para = centavos(a.salarioBruto);
    if (para <= de) return;
    reajustes += 1;
    soma += dividirArredondando((para - de) * 1000n * ESCALA_DA_MEDIA, de);
  });
  return {
    reajustes,
    aumentoAcumulado:
      alteracoes.length === 1
        ? null
        : variacaoEmDecimos(atual.salarioBruto, primeiro.salarioBruto),
    mediaPorReajuste:
      reajustes === 0
        ? null
        : Number(
            dividirArredondando(soma, BigInt(reajustes) * ESCALA_DA_MEDIA),
          ),
    mesesNoSalarioAtual:
      atual.vigenciaInicio > hoje
        ? null
        : mesesEntre(atual.vigenciaInicio, diaSeguinte(hoje)),
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
