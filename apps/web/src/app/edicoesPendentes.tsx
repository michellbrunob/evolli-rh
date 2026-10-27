/**
 * T189 — registro global e explícito de edição pendente e salvamento em
 * andamento.
 *
 * ## Por que existe
 *
 * Trocar de empresa recria a árvore inteira (T163): tudo o que estava montado
 * some, inclusive um formulário com dados digitados. Antes desta tarefa isso
 * acontecia em silêncio. Agora, quem edita **avisa** que está editando, e quem
 * troca de empresa **pergunta** antes:
 *
 * - edição pendente → a troca pede confirmação; cancelar não muda nada;
 * - salvamento em andamento → a troca fica bloqueada até ele terminar.
 *
 * ## Explícito, não adivinhado
 *
 * Nada aqui inspeciona o DOM atrás de campos preenchidos. Cada tela ou editor
 * declara o próprio estado com `useEdicaoEmAndamento` — e só ele sabe se o
 * que está na tela difere do gravado. Esquecer de declarar é visível na
 * revisão; adivinhar seria errado em silêncio.
 *
 * ## Fora de um provedor
 *
 * Telas montadas sozinhas (os testes de cada uma) não têm provedor: o registro
 * vira no-op e o resumo é vazio. O comportamento delas não muda.
 *
 * Nada é guardado fora da memória: sem `localStorage`, sem `sessionStorage`.
 */
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useState,
  useSyncExternalStore,
} from "react";
import type { ReactNode } from "react";

export interface ResumoDasEdicoes {
  /** Rótulos das edições com alteração não salva, sem repetição. */
  readonly pendentes: readonly string[];
  /** Rótulos dos salvamentos em andamento, sem repetição. */
  readonly salvando: readonly string[];
}

interface EstadoDaEdicao {
  readonly rotulo: string;
  readonly pendente: boolean;
  readonly salvando: boolean;
}

const RESUMO_VAZIO: ResumoDasEdicoes = { pendentes: [], salvando: [] };

function unicos(rotulos: string[]): string[] {
  return [...new Set(rotulos)];
}

/**
 * O registro. Uma instância por sessão de interface — criada pelo
 * `AutenticacaoApp`, que também o consulta ao saber que a empresa mudou em
 * outra aba.
 */
export class RegistroDeEdicoes {
  private readonly entradas = new Map<string, EstadoDaEdicao>();
  private readonly ouvintes = new Set<() => void>();
  private resumo: ResumoDasEdicoes = RESUMO_VAZIO;

  definir(id: string, estado: EstadoDaEdicao | null): void {
    if (estado === null || (!estado.pendente && !estado.salvando)) {
      if (!this.entradas.delete(id)) return;
    } else {
      this.entradas.set(id, estado);
    }
    const valores = [...this.entradas.values()];
    this.resumo =
      valores.length === 0
        ? RESUMO_VAZIO
        : {
            pendentes: unicos(
              valores.filter((v) => v.pendente).map((v) => v.rotulo),
            ),
            salvando: unicos(
              valores.filter((v) => v.salvando).map((v) => v.rotulo),
            ),
          };
    for (const ouvinte of this.ouvintes) ouvinte();
  }

  /** Estado atual. Mesma referência enquanto nada muda. */
  obter = (): ResumoDasEdicoes => this.resumo;

  assinar = (ouvinte: () => void): (() => void) => {
    this.ouvintes.add(ouvinte);
    return () => {
      this.ouvintes.delete(ouvinte);
    };
  };
}

const RegistroContext = createContext<RegistroDeEdicoes | null>(null);

export function ProvedorDeEdicoes({
  registro,
  children,
}: {
  readonly registro: RegistroDeEdicoes;
  readonly children: ReactNode;
}) {
  return (
    <RegistroContext.Provider value={registro}>
      {children}
    </RegistroContext.Provider>
  );
}

/**
 * Declara o estado de uma edição. `rotulo` diz onde ela está, nas palavras da
 * tela ("Dados pessoais", "Registrar movimentação") — é o que a confirmação
 * mostra. Sai do registro ao desmontar.
 */
export function useEdicaoEmAndamento(
  rotulo: string,
  estado: { readonly pendente: boolean; readonly salvando: boolean },
): void {
  const registro = useContext(RegistroContext);
  const id = useId();
  const { pendente, salvando } = estado;

  useEffect(() => {
    registro?.definir(id, { rotulo, pendente, salvando });
  }, [registro, id, rotulo, pendente, salvando]);

  useEffect(() => () => registro?.definir(id, null), [registro, id]);
}

const assinarNada = () => () => undefined;
const obterVazio = () => RESUMO_VAZIO;

/** O resumo, reativo: a tela que o lê redesenha quando ele muda. */
export function useResumoDasEdicoes(): ResumoDasEdicoes {
  const registro = useContext(RegistroContext);
  return useSyncExternalStore(
    registro?.assinar ?? assinarNada,
    registro?.obter ?? obterVazio,
  );
}

/** Cria o registro uma vez por montagem de quem o possui. */
export function useRegistroDeEdicoes(): RegistroDeEdicoes {
  const [registro] = useState(() => new RegistroDeEdicoes());
  return registro;
}
