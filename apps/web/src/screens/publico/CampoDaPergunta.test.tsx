import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Pergunta } from "../../api/pesquisaPublicaClient";
import { CampoDaPergunta } from "./CampoDaPergunta";

/** T216 — os tipos novos: escalas de 4 pontos, rótulo por ponto e LNPS. */

const base = (p: Partial<Pergunta>): Pergunta => ({
  id: "q",
  tipo: "concordancia",
  texto: "Pergunta",
  descricao: null,
  obrigatoria: true,
  config: {},
  condicao: null,
  ...p,
});

describe("T216 — CampoDaPergunta (tipos dos modelos)", () => {
  it("concordância de 4 pontos: sem meio-termo, valores de 1 a 4", () => {
    const aoMudar = vi.fn();
    render(
      <CampoDaPergunta
        pergunta={base({ tipo: "concordancia_4" })}
        valor={undefined}
        erro={null}
        aoMudar={aoMudar}
      />,
    );
    const opcoes = screen.getAllByRole("radio");
    expect(opcoes).toHaveLength(4);
    expect(screen.queryByText("Neutro")).toBeNull();
    fireEvent.click(screen.getByLabelText("Concordo parcialmente"));
    expect(aoMudar).toHaveBeenCalledWith(3);
  });

  it("satisfação de 4 pontos: os quatro rótulos", () => {
    render(
      <CampoDaPergunta
        pergunta={base({ tipo: "satisfacao_4" })}
        valor={4}
        erro={null}
        aoMudar={() => undefined}
      />,
    );
    expect(screen.getByLabelText("Muito satisfeito")).toBeChecked();
    expect(screen.getByLabelText("Muito insatisfeito")).not.toBeChecked();
    expect(screen.getAllByRole("radio")).toHaveLength(4);
  });

  it("concordância de 5 pontos: o meio é Neutro", () => {
    render(
      <CampoDaPergunta
        pergunta={base({ tipo: "concordancia" })}
        valor={undefined}
        erro={null}
        aoMudar={() => undefined}
      />,
    );
    expect(screen.getByLabelText("Neutro")).toBeInTheDocument();
  });

  it("escala com rótulo por ponto: número e texto em cada botão", () => {
    const aoMudar = vi.fn();
    render(
      <CampoDaPergunta
        pergunta={base({
          tipo: "escala",
          config: { minimo: 1, maximo: 3, rotulos: ["Nada", "Médio", "Muito"] },
        })}
        valor={undefined}
        erro={null}
        aoMudar={aoMudar}
      />,
    );
    expect(screen.getAllByRole("radio")).toHaveLength(3);
    expect(screen.getByText("Médio")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/3\s*Muito/));
    expect(aoMudar).toHaveBeenCalledWith(3);
  });

  it("nota 0–10 do LNPS e pontas próprias", () => {
    const { rerender } = render(
      <CampoDaPergunta
        pergunta={base({ tipo: "nota_0_10", config: { lnps: true } })}
        valor={undefined}
        erro={null}
        aoMudar={() => undefined}
      />,
    );
    expect(screen.getByText("Pouco provável")).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(11);
    rerender(
      <CampoDaPergunta
        pergunta={base({
          tipo: "nota_0_10",
          config: { rotuloMinimo: "Nada", rotuloMaximo: "Muito" },
        })}
        valor={undefined}
        erro={null}
        aoMudar={() => undefined}
      />,
    );
    expect(screen.getByText("Nada")).toBeInTheDocument();
    expect(screen.getByText("Muito")).toBeInTheDocument();
  });
});
