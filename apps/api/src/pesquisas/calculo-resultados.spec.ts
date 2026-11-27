import {
  calcularEnps,
  montarResultados,
  type RespostaParaCalculo,
  resultadoDasPerguntas,
} from "./calculo-resultados";
import type { Pergunta, Secao, TipoPergunta } from "./pesquisas.types";

/** T216 — resultados agregados: médias, eNPS, escolhas, textos e recortes. */

function p(
  id: string,
  tipo: TipoPergunta,
  config: Pergunta["config"] = {},
  condicao: Pergunta["condicao"] = null,
): Pergunta {
  return {
    id,
    tipo,
    texto: id,
    descricao: null,
    obrigatoria: false,
    config,
    condicao,
  };
}

const opcoes = [
  { id: "a", texto: "A" },
  { id: "b", texto: "B" },
];

const secoes: Secao[] = [
  {
    id: "s",
    titulo: null,
    descricao: null,
    perguntas: [
      p("conc", "concordancia"),
      p("nps", "nota_0_10", { enps: true }),
      p("nota", "nota_0_10"),
      p("esc", "escala", { minimo: 0, maximo: 3 }),
      p("num", "numero"),
      p("unica", "escolha_unica", { opcoes, outro: true }),
      p("multi", "multipla_escolha", { opcoes, outro: true }),
      p("sn", "sim_nao"),
      p("porque", "texto_curto", {}, { perguntaId: "sn", opcaoId: "nao" }),
      p("dia", "data"),
    ],
  },
];

const r = (
  valores: Record<string, unknown>,
  departamentoId: string | null = null,
  autor: string | null = null,
): RespostaParaCalculo => ({
  valores: Object.entries(valores).map(([perguntaId, valor]) => ({
    perguntaId,
    valor,
  })),
  autor,
  departamentoId,
});

describe("T216 — calcularEnps", () => {
  it("promotores 9–10, neutros 7–8, detratores 0–6; índice arredondado", () => {
    expect(calcularEnps([10, 9, 8, 7, 6, 0])).toEqual({
      promotores: 2,
      neutros: 2,
      detratores: 2,
      indice: 0,
    });
    // 2 promotores e 1 detrator em 3: 33,33… → 33
    expect(calcularEnps([10, 9, 3]).indice).toBe(33);
    // 1 promotor e 2 detratores em 3: −33,33… → −33
    expect(calcularEnps([10, 3, 3]).indice).toBe(-33);
    // 2 de 3 promotores: 66,67 → 67
    expect(calcularEnps([10, 10, 8]).indice).toBe(67);
    expect(calcularEnps([]).indice).toBeNull();
  });
});

describe("T216 — resultadoDasPerguntas", () => {
  const respostas = [
    r({
      conc: 5,
      nps: 10,
      nota: 4,
      esc: 0,
      num: 2.5,
      unica: { opcao: "a" },
      multi: { opcoes: ["a", "b"] },
      sn: "sim",
      dia: "2026-03-01",
    }),
    r({
      conc: 4,
      nps: 6,
      esc: 3,
      num: 10,
      unica: { outro: "Nenhuma" },
      multi: { opcoes: ["b"], outro: "Outra" },
      sn: "nao",
      porque: "Falta café",
      dia: "2026-01-15",
    }),
    r({ conc: 4, nps: 8, sn: "nao", dia: "2026-03-01" }),
  ];
  const porId = Object.fromEntries(
    resultadoDasPerguntas(secoes, respostas).map((x) => [x.perguntaId, x]),
  );

  it("escala: média com duas casas e distribuição com todos os valores", () => {
    expect(porId.conc).toEqual({
      perguntaId: "conc",
      tipo: "concordancia",
      respondidas: 3,
      viram: 3,
      media: 4.33,
      distribuicao: [
        { valor: 1, quantidade: 0 },
        { valor: 2, quantidade: 0 },
        { valor: 3, quantidade: 0 },
        { valor: 4, quantidade: 2 },
        { valor: 5, quantidade: 1 },
      ],
    });
    expect(porId.esc).toMatchObject({
      media: 1.5,
      distribuicao: [
        { valor: 0, quantidade: 1 },
        { valor: 1, quantidade: 0 },
        { valor: 2, quantidade: 0 },
        { valor: 3, quantidade: 1 },
      ],
    });
  });

  it("nota 0–10 com eNPS leva média, distribuição e o eNPS; sem eNPS, não", () => {
    expect(porId.nps).toMatchObject({
      media: 8,
      enps: { promotores: 1, neutros: 1, detratores: 1, indice: 0 },
    });
    expect(
      (porId.nps as { distribuicao: unknown[] }).distribuicao,
    ).toHaveLength(11);
    expect(porId.nota).toMatchObject({ respondidas: 1, media: 4 });
    expect(porId.nota).not.toHaveProperty("enps");
  });

  it("número: distribuição só dos valores dados, em ordem", () => {
    expect(porId.num).toMatchObject({
      media: 6.25,
      distribuicao: [
        { valor: 2.5, quantidade: 1 },
        { valor: 10, quantidade: 1 },
      ],
    });
  });

  it("escolhas: contagem por opção (com zeros) e os textos de 'outro'", () => {
    expect(porId.unica).toMatchObject({
      respondidas: 2,
      opcoes: [
        { opcaoId: "a", quantidade: 1 },
        { opcaoId: "b", quantidade: 0 },
      ],
      outros: ["Nenhuma"],
    });
    expect(porId.multi).toMatchObject({
      opcoes: [
        { opcaoId: "a", quantidade: 1 },
        { opcaoId: "b", quantidade: 2 },
      ],
      outros: ["Outra"],
    });
  });

  it("sim/não, condicional (viram) e datas", () => {
    expect(porId.sn).toMatchObject({ sim: 1, nao: 2, respondidas: 3 });
    expect(porId.porque).toEqual({
      perguntaId: "porque",
      tipo: "texto_curto",
      respondidas: 1,
      viram: 2,
      textos: [{ texto: "Falta café", autor: null }],
    });
    expect(porId.dia).toMatchObject({
      datas: [
        { valor: "2026-01-15", quantidade: 1 },
        { valor: "2026-03-01", quantidade: 2 },
      ],
    });
  });

  it("sem respostas: média nula e contagens zeradas", () => {
    const vazio = resultadoDasPerguntas(secoes, []);
    expect(vazio[0]).toMatchObject({ respondidas: 0, viram: 0, media: null });
    expect(vazio[1]).toMatchObject({ enps: { indice: null } });
  });
});

