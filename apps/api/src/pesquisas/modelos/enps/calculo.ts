/**
 * T216 — o resultado do eNPS: o índice (% de promotores 9–10 menos % de
 * detratores 0–6, de −100 a 100) com a zona (crítica < 0 · aperfeiçoamento
 * 0–49 · qualidade 50–74 · excelência 75–100) e a distribuição 0–10; as
 * complementares (média de 0 a 10 com uma casa, contagem por grupo e o
 * quanto cada uma acompanha a nota principal), da maior média para a menor;
 * e o resultado de uma pessoa comparado com o time. Funções puras.
 */
import type { Pergunta, Secao, ZonaEnps } from "../../pesquisas.types";
import { media, notasDe, recomendacao } from "../comum";
import type { RespostaDoModelo } from "../tipos";
import {
  CHAVE_PRINCIPAL_DO_ENPS,
  ehComplementarDoEnps,
  ehNotaDoEnps,
} from "./definicao";

export type GrupoDoEnps = "promotor" | "neutro" | "detrator";

/** Uma complementar (nota de 0 a 10) no agregado. */
export interface ComplementarDoEnps {
  perguntaId: string;
  respostas: number;
  /** De 0 a 10, uma casa. */
  media: number | null;
  /** Quantas notas 0–6, 7–8 e 9–10. */
  detratores: number;
  neutros: number;
  promotores: number;
  /**
   * O quanto a nota acompanha a principal (correlação de −1 a 1, duas
   * casas); `null` com menos de 3 pares ou sem variação.
   */
  peso: number | null;
}

export interface ResultadoEnps {
  modelo: "enps";
  /** A pergunta principal (`null` se a pesquisa não a tem). */
  perguntaId: string | null;
  /** Notas dadas à principal. */
  respostas: number;
  promotores: number;
  neutros: number;
  detratores: number;
  /** −100 a 100; `null` sem notas. */
  indice: number | null;
  zona: ZonaEnps | null;
  /** As notas de 0 a 10 da principal, com zeros. */
  distribuicao: { valor: number; quantidade: number }[];
  /** As complementares, da maior média para a menor (empate: a ordem). */
  complementares: ComplementarDoEnps[];
}

/** Uma complementar da pessoa, comparada com o time. */
export interface ComplementarIndividualDoEnps {
  perguntaId: string;
  nota: number | null;
  /** Média do time (0 a 10, uma casa). */
  time: number | null;
  /** Nota − média do time (uma casa). */
  diferenca: number | null;
}

export interface ResultadoIndividualEnps {
  modelo: "enps";
  /** A nota da principal. */
  nota: number | null;
  grupo: GrupoDoEnps | null;
  enpsTime: number | null;
  /** % de promotores no time (inteiro). */
  promotoresTime: number | null;
  zonaTime: ZonaEnps | null;
  /** Na ordem da pesquisa. */
  complementares: ComplementarIndividualDoEnps[];
}

/** Crítica < 0 · aperfeiçoamento 0–49 · qualidade 50–74 · excelência 75–100. */
export function zonaDoEnps(indice: number): ZonaEnps {
  if (indice < 0) return "critica";
  if (indice < 50) return "aperfeicoamento";
  if (indice < 75) return "qualidade";
  return "excelencia";
}

/** 9–10 promotor · 7–8 neutro · 0–6 detrator. */
export function grupoDoEnps(nota: number): GrupoDoEnps {
  if (nota >= 9) return "promotor";
  if (nota >= 7) return "neutro";
  return "detrator";
}

/** Uma casa, arredondando para longe do zero (−5,25 → −5,3). */
function umaCasa(n: number): number {
  return (Math.sign(n) * Math.round(Math.abs(n) * 10)) / 10 || 0;
}

const notaValida = (v: unknown): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 10;

/** As perguntas do eNPS na pesquisa: a principal e as complementares. */
function perguntasDoEnps(secoes: readonly Secao[]): {
  principal: Pergunta | null;
  complementares: Pergunta[];
} {
  const todas = secoes.flatMap((s) => s.perguntas);
  const principal =
    todas.find((p) => p.chave === CHAVE_PRINCIPAL_DO_ENPS && ehNotaDoEnps(p)) ??
    todas.find(ehNotaDoEnps) ??
    null;
  return {
    principal,
    complementares: todas.filter(
      (p) => p !== principal && ehComplementarDoEnps(p),
    ),
  };
}

