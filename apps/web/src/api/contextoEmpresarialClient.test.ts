/**
 * T189 — a troca de empresa sobrevive a um token CSRF renovado por outra aba.
 *
 * Todas as abas compartilham a sessão; quando uma renova o token CSRF, o das
 * outras deixa de valer (403 `csrf_invalido`). A troca é idempotente, então o
 * cliente renova o token e repete UMA vez. Medido na prévia: sem isto, voltar
 * à empresa anterior depois de uma troca feita em outra aba falhava.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ContextoApiError,
  trocarEmpresaDoContexto,
} from "./contextoEmpresarialClient";
import { clearCsrfToken, getCsrfToken, setCsrfToken } from "./csrfClient";

const EMPRESA = {
  id: "empresa-sintetica-beta",
  codigo: "BETA",
  nome: "Empresa Beta",
};

function resposta(status: number, corpo: unknown): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const fetchFalso = vi.fn<typeof fetch>();

function postsFeitos() {
  return fetchFalso.mock.calls.filter(
    ([url, init]) =>
      String(url).endsWith("/auth/contexto/empresa") &&
      (init as RequestInit | undefined)?.method === "POST",
  );
}

function tokenDo(chamada: Parameters<typeof fetch>) {
  return ((chamada[1] as RequestInit).headers as Record<string, string>)[
    "x-csrf-token"
  ];
}

beforeEach(() => {
  fetchFalso.mockReset();
  vi.stubGlobal("fetch", fetchFalso);
  clearCsrfToken();
  setCsrfToken("token-desta-aba");
});

afterEach(() => {
  vi.unstubAllGlobals();
  clearCsrfToken();
});

describe("T189 — troca de empresa e token CSRF renovado por outra aba", () => {
  it("403 csrf_invalido: renova o token e repete uma vez, com o token novo", async () => {
    fetchFalso.mockImplementation(async (url, init) => {
      if (String(url).endsWith("/auth/csrf")) {
        return resposta(200, { csrfToken: "token-renovado" });
      }
      const token = (init?.headers as Record<string, string>)["x-csrf-token"];
      return token === "token-renovado"
        ? resposta(200, { empresaAtiva: EMPRESA })
        : resposta(403, { message: "Acesso negado.", codigo: "csrf_invalido" });
    });

    await expect(trocarEmpresaDoContexto(EMPRESA.id)).resolves.toEqual(EMPRESA);
    const posts = postsFeitos();
    expect(posts).toHaveLength(2);
    expect(tokenDo(posts[0]!)).toBe("token-desta-aba");
    expect(tokenDo(posts[1]!)).toBe("token-renovado");
    expect(getCsrfToken()).toBe("token-renovado");
  });

  it("repete no máximo uma vez: dois csrf_invalido seguidos viram erro", async () => {
    fetchFalso.mockImplementation(async (url) =>
      String(url).endsWith("/auth/csrf")
        ? resposta(200, { csrfToken: "token-renovado" })
        : resposta(403, { message: "Acesso negado.", codigo: "csrf_invalido" }),
    );
    await expect(trocarEmpresaDoContexto(EMPRESA.id)).rejects.toMatchObject({
      status: 403,
    });
    expect(postsFeitos()).toHaveLength(2);
  });

  it("403 de permissão (sem csrf_invalido) não repete", async () => {
    fetchFalso.mockResolvedValue(resposta(403, { message: "Acesso negado." }));
    const erro = await trocarEmpresaDoContexto(EMPRESA.id).catch((e) => e);
    expect(erro).toBeInstanceOf(ContextoApiError);
    expect((erro as ContextoApiError).status).toBe(403);
    expect(postsFeitos()).toHaveLength(1);
    expect(getCsrfToken()).toBe("token-desta-aba");
  });

  it("404 (empresa indisponível) não repete", async () => {
    fetchFalso.mockResolvedValue(resposta(404, { message: "Não encontrado." }));
    await expect(trocarEmpresaDoContexto(EMPRESA.id)).rejects.toMatchObject({
      status: 404,
    });
    expect(postsFeitos()).toHaveLength(1);
  });
});
