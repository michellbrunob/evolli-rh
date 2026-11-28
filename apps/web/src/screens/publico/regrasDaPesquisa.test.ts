import { describe, expect, it } from "vitest";
import type { Pergunta, Secao } from "../../api/pesquisaPublicaClient";
import {
  cpfValido,
  erroDaPergunta,
  lerNumero,
  lerRascunho,
  mascararCpf,
  montarRespostas,
  perguntasEmOrdem,
  perguntasVisiveis,
  respondida,
} from "./regrasDaPesquisa";

function p(id: string, extra: Partial<Pergunta> = {}): Pergunta {
  return {
    id,
    tipo: "texto_curto",
    texto: id,
    descricao: null,
    obrigatoria: false,
    config: {},
    condicao: null,
    ...extra,
  };
}

const SECOES: Secao[] = [
  {
    id: "s",
    titulo: null,
    descricao: null,
    perguntas: [
      p("a", {
        tipo: "multipla_escolha",
        config: {
          opcoes: [
            { id: "x", texto: "X" },
            { id: "y", texto: "Y" },
          ],
        },
      }),
      p("b", {
        tipo: "escolha_unica",
        condicao: { perguntaId: "a", opcaoId: "y" },
        config: {
          opcoes: [
            { id: "m", texto: "M" },
            { id: "n", texto: "N" },
          ],
        },
      }),
      p("c", { condicao: { perguntaId: "b", opcaoId: "m" } }),
    ],
  },
];

describe("T216 — regras da resposta", () => {
  it("condição encadeada: escondida a mãe, a filha some também", () => {
    const todas = {
      a: { opcoes: ["y"], outro: null },
      b: { opcao: "m", outro: null },
      c: "texto",
    };
    expect([...perguntasVisiveis(SECOES, todas)]).toEqual(["a", "b", "c"]);
    const semY = { ...todas, a: { opcoes: ["x"], outro: null } };
    expect([...perguntasVisiveis(SECOES, semY)]).toEqual(["a"]);
    expect(montarRespostas(SECOES, semY)).toEqual([
      { perguntaId: "a", valor: { opcoes: ["x"] } },
    ]);
  });

  it("CPF: máscara e dígitos verificadores", () => {
    expect(mascararCpf("2074319")).toBe("207.431.9");
    expect(mascararCpf("207431958419999")).toBe("207.431.958-41");
    expect(cpfValido("20743195841")).toBe(true);
    expect(cpfValido("20743195840")).toBe(false);
    expect(cpfValido("11111111111")).toBe(false);
  });

  it("número: vírgula decimal e lixo", () => {
    expect(lerNumero("2,5")).toBe(2.5);
    expect(lerNumero("1.234,5")).toBe(1234.5);
    expect(lerNumero(" 12 ")).toBe(12);
    expect(lerNumero("1e3")).toBeNull();
    expect(lerNumero("")).toBeNull();
  });

  it("texto acima do limite e opcional vazio", () => {
    const curta = p("t");
    expect(erroDaPergunta(curta, "x".repeat(301))).toBe(
      "Use até 300 caracteres.",
    );
    expect(erroDaPergunta(curta, "   ")).toBeNull();
    expect(erroDaPergunta({ ...curta, obrigatoria: true }, "   ")).toBe(
      "Escreva uma resposta para continuar.",
    );
  });

  it("número só com mínimo ou só com máximo", () => {
    const n = p("n", { tipo: "numero", config: { minimo: 1.5 } });
    expect(erroDaPergunta(n, "1")).toBe("Informe um número a partir de 1,5.");
    const m = p("m", { tipo: "numero", config: { maximo: 10 } });
    expect(erroDaPergunta(m, "11")).toBe("Informe um número até 10.");
  });

  it("rascunho guardado: aceita só a forma esperada", () => {
    expect(lerRascunho(null)).toEqual({});
    expect(lerRascunho("[1]")).toEqual({});
    expect(
      lerRascunho(
        JSON.stringify({
          a: 3,
          b: "sim",
          c: { opcoes: ["x", 2], outro: "o" },
          d: { opcao: "m" },
          e: null,
        }),
      ),
    ).toEqual({
      a: 3,
      b: "sim",
      c: { opcoes: ["x"], outro: "o" },
      d: { opcao: "m", outro: null },
    });
  });

  it("uma por tela: só as visíveis, na ordem, com a primeira de cada seção", () => {
    const comY = { a: { opcoes: ["y"], outro: null } };
    const ordem = perguntasEmOrdem(SECOES, perguntasVisiveis(SECOES, comY));
    expect(ordem.map((o) => [o.pergunta.id, o.primeiraDaSecao])).toEqual([
      ["a", true],
      ["b", false],
    ]);
    expect(
      perguntasEmOrdem(SECOES, perguntasVisiveis(SECOES, {})),
    ).toHaveLength(1);
  });

  it("respondida: vazio, espaço e escolha sem nada não contam", () => {
    expect(respondida(undefined)).toBe(false);
    expect(respondida("  ")).toBe(false);
    expect(respondida({ opcoes: [], outro: null })).toBe(false);
    expect(respondida({ opcao: null, outro: "" })).toBe(true);
    expect(respondida(0)).toBe(true);
  });
});
