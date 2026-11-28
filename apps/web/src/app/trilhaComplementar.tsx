/**
 * T209 — a trilha é uma só, na barra superior. Quando a página tem um nível
 * a mais que a rota não descreve (a ficha: o nome da pessoa), ela o DECLARA
 * aqui; a barra o acrescenta ao fim e torna o nível anterior um botão de
 * volta (`onVoltar`, que passa pela guarda da própria página).
 *
 * T216 — também vários níveis (a pesquisa › a resposta): os intermediários
 * com `onSelecionar` viram botões; o último é sempre a página atual.
 */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/** Um nível acrescentado à trilha da rota. */
export interface NivelDaTrilha {
  readonly rotulo: string;
  /** Leva a este nível (ignorado no último, a página atual). */
  readonly onSelecionar?: () => void;
}

export interface ComplementoDaTrilha {
  /** Os níveis acrescentados, do mais amplo ao atual (ao menos um). */
  readonly niveis: readonly NivelDaTrilha[];
  /** Voltar ao último nível da rota (o pai do primeiro nível). */
  readonly onVoltar: () => void;
}

interface Contexto {
  readonly complemento: ComplementoDaTrilha | null;
  readonly definir: (complemento: ComplementoDaTrilha | null) => void;
}

const TrilhaComplementarContext = createContext<Contexto | null>(null);

export function ProvedorDeTrilhaComplementar({
  children,
}: {
  readonly children: ReactNode;
}) {
  const [complemento, definir] = useState<ComplementoDaTrilha | null>(null);
  const valor = useMemo(() => ({ complemento, definir }), [complemento]);
  return (
    <TrilhaComplementarContext.Provider value={valor}>
      {children}
    </TrilhaComplementarContext.Provider>
  );
}

/** O complemento declarado agora (lido pela barra superior). */
export function useComplementoDaTrilha(): ComplementoDaTrilha | null {
  return useContext(TrilhaComplementarContext)?.complemento ?? null;
}

/**
 * Declara os níveis a mais da trilha enquanto a página está montada: um
 * texto (um nível) ou a lista de níveis. `null` limpa; `undefined` não mexe
 * (outra parte da página declara). Sem provedor, não faz nada.
 */
export function useTrilhaComplementar(
  rotulo: string | readonly NivelDaTrilha[] | null | undefined,
  onVoltar: () => void,
): void {
  const contexto = useContext(TrilhaComplementarContext);
  const definir = contexto?.definir;
  // O `onVoltar` muda a cada desenho; a referência vai num efeito à parte.
  const [voltar] = useState(() => ({ atual: onVoltar }));
  voltar.atual = onVoltar;
  // Os níveis mudam de identidade a cada desenho: a chave é o texto deles.
  const chave =
    rotulo === undefined
      ? undefined
      : rotulo === null
        ? null
        : typeof rotulo === "string"
          ? JSON.stringify([rotulo])
          : JSON.stringify(rotulo.map((n) => n.rotulo));
  const [niveis] = useState(() => ({ atual: rotulo }));
  niveis.atual = rotulo;
  useEffect(() => {
    if (!definir || chave === undefined) return;
    const lidos = niveis.atual;
    if (chave === null || lidos === null || lidos === undefined) {
      definir(null);
      return;
    }
    const lista: readonly NivelDaTrilha[] =
      typeof lidos === "string"
        ? [{ rotulo: lidos }]
        : lidos.map((n) => ({
            rotulo: n.rotulo,
            ...(n.onSelecionar
              ? { onSelecionar: () => selecionarNivel(niveis.atual, n.rotulo) }
              : {}),
          }));
    if (lista.length === 0) {
      definir(null);
      return;
    }
    definir({ niveis: lista, onVoltar: () => voltar.atual() });
    return () => definir(null);
  }, [definir, chave, voltar, niveis]);
}

/** Chama o `onSelecionar` mais recente do nível (as funções mudam). */
function selecionarNivel(
  atual: string | readonly NivelDaTrilha[] | null | undefined,
  rotulo: string,
): void {
  if (!atual || typeof atual === "string") return;
  atual.find((n) => n.rotulo === rotulo)?.onSelecionar?.();
}
