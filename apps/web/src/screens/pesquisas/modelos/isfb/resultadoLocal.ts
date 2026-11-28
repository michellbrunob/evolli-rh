/**
 * T216 — Saúde financeira: o resultado que a própria pessoa vê logo depois
 * de enviar (página pública), calculado no navegador com a mesma regra da
 * API (`apps/api/.../modelos/isfb/calculo.ts`): a soma dos pontos (0 a 4)
 * de cada dimensão, a base financeira (produtos + renda + escolaridade; base
 * baixa até 6) escolhendo a coluna da tabela de conversão, e a faixa pelos
 * cortes (global ou da dimensão). Nada é gravado.
 *
 * As perguntas são achadas pela chave (Q1…O3); as opções valem pela
 * POSIÇÃO (os ids são gerados pela tela; a ordem é a da metodologia).
 */
import type { Secao } from "../../../../api/pesquisaPublicaClient";
import type { DimensaoIsfb } from "./definicao";
import { FAIXAS_ISFB } from "./textos";
import type { FaixaIsfb } from "../../../../api/modelosDePesquisaClient";

type Tabela = readonly (readonly [number, number])[];

/** [base baixa, base alta] para cada soma (0 a 48). */
const TABELA_GLOBAL: Tabela = [
  [8, 0],
  [11, 1],
  [14, 2],
  [16, 3],
  [18, 4],
  [20, 5],
  [22, 6],
  [24, 7],
  [26, 9],
  [28, 10],
  [30, 12],
  [32, 13],
  [34, 15],
  [36, 17],
  [38, 19],
  [39, 21],
  [41, 23],
  [43, 25],
  [45, 27],
  [47, 29],
  [49, 31],
  [51, 35],
  [52, 37],
  [54, 40],
  [56, 42],
  [58, 44],
  [60, 46],
  [62, 48],
  [63, 50],
  [65, 53],
  [68, 55],
  [70, 57],
  [72, 59],
  [74, 61],
  [76, 64],
  [78, 67],
  [80, 69],
  [82, 71],
  [83, 73],
  [85, 75],
  [87, 77],
  [89, 79],
  [91, 81],
  [92, 84],
  [94, 86],
  [95, 88],
  [97, 90],
  [98, 93],
  [100, 96],
];

const TABELAS: Readonly<Record<DimensaoIsfb, Tabela>> = {
  seguranca: [
    [0, 6],
    [15, 3],
    [21, 9],
    [27, 12],
    [33, 18],
    [39, 24],
    [45, 30],
    [51, 36],
    [57, 42],
    [63, 48],
    [66, 54],
    [72, 60],
    [78, 69],
    [84, 75],
    [90, 81],
    [93, 87],
    [100, 96],
  ],
  habilidade: [
    [4, 0],
    [16, 8],
    [24, 12],
    [32, 20],
    [40, 28],
    [48, 36],
    [56, 44],
    [60, 52],
    [72, 64],
    [76, 68],
    [84, 80],
    [92, 88],
    [100, 96],
  ],
  comportamento: [
    [4, 0],
    [16, 8],
    [24, 12],
    [32, 20],
    [40, 28],
    [48, 36],
    [56, 44],
    [64, 52],
    [72, 60],
    [80, 68],
    [84, 76],
    [92, 88],
    [100, 96],
  ],
  liberdade: [
    [11, 0],
    [23, 5],
    [35, 17],
    [47, 29],
    [58, 41],
    [70, 52],
    [76, 64],
    [88, 82],
    [100, 94],
  ],
  autopercepcao: [
    [4, 0],
    [12, 8],
    [24, 16],
    [32, 20],
    [40, 28],
    [48, 36],
    [56, 44],
    [64, 52],
    [72, 60],
    [80, 68],
    [84, 76],
    [92, 88],
    [100, 96],
  ],
};

/** Limite superior de cada faixa (Ruim → Ótima). */
const CORTES_GLOBAIS = [36, 49, 56, 60, 68, 82, 100] as const;
export const CORTES_DAS_DIMENSOES: Readonly<
  Record<DimensaoIsfb, readonly number[]>
> = {
  seguranca: [23, 41, 53, 62, 77, 89, 100],
  habilidade: [19, 34, 50, 58, 75, 91, 100],
  comportamento: [27, 47, 59, 71, 83, 95, 100],
  liberdade: [16, 34, 47, 63, 75, 93, 100],
  autopercepcao: [27, 47, 59, 71, 83, 95, 100],
};

/** Média nacional de referência (2024). */
export const MEDIA_DO_BRASIL = 56.7;

const PONTOS_Q14 = [0, 1, 1, 2, 2, 3, 4] as const;
const PONTOS_Q15 = [0, 0, 1, 2, 3, 4] as const;
const INVERTIDOS = new Set(["Q2", "Q3", "Q4"]);

const DIMENSOES = {
  seguranca: ["Q1", "Q2", "Q3", "Q4"],
  habilidade: ["Q5", "Q6", "Q7"],
  comportamento: ["Q8", "Q9", "Q10"],
  liberdade: ["Q11", "Q12"],
  autopercepcao: ["O1", "O2", "O3"],
} as const satisfies Record<DimensaoIsfb, readonly string[]>;

