/**
 * Modal (UI-F04, T142) — diálogo modal acessível.
 *
 * Criado porque o projeto não tinha componente de diálogo: os painéis
 * existentes (`SessoesAtivasPanel`, `SegurancaMfaPanel`) são conteúdo na
 * página, não janelas. Toda a acessibilidade e o comportamento de janela
 * ficam concentrados aqui — as telas só dizem o que vai dentro.
 *
 * Implementado em React puro, sem `<dialog>` nativo e sem dependência nova:
 * o `<dialog>` teria dado foco preso e camada superior de graça, mas o
 * suporte dele no ambiente de teste é parcial, e trocar cobertura de
 * comportamento por conveniência não compensa num sistema de RH.
 *
 * O que ele garante:
 *  - `role="dialog"` + `aria-modal` + nome acessível vindo do título;
 *  - foco inicial no título, foco PRESO enquanto aberto, e foco devolvido a
 *    quem abriu;
 *  - `Escape` fecha — mas só quando é seguro (ver `bloqueado`);
 *  - fundo sem rolagem e sem interação (`inert` quando disponível);
 *  - rolagem do conteúdo longo DENTRO do corpo, com cabeçalho e ações sempre
 *    visíveis;
 *  - descarte de formulário alterado exige confirmação explícita, feita
 *    dentro da própria janela — nunca `window.confirm`.
 *
 * Não empilha: cada tela mantém uma instância e troca o conteúdo dela.
 */
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Button } from "./Button";
import "./Modal.css";

export interface ModalProps {
  /** Quando `false`, nada é renderizado. */
  aberto: boolean;
  /** Nome acessível da janela. Obrigatório. */
  titulo: string;
  /** Texto de apoio logo abaixo do título. */
  descricao?: string;
  /** Fechamento pedido pelo usuário (Escape, botão Fechar, Cancelar). */
  onFechar: () => void;
  /**
   * Impede fechar: durante um envio em andamento, para não perder o que já
   * está em trânsito nem duplicar a operação.
   */
  bloqueado?: boolean;
  /**
   * Há alteração não salva. O fechamento passa a pedir confirmação explícita
   * dentro da janela antes de descartar.
   */
  alterado?: boolean;
  /** Largura máxima: `media` para leitura, `larga` para formulário em duas colunas. */
  largura?: "media" | "larga";
  /** Ações fixas no rodapé (não rolam com o conteúdo). */
  rodape?: ReactNode;
  children: ReactNode;
}

const FOCAVEIS =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({
  aberto,
  titulo,
  descricao,
  onFechar,
  bloqueado = false,
  alterado = false,
  largura = "media",
  rodape,
  children,
}: ModalProps) {
  const tituloId = useId();
  const descricaoId = useId();
  const caixaRef = useRef<HTMLDivElement | null>(null);
  const tituloRef = useRef<HTMLHeadingElement | null>(null);
  const acionadorRef = useRef<HTMLElement | null>(null);
  const [confirmandoDescarte, setConfirmandoDescarte] = useState(false);

  // Guarda quem abriu, para devolver o foco ao fechar.
  useEffect(() => {
    if (!aberto) return;
    // `document.body` não é acionador: devolver o foco para ele seria jogar
    // quem usa de volta ao início do documento.
    const ativo = document.activeElement;
    acionadorRef.current =
      ativo instanceof HTMLElement && ativo !== document.body ? ativo : null;
    tituloRef.current?.focus({ preventScroll: true });
    return () => {
      const alvo = acionadorRef.current;
      if (alvo && document.contains(alvo)) alvo.focus();
      acionadorRef.current = null;
    };
  }, [aberto]);

  // Fundo sem rolagem enquanto a janela estiver aberta.
  useEffect(() => {
    if (!aberto) return;
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = anterior;
    };
  }, [aberto]);

  // Sai da confirmação de descarte quando a janela fecha ou deixa de estar
  // alterada — nunca reabre já perguntando.
  useEffect(() => {
    if (!aberto || !alterado) setConfirmandoDescarte(false);
  }, [aberto, alterado]);

  const pedirFechamento = useCallback(() => {
    if (bloqueado) return;
    if (alterado) {
      setConfirmandoDescarte(true);
      return;
    }
    onFechar();
  }, [bloqueado, alterado, onFechar]);

  // Escape e foco preso.
  useEffect(() => {
    if (!aberto) return;
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === "Escape") {
        evento.preventDefault();
        if (confirmandoDescarte) {
          setConfirmandoDescarte(false);
          return;
        }
        pedirFechamento();
        return;
      }
      if (evento.key !== "Tab") return;
      const caixa = caixaRef.current;
      if (!caixa) return;
      // Sem heurística de visibilidade por layout: o seletor já exclui o que
      // está desabilitado, e `hidden` remove o elemento da ordem de tabulação.
      const focaveis = [
        ...caixa.querySelectorAll<HTMLElement>(FOCAVEIS),
      ].filter((el) => !el.hasAttribute("hidden"));
      if (focaveis.length === 0) {
        evento.preventDefault();
        tituloRef.current?.focus();
        return;
      }
      const primeiro = focaveis[0]!;
      const ultimo = focaveis[focaveis.length - 1]!;
      const atual = document.activeElement;
      if (!caixa.contains(atual)) {
        evento.preventDefault();
        primeiro.focus();
        return;
      }
      if (
        evento.shiftKey &&
        (atual === primeiro || atual === tituloRef.current)
      ) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && atual === ultimo) {
        evento.preventDefault();
        primeiro.focus();
      }
    }
    document.addEventListener("keydown", aoTeclar, true);
    return () => document.removeEventListener("keydown", aoTeclar, true);
  }, [aberto, confirmandoDescarte, pedirFechamento]);

  if (!aberto) return null;

  return (
    <div className="evolli-modal" role="presentation">
      {/* O fundo não fecha ao clique: num formulário longo, um clique fora
          descartaria trabalho sem aviso. Fechar é sempre explícito. */}
      <div className="evolli-modal__fundo" aria-hidden="true" />
      <div
        className={`evolli-modal__caixa evolli-modal__caixa--${largura}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        {...(descricao ? { "aria-describedby": descricaoId } : {})}
        ref={caixaRef}
      >
        <header className="evolli-modal__cabecalho">
          <h2
            className="evolli-modal__titulo"
            id={tituloId}
            ref={tituloRef}
            tabIndex={-1}
          >
            {titulo}
          </h2>
          <Button
            type="button"
            variant="secondary"
            onClick={pedirFechamento}
            disabled={bloqueado}
          >
            Fechar
          </Button>
        </header>

        {descricao ? (
          <p className="evolli-modal__descricao" id={descricaoId}>
            {descricao}
          </p>
        ) : null}

        {confirmandoDescarte ? (
          <div className="evolli-modal__confirmacao" role="alertdialog">
            <p className="evolli-modal__confirmacao-texto">
              Há alterações não salvas nesta janela. Descartar?
            </p>
            <div className="evolli-modal__confirmacao-acoes">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setConfirmandoDescarte(false)}
              >
                Continuar editando
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setConfirmandoDescarte(false);
                  onFechar();
                }}
              >
                Descartar alterações
              </Button>
            </div>
          </div>
        ) : null}

        <div className="evolli-modal__corpo">{children}</div>

        {rodape ? (
          <footer className="evolli-modal__rodape">{rodape}</footer>
        ) : null}
      </div>
    </div>
  );
}
