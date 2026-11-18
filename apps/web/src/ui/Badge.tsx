/**
 * T209 — Badge da camada `src/ui`: rótulo curto com os tokens semânticos de
 * estado. A cor nunca é o único sinal: o texto do badge diz o estado.
 */
import type { HTMLAttributes } from "react";
import { cn } from "./cn";

export type BadgeVariant =
  "neutral" | "info" | "success" | "warning" | "danger";

const VARIANTS: Readonly<Record<BadgeVariant, string>> = {
  neutral:
    "ev:bg-[var(--status-neutral-surface)] ev:text-[var(--status-neutral-ink)] ev:border-[var(--status-neutral-border)]",
  info: "ev:bg-[var(--status-info-surface)] ev:text-[var(--status-info-ink)] ev:border-[var(--status-info-border)]",
  success:
    "ev:bg-[var(--status-success-surface)] ev:text-[var(--status-success-ink)] ev:border-[var(--status-success-border)]",
  warning:
    "ev:bg-[var(--status-warning-surface)] ev:text-[var(--status-warning-ink)] ev:border-[var(--status-warning-border)]",
  danger:
    "ev:bg-[var(--status-danger-surface)] ev:text-[var(--status-danger-ink)] ev:border-[var(--status-danger-border)]",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  readonly variant?: BadgeVariant;
}

export function Badge({
  variant = "neutral",
  className,
  ...props
}: BadgeProps) {
  return (
    <span
      data-variant={variant}
      className={cn(
        "ev:inline-flex ev:items-center ev:rounded-[var(--radius-pill)] ev:border ev:px-2 ev:text-[length:var(--text-caption)] ev:font-semibold",
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}
