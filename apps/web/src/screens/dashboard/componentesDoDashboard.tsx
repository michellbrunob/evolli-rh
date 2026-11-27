/**
 * T207 — peças comuns do Dashboard: "Como calculamos" (V-5, sempre o botão
 * "i" ao lado do título, com a janela de leitura) e o estado de bloco ou aba sem dado no Evolli.
 */
import { StatusBadge } from "../../components";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/** T207 — como um bloco com dado real é visto: gráfico ou tabela. */
export type VistaDoBloco = "grafico" | "tabela";
/** T207 — os blocos que têm as duas vistas. */
export type BlocoComVista = "quadro" | "distribuicao" | "tempo-de-casa";

/**
 * T207 — "Como calculamos" junto do título: um botão de informação que
 * mostra um painel ao passar o ponteiro, ao receber foco ou ao ser clicado
 * (o clique o deixa aberto). Escape, clique fora e foco fora fecham. Nenhuma
 * região viva: o botão diz se está aberto (`aria-expanded`) e o painel vem
 * logo depois dele na leitura — nada é anunciado sozinho.
 *
 * O painel se posiciona pelo topo do bloco (o elemento posicionado mais
 * próximo), à esquerda e com largura limitada: nunca passa da borda.
 */
export function InfoComoCalculamos({
  assunto,
  children,
}: {
  readonly assunto: string;
  readonly children: ReactNode;
}) {
  const id = useId();
  const raizRef = useRef<HTMLDivElement | null>(null);
  const [porPonteiro, setPorPonteiro] = useState(false);
  const [porFoco, setPorFoco] = useState(false);
  const [fixo, setFixo] = useState(false);
  const aberto = porPonteiro || porFoco || fixo;

  function fechar() {
    setPorPonteiro(false);
    setPorFoco(false);
    setFixo(false);
  }

  useEffect(() => {
    if (!aberto) return undefined;
    function aoPressionarFora(evento: Event) {
      const alvo = evento.target;
      if (alvo instanceof Node && raizRef.current?.contains(alvo)) return;
      fechar();
    }
    // Escape fecha de qualquer lugar (WCAG 1.4.13), mesmo aberto só pelo
    // ponteiro e com o foco fora daqui; o foco não sai de onde está.
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === "Escape") fechar();
    }
    document.addEventListener("pointerdown", aoPressionarFora);
    document.addEventListener("mousedown", aoPressionarFora);
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("pointerdown", aoPressionarFora);
      document.removeEventListener("mousedown", aoPressionarFora);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [aberto]);

  return (
    <div
      ref={raizRef}
      className="dashboard__info dashboard__sem-impressao"
      onMouseEnter={() => setPorPonteiro(true)}
      onMouseLeave={() => setPorPonteiro(false)}
      onBlur={(evento) => {
        const destino = evento.relatedTarget;
        if (destino instanceof Node && raizRef.current?.contains(destino)) {
          return;
        }
        setPorFoco(false);
        setFixo(false);
      }}
    >
      <button
        type="button"
        className="dashboard__info-botao"
        aria-expanded={aberto}
        aria-controls={id}
        onFocus={() => setPorFoco(true)}
        onClick={() => {
          // O primeiro clique (ou Enter) fixa o painel aberto; o segundo fecha.
          if (fixo) fechar();
          else setFixo(true);
        }}
      >
        <span aria-hidden="true">i</span>
        <span className="dashboard__so-leitor">Como calculamos: {assunto}</span>
      </button>
      <div id={id} className="dashboard__info-painel" hidden={!aberto}>
        <p className="dashboard__info-titulo">Como calculamos</p>
        {children}
      </div>
    </div>
  );
}

/** Aba sem dado no Evolli: rota real, nenhum número, o porquê. */
export function EstadoIndisponivel({
  titulo,
  texto,
}: {
  readonly titulo: string;
  readonly texto: string;
}) {
  const id = useId();
  return (
    <section className="dashboard__indisponivel" aria-labelledby={id}>
      <h2 id={id} className="dashboard__subtitulo">
        {titulo}
      </h2>
      <StatusBadge>Indisponível no Evolli</StatusBadge>
      <p className="dashboard__indisponivel-texto">{texto}</p>
    </section>
  );
}

/**
 * Bloco da Visão Geral sem dado: título e subtítulo do bloco, e um quadro
 * com o estado em texto e a explicação. Nenhum número, nenhuma ação.
 */
export function BlocoSemDado({
  titulo,
  subtitulo,
  selo,
  children,
}: {
  readonly titulo: string;
  readonly subtitulo: string;
  readonly selo: string;
  readonly children: ReactNode;
}) {
  const id = useId();
  return (
    <section className="dashboard__bloco" aria-labelledby={id}>
      <div className="dashboard__bloco-topo">
        <h2 id={id} className="dashboard__subtitulo">
          {titulo}
        </h2>
        <p className="dashboard__explicacao">{subtitulo}</p>
      </div>
      <div className="dashboard__vazio-quadro">
        <StatusBadge>{selo}</StatusBadge>
        <p className="dashboard__vazio-texto">{children}</p>
      </div>
    </section>
  );
}
