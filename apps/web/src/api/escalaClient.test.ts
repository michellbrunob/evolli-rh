import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearCsrfToken, setCsrfToken } from "./csrfClient";
import {
  criarVisao,
  gravarDias,
  limparDias,
  publicarEscala,
  removerVisao,
  renomearVisao,
} from "./escalaClient";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const PESSOA = "11111111-1111-4111-8111-111111111111";

describe("T215 — cliente das visões salvas", () => {
  beforeEach(() => {
    clearCsrfToken();
    setCsrfToken("token");
  });
  afterEach(() => vi.restoreAllMocks());

  it("cria, renomeia e remove com CSRF; o erro por campo chega ao chamador", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(201, { visoes: [] }))
      .mockResolvedValueOnce(jsonResponse(200, { visoes: [] }))
      .mockResolvedValueOnce(jsonResponse(200, { visoes: [] }))
      .mockResolvedValueOnce(
        jsonResponse(409, { erros: [{ campo: "nome", motivo: "em_uso" }] }),
      );
    const filtros = {
      comAviso: true,
      semEscala: false,
      mudancas: false,
      unidades: [],
      departamentos: [],
      tipos: [],
      turnos: [],
      gestores: [],
      cargos: [],
      areas: [],
      centrosCusto: [],
      niveis: [],
      generos: [],
    };
    await criarVisao({ nome: "Com aviso", filtros });
    await renomearVisao("v/1", "Outro");
    await removerVisao("v1");
    const chamadas = fetchMock.mock.calls.map(([url, init]) => [
      url,
      (init as RequestInit).method,
      ((init as RequestInit).headers as Record<string, string>)["x-csrf-token"],
      (init as RequestInit).body ?? null,
    ]);
    expect(chamadas).toEqual([
      [
        "/v1/escala/visoes",
        "POST",
        "token",
        JSON.stringify({ nome: "Com aviso", filtros }),
      ],
      [
        "/v1/escala/visoes/v%2F1",
        "PATCH",
        "token",
        JSON.stringify({ nome: "Outro" }),
      ],
      ["/v1/escala/visoes/v1", "DELETE", "token", null],
    ]);
    await expect(criarVisao({ nome: "X", filtros })).rejects.toMatchObject({
      status: 409,
    });
  });
});

describe("T215 — cliente do quadro da escala (lote e publicar)", () => {
  beforeEach(() => {
    clearCsrfToken();
    setCsrfToken("token");
  });
  afterEach(() => vi.restoreAllMocks());

  it("grava em blocos de 100 dias (limite do corpo do servidor), com CSRF", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (_url, init) => {
        const corpo = JSON.parse(String((init as RequestInit).body)) as {
          dias: { dia: string }[];
        };
        return jsonResponse(200, {
          dias: corpo.dias.map((d) => ({ ...d, colaboradorId: PESSOA })),
        });
      });
    const dias = Array.from({ length: 250 }, (_, i) => ({
      colaboradorId: PESSOA,
      dia: `2026-11-${String((i % 28) + 1).padStart(2, "0")}`,
      tipo: "folga" as const,
    }));
    const r = await gravarDias(dias);
    expect(r).toHaveLength(250);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const tamanhos = fetchMock.mock.calls.map(
      ([, init]) =>
        (JSON.parse(String((init as RequestInit).body)) as { dias: unknown[] })
          .dias.length,
    );
    expect(tamanhos).toEqual([100, 100, 50]);
    const [url, init] = fetchMock.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe("/v1/escala/dias/lote");
    expect(init.method).toBe("PUT");
    expect(init.headers).toMatchObject({ "x-csrf-token": "token" });
  });

  it("limpa em blocos e soma os que tinham rascunho", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (_url, init) => {
        const corpo = JSON.parse(String((init as RequestInit).body)) as {
          dias: unknown[];
        };
        return jsonResponse(200, {
          dias: corpo.dias.map((_, i) => ({ limpo: i % 2 === 0 })),
        });
      });
    const n = await limparDias(
      Array.from({ length: 120 }, () => ({
        colaboradorId: PESSOA,
        dia: "2026-11-23",
      })),
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]![0]).toBe("/v1/escala/dias/limpar-lote");
    expect(n).toBe(60);
  });

  it("nada a gravar ou limpar: nenhuma chamada", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    expect(await gravarDias([])).toEqual([]);
    expect(await limparDias([])).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("publicar manda o período e o aviso", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse(200, { id: "p" }));
    await publicarEscala("2026-11-23", "2026-11-29", true);
    const [url, init] = fetchMock.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe("/v1/escala/publicar");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({
      inicio: "2026-11-23",
      fim: "2026-11-29",
      avisar: true,
    });
  });
});
