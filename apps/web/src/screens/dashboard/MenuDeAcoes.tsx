/**
 * T207 — menu de ações de um bloco do Dashboard (botão de reticências).
 *
 * Padrão de botão de menu: o botão tem nome ("Ações: …"), `aria-haspopup`
 * e `aria-expanded`; o menu tem `role="menu"` e cada ação `role="menuitem"`.
 * Abrir leva o foco à primeira ação (seta para cima: à última); setas, Home e
 * End percorrem as ações (com volta); Enter e Espaço escolhem; Escape fecha e
 * devolve o foco ao botão; Tab, clique fora ou foco fora fecham. Escolher uma
 * ação fecha o menu e devolve o foco ao botão antes de executá-la.
 *
 * O menu fica dentro do bloco (posição absoluta, camada baixa): nunca por
 * cima de cabeçalho fixo, modal, guarda ou gaveta. Ao abrir, ele é rolado
 * para dentro da área visível, abaixo do cabeçalho fixo.
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

export interface AcaoDoMenu {
  readonly id: string;
  readonly rotulo: string;
  /** Uma linha de apoio, lida como descrição da ação. */
  readonly descricao: string;
  readonly aoEscolher: () => void;
}

/** O cabeçalho fixo do shell (no celular, pode quebrar em várias linhas). */
const CABECALHO_FIXO = ".app-shell__topbar";
const FOLGA = 8;

/**
 * Rola a página o mínimo para o menu ficar inteiro na área visível, abaixo
 * da altura REAL do cabeçalho fixo (não a nominal: no celular a barra quebra
 * e fica mais alta). Sem cabeçalho, o topo da janela.
 */
function mostrarAbaixoDoCabecalho(
  botao: HTMLElement | null,
  menu: HTMLElement | null,
) {
  if (!menu) return;
  const cabecalho = document.querySelector(CABECALHO_FIXO);
  const limite =
    (cabecalho ? cabecalho.getBoundingClientRect().bottom : 0) + FOLGA;
  const caixa = menu.getBoundingClientRect();
  // Sem caixa desenhada (sem layout), não há o que mostrar: nada rola.
  if (caixa.height === 0) return;
  // O botão também fica à vista: é para ele que o foco volta.
  const topo = Math.min(
    caixa.top,
    botao ? botao.getBoundingClientRect().top : caixa.top,
  );
  if (topo < limite) {
    window.scrollBy({ top: topo - limite });
  } else if (caixa.bottom > window.innerHeight - FOLGA) {
    window.scrollBy({
      top: Math.min(caixa.bottom - window.innerHeight + FOLGA, topo - limite),
    });
  }
}

export function MenuDeAcoes({
  assunto,
  acoes,
}: {
  /** "Quadro de colaboradores" → botão "Ações: Quadro de colaboradores". */
  readonly assunto: string;
  readonly acoes: readonly AcaoDoMenu[];
}) {
  const prefixo = useId();
  const idDoMenu = `${prefixo}-menu`;
  const [aberto, setAberto] = useState(false);
  const raizRef = useRef<HTMLDivElement | null>(null);
  const botaoRef = useRef<HTMLButtonElement | null>(null);
  const itensRef = useRef<(HTMLButtonElement | null)[]>([]);
  const focoAoAbrir = useRef<"primeira" | "ultima">("primeira");

  useEffect(() => {
    if (!aberto) return undefined;
    const alvo =
      focoAoAbrir.current === "ultima"
        ? itensRef.current[acoes.length - 1]
        : itensRef.current[0];
    // A rolagem é a de baixo (que respeita o cabeçalho fixo), não a do foco.
    alvo?.focus({ preventScroll: true });
    mostrarAbaixoDoCabecalho(
      botaoRef.current,
      document.getElementById(idDoMenu),
    );
    function aoPressionarFora(evento: Event) {
      const alvoDoClique = evento.target;
      if (
        alvoDoClique instanceof Node &&
        raizRef.current?.contains(alvoDoClique)
      ) {
        return;
      }
      setAberto(false);
    }
    document.addEventListener("pointerdown", aoPressionarFora);
    document.addEventListener("mousedown", aoPressionarFora);
    return () => {
      document.removeEventListener("pointerdown", aoPressionarFora);
      document.removeEventListener("mousedown", aoPressionarFora);
    };
    // `acoes.length` só muda com o menu fechado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, idDoMenu]);

  function abrir(onde: "primeira" | "ultima") {
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
      abrir("primeira");
    } else if (evento.key === "ArrowUp") {
      evento.preventDefault();
      abrir("ultima");
    }
  }

  function aoTeclarNoMenu(evento: KeyboardEvent<HTMLDivElement>) {
    const total = acoes.length;
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
      className="dashboard__acoes-do-bloco dashboard__sem-impressao"
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
        className="dashboard__botao-acoes"
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-controls={aberto ? idDoMenu : undefined}
        onClick={() => (aberto ? setAberto(false) : abrir("primeira"))}
        onKeyDown={aoTeclarNoBotao}
      >
        <svg
          aria-hidden="true"
          focusable="false"
          width="18"
          height="18"
          viewBox="0 0 18 18"
        >
          <circle cx="3.5" cy="9" r="1.6" />
          <circle cx="9" cy="9" r="1.6" />
          <circle cx="14.5" cy="9" r="1.6" />
        </svg>
        <span className="dashboard__so-leitor">Ações: {assunto}</span>
      </button>
      {aberto ? (
        <div
          id={idDoMenu}
          role="menu"
          aria-label={`Ações: ${assunto}`}
          className="dashboard__menu"
          onKeyDown={aoTeclarNoMenu}
        >
          {acoes.map((acao, i) => (
            <button
              key={acao.id}
              ref={(no) => {
                itensRef.current[i] = no;
              }}
              type="button"
              role="menuitem"
              tabIndex={-1}
              className="dashboard__menu-item"
              aria-labelledby={`${prefixo}-${acao.id}-rotulo`}
              aria-describedby={`${prefixo}-${acao.id}-descricao`}
              onClick={() => {
                fecharDevolvendoFoco();
                acao.aoEscolher();
              }}
            >
              <span
                id={`${prefixo}-${acao.id}-rotulo`}
                className="dashboard__menu-rotulo"
              >
                {acao.rotulo}
              </span>
              <span
                id={`${prefixo}-${acao.id}-descricao`}
                className="dashboard__menu-descricao"
              >
                {acao.descricao}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
