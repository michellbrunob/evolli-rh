import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MinhaJornadaScreen } from "./MinhaJornadaScreen";

describe("MinhaJornadaScreen (T067 — tela visual estática)", () => {
  it("tem um único h1 e o aviso de que contestação não altera nada automaticamente", () => {
    render(<MinhaJornadaScreen />);

    expect(
      screen.getAllByRole("heading", { level: 1, name: "Minha jornada" }),
    ).toHaveLength(1);
    expect(
      screen.getByText(
        /não altera marcação, saldo ou fechamento automaticamente/i,
      ),
    ).toBeInTheDocument();
  });

  it("mostra o período, o resumo de jornada e crédito/débito separados", () => {
    render(<MinhaJornadaScreen />);

    expect(screen.getByText("26/06/2026 – 25/07/2026")).toBeInTheDocument();
    expect(screen.getByText("480 min")).toBeInTheDocument();
    expect(screen.getByText("545 min")).toBeInTheDocument();
    expect(screen.getByText("90 min")).toBeInTheDocument();
    expect(screen.getByText("25 min")).toBeInTheDocument();
    expect(screen.getByText("65 min")).toBeInTheDocument();
    expect(
      screen.getByText(/o crédito nunca compensa o débito automaticamente/i),
    ).toBeInTheDocument();
  });
});
