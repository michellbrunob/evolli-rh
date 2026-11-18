/**
 * T209 — primitivas de tabela da camada `src/ui`. A mesma semântica do
 * `DataTable` (região focável que rola por dentro, `<caption>` acessível,
 * `<th scope="col">`), mas componível: quem usa decide colunas, células e
 * linhas. Mantêm as classes `evolli-datatable*`, então o visual (e o padrão de
 * divisões aplicado por cada tela) continua o mesmo.
 *
 * Sem TanStack Table: a tabela de Colaboradores não ordena, não seleciona e
 * pagina no servidor — nada que uma biblioteca de tabela resolveria hoje.
 */
import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { cn } from "./cn";

export function TableContainer({
  label,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { readonly label: string }) {
  return (
    // Rolagem horizontal contida aqui e operável por teclado (WCAG 2.1.1).
    <div
      role="region"
      aria-label={label}
      tabIndex={0}
      className={cn("evolli-datatable", className)}
      {...props}
    />
  );
}

export function Table({
  className,
  ...props
}: HTMLAttributes<HTMLTableElement>) {
  return (
    <table className={cn("evolli-datatable__table", className)} {...props} />
  );
}

export function TableCaption({
  visible = true,
  className,
  ...props
}: HTMLAttributes<HTMLTableCaptionElement> & { readonly visible?: boolean }) {
  return (
    <caption
      className={cn(
        visible
          ? "evolli-datatable__caption"
          : "evolli-datatable__caption evolli-datatable__caption--sr",
        className,
      )}
      {...props}
    />
  );
}

export const TableHeader = (props: HTMLAttributes<HTMLTableSectionElement>) => (
  <thead {...props} />
);
export const TableBody = (props: HTMLAttributes<HTMLTableSectionElement>) => (
  <tbody {...props} />
);
export const TableRow = (props: HTMLAttributes<HTMLTableRowElement>) => (
  <tr {...props} />
);

export function TableHead({
  className,
  scope = "col",
  ...props
}: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope={scope}
      className={cn("evolli-datatable__th", className)}
      {...props}
    />
  );
}

export function TableCell({
  className,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("evolli-datatable__td", className)} {...props} />;
}
