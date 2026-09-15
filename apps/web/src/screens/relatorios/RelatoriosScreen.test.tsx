import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RelatoriosScreen } from "./RelatoriosScreen";

describe("RelatoriosScreen — abas locais 'Exceções de Ponto' / 'Relatórios disponíveis' / 'Extrato de Banco de Horas' / 'Espelho de Ponto' / 'Justificativas' / 'Quadro de Horários' / 'Calendário de Feriados' / 'Listagem de Colaboradores' (T075/T098/T099/T100/T101/T102/T103)", () => {
  it("mostra 'Exceções de Ponto' por padrão, com h1 único", () => {
    render(<RelatoriosScreen />);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", { level: 1, name: "Exceções de Ponto" }),
    ).toBeInTheDocument();
  });

  it("expõe as oito abas com role='tab' e aria-selected correto por padrão", () => {
    render(<RelatoriosScreen />);

    const tablist = screen.getByRole("tablist", {
      name: "Seções de Relatórios",
    });
    expect(tablist).toBeInTheDocument();

    const abaExcecoes = screen.getByRole("tab", { name: "Exceções de Ponto" });
    const abaDisponiveis = screen.getByRole("tab", {
      name: "Relatórios disponíveis",
    });
    const abaExtrato = screen.getByRole("tab", {
      name: "Extrato de Banco de Horas",
    });
    const abaEspelho = screen.getByRole("tab", {
      name: "Espelho de Ponto",
    });
    const abaJustificativas = screen.getByRole("tab", {
      name: "Justificativas",
    });
    const abaQuadroHorarios = screen.getByRole("tab", {
      name: "Quadro de Horários",
    });
    const abaCalendarioFeriados = screen.getByRole("tab", {
      name: "Calendário de Feriados",
    });
    const abaListagemColaboradores = screen.getByRole("tab", {
      name: "Listagem de Colaboradores",
    });
    expect(abaExcecoes).toHaveAttribute("aria-selected", "true");
    expect(abaDisponiveis).toHaveAttribute("aria-selected", "false");
    expect(abaExtrato).toHaveAttribute("aria-selected", "false");
    expect(abaEspelho).toHaveAttribute("aria-selected", "false");
    expect(abaJustificativas).toHaveAttribute("aria-selected", "false");
    expect(abaQuadroHorarios).toHaveAttribute("aria-selected", "false");
    expect(abaCalendarioFeriados).toHaveAttribute("aria-selected", "false");
    expect(abaListagemColaboradores).toHaveAttribute("aria-selected", "false");
    expect(abaExcecoes.tagName).toBe("BUTTON");
    expect(abaDisponiveis.tagName).toBe("BUTTON");
    expect(abaExtrato.tagName).toBe("BUTTON");
    expect(abaEspelho.tagName).toBe("BUTTON");
    expect(abaJustificativas.tagName).toBe("BUTTON");
    expect(abaQuadroHorarios.tagName).toBe("BUTTON");
    expect(abaCalendarioFeriados.tagName).toBe("BUTTON");
    expect(abaListagemColaboradores.tagName).toBe("BUTTON");
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

  it("troca para 'Extrato de Banco de Horas' ao clicar na aba, com h1 único e informa o titleId", () => {
    const onTituloIdChange = vi.fn();
    render(<RelatoriosScreen onTituloIdChange={onTituloIdChange} />);

    fireEvent.click(
      screen.getByRole("tab", { name: "Extrato de Banco de Horas" }),
    );

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Extrato de Banco de Horas",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("table", {
        name: "Extrato de Banco de Horas (exemplo)",
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("tab", { name: "Extrato de Banco de Horas" }),
    ).toHaveAttribute("aria-selected", "true");
    expect(
      screen.getByRole("tab", { name: "Exceções de Ponto" }),
    ).toHaveAttribute("aria-selected", "false");
    expect(onTituloIdChange).toHaveBeenCalledWith("extrato-banco-horas-titulo");
  });

  it("passa por 'Extrato de Banco de Horas' e volta para 'Exceções de Ponto', preservando 'Relatórios disponíveis' sem regressão", () => {
    render(<RelatoriosScreen />);

    fireEvent.click(
      screen.getByRole("tab", { name: "Extrato de Banco de Horas" }),
    );
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Extrato de Banco de Horas",
      }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("tab", { name: "Relatórios disponíveis" }),
    );
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

    fireEvent.click(screen.getByRole("tab", { name: "Exceções de Ponto" }));
    expect(
      screen.getByRole("heading", { level: 1, name: "Exceções de Ponto" }),
    ).toBeInTheDocument();
  });

  it("troca para 'Espelho de Ponto' ao clicar na aba, com h1 único e informa o titleId", () => {
    const onTituloIdChange = vi.fn();
    render(<RelatoriosScreen onTituloIdChange={onTituloIdChange} />);

    fireEvent.click(screen.getByRole("tab", { name: "Espelho de Ponto" }));

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", { level: 1, name: "Espelho de Ponto" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("table", { name: "Espelho de Ponto (exemplo)" }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("tab", { name: "Espelho de Ponto" }),
    ).toHaveAttribute("aria-selected", "true");
    expect(
      screen.getByRole("tab", { name: "Exceções de Ponto" }),
    ).toHaveAttribute("aria-selected", "false");
    expect(onTituloIdChange).toHaveBeenCalledWith("espelho-ponto-titulo");
  });

  it("passa por 'Espelho de Ponto' e volta para 'Exceções de Ponto', preservando 'Extrato de Banco de Horas'/'Relatórios disponíveis' sem regressão", () => {
    render(<RelatoriosScreen />);

    fireEvent.click(screen.getByRole("tab", { name: "Espelho de Ponto" }));
    expect(
      screen.getByRole("heading", { level: 1, name: "Espelho de Ponto" }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("tab", { name: "Extrato de Banco de Horas" }),
    );
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Extrato de Banco de Horas",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("table", {
        name: "Extrato de Banco de Horas (exemplo)",
      }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("tab", { name: "Relatórios disponíveis" }),
    );
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

    fireEvent.click(screen.getByRole("tab", { name: "Exceções de Ponto" }));
    expect(
      screen.getByRole("heading", { level: 1, name: "Exceções de Ponto" }),
    ).toBeInTheDocument();
  });

  it("troca para 'Justificativas' ao clicar na aba, com h1 único e informa o titleId", () => {
    const onTituloIdChange = vi.fn();
    render(<RelatoriosScreen onTituloIdChange={onTituloIdChange} />);

    fireEvent.click(screen.getByRole("tab", { name: "Justificativas" }));

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", { level: 1, name: "Justificativas" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("table", {
        name: "Relatório de justificativas (exemplo)",
      }),
    ).toBeInTheDocument();

    expect(screen.getByRole("tab", { name: "Justificativas" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      screen.getByRole("tab", { name: "Exceções de Ponto" }),
    ).toHaveAttribute("aria-selected", "false");
    expect(onTituloIdChange).toHaveBeenCalledWith(
      "relatorio-justificativas-titulo",
    );
  });

  it("passa por 'Justificativas' e volta para 'Exceções de Ponto', preservando 'Espelho de Ponto'/'Extrato de Banco de Horas' sem regressão", () => {
    render(<RelatoriosScreen />);

    fireEvent.click(screen.getByRole("tab", { name: "Justificativas" }));
    expect(
      screen.getByRole("heading", { level: 1, name: "Justificativas" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Espelho de Ponto" }));
    expect(
      screen.getByRole("heading", { level: 1, name: "Espelho de Ponto" }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("tab", { name: "Extrato de Banco de Horas" }),
    );
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Extrato de Banco de Horas",
      }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Exceções de Ponto" }));
    expect(
      screen.getByRole("heading", { level: 1, name: "Exceções de Ponto" }),
    ).toBeInTheDocument();
  });

  it("troca para 'Quadro de Horários' ao clicar na aba, com h1 único e informa o titleId", () => {
    const onTituloIdChange = vi.fn();
    render(<RelatoriosScreen onTituloIdChange={onTituloIdChange} />);

    fireEvent.click(screen.getByRole("tab", { name: "Quadro de Horários" }));

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", { level: 1, name: "Quadro de Horários" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("table", { name: "Quadro de Horários (exemplo)" }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("tab", { name: "Quadro de Horários" }),
    ).toHaveAttribute("aria-selected", "true");
    expect(
      screen.getByRole("tab", { name: "Exceções de Ponto" }),
    ).toHaveAttribute("aria-selected", "false");
    expect(onTituloIdChange).toHaveBeenCalledWith("quadro-horarios-titulo");
  });

  it("passa por 'Quadro de Horários' e volta para 'Exceções de Ponto', preservando 'Justificativas'/'Espelho de Ponto' sem regressão", () => {
    render(<RelatoriosScreen />);

    fireEvent.click(screen.getByRole("tab", { name: "Quadro de Horários" }));
    expect(
      screen.getByRole("heading", { level: 1, name: "Quadro de Horários" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Justificativas" }));
    expect(
      screen.getByRole("heading", { level: 1, name: "Justificativas" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("table", {
        name: "Relatório de justificativas (exemplo)",
      }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Espelho de Ponto" }));
    expect(
      screen.getByRole("heading", { level: 1, name: "Espelho de Ponto" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Exceções de Ponto" }));
    expect(
      screen.getByRole("heading", { level: 1, name: "Exceções de Ponto" }),
    ).toBeInTheDocument();
  });

  it("troca para 'Calendário de Feriados' ao clicar na aba, com h1 único e informa o titleId", () => {
    const onTituloIdChange = vi.fn();
    render(<RelatoriosScreen onTituloIdChange={onTituloIdChange} />);

    fireEvent.click(
      screen.getByRole("tab", { name: "Calendário de Feriados" }),
    );

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Calendário de Feriados",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("table", {
        name: "Calendário de Feriados (exemplo)",
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("tab", { name: "Calendário de Feriados" }),
    ).toHaveAttribute("aria-selected", "true");
    expect(
      screen.getByRole("tab", { name: "Exceções de Ponto" }),
    ).toHaveAttribute("aria-selected", "false");
    expect(onTituloIdChange).toHaveBeenCalledWith(
      "relatorio-calendario-feriados-titulo",
    );
  });

  it("passa por 'Calendário de Feriados' e volta para 'Exceções de Ponto', preservando 'Quadro de Horários'/'Justificativas' sem regressão", () => {
    render(<RelatoriosScreen />);

    fireEvent.click(
      screen.getByRole("tab", { name: "Calendário de Feriados" }),
    );
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Calendário de Feriados",
      }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Quadro de Horários" }));
    expect(
      screen.getByRole("heading", { level: 1, name: "Quadro de Horários" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Justificativas" }));
    expect(
      screen.getByRole("heading", { level: 1, name: "Justificativas" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Exceções de Ponto" }));
    expect(
      screen.getByRole("heading", { level: 1, name: "Exceções de Ponto" }),
    ).toBeInTheDocument();
  });

  it("troca para 'Listagem de Colaboradores' ao clicar na aba, com h1 único e informa o titleId", () => {
    const onTituloIdChange = vi.fn();
    render(<RelatoriosScreen onTituloIdChange={onTituloIdChange} />);

    fireEvent.click(
      screen.getByRole("tab", { name: "Listagem de Colaboradores" }),
    );

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Listagem de Colaboradores",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("table", {
        name: "Listagem de Colaboradores (exemplo)",
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("tab", { name: "Listagem de Colaboradores" }),
    ).toHaveAttribute("aria-selected", "true");
    expect(
      screen.getByRole("tab", { name: "Exceções de Ponto" }),
    ).toHaveAttribute("aria-selected", "false");
    expect(onTituloIdChange).toHaveBeenCalledWith(
      "relatorio-listagem-colaboradores-titulo",
    );
  });

  it("passa por 'Listagem de Colaboradores' e volta para 'Exceções de Ponto', preservando 'Calendário de Feriados'/'Quadro de Horários' sem regressão", () => {
    render(<RelatoriosScreen />);

    fireEvent.click(
      screen.getByRole("tab", { name: "Listagem de Colaboradores" }),
    );
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Listagem de Colaboradores",
      }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("tab", { name: "Calendário de Feriados" }),
    );
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Calendário de Feriados",
      }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Quadro de Horários" }));
    expect(
      screen.getByRole("heading", { level: 1, name: "Quadro de Horários" }),
    ).toBeInTheDocument();

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
    fireEvent.click(
      screen.getByRole("tab", { name: "Extrato de Banco de Horas" }),
    );
    fireEvent.click(screen.getByRole("tab", { name: "Espelho de Ponto" }));
    fireEvent.click(screen.getByRole("tab", { name: "Justificativas" }));
    fireEvent.click(screen.getByRole("tab", { name: "Quadro de Horários" }));
    fireEvent.click(
      screen.getByRole("tab", { name: "Calendário de Feriados" }),
    );
    fireEvent.click(
      screen.getByRole("tab", { name: "Listagem de Colaboradores" }),
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
