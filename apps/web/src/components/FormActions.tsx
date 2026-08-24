/**
 * FormActions (UI-F03) — agrupamento responsivo das ações de um formulário.
 *
 * Apenas layout: alinha as ações (por padrão à direita em telas largas) e as
 * empilha em largura total no mobile. Reutiliza o `Button` existente — não cria
 * gramática visual nova. Sem sombra e sem gradiente.
 */
import type { ReactNode } from "react";
import "./FormActions.css";

export interface FormActionsProps {
  /** Ações (tipicamente `Button`s). */
  children: ReactNode;
  /** Alinhamento horizontal em telas largas. Padrão: `end`. */
  align?: "start" | "end";
}

export function FormActions({ children, align = "end" }: FormActionsProps) {
  return (
    <div className={`evolli-form-actions evolli-form-actions--${align}`}>
      {children}
    </div>
  );
}
