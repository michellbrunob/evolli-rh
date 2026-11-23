import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PessoasScreen } from "./PessoasScreen";

/**
 * T187 — o atalho "Abrir no Histórico funcional" da ficha deixou de existir
 * na T215: a ficha segue o desenho da referência, sem a aba Vida funcional
 * (decisão de 2026-11-23). Fica a garantia de que a página de Colaboradores
 * não mostra a faixa de seções de Pessoas.
 */
vi.mock("./ColaboradoresScreen", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./ColaboradoresScreen")>()),
  ColaboradoresScreen: () => <p>Listagem (dublê)</p>,
}));

describe("T215 — Pessoas sem a faixa de seções na página de Colaboradores", () => {
  it("a página de Colaboradores não mostra a faixa de seções", () => {
    render(<PessoasScreen />);
    expect(screen.getByText("Listagem (dublê)")).toBeInTheDocument();
    expect(
      screen.queryByRole("tab", { name: "Histórico funcional" }),
    ).toBeNull();
  });
});
