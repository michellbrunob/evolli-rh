/**
 * T216 — data DIGITADA pela pessoa (`dd/mm/aaaa`), num campo de texto com
 * máscara: a forma que a tela mostra enquanto se digita e a conversão para o
 * dia civil ISO (`AAAA-MM-DD`) que trafega no contrato.
 *
 * Mora em `format/` porque é formatação de data (T154): nenhuma tela monta
 * `dd/mm/aaaa` no próprio corpo. Sem `Date` no caminho — aritmética civil
 * pura, como em `format/data.ts`.
 */

/** `dd/mm/aaaa`, conforme a pessoa digita (só os dígitos contam; até 8). */
export function mascararDataDigitada(valor: string): string {
  const d = valor.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

function bissexto(ano: number): boolean {
  return (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0;
}

const DIAS_POR_MES = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

/**
 * `dd/mm/aaaa` de um dia que existe (a partir de 1900) → `AAAA-MM-DD`;
 * incompleto, fora do formato ou dia inexistente → `null`.
 */
export function dataDigitadaParaIso(valor: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(valor);
  if (!m) return null;
  const dia = Number(m[1]);
  const mes = Number(m[2]);
  const ano = Number(m[3]);
  if (ano < 1900 || mes < 1 || mes > 12 || dia < 1) return null;
  const limite = mes === 2 && bissexto(ano) ? 29 : DIAS_POR_MES[mes - 1]!;
  if (dia > limite) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}
