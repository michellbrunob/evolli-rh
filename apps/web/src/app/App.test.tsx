import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("renderiza o shell neutro do painel, sem dado ou fluxo de domínio", () => {
    render(<App />);

    expect(screen.getByText("Evolli RH")).toBeInTheDocument();
    expect(screen.getByText("Painel Administrativo")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Nenhum módulo disponível nesta versão inicial do shell.",
      ),
    ).toBeInTheDocument();
  });

  it("não referencia nenhum módulo de domínio no shell inicial", () => {
    render(<App />);

    const html = document.body.innerHTML.toLowerCase();
    for (const termoDeDominio of [
      "colaborador",
      "ponto",
      "folha",
      "reserva fiscal",
      "documento",
      "relatório",
    ]) {
      expect(html).not.toContain(termoDeDominio);
    }
  });
});
