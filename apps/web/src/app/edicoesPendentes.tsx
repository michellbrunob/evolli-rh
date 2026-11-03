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
 *
 * ## Áreas (T200)
 *
 * Nem toda saída descarta a tela inteira: fechar a ficha deixa a listagem
 * montada; trocar a aba de Pessoas desmonta só o painel. Quem desmonta uma
 * parte envolve essa parte em `AreaDeEdicao`, e a guarda de navegação
 * pergunta só pelas edições daquela área (`resumir(area)`). Sem área, vale o
 * registro inteiro.
 */
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useMemo,
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
  /** T200 — as áreas que envolvem quem declarou, da mais externa à interna. */
  readonly areas?: readonly string[];
  /**
   * T200 — frase a mais que a guarda de saída mostra enquanto esta edição
   * está pendente (ex.: um envio anterior com resultado incerto).
   */
  readonly aviso?: string;
}

const RESUMO_VAZIO: ResumoDasEdicoes = { pendentes: [], salvando: [] };

function unicos(rotulos: string[]): string[] {
  return [...new Set(rotulos)];
}

function resumoDe(valores: readonly EstadoDaEdicao[]): ResumoDasEdicoes {
  if (valores.length === 0) return RESUMO_VAZIO;
  return {
    pendentes: unicos(valores.filter((v) => v.pendente).map((v) => v.rotulo)),
    salvando: unicos(valores.filter((v) => v.salvando).map((v) => v.rotulo)),
  };
}

/**
 * T200 — as partes da tela que uma saída pode desmontar sozinha. Uma saída
 * que desmonta só uma delas pergunta só pelo que está dentro dela.
 */
export const AREAS_DE_EDICAO = {
  /** A ficha do colaborador (fechar a ficha deixa a listagem montada). */
  ficha: "ficha",
  /** O painel da aba ativa de Pessoas. */
  painelPessoas: "painel-pessoas",
  /** A aba Jornada de trabalho do dashboard de Colaboradores. */
  jornadaDoDashboard: "jornada-dashboard",
  /** O painel da aba ativa de Cadastros. */
  painelCadastros: "painel-cadastros",
  /** O painel da aba ativa do Ponto. */
  painelPonto: "painel-ponto",
} as const;
export type AreaDeEdicaoId =
  (typeof AREAS_DE_EDICAO)[keyof typeof AREAS_DE_EDICAO];

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
    this.resumo = resumoDe([...this.entradas.values()]);
    for (const ouvinte of this.ouvintes) ouvinte();
  }

  /** Estado atual. Mesma referência enquanto nada muda. */
  obter = (): ResumoDasEdicoes => this.resumo;

  /**
   * T200 — o resumo só das edições dentro de `area` (sem área: o registro
   * inteiro). É o que uma saída que desmonta só essa parte descartaria. Uma
   * lista de áreas vale por todas elas juntas.
   */
  resumir = (area?: string | readonly string[]): ResumoDasEdicoes => {
    if (area === undefined) return this.resumo;
    return resumoDe(this.daArea(area));
  };

  /** T200 — os avisos das edições pendentes (na área, se dada), sem repetição. */
  avisos = (area?: string | readonly string[]): readonly string[] =>
    unicos(
      this.daArea(area)
        .filter((v) => v.pendente && v.aviso)
        .map((v) => v.aviso as string),
    );

  private daArea(area?: string | readonly string[]): EstadoDaEdicao[] {
    const valores = [...this.entradas.values()];
    if (area === undefined) return valores;
    const pedidas: readonly string[] = typeof area === "string" ? [area] : area;
    return valores.filter((v) => v.areas?.some((a) => pedidas.includes(a)));
  }

  assinar = (ouvinte: () => void): (() => void) => {
    this.ouvintes.add(ouvinte);
    return () => {
      this.ouvintes.delete(ouvinte);
    };
  };
}

const RegistroContext = createContext<RegistroDeEdicoes | null>(null);

/** T200 — o caminho de áreas de quem está dentro; vazio fora de todas. */
const AreaContext = createContext<readonly string[]>([]);

/**
 * T200 — marca uma parte da tela que uma saída pode desmontar sozinha. As
 * edições declaradas dentro dela levam a área (e as de fora, não).
 */
export function AreaDeEdicao({
  id,
  children,
}: {
  readonly id: AreaDeEdicaoId;
  readonly children: ReactNode;
}) {
  const pai = useContext(AreaContext);
  const areas = useMemo(() => [...pai, id], [pai, id]);
  return <AreaContext.Provider value={areas}>{children}</AreaContext.Provider>;
}

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
  estado: {
    readonly pendente: boolean;
    readonly salvando: boolean;
    /** T200 — frase a mais na guarda de saída enquanto houver pendência. */
    readonly aviso?: string;
  },
): void {
  const registro = useContext(RegistroContext);
  const areas = useContext(AreaContext);
  const id = useId();
  const { pendente, salvando, aviso } = estado;

  useEffect(() => {
    registro?.definir(id, {
      rotulo,
      pendente,
      salvando,
      areas,
      ...(aviso ? { aviso } : {}),
    });
  }, [registro, id, rotulo, pendente, salvando, areas, aviso]);

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

/** T200 — o registro do provedor mais próximo (`null` fora de um). */
export function useRegistroDoContexto(): RegistroDeEdicoes | null {
  return useContext(RegistroContext);
}

/** Cria o registro uma vez por montagem de quem o possui. */
export function useRegistroDeEdicoes(): RegistroDeEdicoes {
  const [registro] = useState(() => new RegistroDeEdicoes());
  return registro;
}
