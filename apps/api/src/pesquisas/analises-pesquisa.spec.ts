import {
  compararComOTime,
  mediaDasRespostas,
  mediaGeralVisivel,
  montarAnalises,
  montarEvolucao,
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
    // Uma resposta sem departamento: Comercial não pode ser deduzido.
    const { linhas } = montarAnalises({
      ...base,
      respostas: [...respostas, r(2, 2, null)],
    });
    // clima 3 → 6; carga 5,6 → média 5,8
    expect(linhas[0]).toEqual({
      grupoId: null,
      nome: "Toda a empresa",
      respostas: 5,
      visivel: true,
      oculto: null,
      media: 5.8,
      medias: [6, 5.6],
    });
    expect(linhas.slice(1)).toEqual([
      {
        grupoId: "d2",
        nome: "Comercial",
        respostas: 1,
        visivel: false,
        oculto: "minimo",
        media: null,
        medias: [null, null],
      },
      {
        grupoId: "d1",
        nome: "Operações",
        respostas: 3,
        visivel: true,
        oculto: null,
        media: 8,
        medias: [8, 8],
      },
    ]);
  });

  it("sem resposta sem grupo, o único visível protege o oculto (supressão secundária)", () => {
    const { linhas } = montarAnalises(base);
    expect(linhas[0]).toMatchObject({ visivel: true, media: 6.5 });
    expect(
      linhas.slice(1).map((l) => [l.grupoId, l.visivel, l.oculto, l.media]),
    ).toEqual([
      ["d2", false, "minimo", null],
      ["d1", false, "protege_grupo_menor", null],
    ]);
  });

  it("confidencial abaixo do mínimo: nem a linha da empresa mostra números", () => {
    const { linhas } = montarAnalises({
      ...base,
      respostas: respostas.slice(0, 2),
      minimoNaVisaoGeral: true,
    });
    expect(linhas[0]).toMatchObject({
      visivel: false,
      oculto: "minimo",
      media: null,
    });
  });

  it("evolução: média geral com a mesma regra do mínimo", () => {
    expect(mediaGeralVisivel(secoes, respostas, 3, false)).toBe(6.5);
    expect(
      mediaGeralVisivel(secoes, respostas.slice(0, 2), 3, true),
    ).toBeNull();
    expect(mediaGeralVisivel(secoes, respostas.slice(0, 2), 3, false)).toBe(9);
  });
});

describe("T216 — montarEvolucao", () => {
  const pesquisa = (id: string, status: string, identificacao = "anonima") => ({
    id,
    nome: `Pesquisa ${id}`,
    status,
    publicadaEm: new Date(`2026-0${id.slice(1)}-01T12:00:00Z`),
    secoes,
    identificacao,
    minimoPorGrupo: 3,
  });
  const valoresDe = (pesquisaId: string, lista = respostas) =>
    lista.map((x) => ({ pesquisaId, valores: x.valores }));

  it("pesquisa cancelada fica fora da evolução", () => {
    const pontos = montarEvolucao(
      [
        pesquisa("p1", "finalizada"),
        pesquisa("p2", "cancelada"),
        pesquisa("p3", "ativa"),
      ],
      [...valoresDe("p1"), ...valoresDe("p2"), ...valoresDe("p3")],
    );
    expect(pontos.map((x) => x.pesquisaId)).toEqual(["p1", "p3"]);
  });

  it("sem média visível (confidencial abaixo do mínimo) ou sem resposta: fora", () => {
    const pontos = montarEvolucao(
      [
        pesquisa("p1", "finalizada", "confidencial"),
        pesquisa("p2", "pausada"),
        pesquisa("p3", "ativa"),
      ],
      [...valoresDe("p1", respostas.slice(0, 2)), ...valoresDe("p3")],
    );
    expect(pontos).toEqual([
      {
        pesquisaId: "p3",
        nome: "Pesquisa p3",
        publicadaEm: "2026-03-01T12:00:00.000Z",
        mediaGeral: 6.5,
      },
    ]);
  });

  it("mantém a ordem recebida e a média de cada pesquisa", () => {
    const pontos = montarEvolucao(
      [pesquisa("p2", "finalizada"), pesquisa("p1", "finalizada")],
      [...valoresDe("p1", respostas.slice(0, 2)), ...valoresDe("p2")],
    );
    expect(pontos.map((x) => [x.pesquisaId, x.mediaGeral])).toEqual([
      ["p2", 6.5],
      ["p1", 9],
    ]);
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

describe("T216 — mediaDasRespostas (últimos pulsos da pessoa)", () => {
  const conc: Secao[] = [
    {
      id: "s",
      titulo: null,
      descricao: null,
      perguntas: [p("c", "concordancia"), p("t", "texto_curto")],
    },
  ];
  const dez: Secao[] = [
    {
      id: "s",
      titulo: null,
      descricao: null,
      perguntas: [p("e", "escala", { minimo: 1, maximo: 10 })],
    },
  ];

  it("média (0–10) das médias de cada resposta anterior, cada uma na sua estrutura", () => {
    expect(
      mediaDasRespostas([
        // 4 de 5 → 8
        { secoes: conc, valores: [{ perguntaId: "c", valor: 4 }] },
        // 5 de 10 → 5
        { secoes: dez, valores: [{ perguntaId: "e", valor: 5 }] },
      ]),
    ).toBe(6.5);
  });

  it("sem resposta anterior (ou sem nota de escala): nulo", () => {
    expect(mediaDasRespostas([])).toBeNull();
    expect(
      mediaDasRespostas([
        { secoes: conc, valores: [{ perguntaId: "t", valor: "só texto" }] },
      ]),
    ).toBeNull();
  });
});
