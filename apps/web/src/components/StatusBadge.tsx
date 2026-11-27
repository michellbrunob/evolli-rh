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
  /**
   * Classe extra só de posição (margem, alinhamento na grade). O visual —
   * fundo, cor, ponto, peso e altura — é sempre o do componente.
   */
  className?: string;
}

/**
 * As classes do visual de status, para quando o elemento precisa ser outro
 * (por exemplo o gatilho de um menu de status): o mesmo desenho do
 * `StatusBadge`, sem CSS próprio na tela.
 */
export function classesDoStatus(variant: StatusVariant = "neutral"): string {
  return `evolli-badge evolli-badge--${variant}`;
}

/** O ponto decorativo do status, para uso junto de `classesDoStatus`. */
export function PontoDoStatus() {
  return <span className="evolli-badge__ponto" aria-hidden="true" />;
}

export function StatusBadge({
  variant = "neutral",
  children,
  className,
}: StatusBadgeProps) {
  return (
    <span
      className={
        className
          ? `${classesDoStatus(variant)} ${className}`
          : classesDoStatus(variant)
      }
    >
      <PontoDoStatus />
      <span className="evolli-badge__label">{children}</span>
    </span>
  );
}
