import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CODIGO_CSRF_INVALIDO,
  CsrfRequestError,
  CsrfSessionExpiredError,
  clearCsrfToken,
  descartarTokenSeDesatualizado,
  falhaAoPrepararEnvio,
  falhaPorSessaoExpirada,
  falhaPorTokenDesatualizado,
  getCsrfToken,
  refreshCsrfToken,
  setCsrfToken,
  tokenCsrfParaGravacao,
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

  it("setCsrfToken guarda em memória o token já trazido por outra resposta (ex.: login), sem round-trip a /auth/csrf", () => {
    const localStorageSpy = vi.spyOn(Storage.prototype, "setItem");

    setCsrfToken("token-do-login");

    expect(getCsrfToken()).toBe("token-do-login");
    expect(localStorageSpy).not.toHaveBeenCalled();
  });

  it("setCsrfToken substitui um token anterior em memória", () => {
    setCsrfToken("token-antigo");
    expect(getCsrfToken()).toBe("token-antigo");

    setCsrfToken("token-novo");

    expect(getCsrfToken()).toBe("token-novo");
  });
});

describe("T179 — token para gravação e classificação da falha", () => {
  beforeEach(() => {
    clearCsrfToken();
  });

  afterEach(() => {
    clearCsrfToken();
  });

  it("usa o token da memória sem ir ao servidor", async () => {
    setCsrfToken("token-em-memoria");
    const fetchMock = vi.fn();
    await expect(tokenCsrfParaGravacao(fetchMock)).resolves.toBe(
      "token-em-memoria",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rede caída na renovação vira CsrfRequestError (o pedido nem saiu)", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValue(new TypeError("Failed to fetch"));
    const erro: unknown = await tokenCsrfParaGravacao(fetchMock).catch(
      (e: unknown) => e,
    );
    expect(erro).toBeInstanceOf(CsrfRequestError);
    expect(falhaAoPrepararEnvio(erro)).toBe(true);
    expect(falhaPorSessaoExpirada(erro)).toBe(false);
  });

  it("5xx na renovação é CsrfRequestError; 401, sessão expirada", async () => {
    const erro5xx: unknown = await tokenCsrfParaGravacao(
      vi.fn().mockResolvedValue(jsonResponse(503, {})),
    ).catch((e: unknown) => e);
    expect(erro5xx).toBeInstanceOf(CsrfRequestError);
    const erro401: unknown = await tokenCsrfParaGravacao(
      vi.fn().mockResolvedValue(jsonResponse(401, {})),
    ).catch((e: unknown) => e);
    expect(erro401).toBeInstanceOf(CsrfSessionExpiredError);
    expect(falhaPorSessaoExpirada(erro401)).toBe(true);
  });

  it("sessão expirada: só o 401; o 403 csrf_invalido é página desatualizada; o 403 de permissão e o 5xx, nenhum dos dois", () => {
    expect(falhaPorSessaoExpirada({ status: 401 })).toBe(true);
    // T179 (revisão definitiva) — a sessão vencida responde 401 antes do
    // CSRF: o 403 csrf_invalido vem com a sessão válida e o token desta aba
    // desatualizado.
    expect(
      falhaPorSessaoExpirada({ status: 403, codigo: CODIGO_CSRF_INVALIDO }),
    ).toBe(false);
    expect(
      falhaPorTokenDesatualizado({ status: 403, codigo: CODIGO_CSRF_INVALIDO }),
    ).toBe(true);
    expect(falhaPorTokenDesatualizado({ status: 403 })).toBe(false);
    expect(falhaPorTokenDesatualizado({ status: 401 })).toBe(false);
    expect(falhaPorSessaoExpirada({ status: 403 })).toBe(false);
    expect(falhaPorSessaoExpirada({ status: 403, codigo: "outro" })).toBe(
      false,
    );
    expect(falhaPorSessaoExpirada({ status: 500 })).toBe(false);
    expect(falhaPorSessaoExpirada(new TypeError("Failed to fetch"))).toBe(
      false,
    );
    expect(falhaAoPrepararEnvio(new TypeError("Failed to fetch"))).toBe(false);
  });
});

describe("T179 (revisão definitiva) — descarte do token desatualizado", () => {
  const resposta = (status: number, corpo: unknown) =>
    new Response(JSON.stringify(corpo), {
      status,
      headers: { "Content-Type": "application/json" },
    });

  it("403 csrf_invalido: descarta SÓ o token em memória, e o corpo segue legível", async () => {
    setCsrfToken("token-sintetico-velho");
    const res = resposta(403, { codigo: CODIGO_CSRF_INVALIDO });
    await descartarTokenSeDesatualizado(res);
    expect(getCsrfToken()).toBeNull();
    // A resposta original continua intacta para quem chama.
    await expect(res.json()).resolves.toEqual({ codigo: CODIGO_CSRF_INVALIDO });
  });

  it.each([
    ["403 de permissão (sem código)", resposta(403, {})],
    ["403 com outro código", resposta(403, { codigo: "outro" })],
    ["409", resposta(409, { codigo: CODIGO_CSRF_INVALIDO })],
    ["403 com corpo ilegível", new Response("x", { status: 403 })],
  ])("%s: o token fica", async (_caso, res) => {
    setCsrfToken("token-sintetico-valido");
    await descartarTokenSeDesatualizado(res);
    expect(getCsrfToken()).toBe("token-sintetico-valido");
  });
});
