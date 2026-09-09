import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RelatoriosScreen } from "./RelatoriosScreen";

describe("RelatoriosScreen — abas locais 'Exceções de Ponto' / 'Relatórios disponíveis' (T075)", () => {
  it("mostra 'Exceções de Ponto' por padrão, com h1 único", () => {
    render(<RelatoriosScreen />);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", { level: 1, name: "Exceções de Ponto" }),
    ).toBeInTheDocument();
  });

  it("expõe as duas abas com role='tab' e aria-selected correto por padrão", () => {
    render(<RelatoriosScreen />);

    const tablist = screen.getByRole("tablist", {
      name: "Seções de Relatórios",
    });
    expect(tablist).toBeInTheDocument();

    const abaExcecoes = screen.getByRole("tab", { name: "Exceções de Ponto" });
    const abaDisponiveis = screen.getByRole("tab", {
      name: "Relatórios disponíveis",
    });
    expect(abaExcecoes).toHaveAttribute("aria-selected", "true");
    expect(abaDisponiveis).toHaveAttribute("aria-selected", "false");
    expect(abaExcecoes.tagName).toBe("BUTTON");
    expect(abaDisponiveis.tagName).toBe("BUTTON");
  });

  it("troca para 'Relatórios disponíveis' ao clicar na aba, com h1 único e informa o titleId", () => {
    const onTituloIdChange = vi.fn();
    render(<RelatoriosScreen onTituloIdChange={onTituloIdChange} />);

    fireEvent.click(
      screen.getByRole("tab", { name: "Relatórios disponíveis" }),
    );

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Relatórios disponíveis",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("table", {
        name: "Relatórios futuros do módulo de Ponto",
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("tab", { name: "Relatórios disponíveis" }),
    ).toHaveAttribute("aria-selected", "true");
    expect(
      screen.getByRole("tab", { name: "Exceções de Ponto" }),
    ).toHaveAttribute("aria-selected", "false");
    expect(onTituloIdChange).toHaveBeenCalledWith(
      "relatorios-disponiveis-titulo",
    );
  });

  it("volta para 'Exceções de Ponto' ao clicar de novo na aba", () => {
    render(<RelatoriosScreen />);

    fireEvent.click(
      screen.getByRole("tab", { name: "Relatórios disponíveis" }),
    );
    fireEvent.click(screen.getByRole("tab", { name: "Exceções de Ponto" }));

    expect(
      screen.getByRole("heading", { level: 1, name: "Exceções de Ponto" }),
    ).toBeInTheDocument();
  });

  it("informa o titleId do h1 visível via onTituloIdChange, inclusive ao trocar de aba", () => {
    const onTituloIdChange = vi.fn();
    render(<RelatoriosScreen onTituloIdChange={onTituloIdChange} />);

    expect(onTituloIdChange).toHaveBeenCalledWith("excecoes-ponto-titulo");

    fireEvent.click(
      screen.getByRole("tab", { name: "Relatórios disponíveis" }),
    );
    expect(onTituloIdChange).toHaveBeenCalledWith(
      "relatorios-disponiveis-titulo",
    );

    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1.id).toBe("relatorios-disponiveis-titulo");
  });

  it("não referencia autenticação, sessão, CPF, dinheiro ou dado real em nenhuma das abas", () => {
    render(<RelatoriosScreen />);
    fireEvent.click(
      screen.getByRole("tab", { name: "Relatórios disponíveis" }),
    );
    fireEvent.click(screen.getByRole("tab", { name: "Exceções de Ponto" }));

    const texto = document.body.innerHTML.toLowerCase();
    for (const termoProibido of [
      "cpf",
      "reserva fiscal",
      "secullum",
      "rwtech",
      "bioprox",
      "senha",
      "sessão",
      "salário",
      "salario",
      "pagamento",
    ]) {
      expect(texto).not.toContain(termoProibido);
    }
  });
});
