/**
 * T209 — Input e Select da camada `src/ui`. Controles NATIVOS (o `<select>`
 * nativo é o mais acessível no celular e com leitor de tela), com a aparência
 * dos tokens: altura de 44 px, borda fina, raio pequeno. O rótulo e as
 * mensagens continuam a cargo do `FormField` existente, que liga `id`,
 * `aria-describedby` e `aria-invalid`.
 *
 * T215 (2026-11-26) — telas novas escolhem com `ListaDeEscolha` (lista
 * própria, como a referência); este `Select` fica para as telas antigas até
 * serem revisitadas.
 */
import { forwardRef } from "react";
import type { InputHTMLAttributes, SelectHTMLAttributes } from "react";
import { cn } from "./cn";

const CONTROLE =
  "ev:min-h-[var(--touch-target)] ev:w-full ev:min-w-0 ev:rounded-[var(--radius-sm)] ev:border-[length:var(--borda-espessura)] ev:border-[var(--divisor-cor-forte)] ev:bg-[var(--surface-canvas)] ev:px-[var(--space-sm)] ev:font-[inherit] ev:text-[var(--color-ink)] ev:disabled:bg-[var(--surface-neutral)] ev:disabled:cursor-not-allowed ev:aria-invalid:border-[var(--status-danger-ink)]";

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      data-ui="input"
      className={cn(CONTROLE, className)}
      {...props}
    />
  );
});

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, ...props }, ref) {
  return (
    <select
      ref={ref}
      data-ui="select"
      className={cn(CONTROLE, "ev:cursor-pointer", className)}
      {...props}
    />
  );
});
