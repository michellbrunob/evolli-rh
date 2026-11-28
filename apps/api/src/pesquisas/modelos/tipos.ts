/**
 * T216 — os modelos com cálculo próprio (dimensões, pilares, níveis). Cada
 * modelo mora numa pasta (`modelos/<id>/`): a definição dos itens (chave,
 * grupo, inversão), o cálculo puro e as regras. O registro é
 * `modelos/indice.ts`; cada frente acrescenta a sua entrada lá.
 *
 * O resultado do modelo vai em `ResultadosPesquisa.modelo` (agregado) e em
 * `RespostaDetalhe.modelo` (a pessoa), discriminado por `modelo`.
 */
import type { ErroDeCampo } from "../../common/erros/recusa-por-campo";
import type { Modelo, Pergunta, Secao, TipoPergunta } from "../pesquisas.types";
import type {
  IndividualNr1DoModelo,
  ResultadoNr1DoModelo,
} from "./copsoq/calculo";
import type {
  IndividualIsfbDoModelo,
  ResultadoIsfbDoModelo,
} from "./isfb/calculo";
import type { ResultadoEnps, ResultadoIndividualEnps } from "./enps/calculo";

/** Faixas do score 0–100: < 50 · 50–69 · 70–84 · ≥ 85. */
export type FaixaDeScore = "critico" | "atencao" | "saudavel" | "forte";

/** Faixas do eNPS e do LNPS no Pulso e Clima: < 0 · 0–29 · 30–69 · ≥ 70. */
export type FaixaDeRecomendacao = "critico" | "em_ajuste" | "bom" | "excelente";

/** Uma pergunta de recomendação 0–10 (eNPS ou LNPS), com a distribuição. */
export interface RecomendacaoDoModelo {
  perguntaId: string | null;
  respostas: number;
  promotores: number;
  neutros: number;
  detratores: number;
  /** −100 a 100; `null` sem respostas. */
  indice: number | null;
  faixa: FaixaDeRecomendacao | null;
  /** As notas de 0 a 10, com zeros. */
  distribuicao: { valor: number; quantidade: number }[];
}

/** Uma afirmação de concordância (1 a 5) do modelo. */
export interface AfirmacaoDoModelo {
  chave: string;
  perguntaId: string;
  dimensao: string;
  subdimensao: string | null;
  respostas: number;
  /** Média de 1 a 5 (duas casas). */
  media: number | null;
  /** `(média − 1) ÷ 4 × 100`, inteiro. */
  score: number | null;
  /** % das respostas em 4–5, 3 e 1–2 (inteiros). */
  favoravel: number | null;
  neutro: number | null;
  desfavoravel: number | null;
}

/** Uma dimensão (ou subdimensão) do modelo. */
export interface DimensaoDoModelo {
  chave: string;
  rotulo: string;
  afirmacoes: number;
  /** Respostas somadas das afirmações da dimensão. */
  respostas: number;
  /** Média dos scores das afirmações (0–100, inteiro). */
  score: number | null;
  /** A faixa do indicador principal do modelo (score ou % favorável). */
  faixa: FaixaDeScore | null;
  favoravel: number | null;
  neutro: number | null;
  desfavoravel: number | null;
  /** Comentários escritos sobre a dimensão (só o Pulso e Clima). */
  comentarios: number;
  subdimensoes?: DimensaoDoModelo[];
}

/** O comentário de uma dimensão (ou da recomendação), para a tela agrupar. */
export interface ComentarioDoModelo {
  /** A dimensão, `lnps` ou `enps`. */
  dimensao: string;
  perguntaId: string;
  quantidade: number;
}

export interface ResultadoPulsoClima {
  modelo: "pulso_clima";
  /** Média dos scores das 22 afirmações (0–100, inteiro). */
  score: number | null;
  faixa: FaixaDeScore | null;
  favoravel: number | null;
  neutro: number | null;
  desfavoravel: number | null;
  dimensoes: DimensaoDoModelo[];
  afirmacoes: AfirmacaoDoModelo[];
  enps: RecomendacaoDoModelo;
  lnps: RecomendacaoDoModelo;
  comentarios: ComentarioDoModelo[];
}

/** Faixas do % favorável do Clima: < 50 · 50–64 · 65–79 · ≥ 80. */
export type FaixaClima = "critica" | "atencao" | "boa" | "excelente";

/** Uma dimensão (ou subdimensão) do Clima, com a faixa do % favorável. */
export interface DimensaoClima extends Omit<
  DimensaoDoModelo,
  "faixa" | "subdimensoes"
> {
  faixa: FaixaClima | null;
  subdimensoes?: DimensaoClima[];
}

export interface ResultadoClima {
  modelo: "clima";
  /** O índice: % favorável (4–5) sobre todas as respostas das afirmações. */
  favoravel: number | null;
  neutro: number | null;
  desfavoravel: number | null;
  /** Respostas das afirmações somadas (favoráveis, neutras, desfavoráveis). */
  notas: { favoraveis: number; neutras: number; desfavoraveis: number };
  /** Média dos scores das afirmações (0–100, inteiro). */
  score: number | null;
  /** A faixa do % favorável. */
  faixa: FaixaClima | null;
  dimensoes: DimensaoClima[];
  afirmacoes: AfirmacaoDoModelo[];
}

