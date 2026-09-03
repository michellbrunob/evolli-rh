import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CadastrosScreen } from "./CadastrosScreen";

describe("CadastrosScreen — abas locais 'Horários' / 'Estrutura organizacional' (T073)", () => {
  it("mostra 'Horários' por padrão, com h1 único", () => {
    render(<CadastrosScreen />);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", { level: 1, name: "Horários" }),
    ).toBeInTheDocument();
  });

  it("expõe as duas abas com role='tab' e aria-selected correto por padrão", () => {
    render(<CadastrosScreen />);

    const tablist = screen.getByRole("tablist", {
      name: "Seções de Cadastros",
    });
    expect(tablist).toBeInTheDocument();

    const abaHorarios = screen.getByRole("tab", { name: "Horários" });
    const abaEstrutura = screen.getByRole("tab", {
      name: "Estrutura organizacional",
    });
    expect(abaHorarios).toHaveAttribute("aria-selected", "true");
    expect(abaEstrutura).toHaveAttribute("aria-selected", "false");
    expect(abaHorarios.tagName).toBe("BUTTON");
    expect(abaEstrutura.tagName).toBe("BUTTON");
  });

  it("troca para 'Estrutura organizacional' ao clicar na aba, com h1 único e informa o titleId", () => {
    const onTituloIdChange = vi.fn();
    render(<CadastrosScreen onTituloIdChange={onTituloIdChange} />);

    fireEvent.click(
      screen.getByRole("tab", { name: "Estrutura organizacional" }),
    );

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Estrutura organizacional",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("table", {
        name: "Itens da estrutura organizacional",
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("tab", { name: "Estrutura organizacional" }),
    ).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Horários" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
    expect(onTituloIdChange).toHaveBeenCalledWith(
      "estrutura-organizacional-titulo",
    );
  });

  it("volta para 'Horários' ao clicar de novo na aba, preservando a tela T043 sem regressão", () => {
    render(<CadastrosScreen />);

    fireEvent.click(
      screen.getByRole("tab", { name: "Estrutura organizacional" }),
    );
    fireEvent.click(screen.getByRole("tab", { name: "Horários" }));

    expect(
      screen.getByRole("heading", { level: 1, name: "Horários" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("table", { name: "Tabelas de horário cadastradas" }),
    ).toBeInTheDocument();
  });

  it("informa o titleId do h1 visível via onTituloIdChange, inclusive ao trocar de aba", () => {
    const onTituloIdChange = vi.fn();
    render(<CadastrosScreen onTituloIdChange={onTituloIdChange} />);

    expect(onTituloIdChange).toHaveBeenCalledWith("horarios-titulo");

    fireEvent.click(
      screen.getByRole("tab", { name: "Estrutura organizacional" }),
    );
    expect(onTituloIdChange).toHaveBeenCalledWith(
      "estrutura-organizacional-titulo",
    );

    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1.id).toBe("estrutura-organizacional-titulo");
  });

  it("não referencia autenticação, sessão, CNPJ, razão social, dinheiro ou dado real em nenhuma das abas", () => {
    render(<CadastrosScreen />);
    fireEvent.click(
      screen.getByRole("tab", { name: "Estrutura organizacional" }),
    );
    fireEvent.click(screen.getByRole("tab", { name: "Horários" }));

    const texto = document.body.innerHTML.toLowerCase();
    for (const termoProibido of [
      "reserva fiscal",
      "secullum",
      "rwtech",
      "bioprox",
      "login",
      "senha",
      "sessão",
      "salário",
      "salario",
      "pagamento",
      "razão social",
    ]) {
      expect(texto).not.toContain(termoProibido);
    }
  });
});
