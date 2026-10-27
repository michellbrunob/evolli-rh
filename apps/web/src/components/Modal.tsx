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
 *  - fundo sem rolagem e fora de alcance. Não usa `inert`: o alcance é cortado
 *    por três mecanismos próprios — a camada `.evolli-modal` é `position:
 *    fixed; inset: 0` e absorve todo clique antes da página; o `Tab` é preso
 *    pelo manipulador abaixo, que devolve o foco à caixa mesmo quando ele
 *    começa fora dela; e `aria-modal` limita a navegação virtual do leitor de
 *    tela. Se um dia `inert` entrar aqui, ele substitui o segundo e o terceiro,
 *    não se soma a eles;
 *  - rolagem do conteúdo longo DENTRO do corpo, com cabeçalho e ações sempre
 *    visíveis;
 *  - descarte de formulário alterado exige confirmação explícita, feita
 *    dentro da própria janela — nunca `window.confirm`. A confirmação é um
 *    `alertdialog` nomeado pelo próprio texto, que leva o foco direto à ação
 *    segura ("Continuar editando") e o PRENDE: enquanto está aberta, `Tab` e
 *    `Shift+Tab` circulam só entre as suas duas ações, e nada atrás dela
 *    recebe foco. `Escape` e "Continuar editando" fecham só a confirmação e
 *    devolvem o foco a quem o tinha antes dela.
 *
 * Não empilha: cada tela mantém uma instância e troca o conteúdo dela.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { Button } from "./Button";
import "./Modal.css";
import { useEdicaoEmAndamento } from "../app/edicoesPendentes";

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

/**
 * Pedido de fechamento da janela, oferecido ao conteúdo dela (T167).
 *
 * Um botão "Cancelar" dentro do formulário que chamasse o `onFechar` da tela
 * direto passaria POR FORA da confirmação de descarte — e passava: com dados
 * digitados, "Fechar" e Escape pediam confirmação, mas "Cancelar" descartava
 * calado. Por este contexto, qualquer ação de dentro da janela pede o
 * fechamento pelo MESMO caminho, que respeita `bloqueado` e `alterado`.
 */
const PedirFechamentoContext = createContext<(() => void) | null>(null);

/**
 * Devolve a função que pede o fechamento da janela que envolve o componente.
 * Só funciona dentro de um `Modal`: fora dele, falha alto — um "Cancelar" sem
 * janela seria um botão que não faz o que diz.
 */
