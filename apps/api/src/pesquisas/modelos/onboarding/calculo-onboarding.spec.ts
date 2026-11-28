import type { Pergunta, Secao } from "../../pesquisas.types";
import {
  compararRodadas,
  contatos,
  faixaDoIndice,
  fluxoDaIntencao,
  funil,
  notaDoItem,
  pesoDosBlocos,
  resultadoDaRodada,
  spearman,
  textosDoPapel,
  type RespostaDoOnboarding,
} from "./calculo-onboarding";
import { CONCORDANCIA_4 } from "./definicao";

/** T216 — Onboarding: o resultado por rodada. */

const escala4 = (id: string): Pergunta => ({
  id,
  tipo: "escala",
  texto: `Item ${id}`,
  rotulo: null,
  descricao: null,
  obrigatoria: true,
  config: { minimo: 1, maximo: 4, rotulos: [...CONCORDANCIA_4] },
  condicao: null,
});

const unica = (id: string, opcoes: string[]): Pergunta => ({
  id,
  tipo: "escolha_unica",
  texto: id,
  rotulo: null,
  descricao: null,
  obrigatoria: true,
  config: { opcoes: opcoes.map((o) => ({ id: o, texto: o })), outro: true },
  condicao: null,
});

const SECOES: Secao[] = [
  {
    id: "b1",
    titulo: "Onboarding e treinamento",
    descricao: null,
    perguntas: [escala4("q1"), escala4("q2")],
  },
  { id: "b3", titulo: "Colegas", descricao: null, perguntas: [escala4("q5")] },
  {
    id: "b7",
    titulo: "Motivação e permanência",
    descricao: null,
    perguntas: [
      unica("q12", ["m1", "m2"]),
      unica("q13", ["i1", "i2", "i3", "i4"]),
      { ...escala4("q14"), tipo: "texto_curto", config: {} },
      {
        ...escala4("q15"),
        tipo: "nota_0_10",
        config: { enps: true },
      },
    ],
  },
  {
    id: "b8",
    titulo: "Para fechar",
    descricao: null,
    perguntas: [
      { ...escala4("q16"), tipo: "paragrafo", config: {}, obrigatoria: false },
      { ...escala4("q17"), tipo: "paragrafo", config: {}, obrigatoria: false },
    ],
  },
];

const resp = (
  valores: Record<string, unknown>,
  rodada = 30,
  colaboradorId: string | null = null,
): RespostaDoOnboarding => ({
  rodada,
  colaboradorId,
  valores: new Map(Object.entries(valores)),
});

describe("T216 — nota e faixas do onboarding", () => {
  it("4 pontos → 0–100", () => {
    expect(notaDoItem(1)).toBe(0);
    expect(notaDoItem(2)).toBeCloseTo(33.33, 2);
    expect(notaDoItem(3)).toBeCloseTo(66.67, 2);
    expect(notaDoItem(4)).toBe(100);
  });

  it.each([
    [49.4, "critico"],
    [49.5, "atencao"],
    [69, "atencao"],
    [70, "saudavel"],
    [84.4, "saudavel"],
    [85, "forte"],
  ])("índice %p → %s", (i, f) => {
    expect(faixaDoIndice(i)).toBe(f);
  });
});

