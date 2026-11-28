/**
 * T215 — lista de escolha própria do Evolli (decisão da proprietária de
 * 2026-11-26: as listas abrem como na referência, com a aparência do Evolli).
 *
 * Combobox só de seleção do WAI-ARIA: o foco fica no botão
 * (`role="combobox"`) e a opção ativa é dita por `aria-activedescendant`.
 *
 * - Clique, Enter, Espaço ou seta para baixo abrem na escolhida (ou na
 *   primeira); seta para cima abre na escolhida (ou na última).
 * - Aberta: setas sem volta nas pontas, Home, End, Enter ou Espaço escolhem;
 *   Esc fecha sem escolher e não chega a quem está em volta; Tab e clique
 *   fora fecham sem escolher.
 * - Letras buscam pelo começo do nome, sem acento e sem caixa.
 * - Um valor gravado fora das opções (dado antigo) aparece como está.
 *
 * O rótulo vem de fora: `<label htmlFor={id}>` ou `aria-label`.
 */
import {
  type KeyboardEvent,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { cn } from "./cn";
import { IconeAbrir } from "./icones";
import "./ListaDeEscolha.css";

export interface OpcaoDaLista {
  readonly valor: string;
  readonly rotulo: string;
  /** Segunda linha, menor (ex.: o resumo da escala). */
  readonly descricao?: string;
}

export interface ListaDeEscolhaProps {
  readonly opcoes: readonly OpcaoDaLista[];
  readonly valor: string;
  readonly onMudar: (valor: string) => void;
  /** Texto mostrado sem escolha (ex.: "Selecione", "UF"). */
  readonly vazio?: string;
  readonly id?: string;
  readonly className?: string;
  readonly disabled?: boolean;
  readonly "aria-label"?: string;
  readonly "aria-labelledby"?: string;
  readonly "aria-describedby"?: string;
  readonly "aria-invalid"?: boolean | "true" | "false";
  /**
   * T216 — "abaixo": abre sempre embaixo do campo (a página rola), como nos
   * filtros dos resultados. Padrão "auto": acima quando falta espaço embaixo.
   */
  readonly direcao?: "auto" | "abaixo";
}

/** Espaço mínimo embaixo do campo para abrir para baixo. */
const ALTURA_DA_LISTA = 264;
const PAUSA_DA_BUSCA = 600;

const semAcento = (texto: string) =>
  texto.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("pt-BR");

export function ListaDeEscolha({
  opcoes,
  valor,
  onMudar,
  vazio = "Selecione",
  id,
  className,
  disabled = false,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledby,
  "aria-describedby": ariaDescribedby,
  "aria-invalid": ariaInvalid,
  direcao = "auto",
}: ListaDeEscolhaProps) {
  const prefixo = useId();
  const idDaLista = `${prefixo}-lista`;
  const idDaOpcao = (i: number) => `${prefixo}-opcao-${i}`;
  const raiz = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const [aberta, setAberta] = useState(false);
  const [ativa, setAtiva] = useState(-1);
  const [acima, setAcima] = useState(false);
  const busca = useRef({ texto: "", ate: 0 });

  const indiceEscolhido = opcoes.findIndex((o) => o.valor === valor);
  const escolhida = indiceEscolhido >= 0 ? opcoes[indiceEscolhido] : null;
  const rotulo = escolhida?.rotulo ?? (valor !== "" ? valor : null);

  function abrir(indice: number) {
    if (disabled || opcoes.length === 0) return;
    const caixa = botao.current?.getBoundingClientRect();
    if (direcao === "abaixo") {
      setAcima(false);
    } else if (caixa && typeof window !== "undefined") {
      const embaixo = window.innerHeight - caixa.bottom;
      setAcima(embaixo < ALTURA_DA_LISTA && caixa.top > embaixo);
    }
    setAtiva(Math.min(Math.max(indice, 0), opcoes.length - 1));
    setAberta(true);
  }

  function fechar() {
    setAberta(false);
    setAtiva(-1);
  }

  function escolher(indice: number) {
    const opcao = opcoes[indice];
    fechar();
    botao.current?.focus();
    if (opcao && opcao.valor !== valor) onMudar(opcao.valor);
  }

  // Clique fora fecha sem escolher.
  useEffect(() => {
    if (!aberta) return;
    function aoApertar(e: PointerEvent | MouseEvent) {
      if (!raiz.current?.contains(e.target as Node)) fechar();
    }
    document.addEventListener("pointerdown", aoApertar);
    document.addEventListener("mousedown", aoApertar);
    return () => {
      document.removeEventListener("pointerdown", aoApertar);
      document.removeEventListener("mousedown", aoApertar);
    };
  }, [aberta]);

  // A opção ativa sempre à vista dentro da lista.
  useLayoutEffect(() => {
    if (!aberta || ativa < 0) return;
    const el = document.getElementById(idDaOpcao(ativa));
    if (el && typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ block: "nearest" });
    }
    // idDaOpcao é estável pelo prefixo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberta, ativa]);

  function buscar(letra: string): number {
    const agora = Date.now();
    const b = busca.current;
    b.texto = agora < b.ate ? b.texto + letra : letra;
    b.ate = agora + PAUSA_DA_BUSCA;
    const procurado = semAcento(b.texto);
    const inicio = aberta ? ativa : indiceEscolhido;
    // Mesma letra repetida avança entre as que começam com ela.
    const repetida =
      procurado.length > 1 && [...procurado].every((c) => c === procurado[0]);
    const alvo = repetida ? procurado[0]! : procurado;
    const partida = repetida || procurado.length === 1 ? inicio + 1 : inicio;
    for (let k = 0; k < opcoes.length; k += 1) {
      const i = (Math.max(partida, 0) + k) % opcoes.length;
      if (semAcento(opcoes[i]!.rotulo).startsWith(alvo)) return i;
    }
    return -1;
  }

  function aoTeclar(e: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    const ultima = opcoes.length - 1;
    if (!aberta) {
      switch (e.key) {
        case "ArrowDown":
        case "Enter":
        case " ":
          e.preventDefault();
          abrir(indiceEscolhido >= 0 ? indiceEscolhido : 0);
          return;
        case "ArrowUp":
          e.preventDefault();
          abrir(indiceEscolhido >= 0 ? indiceEscolhido : ultima);
          return;
        case "Home":
          e.preventDefault();
          abrir(0);
          return;
        case "End":
          e.preventDefault();
          abrir(ultima);
          return;
        default:
          if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            const achada = buscar(e.key);
            if (achada >= 0) abrir(achada);
          }
          return;
      }
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setAtiva((a) => Math.min(a + 1, ultima));
        return;
      case "ArrowUp":
        e.preventDefault();
        setAtiva((a) => Math.max(a - 1, 0));
        return;
      case "Home":
      case "PageUp":
        e.preventDefault();
        setAtiva(0);
        return;
      case "End":
      case "PageDown":
        e.preventDefault();
        setAtiva(ultima);
        return;
      case "Enter":
      case " ":
        e.preventDefault();
        if (ativa >= 0) escolher(ativa);
        return;
      case "Escape":
        e.preventDefault();
        e.stopPropagation();
        fechar();
        return;
      case "Tab":
        fechar();
        return;
      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          const achada = buscar(e.key);
          if (achada >= 0) setAtiva(achada);
        }
    }
  }

  return (
    <div
      ref={raiz}
      className={cn("lista-escolha", className)}
      data-aberta={aberta ? "true" : undefined}
    >
      <button
        ref={botao}
        type="button"
        id={id}
        role="combobox"
        className="lista-escolha__campo"
        aria-haspopup="listbox"
        aria-expanded={aberta}
        aria-controls={idDaLista}
        {...(aberta && ativa >= 0
          ? { "aria-activedescendant": idDaOpcao(ativa) }
          : {})}
        {...(ariaLabel ? { "aria-label": ariaLabel } : {})}
        {...(ariaLabelledby ? { "aria-labelledby": ariaLabelledby } : {})}
        {...(ariaDescribedby ? { "aria-describedby": ariaDescribedby } : {})}
        {...(ariaInvalid === true || ariaInvalid === "true"
          ? { "aria-invalid": true }
          : {})}
        disabled={disabled}
        onClick={() => {
          if (aberta) fechar();
          else abrir(indiceEscolhido >= 0 ? indiceEscolhido : 0);
        }}
        onKeyDown={aoTeclar}
      >
        <span
          className={cn(
            "lista-escolha__valor",
            rotulo === null && "lista-escolha__valor--vazio",
          )}
        >
          {rotulo ?? vazio}
        </span>
        <IconeAbrir tamanho={16} className="lista-escolha__seta" />
      </button>
      {aberta ? (
        <ul
          id={idDaLista}
          role="listbox"
          className={cn(
            "lista-escolha__lista",
            acima && "lista-escolha__lista--acima",
          )}
          {...(ariaLabel ? { "aria-label": ariaLabel } : {})}
          {...(!ariaLabel && id
            ? { "aria-labelledby": ariaLabelledby ?? id }
            : {})}
        >
          {opcoes.map((o, i) => (
            <li
              key={o.valor}
              id={idDaOpcao(i)}
              role="option"
              aria-selected={o.valor === valor}
              className={cn(
                "lista-escolha__opcao",
                i === ativa && "lista-escolha__opcao--ativa",
              )}
              // O foco fica no campo; o clique só escolhe.
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setAtiva(i)}
              onClick={() => escolher(i)}
            >
              <span className="lista-escolha__opcao-textos">
                <span className="lista-escolha__opcao-rotulo">{o.rotulo}</span>
                {o.descricao ? (
                  <span className="lista-escolha__opcao-descricao">
                    {o.descricao}
                  </span>
                ) : null}
              </span>
              {o.valor === valor ? (
                <svg
                  className="lista-escolha__visto"
                  viewBox="0 0 16 16"
                  width="14"
                  height="14"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path
                    d="M3 8.5l3.2 3L13 4.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
