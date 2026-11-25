/**
 * T215 — padrão do sistema para páginas longas de configuração (decisão da
 * proprietária de 2026-11-25): um menu lateral com as seções da página.
 *
 * - cada item tem ícone e rótulo; o da seção atual fica marcado (fundo,
 *   ícone escuro e a barra na borda esquerda, com transição curta);
 * - o clique rola, suave, até o COMEÇO da seção (logo abaixo da barra
 *   superior: o `html` desconta a barra com `scroll-padding-top`) e leva o
 *   foco ao título dela; durante a rolagem, o destaque fica no destino;
 * - rolando a página, a seção atual é a última cujo começo passou do topo;
 *   no fim da página, a última;
 * - quem pede menos movimento rola sem animação.
 *
 * Cada seção da página: um elemento com `id = \`${prefixo}-${id}\`` e um
 * título com `id = \`${prefixo}-${id}-titulo\`` e `tabIndex={-1}`.
 */
import {
  type ComponentType,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import "./PaginaComSecoes.css";

export interface SecaoDaPagina {
  readonly id: string;
  readonly rotulo: string;
  readonly Icone: ComponentType<{ tamanho?: number }>;
}

export function PaginaComSecoes({
  secoes,
  prefixo,
  rotulo,
  children,
}: {
  readonly secoes: readonly SecaoDaPagina[];
  /** Prefixo dos ids das seções (`${prefixo}-${id}`). */
  readonly prefixo: string;
  /** Nome do menu para leitores de tela. */
  readonly rotulo: string;
  readonly children: ReactNode;
}) {
  const [ativa, setAtiva] = useState(secoes[0]?.id ?? "");
  const destino = useRef<string | null>(null);

  useEffect(() => {
    const calcular = () => {
      if (destino.current) return;
      const raiz = document.scrollingElement ?? document.documentElement;
      // Sem rolagem (a página cabe na tela), a primeira seção.
      if (raiz.scrollHeight <= raiz.clientHeight) {
        setAtiva(secoes[0]?.id ?? "");
        return;
      }
      const barra =
        parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue(
            "--altura-barra-superior",
          ),
        ) || 60;
      const limite = barra + 96;
      if (raiz.scrollTop + raiz.clientHeight >= raiz.scrollHeight - 2) {
        setAtiva(secoes[secoes.length - 1]?.id ?? "");
        return;
      }
      let atual = secoes[0]?.id ?? "";
      for (const s of secoes) {
        const el = document.getElementById(`${prefixo}-${s.id}`);
        if (el && el.getBoundingClientRect().top <= limite) atual = s.id;
      }
      setAtiva(atual);
    };
    calcular();
    document.addEventListener("scroll", calcular, {
      capture: true,
      passive: true,
    });
    return () =>
      document.removeEventListener("scroll", calcular, { capture: true });
  }, [secoes, prefixo]);

  const irPara = (id: string) => {
    setAtiva(id);
    destino.current = id;
    const soltar = () => {
      destino.current = null;
    };
    document.addEventListener("scrollend", soltar, {
      once: true,
      capture: true,
    });
    window.setTimeout(soltar, 1200);
    document.getElementById(`${prefixo}-${id}`)?.scrollIntoView({
      behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "start",
    });
    document
      .getElementById(`${prefixo}-${id}-titulo`)
      ?.focus({ preventScroll: true });
  };

  return (
    <div className="pagina-secoes">
      <nav aria-label={rotulo} className="pagina-secoes__menu">
        {secoes.map(({ id, rotulo: nome, Icone }) => (
          <a
            key={id}
            href={`#${prefixo}-${id}`}
            className="pagina-secoes__item"
            aria-current={ativa === id ? "true" : undefined}
            onClick={(e) => {
              e.preventDefault();
              irPara(id);
            }}
          >
            <Icone tamanho={16} />
            {nome}
          </a>
        ))}
      </nav>
      <div className="pagina-secoes__conteudo">{children}</div>
    </div>
  );
}
