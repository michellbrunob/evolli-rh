import { suprimirGrupos } from "../../calculo-resultados";
import type { MotivoOculto, ValorRespondido } from "../../pesquisas.types";
import {
  INVERTIDOS_ISFB,
  OPCOES_Q1,
  OPCOES_Q14,
  OPCOES_Q15,
  PONTOS_Q14,
  PONTOS_Q15,
  PRODUTOS,
  type Produto,
} from "./definicao";

/**
 * T216 — cálculo da saúde financeira (nota de 0 a 100). Funções puras.
 *
 * Parte 1: a soma dos pontos (0 a 4) de Segurança (Q1–Q4, 0–16),
 * Habilidade (Q5–Q7, 0–12), Comportamento (Q8–Q10, 0–12) e Liberdade
 * (Q11–Q12, 0–8). Parte 2 (base financeira): produtos da casa (0 → 0;
 * 1–2 → 1; 3–5 → 2; 6–8 → 3; 9 ou mais → 4) + renda (0–4) + escolaridade
 * (0–4); base baixa até 6. A nota de cada soma sai das tabelas de conversão
 * (coluna 1 = base baixa, coluna 2 = base alta).
 */

/** [base baixa, base alta] para cada soma. */
type Tabela = readonly (readonly [number, number])[];

