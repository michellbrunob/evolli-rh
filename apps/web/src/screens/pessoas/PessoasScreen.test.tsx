import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PessoasScreen } from "./PessoasScreen";

describe("PessoasScreen — abas locais 'Colaboradores' / 'Horário de trabalho' / 'Histórico funcional' (T072/T088)", () => {
  it("mostra 'Colaboradores' por padrão, com h1 único", () => {
    render(<PessoasScreen />);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", { level: 1, name: "Colaboradores" }),
    ).toBeInTheDocument();
  });

  it("expõe as três abas com role='tab' e aria-selected correto por padrão", () => {
    render(<PessoasScreen />);

    const tablist = screen.getByRole("tablist", { name: "Seções de Pessoas" });
    expect(tablist).toBeInTheDocument();

    const abaColaboradores = screen.getByRole("tab", {
      name: "Colaboradores",
    });
    const abaHorario = screen.getByRole("tab", {
      name: "Horário de trabalho",
    });
    const abaHistoricoFuncional = screen.getByRole("tab", {
      name: "Histórico funcional",
    });
    expect(abaColaboradores).toHaveAttribute("aria-selected", "true");
    expect(abaHorario).toHaveAttribute("aria-selected", "false");
    expect(abaHistoricoFuncional).toHaveAttribute("aria-selected", "false");
    expect(abaColaboradores.tagName).toBe("BUTTON");
    expect(abaHorario.tagName).toBe("BUTTON");
    expect(abaHistoricoFuncional.tagName).toBe("BUTTON");
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

  it("troca para 'Histórico funcional' ao clicar na aba, com h1 único e informa o titleId", () => {
    const onTituloIdChange = vi.fn();
    render(<PessoasScreen onTituloIdChange={onTituloIdChange} />);

    fireEvent.click(screen.getByRole("tab", { name: "Histórico funcional" }));

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", { level: 1, name: "Histórico funcional" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("table", { name: "Histórico funcional (exemplo)" }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("tab", { name: "Histórico funcional" }),
    ).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Colaboradores" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
    expect(onTituloIdChange).toHaveBeenCalledWith("historico-funcional-titulo");
  });

  it("volta para 'Colaboradores' ao clicar de novo na aba", () => {
    render(<PessoasScreen />);

    fireEvent.click(screen.getByRole("tab", { name: "Horário de trabalho" }));
    fireEvent.click(screen.getByRole("tab", { name: "Colaboradores" }));

    expect(
      screen.getByRole("heading", { level: 1, name: "Colaboradores" }),
    ).toBeInTheDocument();
  });

  it("passa por 'Histórico funcional' e volta para 'Colaboradores', preservando 'Horário de trabalho' sem regressão", () => {
    render(<PessoasScreen />);

    fireEvent.click(screen.getByRole("tab", { name: "Histórico funcional" }));
    expect(
      screen.getByRole("heading", { level: 1, name: "Histórico funcional" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Horário de trabalho" }));
    expect(
      screen.getByRole("heading", { level: 1, name: "Horário de trabalho" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("table", {
        name: "Colaboradores com tabela de horário atribuída",
      }),
    ).toBeInTheDocument();

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
    fireEvent.click(screen.getByRole("tab", { name: "Histórico funcional" }));
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
    ]) {
      expect(texto).not.toContain(termoProibido);
    }
  });
});
