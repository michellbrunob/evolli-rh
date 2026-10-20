/**
 * T178 — `consultarCep`: o que sai do navegador é só o CEP, no caminho.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, consultarCep } from "./cepClient";

const RESPOSTA = {
  cep: "30140071",
  logradouro: "Avenida Sintética",
  bairro: "Bairro Sintético",
  cidade: "Cidade Sintética",
  uf: "MG",
  estado: "Minas Gerais",
};

const fetchMock = vi.fn();

function resposta(status: number, body: unknown = {}): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("T178 — consultarCep", () => {
  it("GET /v1/cep/30140071, same-origin, no-store, sem corpo", async () => {
    fetchMock.mockResolvedValueOnce(resposta(200, RESPOSTA));
    await expect(consultarCep("30140071")).resolves.toEqual(RESPOSTA);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe("/v1/cep/30140071");
    expect(init.method).toBe("GET");
    expect(init.credentials).toBe("same-origin");
    expect(init.cache).toBe("no-store");
    expect(init.body).toBeUndefined();
    // Nenhum dado além do CEP: sem query e sem cabeçalho de CSRF.
    expect(url).not.toContain("?");
    expect(
      (init.headers as Record<string, string>)["x-csrf-token"],
    ).toBeUndefined();
  });

  it.each([400, 401, 403, 404, 429, 503])(
    "recusa %s vira ApiError com o status, sem repassar o corpo",
    async (status) => {
      fetchMock.mockResolvedValueOnce(
        resposta(status, { message: "detalhe interno que não deve vazar" }),
      );
      const erro = await consultarCep("30140071").catch((e: unknown) => e);
      expect(erro).toBeInstanceOf(ApiError);
      expect((erro as ApiError).status).toBe(status);
      expect((erro as ApiError).message).not.toContain("detalhe interno");
    },
  );

  it.each(["3014007", "301400711", "30140-071", "abcdefgh", ""])(
    "fora da forma de 8 dígitos (%s) recusa 400 sem chamar o servidor",
    async (cep) => {
      const erro = await consultarCep(cep).catch((e: unknown) => e);
      expect(erro).toBeInstanceOf(ApiError);
      expect((erro as ApiError).status).toBe(400);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );
});
