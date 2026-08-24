/**
 * EmptyState (UI-F02) — estado vazio claro e reutilizável.
 *
 * Título obrigatório, descrição opcional e ação opcional. Ícone puramente
 * decorativo (marcado `aria-hidden`). Sem sombra e sem gradiente. O nível do
 * título é configurável para manter a hierarquia de cabeçalhos do contexto.
 */
import type { ReactNode } from "react";
import "./EmptyState.css";

export interface EmptyStateProps {
  /** Título do estado vazio. */
  title: string;
  /** Texto explicativo opcional. */
  description?: string;
  /** Ação opcional (ex.: um botão). */
  action?: ReactNode;
  /** Símbolo/ícone decorativo opcional (não anunciado por leitores de tela). */
  icon?: ReactNode;
  /** Nível do título para preservar a hierarquia de cabeçalhos. Padrão: 2. */
  headingLevel?: 2 | 3;
  /** `id` do título, quando for necessário referenciá-lo. */
  titleId?: string;
}

export function EmptyState({
  title,
  description,
  action,
  icon,
  headingLevel = 2,
  titleId,
}: EmptyStateProps) {
  const Heading = `h${headingLevel}` as "h2" | "h3";

  return (
    <div className="evolli-empty-state">
      {icon ? (
        <span className="evolli-empty-state__icon" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <Heading id={titleId} className="evolli-empty-state__title">
        {title}
      </Heading>
      {description ? (
        <p className="evolli-empty-state__text">{description}</p>
      ) : null}
      {action ? (
        <div className="evolli-empty-state__action">{action}</div>
      ) : null}
    </div>
  );
}
