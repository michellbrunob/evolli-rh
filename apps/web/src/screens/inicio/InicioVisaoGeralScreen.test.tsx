import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { InicioVisaoGeralScreen } from "./InicioVisaoGeralScreen";

describe("InicioVisaoGeralScreen (T048 — tela visual estática)", () => {
  it("tem um único h1", () => {
    render(<InicioVisaoGeralScreen onNavegar={() => {}} />);

    expect(
      screen.getAllByRole("heading", { level: 1, name: "Visão geral" }),
    ).toHaveLength(1);
  });

  it("indica que a versão é demonstrativa e não usa dados operacionais", () => {
    render(<InicioVisaoGeralScreen onNavegar={() => {}} />);

    expect(screen.getByText("Versão demonstrativa")).toBeInTheDocument();
    expect(
      screen.getByText(/ainda não usa dados operacionais/i),
    ).toBeInTheDocument();
  });

  it("destaca as pendências de ponto a conferir", () => {
    render(<InicioVisaoGeralScreen onNavegar={() => {}} />);

    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Pendências de ponto a conferir",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("5 pendências (exemplo)")).toBeInTheDocument();
  });

  it("lista um card de resumo por módulo com métrica rotulada como exemplo", () => {
    render(<InicioVisaoGeralScreen onNavegar={() => {}} />);

    for (const titulo of ["Cadastros", "Pessoas", "Ponto", "Documentos"]) {
      expect(
        screen.getByRole("heading", { level: 3, name: titulo }),
      ).toBeInTheDocument();
    }
    expect(screen.getAllByText("Exemplo").length).toBe(4);
    expect(
      screen.getByText("3 tabelas de horário cadastradas (exemplo)"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("12 colaboradores com horário atribuído (exemplo)"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("4 registros de documentos e solicitações (exemplo)"),
    ).toBeInTheDocument();
  });

  it("cada atalho chama onNavegar com o destino correspondente", () => {
    const onNavegar = vi.fn();
    render(<InicioVisaoGeralScreen onNavegar={onNavegar} />);

    fireEvent.click(screen.getByRole("button", { name: "Ir para Cadastros" }));
    expect(onNavegar).toHaveBeenCalledWith("cadastros");

    fireEvent.click(screen.getByRole("button", { name: "Ir para Pessoas" }));
    expect(onNavegar).toHaveBeenCalledWith("pessoas");

    fireEvent.click(screen.getByRole("button", { name: "Ir para Documentos" }));
    expect(onNavegar).toHaveBeenCalledWith("documentos");

    // O destaque e o card de Ponto oferecem, cada um, um atalho para "ponto".
    const botoesPonto = screen.getAllByRole("button", {
      name: "Ir para Ponto",
    });
    expect(botoesPonto).toHaveLength(2);
    fireEvent.click(botoesPonto[0]!);
    expect(onNavegar).toHaveBeenCalledWith("ponto");
    expect(onNavegar).toHaveBeenCalledTimes(4);
  });

  it("os atalhos são botões nativos operáveis por teclado, sem link ou rota real", () => {
    render(<InicioVisaoGeralScreen onNavegar={() => {}} />);

    const botoes = screen.getAllByRole("button");
    expect(botoes.length).toBeGreaterThan(0);
    for (const botao of botoes) {
      expect(botao.tagName).toBe("BUTTON");
      expect(botao).toHaveAttribute("type", "button");
    }
    expect(document.querySelectorAll("a")).toHaveLength(0);
  });

  it("não referencia API, fetch, autenticação, sessão, CPF ou dado real", () => {
    render(<InicioVisaoGeralScreen onNavegar={() => {}} />);

    const texto = document.body.innerHTML.toLowerCase();
    for (const termoProibido of [
      "fetch(",
      "cpf",
      "secullum",
      "rwtech",
      "bioprox",
      "reserva fiscal",
      "senha",
      "sessão",
      "mfa",
      "http://",
      "https://",
    ]) {
      expect(texto).not.toContain(termoProibido);
    }
  });
});
