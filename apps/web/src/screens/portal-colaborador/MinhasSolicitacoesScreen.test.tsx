import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MinhasSolicitacoesScreen } from "./MinhasSolicitacoesScreen";

describe("MinhasSolicitacoesScreen (T067 — tela visual estática)", () => {
  it("tem um único h1 e explica que nada é enviado, alterado ou persistido", () => {
    render(<MinhasSolicitacoesScreen />);

    expect(
      screen.getAllByRole("heading", { level: 1, name: "Minhas solicitações" }),
    ).toHaveLength(1);
    expect(
      screen.getByText(
        /nenhum envio aqui cria, altera, encaminha, persiste ou integra/i,
      ),
    ).toBeInTheDocument();
  });

  it("lista as solicitações com tipo, período, situação e referência técnica", () => {
    render(<MinhasSolicitacoesScreen />);

    const tabela = screen.getByRole("table", { name: "Minhas solicitações" });
    const dentro = within(tabela);

    expect(
      dentro.getByText("Contestação de ajuste de ponto"),
    ).toBeInTheDocument();
    expect(dentro.getByText("10/08/2026")).toBeInTheDocument();
    expect(dentro.getByText("Encaminhada ao RH")).toBeInTheDocument();
    expect(dentro.getByText("SOL-DEMO-0001")).toBeInTheDocument();
  });

  it("abre e fecha o painel de detalhe demonstrativo", () => {
    render(<MinhasSolicitacoesScreen />);

    const linhas = screen.getAllByRole("button", { name: /Ver detalhe/ });
    fireEvent.click(linhas[0]!);

    expect(screen.getByText(/Detalhe da solicitação —/)).toBeInTheDocument();
    expect(
      screen.getByText(/abrir este detalhe não cria, altera, encaminha/i),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(
      screen.queryByText(/Detalhe da solicitação —/),
    ).not.toBeInTheDocument();
  });

  it("'Nova solicitação' abre um formulário demonstrativo que não persiste nada", () => {
    render(<MinhasSolicitacoesScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Nova solicitação" }));
    expect(
      screen.getByRole("heading", { name: "Nova solicitação (demonstração)" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/nada é enviado, criado ou salvo ao confirmar/i),
    ).toBeInTheDocument();

    const form = screen.getByRole("form", {
      name: "Formulário de nova solicitação",
    });
    fireEvent.submit(form);

    // O formulário fecha ao "confirmar" (só demonstrativo) — sem chamada real.
    expect(
      screen.queryByRole("heading", {
        name: "Nova solicitação (demonstração)",
      }),
    ).not.toBeInTheDocument();
  });

  it("alterna o estado de demonstração para 'Vazio' e 'Erro'", () => {
    render(<MinhasSolicitacoesScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Vazio" }));
    expect(
      screen.getByRole("heading", { name: "Nenhuma solicitação enviada" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Erro" }));
    expect(
      screen.getByRole("heading", {
        name: "Não foi possível carregar as solicitações",
      }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(
      screen.getByRole("table", { name: "Minhas solicitações" }),
    ).toBeInTheDocument();
  });
});
