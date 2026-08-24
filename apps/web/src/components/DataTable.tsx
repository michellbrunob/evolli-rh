/**
 * DataTable (UI-F03) — tabela de apresentação genérica e tipada.
 *
 * Colunas e linhas vêm por props. Renderiza uma `<table>` semântica com
 * `<caption>` acessível, cabeçalhos `<th scope="col">` e estado vazio explícito.
 * O contêiner rola horizontalmente por conta própria em telas estreitas (sem
 * gerar rolagem horizontal da página) e é focável por teclado para permitir
 * essa rolagem.
 *
 * Esta fase é PURAMENTE visual: sem ordenação, filtro, paginação, seleção,
 * exportação ou navegação funcional.
 */
import type { ReactNode } from "react";
import "./DataTable.css";

export interface DataTableColumn<T> {
  /** Chave estável da coluna (usada como React key). */
  key: string;
  /** Conteúdo do cabeçalho da coluna. */
  header: ReactNode;
  /** Projeta a célula a partir da linha. */
  cell: (row: T) => ReactNode;
  /** Alinhamento do conteúdo (use `end` para números). Padrão: `start`. */
  align?: "start" | "end";
}

export interface DataTableProps<T> {
  /** Legenda acessível da tabela (obrigatória). */
  caption: string;
  /** Se a legenda é exibida visualmente. Quando `false`, fica só para leitores
   * de tela. Padrão: `true`. */
  captionVisible?: boolean;
  /** Definição das colunas. */
  columns: ReadonlyArray<DataTableColumn<T>>;
  /** Linhas a exibir. */
  rows: ReadonlyArray<T>;
  /** Deriva uma chave estável para cada linha. */
  rowKey: (row: T, index: number) => string;
  /** Mensagem exibida quando não há linhas. */
  emptyMessage?: string;
}

function cellClass(align: "start" | "end" | undefined, base: string): string {
  return align === "end" ? `${base} evolli-datatable__cell--end` : base;
}

export function DataTable<T>({
  caption,
  captionVisible = true,
  columns,
  rows,
  rowKey,
  emptyMessage = "Nenhum item para exibir.",
}: DataTableProps<T>) {
  const captionClass = captionVisible
    ? "evolli-datatable__caption"
    : "evolli-datatable__caption evolli-datatable__caption--sr";

  return (
    // Região focável: a rolagem horizontal fica CONTIDA aqui e é operável por
    // teclado (WCAG 2.1.1). O rótulo repete a legenda para leitores de tela.
    <div
      className="evolli-datatable"
      role="region"
      aria-label={caption}
      tabIndex={0}
    >
      <table className="evolli-datatable__table">
        <caption className={captionClass}>{caption}</caption>
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={cellClass(col.align, "evolli-datatable__th")}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="evolli-datatable__empty" colSpan={columns.length}>
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr key={rowKey(row, index)}>
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cellClass(col.align, "evolli-datatable__td")}
                  >
                    {col.cell(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
