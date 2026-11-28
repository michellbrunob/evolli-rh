import type { Secao, ValorRespondido } from "../../pesquisas.types";
import { respostaPorChave } from "../chaves";
import type { ContextoDoModelo, RespostaDoModelo } from "../tipos";
import {
  DIMENSOES_NR1,
  DOMINIOS_NR1,
  ITEM_DA_SAUDE,
  ITENS_NR1,
  ITENS_OFENSIVOS,
  ROTULOS_DA_SAUDE_LEGADA,
  dimensaoNr1,
  type DominioNr1,
  type ItemNr1,
  type TipoDeDimensao,
} from "./definicao";

/**
 * T216 — cálculo dos riscos psicossociais (NR-1). Funções puras.
 *
 * - Pontuação do item: o valor marcado (1 a 5); invertidos valem
 *   `6 − valor`. Saúde: 5 = "Excelente"; nas pesquisas gravadas antes da
 *   troca (1 = "Excelente", sem `decrescente`), também `6 − valor`.
 * - Escore da dimensão por pessoa: a média dos itens respondidos (1 a 5).
 * - Faixa da pessoa por tercil do escore: ≤ 2,33 → T1; ≤ 3,66 → T2; acima →
 *   T3. Risco: T1 favorável, T2 intermediário, T3 risco. Proteção: o
 *   contrário.
 * - Severidade (1 a 4) do escore médio do grupo: o escore (risco) ou
 *   `6 − escore` (proteção); acima de 4 → 4, de 3 → 3, de 2 → 2, senão 1.
 * - Prevalência (1 a 4) do % em risco: ≥ 60 → 4, ≥ 40 → 3, ≥ 20 → 2, senão
 *   1. Com menos de 10 pessoas: alguém em risco → 3; senão alguém
 *   intermediário → 2; senão a regra normal.
 * - Nível: a matriz 4 × 4 (severidade × prevalência). Regra de proteção:
 *   sintomas depressivos e comportamentos ofensivos com severidade alta ou
 *   muito alta nunca ficam abaixo de "alto".
 */

export type NivelNr1 = "critico" | "alto" | "medio" | "baixo";
export type FaixaNr1 = "risco" | "intermediario" | "favoravel";
export type Grau = 1 | 2 | 3 | 4;

export const NIVEIS_NR1: readonly NivelNr1[] = [
  "critico",
  "alto",
  "medio",
  "baixo",
];

/** Linhas: severidade 4 (topo) a 1; colunas: prevalência 1 a 4. */
export const MATRIZ_NR1: readonly (readonly NivelNr1[])[] = [
  ["medio", "alto", "critico", "critico"],
  ["baixo", "medio", "alto", "critico"],
  ["baixo", "baixo", "medio", "alto"],
  ["baixo", "baixo", "baixo", "medio"],
];

/** Dimensões que a regra de proteção nunca deixa abaixo de "alto". */
export const DIMENSOES_PROTEGIDAS = new Set([
  "sintomas_depressivos",
  "comportamentos_ofensivos",
]);

/** Pressão (exigências) e recursos (apoio e autonomia) dos recortes. */
export const DIMENSOES_DE_PRESSAO = [
  "exigencias_quantitativas",
  "ritmo_trabalho",
  "exigencias_cognitivas",
  "exigencias_emocionais",
] as const;
export const DIMENSOES_DE_RECURSOS = [
  "influencia_trabalho",
  "possibilidades_desenvolvimento",
  "qualidade_lideranca",
  "apoio_social_superiores",
  "apoio_social_colegas",
] as const;

/** Os indicadores de saúde (cartões), na ordem da tela. */
export const INDICADORES_DE_SAUDE = [
  "burnout",
  "stress",
  "problemas_dormir",
  "sintomas_depressivos",
  "saude_geral",
] as const;

/** Duas casas, sem `-0`. */
const duas = (n: number) => Math.round(n * 100) / 100 || 0;
/** Uma casa (percentuais). */
const uma = (n: number) => Math.round(n * 10) / 10 || 0;

