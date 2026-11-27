/**
 * T216 — o resultado próprio dos modelos com cálculo (espelho de
 * `apps/api/src/pesquisas/modelos/tipos.ts`): `ResultadosPesquisa.modelo`
 * (agregado) e `RespostaDetalhe.modelo` (a pessoa).
 */

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

export interface ResultadoClima {
  modelo: "clima";
  /** % favorável (4–5) sobre todas as respostas das 60 afirmações. */
  favoravel: number | null;
  neutro: number | null;
  desfavoravel: number | null;
  /** Média dos scores das afirmações (0–100, inteiro). */
  score: number | null;
  /** A faixa do % favorável. */
  faixa: FaixaDeScore | null;
  dimensoes: DimensaoDoModelo[];
  afirmacoes: AfirmacaoDoModelo[];
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
  ResultadoPulsoClima | ResultadoClima | ResultadoTad;

export type ResultadoIndividualDoModelo = ResultadoIndividualTad;
