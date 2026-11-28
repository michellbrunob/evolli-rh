/**
 * T216 — a descrição de um modelo da galeria: o card (ícone, tom, selo,
 * fatos), a gaveta "Ver perguntas" (seções com as perguntas), o assistente
 * (nome sugerido, boas-vindas, limite, pergunta padrão, metodologia fixa) e
 * a página "Sobre o modelo". Cada modelo mora em `modelos/<id>/catalogo.ts`
 * e entra na galeria pelo registro `modelos/indice.ts`.
 */
import type { ComponentType } from "react";
import type {
  ConfigPergunta,
  FatorDisc,
  ModeloPesquisa,
  Pergunta,
  TipoPergunta,
} from "../../../api/pesquisasClient";

/** As categorias da galeria (chips e seções). */
export type CategoriaDoModelo = "clima" | "saude" | "desempenho" | "outros";

/** As categorias da página da Personalizada. */
export type CategoriaPersonalizada =
  "integracao" | "desempenho" | "satisfacao" | "saida";

/** O par fundo/tinta do ícone (tokens `--modelo-<tom>` e `-fundo`). */
export type TomDoModelo =
  | "rosa"
  | "coral"
  | "azul"
  | "teal"
  | "verde"
  | "roxo"
  | "laranja"
  | "esmeralda"
  | "celeste"
  | "ambar"
  | "cinza";

/** O desenho do modelo (ícone Bulk do sistema). */
export type IconeDoModeloId =
  | "pulso"
  | "pulso_clima"
  | "clima"
  | "enps"
  | "onboarding"
  | "motivacao"
  | "riscos"
  | "saude_financeira"
  | "avaliacao90"
  | "avaliacao180"
  | "perfil"
  | "personalizada"
  | "maleta";

/** O ícone de um fato do card. */
export type IconeDoFato =
  | "perguntas"
  | "escala"
  | "dimensoes"
  | "competencias"
  | "automatico"
  | "duas_pessoas"
  | "perfis"
  | "personalizada"
  | "tempo";

export type SeloDoModelo = "novo" | "nr1" | "complementa_nr1";

export interface FatoDoModelo {
  readonly icone: IconeDoFato;
  readonly texto: string;
}

export interface PerguntaDoModelo {
  /** Liga a condição de outra pergunta a esta (dentro do modelo). */
  readonly ref?: string;
  /** O item do modelo gravado na pesquisa (`Pergunta.chave`). */
  readonly chave?: string;
  readonly tipo: TipoPergunta;
  readonly texto: string;
  /** Rótulo curto para as tabelas de análise (até 40). */
  readonly rotulo?: string;
  readonly descricao?: string;
  readonly obrigatoria?: boolean;
  /**
   * Opções por texto (os ids nascem no uso); nos blocos do DISC, com o
   * fator de cada frase.
   */
  readonly opcoes?: readonly (
    string | { readonly texto: string; readonly fator: FatorDisc }
  )[];
  readonly config?: Omit<ConfigPergunta, "opcoes">;
  /** Só aparece para quem marcou a opção (índice, ou "sim"/"nao"). */
  readonly condicao?: {
    readonly ref: string;
    readonly opcao: number | "sim" | "nao";
  };
  /** Selo extra na lista do assistente ("Invertida"). */
  readonly selo?: string;
}

export interface SecaoDoModelo {
  readonly titulo: string | null;
  readonly descricao?: string;
  /** Token da bolinha do grupo na gaveta e no assistente. */
  readonly cor?: string;
  readonly perguntas: readonly PerguntaDoModelo[];
}

/** A pergunta que "Adicionar pergunta" cria no assistente do modelo. */
export interface PerguntaPadrao {
  readonly tipo: TipoPergunta;
  readonly config: Omit<ConfigPergunta, "opcoes">;
}

/** Um grupo da gaveta quando as perguntas ainda não estão no catálogo. */
export interface GrupoResumido {
  readonly titulo: string;
  readonly cor?: string;
  readonly quantidade: number;
}

// ---- Página "Sobre o modelo" -----------------------------------------------

export interface ItemComTitulo {
  readonly titulo: string;
  readonly texto: string;
}

/** A prévia ilustrativa do resultado (dados de exemplo). */
export interface ExemploDoResultado {
  /** "Exemplo · 31 respostas". */
  readonly cabecalho: string;
  readonly destaque?: {
    readonly valor: string;
    readonly sufixo?: string;
    readonly texto: string;
    /** Token da cor do número. */
    readonly cor?: string;
  };
  readonly barras?: readonly {
    readonly rotulo: string;
    readonly valor: number;
    readonly maximo: number;
    readonly texto?: string;
    readonly cor?: string;
  }[];
  readonly cartoes?: readonly {
    readonly titulo: string;
    readonly valor: string;
    readonly texto?: string;
    readonly cor?: string;
  }[];
  /** Duas notas lado a lado por linha (gestor × autoavaliação). */
  readonly halteres?: readonly {
    readonly rotulo: string;
    readonly a: number;
    readonly b: number;
  }[];
  readonly tabela?: {
    readonly colunas: readonly string[];
    readonly linhas: readonly (readonly string[])[];
  };
  readonly rodape?: string;
}