export function usePedirFechamentoModal(): () => void {
  const pedir = useContext(PedirFechamentoContext);
  if (!pedir) {
    throw new Error(
      "usePedirFechamentoModal só pode ser usado dentro de Modal.",
    );
  }
  return pedir;
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
  const confirmacaoId = useId();
  const caixaRef = useRef<HTMLDivElement | null>(null);
  const tituloRef = useRef<HTMLHeadingElement | null>(null);
  const acionadorRef = useRef<HTMLElement | null>(null);
  const confirmacaoRef = useRef<HTMLDivElement | null>(null);
  // Quem estava em foco quando a confirmação apareceu — para devolver o foco
  // ao fluxo de edição quando a pessoa escolhe continuar editando.
  const focoAntesDaConfirmacaoRef = useRef<HTMLElement | null>(null);
  const [confirmandoDescarte, setConfirmandoDescarte] = useState(false);

  // T189 — janela aberta com alteração não salva é edição pendente; envio
  // em andamento (`bloqueado`), salvamento. A troca de empresa respeita os
  // dois, como o próprio fechamento desta janela.
  useEdicaoEmAndamento(titulo, {
    pendente: aberto && alterado,
    salvando: aberto && bloqueado,
  });

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
    if (!aberto || !alterado) {
      setConfirmandoDescarte(false);
      focoAntesDaConfirmacaoRef.current = null;
    }
  }, [aberto, alterado]);

  // Referência de foco nunca sobrevive à confirmação que a criou: ao fechar a
  // janela (ou desmontar), ela é descartada, para não devolver o foco a um
  // elemento obsoleto na próxima vez.
  useEffect(() => {
    return () => {
      focoAntesDaConfirmacaoRef.current = null;
    };
  }, [aberto]);

  // A confirmação é um `alertdialog`: ao aparecer, o foco vai direto para a
  // ação segura ("Continuar editando"). Além de tirar o foco do campo de trás,
  // faz o leitor de tela anunciar o diálogo — `alertdialog` não tem região
  // viva implícita e nada seria anunciado sozinho.
  useEffect(() => {
    if (!confirmandoDescarte) return;
    const inicial = confirmacaoRef.current?.querySelector<HTMLElement>(
      "[data-foco-inicial]",
    );
    (inicial ?? confirmacaoRef.current)?.focus({ preventScroll: true });
  }, [confirmandoDescarte]);

  /** Sai da confirmação devolvendo o foco a quem o tinha antes dela. */
  const continuarEditando = useCallback(() => {
    setConfirmandoDescarte(false);
    const alvo = focoAntesDaConfirmacaoRef.current;
    focoAntesDaConfirmacaoRef.current = null;
    if (alvo && document.contains(alvo)) alvo.focus();
    else tituloRef.current?.focus({ preventScroll: true });
  }, []);

  const pedirFechamento = useCallback(() => {
    if (bloqueado) return;
    if (alterado) {
      const ativo = document.activeElement;
      focoAntesDaConfirmacaoRef.current =
        ativo instanceof HTMLElement && ativo !== document.body ? ativo : null;
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
          // Escape na confirmação volta um nível, como "Continuar editando":
          // cancela a pergunta e devolve o foco a quem estava editando.
          continuarEditando();
          return;
        }
        pedirFechamento();
        return;
      }
      if (evento.key !== "Tab") return;
      // Escopo do foco: enquanto a confirmação de descarte está aberta, ele é
      // EXCLUSIVAMENTE o `alertdialog` — declarar `aria-modal` nela e deixar o
      // Tab alcançar os campos de trás seria afirmar uma coisa e permitir
      // outra. Fora dela, volta a ser a caixa inteira.
      const raiz = confirmandoDescarte
        ? confirmacaoRef.current
        : caixaRef.current;
      if (!raiz) return;
      // Sem heurística de visibilidade por layout: o seletor já exclui o que
      // está desabilitado, e `hidden` remove o elemento da ordem de tabulação.
      const focaveis = [...raiz.querySelectorAll<HTMLElement>(FOCAVEIS)].filter(
        (el) => !el.hasAttribute("hidden"),
      );
      if (focaveis.length === 0) {
        evento.preventDefault();
        (confirmandoDescarte ? raiz : tituloRef.current)?.focus();
        return;
      }
      const primeiro = focaveis[0]!;
      const ultimo = focaveis[focaveis.length - 1]!;
      const atual = document.activeElement;
      if (!raiz.contains(atual)) {
        evento.preventDefault();
        (evento.shiftKey ? ultimo : primeiro).focus();
        return;
      }
      // Posição "antes do primeiro": o título (caixa) ou o próprio contêiner
      // da confirmação, ambos focáveis só por programa (`tabindex=-1`).
      const antesDoPrimeiro = confirmandoDescarte ? raiz : tituloRef.current;
      if (
        evento.shiftKey &&
        (atual === primeiro || atual === antesDoPrimeiro)
      ) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && atual === ultimo) {
        evento.preventDefault();
        primeiro.focus();
      } else if (!evento.shiftKey && atual === antesDoPrimeiro) {
        // Sem esta ramificação o navegador decidiria sozinho para onde o Tab
        // vai a partir de um contêiner `tabindex=-1`.
        evento.preventDefault();
        primeiro.focus();
      }
    }
    document.addEventListener("keydown", aoTeclar, true);
    return () => document.removeEventListener("keydown", aoTeclar, true);
  }, [aberto, confirmandoDescarte, pedirFechamento, continuarEditando]);

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
          <div
            className="evolli-modal__confirmacao"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={confirmacaoId}
            ref={confirmacaoRef}
            tabIndex={-1}
          >
            <p className="evolli-modal__confirmacao-texto" id={confirmacaoId}>
              Há alterações não salvas nesta janela. Descartar?
            </p>
            <div className="evolli-modal__confirmacao-acoes">
              <Button
                type="button"
                variant="secondary"
                onClick={continuarEditando}
                data-foco-inicial
              >
                Continuar editando
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setConfirmandoDescarte(false);
                  focoAntesDaConfirmacaoRef.current = null;
                  onFechar();
                }}
              >
                Descartar alterações
              </Button>
            </div>
          </div>
        ) : null}

        <PedirFechamentoContext.Provider value={pedirFechamento}>
          <div className="evolli-modal__corpo">{children}</div>

          {rodape ? (
            <footer className="evolli-modal__rodape">{rodape}</footer>
          ) : null}
        </PedirFechamentoContext.Provider>
      </div>
    </div>
  );
}
