import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PessoasHorarioScreen } from "./PessoasHorarioScreen";

describe("PessoasHorarioScreen (T046 — tela visual estática)", () => {
  it("tem um único h1 e explica que o RH atribui a tabela de horário", () => {
    render(<PessoasHorarioScreen />);

    expect(
      screen.getAllByRole("heading", {
        level: 1,
        name: "Horário de trabalho",
      }),
    ).toHaveLength(1);
    expect(
      screen.getByText(/O RH atribui uma tabela de horário ao colaborador/i),
    ).toBeInTheDocument();
  });

  it("exibe o aviso de que somente RH atua e que vigência futura não altera apuração passada", () => {
    render(<PessoasHorarioScreen />);

    expect(screen.getByText("Somente RH")).toBeInTheDocument();
    expect(
      screen.getByText(
        /nunca altera a apuração de dias já calculados com a versão de horário anterior/i,
      ),
    ).toBeInTheDocument();
  });

  it("lista colaborador, tabela de horário, vigência e situação", () => {
    render(<PessoasHorarioScreen />);

    const tabela = screen.getByRole("table", {
      name: "Colaboradores com tabela de horário atribuída",
    });
    const dentroDaTabela = within(tabela);

    expect(dentroDaTabela.getByText("Vínculo V-001")).toBeInTheDocument();
    expect(
      dentroDaTabela.getAllByText("Tabela Administrativo (exemplo)").length,
    ).toBeGreaterThan(0);
    expect(
      dentroDaTabela.getByText(/01\/01\/2026 – vigente/),
    ).toBeInTheDocument();
    expect(dentroDaTabela.getAllByText("Vigente").length).toBeGreaterThan(0);
    expect(dentroDaTabela.getByText("Encerrada")).toBeInTheDocument();
  });

  it("abre o formulário em branco ao clicar em 'Nova atribuição'", () => {
    render(<PessoasHorarioScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Nova atribuição" }));

    expect(
      screen.getByRole("heading", { name: "Nova atribuição de horário" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/colaborador \(vínculo\)/i)).toHaveValue("");
  });

  it("abre o formulário pré-preenchido ao 'Atribuir/alterar' uma linha existente", () => {
    render(<PessoasHorarioScreen />);

    const botoes = screen.getAllByRole("button", {
      name: /^Atribuir\/alterar/,
    });
    fireEvent.click(botoes[0]!);

    expect(
      screen.getByRole("heading", {
        name: "Alterar atribuição — Vínculo V-001",
      }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/colaborador \(vínculo\)/i)).toHaveValue(
      "Vínculo V-001",
    );
  });

  it("não vaza o valor de uma edição anterior ao abrir 'Nova atribuição' em seguida", () => {
    render(<PessoasHorarioScreen />);

    fireEvent.click(
      screen.getAllByRole("button", { name: /^Atribuir\/alterar/ })[0]!,
    );
    expect(screen.getByLabelText(/colaborador \(vínculo\)/i)).toHaveValue(
      "Vínculo V-001",
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    fireEvent.click(screen.getByRole("button", { name: "Nova atribuição" }));
    expect(
      screen.getByRole("heading", { name: "Nova atribuição de horário" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/colaborador \(vínculo\)/i)).toHaveValue("");
  });

  it("confirmar o formulário mostra aviso demonstrativo e não altera a listagem", () => {
    render(<PessoasHorarioScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Nova atribuição" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar (demonstração)" }),
    );

    expect(
      screen.getByText(
        /Ação apenas demonstrativa: nenhuma tabela de horário foi realmente atribuída/,
      ),
    ).toBeInTheDocument();

    // A listagem original permanece intacta (mesmas quatro linhas de sempre).
    const tabela = screen.getByRole("table", {
      name: "Colaboradores com tabela de horário atribuída",
    });
    expect(within(tabela).getAllByRole("row")).toHaveLength(5); // cabeçalho + 4
  });

  it("demonstra um campo com erro de validação por texto + semântica", () => {
    render(<PessoasHorarioScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Nova atribuição" }));

    const alerta = screen.getByRole("alert");
    expect(alerta).toHaveTextContent("Informe uma data no formato AAAA-MM-DD.");
    expect(
      screen.getByLabelText(/vigência — início \(exemplo de validação\)/i),
    ).toHaveAttribute("aria-invalid", "true");
  });

  it("alterna para o estado vazio e mostra o EmptyState com ação", () => {
    render(<PessoasHorarioScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Vazio" }));

    expect(
      screen.queryByRole("table", {
        name: "Colaboradores com tabela de horário atribuída",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 3,
        name: "Nenhuma atribuição de horário cadastrada",
      }),
    ).toBeInTheDocument();
  });

  it("alterna para o estado de erro com referência ilustrativa e ação de retorno", () => {
    render(<PessoasHorarioScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Erro" }));

    expect(
      screen.getByRole("heading", {
        name: "Não foi possível carregar as atribuições de horário",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/REQ-DEMO-000789/)).toBeInTheDocument();
    expect(screen.getByText(/ilustrativa/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(
      screen.getByRole("table", {
        name: "Colaboradores com tabela de horário atribuída",
      }),
    ).toBeInTheDocument();
  });

  it("não referencia CPF, nome real, cálculo, banco de horas, AFD ou dado real", () => {
    render(<PessoasHorarioScreen />);

    const texto = document.body.innerHTML.toLowerCase();
    for (const termoProibido of [
      "cpf",
      "secullum",
      "rwtech",
      "bioprox",
      "banco de horas",
      "afd",
      "fechamento",
      "espelho",
      "assinatura",
      "senha",
      "sessão",
      "mfa",
    ]) {
      expect(texto).not.toContain(termoProibido);
    }
  });
});
