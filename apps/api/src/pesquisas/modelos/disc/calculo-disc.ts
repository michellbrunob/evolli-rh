import { perguntasEmOrdem } from "../../estrutura-pesquisa";
import type { Secao, ValorRespondido } from "../../pesquisas.types";
import {
  AREAS_DO_MAPA,
  FATORES,
  type Fator,
  LIMIARES,
  LIMITES_DO_MAPA,
  type Relacao,
  TIPO_DO_BLOCO,
  relacaoEntre,
} from "./definicao-disc";

/**
 * T216 — Perfil comportamental (DISC): o cálculo puro, sem banco.
 *
 * Individual: 1 ponto por bloco no fator da frase escolhida; o percentual é
 * `round(pontos ÷ blocos respondidos × 100)`; o predominante é o de mais
 * pontos (empate: D, I, S, C). A classificação (mono, bi ou tri, com a
 * intensidade) usa os percentuais ordenados. A posição no mapa de talentos:
 * `x = 50 + ((S + C) − (D + I)) ÷ 2` e `y = 50 − ((I + S) − (D + C)) ÷ 2`,
 * limitados a 2..98; a área é a que contém o ponto.
 *
 * Time: a soma dos pontos de todas as pessoas (percentual sobre o total de
 * escolhas), pessoas por fator predominante, intensidades, diversidade
 * (entropia de Shannon da distribuição de pessoas por predominante, de 0 a
 * 100), fatores ausentes, lacunas (< 20% das pessoas) e a compatibilidade
 * dos pares de pessoas.
 */

export type Pontos = Record<Fator, number>;
export type Intensidade = "puro" | "acentuado" | "moderado" | "equilibrado";
export const INTENSIDADES: readonly Intensidade[] = [
  "puro",
  "acentuado",
  "moderado",
  "equilibrado",
];

export interface ClasseDisc {
  tipo: "mono" | "bi" | "tri";
  /** Os fatores que dão nome ao perfil, do mais forte para o menos. */
  fatores: Fator[];
  /** "D", "DC", "DCS". */
  codigo: string;
  intensidade: Intensidade;
}

export interface PosicaoNoMapa {
  x: number;
  y: number;
  /** O id da área do mapa de talentos. */
  area: number;
}

export interface PerfilDisc {
  pontos: Pontos;
  /** Blocos respondidos (a soma dos pontos). */
  total: number;
  percentuais: Pontos;
  predominante: Fator;
  classe: ClasseDisc;
  posicao: PosicaoNoMapa;
}

export const zerados = (): Pontos => ({ D: 0, I: 0, S: 0, C: 0 });

/** O fator da frase escolhida em cada bloco, somado. */
export function pontosDosValores(
  secoes: readonly Secao[],
  valores: readonly ValorRespondido[],
): Pontos {
  const pontos = zerados();
  const porId = new Map(valores.map((v) => [v.perguntaId, v.valor]));
  for (const p of perguntasEmOrdem(secoes)) {
    if (p.tipo !== TIPO_DO_BLOCO) continue;
    const v = porId.get(p.id) as { opcao?: unknown } | null | undefined;
    const opcao = p.config.opcoes?.find((o) => o.id === v?.opcao);
    if (opcao?.fator) pontos[opcao.fator] += 1;
  }
  return pontos;
}

export function totalDe(pontos: Pontos): number {
  return FATORES.reduce((t, f) => t + pontos[f], 0);
}

/** `round(pontos ÷ total × 100)`; sem pontos, tudo 0. */
export function percentuaisDe(pontos: Pontos): Pontos {
  const total = totalDe(pontos);
  const p = zerados();
  if (total === 0) return p;
  for (const f of FATORES) p[f] = Math.round((pontos[f] / total) * 100);
  return p;
}

/** Os fatores do mais forte para o mais fraco (empate: D, I, S, C). */
export function emOrdem(pontos: Pontos): Fator[] {
  return [...FATORES].sort(
    (a, b) => pontos[b] - pontos[a] || FATORES.indexOf(a) - FATORES.indexOf(b),
  );
}

/** O de mais pontos; empate na ordem D, I, S, C. */
export function predominanteDe(pontos: Pontos): Fator {
  return emOrdem(pontos)[0]!;
}

/**
 * A classificação sobre os percentuais ordenados (1º, 2º, 3º):
 * - mono: 1º ≥ 45 e 1º − 2º ≥ 15 → puro (1º ≥ 60), acentuado (≥ 50) ou
 *   moderado;
 * - bi: 1º − 2º < 15 e 2º − 3º ≥ 10 → acentuado (1º ≥ 40) ou moderado;
 * - tri: 1º − 3º < 20 → equilibrado;
 * - senão, bi moderado.
 * A ordem dos fatores vem dos pontos (`ordem`), mais precisa que o
 * percentual arredondado.
 */
