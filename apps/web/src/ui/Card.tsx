/**
 * T209 — Card da camada `src/ui`: superfície com a borda de card do padrão
 * de divisões (`--borda-card`), raio e respiro dos tokens. `CardSection`
 * separa grupos independentes dentro do card por um divisor.
 */
import { forwardRef } from "react";
import type { HTMLAttributes } from "react";
import { cn } from "./cn";

export const Card = forwardRef<HTMLElement, HTMLAttributes<HTMLElement>>(
  function Card({ className, ...props }, ref) {
    return (
      <section
        ref={ref}
        className={cn(
          "ev:min-w-0 ev:rounded-[var(--radius-lg)] ev:border-[length:var(--borda-espessura)] ev:border-[var(--divisor-cor-forte)] ev:bg-[var(--surface-canvas)] ev:p-[var(--space-lg)]",
          className,
        )}
        {...props}
      />
    );
  },
);

export function CardTitle({
  className,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn(
        "ev:m-0 ev:text-[length:var(--text-ui)] ev:font-semibold ev:text-[var(--color-ink)]",
        className,
      )}
      {...props}
    />
  );
}

/** Grupo independente dentro de um card composto, separado por divisor. */
export function CardSection({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "ev:min-w-0 ev:border-t-[length:var(--borda-espessura)] ev:border-[var(--divisor-cor)] ev:pt-[var(--secao-espaco-compacto)] ev:first:border-t-0 ev:first:pt-0",
        className,
      )}
      {...props}
    />
  );
}
