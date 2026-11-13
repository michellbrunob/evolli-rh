/**
 * T209 — menu "Ações" de uma linha da listagem de Colaboradores (C-4).
 *
 * Só atalhos às abas da ficha que o papel vê: nada edita, desliga ou age em
 * lote. Padrão de botão de menu (o mesmo do menu de blocos do Dashboard): o
 * botão tem nome próprio ("Ações: <nome>"), `aria-haspopup` e
 * `aria-expanded`; o menu tem `role="menu"` e cada atalho `role="menuitem"`.
 * Abrir leva o foco ao primeiro atalho (seta para cima: ao último); setas,
 * Home e End percorrem (com volta); Escape fecha e devolve o foco ao botão;
 * Tab, clique fora ou foco fora fecham. Escolher um atalho fecha o menu e
 * devolve o foco ao botão ANTES de abrir a ficha — na volta da ficha, é ele
 * que tem o foco.
 *
 * A tabela rola dentro do próprio quadro (e o recorta): por isso o menu é
 * posicionado em relação à janela (`position: fixed`), abaixo do botão — ou
 * acima, quando não cabe embaixo —, e acompanha a rolagem. Fica numa camada
 * abaixo do cabeçalho fixo do shell, da gaveta, de modais e da guarda.
 */
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";

export interface AtalhoDaPessoa {
  readonly id: string;
  readonly rotulo: string;
  readonly aoEscolher: () => void;
}

const FOLGA = 4;
const MARGEM = 8;

export function MenuAcoesDaPessoa({
  nome,
  atalhos,
}: {
  /** Nome da pessoa da linha: "Ações: <nome>". */
  readonly nome: string;
  readonly atalhos: readonly AtalhoDaPessoa[];
}) {
  const prefixo = useId();
  const idDoMenu = `${prefixo}-menu`;
  const [aberto, setAberto] = useState(false);
  const [posicao, setPosicao] = useState<CSSProperties>({});
  const raizRef = useRef<HTMLDivElement | null>(null);
  const botaoRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const itensRef = useRef<(HTMLButtonElement | null)[]>([]);
  const focoAoAbrir = useRef<"primeiro" | "ultimo">("primeiro");

  const posicionar = useCallback(() => {
    const botao = botaoRef.current;
    const menu = menuRef.current;
    if (!botao || !menu) return;
    const caixa = botao.getBoundingClientRect();
    const altura = menu.getBoundingClientRect().height;
    const cabeAbaixo =
      caixa.bottom + FOLGA + altura <= window.innerHeight - MARGEM;
    const acima = caixa.top - FOLGA - altura;
    setPosicao({
      top: cabeAbaixo || acima < MARGEM ? caixa.bottom + FOLGA : acima,
      right: Math.max(MARGEM, window.innerWidth - caixa.right),
    });
  }, []);

  useLayoutEffect(() => {
    if (!aberto) return undefined;
    posicionar();
    const alvo =
      focoAoAbrir.current === "ultimo"
        ? itensRef.current[atalhos.length - 1]
        : itensRef.current[0];
    alvo?.focus({ preventScroll: true });
    // Rolagem de qualquer ancestral (a página, o quadro da tabela) e
    // mudança de tamanho reposicionam o menu junto ao botão.
    window.addEventListener("scroll", posicionar, true);
    window.addEventListener("resize", posicionar);
    return () => {
      window.removeEventListener("scroll", posicionar, true);
      window.removeEventListener("resize", posicionar);
    };
    // `atalhos.length` só muda com o menu fechado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, posicionar]);

  useEffect(() => {
    if (!aberto) return undefined;
    function aoPressionarFora(evento: Event) {
      const alvo = evento.target;
      if (alvo instanceof Node && raizRef.current?.contains(alvo)) return;
      setAberto(false);
    }
    document.addEventListener("pointerdown", aoPressionarFora);
    document.addEventListener("mousedown", aoPressionarFora);
    return () => {
      document.removeEventListener("pointerdown", aoPressionarFora);
      document.removeEventListener("mousedown", aoPressionarFora);
    };
  }, [aberto]);

  function abrir(onde: "primeiro" | "ultimo") {
    focoAoAbrir.current = onde;
    setAberto(true);
  }

  function fecharDevolvendoFoco() {
    setAberto(false);
    botaoRef.current?.focus();
  }

  function aoTeclarNoBotao(evento: KeyboardEvent<HTMLButtonElement>) {
    if (evento.key === "ArrowDown") {
      evento.preventDefault();
      abrir("primeiro");
    } else if (evento.key === "ArrowUp") {
      evento.preventDefault();
      abrir("ultimo");
    }
  }

  function aoTeclarNoMenu(evento: KeyboardEvent<HTMLDivElement>) {
    const total = atalhos.length;
    const atual = itensRef.current.findIndex(
      (item) => item === document.activeElement,
    );
    let alvo: number | null = null;
    if (evento.key === "ArrowDown") alvo = (atual + 1) % total;
    if (evento.key === "ArrowUp") alvo = (atual - 1 + total) % total;
    if (evento.key === "Home") alvo = 0;
    if (evento.key === "End") alvo = total - 1;
    if (evento.key === "Escape") {
      evento.preventDefault();
      evento.stopPropagation();
      fecharDevolvendoFoco();
      return;
    }
    if (evento.key === "Tab") {
      setAberto(false);
      return;
    }
    if (alvo === null) return;
    evento.preventDefault();
    itensRef.current[alvo]?.focus();
  }

  return (
    <div
      ref={raizRef}
      className="colaboradores-screen__acoes"
      onBlur={(evento) => {
        const destino = evento.relatedTarget;
        if (destino instanceof Node && raizRef.current?.contains(destino)) {
          return;
        }
        setAberto(false);
      }}
    >
      <button
        ref={botaoRef}
        type="button"
        className="colaboradores-screen__botao-acoes"
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-controls={aberto ? idDoMenu : undefined}
        aria-label={`Ações: ${nome}`}
        onClick={() => (aberto ? setAberto(false) : abrir("primeiro"))}
        onKeyDown={aoTeclarNoBotao}
      >
        Ações
        <svg
          aria-hidden="true"
          focusable="false"
          width="12"
          height="12"
          viewBox="0 0 12 12"
        >
          <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" />
        </svg>
      </button>
      {aberto ? (
        <div
          ref={menuRef}
          id={idDoMenu}
          role="menu"
          aria-label={`Ações: ${nome}`}
          className="colaboradores-screen__menu"
          style={posicao}
          onKeyDown={aoTeclarNoMenu}
        >
          {atalhos.map((atalho, i) => (
            <button
              key={atalho.id}
              ref={(no) => {
                itensRef.current[i] = no;
              }}
              type="button"
              role="menuitem"
              tabIndex={-1}
              className="colaboradores-screen__menu-item"
              onClick={() => {
                fecharDevolvendoFoco();
                atalho.aoEscolher();
              }}
            >
              {atalho.rotulo}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
