/**
 * StatusBadge (UI-F02) — indicador de estado acessível.
 *
 * Variante neutra + variantes semânticas (sucesso, atenção, erro, informação).
 * Padrão do sistema (decisão de 2026-11-27): pílula de fundo suave, sem borda,
 * com um PONTO colorido antes do rótulo ("● Ativa"). A cor não é o único
 * sinal: o rótulo textual visível diz o estado; o ponto é decorativo
 * (`aria-hidden`). Sem sombra e sem gradiente.
 */
import type { ReactNode } from "react";
import "./StatusBadge.css";

export type StatusVariant =
  "neutral" | "success" | "warning" | "danger" | "info";

export interface StatusBadgeProps {
  /** Estado representado. Padrão: `neutral`. */
  variant?: StatusVariant;
  /** Rótulo textual visível do estado (obrigatório — parte do sinal). */
  children: ReactNode;
}

export function StatusBadge({
  variant = "neutral",
  children,
}: StatusBadgeProps) {
  return (
    <span className={`evolli-badge evolli-badge--${variant}`}>
      <span className="evolli-badge__ponto" aria-hidden="true" />
      <span className="evolli-badge__label">{children}</span>
    </span>
  );
}
