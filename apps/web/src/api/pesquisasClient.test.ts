/**
 * T216 — cliente de Pesquisas: rotas do contrato, CSRF só nas escritas,
 * leitura sem cache do navegador, 204 na exclusão e erros como `ApiError`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearCsrfToken, setCsrfToken } from "./csrfClient";
import {
  alterarStatusDaPesquisa,
  excluirPesquisa,
  listarPesquisas,
  pesquisasDoColaborador,
  publicarPesquisa,
  respostasDaPesquisa,
  resultadosDaPesquisa,
} from "./pesquisasClient";

const fetchMock = vi.fn();

const ok = (body: unknown, status = 200) =>
  ({
    ok: true,
    status,
    json: async () => body,
  }) as unknown as Response;

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  clearCsrfToken();
  setCsrfToken("csrf-de-teste");
});

afterEach(() => {
  vi.unstubAllGlobals();
  clearCsrfToken();
});

function ultima() {
  const [url, init] = fetchMock.mock.calls.at(-1)!;
  return { url: url as string, init: init as RequestInit };
}

describe("pesquisasClient (T216)", () => {
  it("lista com status e página, sem CSRF e sem cache", async () => {
    fetchMock.mockResolvedValueOnce(ok({ itens: [] }));
    await listarPesquisas({ status: "ativa", pagina: 2, tamanhoPagina: 20 });
    const { url, init } = ultima();
    expect(url).toBe("/v1/pesquisas?status=ativa&pagina=2&tamanhoPagina=20");
    expect(init.method).toBe("GET");
    expect(init.cache).toBe("no-store");
    expect(
      (init.headers as Record<string, string>)["x-csrf-token"],
    ).toBeUndefined();
  });

  it("sem filtro, a lista vai sem query", async () => {
    fetchMock.mockResolvedValueOnce(ok({ itens: [] }));
    await listarPesquisas();
    expect(ultima().url).toBe("/v1/pesquisas");
  });

  it("publicar e mudar status levam CSRF", async () => {
    fetchMock.mockResolvedValue(ok({ id: "p-1" }));
    await publicarPesquisa("p-1");
    expect(ultima().url).toBe("/v1/pesquisas/p-1/publicar");
    expect(
      (ultima().init.headers as Record<string, string>)["x-csrf-token"],
    ).toBe("csrf-de-teste");
    await alterarStatusDaPesquisa("p-1", "pausada");
    expect(ultima().url).toBe("/v1/pesquisas/p-1/status");
    expect(ultima().init.body).toBe(JSON.stringify({ status: "pausada" }));
  });

  it("excluir usa DELETE e aceita 204 sem corpo", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 204,
      json: async () => {
        throw new Error("sem corpo");
      },
    } as unknown as Response);
    await expect(excluirPesquisa("p-1")).resolves.toBeUndefined();
    expect(ultima().init.method).toBe("DELETE");
  });

  it("resultados por departamento vão na query", async () => {
    fetchMock.mockResolvedValueOnce(ok({ perguntas: [] }));
    await resultadosDaPesquisa("p-1", "dep 1");
    expect(ultima().url).toBe(
      "/v1/pesquisas/p-1/resultados?departamentoId=dep%201",
    );
  });

  it("respostas e aba da ficha aceitam lista ou lista embrulhada", async () => {
    fetchMock.mockResolvedValueOnce(ok([{ colaboradorId: "c-1" }]));
    expect(await respostasDaPesquisa("p-1")).toHaveLength(1);
    fetchMock.mockResolvedValueOnce(ok({ itens: [{ pesquisaId: "p-1" }] }));
    expect(await pesquisasDoColaborador("c-1")).toHaveLength(1);
    expect(ultima().url).toBe("/v1/colaboradores/c-1/pesquisas");
  });

  it("erro vira ApiError com o status", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({ erros: [{ campo: "status", motivo: "invalido" }] }),
    } as unknown as Response);
    await expect(alterarStatusDaPesquisa("p-1", "ativa")).rejects.toMatchObject(
      { status: 409 },
    );
  });
});
