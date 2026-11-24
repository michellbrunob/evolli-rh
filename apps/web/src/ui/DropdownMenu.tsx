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
 *
 * Acréscimos ao Radix (padrão de botão de menu do WAI-ARIA): seta para cima
 * no gatilho abre o menu já no ÚLTIMO item (o Radix só abre no primeiro), e
 * Tab fecha o menu e devolve o foco ao gatilho (o Radix prende o Tab).
 */
import * as RadixMenu from "@radix-ui/react-dropdown-menu";
import { createContext, forwardRef, useContext, useRef, useState } from "react";
import type {
  ComponentPropsWithoutRef,
  MutableRefObject,
  ReactNode,
} from "react";
import { cn } from "./cn";

interface ContextoDoMenu {
  readonly gatilho: MutableRefObject<HTMLButtonElement | null>;
  readonly focarUltimo: MutableRefObject<boolean>;
  readonly abrir: () => void;
  readonly fechar: () => void;
}

const MenuContext = createContext<ContextoDoMenu | null>(null);

export function DropdownMenu({
  children,
  open,
  onOpenChange,
  ...props
}: ComponentPropsWithoutRef<typeof RadixMenu.Root>) {
  const gatilho = useRef<HTMLButtonElement | null>(null);
  const focarUltimo = useRef(false);
  const [abertoInterno, setAbertoInterno] = useState(false);
  const aberto = open ?? abertoInterno;
  const mudar = (novo: boolean) => {
    if (open === undefined) setAbertoInterno(novo);
    onOpenChange?.(novo);
  };
  return (
    <MenuContext.Provider
      value={{
        gatilho,
        focarUltimo,
        abrir: () => mudar(true),
        fechar: () => mudar(false),
      }}
    >
      <RadixMenu.Root
        modal={false}
        open={aberto}
        onOpenChange={mudar}
        {...props}
      >
        {children}
      </RadixMenu.Root>
    </MenuContext.Provider>
  );
}

export const DropdownMenuTrigger = forwardRef<
  HTMLButtonElement,
  ComponentPropsWithoutRef<typeof RadixMenu.Trigger>
>(function DropdownMenuTrigger({ className, onKeyDown, ...props }, ref) {
  const menu = useContext(MenuContext);
  return (
    <RadixMenu.Trigger
      ref={(no) => {
        if (menu) menu.gatilho.current = no;
        if (typeof ref === "function") ref(no);
        else if (ref) ref.current = no;
      }}
      className={className}
      onKeyDown={(evento) => {
        onKeyDown?.(evento);
        if (evento.defaultPrevented || evento.key !== "ArrowUp" || !menu) {
          return;
        }
        evento.preventDefault();
        menu.focarUltimo.current = true;
        menu.abrir();
      }}
      {...props}
    />
  );
});

export function DropdownMenuContent({
  className,
  children,
  sideOffset = 4,
  align = "end",
  onFocusCapture,
  onKeyDown,
  ...props
}: ComponentPropsWithoutRef<typeof RadixMenu.Content> & {
  readonly children: ReactNode;
}) {
  const menu = useContext(MenuContext);
  return (
    <RadixMenu.Portal>
      <RadixMenu.Content
        loop
        sideOffset={sideOffset}
        align={align}
        collisionPadding={8}
        onKeyDown={(evento) => {
          onKeyDown?.(evento);
          if (evento.defaultPrevented || evento.key !== "Tab") return;
          evento.preventDefault();
          menu?.fechar();
        }}
        onFocusCapture={(evento) => {
          onFocusCapture?.(evento);
          // Abertura pela seta para cima: quando o Radix leva o foco ao
          // primeiro item, ele vai ao último.
          if (!menu?.focarUltimo.current) return;
          const alvo = evento.target as HTMLElement;
          if (alvo.getAttribute("role") !== "menuitem") return;
          menu.focarUltimo.current = false;
          const itens =
            evento.currentTarget.querySelectorAll<HTMLElement>(
              '[role="menuitem"]',
            );
          itens[itens.length - 1]?.focus();
        }}
        className={cn(
          // T215 — "ev-menu": cresce a partir do gatilho (ui/movimento.css).
          "ev-menu ev:z-20 ev:grid ev:min-w-[13rem] ev:max-w-[calc(100vw-2*var(--space-md))] ev:rounded-[var(--radius-md)] ev:border-[length:var(--borda-espessura)] ev:border-[var(--divisor-cor-forte)] ev:bg-[var(--surface-canvas)] ev:p-1",
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
  const menu = useContext(MenuContext);
  return (
    <RadixMenu.Item
      className={cn(
        "ev:flex ev:min-h-[var(--touch-target)] ev:cursor-pointer ev:items-center ev:rounded-[var(--radius-sm)] ev:px-[var(--space-sm)] ev:text-[var(--color-ink)] ev:outline-none ev:data-[highlighted]:bg-[var(--estado-selecao-superficie)]",
        className,
      )}
      onSelect={(evento) => {
        menu?.gatilho.current?.focus();
        onSelect?.(evento);
      }}
      {...props}
    />
  );
}
