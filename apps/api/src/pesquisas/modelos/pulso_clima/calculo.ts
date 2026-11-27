/**
 * T216 — o resultado do Pulso e Clima: score 0–100 de cada afirmação
 * (`(média − 1) ÷ 4 × 100`), de cada dimensão (média das afirmações dela) e
 * o geral (média das 22); os percentuais favorável (4–5), neutro (3) e
 * desfavorável (1–2); o eNPS e o LNPS com as faixas do modelo; e quantos
 * comentários cada dimensão recebeu. Função pura.
 */
import type { Secao } from "../../pesquisas.types";
import {
  afirmacoesCalculadas,
  notasDe,
  perguntasPorChave,
  recomendacao,
  resumoDaAfirmacao,
  resumoDoGrupo,
} from "../comum";
import type { RespostaDoModelo, ResultadoPulsoClima } from "../tipos";
import {
  AFIRMACOES_PULSO_CLIMA,
  CHAVE_ENPS,
  CHAVE_LNPS,
  DIMENSOES_PULSO_CLIMA,
  chaveDoComentario,
} from "./definicao";

function textosEscritos(
  perguntaId: string,
  respostas: readonly RespostaDoModelo[],
): number {
  return respostas.filter((r) => {
    const v = r.valores.get(perguntaId);
    return typeof v === "string" && v.trim() !== "";
  }).length;
}

export function calcularPulsoClima(
  secoes: readonly Secao[],
  respostas: readonly RespostaDoModelo[],
): ResultadoPulsoClima {
  const porChave = perguntasPorChave(secoes);
  const afirmacoes = afirmacoesCalculadas(
    secoes,
    respostas,
    AFIRMACOES_PULSO_CLIMA,
  );
  const comentarios = [
    ...DIMENSOES_PULSO_CLIMA.map((d) => d.chave),
    "lnps",
    "enps",
  ].flatMap((dimensao) => {
    const p = porChave.get(chaveDoComentario(dimensao));
    return p
      ? [
          {
            dimensao,
            perguntaId: p.id,
            quantidade: textosEscritos(p.id, respostas),
          },
        ]
      : [];
  });
  const dimensoes = DIMENSOES_PULSO_CLIMA.map((d) => ({
    ...resumoDoGrupo(
      d.chave,
      d.rotulo,
      afirmacoes.filter((a) => a.dimensao === d.chave),
      "score",
    ),
    comentarios:
      comentarios.find((c) => c.dimensao === d.chave)?.quantidade ?? 0,
  }));
  const geral = resumoDoGrupo("geral", "Geral", afirmacoes, "score");
  const nps = (chave: string) => {
    const p = porChave.get(chave);
    return recomendacao(
      p?.id ?? null,
      p ? notasDe(p.id, respostas).filter((n) => n >= 0 && n <= 10) : [],
    );
  };
  return {
    modelo: "pulso_clima",
    score: geral.score,
    faixa: geral.faixa,
    favoravel: geral.favoravel,
    neutro: geral.neutro,
    desfavoravel: geral.desfavoravel,
    dimensoes,
    afirmacoes: afirmacoes.map(resumoDaAfirmacao),
    enps: nps(CHAVE_ENPS),
    lnps: nps(CHAVE_LNPS),
    comentarios,
  };
}
