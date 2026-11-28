import { fireEvent, render, screen, within } from "@testing-library/react";
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
    expect(screen.getByRole("radio", { name: "Neutro" })).toBeInTheDocument();
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

describe("T216 — concordância 1 a 5 e a escala de 7 pontos", () => {
  it("concordância: 5 quadrados lado a lado, número e rótulo, pontas em cima", () => {
    const aoMudar = vi.fn();
    const { container } = render(
      <CampoDaPergunta
        pergunta={base({ tipo: "concordancia" })}
        valor={undefined}
        erro={null}
        aoMudar={aoMudar}
      />,
    );
    const grupo = screen.getByRole("radiogroup");
    const fileira = container.querySelector(".pesquisa-opcoes")!;
    expect(fileira).toHaveClass("pesquisa-opcoes--linha");
    expect(fileira).toHaveStyle({ "--colunas": "5" });
    const quadrados = within(fileira as HTMLElement).getAllByText(/^[1-5]$/);
    expect(quadrados.map((q) => q.textContent)).toEqual([
      "1",
      "2",
      "3",
      "4",
      "5",
    ]);
    const radios = within(grupo).getAllByRole("radio");
    expect(radios.map((r) => r.closest("label")!.textContent)).toEqual([
      "1Discordo totalmente",
      "2Discordo",
      "3Neutro",
      "4Concordo",
      "5Concordo totalmente",
    ]);
    // As pontas ficam acima da fileira e descrevem o grupo.
    const pontas = container.querySelector(".pesquisa-extremos")!;
    expect(pontas.textContent).toBe("Discordo totalmenteConcordo totalmente");
    expect(
      pontas.compareDocumentPosition(fileira) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(grupo.getAttribute("aria-describedby")).toContain(pontas.id);
    fireEvent.click(screen.getByRole("radio", { name: "Concordo" }));
    expect(aoMudar).toHaveBeenCalledWith(4);
  });

  it("escala de 7 pontos com rótulos (TAD): botões em degradê", () => {
    const { container } = render(
      <CampoDaPergunta
        pergunta={base({
          tipo: "escala",
          config: {
            minimo: 1,
            maximo: 7,
            rotulos: ["a", "b", "c", "d", "e", "f", "g"],
          },
        })}
        valor={undefined}
        erro={null}
        aoMudar={() => undefined}
      />,
    );
    const fileira = container.querySelector(".pesquisa-opcoes")!;
    expect(fileira).toHaveClass("pesquisa-opcoes--degrade");
    const tons = [...fileira.querySelectorAll("label")].map((l) =>
      (l as HTMLElement).style.getPropertyValue("--tom"),
    );
    expect(tons).toEqual(["0%", "17%", "33%", "50%", "67%", "83%", "100%"]);
  });

  it("escala de 5 pontos com rótulos e a nota 0 a 10 ficam sem degradê", () => {
    const { container, rerender } = render(
      <CampoDaPergunta
        pergunta={base({
          tipo: "escala",
          config: { minimo: 1, maximo: 5, rotulos: ["a", "b", "c", "d", "e"] },
        })}
        valor={undefined}
        erro={null}
        aoMudar={() => undefined}
      />,
    );
    expect(container.querySelector(".pesquisa-opcoes--degrade")).toBeNull();
    rerender(
      <CampoDaPergunta
        pergunta={base({ tipo: "nota_0_10", config: { enps: true } })}
        valor={undefined}
        erro={null}
        aoMudar={() => undefined}
      />,
    );
    expect(container.querySelector(".pesquisa-opcoes--degrade")).toBeNull();
  });
});
