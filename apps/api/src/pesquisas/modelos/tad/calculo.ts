/**
 * T216 — o resultado da Motivação (TAD).
 *
 * Por pessoa: item invertido vale `8 − resposta`; o pilar é a média dos
 * itens dele (duas casas) e o score geral é a média dos 3 pilares (não dos
 * 21 itens). O time é a média dos scores de cada pessoa (geral e por
 * pilar). Níveis: alto 5,5–7,0 · moderado 3,5–5,4 · baixo 1,0–3,4. O
 * resultado da pessoa vem com o time ao lado, e o indicador da aba Respostas
 * é o score geral dela com o nível. Funções puras.
 */
import type { Secao } from "../../pesquisas.types";
import { duasCasas, media, perguntasPorChave } from "../comum";
import type {
  ResumoDaRespostaTad,
  NivelTad,
  PilarTad,
  RespostaDoModelo,
  ResultadoIndividualTad,
  ResultadoTad,
} from "../tipos";
import { ITENS_TAD, PILARES_TAD } from "./definicao";

export function nivelDaTad(score: number): NivelTad {
  if (score >= 5.5) return "alto";
  if (score >= 3.5) return "moderado";
  return "baixo";
}

/** Os itens da TAD presentes na pesquisa (id da pergunta). */
function itensPresentes(secoes: readonly Secao[]) {
  const porChave = perguntasPorChave(secoes);
  return ITENS_TAD.flatMap((i) => {
    const p = porChave.get(i.chave);
    return p ? [{ ...i, perguntaId: p.id }] : [];
  });
}

function pontos(valor: unknown, invertido: boolean): number | null {
  if (typeof valor !== "number" || !Number.isInteger(valor)) return null;
  if (valor < 1 || valor > 7) return null;
  return invertido ? 8 - valor : valor;
}

function individualComItens(
  itens: ReturnType<typeof itensPresentes>,
  valores: ReadonlyMap<string, unknown>,
): Omit<ResultadoIndividualTad, "time"> | null {
  const pilares: PilarTad[] = PILARES_TAD.map((pilar) => {
    const doPilar = itens.filter((i) => i.pilar === pilar.chave);
    const notas = doPilar
      .map((i) => pontos(valores.get(i.perguntaId), i.invertido))
      .filter((n): n is number => n !== null);
    const m = media(notas);
    const score = m === null ? null : duasCasas(m);
    return {
      chave: pilar.chave,
      rotulo: pilar.rotulo,
      perguntas: doPilar.length,
      score,
      nivel: score === null ? null : nivelDaTad(score),
    };
  });
  const comScore = pilares
    .map((p) => p.score)
    .filter((s): s is number => s !== null);
  if (comScore.length === 0) return null;
  const geral = duasCasas(media(comScore)!);
  return { modelo: "tad", geral, nivel: nivelDaTad(geral), pilares };
}

/**
 * O resultado de uma pessoa; `null` sem nenhuma afirmação respondida. Com o
 * time, a média dele (geral e por pilar) vai junto, para comparar.
 */
export function individualDaTad(
  secoes: readonly Secao[],
  valores: ReadonlyMap<string, unknown>,
  respostas?: readonly RespostaDoModelo[],
): ResultadoIndividualTad | null {
  const pessoa = individualComItens(itensPresentes(secoes), valores);
  if (!pessoa) return null;
  const time = respostas ? calcularTad(secoes, respostas) : null;
  return {
    ...pessoa,
    time: time
      ? { geral: time.geral, pilares: time.pilares.map((p) => p.score) }
      : null,
  };
}

/** O score geral da resposta (1 a 7) com o nível, para a aba Respostas. */
export function indicadorDaTad(
  secoes: readonly Secao[],
  valores: ReadonlyMap<string, unknown>,
): ResumoDaRespostaTad {
  const pessoa = individualComItens(itensPresentes(secoes), valores);
  return {
    modelo: "tad",
    valor: pessoa?.geral ?? null,
    nivel: pessoa?.nivel ?? null,
  };
}

export function calcularTad(
  secoes: readonly Secao[],
  respostas: readonly RespostaDoModelo[],
): ResultadoTad {
  const itens = itensPresentes(secoes);
  const pessoas = respostas
    .map((r) => individualComItens(itens, r.valores))
    .filter((x): x is Omit<ResultadoIndividualTad, "time"> => x !== null);
  const niveis: Record<NivelTad, number> = {
    alto: 0,
    moderado: 0,
    baixo: 0,
  };
  for (const p of pessoas) if (p.nivel) niveis[p.nivel] += 1;
  const geralM = media(
    pessoas.map((p) => p.geral).filter((g): g is number => g !== null),
  );
  const geral = geralM === null ? null : duasCasas(geralM);
  return {
    modelo: "tad",
    respondentes: pessoas.length,
    geral,
    nivel: geral === null ? null : nivelDaTad(geral),
    pilares: PILARES_TAD.map((pilar, i) => {
      const m = media(
        pessoas
          .map((p) => p.pilares[i]!.score)
          .filter((s): s is number => s !== null),
      );
      const score = m === null ? null : duasCasas(m);
      return {
        chave: pilar.chave,
        rotulo: pilar.rotulo,
        perguntas: itens.filter((x) => x.pilar === pilar.chave).length,
        score,
        nivel: score === null ? null : nivelDaTad(score),
      };
    }),
    niveis,
  };
}