const media = (xs: readonly number[]): number | null =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;

/**
 * A pontuação (1 a 5) de um item, ou `null` sem resposta válida.
 * `saudeLegada`: a pesquisa gravou a saúde com 1 = "Excelente".
 */
export function pontuacaoDoItem(
  item: ItemNr1,
  bruto: unknown,
  saudeLegada = false,
): number | null {
  if (!Number.isInteger(bruto)) return null;
  const v = bruto as number;
  if (v < 1 || v > 5) return null;
  return item.invertido || (saudeLegada && item.escala === "saude") ? 6 - v : v;
}

/**
 * A pesquisa foi gravada com a saúde antiga? Lá o 1º ponto do Q64 era
 * "Excelente" (1 = Excelente); na nova, o 1º é "Fraca" (5 = Excelente).
 * Sem o item, vale a regra nova.
 */
export function saudeLegadaDe(secoes: readonly Secao[]): boolean {
  for (const s of secoes) {
    const p = s.perguntas.find((x) => x.chave === ITEM_DA_SAUDE);
    if (p) return p.config.rotulos?.[0]?.trim() === ROTULOS_DA_SAUDE_LEGADA[0];
  }
  return false;
}

/** O mapa pergunta → valor de uma resposta. */
export function valoresDe(
  valores: readonly ValorRespondido[],
): Map<string, unknown> {
  return new Map(valores.map((v) => [v.perguntaId, v.valor]));
}

/** O escore de cada dimensão da pessoa (média dos itens respondidos). */
export function escoresDaPessoa(
  valores: ReadonlyMap<string, unknown>,
  saudeLegada = false,
): Map<string, number> {
  const somas = new Map<string, number[]>();
  for (const item of ITENS_NR1) {
    const p = pontuacaoDoItem(item, valores.get(item.id), saudeLegada);
    if (p === null) continue;
    const lista = somas.get(item.dimensao) ?? [];
    lista.push(p);
    somas.set(item.dimensao, lista);
  }
  const escores = new Map<string, number>();
  for (const [dim, lista] of somas) escores.set(dim, media(lista)!);
  return escores;
}

export function tercilDo(escore: number): 1 | 2 | 3 {
  if (escore <= 2.33) return 1;
  if (escore <= 3.66) return 2;
  return 3;
}

export function faixaDoEscore(tipo: TipoDeDimensao, escore: number): FaixaNr1 {
  const t = tercilDo(escore);
  if (t === 2) return "intermediario";
  if (tipo === "risco") return t === 3 ? "risco" : "favoravel";
  return t === 1 ? "risco" : "favoravel";
}

export function severidadeDo(tipo: TipoDeDimensao, escore: number): Grau {
  const v = tipo === "risco" ? escore : 6 - escore;
  if (v > 4) return 4;
  if (v > 3) return 3;
  if (v > 2) return 2;
  return 1;
}

export function prevalenciaDo(
  percentualEmRisco: number,
  pessoas: number,
  emRisco: number,
  intermediarias: number,
): Grau {
  if (pessoas < 10) {
    if (emRisco > 0) return 3;
    if (intermediarias > 0) return 2;
  }
  if (percentualEmRisco >= 60) return 4;
  if (percentualEmRisco >= 40) return 3;
  if (percentualEmRisco >= 20) return 2;
  return 1;
}

/** O nível pela matriz, com a regra de proteção. */
export function nivelDo(
  dimensaoId: string,
  severidade: Grau,
  prevalencia: Grau,
): { nivel: NivelNr1; regraDeProtecao: boolean } {
  const nivel = MATRIZ_NR1[4 - severidade]![prevalencia - 1]!;
  if (
    DIMENSOES_PROTEGIDAS.has(dimensaoId) &&
    severidade >= 3 &&
    (nivel === "baixo" || nivel === "medio")
  ) {
    return { nivel: "alto", regraDeProtecao: true };
  }
  return { nivel, regraDeProtecao: false };
}

const PESO_DO_NIVEL: Readonly<Record<NivelNr1, number>> = {
  critico: 0,
  alto: 1,
  medio: 2,
  baixo: 3,
};

