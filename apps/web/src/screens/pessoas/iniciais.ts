/**
 * As iniciais do nome (primeira e última palavra), para o avatar sem foto.
 * Só letras contam; vazio quando não há nenhuma.
 */
export function iniciaisDe(nome: string): string {
  const partes = nome
    .split(/\s+/)
    .map((p) => p.replace(/[^\p{L}]/gu, ""))
    .filter((p) => p.length > 0);
  if (partes.length === 0) return "";
  const primeira = partes[0]!.charAt(0);
  const ultima = partes.length > 1 ? partes[partes.length - 1]!.charAt(0) : "";
  return `${primeira}${ultima}`.toLocaleUpperCase("pt-BR");
}
