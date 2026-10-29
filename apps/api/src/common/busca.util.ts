/**
 * Busca por texto nas listagens (T178, T182 e T196).
 *
 * O `contains` do Prisma vira `LIKE '%termo%'` sem escapar os curingas: uma
 * busca por "%" ou "_" casaria com todo mundo. Escapados, valem literalmente.
 */
export function escaparCuringas(termo: string): string {
  return termo.replace(/[\\%_]/g, (c) => `\\${c}`);
}
