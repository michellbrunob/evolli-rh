import {
  compararComOTime,
  mediaGeralVisivel,
  montarAnalises,
  type RespostaDaAnalise,
} from "./analises-pesquisa";
import type { Pergunta, Secao, TipoPergunta } from "./pesquisas.types";

/** T216 — mapa de médias por grupo, evolução e a resposta individual. */

function p(
  id: string,
  tipo: TipoPergunta,
  config: Pergunta["config"] = {},
  rotulo: string | null = null,
): Pergunta {
  return {
    id,
    tipo,
    texto: `Texto ${id}`,
    rotulo,
    descricao: null,
    obrigatoria: false,
    config,
    condicao: null,
  };
}

const secoes: Secao[] = [
  {
    id: "s",
    titulo: null,
    descricao: null,
    perguntas: [
      p("clima", "concordancia", {}, "Clima"),
      p("carga", "escala", { minimo: 1, maximo: 10 }),
      p("nps", "nota_0_10", { enps: true }),
      p("obs", "texto_curto"),
    ],
  },
];

const r = (
  clima: number,
  carga: number,
  departamento: string | null,
  nps?: number,
): RespostaDaAnalise => ({
  valores: [
    { perguntaId: "clima", valor: clima },
    { perguntaId: "carga", valor: carga },
    ...(nps === undefined ? [] : [{ perguntaId: "nps", valor: nps }]),
  ],
  grupos: { departamento },
});

const respostas = [
  r(5, 10, "d1", 10),
  r(4, 8, "d1", 9),
  r(3, 6, "d1", 2),
  r(1, 2, "d2"),
];

const base = {
  campo: "departamento" as const,
  secoes,
  respostas,
  nomesDosGrupos: new Map([
    ["d1", "Operações"],
    ["d2", "Comercial"],
  ]),
  minimoPorGrupo: 3,
  minimoNaVisaoGeral: false,
  evolucao: [],
};

describe("T216 — montarAnalises", () => {
  it("colunas: perguntas de escala pelo rótulo curto (ou o texto)", () => {
    expect(montarAnalises(base).colunas).toEqual([
      { perguntaId: "clima", rotulo: "Clima" },
      { perguntaId: "carga", rotulo: "Texto carga" },
    ]);
  });

  it("'Toda a empresa' primeiro; grupo abaixo do mínimo oculto", () => {
    const { linhas } = montarAnalises(base);
    // clima 3,25 → 6,5; carga 6,5 → média 6,5
    expect(linhas[0]).toEqual({
      grupoId: null,
      nome: "Toda a empresa",
      respostas: 4,
      visivel: true,
      media: 6.5,
      medias: [6.5, 6.5],
    });
    expect(linhas.slice(1)).toEqual([
      {
        grupoId: "d2",
        nome: "Comercial",
        respostas: 1,
        visivel: false,
        media: null,
        medias: [null, null],
      },
      {
        grupoId: "d1",
        nome: "Operações",
        respostas: 3,
        visivel: true,
        media: 8,
        medias: [8, 8],
      },
    ]);
  });

  it("confidencial abaixo do mínimo: nem a linha da empresa mostra números", () => {
    const { linhas } = montarAnalises({
      ...base,
      respostas: respostas.slice(0, 2),
      minimoNaVisaoGeral: true,
    });
    expect(linhas[0]).toMatchObject({ visivel: false, media: null });
  });

  it("evolução: média geral com a mesma regra do mínimo", () => {
    expect(mediaGeralVisivel(secoes, respostas, 3, false)).toBe(6.5);
    expect(
      mediaGeralVisivel(secoes, respostas.slice(0, 2), 3, true),
    ).toBeNull();
    expect(mediaGeralVisivel(secoes, respostas.slice(0, 2), 3, false)).toBe(9);
  });
});

describe("T216 — compararComOTime", () => {
  it("valores com a média do time, indicadores da resposta e do time", () => {
    const c = compararComOTime(secoes, respostas, 0);
    expect(c.valores).toEqual([
      { perguntaId: "clima", valor: 5, mediaTime: 3.25 },
      { perguntaId: "carga", valor: 10, mediaTime: 6.5 },
      { perguntaId: "nps", valor: 10, mediaTime: 7 },
    ]);
    expect(c.indicadores).toEqual({
      media: 10,
      mediaTime: 6.5,
      recomendacao: 10,
      // 2 promotores e 1 detrator em 3 → 33
      enpsTime: 33,
      maior: { perguntaId: "clima", valor: 5 },
      menor: { perguntaId: "clima", valor: 5 },
    });
  });

  it("maior e menor pela escala 0–10; sem eNPS, recomendação nula", () => {
    const c = compararComOTime(secoes, respostas, 3);
    // clima 1 → 2; carga 2 → 2: empate fica com a primeira
    expect(c.indicadores).toMatchObject({
      media: 2,
      recomendacao: null,
      maior: { perguntaId: "clima", valor: 1 },
      menor: { perguntaId: "clima", valor: 1 },
    });
    const outra = compararComOTime(secoes, [r(5, 2, null)], 0);
    expect(outra.indicadores.maior).toEqual({ perguntaId: "clima", valor: 5 });
    expect(outra.indicadores.menor).toEqual({ perguntaId: "carga", valor: 2 });
  });
});
