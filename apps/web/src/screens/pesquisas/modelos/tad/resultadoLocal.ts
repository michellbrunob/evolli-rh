/**
 * T216 — Motivação (TAD): o resultado que a própria pessoa vê logo depois
 * de enviar (página pública), calculado no navegador com a mesma regra da
 * API: item invertido vale `8 − resposta`; o pilar é a média dos itens dele
 * (duas casas) e o geral é a média dos 3 pilares. Nada é gravado.
 */
import type { Secao } from "../../../../api/pesquisaPublicaClient";
import type { NivelTad } from "../../../../api/pesquisasClient";
import { ITENS_TAD, PILARES_TAD } from "./catalogo";

export interface PilarLocal {
  readonly chave: string;
  readonly rotulo: string;
  readonly score: number | null;
  readonly nivel: NivelTad | null;
}

export interface ResultadoLocalTad {
  readonly geral: number;
  readonly nivel: NivelTad;
  readonly pilares: readonly PilarLocal[];
}

const duas = (n: number) => Math.round(n * 100) / 100 || 0;

export function nivelLocalDaTad(score: number): NivelTad {
  if (score >= 5.5) return "alto";
  if (score >= 3.5) return "moderado";
  return "baixo";
}

/** `respostas`: id da pergunta → valor marcado (1 a 7). */
export function resultadoLocalDaTad(
  secoes: readonly Secao[],
  respostas: Readonly<Record<string, unknown>>,
): ResultadoLocalTad | null {
  const porChave = new Map(
    secoes
      .flatMap((s) => s.perguntas)
      .flatMap((p) => (p.chave ? [[p.chave, p.id] as const] : [])),
  );
  const pilares = PILARES_TAD.map((pilar): PilarLocal => {
    const notas = ITENS_TAD.filter((i) => i.pilar === pilar.chave).flatMap(
      (i) => {
        const id = porChave.get(i.chave);
        const v = id ? respostas[id] : undefined;
        if (typeof v !== "number" || !Number.isInteger(v) || v < 1 || v > 7)
          return [];
        return [i.invertido ? 8 - v : v];
      },
    );
    const score = notas.length
      ? duas(notas.reduce((a, b) => a + b, 0) / notas.length)
      : null;
    return {
      chave: pilar.chave,
      rotulo: pilar.rotulo,
      score,
      nivel: score === null ? null : nivelLocalDaTad(score),
    };
  });
  const comScore = pilares.flatMap((p) => (p.score === null ? [] : [p.score]));
  if (comScore.length === 0) return null;
  const geral = duas(comScore.reduce((a, b) => a + b, 0) / comScore.length);
  return { geral, nivel: nivelLocalDaTad(geral), pilares };
}
