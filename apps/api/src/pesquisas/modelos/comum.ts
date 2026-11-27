/**
 * T216 — contas comuns dos modelos com cálculo próprio: score 0–100 da
 * concordância, as faixas, os percentuais favorável/neutro/desfavorável, a
 * recomendação (eNPS e LNPS) com a distribuição e a conferência da
 * estrutura fixa. Funções puras.
 */
import type { ErroDeCampo } from "../../common/erros/recusa-por-campo";
import type { Pergunta, Secao } from "../pesquisas.types";
import type {
  EstruturaFixa,
  FaixaDeRecomendacao,
  FaixaDeScore,
  RecomendacaoDoModelo,
} from "./tipos";

/** Duas casas, sem `-0`. */
export function duasCasas(n: number): number {
  return Math.round(n * 100) / 100 || 0;
}

/** Inteiro, sem `-0`. */
export function inteiro(n: number): number {
  return Math.round(n) || 0;
}

export function media(valores: readonly number[]): number | null {
  return valores.length
    ? valores.reduce((a, b) => a + b, 0) / valores.length
    : null;
}

/** A média de 1 a 5 em 0–100: `(média − 1) ÷ 4 × 100`. */
export function scoreDaConcordancia(mediaDe1a5: number): number {
  return ((mediaDe1a5 - 1) / 4) * 100;
}

/** < 50 crítico · 50–69 atenção · 70–84 saudável · ≥ 85 forte. */
export function faixaDoScore(score: number): FaixaDeScore {
  if (score < 50) return "critico";
  if (score < 70) return "atencao";
  if (score < 85) return "saudavel";
  return "forte";
}

/** < 0 crítico · 0–29 em ajuste · 30–69 bom · ≥ 70 excelente. */
export function faixaDaRecomendacao(indice: number): FaixaDeRecomendacao {
  if (indice < 0) return "critico";
  if (indice < 30) return "em_ajuste";
  if (indice < 70) return "bom";
  return "excelente";
}

/** % favorável (4–5), neutro (3) e desfavorável (1–2), inteiros. */
export function percentuais(valores: readonly number[]): {
  favoravel: number | null;
  neutro: number | null;
  desfavoravel: number | null;
} {
  if (valores.length === 0) {
    return { favoravel: null, neutro: null, desfavoravel: null };
  }
  const n = valores.length;
  const fav = valores.filter((v) => v >= 4).length;
  const neu = valores.filter((v) => v === 3).length;
  const des = n - fav - neu;
  return {
    favoravel: inteiro((fav / n) * 100),
    neutro: inteiro((neu / n) * 100),
    desfavoravel: inteiro((des / n) * 100),
  };
}

/** eNPS/LNPS: promotores 9–10, neutros 7–8, detratores 0–6 e as notas. */
export function recomendacao(
  perguntaId: string | null,
  notas: readonly number[],
): RecomendacaoDoModelo {
  let promotores = 0;
  let neutros = 0;
  let detratores = 0;
  const contagem = new Array<number>(11).fill(0);
  for (const n of notas) {
    contagem[n] = (contagem[n] ?? 0) + 1;
    if (n >= 9) promotores += 1;
    else if (n >= 7) neutros += 1;
    else detratores += 1;
  }
  const total = notas.length;
  const indice =
    total === 0 ? null : inteiro(((promotores - detratores) / total) * 100);
  return {
    perguntaId,
    respostas: total,
    promotores,
    neutros,
    detratores,
    indice,
    faixa: indice === null ? null : faixaDaRecomendacao(indice),
    distribuicao: contagem.map((quantidade, valor) => ({ valor, quantidade })),
  };
}

/** As perguntas da pesquisa pela chave do modelo. */
export function perguntasPorChave(
  secoes: readonly Secao[],
): Map<string, Pergunta> {
  const mapa = new Map<string, Pergunta>();
  for (const s of secoes) {
    for (const p of s.perguntas) {
      if (p.chave && !mapa.has(p.chave)) mapa.set(p.chave, p);
    }
  }
  return mapa;
}

