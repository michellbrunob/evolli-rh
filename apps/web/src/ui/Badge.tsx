/**
 * T209 — Badge da camada `src/ui`: rótulo curto de estado. A cor nunca é o
 * único sinal: o texto do badge diz o estado. T216: o mesmo visual do
 * `StatusBadge` (pílula suave com ponto), pelas classes do componente.
 */
import type { HTMLAttributes } from "react";
import {
  PontoDoStatus,
  classesDoStatus,
  type StatusVariant,
} from "../components/StatusBadge";
import { cn } from "./cn";

export type BadgeVariant = StatusVariant;

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  readonly variant?: BadgeVariant;
}

export function Badge({
  variant = "neutral",
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      data-variant={variant}
      className={cn(classesDoStatus(variant), className)}
      {...props}
    >
      <PontoDoStatus />
      <span className="evolli-badge__label">{children}</span>
    </span>
  );
}
