/**
 * T216 — Perfil comportamental (DISC), o retrato do time: o perfil
 * equilibrado tem texto próprio (não o do fator principal), "Como o time
 * funciona" junta um ponto de cada fator principal e a diversidade cita só
 * o fator mais ausente.
 */
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DETALHE } from "../../dadosDeTeste";
import { FATOR } from "./fatores";
import { chipsDoTime, fatorMaisAusente, resumoDoTime } from "./perfis";
import { ResultadosDisc } from "./ResultadosDisc";
import { resultadoDeTeste } from "./resultadoDeTeste";
import type { ClasseDisc, ResultadoDisc } from "./tiposDisc";

const TRI: ClasseDisc = {
  tipo: "tri",
  fatores: ["D", "C", "S"],
  codigo: "DCS",
  intensidade: "equilibrado",
};
const BI: ClasseDisc = {
  tipo: "bi",
  fatores: ["D", "I"],
  codigo: "DI",
  intensidade: "acentuado",
};
const MONO: ClasseDisc = {
  tipo: "mono",
  fatores: ["S"],
  codigo: "S",
  intensidade: "puro",
};

describe("DISC — textos do time", () => {
  it("time equilibrado: texto próprio, com os três fatores", () => {
    const t = resumoDoTime(TRI);
    expect(t).not.toBe(FATOR.D.resumo);
    expect(t).toMatch(/equilibrad/);
    expect(t).toContain("dominância, conformidade e estabilidade");
  });

  it("combinação e fator único seguem o conteúdo do perfil", () => {
    expect(resumoDoTime(BI)).not.toBe(FATOR.D.resumo);
    expect(resumoDoTime(BI)).not.toMatch(/equilibrad/);
    expect(resumoDoTime(MONO)).toBe(FATOR.S.resumo);
  });

  it("os pontos do time: um de cada fator principal, em rodízio", () => {
    expect(chipsDoTime(TRI, "fortes")).toEqual([
      FATOR.D.fortes[0],
      FATOR.C.fortes[0],
      FATOR.S.fortes[0],
    ]);
    expect(chipsDoTime(BI, "estresse")).toEqual([
      FATOR.D.estresse[0],
      FATOR.I.estresse[0],
      FATOR.D.estresse[1],
    ]);
    expect(chipsDoTime(MONO, "atencao")).toEqual(FATOR.S.atencao.slice(0, 3));
  });

  it("o fator mais ausente: o de menor presença na composição", () => {
    const p = { D: 40, I: 10, S: 5, C: 45 };
    expect(fatorMaisAusente(["I", "S"], p)).toBe("S");
    expect(fatorMaisAusente(["I", "C"], { ...p, I: 20, C: 20 })).toBe("I");
    expect(fatorMaisAusente([], p)).toBeNull();
  });
});

describe("DISC — Visão geral do time", () => {
  const montar = (dados: ResultadoDisc) =>
    render(
      <ResultadosDisc
        detalhe={{ ...DETALHE, modelo: "disc" }}
        aba="geral"
        carregar={() => Promise.resolve(dados)}
      />,
    );

  it("perfil equilibrado com texto próprio e os pontos de cada fator", async () => {
    montar(resultadoDeTeste());
    const time = await screen.findByRole("region", { name: "Perfil do time" });
    expect(time).toHaveTextContent(resumoDoTime(TRI));
    expect(time).not.toHaveTextContent(FATOR.D.resumo);
    const funciona = screen.getByRole("region", {
      name: "Como o time funciona",
    });
    expect(funciona).toHaveTextContent(
      "Dominância, Conformidade e Estabilidade",
    );
    const fortes = within(funciona).getAllByRole("list")[0]!;
    expect(
      within(fortes)
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual([FATOR.D.fortes[0], FATOR.C.fortes[0], FATOR.S.fortes[0]]);
  });

  it("com dois fatores ausentes, cita só o mais ausente", async () => {
    const base = resultadoDeTeste();
    montar({
      ...base,
      diversidade: { ...base.diversidade, ausentes: ["I", "C"] },
    });
    const div = await screen.findByRole("region", {
      name: "Diversidade comportamental",
    });
    // Composição: I 20%, C 27% — a Influência é a mais ausente.
    expect(within(div).getByText("Fator ausente no time")).toBeInTheDocument();
    expect(within(div).getByText(/^Influência: /)).toBeInTheDocument();
    expect(within(div).queryByText(/^Conformidade: /)).toBeNull();
    expect(within(div).queryByText("Fatores ausentes no time")).toBeNull();
  });
});
