import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  type SafeAccessUserApi,
  alterarPapel,
  criarConta,
  desativarConta,
  listarUsuarios,
  obterUsuarioAtual,
} from "./usersClient";
import { clearCsrfToken, setCsrfToken } from "./csrfClient";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const usuarioSintetico: SafeAccessUserApi = {
  id: "11111111-1111-1111-1111-111111111111",
  email: "pessoa.teste@example.test",
  role: "colaborador",
  companyId: "empresa-sintetica",
  unitId: null,
  teamId: null,
  status: "active",
  createdAt: "2026-01-01T10:00:00.000Z",
};

describe("usersClient", () => {
  beforeEach(() => {
    clearCsrfToken();
  });

  afterEach(() => {
    clearCsrfToken();
    vi.restoreAllMocks();
  });

  describe("obterUsuarioAtual", () => {
    it("busca GET /v1/users/me com credentials same-origin, sem CSRF", async () => {
      const fetchMock = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(jsonResponse(200, usuarioSintetico));

      const resultado = await obterUsuarioAtual();

      expect(fetchMock).toHaveBeenCalledWith(
        "/v1/users/me",
        expect.objectContaining({ credentials: "same-origin" }),
      );
      const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
      expect(init.headers).not.toHaveProperty("x-csrf-token");
      expect(resultado).toEqual(usuarioSintetico);
    });

    it("lança ApiError 401 quando a sessão não é mais válida", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        jsonResponse(401, { message: "Não autorizado." }),
      );

      const erro = await obterUsuarioAtual().catch((e: unknown) => e);

      expect(erro).toBeInstanceOf(ApiError);
      expect((erro as ApiError).status).toBe(401);
    });
  });

  describe("listarUsuarios", () => {
    it("busca GET /v1/users sem filtros por padrão", async () => {
      const fetchMock = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(jsonResponse(200, { items: [], nextCursor: null }));

      await listarUsuarios();

      expect(fetchMock).toHaveBeenCalledWith(
        "/v1/users",
        expect.objectContaining({ credentials: "same-origin" }),
      );
    });

    it("monta querystring com status, role, companyId, cursor e limit", async () => {
      const fetchMock = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(jsonResponse(200, { items: [], nextCursor: null }));

      await listarUsuarios({
        status: "disabled",
        role: "rh",
        companyId: "empresa-x",
        cursor: "cursor-abc",
        limit: 10,
      });

      const url = fetchMock.mock.calls[0]?.[0] as string;
      expect(url).toContain("status=disabled");
      expect(url).toContain("role=rh");
      expect(url).toContain("companyId=empresa-x");
      expect(url).toContain("cursor=cursor-abc");
      expect(url).toContain("limit=10");
    });

    it("nunca envia x-csrf-token (é leitura, GET)", async () => {
      const fetchMock = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(jsonResponse(200, { items: [], nextCursor: null }));

      await listarUsuarios();

      const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
      expect(init.headers).not.toHaveProperty("x-csrf-token");
    });

    it("retorna items e nextCursor exatamente como veio da API", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        jsonResponse(200, {
          items: [usuarioSintetico],
          nextCursor: "cursor-seguinte",
        }),
      );

      const resultado = await listarUsuarios();

      expect(resultado.items).toEqual([usuarioSintetico]);
      expect(resultado.nextCursor).toBe("cursor-seguinte");
    });

    it("lança ApiError 403 quando o papel não tem permissão", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        jsonResponse(403, { message: "Acesso negado." }),
      );

      const erro = await listarUsuarios().catch((e: unknown) => e);

      expect(erro).toBeInstanceOf(ApiError);
      expect((erro as ApiError).status).toBe(403);
    });

    it("lança ApiError 400 com cursor inválido", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        jsonResponse(400, { message: "Requisição inválida." }),
      );

      const erro = await listarUsuarios({ cursor: "cursor-invalido" }).catch(
        (e: unknown) => e,
      );

      expect(erro).toBeInstanceOf(ApiError);
      expect((erro as ApiError).status).toBe(400);
    });
  });

  describe("criarConta", () => {
    it("envia POST /v1/users com x-csrf-token e credentials same-origin", async () => {
      setCsrfToken("token-vigente");
      const fetchMock = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(jsonResponse(201, usuarioSintetico));

      await criarConta({
        email: "novo@example.test",
        password: "senha-sintetica-bem-longa",
        role: "colaborador",
        companyId: "empresa-sintetica",
      });

      expect(fetchMock).toHaveBeenCalledWith(
        "/v1/users",
        expect.objectContaining({
          method: "POST",
          credentials: "same-origin",
          headers: expect.objectContaining({
            "x-csrf-token": "token-vigente",
          }),
        }),
      );
      const body = JSON.parse(
        (fetchMock.mock.calls[0]?.[1] as RequestInit).body as string,
      ) as Record<string, unknown>;
      expect(body).toEqual({
        email: "novo@example.test",
        password: "senha-sintetica-bem-longa",
        role: "colaborador",
        companyId: "empresa-sintetica",
      });
    });

    it("nunca envia unitId nem teamId (fora do escopo desta tela)", async () => {
      setCsrfToken("token-vigente");
      const fetchMock = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(jsonResponse(201, usuarioSintetico));

      await criarConta({
        email: "novo@example.test",
        password: "senha-sintetica-bem-longa",
        role: "colaborador",
        companyId: "empresa-sintetica",
      });

      const body = (fetchMock.mock.calls[0]?.[1] as RequestInit).body as string;
      expect(body).not.toContain("unitId");
      expect(body).not.toContain("teamId");
    });

    it("lança ApiError 422 quando a senha não atende à política", async () => {
      setCsrfToken("token-vigente");
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        jsonResponse(422, { message: "Dados inválidos." }),
      );

      const erro = await criarConta({
        email: "novo@example.test",
        password: "123",
        role: "colaborador",
        companyId: "empresa-sintetica",
      }).catch((e: unknown) => e);

      expect(erro).toBeInstanceOf(ApiError);
      expect((erro as ApiError).status).toBe(422);
    });

    it("lança ApiError 403 quando o papel-alvo não é permitido", async () => {
      setCsrfToken("token-vigente");
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        jsonResponse(403, { message: "Acesso negado." }),
      );

      const erro = await criarConta({
        email: "novo@example.test",
        password: "senha-sintetica-bem-longa",
        role: "colaborador",
        companyId: "empresa-sintetica",
      }).catch((e: unknown) => e);

      expect(erro).toBeInstanceOf(ApiError);
      expect((erro as ApiError).status).toBe(403);
    });
  });

  describe("alterarPapel", () => {
    it("envia PATCH /v1/users/:id/role com corpo estritamente { role }", async () => {
      setCsrfToken("token-vigente");
      const fetchMock = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(
          jsonResponse(200, { ...usuarioSintetico, role: "gestor" }),
        );

      await alterarPapel(usuarioSintetico.id, "gestor");

      expect(fetchMock).toHaveBeenCalledWith(
        `/v1/users/${usuarioSintetico.id}/role`,
        expect.objectContaining({
          method: "PATCH",
          credentials: "same-origin",
          headers: expect.objectContaining({
            "x-csrf-token": "token-vigente",
          }),
        }),
      );
      const body = JSON.parse(
        (fetchMock.mock.calls[0]?.[1] as RequestInit).body as string,
      ) as Record<string, unknown>;
      expect(Object.keys(body)).toEqual(["role"]);
      expect(body["role"]).toBe("gestor");
    });

    it("codifica o id na URL (encodeURIComponent)", async () => {
      setCsrfToken("token-vigente");
      const fetchMock = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(jsonResponse(200, usuarioSintetico));

      await alterarPapel("id com espaço", "gestor");

      expect(fetchMock).toHaveBeenCalledWith(
        `/v1/users/${encodeURIComponent("id com espaço")}/role`,
        expect.anything(),
      );
    });

    it("lança ApiError 403 em autoelevação/autoalteração (o backend nega)", async () => {
      setCsrfToken("token-vigente");
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        jsonResponse(403, { message: "Acesso negado." }),
      );

      const erro = await alterarPapel(usuarioSintetico.id, "rh").catch(
        (e: unknown) => e,
      );

      expect(erro).toBeInstanceOf(ApiError);
      expect((erro as ApiError).status).toBe(403);
    });

    it("lança ApiError 404 quando o id não existe mais", async () => {
      setCsrfToken("token-vigente");
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        jsonResponse(404, { message: "Não encontrado." }),
      );

      const erro = await alterarPapel(usuarioSintetico.id, "rh").catch(
        (e: unknown) => e,
      );

      expect(erro).toBeInstanceOf(ApiError);
      expect((erro as ApiError).status).toBe(404);
    });
  });

  describe("desativarConta", () => {
    it("envia POST /v1/users/:id/disable com x-csrf-token, sem corpo", async () => {
      setCsrfToken("token-vigente");
      const fetchMock = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(new Response(null, { status: 204 }));

      await desativarConta(usuarioSintetico.id);

      expect(fetchMock).toHaveBeenCalledWith(
        `/v1/users/${usuarioSintetico.id}/disable`,
        expect.objectContaining({
          method: "POST",
          credentials: "same-origin",
          headers: expect.objectContaining({
            "x-csrf-token": "token-vigente",
          }),
        }),
      );
      const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
      expect(init.body).toBeUndefined();
    });

    it("codifica o id na URL (encodeURIComponent)", async () => {
      setCsrfToken("token-vigente");
      const fetchMock = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(new Response(null, { status: 204 }));

      await desativarConta("id com espaço");

      expect(fetchMock).toHaveBeenCalledWith(
        `/v1/users/${encodeURIComponent("id com espaço")}/disable`,
        expect.anything(),
      );
    });

    it("lança ApiError 403 ao tentar desativar a própria conta (o backend nega)", async () => {
      setCsrfToken("token-vigente");
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        jsonResponse(403, { message: "Acesso negado." }),
      );

      const erro = await desativarConta(usuarioSintetico.id).catch(
        (e: unknown) => e,
      );

      expect(erro).toBeInstanceOf(ApiError);
      expect((erro as ApiError).status).toBe(403);
    });

    it("lança ApiError 404 quando o id não existe mais", async () => {
      setCsrfToken("token-vigente");
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        jsonResponse(404, { message: "Não encontrado." }),
      );

      const erro = await desativarConta(usuarioSintetico.id).catch(
        (e: unknown) => e,
      );

      expect(erro).toBeInstanceOf(ApiError);
      expect((erro as ApiError).status).toBe(404);
    });

    it("limpa o token CSRF em memória quando a resposta é 401", async () => {
      setCsrfToken("token-antigo");
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        jsonResponse(401, { message: "Não autorizado." }),
      );

      await desativarConta(usuarioSintetico.id).catch(() => undefined);

      const { getCsrfToken } = await import("./csrfClient");
      expect(getCsrfToken()).toBeNull();
    });
  });
});
