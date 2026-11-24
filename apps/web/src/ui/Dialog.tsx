/**
 * T209 — Dialog e Sheet (painel lateral) da camada `src/ui`, sobre o Radix
 * Dialog: `role="dialog"` + `aria-modal`, nome pelo título, foco preso,
 * fundo inerte (o resto da página fica oculto do leitor de tela), rolagem do
 * fundo travada, Escape e clique no fundo, foco devolvido a quem abriu.
 *
 * Por cima do Radix, o comportamento do Evolli:
 *  - foco inicial no TÍTULO (não no primeiro campo): quem abre ouve o nome;
 *  - guarda de alterações: com `alterado`, Escape, fundo, "Fechar" e qualquer
 *    "Cancelar" de dentro (`usePedirFechamentoJanela`) pedem confirmação na
 *    própria janela; com `bloqueado` (envio em andamento), nada fecha;
 *  - edição pendente e salvamento entram no registro do shell (troca de
 *    empresa e saída respeitam os dois);
 *  - animação: o Sheet entra da direita e sai para a direita, o fundo aparece
 *    e some por opacidade (`estilos.css`); a saída espera o fim da animação
 *    pelo próprio Radix (sem temporizador). Com `prefers-reduced-motion`, sem
 *    animação perceptível.
 */
import * as RadixDialog from "@radix-ui/react-dialog";
import { IconeFechar } from "./icones";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { useEdicaoEmAndamento } from "../app/edicoesPendentes";
import { Button, IconButton } from "./Button";
import { cn } from "./cn";

const PedirFechamentoContext = createContext<(() => void) | null>(null);

/** O pedido de fechamento da janela que envolve o componente (com a guarda). */
export function usePedirFechamentoJanela(): () => void {
  const pedir = useContext(PedirFechamentoContext);
  if (!pedir) {
    throw new Error(
      "usePedirFechamentoJanela só pode ser usado dentro de Dialog ou Sheet.",
    );
  }
  return pedir;
}

export interface JanelaProps {
  readonly aberto: boolean;
  readonly titulo: string;
  readonly descricao?: string;
  readonly onFechar: () => void;
  /** Envio em andamento: nada fecha a janela. */
  readonly bloqueado?: boolean;
  /** Há alteração não salva: fechar pede confirmação. */
  readonly alterado?: boolean;
  /** Ilustração decorativa ao lado do título. */
  readonly icone?: ReactNode;
  /** T215 — linha curta sob o título, no cabeçalho (ex.: pessoa · cargo). */
  readonly subtitulo?: string;
  /** Ações fixas no rodapé. */
  readonly rodape?: ReactNode;
  readonly children: ReactNode;
  readonly className?: string;
}

