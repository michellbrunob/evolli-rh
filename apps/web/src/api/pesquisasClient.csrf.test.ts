/**
 * T216 — gravações de Pesquisas sobrevivem a um token CSRF renovado por outra
 * aba (403 `csrf_invalido`): o pedido não foi aplicado, então o cliente
 * descarta o token, renova e repete UMA vez (como a troca de empresa e o
 * perfil). Outros 403 e a segunda recusa seguem como erro.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearCsrfToken, getCsrfToken, setCsrfToken } from "./csrfClient";
import {
  alterarPesquisa,
  alterarStatusDaPesquisa,
  criarPesquisa,
  type PesquisaEntrada,
} from "./pesquisasClient";

const resposta = (status: number, corpo: unknown) =>
  new Response(JSON.stringify(corpo), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const fetchFalso = vi.fn<typeof fetch>();

const tokenDo = (init: RequestInit | undefined) =>
  (init?.headers as Record<string, string>)["x-csrf-token"];

const gravacoes = () =>
  fetchFalso.mock.calls.filter(([url]) => !String(url).endsWith("/auth/csrf"));

const ENTRADA = { nome: "Pulso" } as unknown as PesquisaEntrada;

beforeEach(() => {
  fetchFalso.mockReset();
  vi.stubGlobal("fetch", fetchFalso);
  setCsrfToken("token-desta-aba");
});

afterEach(() => {
  vi.unstubAllGlobals();
  clearCsrfToken();
});

/** O servidor aceita só o token renovado. */
function servidorComTokenNovo() {
  fetchFalso.mockImplementation(async (url, init) => {
    if (String(url).endsWith("/auth/csrf"))
      return resposta(200, { csrfToken: "token-renovado" });
    return tokenDo(init) === "token-renovado"
      ? resposta(200, { id: "p-1", status: "pausada" })
      : resposta(403, { message: "Acesso negado.", codigo: "csrf_invalido" });
  });
}

describe("T216 — CSRF desatualizado nas gravações de Pesquisas", () => {
  it.each([
    ["mudar o status", () => alterarStatusDaPesquisa("p-1", "pausada")],
    ["gravar o rascunho", () => alterarPesquisa("p-1", ENTRADA)],
    ["criar a pesquisa", () => criarPesquisa(ENTRADA)],
  ])("%s: renova o token e repete uma vez", async (_, gravar) => {
    servidorComTokenNovo();
    await expect(gravar()).resolves.toMatchObject({ id: "p-1" });
    const feitas = gravacoes();
    expect(feitas).toHaveLength(2);
    expect(tokenDo(feitas[0]![1])).toBe("token-desta-aba");
    expect(tokenDo(feitas[1]![1])).toBe("token-renovado");
    expect(feitas[1]![1]?.body).toBe(feitas[0]![1]?.body);
    expect(getCsrfToken()).toBe("token-renovado");
  });

  it("a segunda recusa não repete de novo: vira erro 403", async () => {
    fetchFalso.mockImplementation(async (url) =>
      String(url).endsWith("/auth/csrf")
        ? resposta(200, { csrfToken: "token-renovado" })
        : resposta(403, { message: "Acesso negado.", codigo: "csrf_invalido" }),
    );
    await expect(
      alterarStatusDaPesquisa("p-1", "pausada"),
    ).rejects.toMatchObject({ status: 403 });
    expect(gravacoes()).toHaveLength(2);
  });

  it("403 de permissão (sem o código do CSRF) não repete", async () => {
    fetchFalso.mockResolvedValue(resposta(403, { message: "Sem acesso." }));
    await expect(
      alterarStatusDaPesquisa("p-1", "pausada"),
    ).rejects.toMatchObject({ status: 403 });
    expect(gravacoes()).toHaveLength(1);
    expect(getCsrfToken()).toBe("token-desta-aba");
  });

  it("leitura nunca repete nem pede token", async () => {
    const { obterPesquisa } = await import("./pesquisasClient");
    fetchFalso.mockResolvedValue(
      resposta(403, { message: "Acesso negado.", codigo: "csrf_invalido" }),
    );
    await expect(obterPesquisa("p-1")).rejects.toMatchObject({ status: 403 });
    expect(fetchFalso).toHaveBeenCalledTimes(1);
  });
});
