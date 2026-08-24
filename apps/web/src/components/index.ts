/**
 * Biblioteca mínima de componentes de apresentação (UI-F02).
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
