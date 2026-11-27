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

/**
 * Campo de valor enquanto se digita: o que se digita é reais (como nos
 * benefícios). Separa o milhar; a vírgula abre até 2 casas de centavos;
 * pontos digitados são ignorados (o ponto é só o separador de milhar).
 * "3520" → "3.520"; "3520,5" → "3.520,5".
 */
export function mascararReais(texto: string): string {
  const limpo = texto.replace(/[^\d,]/g, "");
  if (limpo === "") return "";
  const virgula = limpo.indexOf(",");
  const inteiro = (virgula === -1 ? limpo : limpo.slice(0, virgula))
    .replace(/^0+(?=\d)/, "")
    .slice(0, 10);
  const milhar = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  if (virgula === -1) return milhar;
  const centavos = limpo
    .slice(virgula + 1)
    .replace(/,/g, "")
    .slice(0, 2);
  return `${milhar || "0"},${centavos}`;
}

/** Ao sair do campo: completa os centavos ("3.520" → "3.520,00"). */
export function completarReais(texto: string): string {
  const mascarado = mascararReais(texto);
  if (mascarado === "") return "";
  const [inteiro, centavos = ""] = mascarado.split(",");
  return `${inteiro || "0"},${centavos.padEnd(2, "0")}`;
}
