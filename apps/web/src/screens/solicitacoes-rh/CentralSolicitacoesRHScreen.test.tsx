import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CentralSolicitacoesRHScreen } from "./CentralSolicitacoesRHScreen";

describe("CentralSolicitacoesRHScreen (T068 — tela visual estática)", () => {
  it("tem um único h1 e o aviso de que RH revisa só a própria empresa e ações são demonstrativas", () => {
    render(<CentralSolicitacoesRHScreen />);

    expect(
      screen.getAllByRole("heading", { level: 1, name: "Central do RH" }),
    ).toHaveLength(1);
    expect(screen.getByText("Somente RH")).toBeInTheDocument();
    expect(
      screen.getByText(/O RH revisa apenas solicitações da própria empresa/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /encaminhar não altera automaticamente ponto, saldo, férias, cadastro, documento, Folha ou fechamento/i,
      ),
    ).toBeInTheDocument();
  });

  it("avisa que anexos, upload, download e armazenamento ainda não estão disponíveis", () => {
    render(<CentralSolicitacoesRHScreen />);

    expect(screen.getByText("Ainda não disponível")).toBeInTheDocument();
    expect(
      screen.getByText(
        /anexos, upload, download e armazenamento documental ainda não estão disponíveis/i,
      ),
    ).toBeInTheDocument();
  });

  it("lista as solicitações com referência, tipo, período, situação, prioridade e encaminhamento", () => {
    render(<CentralSolicitacoesRHScreen />);

    const tabela = screen.getByRole("table", {
      name: "Solicitações para revisão do RH",
    });
    const dentro = within(tabela);

    const linha = dentro.getByText("SOL-DEMO-0001").closest("tr")!;
    const dentroDaLinha = within(linha);
    expect(
      dentroDaLinha.getByText("Contestação de ajuste de ponto"),
    ).toBeInTheDocument();
    expect(dentroDaLinha.getByText("10/08/2026")).toBeInTheDocument();
    expect(dentroDaLinha.getByText("Em revisão RH")).toBeInTheDocument();
    expect(dentroDaLinha.getByText("Atenção")).toBeInTheDocument();
    expect(
      dentroDaLinha.getByRole("button", {
        name: /Encaminhar \(demonstração\)/,
      }),
    ).toBeInTheDocument();

    // Todos os cinco tipos do catálogo T065/T066 aparecem na amostra.
    for (const tipo of [
      "Contestação de ajuste de ponto",
      "Ausência",
      "Férias",
      "Atualização cadastral",
      "Documento",
    ]) {
      expect(dentro.getAllByText(tipo).length).toBeGreaterThan(0);
    }
  });

  it("todos os sete estados do contrato aparecem na amostra", () => {
    render(<CentralSolicitacoesRHScreen />);

    const tabela = screen.getByRole("table", {
      name: "Solicitações para revisão do RH",
    });
    const dentro = within(tabela);

    for (const estado of [
      "Rascunho",
      "Enviada",
      "Em revisão RH",
      "Aguardando informação",
      "Encaminhada ao RH",
      "Recusada",
      "Cancelada",
    ]) {
      expect(dentro.getByText(estado)).toBeInTheDocument();
    }
  });

  it("'Encaminhar (demonstração)' só muda o estado em memória, sem persistir nada", () => {
    render(<CentralSolicitacoesRHScreen />);

    const tabela = screen.getByRole("table", {
      name: "Solicitações para revisão do RH",
    });
    const linha = within(tabela).getByText("SOL-DEMO-0001").closest("tr")!;
    const botaoEncaminhar = within(linha).getByRole("button", {
      name: /Encaminhar \(demonstração\)/,
    });

    fireEvent.click(botaoEncaminhar);

    // A situação da linha vira "Encaminhada ao RH" e o botão de ação some.
    expect(
      within(linha).getAllByText("Encaminhada ao RH").length,
    ).toBeGreaterThan(0);
    expect(within(linha).getByText("Já encaminhada")).toBeInTheDocument();
    expect(
      within(linha).queryByRole("button", {
        name: /Encaminhar \(demonstração\)/,
      }),
    ).not.toBeInTheDocument();
  });

  it("o botão 'Encaminhar' só existe para solicitações em revisão RH (limite de escopo)", () => {
    render(<CentralSolicitacoesRHScreen />);

    // Já encaminhada, recusada e cancelada não oferecem o botão de encaminhar.
    const tabela = screen.getByRole("table", {
      name: "Solicitações para revisão do RH",
    });
    for (const id of ["SOL-DEMO-0003", "SOL-DEMO-0005", "SOL-DEMO-0007"]) {
      const linha = within(tabela).getByText(id).closest("tr")!;
      expect(
        within(linha).queryByRole("button", {
          name: /Encaminhar \(demonstração\)/,
        }),
      ).not.toBeInTheDocument();
    }

    const botoesEncaminhar = within(tabela).getAllByRole("button", {
      name: /Encaminhar \(demonstração\)/,
    });
    expect(botoesEncaminhar).toHaveLength(1);
  });

  it("abre e fecha o painel de detalhe demonstrativo", () => {
    render(<CentralSolicitacoesRHScreen />);

    const botoesDetalhe = screen.getAllByRole("button", {
      name: /Ver detalhe/,
    });
    fireEvent.click(botoesDetalhe[0]!);

    expect(screen.getByText(/Detalhe da solicitação —/)).toBeInTheDocument();
    expect(
      screen.getByText(
        /abrir este detalhe não altera, corrige, aprova, encaminha nem persiste/i,
      ),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(
      screen.queryByText(/Detalhe da solicitação —/),
    ).not.toBeInTheDocument();
  });

  it("filtra localmente por tipo, situação e prioridade", () => {
    render(<CentralSolicitacoesRHScreen />);

    const tabela = screen.getByRole("table", {
      name: "Solicitações para revisão do RH",
    });
    expect(within(tabela).getAllByRole("row").length).toBeGreaterThan(2);

    fireEvent.change(screen.getByLabelText("Situação"), {
      target: { value: "recusada" },
    });

    const linhas = within(tabela).getAllByRole("row");
    // 1 linha de cabeçalho + 1 linha de dado (SOL-DEMO-0005, a única recusada).
    expect(linhas).toHaveLength(2);
    expect(within(tabela).getByText("SOL-DEMO-0005")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(within(tabela).getAllByRole("row").length).toBeGreaterThan(2);
  });

  it("alterna o estado de demonstração para 'Vazio' e 'Erro'", () => {
    render(<CentralSolicitacoesRHScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Vazio" }));
    expect(
      screen.getByRole("heading", { name: "Nenhuma solicitação para revisar" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Erro" }));
    expect(
      screen.getByRole("heading", {
        name: "Não foi possível carregar as solicitações",
      }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(
      screen.getByRole("table", { name: "Solicitações para revisão do RH" }),
    ).toBeInTheDocument();
  });

  it("não referencia CPF, nome, empresa real, arquivo, anexo ou valor financeiro", () => {
    render(<CentralSolicitacoesRHScreen />);

    const texto = document.body.innerHTML.toLowerCase();
    for (const termoProibido of [
      "cpf",
      "reserva fiscal",
      "secullum",
      "rwtech",
      "bioprox",
      "login",
      "senha",
      "sessão",
      "mfa",
      "salário",
      "salario",
      "pagamento",
      "assinatura",
      ".pdf",
      "localstorage",
    ]) {
      expect(texto).not.toContain(termoProibido);
    }
  });
});
