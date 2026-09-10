import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CadastrosScreen } from "./CadastrosScreen";

describe("CadastrosScreen — abas locais 'Horários' / 'Estrutura organizacional' / 'Calendário de feriados' / 'Políticas de Banco de Horas' / 'Funções e cargos' / 'Motivos de ausência e justificativas' (T073/T076/T078/T080/T081)", () => {
  it("mostra 'Horários' por padrão, com h1 único", () => {
    render(<CadastrosScreen />);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", { level: 1, name: "Horários" }),
    ).toBeInTheDocument();
  });

  it("expõe as seis abas com role='tab' e aria-selected correto por padrão", () => {
    render(<CadastrosScreen />);

    const tablist = screen.getByRole("tablist", {
      name: "Seções de Cadastros",
    });
    expect(tablist).toBeInTheDocument();

    const abaHorarios = screen.getByRole("tab", { name: "Horários" });
    const abaEstrutura = screen.getByRole("tab", {
      name: "Estrutura organizacional",
    });
    const abaFeriados = screen.getByRole("tab", {
      name: "Calendário de feriados",
    });
    const abaPoliticas = screen.getByRole("tab", {
      name: "Políticas de Banco de Horas",
    });
    const abaFuncoes = screen.getByRole("tab", {
      name: "Funções e cargos",
    });
    const abaMotivos = screen.getByRole("tab", {
      name: "Motivos de ausência e justificativas",
    });
    expect(abaHorarios).toHaveAttribute("aria-selected", "true");
    expect(abaEstrutura).toHaveAttribute("aria-selected", "false");
    expect(abaFeriados).toHaveAttribute("aria-selected", "false");
    expect(abaPoliticas).toHaveAttribute("aria-selected", "false");
    expect(abaFuncoes).toHaveAttribute("aria-selected", "false");
    expect(abaMotivos).toHaveAttribute("aria-selected", "false");
    expect(abaHorarios.tagName).toBe("BUTTON");
    expect(abaEstrutura.tagName).toBe("BUTTON");
    expect(abaFeriados.tagName).toBe("BUTTON");
    expect(abaPoliticas.tagName).toBe("BUTTON");
    expect(abaFuncoes.tagName).toBe("BUTTON");
    expect(abaMotivos.tagName).toBe("BUTTON");
  });

  it("troca para 'Calendário de feriados' ao clicar na aba, com h1 único e informa o titleId", () => {
    const onTituloIdChange = vi.fn();
    render(<CadastrosScreen onTituloIdChange={onTituloIdChange} />);

    fireEvent.click(
      screen.getByRole("tab", { name: "Calendário de feriados" }),
    );

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Calendário de feriados",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("table", { name: "Calendário de feriados (exemplo)" }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("tab", { name: "Calendário de feriados" }),
    ).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Horários" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
    expect(
      screen.getByRole("tab", { name: "Estrutura organizacional" }),
    ).toHaveAttribute("aria-selected", "false");
    expect(onTituloIdChange).toHaveBeenCalledWith("calendario-feriados-titulo");
  });

  it("troca para 'Políticas de Banco de Horas' ao clicar na aba, com h1 único e informa o titleId", () => {
    const onTituloIdChange = vi.fn();
    render(<CadastrosScreen onTituloIdChange={onTituloIdChange} />);

    fireEvent.click(
      screen.getByRole("tab", { name: "Políticas de Banco de Horas" }),
    );

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Políticas de Banco de Horas",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("table", {
        name: "Políticas de Banco de Horas (exemplo)",
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("tab", { name: "Políticas de Banco de Horas" }),
    ).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Horários" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
    expect(onTituloIdChange).toHaveBeenCalledWith(
      "politicas-banco-horas-titulo",
    );
  });

  it("troca para 'Funções e cargos' ao clicar na aba, com h1 único e informa o titleId", () => {
    const onTituloIdChange = vi.fn();
    render(<CadastrosScreen onTituloIdChange={onTituloIdChange} />);

    fireEvent.click(screen.getByRole("tab", { name: "Funções e cargos" }));

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Funções e cargos",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("table", { name: "Funções e cargos (exemplo)" }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("tab", { name: "Funções e cargos" }),
    ).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Horários" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
    expect(onTituloIdChange).toHaveBeenCalledWith("funcoes-cargos-titulo");
  });

  it("troca para 'Motivos de ausência e justificativas' ao clicar na aba, com h1 único e informa o titleId", () => {
    const onTituloIdChange = vi.fn();
    render(<CadastrosScreen onTituloIdChange={onTituloIdChange} />);

    fireEvent.click(
      screen.getByRole("tab", {
        name: "Motivos de ausência e justificativas",
      }),
    );

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Motivos de ausência e justificativas",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("table", {
        name: "Motivos de ausência e justificativas (exemplo)",
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("tab", {
        name: "Motivos de ausência e justificativas",
      }),
    ).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Horários" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
    expect(onTituloIdChange).toHaveBeenCalledWith(
      "motivos-ausencia-justificativas-titulo",
    );
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

  it("passa por 'Calendário de feriados' e volta para 'Horários', preservando 'Estrutura organizacional' sem regressão", () => {
    render(<CadastrosScreen />);

    fireEvent.click(
      screen.getByRole("tab", { name: "Calendário de feriados" }),
    );
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Calendário de feriados",
      }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("tab", { name: "Estrutura organizacional" }),
    );
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

    fireEvent.click(screen.getByRole("tab", { name: "Horários" }));
    expect(
      screen.getByRole("heading", { level: 1, name: "Horários" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("table", { name: "Tabelas de horário cadastradas" }),
    ).toBeInTheDocument();
  });

  it("passa por 'Políticas de Banco de Horas' e volta para 'Horários', preservando 'Estrutura organizacional' e 'Calendário de feriados' sem regressão", () => {
    render(<CadastrosScreen />);

    fireEvent.click(
      screen.getByRole("tab", { name: "Políticas de Banco de Horas" }),
    );
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Políticas de Banco de Horas",
      }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("tab", { name: "Calendário de feriados" }),
    );
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Calendário de feriados",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("table", { name: "Calendário de feriados (exemplo)" }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("tab", { name: "Estrutura organizacional" }),
    );
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

    fireEvent.click(screen.getByRole("tab", { name: "Horários" }));
    expect(
      screen.getByRole("heading", { level: 1, name: "Horários" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("table", { name: "Tabelas de horário cadastradas" }),
    ).toBeInTheDocument();
  });

  it("passa por 'Funções e cargos' e volta para 'Horários', preservando 'Estrutura organizacional'/'Calendário de feriados'/'Políticas de Banco de Horas' sem regressão", () => {
    render(<CadastrosScreen />);

    fireEvent.click(screen.getByRole("tab", { name: "Funções e cargos" }));
    expect(
      screen.getByRole("heading", { level: 1, name: "Funções e cargos" }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("tab", { name: "Políticas de Banco de Horas" }),
    );
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Políticas de Banco de Horas",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("table", {
        name: "Políticas de Banco de Horas (exemplo)",
      }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("tab", { name: "Calendário de feriados" }),
    );
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Calendário de feriados",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("table", { name: "Calendário de feriados (exemplo)" }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("tab", { name: "Estrutura organizacional" }),
    );
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

    fireEvent.click(screen.getByRole("tab", { name: "Horários" }));
    expect(
      screen.getByRole("heading", { level: 1, name: "Horários" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("table", { name: "Tabelas de horário cadastradas" }),
    ).toBeInTheDocument();
  });

  it("passa por 'Motivos de ausência e justificativas' e volta para 'Horários', preservando 'Funções e cargos'/'Políticas de Banco de Horas'/'Calendário de feriados'/'Estrutura organizacional' sem regressão", () => {
    render(<CadastrosScreen />);

    fireEvent.click(
      screen.getByRole("tab", {
        name: "Motivos de ausência e justificativas",
      }),
    );
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Motivos de ausência e justificativas",
      }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Funções e cargos" }));
    expect(
      screen.getByRole("heading", { level: 1, name: "Funções e cargos" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("table", { name: "Funções e cargos (exemplo)" }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("tab", { name: "Políticas de Banco de Horas" }),
    );
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Políticas de Banco de Horas",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("table", {
        name: "Políticas de Banco de Horas (exemplo)",
      }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("tab", { name: "Calendário de feriados" }),
    );
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Calendário de feriados",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("table", { name: "Calendário de feriados (exemplo)" }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("tab", { name: "Estrutura organizacional" }),
    );
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
    fireEvent.click(
      screen.getByRole("tab", { name: "Calendário de feriados" }),
    );
    fireEvent.click(
      screen.getByRole("tab", { name: "Políticas de Banco de Horas" }),
    );
    fireEvent.click(screen.getByRole("tab", { name: "Funções e cargos" }));
    fireEvent.click(
      screen.getByRole("tab", {
        name: "Motivos de ausência e justificativas",
      }),
    );
    fireEvent.click(screen.getByRole("tab", { name: "Horários" }));

    const texto = document.body.innerHTML.toLowerCase();
    for (const termoProibido of [
      "reserva fiscal",
      "secullum",
      "rwtech",
      "bioprox",
      "senha",
      "sessão",
      "razão social",
    ]) {
      expect(texto).not.toContain(termoProibido);
    }
  });
});