export interface DimensaoDoResultado {
  id: string;
  dominio: DominioNr1;
  tipo: TipoDeDimensao;
  /** Pessoas com escore nesta dimensão. */
  pessoas: number;
  /** Escore médio (1 a 5), duas casas. */
  escore: number | null;
  tercil: 1 | 2 | 3 | null;
  /** A faixa do escore médio. */
  faixa: FaixaNr1 | null;
  distribuicao: Record<FaixaNr1, number>;
  /** Percentuais (0 a 100, uma casa). */
  percentuais: Record<FaixaNr1, number>;
  severidade: Grau | null;
  prevalencia: Grau | null;
  nivel: NivelNr1 | null;
  regraDeProtecao: boolean;
}

export interface DominioDoResultado {
  id: DominioNr1;
  dimensoes: number;
  /** Alto + crítico. */
  precisamDeAcao: number;
  /** Média dos % em risco das dimensões. */
  percentualEmRisco: number | null;
}

export interface IndicadorDeSaude {
  id: (typeof INDICADORES_DE_SAUDE)[number];
  pessoasEmRisco: number;
  pessoas: number;
  percentualEmRisco: number;
  nivel: NivelNr1 | null;
}

/** Contagem que some abaixo do mínimo de sigilo (`null` = "menos de N"). */
export type ContagemSigilosa = number | null;

export interface OfensivoDoResultado {
  id: (typeof ITENS_OFENSIVOS)[number];
  raramente: ContagemSigilosa;
  asVezes: ContagemSigilosa;
  frequentementeOuSempre: ContagemSigilosa;
  relataram: ContagemSigilosa;
}

export interface OfensivosDoResultado {
  pessoas: number;
  /** Quem relatou ao menos um tipo (resposta ≥ 2). */
  relataram: ContagemSigilosa;
  percentual: number | null;
  tipos: OfensivoDoResultado[];
}

export interface ResultadoNr1 {
  respostas: number;
  dimensoes: DimensaoDoResultado[];
  /** Ids das dimensões na ordem de prioridade. */
  prioridades: string[];
  niveis: Record<NivelNr1, number>;
  precisamDeAcao: number;
  /** Linhas: severidade 4 a 1; colunas: prevalência 1 a 4; ids. */
  matriz: string[][][];
  dominios: DominioDoResultado[];
  saude: IndicadorDeSaude[];
  ofensivos: OfensivosDoResultado;
}

export interface OpcoesNr1 {
  /** Contagens abaixo deste mínimo somem (anônima e confidencial). */
  readonly sigilo: number | null;
  /** A saúde gravada com 1 = "Excelente" (pesquisas antigas). */
  readonly saudeLegada?: boolean;
}

function sigiloso(n: number, sigilo: number | null): ContagemSigilosa {
  return sigilo !== null && n > 0 && n < sigilo ? null : n;
}

/** Os dados de uma dimensão sobre os escores das pessoas. */
function dimensaoDoGrupo(
  id: string,
  escores: readonly ReadonlyMap<string, number>[],
): DimensaoDoResultado {
  const dim = dimensaoNr1(id);
  const lista = escores
    .map((e) => e.get(id))
    .filter((x): x is number => x !== undefined);
  const distribuicao: Record<FaixaNr1, number> = {
    risco: 0,
    intermediario: 0,
    favoravel: 0,
  };
  for (const e of lista) distribuicao[faixaDoEscore(dim.tipo, e)] += 1;
  const n = lista.length;
  const pct = (x: number) => (n ? (x * 100) / n : 0);
  const base = {
    id,
    dominio: dim.dominio,
    tipo: dim.tipo,
    pessoas: n,
    distribuicao,
    percentuais: {
      risco: uma(pct(distribuicao.risco)),
      intermediario: uma(pct(distribuicao.intermediario)),
      favoravel: uma(pct(distribuicao.favoravel)),
    },
  };
  const escore = media(lista);
  if (escore === null) {
    return {
      ...base,
      escore: null,
      tercil: null,
      faixa: null,
      severidade: null,
      prevalencia: null,
      nivel: null,
      regraDeProtecao: false,
    };
  }
  const severidade = severidadeDo(dim.tipo, escore);
  const prevalencia = prevalenciaDo(
    pct(distribuicao.risco),
    n,
    distribuicao.risco,
    distribuicao.intermediario,
  );
  return {
    ...base,
    escore: duas(escore),
    tercil: tercilDo(escore),
    faixa: faixaDoEscore(dim.tipo, escore),
    severidade,
    prevalencia,
    ...nivelDo(id, severidade, prevalencia),
  };
}

