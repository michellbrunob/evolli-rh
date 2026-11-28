/**
 * T216 — avisos flutuantes do módulo Pesquisas ("Pesquisa pausada.",
 * "Pergunta excluída · Desfazer"…; as falhas no tom de erro). Um só aviso por vez, no canto da tela,
 * sobrevivendo à troca de tela dentro do módulo. Tela montada sozinha (sem o
 * módulo em volta) ganha o próprio provedor.
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AvisoFlutuante, type ConteudoDoAviso } from "../../ui/AvisoFlutuante";

export type Avisar = (
  titulo: string,
  extra?: {
    readonly texto?: string;
    readonly acao?: { readonly rotulo: string; readonly onClick: () => void };
    /** "erro" nas falhas ("Não foi possível…"): cor, ícone e alerta. */
    readonly tom?: "erro";
  },
) => void;

const ContextoDosAvisos = createContext<Avisar | null>(null);

export function ProvedorDeAvisos({
  children,
}: {
  readonly children: ReactNode;
}) {
  const [aviso, setAviso] = useState<ConteudoDoAviso | null>(null);
  const contador = useRef(0);
  const avisar = useCallback<Avisar>((titulo, extra) => {
    contador.current += 1;
    setAviso({
      id: contador.current,
      titulo,
      ...(extra?.texto ? { texto: extra.texto } : {}),
      ...(extra?.acao ? { acao: extra.acao } : {}),
      ...(extra?.tom ? { tom: extra.tom } : {}),
    });
  }, []);
  const valor = useMemo(() => avisar, [avisar]);
  return (
    <ContextoDosAvisos.Provider value={valor}>
      {children}
      <AvisoFlutuante aviso={aviso} onFechar={() => setAviso(null)} />
    </ContextoDosAvisos.Provider>
  );
}

/** Garante um provedor (a tela pode ser montada fora do módulo). */
export function GarantirAvisos({ children }: { readonly children: ReactNode }) {
  const existente = useContext(ContextoDosAvisos);
  return existente ? (
    <>{children}</>
  ) : (
    <ProvedorDeAvisos>{children}</ProvedorDeAvisos>
  );
}

export function useAvisar(): Avisar {
  return useContext(ContextoDosAvisos) ?? (() => undefined);
}