export function classificar(
  percentuais: Pontos,
  ordem: readonly Fator[] = emOrdem(percentuais),
): ClasseDisc {
  const [f1, f2, f3] = ordem as [Fator, Fator, Fator, Fator];
  const p1 = percentuais[f1];
  const p2 = percentuais[f2];
  const p3 = percentuais[f3];
  const L = LIMIARES;
  if (p1 >= L.monoMinimo && p1 - p2 >= L.monoDistancia) {
    return {
      tipo: "mono",
      fatores: [f1],
      codigo: f1,
      intensidade:
        p1 >= L.puro ? "puro" : p1 >= L.acentuado ? "acentuado" : "moderado",
    };
  }
  if (p1 - p2 < L.biDistancia && p2 - p3 >= L.biSeparacao) {
    return {
      tipo: "bi",
      fatores: [f1, f2],
      codigo: `${f1}${f2}`,
      intensidade: p1 >= L.biAcentuado ? "acentuado" : "moderado",
    };
  }
  if (p1 - p3 < L.triDistancia) {
    return {
      tipo: "tri",
      fatores: [f1, f2, f3],
      codigo: `${f1}${f2}${f3}`,
      intensidade: "equilibrado",
    };
  }
  return {
    tipo: "bi",
    fatores: [f1, f2],
    codigo: `${f1}${f2}`,
    intensidade: "moderado",
  };
}

const limitar = (n: number) =>
  Math.min(LIMITES_DO_MAPA.maximo, Math.max(LIMITES_DO_MAPA.minimo, n));

/** Arredonda a uma casa (o ponto no mapa), sem `-0`. */
const umaCasa = (n: number) => Math.round(n * 10) / 10 || 0;

/** A área que contém o ponto; fora de todas, a de centro mais próximo. */
export function areaDoPonto(x: number, y: number): number {
  const dentro = AREAS_DO_MAPA.find(
    (a) => x >= a.x[0] && x < a.x[1] && y >= a.y[0] && y < a.y[1],
  );
  if (dentro) return dentro.id;
  let melhor = AREAS_DO_MAPA[0]!;
  let menor = Number.POSITIVE_INFINITY;
  for (const a of AREAS_DO_MAPA) {
    const cx = (a.x[0] + a.x[1]) / 2;
    const cy = (a.y[0] + a.y[1]) / 2;
    const d = (cx - x) ** 2 + (cy - y) ** 2;
    if (d < menor) {
      menor = d;
      melhor = a;
    }
  }
  return melhor.id;
}

/** O ponto no mapa de talentos (0–100), a partir dos percentuais. */
export function posicaoNoMapa(p: Pontos): PosicaoNoMapa {
  const x = umaCasa(limitar(50 + (p.S + p.C - (p.D + p.I)) / 2));
  const y = umaCasa(limitar(50 - (p.I + p.S - (p.D + p.C)) / 2));
  return { x, y, area: areaDoPonto(x, y) };
}

/** O perfil completo a partir dos pontos de uma pessoa (ou do time). */
export function perfilDe(pontos: Pontos): PerfilDisc {
  const percentuais = percentuaisDe(pontos);
  const ordem = emOrdem(pontos);
  return {
    pontos: { ...pontos },
    total: totalDe(pontos),
    percentuais,
    predominante: ordem[0]!,
    classe: classificar(percentuais, ordem),
    posicao: posicaoNoMapa(percentuais),
  };
}

// ------------------------------------------------------------------- time

export type FaixaDeDiversidade =
  "pouco_diverso" | "moderado" | "equilibrado" | "altamente_diverso";

export interface Diversidade {
  /** 0–100: entropia de Shannon (bits) ÷ 2 × 100, arredondada. */
  score: number;
  faixa: FaixaDeDiversidade;
  /** Fatores que não são predominantes em ninguém. */
  ausentes: Fator[];
}

/** Pouco diverso 0–39 · moderado 40–59 · equilibrado 60–79 · alto 80–100. */
export function faixaDaDiversidade(score: number): FaixaDeDiversidade {
  if (score < 40) return "pouco_diverso";
  if (score < 60) return "moderado";
  if (score < 80) return "equilibrado";
  return "altamente_diverso";
}

/** Diversidade pela distribuição de pessoas por fator predominante. */
export function diversidadeDe(porPredominante: Pontos): Diversidade {
  const total = totalDe(porPredominante);
  let h = 0;
  for (const f of FATORES) {
    if (porPredominante[f] === 0 || total === 0) continue;
    const p = porPredominante[f] / total;
    h -= p * Math.log2(p);
  }
  const score = total === 0 ? 0 : Math.round((Math.abs(h) / 2) * 100);
  return {
    score,
    faixa: faixaDaDiversidade(score),
    ausentes:
      total === 0 ? [] : FATORES.filter((f) => porPredominante[f] === 0),
  };
}

/**
 * Lacunas: fatores predominantes em menos de 20% das pessoas, do menos
 * presente para o mais (empate: D, I, S, C), até 2.
 */
