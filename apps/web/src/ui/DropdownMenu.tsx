/**
 * T209 — DropdownMenu da camada `src/ui`, sobre o Radix (menu acessível:
 * `role="menu"`, setas com volta, Home e End, busca por letra, Escape e
 * clique fora fecham e devolvem o foco ao gatilho). O conteúdo vai para um
 * portal: um quadro que rola (a tabela) não o recorta. Fica numa camada
 * abaixo do cabeçalho fixo, da gaveta, de modais e da guarda.
 *
 * `DropdownMenuItem` devolve o foco ao gatilho ANTES de executar a ação —
 * quem abre outra página a partir do menu (a ficha) guarda esse gatilho para
 * devolver o foco na volta.
 */
import * as RadixMenu from "@radix-ui/react-dropdown-menu";
import { createContext, forwardRef, useContext, useRef } from "react";
import type {
  ComponentPropsWithoutRef,
  MutableRefObject,
  ReactNode,
} from "react";
import { cn } from "./cn";

const GatilhoContext =
  createContext<MutableRefObject<HTMLButtonElement | null> | null>(null);

export function DropdownMenu({
  children,
  ...props
}: ComponentPropsWithoutRef<typeof RadixMenu.Root>) {
  const gatilho = useRef<HTMLButtonElement | null>(null);
  return (
    <GatilhoContext.Provider value={gatilho}>
      <RadixMenu.Root modal={false} {...props}>
        {children}
      </RadixMenu.Root>
    </GatilhoContext.Provider>
  );
}

export const DropdownMenuTrigger = forwardRef<
  HTMLButtonElement,
  ComponentPropsWithoutRef<typeof RadixMenu.Trigger>
>(function DropdownMenuTrigger({ className, ...props }, ref) {
  const gatilho = useContext(GatilhoContext);
  return (
    <RadixMenu.Trigger
      ref={(no) => {
        if (gatilho) gatilho.current = no;
        if (typeof ref === "function") ref(no);
        else if (ref) ref.current = no;
      }}
      className={className}
      {...props}
    />
  );
});

export function DropdownMenuContent({
  className,
  children,
  sideOffset = 4,
  align = "end",
  ...props
}: ComponentPropsWithoutRef<typeof RadixMenu.Content> & {
  readonly children: ReactNode;
}) {
  return (
    <RadixMenu.Portal>
      <RadixMenu.Content
        loop
        sideOffset={sideOffset}
        align={align}
        collisionPadding={8}
        className={cn(
          "ev:z-20 ev:grid ev:min-w-[13rem] ev:max-w-[calc(100vw-2*var(--space-md))] ev:rounded-[var(--radius-md)] ev:border-[length:var(--borda-espessura)] ev:border-[var(--divisor-cor-forte)] ev:bg-[var(--surface-canvas)] ev:p-1",
          className,
        )}
        {...props}
      >
        {children}
      </RadixMenu.Content>
    </RadixMenu.Portal>
  );
}

export function DropdownMenuItem({
  className,
  onSelect,
  ...props
}: ComponentPropsWithoutRef<typeof RadixMenu.Item>) {
  const gatilho = useContext(GatilhoContext);
  return (
    <RadixMenu.Item
      className={cn(
        "ev:flex ev:min-h-[var(--touch-target)] ev:cursor-pointer ev:items-center ev:rounded-[var(--radius-sm)] ev:px-[var(--space-sm)] ev:text-[var(--color-ink)] ev:outline-none ev:data-[highlighted]:bg-[var(--estado-selecao-superficie)]",
        className,
      )}
      onSelect={(evento) => {
        gatilho?.current?.focus();
        onSelect?.(evento);
      }}
      {...props}
    />
  );
}
