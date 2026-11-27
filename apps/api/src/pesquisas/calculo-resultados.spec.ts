import {
  calcularEnps,
  calcularIndicadores,
  faixaDoValor,
  mediaDaResposta,
  montarResultados,
  type RespostaParaCalculo,
  resultadoDasPerguntas,
  zonaDoEnps,
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
    rotulo: null,
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
  grupos: departamentoId ? { departamento: departamentoId } : {},
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
      favoravel: 100,
      faixas: { baixa: 0, media: 0, alta: 3 },
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
      enps: {
        promotores: 1,
        neutros: 1,
        detratores: 1,
        indice: 0,
        zona: "aperfeicoamento",
      },
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
    nomesDosGrupos: new Map([
      ["d1", "Operações"],
      ["d2", "Comercial"],
    ]),
    minimoPorGrupo: 3,
    filtro: null,
    recortes: ["departamento", "centroCusto", "unidade"] as const,
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
    expect(res.filtro).toEqual({
      campo: null,
      grupoId: null,
      departamentoId: null,
      visivel: true,
    });
    expect(res.grupos.departamento).toEqual(res.departamentos);
    expect(res.grupos.centroCusto).toEqual([]);
    expect(res.recortes).toEqual(["departamento", "centroCusto", "unidade"]);
    expect(res.perguntas[0]).toMatchObject({ respondidas: 5, media: 3 });
  });

  it("grupo no mínimo: só as respostas dele", () => {
    const res = montarResultados({
      ...base,
      filtro: { campo: "departamento", grupoId: "d1" },
    });
    expect(res.filtro).toEqual({
      campo: "departamento",
      grupoId: "d1",
      departamentoId: "d1",
      visivel: true,
    });
    expect(res.perguntas[0]).toMatchObject({ respondidas: 3, media: 3 });
  });

  it("grupo abaixo do mínimo (ou inexistente): sem nenhum número", () => {
    for (const grupoId of ["d2", "outro"]) {
      const res = montarResultados({
        ...base,
        filtro: { campo: "departamento", grupoId },
      });
      expect(res.filtro).toMatchObject({
        departamentoId: grupoId,
        visivel: false,
      });
      expect(res.perguntas).toEqual([]);
      expect(res.indicadores.mediaGeral).toBeNull();
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
      expect(res.filtro).toMatchObject({
        departamentoId: null,
        visivel: false,
      });
      expect(res.perguntas).toEqual([]);
      expect(res.indicadores.mediaGeral).toBeNull();
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

describe("T216 — ordem dos textos (privacidade)", () => {
  const sec: Secao[] = [
    {
      id: "s",
      titulo: null,
      descricao: null,
      perguntas: [
        p("t", "texto_curto"),
        p("u", "escolha_unica", {
          opcoes: [
            { id: "a", texto: "A" },
            { id: "b", texto: "B" },
          ],
          outro: true,
        }),
      ],
    },
  ];
  const chegada = ["Zebra", "abacate", "Mesa", "Água"].map((texto, i) => ({
    valores: [
      { perguntaId: "t", valor: texto },
      { perguntaId: "u", valor: { outro: `Outro ${4 - i}` } },
    ],
    autor: `Pessoa ${i}`,
    grupos: {},
  }));
  const base = {
    pesquisaId: "pq",
    secoes: sec,
    respostas: chegada,
    participantes: null,
    nomesDosGrupos: new Map<string, string>(),
    minimoPorGrupo: 3,
    filtro: null,
    recortes: [] as const,
    minimoNaVisaoGeral: false,
  };

  it("sem autor (confidencial e anônima): ordem alfabética, não a de chegada", () => {
    const res = montarResultados({ ...base, identificada: false });
    expect(
      (res.perguntas[0] as { textos: { texto: string }[] }).textos.map(
        (x) => x.texto,
      ),
    ).toEqual(["abacate", "Água", "Mesa", "Zebra"]);
    expect((res.perguntas[1] as { outros: string[] }).outros).toEqual([
      "Outro 1",
      "Outro 2",
      "Outro 3",
      "Outro 4",
    ]);
  });

  it("identificada: a ordem de chegada, com o autor", () => {
    const res = montarResultados({ ...base, identificada: true });
    expect(
      (res.perguntas[0] as { textos: { texto: string; autor: string }[] })
        .textos[0],
    ).toEqual({ texto: "Zebra", autor: "Pessoa 0" });
  });
});

describe("T216 — recortes por centro de custo e unidade", () => {
  const sec: Secao[] = [
    {
      id: "s",
      titulo: null,
      descricao: null,
      perguntas: [p("c", "concordancia")],
    },
  ];
  const com = (c: number, grupos: RespostaParaCalculo["grupos"]) => ({
    valores: [{ perguntaId: "c", valor: c }],
    autor: null,
    grupos,
  });
  const respostas = [
    com(5, { centroCusto: "cc1", unidade: "u1" }),
    com(3, { centroCusto: "cc1", unidade: "u1" }),
    com(1, { centroCusto: "cc1", unidade: null }),
    com(2, { centroCusto: "cc2", unidade: "u1" }),
  ];
  const base = {
    pesquisaId: "pq",
    secoes: sec,
    respostas,
    participantes: null,
    nomesDosGrupos: new Map([
      ["cc1", "Centro A"],
      ["cc2", "Centro B"],
      ["u1", "Unidade Norte"],
    ]),
    minimoPorGrupo: 3,
    filtro: null,
    recortes: ["centroCusto", "unidade"] as const,
    identificada: false,
    minimoNaVisaoGeral: false,
  };

  it("grupos por campo; 'não informado' fica fora", () => {
    const res = montarResultados(base);
    expect(res.participantes).toBeNull();
    expect(res.departamentos).toEqual([]);
    expect(res.grupos.unidade).toEqual([
      { id: "u1", nome: "Unidade Norte", respostas: 3, visivel: true },
    ]);
    expect(res.grupos.centroCusto).toEqual([
      { id: "cc1", nome: "Centro A", respostas: 3, visivel: true },
      { id: "cc2", nome: "Centro B", respostas: 1, visivel: false },
    ]);
  });

  it("filtro por centro de custo e por unidade", () => {
    const cc = montarResultados({
      ...base,
      filtro: { campo: "centroCusto", grupoId: "cc1" },
    });
    expect(cc.filtro).toEqual({
      campo: "centroCusto",
      grupoId: "cc1",
      departamentoId: null,
      visivel: true,
    });
    expect(cc.perguntas[0]).toMatchObject({ respondidas: 3, media: 3 });
    const u = montarResultados({
      ...base,
      filtro: { campo: "unidade", grupoId: "u1" },
    });
    expect(u.perguntas[0]).toMatchObject({ respondidas: 3 });
  });

  it("recorte fora dos disponíveis: sem números", () => {
    const res = montarResultados({
      ...base,
      filtro: { campo: "departamento", grupoId: "qualquer" },
    });
    expect(res.filtro.visivel).toBe(false);
    expect(res.perguntas).toEqual([]);
  });
});

describe("T216 — faixas, favorável e zona do eNPS", () => {
  it("1 a 10: 1–4 baixa, 5–7 média, 8–10 alta", () => {
    const e = p("e", "escala", { minimo: 1, maximo: 10 });
    expect([1, 4, 5, 7, 8, 10].map((v) => faixaDoValor(e, v))).toEqual([
      "baixa",
      "baixa",
      "media",
      "media",
      "alta",
      "alta",
    ]);
  });

  it("nota 0–10: 8 a 10 favoráveis", () => {
    const n = p("n", "nota_0_10");
    expect(faixaDoValor(n, 7)).toBe("media");
    expect(faixaDoValor(n, 8)).toBe("alta");
    expect(faixaDoValor(n, 3)).toBe("baixa");
  });

  it("concordância e estrelas: 4 e 5 favoráveis, 3 no meio", () => {
    for (const tipo of ["concordancia", "estrelas"] as const) {
      const q = p("q", tipo);
      expect([1, 2, 3, 4, 5].map((v) => faixaDoValor(q, v))).toEqual([
        "baixa",
        "baixa",
        "media",
        "alta",
        "alta",
      ]);
    }
  });

  it("escala personalizada: o terço superior", () => {
    const q = p("q", "escala", { minimo: 0, maximo: 5 });
    // 6 pontos: 0–1 baixa, 2–3 média, 4–5 alta
    expect([0, 1, 2, 3, 4, 5].map((v) => faixaDoValor(q, v))).toEqual([
      "baixa",
      "baixa",
      "media",
      "media",
      "alta",
      "alta",
    ]);
  });

  it("% favorável arredondado; sem respostas, nulo", () => {
    const sec: Secao[] = [
      {
        id: "s",
        titulo: null,
        descricao: null,
        perguntas: [p("e", "escala", { minimo: 1, maximo: 10 })],
      },
    ];
    const [res] = resultadoDasPerguntas(
      sec,
      [9, 8, 2].map((v) => ({
        valores: [{ perguntaId: "e", valor: v }],
        autor: null,
      })),
    );
    expect(res).toMatchObject({
      favoravel: 67,
      faixas: { baixa: 1, media: 0, alta: 2 },
    });
    expect(resultadoDasPerguntas(sec, [])[0]).toMatchObject({
      favoravel: null,
    });
  });

  it("zona: crítica < 0, aperfeiçoamento 0–49, qualidade 50–74, excelência 75–100", () => {
    expect([-1, 0, 49, 50, 74, 75, 100].map(zonaDoEnps)).toEqual([
      "critica",
      "aperfeicoamento",
      "aperfeicoamento",
      "qualidade",
      "qualidade",
      "excelencia",
      "excelencia",
    ]);
  });
});

describe("T216 — indicadores", () => {
  const sec: Secao[] = [
    {
      id: "s",
      titulo: null,
      descricao: null,
      perguntas: [
        p("conc", "concordancia"),
        p("dez", "escala", { minimo: 1, maximo: 10 }),
        p("nota", "nota_0_10"),
        p("nps", "nota_0_10", { enps: true }),
        p("num", "numero"),
        p("t", "texto_curto"),
      ],
    },
  ];
  const resp = (v: Record<string, unknown>) => ({
    valores: Object.entries(v).map(([perguntaId, valor]) => ({
      perguntaId,
      valor,
    })),
    autor: null,
  });

  it("média geral na escala 0–10 (sem eNPS e sem número), maior e menor", () => {
    const perguntas = resultadoDasPerguntas(sec, [
      resp({ conc: 4, dez: 6, nota: 9, nps: 10, num: 100 }),
      resp({ conc: 5, dez: 8, nota: 7, nps: 3, num: 1 }),
    ]);
    const ind = calcularIndicadores(sec, perguntas);
    // concordância 4,5 → 9; escala 7; nota 8 → média 8
    expect(ind).toEqual({
      mediaGeral: 8,
      perguntasDeEscala: 3,
      maiorMedia: { perguntaId: "conc", media: 9 },
      menorMedia: { perguntaId: "dez", media: 7 },
      enps: {
        indice: 0,
        zona: "aperfeicoamento",
        promotores: 1,
        neutros: 0,
        detratores: 1,
      },
    });
  });

  it("sem respostas: tudo nulo, mas a contagem de perguntas de escala fica", () => {
    expect(calcularIndicadores(sec, resultadoDasPerguntas(sec, []))).toEqual({
      mediaGeral: null,
      perguntasDeEscala: 3,
      maiorMedia: null,
      menorMedia: null,
      enps: null,
    });
  });

  it("média da resposta (0–10)", () => {
    expect(
      mediaDaResposta(
        sec,
        new Map<string, unknown>([
          ["conc", 5],
          ["dez", 6],
          ["nps", 0],
        ]),
      ),
    ).toBe(8);
    expect(mediaDaResposta(sec, new Map([["t", "oi"]]))).toBeNull();
  });
});
