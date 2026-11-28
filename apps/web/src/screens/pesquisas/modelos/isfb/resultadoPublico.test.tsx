/**
 * T216 — Saúde financeira: o resultado imediato da pessoa na página
 * pública. A conta no navegador segue a da API (mesmos casos do teste do
 * cálculo no servidor) e a tela mostra a nota em anel, a faixa, a diferença
 * para a média do Brasil, as barras por dimensão e os cartões.
 */
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Secao } from "../../../../api/pesquisaPublicaClient";
import {
  ResponderPesquisa,
  montarPreviaPublica,
} from "../../../publico/ResponderPesquisa";
import { modeloDaGaleria, secoesDoModelo } from "../../modelosDePesquisa";
import { ResultadoPublicoIsfb } from "./ResultadoPublicoIsfb";
import { resultadoIsfbDasRespostas } from "./resultadoLocal";

interface Pessoa {
  /** Posição (0 a 4) da opção da Q1. */
  q1: number;
  /** Posições (0 a 4) de Q2 a Q12. */
  escalas: number[];
  /** Posições dos produtos marcados na Q13. */
  produtos: number[];
  /** Posições de Q14 (renda) e Q15 (escolaridade). */
  renda: number;
  escolaridade: number;
  auto?: [number, number, number];
}

const OTIMA: Pessoa = {
  q1: 4,
  escalas: [0, 0, 0, 4, 4, 4, 4, 4, 4, 4, 4],
  produtos: [0, 1, 2, 3, 4, 5, 6, 7, 8],
  renda: 6,
  escolaridade: 5,
};
const RUIM: Pessoa = {
  q1: 0,
  escalas: [4, 4, 4, 0, 0, 0, 0, 0, 0, 0, 0],
  produtos: [],
  renda: 0,
  escolaridade: 0,
};
/** Meio da escala, base baixa (5 pontos), com autopercepção. */
const MEIO: Pessoa = {
  q1: 2,
  escalas: [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  produtos: [0, 1, 3],
  renda: 2,
  escolaridade: 3,
  auto: [3, 3, 3],
};

const secoes = (): Secao[] => secoesDoModelo(modeloDaGaleria("isfb"));

function respostasDe(s: readonly Secao[], p: Pessoa) {
  const porChave = new Map(
    s.flatMap((x) => x.perguntas).map((q) => [q.chave!, q]),
  );
  const q = (c: string) => porChave.get(c)!;
  const opcao = (c: string, i: number) => ({
    opcao: q(c).config.opcoes![i]!.id,
    outro: null,
  });
  const r: Record<string, unknown> = {
    [q("Q1").id]: opcao("Q1", p.q1),
    [q("Q13").id]: {
      opcoes: p.produtos.map((i) => q("Q13").config.opcoes![i]!.id),
      outro: null,
    },
    [q("Q14").id]: opcao("Q14", p.renda),
    [q("Q15").id]: opcao("Q15", p.escolaridade),
  };
  p.escalas.forEach((v, i) => (r[q(`Q${i + 2}`).id] = v));
  p.auto?.forEach((v, i) => (r[q(`O${i + 1}`).id] = v));
  return r;
}

const calcular = (p: Pessoa) => {
  const s = secoes();
  return resultadoIsfbDasRespostas(s, respostasDe(s, p));
};

describe("saúde financeira: a conta no navegador", () => {
  it("melhor caso: 96, ótima, dimensões 96/96/96/94", () => {
    const r = calcular(OTIMA)!;
    expect(r.isfb).toBe(96);
    expect(r.faixa).toBe("otima");
    expect(r.diferencaDoBrasil).toBe(39.3);
    expect(r.dimensoes.map((d) => [d.id, d.nota, d.faixa])).toEqual([
      ["seguranca", 96, "otima"],
      ["habilidade", 96, "otima"],
      ["comportamento", 96, "otima"],
      ["liberdade", 94, "otima"],
    ]);
  });

  it("pior caso: 8 (a base baixa compensa), ruim", () => {
    const r = calcular(RUIM)!;
    expect(r.isfb).toBe(8);
    expect(r.faixa).toBe("ruim");
    expect(r.diferencaDoBrasil).toBe(-48.7);
    expect(r.dimensoes.map((d) => d.nota)).toEqual([0, 4, 4, 11]);
  });

  it("meio: 56, com a autopercepção (80) por último e a faixa de cada dimensão", () => {
    const r = calcular(MEIO)!;
    expect(r.isfb).toBe(56);
    expect(r.faixa).toBe("baixa");
    expect(r.dimensoes.map((d) => d.id)).toEqual([
      "seguranca",
      "habilidade",
      "comportamento",
      "liberdade",
      "autopercepcao",
    ]);
    const seg = r.dimensoes[0]!;
    expect([seg.nota, seg.faixa]).toEqual([57, "ok"]);
    // Cortes da própria dimensão: 56 em habilidade é "OK" (na régua global
    // seria "Baixa").
    expect(r.dimensoes[1]!.faixa).toBe("ok");
    expect(r.dimensoes[2]!.faixa).toBe("baixa");
    expect(r.dimensoes[3]!.nota).toBe(58);
    expect(r.dimensoes[4]!.nota).toBe(80);
  });

  it("base no limite: 6 pontos ainda é base baixa; 7 já é alta", () => {
    // Produtos (3 → 2) + renda + escolaridade (Médio completo → 2).
    const seis = calcular({ ...MEIO, renda: 3 })!; // 2 + 2 + 2
    const sete = calcular({ ...MEIO, renda: 5 })!; // 2 + 3 + 2
    expect(seis.isfb).toBe(56);
    expect(sete.isfb).toBe(42);
  });

  it("sem uma pergunta que forma a nota, não há resultado", () => {
    const s = secoes();
    const r = respostasDe(s, MEIO);
    const q7 = s.flatMap((x) => x.perguntas).find((p) => p.chave === "Q7")!;
    delete r[q7.id];
    expect(resultadoIsfbDasRespostas(s, r)).toBeNull();
    expect(resultadoIsfbDasRespostas(s, {})).toBeNull();
  });
});

describe("saúde financeira: a tela do resultado", () => {
  const montar = (p: Pessoa, previa = false) =>
    render(
      <ResultadoPublicoIsfb
        resultado={calcular(p)!}
        previa={previa}
        titulo={<h1>Respostas enviadas!</h1>}
      />,
    );

  it("nota em anel, faixa, frase e a diferença para a média do Brasil", () => {
    montar(OTIMA);
    expect(
      screen.getByRole("img", { name: "Sua nota: 96 de 100, faixa Ótima" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("39,3 pontos acima da média do Brasil (56,7)"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Finanças em dia, com reserva e planejamento."),
    ).toBeInTheDocument();
  });

  it("abaixo da média: o texto diz abaixo", () => {
    montar(RUIM);
    expect(
      screen.getByText("48,7 pontos abaixo da média do Brasil (56,7)"),
    ).toBeInTheDocument();
  });

  it("barras por dimensão com a linha da média e um cartão por dimensão", () => {
    montar(MEIO);
    const barras = screen.getByRole("list", { name: "Nota por dimensão" });
    expect(
      within(barras)
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual([
      "Segurança57",
      "Habilidade56",
      "Comportamento56",
      "Liberdade58",
      "Autopercepção80",
    ]);
    expect(screen.getByText("Média do Brasil: 56,7")).toBeInTheDocument();
    const cartoes = screen.getByRole("list", { name: "Suas dimensões" });
    const seg = within(cartoes).getAllByRole("listitem")[0]!;
    // A faixa da própria dimensão, sem intervalo de outra régua.
    expect(seg).toHaveTextContent("Segurança");
    expect(seg).toHaveTextContent("OK");
    expect(seg).not.toHaveTextContent(/\d+ a \d+/);
    // Habilidade 56: "OK" pelos cortes da dimensão (na régua global, "Baixa").
    const hab = within(cartoes).getAllByRole("listitem")[1]!;
    expect(hab).toHaveTextContent("OK");
    expect(hab).not.toHaveTextContent("Baixa");
  });

  it("aviso de que vale só agora e o PDF pela impressão", () => {
    const imprimir = vi.spyOn(window, "print").mockImplementation(() => {});
    montar(MEIO);
    expect(screen.getByRole("note")).toHaveTextContent(/só agora/);
    fireEvent.click(screen.getByRole("button", { name: "Salvar em PDF" }));
    expect(imprimir).toHaveBeenCalledTimes(1);
    imprimir.mockRestore();
  });

  it("na prévia, avisa que nada foi gravado", () => {
    montar(MEIO, true);
    expect(
      screen.getByText(/pré-visualização: nada foi gravado/),
    ).toBeVisible();
  });
});

describe("saúde financeira: resposta pelo link (prévia)", () => {
  it("ao enviar, a pessoa vê o próprio resultado", () => {
    const espiao = vi.spyOn(globalThis, "fetch");
    const s = secoes();
    render(
      <ResponderPesquisa
        previa={montarPreviaPublica({
          empresa: "Empresa Sintética",
          nome: "Saúde financeira",
          boasVindas: null,
          identificacao: "anonima",
          modelo: "isfb",
          secoes: s,
        })}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Começar a pré-visualização" }),
    );
    fireEvent.click(screen.getByRole("button", { name: /Iniciar/ }));
    const perguntas = s.flatMap((x) => x.perguntas);
    perguntas.forEach((p, i) => {
      if (p.chave === "Q13") {
        fireEvent.click(
          screen.getByRole("checkbox", { name: p.config.opcoes![0]!.texto }),
        );
      } else if (p.config.opcoes) {
        fireEvent.click(
          screen.getByRole("radio", { name: p.config.opcoes[2]!.texto }),
        );
      } else {
        fireEvent.click(
          screen.getByRole("radio", { name: p.config.rotulos![2]! }),
        );
      }
      fireEvent.click(
        screen.getByRole("button", {
          name: i === perguntas.length - 1 ? /Enviar respostas/ : /Próximo/,
        }),
      );
    });
    expect(
      screen.getByRole("heading", { name: "Respostas enviadas!" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: /^Sua nota: \d+ de 100/ }),
    ).toBeInTheDocument();
    expect(espiao).not.toHaveBeenCalled();
    espiao.mockRestore();
  });
});
