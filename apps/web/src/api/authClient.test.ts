import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, login, logout } from "./authClient";
import { clearCsrfToken, getCsrfToken, setCsrfToken } from "./csrfClient";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("authClient", () => {
  beforeEach(() => {
    clearCsrfToken();
  });

  afterEach(() => {
    clearCsrfToken();
    vi.restoreAllMocks();
  });

  describe("login", () => {
    it("envia e-mail e senha para POST /v1/auth/login com credentials same-origin", async () => {
      const fetchMock = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(jsonResponse(200, { csrfToken: "token-login" }));

      await login({ email: "pessoa@example.test", password: "SenhaForte123!" });

      expect(fetchMock).toHaveBeenCalledWith(
        "/v1/auth/login",
        expect.objectContaining({
          method: "POST",
          credentials: "same-origin",
          body: JSON.stringify({
            email: "pessoa@example.test",
            password: "SenhaForte123!",
          }),
        }),
      );
    });

    it("guarda o token CSRF da resposta em memória, sem round-trip extra a /auth/csrf", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        jsonResponse(200, { csrfToken: "token-da-sessao-nova" }),
      );

      await login({ email: "pessoa@example.test", password: "SenhaForte123!" });

      expect(getCsrfToken()).toBe("token-da-sessao-nova");
    });

    it("nunca grava e-mail, senha ou token em localStorage/sessionStorage", async () => {
      const localStorageSpy = vi.spyOn(Storage.prototype, "setItem");
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        jsonResponse(200, { csrfToken: "token-x" }),
      );

      await login({ email: "pessoa@example.test", password: "SenhaForte123!" });

      expect(localStorageSpy).not.toHaveBeenCalled();
    });

    it("lança ApiError com o status 401 em credencial inválida, sem repassar o texto do servidor", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        jsonResponse(401, { message: "Não autorizado." }),
      );

      const erro = await login({
        email: "pessoa@example.test",
        password: "errada",
      }).catch((e: unknown) => e);

      expect(erro).toBeInstanceOf(ApiError);
      expect((erro as ApiError).status).toBe(401);
    });

    it("lança ApiError com o status 429 quando o rate limit do backend bloqueia", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        jsonResponse(429, { message: "Muitas requisições." }),
      );

      const erro = await login({
        email: "pessoa@example.test",
        password: "qualquer",
      }).catch((e: unknown) => e);

      expect(erro).toBeInstanceOf(ApiError);
      expect((erro as ApiError).status).toBe(429);
    });

    it("não grava nenhum token quando a falha impede sucesso", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        jsonResponse(401, { message: "Não autorizado." }),
      );

      await login({ email: "pessoa@example.test", password: "errada" }).catch(
        () => undefined,
      );

      expect(getCsrfToken()).toBeNull();
    });
  });

  describe("logout", () => {
    it("envia o token CSRF em memória no header x-csrf-token", async () => {
      setCsrfToken("token-vigente");
      const fetchMock = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(new Response(null, { status: 204 }));

      await logout();

      expect(fetchMock).toHaveBeenCalledWith(
        "/v1/auth/logout",
        expect.objectContaining({
          method: "POST",
          credentials: "same-origin",
          headers: { "x-csrf-token": "token-vigente" },
        }),
      );
    });

    it("limpa o token CSRF em memória após sucesso (204)", async () => {
      setCsrfToken("token-vigente");
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(null, { status: 204 }),
      );

      await logout();

      expect(getCsrfToken()).toBeNull();
    });

    it("limpa o token CSRF em memória mesmo quando o servidor responde 401 (sessão já expirada)", async () => {
      setCsrfToken("token-vigente");
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        jsonResponse(401, { message: "Não autorizado." }),
      );

      await logout();

      expect(getCsrfToken()).toBeNull();
    });

    it("limpa o token CSRF em memória mesmo quando o fetch falha (rede fora do ar)", async () => {
      setCsrfToken("token-vigente");
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network"));

      await logout().catch(() => undefined);

      expect(getCsrfToken()).toBeNull();
    });

    it("lança ApiError para falha inesperada do servidor (500)", async () => {
      setCsrfToken("token-vigente");
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        jsonResponse(500, { message: "Erro interno." }),
      );

      const erro = await logout().catch((e: unknown) => e);

      expect(erro).toBeInstanceOf(ApiError);
    });
  });
});
