/**
 * T209 — salário líquido estimado da etapa 2 do Novo colaborador
 * ("Calculado a partir do bruto"). Só para a tela: o servidor guarda o
 * bruto, os dependentes e a pensão; o líquido não é gravado.
 *
 * Regra (tabelas de 2026):
 * - INSS progressivo, com teto;
 * - pensão alimentícia = percentual × (bruto − INSS);
 * - base do IRRF = bruto − INSS − pensão − dependentes × dedução;
 * - IRRF pela tabela mensal, menos o redutor de 2026 (zera até R$ 5.000,00 de
 *   bruto e reduz até R$ 7.350,00);
 * - líquido = bruto − INSS − IRRF − pensão.
 * Cada etapa é arredondada ao centavo.
 */

/** Faixas do INSS 2026: até o limite, a alíquota. */
const FAIXAS_INSS: readonly (readonly [number, number])[] = [
  [1621.0, 0.075],
  [2902.84, 0.09],
  [4354.27, 0.12],
  [8475.55, 0.14],
];

/** Tabela mensal do IRRF: até o limite, alíquota e parcela a deduzir. */
const FAIXAS_IRRF: readonly (readonly [number, number, number])[] = [
  [2428.8, 0, 0],
  [2826.65, 0.075, 182.16],
  [3751.05, 0.15, 394.16],
  [4664.68, 0.225, 675.49],
  [Infinity, 0.275, 908.73],
];

const DEDUCAO_POR_DEPENDENTE = 189.59;
const REDUTOR_ISENTO_ATE = 5000;
const REDUTOR_ATE = 7350;

function centavos(valor: number): number {
  // Estabiliza o ponto flutuante (46,605 não pode virar 46,604999…).
  return Math.round(Number(valor.toFixed(6)) * 100) / 100;
}

/** INSS do mês, progressivo, com teto. */
export function inssMensal(bruto: number): number {
  let inss = 0;
  let anterior = 0;
  for (const [limite, aliquota] of FAIXAS_INSS) {
    if (bruto <= anterior) break;
    inss += (Math.min(bruto, limite) - anterior) * aliquota;
    anterior = limite;
  }
  return centavos(inss);
}

function irrfMensal(base: number, bruto: number): number {
  if (base <= 0) return 0;
  const [, aliquota, deducao] = FAIXAS_IRRF.find(([limite]) => base <= limite)!;
  const imposto = centavos(base * aliquota - deducao);
  if (imposto <= 0) return 0;
  if (bruto <= REDUTOR_ISENTO_ATE) return 0;
  if (bruto <= REDUTOR_ATE) {
    const redutor = centavos(978.62 - 0.133145 * bruto);
    return Math.max(0, centavos(imposto - redutor));
  }
  return imposto;
}

/** Líquido estimado, ou `null` sem bruto. */
export function calcularSalarioLiquido(entrada: {
  readonly bruto: number;
  readonly dependentes: number;
  readonly pensaoPercentual: number;
}): number | null {
  const { bruto } = entrada;
  if (!(bruto > 0)) return null;
  const inss = inssMensal(bruto);
  const pensao = centavos(
    (Math.max(0, entrada.pensaoPercentual) / 100) * (bruto - inss),
  );
  const base =
    bruto -
    inss -
    pensao -
    Math.max(0, entrada.dependentes) * DEDUCAO_POR_DEPENDENTE;
  const irrf = irrfMensal(centavos(base), bruto);
  return centavos(bruto - inss - irrf - pensao);
}

/** "5.000,00" → 5000; vazio ou inválido → `null`. */
export function lerValorEmReais(texto: string): number | null {
  const limpo = texto.trim().replace(/\./g, "").replace(",", ".");
  if (limpo === "" || !/^\d+(\.\d{1,2})?$/.test(limpo)) return null;
  return Number(limpo);
}

/** 5000 → "5.000,00" (sem depender da localidade do navegador). */
export function formatarReais(valor: number): string {
  const [inteiros, centavos] = Math.abs(valor).toFixed(2).split(".");
  const comMilhar = inteiros!.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${valor < 0 ? "-" : ""}${comMilhar},${centavos}`;
}
