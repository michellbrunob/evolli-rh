import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RelatoriosDisponiveisScreen } from "./RelatoriosDisponiveisScreen";

describe("RelatoriosDisponiveisScreen (T075 — tela visual estática)", () => {
  it("tem um único h1", () => {
    render(<RelatoriosDisponiveisScreen />);

    expect(
      screen.getAllByRole("heading", {
        level: 1,
        name: "Relatórios disponíveis",
      }),
    ).toHaveLength(1);
  });

  it("exibe o aviso de que PDF, assinatura, arquivo fiscal e exportação ainda não estão disponíveis", () => {
    render(<RelatoriosDisponiveisScreen />);

    expect(screen.getAllByText("Ainda não disponível").length).toBeGreaterThan(
      0,
    );
    expect(
      screen.getByText(
        /PDF, assinatura, arquivo fiscal e exportação ainda não estão disponíveis/i,
      ),
    ).toBeInTheDocument();
  });

  it("lista os relatórios futuros como apenas nome/descrição, sem ação real", () => {
    render(<RelatoriosDisponiveisScreen />);

    const tabela = screen.getByRole("table", {
      name: "Relatórios futuros do módulo de Ponto",
    });
    const dentro = within(tabela);

    for (const nome of [
      "Espelho do período",
      "Extrato de Banco de Horas",
      "Justificativas e ajustes",
      "Calendário de feriados",
      "Horários e escalas",
      "Exportação para Folha",
    ]) {
      expect(dentro.getByText(nome)).toBeInTheDocument();
    }

    expect(dentro.getAllByText("Ainda não disponível")).toHaveLength(6);
    expect(dentro.queryAllByRole("button")).toHaveLength(0);
    expect(document.querySelectorAll('input[type="file"]')).toHaveLength(0);
    expect(document.querySelectorAll("a")).toHaveLength(0);
  });

  it("não contém CPF, nome real, empresa real, e-mail, IP ou valor financeiro", () => {
    render(<RelatoriosDisponiveisScreen />);

    const texto = document.body.innerHTML.toLowerCase();
    for (const termoProibido of [
      "cpf",
      "secullum",
      "rwtech",
      "bioprox",
      "reserva fiscal",
      "senha",
      "sessão",
      "r$",
      "localstorage",
      "@",
      "http://",
      "https://",
    ]) {
      expect(texto).not.toContain(termoProibido);
    }
  });
});
