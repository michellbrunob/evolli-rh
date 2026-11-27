/**
 * T216 — Perfil comportamental (DISC): a definição do modelo na API.
 *
 * O questionário tem 28 blocos de escolha forçada (`escolha_forcada`): cada
 * bloco traz 4 frases, uma ligada a cada fator, e a pessoa marca a que mais
 * combina com ela. Os textos das frases são do catálogo da tela (a empresa
 * pode trocá-los); aqui ficam só as regras: fatores, quantidade de blocos,
 * limiares da classificação, as 13 áreas do mapa de talentos e a relação
 * entre os fatores na compatibilidade do time.
 */

export const FATORES = ["D", "I", "S", "C"] as const;
export type Fator = (typeof FATORES)[number];

/** O tipo de pergunta dos blocos (só existe no modelo `disc`). */
export const TIPO_DO_BLOCO = "escolha_forcada" as const;

export const NUMERO_DE_BLOCOS = 28;
export const FRASES_POR_BLOCO = 4;

/** Limiares da classificação do perfil (sobre os percentuais ordenados). */
export const LIMIARES = {
  /** Mono: o 1º com pelo menos 45% e 15 pontos à frente do 2º. */
  monoMinimo: 45,
  monoDistancia: 15,
  /** Intensidade do mono: puro a partir de 60%, acentuado a partir de 50%. */
  puro: 60,
  acentuado: 50,
  /** Bi: 1º e 2º a menos de 15 pontos e o 2º 10 pontos à frente do 3º. */
  biDistancia: 15,
  biSeparacao: 10,
  /** Bi acentuado: o 1º com pelo menos 40%. */
  biAcentuado: 40,
  /** Tri: 1º e 3º a menos de 20 pontos. */
  triDistancia: 20,
  /** Lacuna do time: fator predominante em menos de 20% das pessoas. */
  lacuna: 20,
  /** Lacunas mostradas (do fator menos presente para o mais). */
  lacunasNoMaximo: 2,
} as const;

/** Uma área do mapa de talentos: retângulo no plano 0–100. */
export interface AreaDoMapa {
  readonly id: number;
  readonly nome: string;
  /** O fator do quadrante (a cor da área). */
  readonly fator: Fator;
  /** [início, fim) no eixo x (0 = extroversão, 100 = introversão). */
  readonly x: readonly [number, number];
  /** [início, fim) no eixo y (0 = emoção, 100 = razão). */
  readonly y: readonly [number, number];
}

/**
 * As 13 áreas, na ordem de leitura do mapa (de cima para baixo, da esquerda
 * para a direita). Juntas cobrem o quadrado inteiro, sem sobreposição.
 */
export const AREAS_DO_MAPA: readonly AreaDoMapa[] = [
  { id: 4, nome: "Catalisador", fator: "I", x: [0, 33], y: [0, 33] },
  { id: 7, nome: "Inspirador", fator: "I", x: [33, 75], y: [0, 33] },
  { id: 8, nome: "Harmonizador", fator: "S", x: [75, 100], y: [0, 33] },
  { id: 3, nome: "Mobilizador", fator: "D", x: [0, 33], y: [33, 75] },
  { id: 5, nome: "Articulador", fator: "I", x: [33, 50], y: [33, 50] },
  { id: 6, nome: "Conector", fator: "I", x: [50, 67], y: [33, 50] },
  { id: 9, nome: "Facilitador", fator: "S", x: [67, 83], y: [33, 50] },
  { id: 10, nome: "Mentor", fator: "C", x: [83, 100], y: [33, 75] },
  { id: 2, nome: "Realizador", fator: "D", x: [33, 67], y: [50, 75] },
  { id: 12, nome: "Estrategista", fator: "C", x: [67, 83], y: [50, 75] },
  { id: 1, nome: "Executor", fator: "D", x: [0, 33], y: [75, 100] },
  { id: 13, nome: "Analista", fator: "D", x: [33, 75], y: [75, 100] },
  { id: 11, nome: "Guardião", fator: "C", x: [75, 100], y: [75, 100] },
];

/** Os limites do ponto no mapa (nunca colado na borda). */
export const LIMITES_DO_MAPA = { minimo: 2, maximo: 98 } as const;

export type Relacao = "sinergia" | "neutro" | "atrito";

/** A relação entre dois fatores (par em qualquer ordem). */
const RELACOES: Readonly<Record<string, Relacao>> = {
  DD: "neutro",
  DI: "sinergia",
  DS: "atrito",
  DC: "neutro",
  II: "sinergia",
  IS: "sinergia",
  IC: "atrito",
  SS: "sinergia",
  SC: "sinergia",
  CC: "neutro",
};

/** O par na ordem D, I, S, C ("SD" → "DS"). */
export function parOrdenado(a: Fator, b: Fator): [Fator, Fator] {
  return FATORES.indexOf(a) <= FATORES.indexOf(b) ? [a, b] : [b, a];
}

export function relacaoEntre(a: Fator, b: Fator): Relacao {
  const [x, y] = parOrdenado(a, b);
  return RELACOES[`${x}${y}`]!;
}

/**
 * Combinações com nome próprio (perfil bi): o 1º e o 2º fator. As demais
 * (D com C ao contrário, por exemplo) também existem; a tela usa o texto da
 * combinação.
 */
export const COMBINACOES = [
  "DI",
  "ID",
  "IS",
  "SI",
  "SC",
  "CS",
  "DC",
  "CD",
  "DS",
  "SD",
  "IC",
  "CI",
] as const;
