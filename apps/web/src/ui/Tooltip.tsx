/**
 * T209 — Tooltip da camada `src/ui`, sobre o Radix: aparece no foco por
 * teclado e no ponteiro, some com Escape, e o texto vira descrição acessível
 * do gatilho. Nunca é o único lugar de uma informação necessária (no celular
 * não há ponteiro): serve de reforço a rótulos que já existem.
 */
import * as RadixTooltip from "@radix-ui/react-tooltip";
import type { ReactElement, ReactNode } from "react";
import { cn } from "./cn";

export function TooltipProvider({
  children,
}: {
  readonly children: ReactNode;
}) {
  return (
    <RadixTooltip.Provider delayDuration={300}>
      {children}
    </RadixTooltip.Provider>
  );
}

export function Tooltip({
  content,
  children,
  className,
}: {
  readonly content: ReactNode;
  /** Um único elemento focável (o gatilho). */
  readonly children: ReactElement;
  readonly className?: string;
}) {
  return (
    <RadixTooltip.Root>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          sideOffset={6}
          collisionPadding={8}
          className={cn(
            "ev:z-20 ev:max-w-[min(20rem,calc(100vw-2*var(--space-md)))] ev:rounded-[var(--radius-sm)] ev:bg-[var(--surface-dark)] ev:px-[var(--space-sm)] ev:py-1 ev:text-[length:var(--text-caption)] ev:text-[var(--color-on-dark)]",
            className,
          )}
        >
          {content}
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}