function Janela({
  lado,
  aberto,
  titulo,
  descricao,
  onFechar,
  bloqueado = false,
  alterado = false,
  icone,
  subtitulo,
  rodape,
  children,
  className,
}: JanelaProps & { readonly lado: "centro" | "direita" }) {
  const tituloRef = useRef<HTMLHeadingElement | null>(null);
  const confirmacaoRef = useRef<HTMLDivElement | null>(null);
  const focoAntesRef = useRef<HTMLElement | null>(null);
  /** Quem tinha o foco ao abrir: recebe o foco de volta ao fechar. */
  const acionadorRef = useRef<HTMLElement | null>(null);
  const [confirmando, setConfirmando] = useState(false);

  useEdicaoEmAndamento(titulo, {
    pendente: aberto && alterado,
    salvando: aberto && bloqueado,
  });

  useEffect(() => {
    if (!aberto || !alterado) setConfirmando(false);
  }, [aberto, alterado]);

  useEffect(() => {
    if (!confirmando) return;
    confirmacaoRef.current
      ?.querySelector<HTMLElement>("[data-foco-inicial]")
      ?.focus();
  }, [confirmando]);

  const pedirFechamento = useCallback(() => {
    if (bloqueado) return;
    if (alterado) {
      const ativo = document.activeElement;
      focoAntesRef.current = ativo instanceof HTMLElement ? ativo : null;
      setConfirmando(true);
      return;
    }
    onFechar();
  }, [bloqueado, alterado, onFechar]);

  const continuarEditando = useCallback(() => {
    setConfirmando(false);
    const alvo = focoAntesRef.current;
    focoAntesRef.current = null;
    if (alvo && document.contains(alvo)) alvo.focus();
    else tituloRef.current?.focus();
  }, []);

  return (
    <RadixDialog.Root
      open={aberto}
      onOpenChange={(abrir) => {
        if (!abrir) pedirFechamento();
      }}
    >
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="ev-janela__fundo ev:fixed ev:inset-0 ev:z-[100] ev:bg-[var(--veu)]" />
        <RadixDialog.Content
          data-lado={lado}
          aria-modal="true"
          className={cn(
            "ev-janela ev:fixed ev:z-[100] ev:flex ev:flex-col ev:bg-[var(--surface-canvas)] ev:outline-none",
            lado === "direita"
              ? "ev-janela--lateral ev:inset-y-0 ev:right-0 ev:h-dvh ev:w-full ev:max-w-[30rem] ev:border-l-[length:var(--borda-espessura)] ev:border-[var(--divisor-cor-forte)]"
              : "ev-janela--centro ev:top-1/2 ev:left-1/2 ev:max-h-[calc(100dvh-2*var(--space-lg))] ev:w-[calc(100vw-2*var(--space-lg))] ev:max-w-[34rem] ev:-translate-x-1/2 ev:-translate-y-1/2 ev:rounded-[var(--radius-lg)] ev:border ev:border-[var(--divisor-cor-forte)]",
            className,
          )}
          {...(descricao ? {} : { "aria-describedby": undefined })}
          onOpenAutoFocus={(evento) => {
            evento.preventDefault();
            // O Radix só devolve o foco ao próprio `Dialog.Trigger`; aqui quem
            // abre é qualquer botão da tela, guardado antes de o foco sair.
            const ativo = document.activeElement;
            acionadorRef.current =
              ativo instanceof HTMLElement && ativo !== document.body
                ? ativo
                : null;
            tituloRef.current?.focus({ preventScroll: true });
          }}
          onCloseAutoFocus={(evento) => {
            evento.preventDefault();
            const alvo = acionadorRef.current;
            acionadorRef.current = null;
            if (alvo && document.contains(alvo)) alvo.focus();
          }}
          onEscapeKeyDown={(evento) => {
            if (confirmando) {
              evento.preventDefault();
              continuarEditando();
            }
          }}
        >
          <header className="ev:flex ev:items-center ev:justify-between ev:gap-[var(--space-md)] ev:border-b-[length:var(--borda-espessura)] ev:border-[var(--divisor-cor)] ev:px-[var(--space-lg)] ev:pt-[var(--space-lg)] ev:pb-[var(--space-sm)]">
            <div className="ev:flex ev:min-w-0 ev:items-center ev:gap-[var(--space-sm)]">
              {icone ? (
                <span
                  aria-hidden="true"
                  className="ev:inline-flex ev:size-10 ev:shrink-0 ev:items-center ev:justify-center ev:rounded-[var(--radius-md)] ev:bg-[var(--status-info-surface)] ev:text-[var(--color-action)]"
                >
                  {icone}
                </span>
              ) : null}
              <div className="ev:min-w-0">
                <RadixDialog.Title
                  ref={tituloRef}
                  tabIndex={-1}
                  className="ev:m-0 ev:min-w-0 ev:text-[length:var(--text-lead)] ev:font-semibold ev:leading-[var(--leading-tight)] ev:text-[var(--color-ink)]"
                >
                  {titulo}
                </RadixDialog.Title>
                {subtitulo ? (
                  <p className="ev:m-0 ev:truncate ev:text-[length:var(--text-caption)] ev:text-[var(--color-ink-subtle)]">
                    {subtitulo}
                  </p>
                ) : null}
              </div>
            </div>
            <IconButton
              label="Fechar"
              icon={<IconeFechar tamanho={20} />}
              onClick={pedirFechamento}
              disabled={bloqueado}
            />
          </header>
          {descricao ? (
            <RadixDialog.Description className="ev:m-0 ev:px-[var(--space-lg)] ev:pt-[var(--space-sm)] ev:text-[var(--color-ink-muted)]">
              {descricao}
            </RadixDialog.Description>
          ) : null}
          {confirmando ? (
            <div
              ref={confirmacaoRef}
              role="alertdialog"
              aria-modal="true"
              aria-label="Há alterações não salvas nesta janela. Descartar?"
              className="ev:mx-[var(--space-lg)] ev:mt-[var(--space-md)] ev:flex ev:flex-wrap ev:items-center ev:justify-between ev:gap-[var(--space-sm)] ev:rounded-[var(--radius-md)] ev:border ev:border-[var(--status-warning-border)] ev:bg-[var(--status-warning-surface)] ev:p-[var(--space-md)]"
            >
              <p className="ev:m-0 ev:font-semibold ev:text-[var(--status-warning-ink)]">
                Há alterações não salvas nesta janela. Descartar?
              </p>
              <div className="ev:flex ev:flex-wrap ev:gap-2">
                <Button onClick={continuarEditando} data-foco-inicial>
                  Continuar editando
                </Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    setConfirmando(false);
                    onFechar();
                  }}
                >
                  Descartar alterações
                </Button>
              </div>
            </div>
          ) : null}
          <PedirFechamentoContext.Provider value={pedirFechamento}>
            <div className="ev:min-h-0 ev:flex-1 ev:overflow-y-auto ev:p-[var(--space-lg)]">
              {children}
            </div>
            {rodape ? (
              <footer className="ev-janela__rodape ev:flex ev:flex-wrap ev:justify-end ev:gap-2 ev:border-t-[length:var(--borda-espessura)] ev:border-[var(--divisor-cor)] ev:px-[var(--space-lg)] ev:py-[var(--space-md)]">
                {rodape}
              </footer>
            ) : null}
          </PedirFechamentoContext.Provider>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

/** Janela central (diálogo modal). */
export function Dialog(props: JanelaProps) {
  return <Janela lado="centro" {...props} />;
}

/** Painel lateral: a janela presa à borda direita, na altura toda. */
export function Sheet(props: JanelaProps) {
  return <Janela lado="direita" {...props} />;
}