export const TABELA_GLOBAL: Tabela = [
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

export const TABELAS_DAS_DIMENSOES = {
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
} as const satisfies Record<string, Tabela>;

export type DimensaoIsfb = keyof typeof TABELAS_DAS_DIMENSOES;
export const DIMENSOES_DA_NOTA = [
  "seguranca",
  "habilidade",
  "comportamento",
  "liberdade",
] as const;

export const FAIXAS_ISFB = [
  "ruim",
  "muito_baixa",
  "baixa",
  "ok",
  "boa",
  "muito_boa",
  "otima",
] as const;
export type FaixaIsfb = (typeof FAIXAS_ISFB)[number];

/** Limite superior de cada faixa (Ruim → Ótima). */
export const CORTES_GLOBAIS = [36, 49, 56, 60, 68, 82, 100] as const;
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

export type SaudeFinanceira = "baixa" | "no_limite" | "saudavel";
export type Perfil =
  "estaveis" | "confortaveis_sem_metodo" | "apertados_organizados" | "em_risco";
export const PERFIS: readonly Perfil[] = [
  "estaveis",
  "apertados_organizados",
  "confortaveis_sem_metodo",
  "em_risco",
];
export type Sinal = "gasta_mais" | "estresse" | "apertado" | "sem_reserva";
export const SINAIS: readonly Sinal[] = [
  "gasta_mais",
  "estresse",
  "apertado",
  "sem_reserva",
];
export type Abertura =
  "sabem_que_precisam" | "ponto_cego" | "bem_e_atentos" | "bem_mas_desatentos";
export const ABERTURAS: readonly Abertura[] = [
  "sabem_que_precisam",
  "ponto_cego",
  "bem_e_atentos",
  "bem_mas_desatentos",
];

const uma = (n: number) => Math.round(n * 10) / 10 || 0;

/** A nota da soma na tabela (índice arredondado e limitado). */
export function notaDaTabela(
  tabela: Tabela,
  soma: number,
  baseBaixa: boolean,
): number {
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

export function saudeDaNota(nota: number): SaudeFinanceira {
  if (nota <= 56) return "baixa";
  if (nota <= 60) return "no_limite";
  return "saudavel";
}

export function pontosDosProdutos(quantidade: number): number {
  if (quantidade <= 0) return 0;
  if (quantidade <= 2) return 1;
  if (quantidade <= 5) return 2;
  if (quantidade <= 8) return 3;
  return 4;
}

export function perfilDe(seguranca: number, capacidade: number): Perfil {
  if (seguranca >= 50)
    return capacidade >= 50 ? "estaveis" : "confortaveis_sem_metodo";
  return capacidade >= 50 ? "apertados_organizados" : "em_risco";
}

export function aberturaDe(isfb: number, autopercepcao: number): Abertura {
  if (isfb <= 56)
    return autopercepcao >= 71 ? "sabem_que_precisam" : "ponto_cego";
  return autopercepcao >= 71 ? "bem_e_atentos" : "bem_mas_desatentos";
}

/** Pontos (0 a 4) de uma escala, com o espelho dos itens negativos. */
export function pontosDaEscala(id: string, bruto: unknown): number | null {
  if (!Number.isInteger(bruto)) return null;
  const v = bruto as number;
  if (v < 0 || v > 4) return null;
  return INVERTIDOS_ISFB.has(id) ? 4 - v : v;
}

function opcaoMarcada(v: unknown): string | null {
  return v && typeof v === "object" && "opcao" in v
    ? String((v as { opcao: unknown }).opcao)
    : null;
}

function pontosDaOpcao(
  v: unknown,
  ids: readonly string[],
  pontos: readonly number[],
): number | null {
  const i = ids.indexOf(opcaoMarcada(v) ?? "");
  return i < 0 ? null : pontos[i]!;
}

export function produtosMarcados(v: unknown): Set<Produto> {
  const lista =
    v &&
    typeof v === "object" &&
    Array.isArray((v as { opcoes?: unknown }).opcoes)
      ? ((v as { opcoes: unknown[] }).opcoes as unknown[])
      : [];
  return new Set(
    lista.filter((x): x is Produto => PRODUTOS.includes(x as Produto)),
  );
}

export interface PessoaIsfb {
  /** Nota de 0 a 100. */
  isfb: number;
  faixa: FaixaIsfb;
  saude: SaudeFinanceira;
  dimensoes: Record<(typeof DIMENSOES_DA_NOTA)[number], number>;
  /** `null` sem as 3 perguntas de autopercepção respondidas. */
  autopercepcao: number | null;
  baseBaixa: boolean;
  perfil: Perfil;
  sinais: Sinal[];
  abertura: Abertura | null;
  produtos: Produto[];
  /** Pontos (0 a 4) de Q1 a Q12 e O1 a O3 (null sem resposta). */
  pontos: Record<string, number | null>;
  /** Faixa de renda (Q14), índice 0 a 6. */
  renda: number | null;
}

const ESCALAS = [
  "Q2",
  "Q3",
  "Q4",
  "Q5",
  "Q6",
  "Q7",
  "Q8",
  "Q9",
  "Q10",
  "Q11",
  "Q12",
  "O1",
  "O2",
  "O3",
] as const;

/** A nota e os sinais de uma pessoa (`null` sem a parte que forma a nota). */
export function calcularPessoaIsfb(
  valores: readonly ValorRespondido[],
): PessoaIsfb | null {
  const v = new Map(valores.map((x) => [x.perguntaId, x.valor]));
  const pontos: Record<string, number | null> = {
    Q1: pontosDaOpcao(v.get("Q1"), OPCOES_Q1, [0, 1, 2, 3, 4]),
  };
  for (const id of ESCALAS) pontos[id] = pontosDaEscala(id, v.get(id));
  const soma = (ids: readonly string[]) => {
    let t = 0;
    for (const id of ids) {
      const p = pontos[id];
      if (p === null || p === undefined) return null;
      t += p;
    }
    return t;
  };
  const somas = {
    seguranca: soma(["Q1", "Q2", "Q3", "Q4"]),
    habilidade: soma(["Q5", "Q6", "Q7"]),
    comportamento: soma(["Q8", "Q9", "Q10"]),
    liberdade: soma(["Q11", "Q12"]),
  };
  const renda = OPCOES_Q14.indexOf(
    opcaoMarcada(v.get("Q14")) as (typeof OPCOES_Q14)[number],
  );
  const escolaridade = pontosDaOpcao(v.get("Q15"), OPCOES_Q15, PONTOS_Q15);
  if (
    Object.values(somas).some((s) => s === null) ||
    renda < 0 ||
    escolaridade === null
  ) {
    return null;
  }
  const produtos = produtosMarcados(v.get("Q13"));
  const base =
    pontosDosProdutos(produtos.size) + PONTOS_Q14[renda]! + escolaridade;
  const baseBaixa = base <= 6;
  const parte1 =
    somas.seguranca! +
    somas.habilidade! +
    somas.comportamento! +
    somas.liberdade!;
  const isfb = notaDaTabela(TABELA_GLOBAL, parte1, baseBaixa);
  const dimensoes = {
    seguranca: notaDaTabela(
      TABELAS_DAS_DIMENSOES.seguranca,
      somas.seguranca!,
      baseBaixa,
    ),
    habilidade: notaDaTabela(
      TABELAS_DAS_DIMENSOES.habilidade,
      somas.habilidade!,
      baseBaixa,
    ),
    comportamento: notaDaTabela(
      TABELAS_DAS_DIMENSOES.comportamento,
      somas.comportamento!,
      baseBaixa,
    ),
    liberdade: notaDaTabela(
      TABELAS_DAS_DIMENSOES.liberdade,
      somas.liberdade!,
      baseBaixa,
    ),
  };
  const somaAuto = soma(["O1", "O2", "O3"]);
  const autopercepcao =
    somaAuto === null
      ? null
      : notaDaTabela(TABELAS_DAS_DIMENSOES.autopercepcao, somaAuto, baseBaixa);
  const capacidade = (dimensoes.habilidade + dimensoes.comportamento) / 2;
  const sinais: Sinal[] = [];
  if (pontos.Q1! <= 1) sinais.push("gasta_mais");
  if (pontos.Q2! <= 1) sinais.push("estresse");
  if (pontos.Q4! <= 1) sinais.push("apertado");
  if (!produtos.has("poupanca") && !produtos.has("investimentos")) {
    sinais.push("sem_reserva");
  }
  return {
    isfb,
    faixa: faixaDaNota(isfb),
    saude: saudeDaNota(isfb),
    dimensoes,
    autopercepcao,
    baseBaixa,
    perfil: perfilDe(dimensoes.seguranca, capacidade),
    sinais,
    abertura: autopercepcao === null ? null : aberturaDe(isfb, autopercepcao),
    produtos: PRODUTOS.filter((p) => produtos.has(p)),
    pontos,
    renda,
  };
}

/** Os 4 grupos de produtos da base financeira. */
export const GRUPOS_DE_PRODUTOS: Readonly<
  Record<"reserva" | "protecao" | "credito" | "dia_a_dia", readonly Produto[]>
> = {
  reserva: ["poupanca", "investimentos", "previdencia", "capitalizacao"],
  protecao: ["seguro_saude", "seguro_carro", "seguro_casa"],
  credito: [
    "cartao_credito",
    "financ_veiculo",
    "financ_imovel",
    "consorcio",
    "financ_estudantil",
  ],
  dia_a_dia: ["conta_corrente", "cartao_debito"],
};

const FINANCIAMENTOS: readonly Produto[] = [
  "financ_veiculo",
  "financ_imovel",
  "financ_estudantil",
  "consorcio",
];

export function usaCredito(p: PessoaIsfb): boolean {
  return p.produtos.some(
    (x) => x === "cartao_credito" || FINANCIAMENTOS.includes(x),
  );
}

export function temReserva(p: PessoaIsfb): boolean {
  return (
    p.produtos.includes("poupanca") || p.produtos.includes("investimentos")
  );
}

export type Tema =
  | "orcamento"
  | "reserva"
  | "aposentadoria"
  | "investimentos"
  | "dividas"
  | "decidir";

/** Quem se beneficia de cada tema (pontos até 1 nas perguntas). */
export function temasDa(p: PessoaIsfb): Tema[] {
  const baixo = (id: string) => (p.pontos[id] ?? 4) <= 1;
  const temas: Tema[] = [];
  if (baixo("Q1") || baixo("Q4")) temas.push("orcamento");
  if (baixo("Q9") || !temReserva(p)) temas.push("reserva");
  if (baixo("Q11")) temas.push("aposentadoria");
  if (baixo("Q6")) temas.push("investimentos");
  if (usaCredito(p) && !temReserva(p)) temas.push("dividas");
  if (baixo("Q5") || baixo("Q7")) temas.push("decidir");
  return temas;
}

/** A faixa de renda da casa (Q14) em 5 grupos. */
export const GRUPOS_DE_RENDA = [
  "ate_1_5",
  "de_1_5_a_4_2",
  "de_4_2_a_14_1",
  "de_14_1_a_28_2",
  "acima_28_2",
] as const;
const RENDA_NO_GRUPO = [0, 1, 1, 2, 2, 3, 4] as const;

const pct = (n: number, total: number) => (total ? uma((n * 100) / total) : 0);
const mediaInteira = (xs: readonly number[]) =>
  xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null;

export interface ContagemComPercentual {
  quantidade: number;
  percentual: number;
}

export interface ResultadoIsfb {
  /** Pessoas com nota (respostas completas da parte que forma a nota). */
  pessoas: number;
  isfb: number | null;
  faixa: FaixaIsfb | null;
  diferencaDoBrasil: number | null;
  dimensoes: {
    id: DimensaoIsfb;
    nota: number | null;
    faixa: FaixaIsfb | null;
    /** Quem respondeu (a autopercepção é opcional). */
    pessoas: number;
  }[];
  /** Histograma de 0 a 100 em faixas de 5 pontos (20 barras). */
  distribuicao: number[];
  saude: Record<SaudeFinanceira, ContagemComPercentual>;
  sinais: Record<Sinal, ContagemComPercentual>;
  /** Pessoas com 0, 1, 2, 3 e 4 sinais. */
  sinaisAcumulados: number[];
  perfis: Record<Perfil, ContagemComPercentual>;
  /** O ponto do time no gráfico (médias de segurança e capacidade). */
  pontoDoTime: { seguranca: number; capacidade: number } | null;
  perguntas: {
    id: string;
    respostas: number;
    favoravel: number;
    desfavoravel: number;
    /** Quantas pessoas em cada ponto (0 a 4, já espelhado). */
    pontos: number[];
  }[];
  produtos: Record<Produto, ContagemComPercentual>;
  base: {
    semReserva: ContagemComPercentual;
    comPrevidencia: ContagemComPercentual;
    doisOuMaisFinanciamentos: ContagemComPercentual;
    produtosPorPessoa: number | null;
  };
  creditoReserva: {
    creditoSemReserva: number;
    creditoComReserva: number;
    semCreditoSemReserva: number;
    semCreditoComReserva: number;
  };
  temas: { id: Tema; quantidade: number; percentual: number }[];
  aberturas: Record<Abertura, ContagemComPercentual>;
  /** Respostas com a autopercepção completa. */
  comAutopercepcao: number;
  porRenda: {
    id: (typeof GRUPOS_DE_RENDA)[number];
    respostas: number;
    visivel: boolean;
    oculto: MotivoOculto | null;
    saude: Record<SaudeFinanceira, number> | null;
  }[];
}

/** O resultado do time sobre as pessoas com nota. */
export function calcularIsfb(
  respostas: readonly { valores: readonly ValorRespondido[] }[],
  minimoPorGrupo = 3,
): ResultadoIsfb {
  const pessoas = respostas
    .map((r) => calcularPessoaIsfb(r.valores))
    .filter((p): p is PessoaIsfb => p !== null);
  const n = pessoas.length;
  const conta = (f: (p: PessoaIsfb) => boolean): ContagemComPercentual => {
    const q = pessoas.filter(f).length;
    return { quantidade: q, percentual: pct(q, n) };
  };
  const isfb = mediaInteira(pessoas.map((p) => p.isfb));
  const comAuto = pessoas.filter((p) => p.autopercepcao !== null);

  const distribuicao = Array.from({ length: 20 }, () => 0);
  for (const p of pessoas)
    distribuicao[Math.min(Math.floor(p.isfb / 5), 19)]! += 1;

  const sinaisAcumulados = [0, 0, 0, 0, 0];
  for (const p of pessoas) sinaisAcumulados[p.sinais.length]! += 1;

  const perguntaIds = [
    "Q1",
    "Q2",
    "Q3",
    "Q4",
    "Q5",
    "Q6",
    "Q7",
    "Q8",
    "Q9",
    "Q10",
    "Q11",
    "Q12",
    "O1",
    "O2",
    "O3",
  ];
  const temas = (
    [
      "orcamento",
      "reserva",
      "aposentadoria",
      "investimentos",
      "dividas",
      "decidir",
    ] as const
  )
    .map((id) => {
      const q = pessoas.filter((p) => temasDa(p).includes(id)).length;
      return { id, quantidade: q, percentual: pct(q, n) };
    })
    .sort((a, b) => b.quantidade - a.quantidade);

  return {
    pessoas: n,
    isfb,
    faixa: isfb === null ? null : faixaDaNota(isfb),
    diferencaDoBrasil: isfb === null ? null : uma(isfb - MEDIA_DO_BRASIL),
    dimensoes: [...DIMENSOES_DA_NOTA, "autopercepcao" as const].map((id) => {
      const notas =
        id === "autopercepcao"
          ? comAuto.map((p) => p.autopercepcao!)
          : pessoas.map((p) => p.dimensoes[id]);
      const nota = mediaInteira(notas);
      return {
        id,
        nota,
        faixa:
          nota === null ? null : faixaDaNota(nota, CORTES_DAS_DIMENSOES[id]),
        pessoas: notas.length,
      };
    }),
    distribuicao,
    saude: {
      baixa: conta((p) => p.saude === "baixa"),
      no_limite: conta((p) => p.saude === "no_limite"),
      saudavel: conta((p) => p.saude === "saudavel"),
    },
    sinais: Object.fromEntries(
      SINAIS.map((s) => [s, conta((p) => p.sinais.includes(s))]),
    ) as Record<Sinal, ContagemComPercentual>,
    sinaisAcumulados,
    perfis: Object.fromEntries(
      PERFIS.map((x) => [x, conta((p) => p.perfil === x)]),
    ) as Record<Perfil, ContagemComPercentual>,
    pontoDoTime: n
      ? {
          seguranca: mediaInteira(pessoas.map((p) => p.dimensoes.seguranca))!,
          capacidade: mediaInteira(
            pessoas.map(
              (p) => (p.dimensoes.habilidade + p.dimensoes.comportamento) / 2,
            ),
          )!,
        }
      : null,
    perguntas: perguntaIds.map((id) => {
      const lista = pessoas
        .map((p) => p.pontos[id])
        .filter((x): x is number => x !== null && x !== undefined);
      const pontos = [0, 1, 2, 3, 4].map(
        (v) => lista.filter((x) => x === v).length,
      );
      return {
        id,
        respostas: lista.length,
        favoravel: pct(pontos[3]! + pontos[4]!, lista.length),
        desfavoravel: pct(pontos[0]! + pontos[1]!, lista.length),
        pontos,
      };
    }),
    produtos: Object.fromEntries(
      PRODUTOS.map((x) => [x, conta((p) => p.produtos.includes(x))]),
    ) as Record<Produto, ContagemComPercentual>,
    base: {
      semReserva: conta((p) => p.sinais.includes("sem_reserva")),
      comPrevidencia: conta((p) => p.produtos.includes("previdencia")),
      doisOuMaisFinanciamentos: conta(
        (p) => p.produtos.filter((x) => FINANCIAMENTOS.includes(x)).length >= 2,
      ),
      produtosPorPessoa: n
        ? uma(pessoas.reduce((t, p) => t + p.produtos.length, 0) / n)
        : null,
    },
    creditoReserva: {
      creditoSemReserva: pessoas.filter((p) => usaCredito(p) && !temReserva(p))
        .length,
      creditoComReserva: pessoas.filter((p) => usaCredito(p) && temReserva(p))
        .length,
      semCreditoSemReserva: pessoas.filter(
        (p) => !usaCredito(p) && !temReserva(p),
      ).length,
      semCreditoComReserva: pessoas.filter(
        (p) => !usaCredito(p) && temReserva(p),
      ).length,
    },
    temas,
    aberturas: Object.fromEntries(
      ABERTURAS.map((a) => {
        const q = comAuto.filter((p) => p.abertura === a).length;
        return [a, { quantidade: q, percentual: pct(q, comAuto.length) }];
      }),
    ) as Record<Abertura, ContagemComPercentual>,
    comAutopercepcao: comAuto.length,
    porRenda: porRenda(pessoas, minimoPorGrupo),
  };
}

/**
 * Saúde financeira por renda da casa: grupos abaixo do mínimo ficam ocultos
 * e, se o que não aparece for uma parte só, o menor visível também (a
 * subtração do total revelaria o grupo oculto).
 */
function porRenda(
  pessoas: readonly PessoaIsfb[],
  minimoPorGrupo: number,
): ResultadoIsfb["porRenda"] {
  const grupos = GRUPOS_DE_RENDA.map((id, i) => ({
    id,
    nome: String(i),
    pessoas: pessoas.filter(
      (p) => p.renda !== null && RENDA_NO_GRUPO[p.renda] === i,
    ),
  }));
  const motivo = suprimirGrupos(
    grupos
      .filter((g) => g.pessoas.length > 0)
      .map((g) => ({ id: g.id, nome: g.nome, respostas: g.pessoas.length })),
    0,
    minimoPorGrupo,
  );
  return grupos.map((g) => {
    const oculto = motivo.get(g.id) ?? null;
    const visivel = g.pessoas.length > 0 && oculto === null;
    return {
      id: g.id,
      respostas: g.pessoas.length,
      visivel,
      oculto,
      saude: visivel
        ? {
            baixa: g.pessoas.filter((p) => p.saude === "baixa").length,
            no_limite: g.pessoas.filter((p) => p.saude === "no_limite").length,
            saudavel: g.pessoas.filter((p) => p.saude === "saudavel").length,
          }
        : null,
    };
  });
}
