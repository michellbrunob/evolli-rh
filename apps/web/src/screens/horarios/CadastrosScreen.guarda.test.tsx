/**
 * T200 — trocar a aba de Cadastros desmonta a aba anterior: com edição
 * pendente nela, a guarda do shell pergunta antes. As telas das abas são
 * substituídas por versões mínimas: o que está em teste é a troca de aba.
 */
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { CadastrosScreen } from "./CadastrosScreen";
import { ComGuardaDeSaida } from "../../test/ComGuardaDeSaida";

vi.mock("./EstruturaOrganizacionalScreen", async () => {
  const { useEdicaoEmAndamento } = await import("../../app/edicoesPendentes");
  function EstruturaComFormulario() {
    const [aberto, setAberto] = useState(false);
    useEdicaoEmAndamento("Estrutura organizacional", {
      pendente: aberto,
      salvando: false,
    });
    return (
      <section>
        <h1 id="estrutura-titulo">Estrutura organizacional</h1>
        <button type="button" onClick={() => setAberto(true)}>
          Novo departamento
        </button>
      </section>
    );
  }
  return {
    ESTRUTURA_ORGANIZACIONAL_TITULO_ID: "estrutura-titulo",
    EstruturaOrganizacionalScreen: EstruturaComFormulario,
  };
});

vi.mock("./FuncoesCargosScreen", () => ({
  FUNCOES_CARGOS_TITULO_ID: "cargos-titulo",
  FuncoesCargosScreen: () => <h1 id="cargos-titulo">Funções e cargos</h1>,
}));

vi.mock("./CentrosCustoScreen", () => ({
  CENTROS_CUSTO_TITULO_ID: "centros-titulo",
  CentrosCustoScreen: () => <h1 id="centros-titulo">Centros de custo</h1>,
}));

describe("T200 — troca de aba em Cadastros", () => {
  const abas = () => screen.getByRole("tablist");
  const pergunta = () =>
    screen.getByRole("alertdialog", { name: "Sair sem salvar?" });

  it("sem formulário aberto, troca direto", () => {
    render(<CadastrosScreen podeOperar />, { wrapper: ComGuardaDeSaida });
    fireEvent.click(
      within(abas()).getByRole("tab", { name: "Funções e cargos" }),
    );
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(
      screen.getByRole("heading", { name: "Funções e cargos" }),
    ).toBeInTheDocument();
  });

  it("com o formulário aberto: pergunta; continuar fica; sair sem salvar troca", () => {
    render(<CadastrosScreen podeOperar />, { wrapper: ComGuardaDeSaida });
    fireEvent.click(screen.getByRole("button", { name: "Novo departamento" }));
    const cargos = within(abas()).getByRole("tab", {
      name: "Funções e cargos",
    });
    cargos.focus();
    fireEvent.click(cargos);
    expect(
      within(pergunta())
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual(["Estrutura organizacional"]);
    fireEvent.click(
      within(pergunta()).getByRole("button", { name: "Continuar editando" }),
    );
    expect(
      within(abas()).getByRole("tab", { name: "Estrutura organizacional" }),
    ).toHaveAttribute("aria-selected", "true");
    expect(cargos).toHaveFocus();

    fireEvent.click(cargos);
    fireEvent.click(
      within(pergunta()).getByRole("button", { name: "Sair sem salvar" }),
    );
    expect(cargos).toHaveAttribute("aria-selected", "true");
    expect(
      screen.getByRole("heading", { name: "Funções e cargos" }),
    ).toBeInTheDocument();
  });

  it("a mesma aba não desmonta nada e não pergunta", () => {
    render(<CadastrosScreen podeOperar />, { wrapper: ComGuardaDeSaida });
    fireEvent.click(screen.getByRole("button", { name: "Novo departamento" }));
    fireEvent.click(
      within(abas()).getByRole("tab", { name: "Estrutura organizacional" }),
    );
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });
});
