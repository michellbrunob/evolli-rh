import {
  arredondar,
  calcularIndicadores,
  ehDeEscala,
  gruposDoCampo,
  mediaDaResposta,
  paraDez,
  resultadoDasPerguntas,
} from "./calculo-resultados";
import { perguntasEmOrdem } from "./estrutura-pesquisa";
import type {
  AnalisesPesquisa,
  CampoGrupo,
  GruposDaResposta,
  MotivoOculto,
  RespostaDetalhe,
  Secao,
  ValorRespondido,
} from "./pesquisas.types";

/**
 * T216 — análises (mapa de médias por grupo × pergunta e a evolução entre
 * pesquisas do mesmo modelo) e a resposta individual comparada com o time.
 * Funções puras; as médias vão na escala 0–10.
 */

export interface RespostaDaAnalise {
  valores: readonly ValorRespondido[];
  grupos: GruposDaResposta;
}

/** Média geral (0–10) das respostas, sem o mínimo. */
function mediaGeralDe(
  secoes: readonly Secao[],
  respostas: readonly RespostaDaAnalise[],
): number | null {
  return calcularIndicadores(
    secoes,
    resultadoDasPerguntas(
      secoes,
      respostas.map((r) => ({ valores: r.valores, autor: null })),
    ),
  ).mediaGeral;
}

/**
 * Média geral (0–10) para a evolução: na confidencial, abaixo do mínimo por
 * grupo, nada (`null`) — a mesma regra da visão geral.
 */
export function mediaGeralVisivel(
  secoes: readonly Secao[],
  respostas: readonly RespostaDaAnalise[],
  minimoPorGrupo: number,
  minimoNaVisaoGeral: boolean,
): number | null {
  if (minimoNaVisaoGeral && respostas.length < minimoPorGrupo) return null;
  return mediaGeralDe(secoes, respostas);
}

/**
 * Média (0–10) de várias respostas, cada uma na sua própria estrutura: a
 * média de cada resposta nas perguntas de escala e, delas, a média. Sem
 * resposta com nota de escala: `null`.
 */
export function mediaDasRespostas(
  respostas: readonly {
    secoes: readonly Secao[];
    valores: readonly ValorRespondido[];
  }[],
): number | null {
  const medias = respostas
    .map((r) =>
      mediaDaResposta(
        r.secoes,
        new Map(r.valores.map((v) => [v.perguntaId, v.valor])),
      ),
    )
    .filter((m): m is number => m !== null);
  return medias.length
    ? arredondar(medias.reduce((a, b) => a + b, 0) / medias.length)
    : null;
}

export interface EntradaDasAnalises {
  campo: CampoGrupo;
  secoes: readonly Secao[];
  respostas: readonly RespostaDaAnalise[];
  nomesDosGrupos: ReadonlyMap<string, string>;
  minimoPorGrupo: number;
  minimoNaVisaoGeral: boolean;
  evolucao: AnalisesPesquisa["evolucao"];
}

/**
 * O mapa: a linha "Toda a empresa" e uma por grupo com respostas, colunas
 * nas perguntas de escala (pelo rótulo curto). Grupo abaixo do mínimo fica
 * oculto (sem números).
 */
