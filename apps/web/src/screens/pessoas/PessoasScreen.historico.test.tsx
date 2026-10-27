import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PessoasScreen } from "./PessoasScreen";

/**
 * T187 — o atalho "Abrir no Histórico funcional" da ficha: o contêiner troca
 * para a aba Histórico funcional e a entrega a seleção (colaborador e vínculo).
 *
 * As duas abas viram dublês que só expõem o que recebem — aqui o que se prova
 * é o contêiner; a ficha e o Histórico funcional têm testes próprios.
 */
vi.mock("./ColaboradoresScreen", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./ColaboradoresScreen")>()),
  ColaboradoresScreen: ({
    onAbrirHistoricoFuncional,
  }: {
    onAbrirHistoricoFuncional?: (alvo: {
      colaboradorId: string;
      vinculoId: string;
    }) => void;
  }) => (
    <button
      type="button"
      onClick={() =>
        onAbrirHistoricoFuncional?.({
          colaboradorId: "colaborador-da-ficha",
          vinculoId: "vinculo-principal",
        })
      }
    >
      Atalho da ficha (dublê)
    </button>
  ),
}));

vi.mock("./HistoricoFuncionalScreen", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./HistoricoFuncionalScreen")>()),
  HistoricoFuncionalScreen: ({
    selecaoInicial,
  }: {
    selecaoInicial?: { colaboradorId: string; vinculoId: string } | null;
  }) => (
    <p>
      Seleção recebida:{" "}
      {selecaoInicial
        ? `${selecaoInicial.colaboradorId} / ${selecaoInicial.vinculoId}`
        : "nenhuma"}
    </p>
  ),
}));

describe("T187 — atalho da ficha para o Histórico funcional", () => {
  it("troca para a aba, foca a aba e entrega colaborador e vínculo", () => {
    render(<PessoasScreen />);
    fireEvent.click(
      screen.getByRole("button", { name: "Atalho da ficha (dublê)" }),
    );

    const aba = screen.getByRole("tab", { name: "Histórico funcional" });
    expect(aba).toHaveAttribute("aria-selected", "true");
    expect(aba).toHaveFocus();
    expect(
      screen.getByText(
        "Seleção recebida: colaborador-da-ficha / vinculo-principal",
      ),
    ).toBeInTheDocument();
  });

  it("entrar pela barra de abas não reaproveita a seleção antiga", () => {
    render(<PessoasScreen />);
    fireEvent.click(
      screen.getByRole("button", { name: "Atalho da ficha (dublê)" }),
    );
    fireEvent.click(screen.getByRole("tab", { name: "Colaboradores" }));
    fireEvent.click(screen.getByRole("tab", { name: "Histórico funcional" }));
    expect(screen.getByText("Seleção recebida: nenhuma")).toBeInTheDocument();
  });

  it("sem atalho, a aba abre como sempre abriu", () => {
    render(<PessoasScreen />);
    fireEvent.click(screen.getByRole("tab", { name: "Histórico funcional" }));
    expect(screen.getByText("Seleção recebida: nenhuma")).toBeInTheDocument();
  });
});
