import { normalizarEstruturaFixa, type EstruturaFixa } from "./estrutura-fixa";
import { estruturaFixaDo, temResultadoProprio } from "./registro";

/** T216 — questionário fixo: estrutura do servidor, textos do corpo. */

const DEF: EstruturaFixa = {
  secoes: [
    {
      id: "a",
      titulo: "Seção A",
      perguntas: [
        {
          id: "Q1",
          tipo: "escala",
          obrigatoria: true,
          config: { minimo: 1, maximo: 5, rotulos: ["1", "2", "3", "4", "5"] },
        },
        {
          id: "Q2",
          tipo: "escolha_unica",
          obrigatoria: false,
          config: { outro: false },
          opcoes: ["x", "y"],
        },
      ],
    },
    {
      id: "b",
      titulo: "Opcional",
      opcional: true,
      perguntas: [{ id: "O1", tipo: "escala", obrigatoria: false, config: {} }],
    },
  ],
};

const pergunta = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  tipo: "paragrafo",
  texto: ` Texto ${id} `,
  rotulo: `R ${id}`,
  config: {
    opcoes: [
      { id: "x", texto: "Xis" },
      { id: "y", texto: "Ípsilon" },
    ],
  },
  ...extra,
});

describe("normalizarEstruturaFixa", () => {
  it("usa ids, tipos e configuração do servidor e os textos do corpo", () => {
    const r = normalizarEstruturaFixa(DEF, [
      { id: "qualquer", perguntas: [pergunta("Q1"), pergunta("Q2")] },
    ]);
    expect(r.erros).toEqual([]);
    expect(r.secoes).toHaveLength(1);
    expect(r.secoes[0]).toMatchObject({ id: "a", titulo: "Seção A" });
    expect(r.secoes[0]!.perguntas[0]).toEqual({
      id: "Q1",
      tipo: "escala",
      texto: "Texto Q1",
      rotulo: "R Q1",
      descricao: null,
      obrigatoria: true,
      config: { minimo: 1, maximo: 5, rotulos: ["1", "2", "3", "4", "5"] },
      condicao: null,
    });
    expect(r.secoes[0]!.perguntas[1]!.config.opcoes).toEqual([
      { id: "x", texto: "Xis" },
      { id: "y", texto: "Ípsilon" },
    ]);
    expect(r.secoes[0]!.perguntas[1]!.obrigatoria).toBe(false);
  });

  it("a seção opcional entra quando o corpo traz alguma pergunta dela", () => {
    const r = normalizarEstruturaFixa(DEF, [
      { perguntas: [pergunta("Q1"), pergunta("Q2")] },
      { perguntas: [pergunta("O1")] },
    ]);
    expect(r.secoes.map((s) => s.id)).toEqual(["a", "b"]);
  });

  it("recusa forma inválida, pergunta desconhecida ou repetida", () => {
    const invalido = [{ campo: "secoes", motivo: "invalido" }];
    expect(normalizarEstruturaFixa(DEF, null).erros).toEqual(invalido);
    expect(normalizarEstruturaFixa(DEF, [{ x: 1 }]).erros).toEqual(invalido);
    expect(
      normalizarEstruturaFixa(DEF, [{ perguntas: [pergunta("Q9")] }]).erros,
    ).toEqual(invalido);
    expect(
      normalizarEstruturaFixa(DEF, [
        { perguntas: [pergunta("Q1"), pergunta("Q1")] },
      ]).erros,
    ).toEqual(invalido);
  });

  it("texto ausente, longo, rótulo longo e opção sem texto", () => {
    const r = normalizarEstruturaFixa(DEF, [
      {
        perguntas: [
          pergunta("Q1", { texto: "x".repeat(301) }),
          pergunta("Q2", { config: { opcoes: [{ id: "x", texto: "Xis" }] } }),
        ],
      },
    ]);
    expect(r.erros).toEqual([
      { campo: "Q1", motivo: "limite" },
      { campo: "Q2", motivo: "invalido" },
    ]);
    expect(r.secoes).toEqual([]);
    const s = normalizarEstruturaFixa(DEF, [
      { perguntas: [pergunta("Q2", { rotulo: "r".repeat(41) })] },
    ]);
    expect(s.erros).toEqual([
      { campo: "Q1", motivo: "obrigatorio" },
      { campo: "Q2", motivo: "limite" },
    ]);
  });
});

describe("registro dos modelos", () => {
  it("NR-1 e saúde financeira têm questionário fixo e resultado próprio", () => {
    expect(estruturaFixaDo("copsoq")?.secoes).toHaveLength(8);
    expect(estruturaFixaDo("isfb")?.secoes).toHaveLength(6);
    expect(estruturaFixaDo("pulso")).toBeNull();
    expect(temResultadoProprio("copsoq")).toBe(true);
    expect(temResultadoProprio("isfb")).toBe(true);
    expect(temResultadoProprio("clima")).toBe(false);
  });
});
