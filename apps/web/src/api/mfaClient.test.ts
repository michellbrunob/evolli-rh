import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  confirmarEnrollmentMfa,
  iniciarEnrollmentMfa,
} from "./mfaClient";
import { clearCsrfToken, setCsrfToken } from "./csrfClient";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("mfaClient", () => {
  beforeEach(() => {
    clearCsrfToken();
  });
  afterEach(() => {
    clearCsrfToken();
    vi.restoreAllMocks();
  });

  describe("iniciarEnrollmentMfa", () => {
    it("POST /v1/auth/mfa/totp/enroll com x-csrf-token e same-origin", async () => {
      setCsrfToken("token-vigente");
      const fetchMock = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(
          jsonResponse(201, { secretBase32: "ABC", otpauthUri: "otpauth://x" }),
        );

      const material = await iniciarEnrollmentMfa();

      expect(fetchMock).toHaveBeenCalledWith(
        "/v1/auth/mfa/totp/enroll",
        expect.objectContaining({
          method: "POST",
          credentials: "same-origin",
          headers: expect.objectContaining({ "x-csrf-token": "token-vigente" }),
        }),
      );
      expect(material).toEqual({
        secretBase32: "ABC",
        otpauthUri: "otpauth://x",
      });
    });

    it("lança ApiError 409 quando já configurado (mensagem genérica, sem corpo do servidor)", async () => {
      setCsrfToken("token-vigente");
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        jsonResponse(409, { message: "detalhe interno" }),
      );

      const erro = await iniciarEnrollmentMfa().catch((e: unknown) => e);
      expect(erro).toBeInstanceOf(ApiError);
      expect((erro as ApiError).status).toBe(409);
      expect((erro as ApiError).message).not.toContain("detalhe interno");
    });

    it("limpa o token CSRF em memória ao receber 401", async () => {
      setCsrfToken("token-antigo");
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        jsonResponse(401, { message: "Não autorizado." }),
      );

      await iniciarEnrollmentMfa().catch(() => undefined);
      const { getCsrfToken } = await import("./csrfClient");
      expect(getCsrfToken()).toBeNull();
    });
  });

  describe("confirmarEnrollmentMfa", () => {
    it("POST /confirm com { code } e CSRF; devolve os recoveryCodes", async () => {
      setCsrfToken("token-vigente");
      const codes = Array.from({ length: 10 }, (_, i) => `CODE-${i}`);
      const fetchMock = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(jsonResponse(201, { recoveryCodes: codes }));

      const resultado = await confirmarEnrollmentMfa("123456");

      expect(fetchMock).toHaveBeenCalledWith(
        "/v1/auth/mfa/totp/confirm",
        expect.objectContaining({
          method: "POST",
          credentials: "same-origin",
          headers: expect.objectContaining({ "x-csrf-token": "token-vigente" }),
        }),
      );
      const body = JSON.parse(
        (fetchMock.mock.calls[0]?.[1] as RequestInit).body as string,
      ) as Record<string, unknown>;
      expect(body).toEqual({ code: "123456" });
      expect(resultado.recoveryCodes).toHaveLength(10);
    });

    it("lança ApiError 422 em código inválido, sem repassar o corpo do servidor", async () => {
      setCsrfToken("token-vigente");
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        jsonResponse(422, { message: "detalhe interno" }),
      );

      const erro = await confirmarEnrollmentMfa("000000").catch(
        (e: unknown) => e,
      );
      expect(erro).toBeInstanceOf(ApiError);
      expect((erro as ApiError).status).toBe(422);
      expect((erro as ApiError).message).not.toContain("detalhe interno");
    });
  });
});