/** O índice de uma resposta na lista (aba Respostas). */
export interface ResumoDaRespostaClima {
  modelo: "clima";
  /** % favorável das afirmações respondidas pela pessoa. */
  indice: number | null;
  faixa: FaixaClima | null;
}

/** O resultado de uma resposta do Clima, comparado com o time. */
export interface ResultadoIndividualClima {
  modelo: "clima";
  indice: number | null;
  faixa: FaixaClima | null;
  favoraveis: number;
  neutras: number;
  desfavoraveis: number;
  /** O índice do time (todas as respostas visíveis); `null` sem comparação. */
  time: { indice: number | null; faixa: FaixaClima | null } | null;
  dimensoes: {
    chave: string;
    rotulo: string;
    indice: number | null;
    faixa: FaixaClima | null;
    time: number | null;
  }[];
  afirmacoes: {
    chave: string;
    perguntaId: string;
    dimensao: string;
    /** A nota da pessoa (1 a 5); `null` sem resposta. */
    nota: number | null;
    /** A média do time (duas casas) e o % favorável do time. */
    mediaTime: number | null;
    favoravelTime: number | null;
  }[];
  /** Quantas notas 1 a 5 a pessoa deu e o % do time em cada nota. */
  distribuicao: { resposta: number[]; time: number[] | null };
}

export type NivelTad = "alto" | "moderado" | "baixo";

export interface PilarTad {
  chave: string;
  rotulo: string;
  perguntas: number;
  /** De 1 a 7, duas casas. */
  score: number | null;
  nivel: NivelTad | null;
}

export interface ResultadoTad {
  modelo: "tad";
  /** Quem respondeu as afirmações (entra na média do time). */
  respondentes: number;
  /** Média dos scores gerais de cada pessoa (1 a 7, duas casas). */
  geral: number | null;
  nivel: NivelTad | null;
  /** Média dos scores de cada pessoa no pilar. */
  pilares: PilarTad[];
  /** Quantas pessoas em cada nível (pelo score geral de cada uma). */
  niveis: Record<NivelTad, number>;
}

export interface ResultadoIndividualTad {
  modelo: "tad";
  /** Média dos 3 pilares (1 a 7, duas casas). */
  geral: number | null;
  nivel: NivelTad | null;
  pilares: PilarTad[];
}

/** Acrescente aqui o resultado de cada modelo com cálculo próprio. */
export type ResultadoDoModelo =
  | ResultadoPulsoClima
  | ResultadoClima
  | ResultadoTad
  | ResultadoNr1DoModelo
  | ResultadoIsfbDoModelo
  | ResultadoEnps;

export type ResultadoIndividualDoModelo =
  | ResultadoIndividualTad
  | IndividualNr1DoModelo
  | IndividualIsfbDoModelo
  | ResultadoIndividualClima
  | ResultadoIndividualEnps;

/** O resumo de uma resposta na lista; acrescente aqui o de cada modelo. */
export type ResumoDaRespostaDoModelo = ResumoDaRespostaClima;

/**
 * O que o cálculo do modelo pode precisar além das respostas: o sigilo das
 * contagens sensíveis (fora da identificada, contagens abaixo dele somem) e
 * o mínimo por grupo da pesquisa.
 */
export interface ContextoDoModelo {
  sigilo: number | null;
  minimoPorGrupo: number;
}

/** Uma resposta já conferida, para o cálculo do modelo. */
export interface RespostaDoModelo {
  valores: ReadonlyMap<string, unknown>;
}

/**
 * Um item da estrutura fixa: a chave, o tipo e o que a configuração precisa
 * ter (o resto da pergunta — texto, rótulo, descrição — é livre).
 */
export interface ItemFixo {
  chave: string;
  tipo: TipoPergunta;
  /** Confere a configuração do item (escala, eNPS/LNPS). */
  config?: (c: Pergunta["config"]) => boolean;
  obrigatoria?: boolean;
}

export interface EstruturaFixa {
  /** Itens que precisam estar todos, uma vez cada. */
  itens: readonly ItemFixo[];
  /** Itens que podem sair (comentários), uma vez no máximo. */
  opcionais: readonly ItemFixo[];
}

/** A entrada de um modelo no registro (`modelos/indice.ts`). */
export interface ModeloRegistrado {
  modelo: Modelo;
  /** Metodologia fixa: a API confere os itens ao gravar. */
  estrutura?: EstruturaFixa;
  /**
   * Conferência própria da estrutura (no lugar de `estrutura`), para o
   * modelo que só fixa parte dos itens (o eNPS fixa a principal).
   */
  conferir?: (secoes: readonly Secao[]) => ErroDeCampo[];
  /** O resultado agregado das respostas visíveis. */
  calcular?: (
    secoes: readonly Secao[],
    respostas: readonly RespostaDoModelo[],
    contexto?: ContextoDoModelo,
  ) => ResultadoDoModelo;
  /** O resultado de uma pessoa (resultado individual). */
  individual?: (
    secoes: readonly Secao[],
    valores: ReadonlyMap<string, unknown>,
    /** As respostas do time (comparação), quando o modelo usa. */
    respostas?: readonly RespostaDoModelo[],
  ) => ResultadoIndividualDoModelo | null;
  /** O resumo de uma resposta na lista (aba Respostas). */
  resumoDaResposta?: (
    secoes: readonly Secao[],
    valores: ReadonlyMap<string, unknown>,
  ) => ResumoDaRespostaDoModelo | null;
}