describe("T216 — resultado de uma rodada", () => {
  it("com menos de 3 respostas, não mostra números", () => {
    const r = resultadoDaRodada(30, SECOES, [resp({ q1: 4 }), resp({ q1: 1 })]);
    expect(r).toMatchObject({
      visivel: false,
      faltam: 1,
      indice: null,
      blocos: [],
    });
  });

  it("índice por bloco e geral, intenção, motivos e recomendação", () => {
    const r = resultadoDaRodada(30, SECOES, [
      resp({
        q1: 4,
        q2: 4,
        q5: 3,
        q12: { opcao: "m1" },
        q13: { opcao: "i1" },
        q15: 10,
      }),
      resp({
        q1: 3,
        q2: 2,
        q5: 4,
        q12: { outro: "Perto de casa" },
        q13: { opcao: "i2" },
        q15: 7,
      }),
      resp({
        q1: 1,
        q2: 3,
        q5: 4,
        q12: { opcao: "m1" },
        q13: { opcao: "i4" },
        q15: 3,
      }),
    ]);
    expect(r.visivel).toBe(true);
    // b1: (100+100+66.7+33.3+0+66.7)/6 = 61.1
    expect(r.blocos[0]).toMatchObject({
      id: "b1",
      indice: 61,
      faixa: "atencao",
    });
    expect(r.blocos[0]!.perguntas).toEqual([
      { perguntaId: "q1", indice: 56 },
      { perguntaId: "q2", indice: 67 },
    ]);
    // b3: (66.7+100+100)/3 = 88.9
    expect(r.blocos[1]).toMatchObject({ id: "b3", indice: 89, faixa: "forte" });
    // geral: (366.7 + 266.7)/9 = 70.4
    expect(r.indice).toBe(70);
    expect(r.faixa).toBe("saudavel");
    expect(r.intencao!.querContinuar).toBe(67);
    expect(r.intencao!.opcoes.map((o) => o.quantidade)).toEqual([1, 1, 0, 1]);
    expect(r.motivos).toEqual({
      opcoes: [
        { opcaoId: "m1", quantidade: 2, percentual: 67 },
        { opcaoId: "m2", quantidade: 0, percentual: 0 },
      ],
      outros: ["Perto de casa"],
    });
    expect(r.recomendacao).toEqual({
      respostas: 3,
      media: 6.7,
      indice: 0,
      promotores: 1,
      neutros: 1,
      detratores: 1,
    });
  });

  it("sem as perguntas de papel (editadas fora), os blocos ficam nulos", () => {
    const so = [SECOES[0]!];
    const r = resultadoDaRodada(60, so, [
      resp({ q1: 4 }),
      resp({ q1: 4 }),
      resp({ q1: 4 }),
    ]);
    expect(r.intencao).toBeNull();
    expect(r.motivos).toBeNull();
    expect(r.recomendacao).toBeNull();
    expect(r.indice).toBe(100);
  });

  it("compara duas rodadas visíveis (pontos)", () => {
    const a = resultadoDaRodada(30, SECOES, [
      resp({ q1: 4, q5: 4 }),
      resp({ q1: 4, q5: 4 }),
      resp({ q1: 4, q5: 4 }),
    ]);
    const b = resultadoDaRodada(60, SECOES, [
      resp({ q1: 3, q5: 4 }),
      resp({ q1: 3, q5: 4 }),
      resp({ q1: 3, q5: 4 }),
    ]);
    const c = compararRodadas(a, b)!;
    expect(c.blocos[0]).toEqual({
      id: "b1",
      antes: 100,
      depois: 67,
      mudou: -33,
    });
    expect(c.blocos[1]).toEqual({
      id: "b3",
      antes: 100,
      depois: 100,
      mudou: 0,
    });
    expect(c.geral.mudou).toBe(-17);
    const oculta = resultadoDaRodada(90, SECOES, [resp({ q1: 1 })]);
    expect(compararRodadas(a, oculta)).toBeNull();
  });
});

describe("T216 — peso dos blocos (Spearman)", () => {
  it("correlação de postos, com empates e sem variação", () => {
    expect(spearman([1, 2, 3, 4], [10, 20, 30, 40])).toBeCloseTo(1);
    expect(spearman([1, 2, 3, 4], [4, 3, 2, 1])).toBeCloseTo(-1);
    expect(spearman([1, 1, 2, 3], [1, 2, 3, 4])).toBeCloseTo(0.9487, 3);
    expect(spearman([1, 1, 1], [1, 2, 3])).toBeNull();
    expect(spearman([1], [1])).toBeNull();
  });

  it("precisa de 20 respostas; prioridade = nota < 70 e peso ≥ 0,4", () => {
    const poucas = pesoDosBlocos(SECOES, [
      resp({ q1: 4, q13: { opcao: "i1" } }),
    ]);
    expect(poucas.suficiente).toBe(false);
    expect(poucas.blocos[0]!.peso).toBeNull();
    const muitas: RespostaDoOnboarding[] = [];
    for (let i = 0; i < 20; i++) {
      const bom = i % 2 === 0;
      muitas.push(
        resp({
          q1: bom ? 3 : 1,
          q2: bom ? 3 : 2,
          q5: i % 4 === 0 ? 4 : 3,
          q13: { opcao: bom ? "i1" : "i4" },
        }),
      );
    }
    const r = pesoDosBlocos(SECOES, muitas);
    expect(r.suficiente).toBe(true);
    const b1 = r.blocos.find((b) => b.id === "b1")!;
    expect(b1.peso).toBe(1);
    expect(b1.indice).toBe(42);
    expect(b1.prioridade).toBe(true);
    const b3 = r.blocos.find((b) => b.id === "b3")!;
    expect(b3.prioridade).toBe(false);
  });
});