/** Os números inteiros que as respostas deram a uma pergunta. */
export function notasDe(
  perguntaId: string,
  respostas: readonly { valores: ReadonlyMap<string, unknown> }[],
): number[] {
  const notas: number[] = [];
  for (const r of respostas) {
    const v = r.valores.get(perguntaId);
    if (typeof v === "number" && Number.isInteger(v)) notas.push(v);
  }
  return notas;
}

/**
 * Metodologia fixa: cada item obrigatório uma vez, com o tipo e a
 * configuração do modelo; os opcionais (comentários) no máximo uma vez; e
 * nenhuma pergunta fora do modelo. Erro único em `secoes`.
 */
export function conferirEstruturaFixa(
  estrutura: EstruturaFixa,
  secoes: readonly Secao[],
): ErroDeCampo[] {
  const recusa: ErroDeCampo[] = [
    { campo: "secoes", motivo: "estrutura_do_modelo" },
  ];
  const itens = new Map(
    [...estrutura.itens, ...estrutura.opcionais].map((i) => [i.chave, i]),
  );
  const vistos = new Set<string>();
  for (const s of secoes) {
    for (const p of s.perguntas) {
      const item = p.chave ? itens.get(p.chave) : undefined;
      if (!item || vistos.has(item.chave)) return recusa;
      vistos.add(item.chave);
      if (p.tipo !== item.tipo) return recusa;
      if (item.config && !item.config(p.config)) return recusa;
      if (item.obrigatoria !== undefined && p.obrigatoria !== item.obrigatoria)
        return recusa;
    }
  }
  return estrutura.itens.every((i) => vistos.has(i.chave)) ? [] : recusa;
}

/** Uma afirmação 1–5 calculada, com as notas brutas (para somar por grupo). */
export interface AfirmacaoCalculada {
  chave: string;
  perguntaId: string;
  dimensao: string;
  subdimensao: string | null;
  notas: number[];
}

/** As afirmações de concordância do modelo presentes na pesquisa. */
export function afirmacoesCalculadas(
  secoes: readonly Secao[],
  respostas: readonly { valores: ReadonlyMap<string, unknown> }[],
  definicao: readonly {
    chave: string;
    dimensao: string;
    subdimensao?: string;
  }[],
): AfirmacaoCalculada[] {
  const porChave = perguntasPorChave(secoes);
  const saida: AfirmacaoCalculada[] = [];
  for (const d of definicao) {
    const p = porChave.get(d.chave);
    if (!p) continue;
    saida.push({
      chave: d.chave,
      perguntaId: p.id,
      dimensao: d.dimensao,
      subdimensao: d.subdimensao ?? null,
      notas: notasDe(p.id, respostas).filter((n) => n >= 1 && n <= 5),
    });
  }
  return saida;
}

/** Média, score e percentuais de uma afirmação. */
export function resumoDaAfirmacao(a: AfirmacaoCalculada) {
  const m = media(a.notas);
  return {
    chave: a.chave,
    perguntaId: a.perguntaId,
    dimensao: a.dimensao,
    subdimensao: a.subdimensao,
    respostas: a.notas.length,
    media: m === null ? null : duasCasas(m),
    score: m === null ? null : inteiro(scoreDaConcordancia(m)),
    ...percentuais(a.notas),
  };
}

/**
 * Um grupo de afirmações (dimensão ou subdimensão): score = média dos scores
 * das afirmações com resposta; percentuais sobre todas as respostas do grupo.
 * A faixa vem do score (`"score"`) ou do % favorável (`"favoravel"`).
 */
export function resumoDoGrupo(
  chave: string,
  rotulo: string,
  afirmacoes: readonly AfirmacaoCalculada[],
  faixaPor: "score" | "favoravel",
) {
  const scores = afirmacoes
    .map((a) => media(a.notas))
    .filter((m): m is number => m !== null)
    .map(scoreDaConcordancia);
  const s = media(scores);
  const notas = afirmacoes.flatMap((a) => a.notas);
  const p = percentuais(notas);
  const score = s === null ? null : inteiro(s);
  const base = faixaPor === "score" ? score : p.favoravel;
  return {
    chave,
    rotulo,
    afirmacoes: afirmacoes.length,
    respostas: notas.length,
    score,
    faixa: base === null ? null : faixaDoScore(base),
    ...p,
    comentarios: 0,
  };
}