export function montarAnalises(e: EntradaDasAnalises): AnalisesPesquisa {
  const deEscala = perguntasEmOrdem(e.secoes).filter(ehDeEscala);
  const colunas = deEscala.map((p) => ({
    perguntaId: p.id,
    rotulo: p.rotulo ?? p.texto,
  }));

  const linha = (
    grupoId: string | null,
    nome: string,
    respostas: readonly RespostaDaAnalise[],
    oculto: MotivoOculto | null,
  ): AnalisesPesquisa["linhas"][number] => {
    if (oculto !== null) {
      return {
        grupoId,
        nome,
        respostas: respostas.length,
        visivel: false,
        oculto,
        media: null,
        medias: colunas.map(() => null),
      };
    }
    const resultado = resultadoDasPerguntas(
      e.secoes,
      respostas.map((r) => ({ valores: r.valores, autor: null })),
    );
    const porId = new Map(resultado.map((r) => [r.perguntaId, r]));
    return {
      grupoId,
      nome,
      respostas: respostas.length,
      visivel: true,
      oculto: null,
      media: calcularIndicadores(e.secoes, resultado).mediaGeral,
      medias: deEscala.map((p) => {
        const media = (porId.get(p.id) as { media?: number | null })?.media;
        return media === undefined || media === null
          ? null
          : arredondar(paraDez(p, media));
      }),
    };
  };

  const linhas = [
    linha(
      null,
      "Toda a empresa",
      e.respostas,
      !e.minimoNaVisaoGeral || e.respostas.length >= e.minimoPorGrupo
        ? null
        : "minimo",
    ),
  ];
  for (const g of gruposDoCampo(
    e.campo,
    e.respostas,
    e.nomesDosGrupos,
    e.minimoPorGrupo,
  )) {
    linhas.push(
      linha(
        g.id,
        g.nome,
        e.respostas.filter((r) => r.grupos[e.campo] === g.id),
        g.oculto,
      ),
    );
  }
  return { campo: e.campo, colunas, linhas, evolucao: e.evolucao };
}

/**
 * A resposta `indice` (na ordem da lista) comparada com o time: o valor de
 * cada pergunta com a média do time (escalas e números, na escala da
 * pergunta), a média dela e a do time (0–10), a nota de recomendação (eNPS)
 * e o eNPS do time, e a nota mais alta e a mais baixa dela.
 */
export function compararComOTime(
  secoes: readonly Secao[],
  todas: readonly { valores: readonly ValorRespondido[] }[],
  indice: number,
): Pick<RespostaDetalhe, "valores"> & {
  indicadores: Omit<RespostaDetalhe["indicadores"], "mediaUltimosPulsos">;
} {
  const time = resultadoDasPerguntas(
    secoes,
    todas.map((r) => ({ valores: r.valores, autor: null })),
  );
  const indicadoresDoTime = calcularIndicadores(secoes, time);
  const mediaDoTime = new Map(
    time.map((r) => [
      r.perguntaId,
      "media" in r && typeof r.media === "number" ? r.media : null,
    ]),
  );
  const resposta = todas[indice]!;
  const valores = new Map(resposta.valores.map((v) => [v.perguntaId, v.valor]));

  let recomendacao: number | null = null;
  let maior: { perguntaId: string; valor: number; dez: number } | null = null;
  let menor: { perguntaId: string; valor: number; dez: number } | null = null;
  for (const p of perguntasEmOrdem(secoes)) {
    const v = valores.get(p.id);
    if (typeof v !== "number") continue;
    if (
      recomendacao === null &&
      p.tipo === "nota_0_10" &&
      p.config.enps === true
    ) {
      recomendacao = v;
    }
    if (!ehDeEscala(p)) continue;
    const dez = paraDez(p, v);
    if (maior === null || dez > maior.dez) {
      maior = { perguntaId: p.id, valor: v, dez };
    }
    if (menor === null || dez < menor.dez) {
      menor = { perguntaId: p.id, valor: v, dez };
    }
  }

  return {
    valores: resposta.valores.map((v) => ({
      perguntaId: v.perguntaId,
      valor: v.valor,
      mediaTime: mediaDoTime.get(v.perguntaId) ?? null,
    })),
    indicadores: {
      media: mediaDaResposta(secoes, valores),
      mediaTime: indicadoresDoTime.mediaGeral,
      recomendacao,
      enpsTime: indicadoresDoTime.enps?.indice ?? null,
      maior: maior
        ? { perguntaId: maior.perguntaId, valor: maior.valor }
        : null,
      menor: menor
        ? { perguntaId: menor.perguntaId, valor: menor.valor }
        : null,
    },
  };
}
