/**
 * T216 — "Sobre o modelo" do Pulso: cabeçalho com ícone, título e selo;
 * 4 números (perguntas de 1 a 10, recomendação, comentário e frequência);
 * "As perguntas" agrupadas pelo jeito de responder (obrigatórias e
 * opcionais); "Como a pessoa responde" (prévia em que dá para marcar uma
 * nota) e "O que o RH vê" (rosca e barras). Sem "O que você recebe", ficha
 * técnica ou janela de exemplo.
 */
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SobreOModelo } from "../../SobreOModelo";

function montar() {
  const onUsar = vi.fn();
  render(<SobreOModelo id="pulso" onVoltar={vi.fn()} onUsar={onUsar} />);
  return { onUsar };
}

describe("Sobre o modelo — Pulso", () => {
  it("cabeçalho com título e selo; os 4 números", () => {
    montar();
    const titulo = screen.getByRole("heading", { level: 1 });
    expect(titulo).toHaveTextContent(
      "Pesquisa Pulso · Leitura rápida e frequente",
    );
    expect(titulo).toHaveTextContent("5 perguntas");
    const numeros = screen.getByLabelText("Em números");
    const pares = within(numeros)
      .getAllByRole("definition")
      .map(
        (dd) => `${dd.textContent} ${dd.previousElementSibling!.textContent}`,
      );
    expect(pares).toEqual([
      "5 perguntas de 1 a 10",
      "1 de recomendação (eNPS)",
      "1 comentário opcional",
      "Mensal frequência sugerida",
    ]);
  });

  it("as perguntas por jeito de responder, com obrigatórias e opcionais", () => {
    montar();
    const perguntas = screen.getByRole("region", { name: "As perguntas" });
    const grupos = within(perguntas).getAllByRole("list");
    expect(grupos.map((g) => g.children.length)).toEqual([5, 1, 1]);
    expect(perguntas).toHaveTextContent("Escala de 1 a 10Obrigatórias");
    expect(perguntas).toHaveTextContent("Recomendação (eNPS) · 0 a 10Opcional");
    expect(perguntas).toHaveTextContent("Comentário livreOpcional");
    expect(perguntas).toHaveTextContent("nossa empresa");
    expect(document.body.textContent).not.toContain("{empresa}");
  });

  it("como a pessoa responde: dá para marcar uma nota na prévia", () => {
    montar();
    const como = screen.getByRole("region", { name: "Como a pessoa responde" });
    expect(como).toHaveTextContent("cerca de 3 minutos");
    expect(como).toHaveTextContent("Pergunta 1 de 7");
    const notas = within(como).getByRole("radiogroup", {
      name: "Prévia: escolha uma nota",
    });
    const radios = within(notas).getAllByRole("radio");
    expect(radios).toHaveLength(10);
    fireEvent.click(within(notas).getByRole("radio", { name: "8" }));
    expect(within(notas).getByRole("radio", { name: "8" })).toBeChecked();
    expect(within(notas).getByRole("radio", { name: "7" })).not.toBeChecked();
  });

  it("o que o RH vê; sem 'O que você recebe' nem ficha técnica", () => {
    const { onUsar } = montar();
    const rh = screen.getByRole("region", { name: "O que o RH vê" });
    expect(
      within(rh).getByRole("img", { name: "Exemplo: média 8,4 de 10" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("O que você recebe")).toBeNull();
    expect(screen.queryByRole("region", { name: "Ficha técnica" })).toBeNull();
    expect(
      screen.queryByRole("figure", { name: "Exemplo do resultado" }),
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Criar pesquisa" }));
    expect(onUsar).toHaveBeenCalledWith("pulso");
  });
});
