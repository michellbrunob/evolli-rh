/**
 * T209 — Button e IconButton da camada `src/ui` (abordagem inspirada no
 * shadcn/ui, escritos aqui, com os tokens do Evolli). Alvo mínimo de 44 px;
 * foco visível pelo anel global (`:focus-visible` de `tokens.css`).
 *
 * `IconButton` exige `label`: botão só com ícone sem nome acessível não
 * compila. O ícone é sempre decorativo (`aria-hidden`).
 */
import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export type ButtonVariant = "primary" | "secondary" | "subtle" | "danger";

/** T215 — o comum aos botões; a altura vem de BASE (texto) ou do botão de ícone. */
const COMUM =
  "ev:inline-flex ev:items-center ev:justify-center ev:gap-2 ev:rounded-[var(--radius-botao)] ev:border ev:font-[inherit] ev:font-semibold ev:leading-none ev:whitespace-nowrap ev:cursor-pointer ev:disabled:cursor-not-allowed ev:disabled:opacity-50 ev:aria-disabled:cursor-not-allowed";
const BASE = `${COMUM} ev:min-h-[var(--altura-botao)]`;

const VARIANTS: Readonly<Record<ButtonVariant, string>> = {
  primary:
    "ev:border-transparent ev:bg-[var(--color-action)] ev:text-[var(--color-on-action)] ev:hover:bg-[var(--color-action-hover)]",
  secondary:
    "ev:border-[var(--hairline)] ev:bg-[var(--surface-canvas)] ev:text-[var(--color-ink)] ev:hover:bg-[var(--estado-hover-superficie)]",
  subtle:
    "ev:border-transparent ev:bg-transparent ev:text-[var(--color-action)] ev:hover:bg-[var(--estado-hover-superficie)]",
  danger:
    "ev:border-[var(--status-danger-border)] ev:bg-[var(--status-danger-surface)] ev:text-[var(--status-danger-ink)]",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { variant = "secondary", className, type = "button", ...props },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        data-variant={variant}
        className={cn(BASE, "ev:px-4", VARIANTS[variant], className)}
        {...props}
      />
    );
  },
);

export interface IconButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "aria-label"
> {
  /** Nome acessível obrigatório (o ícone sozinho não diz nada). */
  readonly label: string;
  readonly icon: ReactNode;
  readonly variant?: ButtonVariant;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    {
      label,
      icon,
      variant = "secondary",
      className,
      type = "button",
      children,
      ...props
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        aria-label={label}
        data-variant={variant}
        className={cn(
          COMUM,
          "ev:min-w-[var(--botao-icone)] ev:min-h-[var(--botao-icone)] ev:px-2",
          VARIANTS[variant],
          className,
        )}
        {...props}
      >
        <span aria-hidden="true" className="ev:inline-flex">
          {icon}
        </span>
        {children}
      </button>
    );
  },
);
