import type { Pergunta, Secao } from "../../pesquisas.types";
import {
  errosDaEstruturaDoModelo,
  resumoDaRespostaDoModelo,
  resultadoIndividualDoModelo,
} from "../indice";
import {
  calcularTad,
  indicadorDaTad,
  individualDaTad,
  nivelDaTad,
} from "./calculo";
import { ITENS_TAD, PILARES_TAD, ROTULOS_TAD } from "./definicao";

/** T216 — Motivação (TAD): pilares, itens invertidos, níveis e o time. */

function estrutura(config: Pergunta["config"] = {}): Secao[] {
  return [
    {
      id: "s",
      titulo: null,
      descricao: null,
      perguntas: ITENS_TAD.map((i) => ({
        id: `id_${i.chave}`,
        chave: i.chave,
        tipo: "escala" as const,
        texto: i.chave,
        rotulo: null,
        descricao: null,
        obrigatoria: true,
        config: { minimo: 1, maximo: 7, rotulos: [...ROTULOS_TAD], ...config },
        condicao: null,
      })),
    },
  ];
}

/** Uma nota para os itens diretos e outra para os invertidos. */
function valores(direto: number, invertido: number) {
  return new Map<string, unknown>(
    ITENS_TAD.map((i) => [`id_${i.chave}`, i.invertido ? invertido : direto]),
  );
}