export type BlocoDoSobre =
  | {
      readonly tipo: "grupos";
      readonly titulo: string;
      readonly descricao?: string;
      readonly legenda?: readonly {
        readonly texto: string;
        readonly cor: string;
      }[];
      readonly itens: readonly {
        readonly titulo: string;
        readonly subtitulo?: string;
        readonly numero?: string;
        readonly quantidade?: string;
        readonly cor?: string;
        readonly selo?: string;
        readonly chips?: readonly {
          readonly texto: string;
          readonly cor?: string;
        }[];
      }[];
    }
  | {
      readonly tipo: "passos";
      readonly titulo: string;
      readonly descricao?: string;
      readonly itens: readonly {
        readonly rotulo: string;
        readonly titulo: string;
        readonly texto: string;
      }[];
    }
  | {
      readonly tipo: "tabela";
      readonly titulo: string;
      readonly descricao?: string;
      readonly colunas: readonly string[];
      readonly linhas: readonly (readonly string[])[];
      readonly rodape?: string;
    }
  | {
      readonly tipo: "texto";
      readonly titulo: string;
      readonly paragrafos: readonly string[];
    }
  | {
      /** Um desenho próprio do modelo (cartões, réguas, fórmula). */
      readonly tipo: "componente";
      readonly titulo: string;
      readonly Componente: ComponentType;
    };

export interface PaginaSobre {
  /**
   * "perguntas": a página das perguntas agrupadas pelo jeito de responder,
   * com "Como a pessoa responde" e "O que o RH vê" (Pulso); usa daqui o
   * título, o selo, o texto, os botões e os números.
   */
  readonly layout?: "perguntas";
  /** "Pulso e Clima · Leitura completa do clima". */
  readonly titulo: string;
  /** Selo cinza ao lado do título ("24 perguntas"). */
  readonly selo?: string;
  readonly texto: string;
  readonly metadados: readonly string[];
  /** "Ver as 24 perguntas". */
  readonly botaoVer: string;
  /** "Criar pesquisa" / "Criar avaliação". */
  readonly botaoCriar: string;
  readonly numeros?: readonly {
    readonly valor: string;
    readonly rotulo: string;
  }[];
  readonly recebe?: {
    readonly titulo: string;
    readonly itens: readonly ItemComTitulo[];
    readonly exemplo: ExemploDoResultado;
  };
  readonly conteudo: readonly BlocoDoSobre[];
  readonly ficha?: readonly (readonly [string, string])[];
  readonly escalas?: readonly ItemComTitulo[];
  readonly regua?: {
    readonly titulo: string;
    readonly descricao?: string;
    readonly faixas: readonly {
      readonly rotulo: string;
      readonly intervalo: string;
      readonly texto?: string;
      readonly cor: string;
    }[];
  };
  readonly uso?: string;
}

export interface ModeloDaGaleria {
  /** Identificador do card (único na galeria). */
  readonly id: string;
  /** Modelo gravado na pesquisa (`personalizada` nos pontos de partida). */
  readonly modelo: ModeloPesquisa;
  readonly nome: string;
  readonly categoria: CategoriaDoModelo | CategoriaPersonalizada | null;
  readonly descricao: string;
  readonly icone: IconeDoModeloId;
  readonly tom: TomDoModelo;
  readonly selo?: SeloDoModelo;
  /** O modelo do primeiro passo da página inicial (selo "Recomendado"). */
  readonly recomendado?: boolean;
  /** Os fatos do card (ícone + texto). */
  readonly fatos: readonly FatoDoModelo[];
  /** Personalizada: quem responde ("Cada pessoa responde"). */
  readonly formato?: string;
  /** Personalizada: o tempo de resposta do modelo pronto, em minutos. */
  readonly minutos?: number;
  /** O que se mede, em uma frase. */
  readonly sobre: string;
  /** Selo curto da página "Sobre o modelo" (página genérica). */
  readonly ritmo: string;
  /** Frequência sugerida ("Mensal", "Uma vez"). */
  readonly frequencia: string;
  /** Nome-base da pesquisa ("Pulso" → "Pulso – Novembro 2026"). */
  readonly nomeBase: string;
  readonly boasVindas: string | null;
  readonly secoes: readonly SecaoDoModelo[];
  /** Comentário final opcional (sempre por último, fora das médias). */
  readonly comentarioFinal: string | null;
  /** O tipo do comentário final (padrão: parágrafo). */
  readonly tipoDoComentario?: "paragrafo" | "texto_curto";
  readonly perguntaPadrao: PerguntaPadrao;
  /** Teto de perguntas do assistente do modelo (sem o comentário). */
  readonly limite: number;
  /** Mínimo de perguntas do assistente (padrão 1). */
  readonly minimo?: number;
  /** Metodologia fixa: o assistente mostra as perguntas sem editar. */
  readonly fixo?: boolean;
  /** Escala explicada no assistente (modelos fixos). */
  readonly legendaDaEscala?: readonly string[];
  /**
   * Os grupos da gaveta quando as perguntas são definidas por outra frente
   * (o catálogo ainda sem as perguntas).
   */
  readonly grupos?: readonly GrupoResumido[];
  /**
   * Agrupa as perguntas por chave na gaveta e no assistente quando a ordem
   * de resposta mistura os grupos (os pilares da TAD).
   */
  readonly agrupamento?: readonly {
    readonly titulo: string;
    readonly cor: string;
    readonly chaves: readonly string[];
  }[];
  /**
   * Itens fixos (pela `chave`): ficam sem "Excluir" e sem arrastar no
   * assistente (a principal do eNPS).
   */
  readonly chavesFixas?: readonly string[];
  /**
   * Os tipos que "Adicionar pergunta" oferece (padrão: só a
   * `perguntaPadrao`).
   */
  readonly tiposParaAdicionar?: readonly {
    readonly rotulo: string;
    readonly pergunta: PerguntaPadrao;
  }[];
  /** O resumo das perguntas na etapa Enviar (padrão: "N · tipos"). */
  readonly resumoDasPerguntas?: (perguntas: readonly Pergunta[]) => string;
  /** O nome sugerido da pesquisa (padrão: "<nomeBase> – <Mês> <ano>"). */
  readonly nomeDaPesquisa?: (hoje: string) => string;
  readonly pagina?: PaginaSobre;
}
