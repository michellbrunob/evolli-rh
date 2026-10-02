/**
 * Formatação de dia — função pura, sem rede e sem dependência de cliente.
 *
 * Mora num módulo PRÓPRIO, e não dentro de `api/colaboradoresClient.ts`, por um
 * motivo concreto: as telas mockam os clientes de API inteiros com
 * `vi.mock("../../api/...")`. Um formatador exportado de lá viraria `undefined`
 * dentro do teste e a célula renderizaria vazio — o teste passaria a medir o
 * mock, não a tela.
 */

/**
 * Exibe um dia que o servidor devolve como datetime ISO.
 *
 * `dataAdmissao`, `dataDesligamento` e `vigenciaInicio` são colunas `@db.Date`,
 * mas o Prisma as entrega como `Date`, então chegam ao navegador na forma
 * `"2026-01-05T00:00:00.000Z"`. Os 10 primeiros caracteres JÁ são a data UTC
 * gravada: cortar não recalcula fuso nem desloca o dia, ao contrário de
 * `new Date(iso).toLocaleDateString()`, que subtrairia um dia a oeste de
 * Greenwich.
 *
 * Existe em um só lugar porque Colaboradores, Dados contratuais e Histórico
 * funcional exibem a MESMA data. Enquanto apenas Dados contratuais
 * normalizava, a mesma admissão aparecia como `2026-01-05` numa tela e como
 * `2026-01-05T00:00:00.000Z` nas outras duas.
 */
export function formatarDia(iso: string | null | undefined): string {
  return iso ? iso.slice(0, 10) : "—";
}