describe("T216 — montarResultados (recorte e mínimo por grupo)", () => {
  const sec: Secao[] = [
    {
      id: "s",
      titulo: null,
      descricao: null,
      perguntas: [p("c", "concordancia"), p("t", "texto_curto")],
    },
  ];
  const respostas = [
    r({ c: 5, t: "bom" }, "d1", "Pessoa Um"),
    r({ c: 3 }, "d1", "Pessoa Dois"),
    r({ c: 1 }, "d1", "Pessoa Três"),
    r({ c: 2 }, "d2", "Pessoa Quatro"),
    r({ c: 4 }, null, "Pessoa Cinco"),
  ];
  const base = {
    pesquisaId: "pq",
    secoes: sec,
    respostas,
    participantes: 8,
    nomesDosDepartamentos: new Map([
      ["d1", "Operações"],
      ["d2", "Comercial"],
    ]),
    minimoPorGrupo: 3,
    departamentoId: null,
    identificada: true,
    minimoNaVisaoGeral: false,
  };

  it("sem filtro: tudo, com os grupos e a visibilidade de cada um", () => {
    const res = montarResultados(base);
    expect(res.respostas).toBe(5);
    expect(res.participantes).toBe(8);
    expect(res.departamentos).toEqual([
      { id: "d2", nome: "Comercial", respostas: 1, visivel: false },
      { id: "d1", nome: "Operações", respostas: 3, visivel: true },
    ]);
    expect(res.filtro).toEqual({ departamentoId: null, visivel: true });
    expect(res.perguntas[0]).toMatchObject({ respondidas: 5, media: 3 });
  });

  it("grupo no mínimo: só as respostas dele", () => {
    const res = montarResultados({ ...base, departamentoId: "d1" });
    expect(res.filtro).toEqual({ departamentoId: "d1", visivel: true });
    expect(res.perguntas[0]).toMatchObject({ respondidas: 3, media: 3 });
  });

  it("grupo abaixo do mínimo (ou inexistente): sem nenhum número", () => {
    for (const departamentoId of ["d2", "outro"]) {
      const res = montarResultados({ ...base, departamentoId });
      expect(res.filtro).toEqual({ departamentoId, visivel: false });
      expect(res.perguntas).toEqual([]);
    }
  });

  it("autor do texto só na identificada", () => {
    const ident = montarResultados(base);
    expect(ident.perguntas[1]).toMatchObject({
      textos: [{ texto: "bom", autor: "Pessoa Um" }],
    });
    const conf = montarResultados({ ...base, identificada: false });
    expect(conf.perguntas[1]).toMatchObject({
      textos: [{ texto: "bom", autor: null }],
    });
  });

  describe("visão geral da confidencial também respeita o mínimo", () => {
    const confidencial = {
      ...base,
      identificada: false,
      minimoNaVisaoGeral: true,
    };

    it("abaixo do mínimo: sem números, mas com as contagens", () => {
      const res = montarResultados({
        ...confidencial,
        respostas: respostas.slice(0, 2),
        minimoPorGrupo: 3,
      });
      expect(res.filtro).toEqual({ departamentoId: null, visivel: false });
      expect(res.perguntas).toEqual([]);
      expect(res.respostas).toBe(2);
      expect(res.participantes).toBe(8);
    });

    it("no mínimo: mostra", () => {
      const res = montarResultados({
        ...confidencial,
        respostas: respostas.slice(0, 3),
        minimoPorGrupo: 3,
      });
      expect(res.filtro.visivel).toBe(true);
      expect(res.perguntas[0]).toMatchObject({ respondidas: 3 });
    });

    it("identificada e anônima (sem a regra) mostram a visão geral com 1 resposta", () => {
      const res = montarResultados({
        ...base,
        respostas: respostas.slice(0, 1),
        minimoNaVisaoGeral: false,
      });
      expect(res.filtro.visivel).toBe(true);
      expect(res.perguntas).toHaveLength(2);
    });
  });
});
