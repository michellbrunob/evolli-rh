import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  criarDocumento,
  criarSolicitacaoDocumento,
  detalharDocumento,
  detalharSolicitacaoDocumento,
  listarDocumentos,
  listarSolicitacoesDocumento,
  listarTiposDocumento,
  substituirDocumento,
} from "./documentosClient";
import { clearCsrfToken, setCsrfToken } from "./csrfClient";

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

function ultimaChamada() {
  const [url, init] = fetchMock.mock.calls.at(-1)!;
  return { url: url as string, init: (init ?? {}) as RequestInit };
}

describe("documentosClient — leituras (GET)", () => {
  it("listarTiposDocumento usa /v1/tipos-documento, same-origin, sem CSRF", async () => {
    fetchMock.mockResolvedValueOnce(
      respostaOk({ itens: [], pagina: 1, tamanhoPagina: 100, total: 0 }),
    );
    await listarTiposDocumento({ tamanhoPagina: 100 });
    const { url, init } = ultimaChamada();
    expect(url).toBe("/v1/tipos-documento?tamanhoPagina=100");
    expect(init.credentials).toBe("same-origin");
    expect(init.method ?? "GET").toBe("GET");
    expect(
      (init.headers as Record<string, string> | undefined)?.["x-csrf-token"],
    ).toBeUndefined();
  });

  it("listarDocumentos monta a query só com os filtros informados", async () => {
    fetchMock.mockResolvedValueOnce(
      respostaOk({ itens: [], pagina: 1, tamanhoPagina: 20, total: 0 }),
    );
    await listarDocumentos({
      colaboradorId: "colab-1",
      estado: "substituido",
      pagina: 2,
      tamanhoPagina: 20,
    });
    const { url } = ultimaChamada();
    expect(url).toContain("/v1/documentos?");
    expect(url).toContain("colaboradorId=colab-1");
    expect(url).toContain("estado=substituido");
    expect(url).toContain("pagina=2");
    expect(url).not.toContain("tipoDocumentoId");
  });

  it("detalharDocumento codifica o id no caminho por recurso", async () => {
    fetchMock.mockResolvedValueOnce(respostaOk({ id: "a b" }));
    await detalharDocumento("a b");
    expect(ultimaChamada().url).toBe("/v1/documentos/a%20b");
  });

  it("listarSolicitacoesDocumento usa /v1/solicitacoes-documento", async () => {
    fetchMock.mockResolvedValueOnce(
      respostaOk({ itens: [], pagina: 1, tamanhoPagina: 20, total: 0 }),
    );
    await listarSolicitacoesDocumento({ colaboradorId: "colab-1" });
    expect(ultimaChamada().url).toBe(
      "/v1/solicitacoes-documento?colaboradorId=colab-1",
    );
  });

  it("detalharSolicitacaoDocumento usa o caminho por recurso", async () => {
    fetchMock.mockResolvedValueOnce(respostaOk({ id: "s1" }));
    await detalharSolicitacaoDocumento("s1");
    expect(ultimaChamada().url).toBe("/v1/solicitacoes-documento/s1");
  });
});

describe("documentosClient — mutações (POST) com CSRF", () => {
  it("criarDocumento envia DTO mínimo, same-origin e x-csrf-token", async () => {
    fetchMock.mockResolvedValueOnce(respostaOk({ id: "d1" }));
    await criarDocumento({
      empresaId: "emp-1",
      colaboradorId: "colab-1",
      tipoDocumentoId: "tipo-1",
    });
    const { url, init } = ultimaChamada();
    expect(url).toBe("/v1/documentos");
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("same-origin");
    expect((init.headers as Record<string, string>)["x-csrf-token"]).toBe(
      "csrf-em-memoria",
    );
    expect(JSON.parse(init.body as string)).toEqual({
      empresaId: "emp-1",
      colaboradorId: "colab-1",
      tipoDocumentoId: "tipo-1",
    });
  });

  it("substituirDocumento posta só { tipoDocumentoId } no caminho de substituições", async () => {
    fetchMock.mockResolvedValueOnce(respostaOk({ id: "d2" }));
    await substituirDocumento("d1", "tipo-2");
    const { url, init } = ultimaChamada();
    expect(url).toBe("/v1/documentos/d1/substituicoes");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      tipoDocumentoId: "tipo-2",
    });
    expect((init.headers as Record<string, string>)["x-csrf-token"]).toBe(
      "csrf-em-memoria",
    );
  });

  it("criarSolicitacaoDocumento envia DTO mínimo com CSRF", async () => {
    fetchMock.mockResolvedValueOnce(respostaOk({ id: "s1" }));
    await criarSolicitacaoDocumento({
      empresaId: "emp-1",
      colaboradorId: "colab-1",
      tipoDocumentoId: "tipo-1",
    });
    const { url, init } = ultimaChamada();
    expect(url).toBe("/v1/solicitacoes-documento");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["x-csrf-token"]).toBe(
      "csrf-em-memoria",
    );
  });
});

describe("documentosClient — erros", () => {
  it("lança ApiError com o status, sem repassar o corpo do servidor", async () => {
    fetchMock.mockResolvedValueOnce(respostaErro(409));
    await expect(substituirDocumento("d1", "tipo-2")).rejects.toMatchObject({
      status: 409,
    });
    try {
      fetchMock.mockResolvedValueOnce(respostaErro(404));
      await detalharDocumento("x");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).message).not.toContain("detalhe interno");
    }
  });

  it("401 limpa o token CSRF em memória", async () => {
    fetchMock.mockResolvedValueOnce(respostaErro(401));
    await expect(listarDocumentos()).rejects.toBeInstanceOf(ApiError);
    // Nova mutação sem token em memória força refresh (GET /v1/auth/csrf).
    fetchMock.mockResolvedValueOnce(respostaOk({ csrfToken: "novo" })); // refreshCsrfToken
    fetchMock.mockResolvedValueOnce(respostaOk({ id: "d1" })); // POST
    await criarDocumento({
      empresaId: "e",
      colaboradorId: "c",
      tipoDocumentoId: "t",
    });
    const chamadas = fetchMock.mock.calls.map((c) => c[0] as string);
    expect(chamadas).toContain("/v1/auth/csrf");
  });
});
