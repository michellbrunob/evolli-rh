/**
 * T202 — `listarPontosDoVinculo`: o contrato já existente
 * `GET /v1/vinculos/:vinculoId/pontos`, só leitura, sem corpo e sem CSRF.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, listarPontosDoVinculo } from "./pontoClient";

const fetchMock = vi.fn();
const VINCULO = "33333333-3333-4333-8333-333333333333";

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function resposta(status: number, corpo: unknown) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("T202 — listarPontosDoVinculo", () => {
  it("chama a rota por vínculo com competência, página e tamanho; GET sem corpo nem CSRF", async () => {
    const pagina = { itens: [], pagina: 2, tamanhoPagina: 100, total: 130 };
    fetchMock.mockResolvedValue(resposta(200, pagina));
    await expect(
      listarPontosDoVinculo(VINCULO, {
        competencia: "2026-11",
        pagina: 2,
        tamanhoPagina: 100,
      }),
    ).resolves.toEqual(pagina);
    const [url, init] = fetchMock.mock.calls.at(-1)!;
    expect(url).toBe(
      `/v1/vinculos/${VINCULO}/pontos?competencia=2026-11&pagina=2&tamanhoPagina=100`,
    );
    expect(init.method).toBeUndefined();
    expect(init.body).toBeUndefined();
    expect(init.headers["x-csrf-token"]).toBeUndefined();
    expect(init.credentials).toBe("same-origin");
  });

  it("o id do vínculo vai codificado; sem filtros, sem query", async () => {
    fetchMock.mockResolvedValue(
      resposta(200, { itens: [], pagina: 1, tamanhoPagina: 20, total: 0 }),
    );
    await listarPontosDoVinculo("a/b");
    expect(fetchMock.mock.calls.at(-1)![0]).toBe("/v1/vinculos/a%2Fb/pontos");
  });

  it("fora do escopo (404) vira ApiError com o status", async () => {
    fetchMock.mockResolvedValue(resposta(404, { message: "Não encontrado." }));
    await expect(listarPontosDoVinculo(VINCULO)).rejects.toMatchObject({
      status: 404,
    });
    await expect(listarPontosDoVinculo(VINCULO)).rejects.toBeInstanceOf(
      ApiError,
    );
  });
});
