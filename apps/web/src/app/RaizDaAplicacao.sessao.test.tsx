/**
 * T216 — link público colado na MESMA aba com o painel logado: a troca de
 * hash para `#/p/<token>` abre a página pública, e o shell nunca reescreve
 * essa rota (antes, ele corrigia a URL para Colaboradores primeiro).
 *
 * A sessão ativa é o shell montado: o portão de sessão é trocado pelo `App`
 * do papel RH, como fica depois do login.
 */
import { act, render, screen, waitFor } from "@testing-library/react";
import { configure } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { RaizDaAplicacao } from "./RaizDaAplicacao";

// T216 — a raiz carrega a página pública e o shell sob demanda (pacotes
// separados): a primeira importação do shell é lenta no ambiente de teste.
configure({ asyncUtilTimeout: 10_000 });
vi.setConfig({ testTimeout: 30_000 });

// O shell entra pelo import estático abaixo; o portão (carregado sob demanda
// pela raiz) só o monta, sem importar o `App` de dentro do próprio mock.
vi.mock("./AutenticacaoApp", () => ({
  AutenticacaoApp: () => <App papelDoAtor="rh" destinoInicial="pessoas" />,
}));

vi.mock("../api/contextoEmpresarialClient", async () => {
  const actual = await vi.importActual<
    typeof import("../api/contextoEmpresarialClient")
  >("../api/contextoEmpresarialClient");
  return {
    ...actual,
    listarEmpresasDoContexto: vi.fn(() => new Promise(() => undefined)),
    trocarEmpresaDoContexto: vi.fn(),
  };
});

const PESQUISA = {
  empresa: "Empresa Exemplo Ltda",
  nome: "Pulso do trimestre",
  boasVindas: null,
  identificacao: "anonima",
  totalPerguntas: 1,
  minutosEstimados: 1,
  secoes: [],
};

function instalarFetch() {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (entrada) => {
    const url = String(entrada);
    if (url.startsWith("/v1/publico/pesquisas/")) {
      return new Response(JSON.stringify(PESQUISA), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    // O shell segue carregando as telas dele; nada aqui importa ao teste.
    return new Response(JSON.stringify({}), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  });
}

afterEach(() => {
  window.history.replaceState(null, "", window.location.pathname);
  vi.restoreAllMocks();
});

describe("T216 — rota pública com o painel logado", () => {
  it("colar #/p/<token> na mesma aba abre a pesquisa e a URL fica como colada", async () => {
    instalarFetch();
    window.history.replaceState(null, "", "#/pessoas/colaboradores");
    render(<RaizDaAplicacao />);
    expect(
      await screen.findByRole("navigation", { name: /navega/i }),
    ).toBeInTheDocument();

    // Colar o link na barra: o navegador troca só o fragmento e avisa com
    // `popstate` e `hashchange`.
    await act(async () => {
      window.history.pushState(null, "", "#/p/tok-colado");
      window.dispatchEvent(new PopStateEvent("popstate", { state: null }));
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });

    expect(
      await screen.findByRole("heading", { name: "Pulso do trimestre" }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole("navigation", { name: /navega/i })).toBeNull(),
    );
    expect(window.location.hash).toBe("#/p/tok-colado");
  });
});
