import type { Pergunta, Secao } from "../../pesquisas.types";
import { novaVersaoDasPerguntas } from "./versao-das-perguntas";

/** T216 — Onboarding: nova versão das perguntas depois das respostas. */

const pergunta = (id: string, extra: Partial<Pergunta> = {}): Pergunta => ({
  id,
  chave: null,
  tipo: "concordancia_4",
  texto: `Pergunta ${id}`,
  rotulo: null,
  descricao: null,
  obrigatoria: true,
  config: {},
  condicao: null,
  ...extra,
});

const secao = (id: string, perguntas: Pergunta[]): Secao => ({
  id,
  titulo: null,
  descricao: null,
  perguntas,
});

const ANTES = [
  secao("s1", [
    pergunta("p1", { chave: "q1" }),
    pergunta("p2", {
      tipo: "escolha_unica",
      config: {
        opcoes: [
          { id: "o1", texto: "Sim" },
          { id: "o2", texto: "Não" },
        ],
      },
    }),
  ]),
  secao("s2", [
    pergunta("p3", { condicao: { perguntaId: "p2", opcaoId: "o1" } }),
  ]),
];

const sequencia = () => {
  let n = 0;
  return () => `novo-${++n}`;
};

describe("T216 — nova versão das perguntas do onboarding", () => {
  it("sem mudança, nada muda (mesmos ids)", () => {
    const r = novaVersaoDasPerguntas(
      ANTES,
      structuredClone(ANTES),
      new Set(["p1", "p2", "p3"]),
      sequencia(),
    );
    expect(r.versoes).toEqual({});
    expect(r.secoes).toEqual(ANTES);
  });

  it("pergunta respondida que mudou ganha id novo; a chave do modelo fica", () => {
    const depois = structuredClone(ANTES);
    depois[0]!.perguntas[0]!.texto = "Texto revisto";
    const r = novaVersaoDasPerguntas(
      ANTES,
      depois,
      new Set(["p1"]),
      sequencia(),
    );
    expect(r.versoes).toEqual({ p1: "novo-1" });
    expect(r.secoes[0]!.perguntas[0]).toMatchObject({
      id: "novo-1",
      chave: "q1",
      texto: "Texto revisto",
    });
    expect(r.secoes[0]!.perguntas[1]!.id).toBe("p2");
  });

  it("pergunta sem resposta muda no lugar", () => {
    const depois = structuredClone(ANTES);
    depois[0]!.perguntas[0]!.obrigatoria = false;
    const r = novaVersaoDasPerguntas(
      ANTES,
      depois,
      new Set(["p2"]),
      sequencia(),
    );
    expect(r.versoes).toEqual({});
    expect(r.secoes[0]!.perguntas[0]).toMatchObject({
      id: "p1",
      obrigatoria: false,
    });
  });

  it("mudar uma opção cria versão; a condição passa a apontar para a nova", () => {
    const depois = structuredClone(ANTES);
    depois[0]!.perguntas[1]!.config = {
      opcoes: [
        { id: "o1", texto: "Sim, com certeza" },
        { id: "o2", texto: "Não" },
      ],
    };
    const r = novaVersaoDasPerguntas(
      ANTES,
      depois,
      new Set(["p2", "p3"]),
      sequencia(),
    );
    expect(r.versoes).toEqual({ p2: "novo-1" });
    expect(r.secoes[1]!.perguntas[0]!.id).toBe("p3");
    expect(r.secoes[1]!.perguntas[0]!.condicao).toEqual({
      perguntaId: "novo-1",
      opcaoId: "o1",
    });
  });

  it("incluir e excluir é livre; a ordem das chaves não conta como mudança", () => {
    const depois = [
      secao("s1", [
        {
          condicao: null,
          config: {},
          obrigatoria: true,
          descricao: null,
          rotulo: null,
          texto: "Pergunta p1",
          tipo: "concordancia_4",
          chave: "q1",
          id: "p1",
        },
        pergunta("p9"),
      ]),
    ];
    const r = novaVersaoDasPerguntas(
      ANTES,
      depois,
      new Set(["p1", "p2", "p3"]),
      sequencia(),
    );
    expect(r.versoes).toEqual({});
    expect(r.secoes[0]!.perguntas.map((p) => p.id)).toEqual(["p1", "p9"]);
  });
});
