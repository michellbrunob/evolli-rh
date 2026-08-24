/**
 * StatusBadge (UI-F02) — indicador de estado acessível.
 *
 * Variante neutra + variantes semânticas (sucesso, atenção, erro, informação).
 * A cor NUNCA é o único sinal: cada estado combina (a) um rótulo textual
 * visível, (b) um glifo de forma distinta (decorativo, `aria-hidden`) e (c) a
 * cor. Assim o estado permanece legível sob daltonismo ou monocromia. Sem
 * sombra e sem gradiente.
 */
import type { ReactNode } from "react";
import "./StatusBadge.css";

export type StatusVariant =
  "neutral" | "success" | "warning" | "danger" | "info";

/** Glifo de forma distinta por estado (reforço não-cromático). */
const GLYPH: Record<StatusVariant, string> = {
  neutral: "•",
  success: "✓",
  warning: "!",
  danger: "×",
  info: "i",
};

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
      <span className="evolli-badge__glyph" aria-hidden="true">
        {GLYPH[variant]}
      </span>
      <span className="evolli-badge__label">{children}</span>
    </span>
  );
}