describe("T216 — intenção entre rodadas, contatos, textos e funil", () => {
  it("fluxo só com quem respondeu às duas; com menos de 3, oculto", () => {
    const rs = [
      resp({ q13: { opcao: "i1" } }, 30, "a"),
      resp({ q13: { opcao: "i2" } }, 60, "a"),
      resp({ q13: { opcao: "i1" } }, 30, "b"),
      resp({ q13: { opcao: "i2" } }, 60, "b"),
      resp({ q13: { opcao: "i3" } }, 30, "c"),
      resp({ q13: { opcao: "i3" } }, 60, "c"),
      resp({ q13: { opcao: "i1" } }, 30, "d"),
      resp({ q13: { opcao: "i1" } }, 30, null),
    ];
    const f = fluxoDaIntencao(SECOES, rs, 30, 60);
    expect(f.pessoas).toBe(3);
    expect(f.visivel).toBe(true);
    expect(f.fluxos).toEqual([
      { de: "i1", para: "i2", quantidade: 2 },
      { de: "i3", para: "i3", quantidade: 1 },
    ]);
    const poucas = fluxoDaIntencao(SECOES, rs.slice(0, 4), 30, 60);
    expect(poucas).toEqual({ pessoas: 2, visivel: false, fluxos: [] });
  });

  it("contatos e textos: sem vazio, aparados, em ordem alfabética", () => {
    const rs = [
      resp({ q14: " zeca@example.test ", q16: "Mais treino", q17: "" }),
      resp({ q14: "", q16: "  ", q17: "O café" }),
      resp({ q14: "ana@example.test" }),
    ];
    expect(contatos(SECOES, rs)).toEqual([
      "ana@example.test",
      "zeca@example.test",
    ]);
    expect(textosDoPapel(SECOES, rs, "melhorar")).toEqual(["Mais treino"]);
    expect(textosDoPapel(SECOES, rs, "gosta")).toEqual(["O café"]);
    expect(contatos([SECOES[0]!], rs)).toEqual([]);
  });

  it("funil dos convites por situação", () => {
    expect(
      funil([
        { situacao: "agendado" },
        { situacao: "aguardando_email" },
        { situacao: "aguardando_email" },
        { situacao: "sem_email" },
        { situacao: "respondido" },
        { situacao: "pulado" },
        { situacao: "enviado" },
      ]),
    ).toEqual({
      noPublico: 7,
      semEmail: 1,
      aguardandoEmail: 2,
      enviados: 1,
      responderam: 1,
      pulados: 1,
      agendados: 1,
    });
  });
});

describe("T216 — onboarding com o catálogo da galeria (tipos de 4 pontos e chave)", () => {
  // Ids gerados no uso; o papel vem da chave do item.
  const p = (
    id: string,
    chave: string,
    tipo: Pergunta["tipo"],
    config: Pergunta["config"] = {},
  ): Pergunta => ({
    id,
    chave,
    tipo,
    texto: chave,
    rotulo: null,
    descricao: null,
    obrigatoria: false,
    config,
    condicao: null,
  });
  const secoes: Secao[] = [
    {
      id: "s-a",
      titulo: "Bloco A",
      descricao: null,
      perguntas: [
        p("x1", "q1", "concordancia_4"),
        p("x7", "q7", "satisfacao_4"),
      ],
    },
    {
      id: "s-b",
      titulo: "Bloco B",
      descricao: null,
      perguntas: [
        p("x13", "q13", "escolha_unica", {
          opcoes: [
            { id: "i1", texto: "a" },
            { id: "i2", texto: "b" },
          ],
          outro: false,
        }),
        p("x14", "q14", "texto_curto"),
        p("x15", "q15", "nota_0_10", { enps: true }),
        p("x16", "q16", "paragrafo"),
      ],
    },
  ];
  const rs = [
    resp({
      x1: 4,
      x7: 1,
      x13: { opcao: "i1" },
      x14: "a@example.test",
      x15: 10,
      x16: "Mais café",
    }),
    resp({ x1: 3, x7: 2, x13: { opcao: "i2" }, x15: 9 }),
    resp({ x1: 2, x7: 3, x13: { opcao: "i1" }, x15: 0 }),
  ];

  it("concordância e satisfação de 4 pontos entram no índice do bloco", () => {
    const r = resultadoDaRodada(30, secoes, rs);
    // (100 + 66.7 + 33.3 + 0 + 33.3 + 66.7) / 6 = 50
    expect(r.blocos.map((b) => [b.id, b.indice])).toEqual([["s-a", 50]]);
    expect(r.indice).toBe(50);
    expect(r.faixa).toBe("atencao");
  });

  it("os papéis vêm da chave, não do id", () => {
    const r = resultadoDaRodada(30, secoes, rs);
    expect(r.intencao!.querContinuar).toBe(100);
    expect(r.recomendacao).toMatchObject({
      promotores: 2,
      detratores: 1,
      indice: 33,
    });
    expect(contatos(secoes, rs)).toEqual(["a@example.test"]);
    expect(textosDoPapel(secoes, rs, "melhorar")).toEqual(["Mais café"]);
  });
});
