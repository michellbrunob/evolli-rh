/**
 * Surface / Card (UI-F02) — superfície neutra reutilizável.
 *
 * Fundo claro, borda sutil (hairline), cantos arredondados e SEM sombra. O
 * elemento é configurável (`div`/`section`/`article`) para preservar a
 * semântica do contexto, e o espaçamento interno é escolhido por token.
 */
import type { HTMLAttributes, ElementType } from "react";
import "./Surface.css";

export type SurfacePadding = "none" | "sm" | "md" | "lg";

export interface SurfaceProps extends HTMLAttributes<HTMLElement> {
  /** Elemento renderizado. Padrão: `div`. */
  as?: "div" | "section" | "article";
  /** Espaçamento interno por token. Padrão: `md`. */
  padding?: SurfacePadding;
}

export function Surface({
  as = "div",
  padding = "md",
  className,
  children,
  ...rest
}: SurfaceProps) {
  const Tag: ElementType = as;
  const classes = [
    "evolli-surface",
    `evolli-surface--pad-${padding}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Tag className={classes} {...rest}>
      {children}
    </Tag>
  );
}
