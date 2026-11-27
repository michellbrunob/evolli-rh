import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearCsrfToken, setCsrfToken } from "../../../api/csrfClient";
import {
  LoteDoRascunhoError,
  aplicarLoteNoRascunho,
  mensagemDoLote,
} from "./loteDoRascunho";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * T215 — lote do rascunho "tudo ou nada": envios de cem dias; se um falha no
 * meio, o que já foi gravado é desfeito e a mensagem diz o que aconteceu.
 */
describe("T215 — lote do rascunho (tudo ou nada)", () => {
  beforeEach(() => {
    clearCsrfToken();
    setCsrfToken("token");
  });
  afterEach(() => vi.restoreAllMocks());

  it("falha no meio: desfaz o que já foi gravado (cada dia volta ao rascunho que tinha) e avisa que nada mudou", async () => {
    const dias = Array.from({ length: 250 }, (_, i) => ({
      colaboradorId: `pessoa-${i}`,
      dia: "2026-11-23",
      tipo: "folga" as const,
    }));
    // O 1º dia já tinha um rascunho (DSR): volta a ele; os outros, limpos.
    const antes = {
      dia: dias[0]!.dia,
      camada: "rascunho" as const,
      tipo: "dsr" as const,
      turno: null,
      periodos: [],
      intervaloMinutos: 0,
      sobreaviso: [],
      unidade: null,
      observacao: "Troca",
    };
    let envio = 0;
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (url, init) => {
        envio += 1;
        // O 3º envio (o terceiro bloco do lote) falha.
        if (envio === 3) return jsonResponse(500, {});
        const corpo = JSON.parse(String((init as RequestInit).body)) as {
          dias: { dia: string }[];
        };
        return String(url).endsWith("limpar-lote")
          ? jsonResponse(200, { dias: corpo.dias.map(() => ({ limpo: true })) })
          : jsonResponse(200, { dias: corpo.dias });
      });
    const erro = await aplicarLoteNoRascunho(
      { gravar: dias, limpar: [] },
      new Map([[`pessoa-0|${dias[0]!.dia}`, antes]]),
    ).catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(LoteDoRascunhoError);
    expect((erro as LoteDoRascunhoError).desfeito).toBe(true);
    expect(mensagemDoLote(erro)).toBe(
      "Não foi possível gravar no rascunho. Nada mudou; tente de novo.",
    );
    // 2 blocos gravados, o 3º falhou; a volta: limpa 199 e regrava 1.
    const corpos = fetchMock.mock.calls
      .slice(3)
      .map(([url, init]) => [
        String(url),
        (JSON.parse(String((init as RequestInit).body)) as { dias: unknown[] })
          .dias,
      ]);
    expect(corpos.map(([url]) => url)).toEqual([
      "/v1/escala/dias/limpar-lote",
      "/v1/escala/dias/limpar-lote",
      "/v1/escala/dias/lote",
    ]);
    const limpos = corpos
      .filter(([url]) => String(url).endsWith("limpar-lote"))
      .flatMap(([, d]) => d as unknown[]);
    expect(limpos).toHaveLength(199);
    expect(corpos[2]![1]).toEqual([
      {
        colaboradorId: "pessoa-0",
        dia: dias[0]!.dia,
        tipo: "dsr",
        observacao: "Troca",
      },
    ]);
  });

  it("a volta também falha: o erro diz que parte ficou gravada", async () => {
    let envio = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
      envio += 1;
      if (envio >= 2) return jsonResponse(500, {});
      const corpo = JSON.parse(String((init as RequestInit).body)) as {
        dias: unknown[];
      };
      return jsonResponse(200, { dias: corpo.dias });
    });
    const dias = Array.from({ length: 150 }, (_, i) => ({
      colaboradorId: `pessoa-${i}`,
      dia: "2026-11-23",
      tipo: "folga" as const,
    }));
    const erro = await aplicarLoteNoRascunho(
      { gravar: dias, limpar: [] },
      new Map(),
    ).catch((e: unknown) => e);
    expect((erro as LoteDoRascunhoError).desfeito).toBe(false);
    expect(mensagemDoLote(erro)).toBe(
      "A gravação parou no meio e não foi possível desfazer tudo. Confira o rascunho no quadro antes de publicar.",
    );
  });

  it("falha no primeiro envio: nada foi gravado, nada a desfazer", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse(500, {}));
    const erro = await aplicarLoteNoRascunho(
      {
        gravar: [{ colaboradorId: "a", dia: "2026-11-23", tipo: "folga" }],
        limpar: [],
      },
      new Map(),
    ).catch((e: unknown) => e);
    expect((erro as LoteDoRascunhoError).desfeito).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
