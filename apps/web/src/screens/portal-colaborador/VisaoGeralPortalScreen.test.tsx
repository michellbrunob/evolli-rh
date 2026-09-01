import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VisaoGeralPortalScreen } from "./VisaoGeralPortalScreen";

describe("VisaoGeralPortalScreen (T067 — tela visual estática)", () => {
  it("tem um único h1 e o aviso de ambiente demonstrativo", () => {
    render(<VisaoGeralPortalScreen onNavegarAba={() => {}} />);

    expect(
      screen.getAllByRole("heading", { level: 1, name: "Visão geral" }),
    ).toHaveLength(1);
    expect(screen.getByText("Ambiente demonstrativo")).toBeInTheDocument();
    expect(
      screen.getByText(/não é um acesso real de colaborador/i),
    ).toBeInTheDocument();
  });

  it("mostra o resumo de solicitações e de Banco de Horas como exemplo", () => {
    render(<VisaoGeralPortalScreen onNavegarAba={() => {}} />);

    expect(screen.getByText("5 no total")).toBeInTheDocument();
    expect(screen.getByText("90 min")).toBeInTheDocument();
    expect(screen.getByText("25 min")).toBeInTheDocument();
    expect(screen.getByText("65 min")).toBeInTheDocument();
  });

  it("os atalhos chamam onNavegarAba com a aba correspondente", () => {
    const onNavegarAba = vi.fn();
    render(<VisaoGeralPortalScreen onNavegarAba={onNavegarAba} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Ver minhas solicitações" }),
    );
    expect(onNavegarAba).toHaveBeenCalledWith("solicitacoes");

    fireEvent.click(screen.getByRole("button", { name: "Ver minha jornada" }));
    expect(onNavegarAba).toHaveBeenCalledWith("jornada");

    fireEvent.click(screen.getByRole("button", { name: "Meus documentos" }));
    expect(onNavegarAba).toHaveBeenCalledWith("documentos");
  });
});
