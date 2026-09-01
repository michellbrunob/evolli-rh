import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PortalColaboradorScreen } from "./PortalColaboradorScreen";

describe("PortalColaboradorScreen — abas locais (T067)", () => {
  it("mostra o banner de demonstração e 'Visão geral' por padrão, com h1 único", () => {
    render(<PortalColaboradorScreen />);

    expect(
      screen.getByText("Portal do Colaborador — demonstração"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/prévia de interface do futuro Portal do Colaborador/i),
    ).toBeInTheDocument();

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", { level: 1, name: "Visão geral" }),
    ).toBeInTheDocument();
  });

  it("expõe as quatro abas com role='tab' e aria-selected correto por padrão", () => {
    render(<PortalColaboradorScreen />);

    const tablist = screen.getByRole("tablist", {
      name: "Seções do Portal do Colaborador",
    });
    expect(tablist).toBeInTheDocument();

    const nomes = [
      "Visão geral",
      "Minhas solicitações",
      "Minha jornada",
      "Meus documentos",
    ];
    for (const nome of nomes) {
      expect(screen.getByRole("tab", { name: nome })).toBeInTheDocument();
    }
    expect(screen.getByRole("tab", { name: "Visão geral" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      screen.getByRole("tab", { name: "Minhas solicitações" }),
    ).toHaveAttribute("aria-selected", "false");
  });

  it("troca para cada aba, só por estado local, mantendo h1 único", () => {
    render(<PortalColaboradorScreen />);

    fireEvent.click(screen.getByRole("tab", { name: "Minhas solicitações" }));
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", { level: 1, name: "Minhas solicitações" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Minha jornada" }));
    expect(
      screen.getByRole("heading", { level: 1, name: "Minha jornada" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Meus documentos" }));
    expect(
      screen.getByRole("heading", { level: 1, name: "Meus documentos" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Visão geral" }));
    expect(
      screen.getByRole("heading", { level: 1, name: "Visão geral" }),
    ).toBeInTheDocument();
  });

  it("os atalhos da Visão geral trocam a aba local", () => {
    render(<PortalColaboradorScreen />);

    fireEvent.click(
      screen.getByRole("button", { name: "Ver minhas solicitações" }),
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "Minhas solicitações" }),
    ).toBeInTheDocument();
  });

  it("informa o titleId do h1 visível via onTituloIdChange, inclusive ao trocar de aba", () => {
    const onTituloIdChange = vi.fn();
    render(<PortalColaboradorScreen onTituloIdChange={onTituloIdChange} />);

    expect(onTituloIdChange).toHaveBeenCalledWith("portal-visao-geral-titulo");

    fireEvent.click(screen.getByRole("tab", { name: "Minha jornada" }));
    expect(onTituloIdChange).toHaveBeenCalledWith("portal-jornada-titulo");

    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1.id).toBe("portal-jornada-titulo");
  });

  it("não referencia login, sessão, CPF, dinheiro ou dado real", () => {
    render(<PortalColaboradorScreen />);
    fireEvent.click(screen.getByRole("tab", { name: "Minhas solicitações" }));
    fireEvent.click(screen.getByRole("tab", { name: "Minha jornada" }));
    fireEvent.click(screen.getByRole("tab", { name: "Meus documentos" }));

    const texto = document.body.innerHTML.toLowerCase();
    for (const termoProibido of [
      "cpf",
      "reserva fiscal",
      "secullum",
      "rwtech",
      "bioprox",
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
