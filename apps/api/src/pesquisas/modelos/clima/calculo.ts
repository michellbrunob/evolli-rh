/**
 * T216 — o resultado da Pesquisa de Clima: o % favorável (4–5), neutro (3)
 * e desfavorável (1–2) e o score 0–100 do geral, de cada dimensão e de cada
 * subdimensão, com a faixa pelo % favorável; e o resumo de cada afirmação.
 * Função pura.
 */
import type { Secao } from "../../pesquisas.types";
import {
  afirmacoesCalculadas,
  resumoDaAfirmacao,
  resumoDoGrupo,
} from "../comum";
import type { RespostaDoModelo, ResultadoClima } from "../tipos";
import { AFIRMACOES_CLIMA, DIMENSOES_CLIMA } from "./definicao";

export function calcularClima(
  secoes: readonly Secao[],
  respostas: readonly RespostaDoModelo[],
): ResultadoClima {
  const afirmacoes = afirmacoesCalculadas(secoes, respostas, AFIRMACOES_CLIMA);
  const geral = resumoDoGrupo("geral", "Geral", afirmacoes, "favoravel");
  return {
    modelo: "clima",
    favoravel: geral.favoravel,
    neutro: geral.neutro,
    desfavoravel: geral.desfavoravel,
    score: geral.score,
    faixa: geral.faixa,
    dimensoes: DIMENSOES_CLIMA.map((d) => {
      const daDimensao = afirmacoes.filter((a) => a.dimensao === d.chave);
      return {
        ...resumoDoGrupo(d.chave, d.rotulo, daDimensao, "favoravel"),
        subdimensoes: d.subdimensoes.map((s) =>
          resumoDoGrupo(
            s.chave,
            s.rotulo,
            daDimensao.filter((a) => a.subdimensao === s.chave),
            "favoravel",
          ),
        ),
      };
    }),
    afirmacoes: afirmacoes.map(resumoDaAfirmacao),
  };
}
