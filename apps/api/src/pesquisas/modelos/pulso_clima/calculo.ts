/**
 * T216 — o resultado do Pulso e Clima: score 0–100 de cada afirmação
 * (`(média − 1) ÷ 4 × 100`), de cada dimensão (média das afirmações dela) e
 * o geral (média das 22); os percentuais favorável (4–5), neutro (3) e
 * desfavorável (1–2); o eNPS e o LNPS com as faixas do modelo; e quantos
 * comentários cada dimensão recebeu (com o texto, o mês e o departamento
 * quando o grupo aparece). Também o resultado de uma pessoa ao lado do time
 * e o indicador da aba Respostas (score 0–100 com a faixa). Funções puras.
 */
import type { Secao } from "../../pesquisas.types";
import {
  afirmacoesCalculadas,
  faixaDoScore,
  inteiro,
  media,
  notasDe,
  perguntasPorChave,
  recomendacao,
  resumoDaAfirmacao,
  resumoDoGrupo,
  scoreDaConcordancia,
} from "../comum";
import type {
  ResumoDaRespostaPulsoClima,
  RespostaDoModelo,
  ResultadoIndividualPulsoClima,
  ResultadoPulsoClima,
  TextoDoComentario,
} from "../tipos";
import {
  AFIRMACOES_PULSO_CLIMA,
  CHAVE_ENPS,
  CHAVE_LNPS,
  DIMENSOES_PULSO_CLIMA,
  chaveDoComentario,
} from "./definicao";

const alfabetica = (a: string, b: string) =>
  a.localeCompare(b, "pt-BR", { sensitivity: "base" }) ||
  (a < b ? -1 : a > b ? 1 : 0);

/**
 * Os textos escritos numa pergunta, do mês mais recente para o mais antigo
 * e, no mesmo mês, em ordem alfabética (a ordem de chegada ajudaria a ligar
 * o texto a quem respondeu).
 */
function textosEscritos(
  perguntaId: string,
  respostas: readonly RespostaDoModelo[],
): TextoDoComentario[] {
  return respostas
    .flatMap((r) => {
      const v = r.valores.get(perguntaId);
      return typeof v === "string" && v.trim() !== ""
        ? [
            {
              texto: v.trim(),
              mes: r.mes ?? null,
              departamento: r.departamento ?? null,
            },
          ]
        : [];
    })
    .sort(
      (a, b) =>
        (b.mes ?? "").localeCompare(a.mes ?? "") ||
        alfabetica(a.texto, b.texto),
    );
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
    if (!p) return [];
    const textos = textosEscritos(p.id, respostas);
    return [{ dimensao, perguntaId: p.id, quantidade: textos.length, textos }];
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

/** O score 0–100 de uma lista de notas 1–5 (média das afirmações). */
function scoreDasNotas(notas: readonly number[]): number | null {
  const m = media(notas.map(scoreDaConcordancia));
  return m === null ? null : inteiro(m);
}

/** As notas 1–5 da pessoa, por afirmação do modelo presente na pesquisa. */
function notasDaPessoa(
  secoes: readonly Secao[],
  valores: ReadonlyMap<string, unknown>,
) {
  const porChave = perguntasPorChave(secoes);
  return AFIRMACOES_PULSO_CLIMA.flatMap((a) => {
    const p = porChave.get(a.chave);
    const v = p ? valores.get(p.id) : undefined;
    return typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 5
      ? [{ dimensao: a.dimensao, nota: v }]
      : [];
  });
}

/** O score geral da resposta (0–100) com a faixa, para a aba Respostas. */
export function indicadorDoPulsoClima(
  secoes: readonly Secao[],
  valores: ReadonlyMap<string, unknown>,
): ResumoDaRespostaPulsoClima {
  const score = scoreDasNotas(
    notasDaPessoa(secoes, valores).map((x) => x.nota),
  );
  return {
    modelo: "pulso_clima",
    valor: score,
    faixa: score === null ? null : faixaDoScore(score),
  };
}

/**
 * O resultado de uma pessoa: o score dela (geral e por dimensão) ao lado do
 * time, quantas afirmações em cada lado, a distribuição de 1 a 5 (pessoa ×
 * % do time), as notas de recomendação com o índice do time e os
 * comentários. `null` sem nenhuma afirmação respondida.
 */
export function individualDoPulsoClima(
  secoes: readonly Secao[],
  valores: ReadonlyMap<string, unknown>,
  respostas: readonly RespostaDoModelo[] = [],
): ResultadoIndividualPulsoClima | null {
  const notas = notasDaPessoa(secoes, valores);
  if (notas.length === 0) return null;
  const time = calcularPulsoClima(secoes, respostas);
  const score = scoreDasNotas(notas.map((x) => x.nota));
  // As notas 1–5 de todo o time, para o % de cada nota.
  const doTime = time.afirmacoes.flatMap((a) =>
    notasDe(a.perguntaId, respostas).filter((n) => n >= 1 && n <= 5),
  );
  const porChave = perguntasPorChave(secoes);
  const nota = (chave: string) => {
    const p = porChave.get(chave);
    const v = p ? valores.get(p.id) : undefined;
    return typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 10
      ? v
      : null;
  };
  return {
    modelo: "pulso_clima",
    score,
    faixa: score === null ? null : faixaDoScore(score),
    scoreTime: time.score,
    favoraveis: notas.filter((x) => x.nota >= 4).length,
    neutras: notas.filter((x) => x.nota === 3).length,
    desfavoraveis: notas.filter((x) => x.nota <= 2).length,
    dimensoes: DIMENSOES_PULSO_CLIMA.map((d) => {
      const s = scoreDasNotas(
        notas.filter((x) => x.dimensao === d.chave).map((x) => x.nota),
      );
      return {
        chave: d.chave,
        rotulo: d.rotulo,
        score: s,
        faixa: s === null ? null : faixaDoScore(s),
        scoreTime:
          time.dimensoes.find((x) => x.chave === d.chave)?.score ?? null,
      };
    }),
    distribuicao: [1, 2, 3, 4, 5].map((valor) => ({
      valor,
      resposta: notas.filter((x) => x.nota === valor).length,
      time: doTime.length
        ? inteiro(
            (doTime.filter((v) => v === valor).length / doTime.length) * 100,
          )
        : 0,
    })),
    enps: { nota: nota(CHAVE_ENPS), indiceTime: time.enps.indice },
    lnps: { nota: nota(CHAVE_LNPS), indiceTime: time.lnps.indice },
    comentarios: [
      ...DIMENSOES_PULSO_CLIMA.map((d) => d.chave),
      "lnps",
      "enps",
    ].flatMap((dimensao) => {
      const p = porChave.get(chaveDoComentario(dimensao));
      const v = p ? valores.get(p.id) : undefined;
      return typeof v === "string" && v.trim() !== ""
        ? [{ dimensao, texto: v.trim() }]
        : [];
    }),
  };
}