/** Ordem de prioridade: nível, % em risco, severidade e nome. */
export function ordenarPrioridades(
  dimensoes: readonly DimensaoDoResultado[],
): string[] {
  return [...dimensoes]
    .filter((x) => x.nivel !== null)
    .sort(
      (a, b) =>
        PESO_DO_NIVEL[a.nivel!] - PESO_DO_NIVEL[b.nivel!] ||
        b.percentuais.risco - a.percentuais.risco ||
        (b.severidade ?? 0) - (a.severidade ?? 0) ||
        dimensaoNr1(a.id).rotulo.localeCompare(
          dimensaoNr1(b.id).rotulo,
          "pt-BR",
        ),
    )
    .map((x) => x.id);
}

export function contarNiveis(
  dimensoes: readonly { nivel: NivelNr1 | null }[],
): Record<NivelNr1, number> {
  const niveis: Record<NivelNr1, number> = {
    critico: 0,
    alto: 0,
    medio: 0,
    baixo: 0,
  };
  for (const x of dimensoes) if (x.nivel) niveis[x.nivel] += 1;
  return niveis;
}

/** As dimensões de cada célula (severidade 4 → 1; prevalência 1 → 4). */
export function montarMatriz(
  dimensoes: readonly DimensaoDoResultado[],
): string[][][] {
  const matriz = [4, 3, 2, 1].map(() => [1, 2, 3, 4].map(() => [] as string[]));
  for (const id of ordenarPrioridades(dimensoes)) {
    const x = dimensoes.find((y) => y.id === id)!;
    matriz[4 - x.severidade!]![x.prevalencia! - 1]!.push(id);
  }
  return matriz;
}

/**
 * As frequências de um tipo com o sigilo por célula e o complementar: se só
 * UMA ficar oculta e o total do tipo aparecer, ela sairia por subtração —
 * então a menor contagem positiva visível também some.
 */
export function frequenciasProtegidas(
  brutas: readonly number[],
  totalVisivel: boolean,
  sigilo: number | null,
): ContagemSigilosa[] {
  const celulas = brutas.map((n) => sigiloso(n, sigilo));
  const ocultas = celulas.filter((c) => c === null).length;
  if (sigilo === null || !totalVisivel || ocultas !== 1) return celulas;
  let menor = -1;
  celulas.forEach((c, i) => {
    if (c !== null && c > 0 && (menor < 0 || c < celulas[menor]!)) menor = i;
  });
  if (menor >= 0) celulas[menor] = null;
  return celulas;
}

/** Comportamentos ofensivos: as respostas de cada pessoa (1 a 5). */
function montarOfensivos(
  respostas: readonly ReadonlyMap<string, unknown>[],
  sigilo: number | null,
): OfensivosDoResultado {
  const valoresDe = (r: ReadonlyMap<string, unknown>) =>
    ITENS_OFENSIVOS.map((id) => {
      const v = r.get(id);
      return Number.isInteger(v) ? (v as number) : null;
    });
  const comResposta = respostas
    .map(valoresDe)
    .filter((vs) => vs.some((v) => v !== null));
  const pessoas = comResposta.length;
  const relataram = comResposta.filter((vs) =>
    vs.some((v) => v !== null && v >= 2),
  ).length;
  const visivel = sigiloso(relataram, sigilo);
  return {
    pessoas,
    relataram: visivel,
    percentual:
      visivel === null || pessoas === 0
        ? null
        : uma((relataram * 100) / pessoas),
    tipos: ITENS_OFENSIVOS.map((id, i) => {
      const vs = comResposta.map((x) => x[i]).filter((v) => v !== null);
      const conta = (f: (v: number) => boolean) =>
        vs.filter((v) => f(v!)).length;
      const relataramDoTipo = sigiloso(
        conta((v) => v >= 2),
        sigilo,
      );
      const [raramente, asVezes, frequentementeOuSempre] =
        frequenciasProtegidas(
          [conta((v) => v === 2), conta((v) => v === 3), conta((v) => v >= 4)],
          relataramDoTipo !== null,
          sigilo,
        );
      return {
        id,
        raramente: raramente!,
        asVezes: asVezes!,
        frequentementeOuSempre: frequentementeOuSempre!,
        relataram: relataramDoTipo,
      };
    }),
  };
}

