/**
 * Biblioteca mínima de componentes de apresentação (UI-F02 + UI-F03).
 *
 * Componentes reutilizáveis, tipados e acessíveis, sem dado de domínio, sem
 * ligação com API e sem regra de negócio — a base sobre a qual as futuras
 * telas administrativas serão construídas.
 */
export { Button } from "./Button";
export type { ButtonProps, ButtonVariant } from "./Button";

export { PageHeader } from "./PageHeader";
export type { PageHeaderProps } from "./PageHeader";

export { Surface } from "./Surface";
export type { SurfaceProps, SurfacePadding } from "./Surface";

export { EmptyState } from "./EmptyState";
export type { EmptyStateProps } from "./EmptyState";

export { StatusBadge } from "./StatusBadge";
export type { StatusBadgeProps, StatusVariant } from "./StatusBadge";

export { DataTable } from "./DataTable";
export type { DataTableProps, DataTableColumn } from "./DataTable";

export { FormField } from "./FormField";
export type { FormFieldProps, FormFieldControl } from "./FormField";

export { FormActions } from "./FormActions";
export type { FormActionsProps } from "./FormActions";
