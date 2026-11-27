import type { Pergunta, Secao, TipoPergunta } from "./pesquisas.types";
import {
  conferirRespostas,
  conferirValor,
  perguntasVistas,
} from "./validacao-respostas";

/** T216 — a resposta pelo link: tipos, obrigatórias e condições. */

function p(
  id: string,
  tipo: TipoPergunta,
  config: Pergunta["config"] = {},
  extra: Partial<Pergunta> = {},
): Pergunta {
  return {
    id,
    tipo,
    texto: id,
    descricao: null,
    obrigatoria: false,
    config,
    condicao: null,
    ...extra,
  };
}

const opcoes = [
  { id: "a", texto: "A" },
  { id: "b", texto: "B" },
  { id: "c", texto: "C" },
];

describe("T216 — conferirValor (tabela dos 11 tipos)", () => {
  const casos: [Pergunta, unknown[], unknown[]][] = [
    [p("t", "texto_curto"), ["oi", "x".repeat(300)], [1, "x".repeat(301), {}]],
    [p("g", "paragrafo"), ["x".repeat(3000)], ["x".repeat(3001), ["a"]]],
    [
      p("u", "escolha_unica", { opcoes, outro: true }),
      [{ opcao: "a" }, { outro: "Outra coisa" }],
      [{ opcao: "z" }, { opcao: "a", outro: "x" }, "a", { outro: "" }],
    ],
    [
      p("m", "multipla_escolha", { opcoes, outro: false, maximo: 2 }),
      [{ opcoes: ["a"] }, { opcoes: ["a", "b"] }],
      [
        { opcoes: ["a", "b", "c"] },
        { opcoes: ["a", "a"] },
        { opcoes: ["z"] },
        { opcoes: ["a"], outro: "x" },
        { opcao: "a" },
      ],
    ],
    [p("s", "sim_nao"), ["sim", "nao"], ["Sim", true, 1]],
    [p("c", "concordancia"), [1, 5], [0, 6, 2.5, "3"]],
    [p("n", "nota_0_10"), [0, 10], [-1, 11, 9.5]],
    [p("e", "estrelas"), [1, 5], [0, 6]],
    [p("x", "escala", { minimo: 0, maximo: 7 }), [0, 7], [-1, 8, 3.2]],
    [p("d", "data"), ["2026-02-28"], ["2026-02-30", "28/02/2026", 20260228]],
    [
      p("num", "numero", { minimo: 0, maximo: 10, inteiro: true }),
      [0, 10],
      [-1, 11, 1.5, "5", Number.NaN],
    ],
  ];

  it.each(casos)("%#: aceita e recusa pelo tipo", (pergunta, bons, ruins) => {
    for (const v of bons) expect(conferirValor(pergunta, v).ok).toBe(true);
    for (const v of ruins) expect(conferirValor(pergunta, v).ok).toBe(false);
  });

  it("múltipla escolha guarda as opções na ordem da configuração", () => {
    const r = conferirValor(
      p("m", "multipla_escolha", { opcoes, outro: true }),
      {
        opcoes: ["c", "a"],
        outro: "  mais  ",
      },
    );
    expect(r).toEqual({
      ok: true,
      valor: { opcoes: ["a", "c"], outro: "mais" },
    });
  });

  it("número sem `inteiro` aceita decimal", () => {
    expect(conferirValor(p("n", "numero"), 2.75).ok).toBe(true);
  });
});

describe("T216 — conferirRespostas", () => {
  const secoes: Secao[] = [
    {
      id: "s1",
      titulo: null,
      descricao: null,
      perguntas: [
        p("gosta", "sim_nao", {}, { obrigatoria: true }),
        p(
          "porque",
          "paragrafo",
          {},
          {
            obrigatoria: true,
            condicao: { perguntaId: "gosta", opcaoId: "nao" },
          },
        ),
        p(
          "detalhe",
          "texto_curto",
          {},
          {
            obrigatoria: true,
            condicao: { perguntaId: "porque", opcaoId: "x" },
          },
        ),
      ],
    },
    {
      id: "s2",
      titulo: null,
      descricao: null,
      perguntas: [p("nota", "nota_0_10", { enps: true })],
    },
  ];

  it("obrigatória visível sem resposta: erro pelo id", () => {
    expect(conferirRespostas(secoes, []).erros).toEqual([
      { campo: "gosta", motivo: "obrigatorio" },
    ]);
    expect(
      conferirRespostas(secoes, [{ perguntaId: "gosta", valor: "nao" }]).erros,
    ).toEqual([{ campo: "porque", motivo: "obrigatorio" }]);
  });

  it("escondida: não é exigida e o valor enviado é descartado", () => {
    const r = conferirRespostas(secoes, [
      { perguntaId: "gosta", valor: "sim" },
      { perguntaId: "porque", valor: "não deveria ficar" },
      { perguntaId: "nota", valor: 9 },
    ]);
    expect(r.erros).toEqual([]);
    expect(r.valores).toEqual([
      { perguntaId: "gosta", valor: "sim" },
      { perguntaId: "nota", valor: 9 },
    ]);
  });

  it("valor inválido: erro pelo id; texto vazio conta como não respondido", () => {
    expect(
      conferirRespostas(secoes, [
        { perguntaId: "gosta", valor: "sim" },
        { perguntaId: "nota", valor: 11 },
      ]).erros,
    ).toEqual([{ campo: "nota", motivo: "invalido" }]);
    expect(
      conferirRespostas(secoes, [
        { perguntaId: "gosta", valor: "nao" },
        { perguntaId: "porque", valor: "   " },
      ]).erros,
    ).toEqual([{ campo: "porque", motivo: "obrigatorio" }]);
  });

  it("pergunta desconhecida ou repetida recusa o envio", () => {
    expect(
      conferirRespostas(secoes, [{ perguntaId: "zz", valor: 1 }]).erros,
    ).toEqual([{ campo: "respostas", motivo: "invalido" }]);
    expect(
      conferirRespostas(secoes, [
        { perguntaId: "gosta", valor: "sim" },
        { perguntaId: "gosta", valor: "nao" },
      ]).erros,
    ).toEqual([{ campo: "respostas", motivo: "invalido" }]);
  });

  it("com erro, nenhum valor sai", () => {
    expect(
      conferirRespostas(secoes, [{ perguntaId: "nota", valor: 5 }]).valores,
    ).toEqual([]);
  });
});

describe("T216 — perguntasVistas", () => {
  it("cadeia de condições: só vê quem marcou cada opção anterior", () => {
    const secoes: Secao[] = [
      {
        id: "s",
        titulo: null,
        descricao: null,
        perguntas: [
          p("a", "escolha_unica", { opcoes }),
          p(
            "b",
            "sim_nao",
            {},
            { condicao: { perguntaId: "a", opcaoId: "b" } },
          ),
          p(
            "c",
            "texto_curto",
            {},
            {
              condicao: { perguntaId: "b", opcaoId: "sim" },
            },
          ),
        ],
      },
    ];
    const vistas = (valores: [string, unknown][]) =>
      [...perguntasVistas(secoes, new Map(valores))].sort();
    expect(vistas([])).toEqual(["a"]);
    expect(vistas([["a", { opcao: "b" }]])).toEqual(["a", "b"]);
    expect(
      vistas([
        ["a", { opcao: "b" }],
        ["b", "sim"],
      ]),
    ).toEqual(["a", "b", "c"]);
    expect(
      vistas([
        ["a", { opcao: "a" }],
        ["b", "sim"],
      ]),
    ).toEqual(["a"]);
  });
});
