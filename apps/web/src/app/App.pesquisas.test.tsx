/**
 * T216 — o módulo Pesquisas no shell: cada tela tem endereço próprio
 * (`#/pesquisas…`). A rota da URL chega ao módulo; navegar dentro dele
 * empilha (ou troca no lugar) a URL; voltar do navegador devolve a tela; o
 * menu abre na lista; e o acesso global (sem empresa ativa) pede a escolha.
 * O módulo é trocado por um substituto que só mostra a rota recebida.
 */
import { act, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderComMenuAberto as render } from "../test/menuLateral";
import { ComGuardaDeSaida } from "../test/ComGuardaDeSaida";
import { App } from "./App";
import { destinoDaRota } from "./rotasDoShell";

vi.mock("../screens/pesquisas/PesquisasModulo", () => ({
  PESQUISAS_TITULO_ID: "pesquisas-titulo",
  PesquisasModulo: (props: {
    rota: unknown;
    semEmpresa?: boolean;
    onNavegar: (r: unknown, o?: { substituir?: boolean }) => void;
  }) => (
    <div>
      <h1 id="pesquisas-titulo" tabIndex={-1}>
        Pesquisas
      </h1>
      <output aria-label="Rota recebida">{JSON.stringify(props.rota)}</output>
      <output aria-label="Sem empresa">{String(props.semEmpresa)}</output>
      <button
        type="button"
        onClick={() =>
          props.onNavegar({ tela: "resultados", id: "p-1", aba: "geral" })
        }
      >
        Abrir resultados
      </button>
      <button
        type="button"
        onClick={() =>
          props.onNavegar({ tela: "rascunho", id: "p-2" }, { substituir: true })
        }
      >
        Trocar no lugar
      </button>
    </div>
  ),
}));

vi.mock("../api/contextoEmpresarialClient", async () => {
  const actual = await vi.importActual<
    typeof import("../api/contextoEmpresarialClient")
  >("../api/contextoEmpresarialClient");
  return {
    ...actual,
    listarEmpresasDoContexto: vi.fn().mockResolvedValue([]),
    trocarEmpresaDoContexto: vi.fn(),
  };
});

const EMPRESA = { nome: "Empresa Alfa", codigo: "ALFA" };

beforeEach(() => {
  window.history.replaceState(null, "", "/");
});
afterEach(() => {
  window.history.replaceState(null, "", "/");
});

function montar(rota: string, empresa: typeof EMPRESA | null = EMPRESA) {
  window.history.replaceState(null, "", `/${rota}`);
  return render(
    <ComGuardaDeSaida>
      <App papelDoAtor="rh" empresaAtiva={empresa} />
    </ComGuardaDeSaida>,
  );
}

const rotaRecebida = () =>
  JSON.parse(screen.getByLabelText("Rota recebida").textContent ?? "null");

describe("T216 — rotas de Pesquisas no shell", () => {
  it("toda tela do módulo é do destino Pesquisas", () => {
    for (const fragmento of [
      "#/pesquisas",
      "#/pesquisas/nova/pulso",
      "#/pesquisas/p-1?aba=respostas",
      "#/pesquisas/p-1/respostas/r-1",
      "#/pesquisas/p-1/previa",
    ])
      expect(destinoDaRota(fragmento)).toBe("pesquisas");
  });

  it("recarregar numa tela interna abre a mesma tela", () => {
    montar("#/pesquisas/p-1?aba=analises");
    expect(rotaRecebida()).toEqual({
      tela: "resultados",
      id: "p-1",
      aba: "analises",
    });
    expect(window.location.hash).toBe("#/pesquisas/p-1?aba=analises");
  });

  it("navegar empilha; voltar do navegador devolve a tela anterior", () => {
    montar("#/pesquisas");
    expect(rotaRecebida()).toEqual({ tela: "lista" });
    const antes = window.history.length;
    fireEvent.click(screen.getByRole("button", { name: "Abrir resultados" }));
    expect(window.location.hash).toBe("#/pesquisas/p-1");
    expect(window.history.length).toBe(antes + 1);
    act(() => {
      window.history.replaceState(null, "", "/#/pesquisas");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(rotaRecebida()).toEqual({ tela: "lista" });
  });

  it("troca no lugar não cria entrada no histórico", () => {
    montar("#/pesquisas/nova/pulso");
    const antes = window.history.length;
    fireEvent.click(screen.getByRole("button", { name: "Trocar no lugar" }));
    expect(window.location.hash).toBe("#/pesquisas/p-2/rascunho");
    expect(window.history.length).toBe(antes);
  });

  it("sem empresa ativa, o módulo recebe semEmpresa", () => {
    montar("#/pesquisas", null);
    expect(screen.getByLabelText("Sem empresa")).toHaveTextContent("true");
  });
});
