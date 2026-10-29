import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { PessoasScreen } from "./PessoasScreen";
import type { RotaDaFicha } from "../../app/rotasDoShell";

/**
 * T187 — o atalho "Abrir no Histórico funcional" da ficha: o contêiner troca
 * para a aba Histórico funcional e a entrega a seleção (colaborador e vínculo).
 * T198 — a ficha é página própria: o atalho também a fecha.
 *
 * A ficha, a listagem e o Histórico funcional viram dublês que só expõem o que
 * recebem — aqui o que se prova é o contêiner; cada tela tem testes próprios.
 */
vi.mock("./FichaColaboradorScreen", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./FichaColaboradorScreen")>()),
  FichaColaboradorScreen: ({
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

vi.mock("./ColaboradoresScreen", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./ColaboradoresScreen")>()),
  ColaboradoresScreen: () => <p>Listagem (dublê)</p>,
}));

/** O shell guarda a rota da ficha; aqui, um estado local, já com ela aberta. */
function ComFichaAberta() {
  const [ficha, setFicha] = useState<RotaDaFicha | null>({
    colaboradorId: "colaborador-da-ficha",
    aba: "vida-funcional",
  });
  return (
    <PessoasScreen
      ficha={ficha}
      onAbrirFicha={(colaboradorId) =>
        setFicha({ colaboradorId, aba: "dados" })
      }
      onTrocarAbaDaFicha={(aba) =>
        setFicha((atual) => (atual ? { ...atual, aba } : atual))
      }
      onFecharFicha={() => setFicha(null)}
    />
  );
}

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
  it("fecha a ficha, troca para a aba, foca a aba e entrega colaborador e vínculo", () => {
    render(<ComFichaAberta />);
    fireEvent.click(
      screen.getByRole("button", { name: "Atalho da ficha (dublê)" }),
    );

    expect(
      screen.queryByRole("button", { name: "Atalho da ficha (dublê)" }),
    ).toBeNull();
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
    render(<ComFichaAberta />);
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
