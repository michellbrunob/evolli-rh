import { describe, expect, it } from "vitest";
import { modeloDaGaleria, secoesDoModelo } from "../modelosDePesquisa";
import { ehQuestionarioFixo, MODELOS_REGISTRADOS } from "./catalogo";
import { DIMENSOES_NR1, ITENS_NR1 } from "./copsoq/definicao";
import { ITENS_ISFB } from "./isfb/definicao";

/** T216 — catálogo dos modelos com metodologia própria. */

describe("catálogo dos modelos com metodologia própria", () => {
  it("NR-1: 76 perguntas com ids fixos em 8 domínios e 29 dimensões", () => {
    const m = modeloDaGaleria("copsoq");
    expect(m.modelo).toBe("copsoq");
    const secoes = secoesDoModelo(m);
    expect(secoes.map((s) => s.id)).toEqual([
      "exigencias_laborais",
      "organizacao_conteudo",
      "relacoes_sociais_lideranca",
      "interface_trabalho_individuo",
      "valores_local_trabalho",
      "personalidade",
      "saude_bem_estar",
      "comportamentos_ofensivos",
    ]);
    const perguntas = secoes.flatMap((s) => s.perguntas);
    expect(perguntas).toHaveLength(76);
    expect(perguntas.map((p) => p.id)).toEqual(ITENS_NR1.map((i) => i.id));
    expect(perguntas[63]!.config.rotulos).toEqual([
      "Excelente",
      "Muito boa",
      "Boa",
      "Regular",
      "Fraca",
    ]);
    expect(perguntas.every((p) => p.texto.length <= 300)).toBe(true);
    expect(perguntas.every((p) => (p.rotulo ?? "").length <= 40)).toBe(true);
    expect(DIMENSOES_NR1).toHaveLength(29);
    expect(ITENS_NR1.filter((i) => i.invertido).map((i) => i.id)).toEqual([
      "Q53",
      "Q54",
    ]);
  });

  it("saúde financeira: 18 perguntas, opções com ids fixos", () => {
    const secoes = secoesDoModelo(modeloDaGaleria("isfb"));
    expect(secoes.map((s) => s.id)).toEqual([
      "seguranca",
      "habilidade",
      "comportamento",
      "liberdade",
      "base",
      "autopercepcao",
    ]);
    const perguntas = secoes.flatMap((s) => s.perguntas);
    expect(perguntas.map((p) => p.id)).toEqual(ITENS_ISFB.map((i) => i.id));
    const q13 = perguntas.find((p) => p.id === "Q13")!;
    expect(q13.tipo).toBe("multipla_escolha");
    expect(q13.obrigatoria).toBe(false);
    expect(q13.config.opcoes).toHaveLength(14);
    expect(q13.config.opcoes![3]).toEqual({
      id: "poupanca",
      texto: "Poupança",
    });
    expect(perguntas.find((p) => p.id === "Q14")!.config.opcoes).toHaveLength(
      7,
    );
    const q2 = perguntas.find((p) => p.id === "Q2")!;
    expect(q2.config).toMatchObject({
      minimo: 0,
      maximo: 4,
      somenteRotulos: true,
    });
    expect(perguntas.find((p) => p.id === "O1")!.obrigatoria).toBe(false);
    expect(perguntas.filter((p) => p.obrigatoria)).toHaveLength(14);
  });

  it("os dois modelos são questionários fixos registrados", () => {
    expect(MODELOS_REGISTRADOS.map((m) => m.id)).toEqual(["copsoq", "isfb"]);
    expect(ehQuestionarioFixo("copsoq")).toBe(true);
    expect(ehQuestionarioFixo("isfb")).toBe(true);
    expect(ehQuestionarioFixo("pulso")).toBe(false);
  });
});
