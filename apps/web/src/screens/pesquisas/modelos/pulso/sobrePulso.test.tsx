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
  it("cabeçalho com título e selo; os 4 números com ícone, o número em destaque e o rótulo embaixo", () => {
    montar();
    const titulo = screen.getByRole("heading", { level: 1 });
    expect(titulo).toHaveTextContent(/^Pesquisa PulsoRápida · recorrente$/);
    const numeros = screen.getByLabelText("Em números");
    expect(numeros).toHaveClass("pesquisas__faixa--numeros");
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
    // Um ícone por bloco.
    for (const dd of within(numeros).getAllByRole("definition"))
      expect(dd.querySelector("svg")).not.toBeNull();
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

  it("como a pessoa responde: a prévia funciona — nota, cor da faixa e Próxima", () => {
    montar();
    const como = screen.getByRole("region", { name: "Como a pessoa responde" });
    expect(como).toHaveTextContent("cerca de 3 minutos");
    expect(como).toHaveTextContent("Pergunta 1 de 7");
    expect(
      within(como).getByRole("progressbar", { name: "Progresso da prévia" }),
    ).toHaveAttribute("aria-valuenow", "1");
    expect(como).toHaveTextContent("nossa empresa");
    expect(como).toHaveTextContent("Discordo totalmente");
    expect(como).toHaveTextContent("Concordo totalmente");
    const proxima = within(como).getByRole("button", { name: "Próxima →" });
    expect(proxima).toBeDisabled();
    const notas = () =>
      within(como).getByRole("radiogroup", {
        name: "Prévia: escolha uma nota",
      });
    expect(within(notas()).getAllByRole("radio")).toHaveLength(10);
    // A nota marcada pega a cor da faixa.
    fireEvent.click(within(notas()).getByRole("radio", { name: "3" }));
    expect(within(notas()).getByRole("radio", { name: "3" })).toBeChecked();
    expect(
      within(notas()).getByRole("radio", { name: "3" }).closest("label"),
    ).toHaveAttribute("data-faixa", "baixa");
    fireEvent.click(within(notas()).getByRole("radio", { name: "9" }));
    expect(
      within(notas()).getByRole("radio", { name: "9" }).closest("label"),
    ).toHaveAttribute("data-faixa", "alta");
    expect(proxima).toBeEnabled();
    fireEvent.click(proxima);
    expect(como).toHaveTextContent("Pergunta 2 de 7");
    expect(como).toHaveTextContent(
      "Sei com clareza o que esperam do meu trabalho.",
    );
    // A pergunta nova começa sem nota.
    expect(within(notas()).queryByRole("radio", { checked: true })).toBeNull();
    expect(
      within(como).getByRole("button", { name: "Próxima →" }),
    ).toBeDisabled();
  });

  it("a prévia vai até o fim (recomendação de 0 a 10 e comentário) e recomeça", () => {
    montar();
    const como = screen.getByRole("region", { name: "Como a pessoa responde" });
    for (let i = 0; i < 5; i += 1) {
      fireEvent.click(within(como).getByRole("radio", { name: "8" }));
      fireEvent.click(within(como).getByRole("button", { name: "Próxima →" }));
    }
    expect(como).toHaveTextContent("Pergunta 6 de 7");
    expect(within(como).getAllByRole("radio")).toHaveLength(11);
    fireEvent.click(within(como).getByRole("radio", { name: "0" }));
    fireEvent.click(within(como).getByRole("button", { name: "Próxima →" }));
    expect(como).toHaveTextContent("Pergunta 7 de 7");
    // O comentário é opcional: dá para seguir sem escrever.
    expect(within(como).getByRole("textbox")).toBeInTheDocument();
    fireEvent.click(within(como).getByRole("button", { name: "Recomeçar" }));
    expect(como).toHaveTextContent("Pergunta 1 de 7");
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
