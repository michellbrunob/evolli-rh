import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  type SessaoApi,
  listarSessoesAtivas,
  revogarSessao,
} from "./sessoesClient";
import { clearCsrfToken, setCsrfToken } from "./csrfClient";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const sessaoSintetica: SessaoApi = {
  id: "11111111-1111-1111-1111-111111111111",
  createdAt: "2026-01-01T10:00:00.000Z",
  lastSeenAt: "2026-01-02T09:00:00.000Z",
  expiresAt: "2026-01-08T10:00:00.000Z",
  ip: "203.0.113.10",
  userAgent: "Mozilla/5.0 (teste)",
};

describe("sessoesClient", () => {
  beforeEach(() => {
    clearCsrfToken();
  });

  afterEach(() => {
    clearCsrfToken();
    vi.restoreAllMocks();
  });

  describe("listarSessoesAtivas", () => {
    it("busca GET /v1/auth/sessions com credentials same-origin", async () => {
      const fetchMock = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(jsonResponse(200, [sessaoSintetica]));

      const lista = await listarSessoesAtivas();

      expect(fetchMock).toHaveBeenCalledWith(
        "/v1/auth/sessions",
        expect.objectContaining({ credentials: "same-origin" }),
      );
      expect(lista).toEqual([sessaoSintetica]);
    });

    it("nunca envia x-csrf-token (é leitura, GET)", async () => {
      const fetchMock = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(jsonResponse(200, []));

      await listarSessoesAtivas();

      const chamada = fetchMock.mock.calls[0]!;
      const init = chamada[1] as RequestInit;
      expect(init.headers).not.toHaveProperty("x-csrf-token");
    });

    it("lança ApiError com status 401 quando a sessão não é mais válida", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        jsonResponse(401, { message: "Não autorizado." }),
      );

      const erro = await listarSessoesAtivas().catch((e: unknown) => e);

      expect(erro).toBeInstanceOf(ApiError);
      expect((erro as ApiError).status).toBe(401);
    });

    it("limpa o token CSRF em memória quando a resposta é 401", async () => {
      setCsrfToken("token-antigo");
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        jsonResponse(401, { message: "Não autorizado." }),
      );

      await listarSessoesAtivas().catch(() => undefined);

      const { getCsrfToken } = await import("./csrfClient");
      expect(getCsrfToken()).toBeNull();
    });
  });

  describe("revogarSessao", () => {
    it("envia DELETE /v1/auth/sessions/:id com x-csrf-token e credentials same-origin", async () => {
      setCsrfToken("token-vigente");
      const fetchMock = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(new Response(null, { status: 204 }));

      await revogarSessao(sessaoSintetica.id);

      expect(fetchMock).toHaveBeenCalledWith(
        `/v1/auth/sessions/${sessaoSintetica.id}`,
        expect.objectContaining({
          method: "DELETE",
          credentials: "same-origin",
          headers: expect.objectContaining({
            "x-csrf-token": "token-vigente",
          }),
        }),
      );
    });

    it("lança ApiError com status 404 quando o id não existe mais", async () => {
      setCsrfToken("token-vigente");
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        jsonResponse(404, { message: "Não encontrado." }),
      );

      const erro = await revogarSessao(sessaoSintetica.id).catch(
        (e: unknown) => e,
      );

      expect(erro).toBeInstanceOf(ApiError);
      expect((erro as ApiError).status).toBe(404);
    });

    it("lança ApiError com status 401 quando a própria sessão já não é válida", async () => {
      setCsrfToken("token-vigente");
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        jsonResponse(401, { message: "Não autorizado." }),
      );

      const erro = await revogarSessao(sessaoSintetica.id).catch(
        (e: unknown) => e,
      );

      expect(erro).toBeInstanceOf(ApiError);
      expect((erro as ApiError).status).toBe(401);
    });

    it("codifica o id na URL (encodeURIComponent)", async () => {
      setCsrfToken("token-vigente");
      const fetchMock = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(new Response(null, { status: 204 }));

      await revogarSessao("id com espaço");

      expect(fetchMock).toHaveBeenCalledWith(
        `/v1/auth/sessions/${encodeURIComponent("id com espaço")}`,
        expect.anything(),
      );
    });
  });
});
