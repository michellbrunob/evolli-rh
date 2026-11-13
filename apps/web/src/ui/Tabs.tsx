/**
 * T209 — Tabs da camada `src/ui`: padrão WAI-ARIA de abas com ATIVAÇÃO
 * MANUAL. Setas (com volta), Home e End só movem o foco; Enter, Espaço ou o
 * clique ativam. Só a aba selecionada fica na ordem de tabulação.
 *
 * Por que não Radix aqui: o `Tabs` do Radix ativa no `mousedown` e de novo
 * pelo teclado, o que duplicaria a ativação de quem pergunta antes de trocar
 * (a guarda de saída da aba Jornada, em Colaboradores). Este componente é o
 * padrão que a listagem já usava, extraído e reutilizável — controlado por
 * quem usa (estado na URL, guarda, contagens).
 */
import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  KeyboardEvent,
} from "react";
import { cn } from "./cn";

export interface TabsListProps extends HTMLAttributes<HTMLDivElement> {
  /** Nome acessível do grupo de abas. */
  readonly label: string;
}

export function TabsList({
  label,
  className,
  onKeyDown,
  ...props
}: TabsListProps) {
  function aoTeclar(evento: KeyboardEvent<HTMLDivElement>) {
    onKeyDown?.(evento);
    if (evento.defaultPrevented) return;
    const abas = [
      ...evento.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]'),
    ];
    const atual = abas.indexOf(document.activeElement as HTMLElement);
    if (atual < 0) return;
    const n = abas.length;
    let alvo: number | null = null;
    if (evento.key === "ArrowRight") alvo = (atual + 1) % n;
    if (evento.key === "ArrowLeft") alvo = (atual - 1 + n) % n;
    if (evento.key === "Home") alvo = 0;
    if (evento.key === "End") alvo = n - 1;
    if (alvo === null) return;
    evento.preventDefault();
    abas[alvo]?.focus();
  }
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn("ev:flex ev:min-w-0", className)}
      onKeyDown={aoTeclar}
      {...props}
    />
  );
}

export interface TabsTriggerProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "role"
> {
  readonly selected: boolean;
  /** `id` do painel que a aba controla. */
  readonly controls: string;
}

export function TabsTrigger({
  selected,
  controls,
  className,
  type = "button",
  ...props
}: TabsTriggerProps) {
  return (
    <button
      type={type}
      role="tab"
      aria-selected={selected}
      aria-controls={controls}
      tabIndex={selected ? 0 : -1}
      data-state={selected ? "active" : "inactive"}
      className={className}
      {...props}
    />
  );
}

export interface TabsPanelProps extends HTMLAttributes<HTMLElement> {
  /** `id` da aba que nomeia o painel. */
  readonly labelledBy: string;
}

export function TabsPanel({ labelledBy, className, ...props }: TabsPanelProps) {
  return (
    <section
      role="tabpanel"
      aria-labelledby={labelledBy}
      className={className}
      {...props}
    />
  );
}
