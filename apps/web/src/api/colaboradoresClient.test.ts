/**
 * T178 — `listarColaboradores`: a query que sai do navegador.
 *
 * A busca é do servidor; o cliente só a normaliza (apara, corta no teto, omite
 * se vazia). A empresa nunca entra na query — é a da sessão.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BUSCA_COLABORADORES_MAXIMO,
  listarColaboradores,
} from "./colaboradoresClient";

const VAZIA = {
  itens: [],
  pagina: 1,
  tamanhoPagina: 20,
  total: 0,
  contadores: { ativos: 0, inativos: 0 },
};

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => VAZIA,
  } as unknown as Response);
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

function queryEnviada(): URLSearchParams {
  const [url] = fetchMock.mock.calls.at(-1)!;
  return new URL(String(url), "http://localhost").searchParams;
}

describe("T178 — listarColaboradores", () => {
  it("envia busca aparada junto com filtros e paginação, sem empresa", async () => {
    await listarColaboradores({
      situacao: "ativo",
      situacaoVinculo: "previsto",
      busca: "  Ana  ",
      pagina: 2,
      tamanhoPagina: 20,
    });
    const [url, init] = fetchMock.mock.calls.at(-1)!;
    expect(String(url).startsWith("/v1/colaboradores?")).toBe(true);
    expect((init as RequestInit).method ?? "GET").toBe("GET");
    const q = queryEnviada();
    expect(q.get("busca")).toBe("Ana");
    expect(q.get("situacao")).toBe("ativo");
    expect(q.get("situacaoVinculo")).toBe("previsto");
    expect(q.get("pagina")).toBe("2");
    expect(q.has("empresaId")).toBe(false);
  });

  it.each([
    ["vazia", ""],
    ["só espaços", "   "],
    ["ausente", undefined],
  ])("busca %s não vai na query", async (_nome, busca) => {
    await listarColaboradores(
      busca === undefined ? { pagina: 1 } : { busca, pagina: 1 },
    );
    expect(queryEnviada().has("busca")).toBe(false);
  });

  it("busca acima do teto é cortada em 160 caracteres", async () => {
    await listarColaboradores({ busca: "b".repeat(300) });
    expect(queryEnviada().get("busca")).toBe(
      "b".repeat(BUSCA_COLABORADORES_MAXIMO),
    );
    expect(BUSCA_COLABORADORES_MAXIMO).toBe(160);
  });

  it("devolve o envelope com `contadores` como veio do servidor", async () => {
    await expect(listarColaboradores()).resolves.toEqual(VAZIA);
  });
});
