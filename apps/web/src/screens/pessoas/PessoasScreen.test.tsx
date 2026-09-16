import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PessoasScreen } from "./PessoasScreen";

describe("PessoasScreen — abas locais 'Colaboradores' / 'Horário de trabalho' / 'Histórico funcional' / 'Dados contratuais' / 'Documentos' / 'Solicitações' / 'Benefícios' / 'Dependentes' / 'Afastamentos' (T072/T088/T089/T090/T091/T092/T093/T094)", () => {
  it("mostra 'Colaboradores' por padrão, com h1 único", () => {
    render(<PessoasScreen />);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", { level: 1, name: "Colaboradores" }),
    ).toBeInTheDocument();
  });

  it("expõe as nove abas com role='tab' e aria-selected correto por padrão", () => {
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
    const abaDadosContratuais = screen.getByRole("tab", {
      name: "Dados contratuais",
    });
    const abaDocumentos = screen.getByRole("tab", {
      name: "Documentos",
    });
    const abaSolicitacoes = screen.getByRole("tab", {
      name: "Solicitações",
    });
    const abaBeneficios = screen.getByRole("tab", {
      name: "Benefícios",
    });
    const abaDependentes = screen.getByRole("tab", {
      name: "Dependentes",
    });
    const abaAfastamentos = screen.getByRole("tab", {
      name: "Afastamentos",
    });
    expect(abaColaboradores).toHaveAttribute("aria-selected", "true");
    expect(abaHorario).toHaveAttribute("aria-selected", "false");
    expect(abaHistoricoFuncional).toHaveAttribute("aria-selected", "false");
    expect(abaDadosContratuais).toHaveAttribute("aria-selected", "false");
    expect(abaDocumentos).toHaveAttribute("aria-selected", "false");
    expect(abaSolicitacoes).toHaveAttribute("aria-selected", "false");
    expect(abaBeneficios).toHaveAttribute("aria-selected", "false");
    expect(abaDependentes).toHaveAttribute("aria-selected", "false");
    expect(abaAfastamentos).toHaveAttribute("aria-selected", "false");
    expect(abaColaboradores.tagName).toBe("BUTTON");
    expect(abaHorario.tagName).toBe("BUTTON");
    expect(abaHistoricoFuncional.tagName).toBe("BUTTON");
    expect(abaDadosContratuais.tagName).toBe("BUTTON");
    expect(abaDocumentos.tagName).toBe("BUTTON");
    expect(abaSolicitacoes.tagName).toBe("BUTTON");
    expect(abaBeneficios.tagName).toBe("BUTTON");
    expect(abaDependentes.tagName).toBe("BUTTON");
    expect(abaAfastamentos.tagName).toBe("BUTTON");
  });

  it("troca para 'Horário de trabalho' ao clicar na aba — preservado sem regressão (T112)", () => {
    const onTituloIdChange = vi.fn();
    render(<PessoasScreen onTituloIdChange={onTituloIdChange} />);

    fireEvent.click(screen.getByRole("tab", { name: "Horário de trabalho" }));

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", { level: 1, name: "Horário de trabalho" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Somente RH")).toBeInTheDocument();

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

  it("troca para 'Dados contratuais' ao clicar na aba, com h1 único e informa o titleId", () => {
    const onTituloIdChange = vi.fn();
    render(<PessoasScreen onTituloIdChange={onTituloIdChange} />);

    fireEvent.click(screen.getByRole("tab", { name: "Dados contratuais" }));

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", { level: 1, name: "Dados contratuais" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("table", { name: "Dados contratuais (exemplo)" }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("tab", { name: "Dados contratuais" }),
    ).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Colaboradores" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
    expect(onTituloIdChange).toHaveBeenCalledWith("dados-contratuais-titulo");
  });

  it("troca para 'Documentos' ao clicar na aba, com h1 único e informa o titleId", () => {
    const onTituloIdChange = vi.fn();
    render(<PessoasScreen onTituloIdChange={onTituloIdChange} />);

    fireEvent.click(screen.getByRole("tab", { name: "Documentos" }));

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", { level: 1, name: "Documentos" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("table", { name: "Documentos (exemplo)" }),
    ).toBeInTheDocument();

    expect(screen.getByRole("tab", { name: "Documentos" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "Colaboradores" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
    expect(onTituloIdChange).toHaveBeenCalledWith("pessoas-documentos-titulo");
  });

  it("troca para 'Solicitações' ao clicar na aba, com h1 único e informa o titleId", () => {
    const onTituloIdChange = vi.fn();
    render(<PessoasScreen onTituloIdChange={onTituloIdChange} />);

    fireEvent.click(screen.getByRole("tab", { name: "Solicitações" }));

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", { level: 1, name: "Solicitações" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("table", { name: "Solicitações (exemplo)" }),
    ).toBeInTheDocument();

    expect(screen.getByRole("tab", { name: "Solicitações" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "Colaboradores" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
    expect(onTituloIdChange).toHaveBeenCalledWith("solicitacoes-titulo");
  });

  it("troca para 'Benefícios' ao clicar na aba, com h1 único e informa o titleId", () => {
    const onTituloIdChange = vi.fn();
    render(<PessoasScreen onTituloIdChange={onTituloIdChange} />);

    fireEvent.click(screen.getByRole("tab", { name: "Benefícios" }));

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", { level: 1, name: "Benefícios" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("table", { name: "Benefícios (exemplo)" }),
    ).toBeInTheDocument();

    expect(screen.getByRole("tab", { name: "Benefícios" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "Colaboradores" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
    expect(onTituloIdChange).toHaveBeenCalledWith("beneficios-titulo");
  });

  it("troca para 'Dependentes' ao clicar na aba, com h1 único e informa o titleId", () => {
    const onTituloIdChange = vi.fn();
    render(<PessoasScreen onTituloIdChange={onTituloIdChange} />);

    fireEvent.click(screen.getByRole("tab", { name: "Dependentes" }));

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", { level: 1, name: "Dependentes" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("table", { name: "Dependentes (exemplo)" }),
    ).toBeInTheDocument();

    expect(screen.getByRole("tab", { name: "Dependentes" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "Colaboradores" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
    expect(onTituloIdChange).toHaveBeenCalledWith("dependentes-titulo");
  });

  it("troca para 'Afastamentos' ao clicar na aba, com h1 único e informa o titleId", () => {
    const onTituloIdChange = vi.fn();
    render(<PessoasScreen onTituloIdChange={onTituloIdChange} />);

    fireEvent.click(screen.getByRole("tab", { name: "Afastamentos" }));

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", { level: 1, name: "Afastamentos" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("table", { name: "Afastamentos (exemplo)" }),
    ).toBeInTheDocument();

    expect(screen.getByRole("tab", { name: "Afastamentos" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "Colaboradores" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
    expect(onTituloIdChange).toHaveBeenCalledWith("afastamentos-titulo");
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
    expect(screen.getByText("Somente RH")).toBeInTheDocument();

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
    fireEvent.click(screen.getByRole("tab", { name: "Dados contratuais" }));
    fireEvent.click(screen.getByRole("tab", { name: "Documentos" }));
    fireEvent.click(screen.getByRole("tab", { name: "Solicitações" }));
    fireEvent.click(screen.getByRole("tab", { name: "Benefícios" }));
    fireEvent.click(screen.getByRole("tab", { name: "Dependentes" }));
    fireEvent.click(screen.getByRole("tab", { name: "Afastamentos" }));
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