export function lacunasDe(porPredominante: Pontos): Fator[] {
  const total = totalDe(porPredominante);
  if (total === 0) return [];
  return [...FATORES]
    .filter((f) => (porPredominante[f] / total) * 100 < LIMIARES.lacuna)
    .sort(
      (a, b) =>
        porPredominante[a] - porPredominante[b] ||
        FATORES.indexOf(a) - FATORES.indexOf(b),
    )
    .slice(0, LIMIARES.lacunasNoMaximo);
}

export type TipoDoPar = "mesma_linguagem" | "complementar" | "pede_atencao";

export interface ParDeFatores {
  a: Fator;
  b: Fator;
  relacao: Relacao;
  tipo: TipoDoPar;
  /** Pares de pessoas: n(n−1)/2 no mesmo fator; nA × nB entre fatores. */
  pares: number;
}

export interface Compatibilidade {
  /** Os 10 pares de fatores, na ordem D, I, S, C. */
  matriz: ParDeFatores[];
  totalDePares: number;
  /** Pares de pessoas de cada tipo (e o percentual sobre o total). */
  porTipo: Record<TipoDoPar, { pares: number; percentual: number }>;
  /** O par de fatores em atrito com mais pares de pessoas. */
  maiorAtencao: { a: Fator; b: Fator; pares: number } | null;
}

/** Mesmo fator → mesma linguagem; atrito → pede atenção; senão, complementar. */
export function tipoDoPar(a: Fator, b: Fator): TipoDoPar {
  if (a === b) return "mesma_linguagem";
  return relacaoEntre(a, b) === "atrito" ? "pede_atencao" : "complementar";
}

export function compatibilidadeDe(porPredominante: Pontos): Compatibilidade {
  const matriz: ParDeFatores[] = [];
  for (let i = 0; i < FATORES.length; i += 1) {
    for (let j = i; j < FATORES.length; j += 1) {
      const a = FATORES[i]!;
      const b = FATORES[j]!;
      const na = porPredominante[a];
      const nb = porPredominante[b];
      matriz.push({
        a,
        b,
        relacao: relacaoEntre(a, b),
        tipo: tipoDoPar(a, b),
        pares: a === b ? (na * (na - 1)) / 2 : na * nb,
      });
    }
  }
  const totalDePares = matriz.reduce((t, m) => t + m.pares, 0);
  const porTipo = {} as Compatibilidade["porTipo"];
  for (const tipo of [
    "mesma_linguagem",
    "complementar",
    "pede_atencao",
  ] as const) {
    const pares = matriz
      .filter((m) => m.tipo === tipo)
      .reduce((t, m) => t + m.pares, 0);
    porTipo[tipo] = {
      pares,
      percentual: totalDePares ? Math.round((pares / totalDePares) * 100) : 0,
    };
  }
  let maiorAtencao: Compatibilidade["maiorAtencao"] = null;
  for (const m of matriz) {
    if (m.tipo !== "pede_atencao" || m.pares === 0) continue;
    if (maiorAtencao === null || m.pares > maiorAtencao.pares) {
      maiorAtencao = { a: m.a, b: m.b, pares: m.pares };
    }
  }
  return { matriz, totalDePares, porTipo, maiorAtencao };
}

export interface ResumoDoTime {
  /** O perfil sobre a soma dos pontos de todas as pessoas. */
  perfil: PerfilDisc | null;
  /** Pessoas com perfil (respostas com ao menos um bloco). */
  totalDePessoas: number;
  porPredominante: Pontos;
  intensidades: Record<Intensidade, number>;
  /** Quantas pessoas em cada área do mapa (só as que têm alguém). */
  areas: { area: number; pessoas: number }[];
  diversidade: Diversidade;
  lacunas: Fator[];
  compatibilidade: Compatibilidade;
}

/** O retrato do time a partir dos perfis de cada pessoa. */
export function resumoDoTime(perfis: readonly PerfilDisc[]): ResumoDoTime {
  const soma = zerados();
  const porPredominante = zerados();
  const intensidades: Record<Intensidade, number> = {
    puro: 0,
    acentuado: 0,
    moderado: 0,
    equilibrado: 0,
  };
  const porArea = new Map<number, number>();
  for (const p of perfis) {
    for (const f of FATORES) soma[f] += p.pontos[f];
    porPredominante[p.predominante] += 1;
    intensidades[p.classe.intensidade] += 1;
    porArea.set(p.posicao.area, (porArea.get(p.posicao.area) ?? 0) + 1);
  }
  const ordemDasAreas = AREAS_DO_MAPA.map((a) => a.id);
  return {
    perfil: perfis.length ? perfilDe(soma) : null,
    totalDePessoas: perfis.length,
    porPredominante,
    intensidades,
    areas: [...porArea]
      .map(([area, pessoas]) => ({ area, pessoas }))
      .sort(
        (a, b) =>
          b.pessoas - a.pessoas ||
          ordemDasAreas.indexOf(a.area) - ordemDasAreas.indexOf(b.area),
      ),
    diversidade: diversidadeDe(porPredominante),
    lacunas: lacunasDe(porPredominante),
    compatibilidade: compatibilidadeDe(porPredominante),
  };
}
