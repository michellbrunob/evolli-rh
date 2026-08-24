/**
 * Button (UI-F02) — botão de ação reutilizável.
 *
 * Três gramáticas de ação, todas com a mesma cor de ação única (#0066cc via
 * token) e forma pill: `primary` (preenchida), `secondary` (contorno) e
 * `subtle` (discreta, sem contorno). Alvo de toque mínimo de 44px, foco visível
 * herdado de `:focus-visible` (tokens.css) e sem sombra. Encaminha todos os
 * atributos nativos de `<button>` (onClick, disabled, aria-*, type…).
 */
import type { ButtonHTMLAttributes } from "react";
import "./Button.css";

export type ButtonVariant = "primary" | "secondary" | "subtle";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Gramática visual da ação. Padrão: `primary`. */
  variant?: ButtonVariant;
}

export function Button({
  variant = "primary",
  type,
  className,
  children,
  ...rest
}: ButtonProps) {
  const classes = ["evolli-button", `evolli-button--${variant}`, className]
    .filter(Boolean)
    .join(" ");

  return (
    // `type` explícito evita o padrão "submit" acidental fora de formulários.
    <button type={type ?? "button"} className={classes} {...rest}>
      {children}
    </button>
  );
}
