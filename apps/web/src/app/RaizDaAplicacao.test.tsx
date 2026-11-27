import { act, render, screen } from "@testing-library/react";
import { configure } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RaizDaAplicacao } from "./RaizDaAplicacao";
import { tokenDaPesquisaPublica } from "./rotaPublica";

// T216 — a raiz carrega a página pública e o shell sob demanda (pacotes
// separados): a primeira importação do shell é lenta no ambiente de teste.
configure({ asyncUtilTimeout: 10_000 });
vi.setConfig({ testTimeout: 30_000 });

const PESQUISA = {
  empresa: "Empresa Exemplo Ltda",
  nome: "Pulso do trimestre",
  boasVindas: null,
  identificacao: "anonima",
  totalPerguntas: 1,
  minutosEstimados: 1,
  secoes: [],
};

/** Servidor falso: só a rota pública responde; o resto é "sem sessão". */
function instalarFetch() {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (entrada) => {
    const url = String(entrada);
    if (url.startsWith("/v1/publico/pesquisas/")) {
      return new Response(JSON.stringify(PESQUISA), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ mensagem: "sem sessão" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  });
}

function urls(espiao: ReturnType<typeof instalarFetch>): string[] {
  return espiao.mock.calls.map(([entrada]) => String(entrada));
}

beforeEach(() => {
  window.sessionStorage.clear();
  window.localStorage.clear();
});

afterEach(() => {
  window.location.hash = "";
  vi.restoreAllMocks();
});

describe("T216 — rota pública #/p/<token>", () => {
  it("reconhece só o formato da rota pública", () => {
    expect(tokenDaPesquisaPublica("#/p/abc123")).toBe("abc123");
    expect(tokenDaPesquisaPublica("#/p/abc123/")).toBe("abc123");
    expect(tokenDaPesquisaPublica("#/p/a%2Db")).toBe("a-b");
    expect(tokenDaPesquisaPublica("#/p/")).toBeNull();
    expect(tokenDaPesquisaPublica("#/p/a/b")).toBeNull();
    expect(tokenDaPesquisaPublica("#/p/%E0%A4%A")).toBeNull();
    expect(tokenDaPesquisaPublica("#/pessoas/colaboradores")).toBeNull();
    expect(tokenDaPesquisaPublica("")).toBeNull();
  });

  it("sem sessão, abre a pesquisa sem login e sem chamar API autenticada", async () => {
    const espiao = instalarFetch();
    window.location.hash = "#/p/tok-exemplo";
    render(<RaizDaAplicacao />);
    expect(
      await screen.findByRole("heading", { name: "Pulso do trimestre" }),
    ).toBeInTheDocument();
    expect(urls(espiao)).toEqual(["/v1/publico/pesquisas/tok-exemplo"]);
    expect(espiao.mock.calls[0]![1]).toMatchObject({ credentials: "omit" });
    expect(
      screen.queryByRole("button", { name: "Entrar" }),
    ).not.toBeInTheDocument();
  });

  it("fora da rota pública, o portão de sessão continua pedindo login", async () => {
    const espiao = instalarFetch();
    window.location.hash = "";
    render(<RaizDaAplicacao />);
    expect(
      await screen.findByRole("button", { name: "Entrar" }),
    ).toBeInTheDocument();
    expect(urls(espiao)).toContain("/v1/auth/csrf");
    expect(urls(espiao).some((u) => u.startsWith("/v1/publico"))).toBe(false);
  });

  it("trocar o hash para um link de pesquisa troca a árvore", async () => {
    const espiao = instalarFetch();
    window.location.hash = "";
    render(<RaizDaAplicacao />);
    await screen.findByRole("button", { name: "Entrar" });
    await act(async () => {
      window.location.hash = "#/p/outro";
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(
      await screen.findByRole("heading", { name: "Pulso do trimestre" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Entrar" }),
    ).not.toBeInTheDocument();
    expect(urls(espiao)).toContain("/v1/publico/pesquisas/outro");
  });
});