/** O resultado do grupo (a empresa inteira ou um recorte). */
export function calcularNr1(
  respostas: readonly { valores: readonly ValorRespondido[] }[],
  opcoes: OpcoesNr1 = { sigilo: null },
): ResultadoNr1 {
  const mapas = respostas.map((r) => valoresDe(r.valores));
  const escores = mapas.map((m) =>
    escoresDaPessoa(m, opcoes.saudeLegada === true),
  );
  const dimensoes = DIMENSOES_NR1.map((x) => dimensaoDoGrupo(x.id, escores));
  const niveis = contarNiveis(dimensoes);
  const porId = new Map(dimensoes.map((x) => [x.id, x]));
  return {
    respostas: respostas.length,
    dimensoes,
    prioridades: ordenarPrioridades(dimensoes),
    niveis,
    precisamDeAcao: niveis.critico + niveis.alto,
    matriz: montarMatriz(dimensoes),
    dominios: DOMINIOS_NR1.map((dom) => {
      const lista = dimensoes.filter((x) => x.dominio === dom.id);
      const comDados = lista.filter((x) => x.pessoas > 0);
      const pct = media(comDados.map((x) => x.percentuais.risco));
      return {
        id: dom.id,
        dimensoes: lista.length,
        precisamDeAcao: lista.filter(
          (x) => x.nivel === "critico" || x.nivel === "alto",
        ).length,
        percentualEmRisco: pct === null ? null : uma(pct),
      };
    }),
    saude: INDICADORES_DE_SAUDE.map((id) => {
      const x = porId.get(id)!;
      return {
        id,
        pessoasEmRisco: x.distribuicao.risco,
        pessoas: x.pessoas,
        percentualEmRisco: x.percentuais.risco,
        nivel: x.nivel,
      };
    }),
    ofensivos: montarOfensivos(mapas, opcoes.sigilo),
  };
}

export type Comparacao = "acima" | "abaixo" | "na_media";

/** Diferença do escore da pessoa para o do grupo (±0,5). */
export function compararEscore(pessoa: number, grupo: number): Comparacao {
  const dif = pessoa - grupo;
  if (dif > 0.5) return "acima";
  if (dif < -0.5) return "abaixo";
  return "na_media";
}

export interface DimensaoIndividual {
  id: string;
  escore: number | null;
  tercil: 1 | 2 | 3 | null;
  faixa: FaixaNr1 | null;
  severidade: Grau | null;
  /** Pela faixa da pessoa: risco → 4, intermediário → 2, favorável → 1. */
  prevalencia: Grau | null;
  nivel: NivelNr1 | null;
  regraDeProtecao: boolean;
  escoreDoTime: number | null;
  comparacao: Comparacao | null;
}

export interface IndividualNr1 {
  dimensoes: DimensaoIndividual[];
  niveis: Record<NivelNr1, number>;
  /** A posição marcada em cada tipo de comportamento ofensivo. */
  ofensivos: {
    id: (typeof ITENS_OFENSIVOS)[number];
    resposta: number | null;
  }[];
}

const PREVALENCIA_DA_FAIXA: Readonly<Record<FaixaNr1, Grau>> = {
  risco: 4,
  intermediario: 2,
  favoravel: 1,
};

