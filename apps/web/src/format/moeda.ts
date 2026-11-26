/**
 * T215 — dinheiro: centavos inteiros → `R$ 1.234,56` (sem depender da
 * localidade do navegador). Negativo leva o sinal antes do símbolo.
 */
export function formatarCentavos(centavos: number): string {
  const negativo = centavos < 0;
  const abs = Math.abs(Math.round(centavos));
  const inteiros = String(Math.floor(abs / 100)).replace(
    /\B(?=(\d{3})+(?!\d))/g,
    ".",
  );
  const resto = String(abs % 100).padStart(2, "0");
  return `${negativo ? "− " : ""}R$ ${inteiros},${resto}`;
}

/** Reais (número) → `1.234,56`, para campos de valor. */
export function formatarReaisDoCampo(reais: number | null | undefined): string {
  if (reais === null || reais === undefined || !Number.isFinite(reais))
    return "";
  const c = Math.round(reais * 100);
  return formatarCentavos(c).replace("R$ ", "");
}

/** Texto do campo (`1.234,5` ou `1234.50`) → reais; vazio ou inválido = `null`. */
export function lerReais(texto: string): number | null {
  const limpo = texto.trim().replace(/^R\$\s*/, "");
  if (limpo === "") return null;
  const normal = limpo.includes(",")
    ? limpo.replace(/\./g, "").replace(",", ".")
    : limpo;
  if (!/^\d+(\.\d{1,2})?$/.test(normal)) return null;
  return Number(normal);
}

/** Percentual com até 2 casas, vírgula decimal: `20`, `12,5`. */
export function formatarPercentual(valor: number): string {
  const r = Math.round(valor * 100) / 100;
  return String(r).replace(".", ",");
}
