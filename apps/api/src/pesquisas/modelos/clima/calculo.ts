/**
 * T216 — o resultado da Pesquisa de Clima. O índice é o % favorável (4–5)
 * sobre todas as respostas das afirmações; cada dimensão e subdimensão tem
 * o dela (e o neutro, 3, e o desfavorável, 1–2), com a faixa própria do
 * Clima: < 50 crítica · 50–64 atenção · 65–79 boa · ≥ 80 excelente.
 *
 * As afirmações vêm da pesquisa (as 60 do modelo que ficaram e as
 * acrescentadas pelo RH, cada uma na dimensão dela). Funções puras.
 */
import type { Secao } from "../../pesquisas.types";
import {
  afirmacoesCalculadas,
  duasCasas,
  inteiro,
  media,
  percentuais,
  resumoDaAfirmacao,
  resumoDoGrupo,
  type AfirmacaoCalculada,
} from "../comum";
import type {
  DimensaoClima,
  FaixaClima,
  RespostaDoModelo,
  ResultadoClima,
  ResultadoIndividualClima,
  ResumoDaRespostaClima,
} from "../tipos";
import { DIMENSOES_CLIMA, afirmacoesDaPesquisa } from "./definicao";

/** < 50 crítica · 50–64 atenção · 65–79 boa · ≥ 80 excelente. */
export function faixaDoClima(favoravel: number): FaixaClima {
  if (favoravel < 50) return "critica";
  if (favoravel < 65) return "atencao";
  if (favoravel < 80) return "boa";
  return "excelente";
}

const faixaOuNada = (v: number | null): FaixaClima | null =>
  v === null ? null : faixaDoClima(v);

function grupo(
  chave: string,
  rotulo: string,
  afirmacoes: readonly AfirmacaoCalculada[],
): DimensaoClima {
  const g = resumoDoGrupo(chave, rotulo, afirmacoes, "favoravel");
  return { ...g, faixa: faixaOuNada(g.favoravel) };
}

function contagem(notas: readonly number[]) {
  return {
    favoraveis: notas.filter((n) => n >= 4).length,
    neutras: notas.filter((n) => n === 3).length,
    desfavoraveis: notas.filter((n) => n <= 2).length,
  };
}

/** % favorável inteiro, ou `null` sem notas. */
function indiceDe(notas: readonly number[]): number | null {
  return percentuais(notas).favoravel;
}

const notasDa = (
  afirmacoes: readonly AfirmacaoCalculada[],
  dimensao?: string,
): number[] =>
  afirmacoes
    .filter((a) => dimensao === undefined || a.dimensao === dimensao)
    .flatMap((a) => a.notas);

export function calcularClima(
  secoes: readonly Secao[],
  respostas: readonly RespostaDoModelo[],
): ResultadoClima {
  const afirmacoes = afirmacoesCalculadas(
    secoes,
    respostas,
    afirmacoesDaPesquisa(secoes),
  );
  const geral = grupo("geral", "Geral", afirmacoes);
  return {
    modelo: "clima",
    favoravel: geral.favoravel,
    neutro: geral.neutro,
    desfavoravel: geral.desfavoravel,
    notas: contagem(notasDa(afirmacoes)),
    score: geral.score,
    faixa: geral.faixa,
    dimensoes: DIMENSOES_CLIMA.map((d) => {
      const daDimensao = afirmacoes.filter((a) => a.dimensao === d.chave);
      return {
        ...grupo(d.chave, d.rotulo, daDimensao),
        subdimensoes: d.subdimensoes.map((s) =>
          grupo(
            s.chave,
            s.rotulo,
            daDimensao.filter((a) => a.subdimensao === s.chave),
          ),
        ),
      };
    }),
    afirmacoes: afirmacoes.map(resumoDaAfirmacao),
  };
}

/** O índice de uma resposta (a lista da aba Respostas). */
export function resumoDaRespostaDoClima(
  secoes: readonly Secao[],
  valores: ReadonlyMap<string, unknown>,
): ResumoDaRespostaClima {
  const indice = indiceDe(
    notasDa(
      afirmacoesCalculadas(secoes, [{ valores }], afirmacoesDaPesquisa(secoes)),
    ),
  );
  return { modelo: "clima", indice, faixa: faixaOuNada(indice) };
}

/**
 * Uma resposta comparada com o time (todas as respostas visíveis): o
 * índice e as contagens da pessoa, o índice de cada dimensão, a nota de
 * cada afirmação com a média e o % favorável do time, e a distribuição
 * das notas 1 a 5 (quantas da pessoa; % do time).
 */
export function individualDoClima(
  secoes: readonly Secao[],
  valores: ReadonlyMap<string, unknown>,
  respostas?: readonly RespostaDoModelo[],
): ResultadoIndividualClima {
  const definicao = afirmacoesDaPesquisa(secoes);
  const daPessoa = afirmacoesCalculadas(secoes, [{ valores }], definicao);
  const doTime = respostas
    ? afirmacoesCalculadas(secoes, respostas, definicao)
    : null;
  const notas = notasDa(daPessoa);
  const indice = indiceDe(notas);
  const notasDoTime = doTime ? notasDa(doTime) : null;
  const indiceDoTime = notasDoTime ? indiceDe(notasDoTime) : null;
  const porNota = (lista: readonly number[]) =>
    [1, 2, 3, 4, 5].map((n) => lista.filter((x) => x === n).length);
  return {
    modelo: "clima",
    indice,
    faixa: faixaOuNada(indice),
    ...contagem(notas),
    time: notasDoTime
      ? { indice: indiceDoTime, faixa: faixaOuNada(indiceDoTime) }
      : null,
    dimensoes: DIMENSOES_CLIMA.map((d) => {
      const i = indiceDe(notasDa(daPessoa, d.chave));
      return {
        chave: d.chave,
        rotulo: d.rotulo,
        indice: i,
        faixa: faixaOuNada(i),
        time: doTime ? indiceDe(notasDa(doTime, d.chave)) : null,
      };
    }),
    afirmacoes: daPessoa.map((a, i) => {
      const time = doTime?.[i]?.notas ?? null;
      const m = time ? media(time) : null;
      return {
        chave: a.chave,
        perguntaId: a.perguntaId,
        dimensao: a.dimensao,
        nota: a.notas[0] ?? null,
        mediaTime: m === null ? null : duasCasas(m),
        favoravelTime: time ? indiceDe(time) : null,
      };
    }),
    distribuicao: {
      resposta: porNota(notas),
      time:
        notasDoTime && notasDoTime.length > 0
          ? porNota(notasDoTime).map((q) =>
              inteiro((q / notasDoTime.length) * 100),
            )
          : null,
    },
  };
}
