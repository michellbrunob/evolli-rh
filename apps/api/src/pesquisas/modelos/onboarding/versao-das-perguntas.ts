import type { Pergunta, Secao } from "../../pesquisas.types";

/**
 * T216 — Onboarding: as perguntas mudam depois das primeiras respostas
 * criando uma nova versão (o onboarding roda por meses; travar as perguntas
 * travaria a pesquisa). Regra (função pura):
 *
 * - Pergunta já respondida que mudou (texto, tipo, opções, obrigatoriedade
 *   ou condição) ganha um id novo: as respostas dadas continuam ligadas à
 *   versão em que foram respondidas e não se misturam com as da nova.
 * - Pergunta sem resposta muda no lugar; incluir e excluir é livre (as
 *   respostas de uma pergunta excluída ficam guardadas).
 * - Condições que apontam para uma pergunta que ganhou id novo passam a
 *   apontar para a nova versão.
 */

/** JSON com as chaves em ordem (para comparar o conteúdo). */
function canonico(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonico).join(",")}]`;
  if (v && typeof v === "object") {
    return `{${Object.keys(v as Record<string, unknown>)
      .sort()
      .map(
        (k) =>
          `${JSON.stringify(k)}:${canonico((v as Record<string, unknown>)[k])}`,
      )
      .join(",")}}`;
  }
  return JSON.stringify(v ?? null);
}

export interface NovaVersao {
  secoes: Secao[];
  /** id antigo → id da nova versão. */
  versoes: Record<string, string>;
}

export function novaVersaoDasPerguntas(
  antes: readonly Secao[],
  depois: readonly Secao[],
  respondidas: ReadonlySet<string>,
  novoId: () => string,
): NovaVersao {
  const anteriores = new Map<string, Pergunta>(
    antes.flatMap((s) => s.perguntas.map((p) => [p.id, p] as const)),
  );
  const versoes: Record<string, string> = {};
  for (const s of depois) {
    for (const p of s.perguntas) {
      const antiga = anteriores.get(p.id);
      if (antiga && respondidas.has(p.id) && canonico(antiga) !== canonico(p)) {
        versoes[p.id] = novoId();
      }
    }
  }
  const secoes = depois.map((s) => ({
    ...s,
    perguntas: s.perguntas.map((p) => ({
      ...p,
      id: versoes[p.id] ?? p.id,
      condicao:
        p.condicao && versoes[p.condicao.perguntaId]
          ? { ...p.condicao, perguntaId: versoes[p.condicao.perguntaId]! }
          : p.condicao,
    })),
  }));
  return { secoes, versoes };
}
