import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, listarAlocacoesVinculo } from "./vinculoContratualClient";
import { getCsrfToken, setCsrfToken, clearCsrfToken } from "./csrfClient";

function respostaOk(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as unknown as Response;
}
function respostaErro(status: number): Response {
  return {
    ok: false,
    status,
    json: async () => ({ message: "detalhe interno que NUNCA deve vazar" }),
  } as unknown as Response;
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  clearCsrfToken();
  setCsrfToken("csrf-em-memoria");
});
afterEach(() => {
  vi.unstubAllGlobals();
  clearCsrfToken();
});

describe("vinculoContratualClient.listarAlocacoesVinculo", () => {
  it("GET /v1/vinculos/:id/alocacoes, same-origin, sem CSRF (leitura)", async () => {
    fetchMock.mockResolvedValueOnce(respostaOk([]));
    await listarAlocacoesVinculo("vinc 1");
    const [url, init] = fetchMock.mock.calls.at(-1)!;
    expect(url).toBe("/v1/vinculos/vinc%201/alocacoes");
    expect((init as RequestInit).credentials).toBe("same-origin");
    expect((init as RequestInit).method ?? "GET").toBe("GET");
    expect(
      ((init as RequestInit).headers as Record<string, string> | undefined)?.[
        "x-csrf-token"
      ],
    ).toBeUndefined();
  });

  it("lança ApiError com o status, sem repassar o corpo do servidor", async () => {
    fetchMock.mockResolvedValueOnce(respostaErro(404));
    try {
      await listarAlocacoesVinculo("x");
      throw new Error("deveria ter lançado");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).status).toBe(404);
      expect((err as ApiError).message).not.toContain("detalhe interno");
    }
  });

  it("401 limpa o token CSRF em memória", async () => {
    fetchMock.mockResolvedValueOnce(respostaErro(401));
    await expect(listarAlocacoesVinculo("x")).rejects.toBeInstanceOf(ApiError);
    expect(getCsrfToken()).toBeNull();
  });
});
