/**
 * T215 — quantidade com a palavra concordando, pela norma do português
 * brasileiro: singular só para 1 ("1 feriado"), plural para 0 e a partir
 * de 2 ("0 feriados", "3 feriados"). O plural vem por extenso, porque há
 * irregulares ("mês"/"meses", "pendência"/"pendências").
 */
export function plural(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}
