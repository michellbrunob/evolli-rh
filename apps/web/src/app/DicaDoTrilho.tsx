/**
 * Dica visual do menu lateral (T206).
 *
 * ## O que ela é — e o que não é
 *
 * No trilho recolhido os itens mostram só o ícone. A dica repete, ao lado do
 * item, o nome do destino, para quem enxerga e navega com mouse ou teclado.
 *
 * Ela **não é** a fonte do nome acessível. Cada item do trilho continua com o
 * próprio texto no DOM, só visualmente oculto, e é dele que vem o nome — a
 * dica é `aria-hidden`, para que o leitor de tela não ouça o nome duas vezes.
 *
 * ## Como funciona
 *
 * Um único elemento, em posição fixa: o menu rola por dentro, e uma dica
 * absoluta seria cortada pela própria barra. Quem declara a dica é o item, no
 * atributo `data-dica`; este componente só escuta, na raiz do menu:
 *
 * - aparece ao passar o ponteiro e ao receber foco;
 * - some ao sair o ponteiro (exceto se ele passou para a própria dica, que
 *   pode ser percorrida — critério 1.4.13), ao perder o foco, com `Escape`,
 *   com clique e com rolagem.
 *
 * O clique também a esconde porque ele pode trocar o próprio nome do item
 * (recolher vira expandir): uma dica com o nome antigo mentiria.
 */
import { useEffect, useRef, useState, type RefObject } from "react";

/** Distância visual entre o item e a dica, desenhada por dentro dela. */
export const AFASTAMENTO_DA_DICA = 8;

interface EstadoDaDica {
  readonly texto: string;
  readonly topo: number;
  readonly esquerda: number;
}

export interface DicaDoTrilhoProps {
  /** Raiz do menu lateral: só os `data-dica` dentro dela contam. */
  readonly raizRef: RefObject<HTMLElement | null>;
  /** Fora do desktop (gaveta do celular) a dica não existe. */
  readonly ativa: boolean;
}

function alvoDe(alvo: EventTarget | null): HTMLElement | null {
  return alvo instanceof Element
    ? alvo.closest<HTMLElement>("[data-dica]")
    : null;
}

export function DicaDoTrilho({ raizRef, ativa }: DicaDoTrilhoProps) {
  const [dica, setDica] = useState<EstadoDaDica | null>(null);
  const dicaRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const raiz = raizRef.current;
    if (!ativa || !raiz) {
      setDica(null);
      return;
    }
    let alvoAtual: HTMLElement | null = null;

    function mostrar(alvo: HTMLElement) {
      const texto = alvo.dataset.dica;
      if (!texto || !raiz?.contains(alvo)) return;
      const caixa = alvo.getBoundingClientRect();
      alvoAtual = alvo;
      setDica({
        texto,
        topo: caixa.top + caixa.height / 2,
        esquerda: caixa.right,
      });
    }

    function esconder() {
      alvoAtual = null;
      setDica(null);
    }

    const dentroDaDicaOuDoAlvo = (no: EventTarget | null) =>
      no instanceof Node &&
      ((alvoAtual?.contains(no) ?? false) ||
        (dicaRef.current?.contains(no) ?? false));

    const aoApontar = (evento: PointerEvent) => {
      const alvo = alvoDe(evento.target);
      if (alvo) mostrar(alvo);
    };
    const aoSairDoPonteiro = (evento: PointerEvent) => {
      if (alvoAtual === null) return;
      if (dentroDaDicaOuDoAlvo(evento.relatedTarget)) return;
      if (dentroDaDicaOuDoAlvo(evento.target)) esconder();
    };
    const aoFocar = (evento: FocusEvent) => {
      const alvo = alvoDe(evento.target);
      if (alvo) mostrar(alvo);
      else esconder();
    };
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") esconder();
    };

    raiz.addEventListener("pointerover", aoApontar);
    raiz.addEventListener("pointerout", aoSairDoPonteiro);
    raiz.addEventListener("focusin", aoFocar);
    raiz.addEventListener("focusout", esconder);
    raiz.addEventListener("click", esconder);
    document.addEventListener("keydown", aoTeclar);
    window.addEventListener("scroll", esconder, true);
    return () => {
      raiz.removeEventListener("pointerover", aoApontar);
      raiz.removeEventListener("pointerout", aoSairDoPonteiro);
      raiz.removeEventListener("focusin", aoFocar);
      raiz.removeEventListener("focusout", esconder);
      raiz.removeEventListener("click", esconder);
      document.removeEventListener("keydown", aoTeclar);
      window.removeEventListener("scroll", esconder, true);
      setDica(null);
    };
  }, [ativa, raizRef]);

  if (dica === null) return null;
  return (
    <div
      ref={dicaRef}
      className="dica-trilho"
      data-testid="dica-trilho"
      aria-hidden="true"
      style={{ top: dica.topo, left: dica.esquerda }}
    >
      <span className="dica-trilho__texto">{dica.texto}</span>
    </div>
  );
}