describe("T216 — Motivação (TAD)", () => {
  it("21 afirmações: autonomia 7, competência 6, relacionamento 8; 9 invertidas", () => {
    expect(ITENS_TAD).toHaveLength(21);
    const conta = (pilar: string) =>
      ITENS_TAD.filter((i) => i.pilar === pilar).length;
    expect(PILARES_TAD.map((p) => conta(p.chave))).toEqual([7, 6, 8]);
    expect(ITENS_TAD.filter((i) => i.invertido).map((i) => i.chave)).toEqual([
      "tad_03",
      "tad_05",
      "tad_07",
      "tad_11",
      "tad_14",
      "tad_16",
      "tad_18",
      "tad_19",
      "tad_20",
    ]);
  });

  it("tudo 7: invertidos valem 8 − 7 = 1 → 4,43 · 4,00 · 4,75 e geral 4,39", () => {
    const r = individualDaTad(estrutura(), valores(7, 7))!;
    expect(r.pilares.map((p) => p.score)).toEqual([4.43, 4, 4.75]);
    expect(r.geral).toBe(4.39);
    expect(r.nivel).toBe("moderado");
    expect(r.pilares.map((p) => p.perguntas)).toEqual([7, 6, 8]);
  });

  it("diretos 7 e invertidos 1 → tudo 7 (alto); o contrário → tudo 1 (baixo)", () => {
    const alto = individualDaTad(estrutura(), valores(7, 1))!;
    expect(alto.geral).toBe(7);
    expect(alto.pilares.every((p) => p.nivel === "alto")).toBe(true);
    const baixo = individualDaTad(estrutura(), valores(1, 7))!;
    expect(baixo.geral).toBe(1);
    expect(baixo.nivel).toBe("baixo");
  });

  it("geral = média dos 3 pilares (não dos 21 itens)", () => {
    // Só a autonomia respondida em 6: os outros pilares ficam sem score.
    const v = new Map<string, unknown>(
      ITENS_TAD.filter((i) => i.pilar === "autonomia").map((i) => [
        `id_${i.chave}`,
        i.invertido ? 2 : 6,
      ]),
    );
    const r = individualDaTad(estrutura(), v)!;
    expect(r.pilares.map((p) => p.score)).toEqual([6, null, null]);
    expect(r.geral).toBe(6);
    expect(r.nivel).toBe("alto");
    expect(individualDaTad(estrutura(), new Map())).toBeNull();
  });

  it("níveis nas fronteiras: 5,5 alto, 5,49 moderado, 3,5 moderado, 3,49 baixo", () => {
    expect(nivelDaTad(7)).toBe("alto");
    expect(nivelDaTad(5.5)).toBe("alto");
    expect(nivelDaTad(5.49)).toBe("moderado");
    expect(nivelDaTad(3.5)).toBe("moderado");
    expect(nivelDaTad(3.49)).toBe("baixo");
    expect(nivelDaTad(1)).toBe("baixo");
  });

  it("time = média dos scores de cada pessoa, com a contagem por nível", () => {
    const r = calcularTad(estrutura(), [
      { valores: valores(7, 7) }, // 4,39
      { valores: valores(4, 4) }, // 4,00
      { valores: valores(7, 1) }, // 7,00
    ]);
    expect(r.respondentes).toBe(3);
    // (4,39 + 4 + 7) ÷ 3 = 5,13.
    expect(r.geral).toBe(5.13);
    expect(r.nivel).toBe("moderado");
    // Autonomia (4,43 + 4 + 7) ÷ 3 = 5,14; competência 5; relacionamento 5,25.
    expect(r.pilares.map((p) => p.score)).toEqual([5.14, 5, 5.25]);
    expect(r.niveis).toEqual({ alto: 1, moderado: 2, baixo: 0 });
  });

  it("sem respostas: tudo nulo", () => {
    const r = calcularTad(estrutura(), []);
    expect(r).toMatchObject({ respondentes: 0, geral: null, nivel: null });
    expect(r.pilares.every((p) => p.score === null)).toBe(true);
  });

  it("estrutura fixa: escala de 1 a 7; o individual sai pelo registro", () => {
    expect(errosDaEstruturaDoModelo("tad", estrutura())).toEqual([]);
    expect(errosDaEstruturaDoModelo("tad", estrutura({ maximo: 5 }))).toEqual([
      { campo: "secoes", motivo: "estrutura_do_modelo" },
    ]);
    expect(
      (
        resultadoIndividualDoModelo("tad", estrutura(), valores(7, 1)) as {
          geral: number | null;
        } | null
      )?.geral,
    ).toBe(7);
    expect(
      resultadoIndividualDoModelo("pulso", estrutura(), valores(7, 1)),
    ).toBeNull();
  });

  it("o individual traz o time (média das pessoas) só quando o recebe", () => {
    const time = [
      { valores: valores(7, 7) },
      { valores: valores(4, 4) },
      { valores: valores(7, 1) },
    ];
    const r = individualDaTad(estrutura(), valores(7, 1), time)!;
    expect(r.geral).toBe(7);
    expect(r.time).toEqual({ geral: 5.13, pilares: [5.14, 5, 5.25] });
    expect(individualDaTad(estrutura(), valores(7, 1))!.time).toBeNull();
    expect(individualDaTad(estrutura(), new Map(), time)).toBeNull();
    expect(
      resultadoIndividualDoModelo("tad", estrutura(), valores(7, 7), time),
    ).toMatchObject({ geral: 4.39, time: { geral: 5.13 } });
  });

  it("indicador da aba Respostas: o score geral com o nível", () => {
    expect(indicadorDaTad(estrutura(), valores(7, 7))).toEqual({
      modelo: "tad",
      valor: 4.39,
      nivel: "moderado",
    });
    expect(indicadorDaTad(estrutura(), valores(7, 1))).toEqual({
      modelo: "tad",
      valor: 7,
      nivel: "alto",
    });
    expect(indicadorDaTad(estrutura(), new Map())).toEqual({
      modelo: "tad",
      valor: null,
      nivel: null,
    });
    expect(resumoDaRespostaDoModelo("tad", estrutura(), valores(1, 7))).toEqual(
      { modelo: "tad", valor: 1, nivel: "baixo" },
    );
    expect(
      resumoDaRespostaDoModelo("pulso", estrutura(), valores(1, 7)),
    ).toBeNull();
  });
});