/** O resultado de uma pessoa, comparado com o do time. */
export function individualNr1(
  valores: readonly ValorRespondido[],
  time: ResultadoNr1 | null,
  saudeLegada = false,
): IndividualNr1 {
  const mapa = valoresDe(valores);
  const escores = escoresDaPessoa(mapa, saudeLegada);
  const doTime = new Map(time?.dimensoes.map((x) => [x.id, x.escore]) ?? []);
  const dimensoes: DimensaoIndividual[] = DIMENSOES_NR1.map((dim) => {
    const escore = escores.get(dim.id);
    const escoreDoTime = doTime.get(dim.id) ?? null;
    if (escore === undefined) {
      return {
        id: dim.id,
        escore: null,
        tercil: null,
        faixa: null,
        severidade: null,
        prevalencia: null,
        nivel: null,
        regraDeProtecao: false,
        escoreDoTime,
        comparacao: null,
      };
    }
    const faixa = faixaDoEscore(dim.tipo, escore);
    const severidade = severidadeDo(dim.tipo, escore);
    const prevalencia = PREVALENCIA_DA_FAIXA[faixa];
    return {
      id: dim.id,
      escore: duas(escore),
      tercil: tercilDo(escore),
      faixa,
      severidade,
      prevalencia,
      ...nivelDo(dim.id, severidade, prevalencia),
      escoreDoTime,
      comparacao:
        escoreDoTime === null ? null : compararEscore(escore, escoreDoTime),
    };
  });
  return {
    dimensoes,
    niveis: contarNiveis(dimensoes),
    ofensivos: ITENS_OFENSIVOS.map((id) => {
      const v = mapa.get(id);
      return { id, resposta: Number.isInteger(v) ? (v as number) : null };
    }),
  };
}

/** Pressão (exigências) e recursos (apoio e autonomia): médias dos escores. */
export function pressaoERecursos(r: ResultadoNr1): {
  pressao: number | null;
  recursos: number | null;
} {
  const escoreDe = (ids: readonly string[]) => {
    const m = media(
      r.dimensoes
        .filter((x) => ids.includes(x.id) && x.escore !== null)
        .map((x) => x.escore!),
    );
    return m === null ? null : duas(m);
  };
  return {
    pressao: escoreDe(DIMENSOES_DE_PRESSAO),
    recursos: escoreDe(DIMENSOES_DE_RECURSOS),
  };
}

/** O resultado do modelo no registro (`modelos/indice.ts`). */
export type ResultadoNr1DoModelo = { modelo: "copsoq" } & ResultadoNr1 & {
    pressao: number | null;
    recursos: number | null;
  };
export type IndividualNr1DoModelo = { modelo: "copsoq" } & IndividualNr1;

/** Agregado: as respostas visíveis, com o sigilo fora da identificada. */
export function calcularNr1DoModelo(
  secoes: readonly Secao[],
  respostas: readonly RespostaDoModelo[],
  contexto?: ContextoDoModelo,
): ResultadoNr1DoModelo {
  const r = calcularNr1(
    respostas.map((x) => ({ valores: respostaPorChave(secoes, x.valores) })),
    { sigilo: contexto?.sigilo ?? null, saudeLegada: saudeLegadaDe(secoes) },
  );
  return { modelo: "copsoq", ...r, ...pressaoERecursos(r) };
}

/** Uma pessoa, comparada com o time (quando as respostas vêm junto). */
export function individualNr1DoModelo(
  secoes: readonly Secao[],
  valores: ReadonlyMap<string, unknown>,
  respostas?: readonly RespostaDoModelo[],
): IndividualNr1DoModelo {
  const saudeLegada = saudeLegadaDe(secoes);
  const time = respostas
    ? calcularNr1(
        respostas.map((x) => ({
          valores: respostaPorChave(secoes, x.valores),
        })),
        { sigilo: null, saudeLegada },
      )
    : null;
  return {
    modelo: "copsoq",
    ...individualNr1(respostaPorChave(secoes, valores), time, saudeLegada),
  };
}
