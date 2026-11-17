/**
 * T209 — a trilha é uma só, na barra superior. Quando a página tem um nível
 * a mais que a rota não descreve (a ficha: o nome da pessoa), ela o DECLARA
 * aqui; a barra o acrescenta ao fim e torna o nível anterior um botão de
 * volta (`onVoltar`, que passa pela guarda da própria página).
 */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export interface ComplementoDaTrilha {
  /** O último nível (atual). */
  readonly rotulo: string;
  /** Voltar ao nível anterior (o pai na trilha). */
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
 * Declara o último nível da trilha enquanto a página está montada. Sem
 * provedor (tela montada sozinha), não faz nada.
 */
export function useTrilhaComplementar(
  rotulo: string | null,
  onVoltar: () => void,
): void {
  const contexto = useContext(TrilhaComplementarContext);
  const definir = contexto?.definir;
  // O `onVoltar` muda a cada desenho; a referência vai num efeito à parte.
  const [voltar] = useState(() => ({ atual: onVoltar }));
  voltar.atual = onVoltar;
  useEffect(() => {
    if (!definir) return;
    if (rotulo === null) {
      definir(null);
      return;
    }
    definir({ rotulo, onVoltar: () => voltar.atual() });
    return () => definir(null);
  }, [definir, rotulo, voltar]);
}
