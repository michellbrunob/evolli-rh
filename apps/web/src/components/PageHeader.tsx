/**
 * PageHeader (UI-F02) — cabeçalho reutilizável de página/seção.
 *
 * Título obrigatório, descrição opcional e área de ações opcional (à direita em
 * telas largas, empilhada no mobile). Permite escolher o nível do título
 * (h1–h3) para manter a hierarquia de cabeçalhos correta em cada contexto.
 *
 * Deliberadamente um `<div>` (não `<header>`): como este bloco pode ser
 * colocado em qualquer contexto (inclusive dentro de `<main>`), evitar o
 * landmark `banner` garante um único banner por página — a barra superior do
 * shell. A semântica vem do próprio elemento de título (h1–h3).
 */
import type { ReactNode } from "react";
import "./PageHeader.css";

export interface PageHeaderProps {
  /** Título visível do cabeçalho. */
  title: string;
  /** Texto de apoio opcional abaixo do título. */
  description?: string;
  /** Conteúdo de ações (ex.: botões). Renderizado apenas se presente. */
  actions?: ReactNode;
  /** Nível do título para preservar a hierarquia de cabeçalhos. Padrão: 2. */
  headingLevel?: 1 | 2 | 3;
  /** `id` do título — útil para `aria-labelledby` de uma região. */
  titleId?: string;
}

export function PageHeader({
  title,
  description,
  actions,
  headingLevel = 2,
  titleId,
}: PageHeaderProps) {
  const Heading = `h${headingLevel}` as "h1" | "h2" | "h3";

  return (
    <div className="evolli-page-header">
      <div className="evolli-page-header__text">
        <Heading id={titleId} className="evolli-page-header__title">
          {title}
        </Heading>
        {description ? (
          <p className="evolli-page-header__description">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="evolli-page-header__actions">{actions}</div>
      ) : null}
    </div>
  );
}
