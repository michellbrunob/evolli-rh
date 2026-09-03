import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PessoasScreen } from "./PessoasScreen";

describe("PessoasScreen — abas locais 'Colaboradores' / 'Horário de trabalho' (T072)", () => {
  it("mostra 'Colaboradores' por padrão, com h1 único", () => {
    render(<PessoasScreen />);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", { level: 1, name: "Colaboradores" }),
    ).toBeInTheDocument();
  });

  it("expõe as duas abas com role='tab' e aria-selected correto por padrão", () => {
    render(<PessoasScreen />);

    const tablist = screen.getByRole("tablist", { name: "Seções de Pessoas" });
    expect(tablist).toBeInTheDocument();

    const abaColaboradores = screen.getByRole("tab", {
      name: "Colaboradores",
    });
    const abaHorario = screen.getByRole("tab", {
      name: "Horário de trabalho",
    });
    expect(abaColaboradores).toHaveAttribute("aria-selected", "true");
    expect(abaHorario).toHaveAttribute("aria-selected", "false");
    expect(abaColaboradores.tagName).toBe("BUTTON");
    expect(abaHorario.tagName).toBe("BUTTON");
  });

  it("troca para 'Horário de trabalho' ao clicar na aba — preservado sem regressão (T046)", () => {
    const onTituloIdChange = vi.fn();
    render(<PessoasScreen onTituloIdChange={onTituloIdChange} />);

    fireEvent.click(screen.getByRole("tab", { name: "Horário de trabalho" }));

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", { level: 1, name: "Horário de trabalho" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("table", {
        name: "Colaboradores com tabela de horário atribuída",
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("tab", { name: "Horário de trabalho" }),
    ).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Colaboradores" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
    expect(onTituloIdChange).toHaveBeenCalledWith("pessoas-horario-titulo");
  });

  it("volta para 'Colaboradores' ao clicar de novo na aba", () => {
    render(<PessoasScreen />);

    fireEvent.click(screen.getByRole("tab", { name: "Horário de trabalho" }));
    fireEvent.click(screen.getByRole("tab", { name: "Colaboradores" }));

    expect(
      screen.getByRole("heading", { level: 1, name: "Colaboradores" }),
    ).toBeInTheDocument();
  });

  it("informa o titleId do h1 visível via onTituloIdChange, inclusive ao trocar de aba", () => {
    const onTituloIdChange = vi.fn();
    render(<PessoasScreen onTituloIdChange={onTituloIdChange} />);

    expect(onTituloIdChange).toHaveBeenCalledWith("colaboradores-titulo");

    fireEvent.click(screen.getByRole("tab", { name: "Horário de trabalho" }));
    expect(onTituloIdChange).toHaveBeenCalledWith("pessoas-horario-titulo");

    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1.id).toBe("pessoas-horario-titulo");
  });

  it("não referencia autenticação, sessão, CPF, dinheiro ou dado real em nenhuma das abas", () => {
    render(<PessoasScreen />);
    fireEvent.click(screen.getByRole("tab", { name: "Horário de trabalho" }));
    fireEvent.click(screen.getByRole("tab", { name: "Colaboradores" }));

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
    ]) {
      expect(texto).not.toContain(termoProibido);
    }
  });
});
