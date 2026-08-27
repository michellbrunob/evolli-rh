import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CadastroHorariosScreen } from "./CadastroHorariosScreen";

describe("CadastroHorariosScreen (T043 — tela visual estática)", () => {
  it("tem um único título de nível 1 e a listagem por padrão", () => {
    render(<CadastroHorariosScreen />);

    expect(
      screen.getAllByRole("heading", { level: 1, name: "Horários" }),
    ).toHaveLength(1);
    expect(
      screen.getByRole("table", { name: "Tabelas de horário cadastradas" }),
    ).toBeInTheDocument();
  });

  it("exibe o aviso de que somente RH opera o cadastro", () => {
    render(<CadastroHorariosScreen />);

    expect(screen.getByText("Somente RH")).toBeInTheDocument();
    expect(
      screen.getByText(/operado exclusivamente pelo RH da própria empresa/i),
    ).toBeInTheDocument();
  });

  it("lista as tabelas sintéticas com nome, situação, dias, faixas e vigência", () => {
    render(<CadastroHorariosScreen />);

    const tabela = screen.getByRole("table", {
      name: "Tabelas de horário cadastradas",
    });
    const linha = within(tabela)
      .getByRole("cell", {
        name: "Tabela Administrativo (exemplo)",
      })
      .closest("tr")!;
    const dentroDaLinha = within(linha);

    expect(dentroDaLinha.getByText("Ativa")).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText(/Seg, Ter, Qua, Qui, Sex/),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText(/09:00–12:00 \/ 13:00–18:00/),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText(/01\/01\/2026 – vigente/),
    ).toBeInTheDocument();
  });

  it("alterna para o estado vazio e mostra o EmptyState com ação", () => {
    render(<CadastroHorariosScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Vazio" }));

    expect(
      screen.queryByRole("table", { name: "Tabelas de horário cadastradas" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 3,
        name: "Nenhuma tabela de horário cadastrada",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Cadastrar tabela de horário" }),
    ).toBeInTheDocument();
  });

  it("alterna para o estado de erro com referência ilustrativa e ação de retorno", () => {
    render(<CadastroHorariosScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Erro" }));

    expect(
      screen.getByRole("heading", {
        name: "Não foi possível carregar as tabelas de horário",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/REQ-DEMO-000123/)).toBeInTheDocument();
    expect(screen.getByText(/ilustrativa/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(
      screen.getByRole("table", { name: "Tabelas de horário cadastradas" }),
    ).toBeInTheDocument();
  });

  it("marca o botão do estado ativo com aria-pressed", () => {
    render(<CadastroHorariosScreen />);

    expect(screen.getByRole("button", { name: "Com dados" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Vazio" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("abre o formulário em branco ao clicar em 'Nova tabela de horário'", () => {
    render(<CadastroHorariosScreen />);

    fireEvent.click(
      screen.getByRole("button", { name: "Nova tabela de horário" }),
    );

    expect(
      screen.getByRole("heading", { name: "Nova tabela de horário" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/nome da tabela/i)).toHaveValue("");
  });

  it("abre o formulário pré-preenchido ao editar uma linha existente", () => {
    render(<CadastroHorariosScreen />);

    const linhasEditar = screen.getAllByRole("button", { name: /^Editar/ });
    fireEvent.click(linhasEditar[0]!);

    expect(
      screen.getByRole("heading", {
        name: /Editar tabela — Tabela Administrativo \(exemplo\)/,
      }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/nome da tabela/i)).toHaveValue(
      "Tabela Administrativo (exemplo)",
    );
  });

  it("não vaza o valor de uma edição anterior ao abrir 'Nova tabela de horário' em seguida", () => {
    render(<CadastroHorariosScreen />);

    // Edita uma linha existente (formulário fica preenchido)...
    fireEvent.click(screen.getAllByRole("button", { name: /^Editar/ })[0]!);
    expect(screen.getByLabelText(/nome da tabela/i)).toHaveValue(
      "Tabela Administrativo (exemplo)",
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    // ...e abre "Nova tabela de horário": o campo deve nascer vazio, nunca
    // reaproveitar o valor do formulário de edição anterior.
    fireEvent.click(
      screen.getByRole("button", { name: "Nova tabela de horário" }),
    );
    expect(
      screen.getByRole("heading", { name: "Nova tabela de horário" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/nome da tabela/i)).toHaveValue("");
  });

  it("fecha o formulário sem alterar a listagem ao cancelar", () => {
    render(<CadastroHorariosScreen />);

    fireEvent.click(
      screen.getByRole("button", { name: "Nova tabela de horário" }),
    );
    expect(
      screen.getByRole("heading", { name: "Nova tabela de horário" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(
      screen.queryByRole("heading", { name: "Nova tabela de horário" }),
    ).not.toBeInTheDocument();
  });

  it("demonstra um campo com erro de validação por texto + semântica", () => {
    render(<CadastroHorariosScreen />);

    fireEvent.click(
      screen.getByRole("button", { name: "Nova tabela de horário" }),
    );

    const alerta = screen.getByRole("alert");
    expect(alerta).toHaveTextContent(
      "Informe um horário válido no formato HH:MM.",
    );
    expect(
      screen.getByLabelText(/faixa de horário \(exemplo/i),
    ).toHaveAttribute("aria-invalid", "true");
  });

  it("não faz chamada de rede, não usa fetch e não referencia dado real", () => {
    render(<CadastroHorariosScreen />);

    const texto = document.body.innerHTML.toLowerCase();
    for (const termoProibido of [
      "cpf",
      "secullum",
      "bioprox",
      "rwtech",
      "senha",
      "sessão",
      "mfa",
    ]) {
      expect(texto).not.toContain(termoProibido);
    }
  });
});