/** Correlação de Pearson (duas casas); `null` com < 3 pares ou sem variação. */
function correlacao(pares: readonly [number, number][]): number | null {
  if (pares.length < 3) return null;
  const mx = media(pares.map((p) => p[0]))!;
  const my = media(pares.map((p) => p[1]))!;
  let cov = 0;
  let vx = 0;
  let vy = 0;
  for (const [x, y] of pares) {
    cov += (x - mx) * (y - my);
    vx += (x - mx) ** 2;
    vy += (y - my) ** 2;
  }
  if (vx === 0 || vy === 0) return null;
  return Math.round((cov / Math.sqrt(vx * vy)) * 100) / 100 || 0;
}

export function calcularEnps(
  secoes: readonly Secao[],
  respostas: readonly RespostaDoModelo[],
): ResultadoEnps {
  const { principal, complementares } = perguntasDoEnps(secoes);
  const notas = principal
    ? notasDe(principal.id, respostas).filter(notaValida)
    : [];
  const r = recomendacao(principal?.id ?? null, notas);
  const resumo = complementares.map((p, ordem) => {
    const daPergunta = notasDe(p.id, respostas).filter(notaValida);
    const m = media(daPergunta);
    const pares: [number, number][] = [];
    if (principal) {
      for (const x of respostas) {
        const c = x.valores.get(p.id);
        const n = x.valores.get(principal.id);
        if (notaValida(c) && notaValida(n)) pares.push([c, n]);
      }
    }
    return {
      ordem,
      c: {
        perguntaId: p.id,
        respostas: daPergunta.length,
        media: m === null ? null : umaCasa(m),
        detratores: daPergunta.filter((n) => n <= 6).length,
        neutros: daPergunta.filter((n) => n === 7 || n === 8).length,
        promotores: daPergunta.filter((n) => n >= 9).length,
        peso: correlacao(pares),
      },
      exata: m,
    };
  });
  resumo.sort((a, b) => (b.exata ?? -1) - (a.exata ?? -1) || a.ordem - b.ordem);
  return {
    modelo: "enps",
    perguntaId: r.perguntaId,
    respostas: r.respostas,
    promotores: r.promotores,
    neutros: r.neutros,
    detratores: r.detratores,
    indice: r.indice,
    zona: r.indice === null ? null : zonaDoEnps(r.indice),
    distribuicao: r.distribuicao,
    complementares: resumo.map((x) => x.c),
  };
}

/**
 * O eNPS de uma pesquisa para a evolução: na confidencial, abaixo do
 * mínimo por grupo, nada (`null`) — a mesma regra da visão geral.
 */
export function enpsVisivel(
  secoes: readonly Secao[],
  respostas: readonly (readonly { perguntaId: string; valor: unknown }[])[],
  minimoPorGrupo: number,
  minimoNaVisaoGeral: boolean,
): number | null {
  if (minimoNaVisaoGeral && respostas.length < minimoPorGrupo) return null;
  return calcularEnps(
    secoes,
    respostas.map((r) => ({
      valores: new Map(r.map((v) => [v.perguntaId, v.valor])),
    })),
  ).indice;
}

/** A nota principal de uma resposta (a coluna da lista), ou `null`. */
export function notaPrincipalDoEnps(
  secoes: readonly Secao[],
  valores: ReadonlyMap<string, unknown>,
): { nota: number; grupo: GrupoDoEnps } | null {
  const { principal } = perguntasDoEnps(secoes);
  const v = principal ? valores.get(principal.id) : undefined;
  return notaValida(v) ? { nota: v, grupo: grupoDoEnps(v) } : null;
}

/** O resultado de uma pessoa, comparado com o time (as respostas visíveis). */
export function individualDoEnps(
  secoes: readonly Secao[],
  valores: ReadonlyMap<string, unknown>,
  respostas: readonly RespostaDoModelo[] = [],
): ResultadoIndividualEnps | null {
  const { principal, complementares } = perguntasDoEnps(secoes);
  if (!principal && complementares.length === 0) return null;
  const v = principal ? valores.get(principal.id) : undefined;
  const nota = notaValida(v) ? v : null;
  const time = principal
    ? recomendacao(
        principal.id,
        notasDe(principal.id, respostas).filter(notaValida),
      )
    : null;
  return {
    modelo: "enps",
    nota,
    grupo: nota === null ? null : grupoDoEnps(nota),
    enpsTime: time?.indice ?? null,
    promotoresTime:
      time && time.respostas > 0
        ? Math.round((time.promotores / time.respostas) * 100)
        : null,
    zonaTime:
      time?.indice === null || time === null ? null : zonaDoEnps(time.indice),
    complementares: complementares.map((p) => {
      const m = media(notasDe(p.id, respostas).filter(notaValida));
      const c = valores.get(p.id);
      const n = notaValida(c) ? c : null;
      return {
        perguntaId: p.id,
        nota: n,
        time: m === null ? null : umaCasa(m),
        diferenca: n === null || m === null ? null : umaCasa(n - m),
      };
    }),
  };
}
