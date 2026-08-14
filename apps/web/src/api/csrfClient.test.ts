import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CsrfRequestError,
  CsrfSessionExpiredError,
  clearCsrfToken,
  getCsrfToken,
  refreshCsrfToken,
} from "./csrfClient";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("csrfClient", () => {
  beforeEach(() => {
    clearCsrfToken();
  });

  afterEach(() => {
    clearCsrfToken();
    vi.restoreAllMocks();
  });

  it("busca o token no endpoint GET /v1/auth/csrf sem cache e com credenciais de mesma origem", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { csrfToken: "token-abc" }));

    const token = await refreshCsrfToken(fetchMock);

    expect(token).toBe("token-abc");
    expect(fetchMock).toHaveBeenCalledWith(
      "/v1/auth/csrf",
      expect.objectContaining({
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      }),
    );
  });

  it("guarda o token somente em memória, nunca em localStorage ou sessionStorage", async () => {
    const localStorageSpy = vi.spyOn(Storage.prototype, "setItem");
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { csrfToken: "token-em-memoria" }));

    await refreshCsrfToken(fetchMock);

    expect(getCsrfToken()).toBe("token-em-memoria");
    expect(localStorageSpy).not.toHaveBeenCalled();
  });

  it("substitui o token anterior a cada nova chamada (rotação, ADR 0009 decisão 4)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { csrfToken: "token-1" }))
      .mockResolvedValueOnce(jsonResponse(200, { csrfToken: "token-2" }));

    await refreshCsrfToken(fetchMock);
    expect(getCsrfToken()).toBe("token-1");

    await refreshCsrfToken(fetchMock);
    expect(getCsrfToken()).toBe("token-2");
  });

  it("limpa o token em memória e lança CsrfSessionExpiredError quando a sessão está ausente/expirada (401)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(401, { message: "Não autorizado." }));

    await expect(refreshCsrfToken(fetchMock)).rejects.toBeInstanceOf(
      CsrfSessionExpiredError,
    );
    expect(getCsrfToken()).toBeNull();
  });

  it("lança CsrfRequestError sem detalhe interno para outras respostas de erro", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(500, { message: "Erro interno.", request_id: "req-123" }),
      );

    const error = await refreshCsrfToken(fetchMock).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(CsrfRequestError);
    expect((error as CsrfRequestError).requestId).toBe("req-123");
    expect((error as CsrfRequestError).message).not.toContain("Erro interno");
  });

  it("clearCsrfToken descarta o token guardado em memória", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { csrfToken: "token-a-limpar" }));
    await refreshCsrfToken(fetchMock);
    expect(getCsrfToken()).toBe("token-a-limpar");

    clearCsrfToken();

    expect(getCsrfToken()).toBeNull();
  });
});