export const DIMENSOES_DA_NOTA = [
  "seguranca",
  "habilidade",
  "comportamento",
  "liberdade",
] as const;

function notaDaTabela(tabela: Tabela, soma: number, baseBaixa: boolean) {
  const i = Math.min(Math.max(Math.round(soma), 0), tabela.length - 1);
  return tabela[i]![baseBaixa ? 0 : 1];
}

export function faixaDaNota(
  nota: number,
  cortes: readonly number[] = CORTES_GLOBAIS,
): FaixaIsfb {
  const i = cortes.findIndex((c) => nota <= c);
  return FAIXAS_ISFB[i < 0 ? FAIXAS_ISFB.length - 1 : i]!;
}

export function pontosDosProdutos(quantidade: number): number {
  if (quantidade <= 0) return 0;
  if (quantidade <= 2) return 1;
  if (quantidade <= 5) return 2;
  if (quantidade <= 8) return 3;
  return 4;
}

export interface DimensaoLocal {
  readonly id: DimensaoIsfb;
  readonly nota: number;
  readonly faixa: FaixaIsfb;
}

export interface ResultadoLocalIsfb {
  /** Nota de 0 a 100. */
  readonly isfb: number;
  readonly faixa: FaixaIsfb;
  /** Nota − média do Brasil, com 1 casa. */
  readonly diferencaDoBrasil: number;
  /** As 4 que formam a nota e, se respondida, a autopercepção. */
  readonly dimensoes: readonly DimensaoLocal[];
}

/** `respostas`: id da pergunta → valor do rascunho da página pública. */
export function resultadoIsfbDasRespostas(
  secoes: readonly Secao[],
  respostas: Readonly<Record<string, unknown>>,
): ResultadoLocalIsfb | null {
  const porChave = new Map(
    secoes
      .flatMap((s) => s.perguntas)
      .filter((p) => p.chave)
      .map((p) => [p.chave!, p]),
  );
  /** Posição da opção marcada (escolha única); `null` sem resposta. */
  const posicao = (chave: string): number | null => {
    const p = porChave.get(chave);
    const v = p ? respostas[p.id] : undefined;
    const id =
      v && typeof v === "object" && "opcao" in v
        ? (v as { opcao: unknown }).opcao
        : null;
    const i = (p?.config.opcoes ?? []).findIndex((o) => o.id === id);
    return i < 0 ? null : i;
  };
  const pontos = (chave: string): number | null => {
    if (chave === "Q1") return posicao("Q1");
    const p = porChave.get(chave);
    const v = p ? respostas[p.id] : undefined;
    if (!Number.isInteger(v) || (v as number) < 0 || (v as number) > 4)
      return null;
    return INVERTIDOS.has(chave) ? 4 - (v as number) : (v as number);
  };
  const soma = (chaves: readonly string[]): number | null => {
    let t = 0;
    for (const c of chaves) {
      const n = pontos(c);
      if (n === null) return null;
      t += n;
    }
    return t;
  };
  const somas = DIMENSOES_DA_NOTA.map((d) => soma(DIMENSOES[d]));
  const renda = posicao("Q14");
  const escolaridade = posicao("Q15");
  if (somas.some((s) => s === null) || renda === null || escolaridade === null)
    return null;

  const q13 = porChave.get("Q13");
  const bruto = q13 ? respostas[q13.id] : undefined;
  const marcadas =
    bruto && typeof bruto === "object" && "opcoes" in bruto
      ? ((bruto as { opcoes: readonly unknown[] }).opcoes ?? [])
      : [];
  const posicoes = new Set(
    (q13?.config.opcoes ?? [])
      .map((o, i) => (marcadas.includes(o.id) ? i : -1))
      .filter((i) => i >= 0),
  );
  const base =
    pontosDosProdutos(posicoes.size) +
    (PONTOS_Q14[renda] ?? 0) +
    (PONTOS_Q15[escolaridade] ?? 0);
  const baseBaixa = base <= 6;
  const parte1 = somas.reduce<number>((t, s) => t + s!, 0);
  const isfb = notaDaTabela(TABELA_GLOBAL, parte1, baseBaixa);
  const dimensao = (id: DimensaoIsfb, s: number): DimensaoLocal => {
    const nota = notaDaTabela(TABELAS[id], s, baseBaixa);
    return { id, nota, faixa: faixaDaNota(nota, CORTES_DAS_DIMENSOES[id]) };
  };
  const dimensoes = DIMENSOES_DA_NOTA.map((d, i) => dimensao(d, somas[i]!));
  const auto = soma(DIMENSOES.autopercepcao);
  return {
    isfb,
    faixa: faixaDaNota(isfb),
    diferencaDoBrasil: Math.round((isfb - MEDIA_DO_BRASIL) * 10) / 10 || 0,
    dimensoes:
      auto === null
        ? dimensoes
        : [...dimensoes, dimensao("autopercepcao", auto)],
  };
}
