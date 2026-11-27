import { describe, expect, it } from "vitest";
import { fichaDaRota, rotaDaFicha } from "./rotasDoShell";

/**
 * T216 — ficha › Pesquisas: abrir uma resposta muda a URL
 * (`…/:id/pesquisas/:pesquisaId`); recarregar reabre a mesma resposta.
 */
const ID = "8f0c2a4e-1b2c-4d3e-8f4a-5b6c7d8e9f01";
const PESQUISA = "1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f";
const BASE = `#/pessoas/colaboradores/${ID}`;

describe("T216 — a pesquisa aberta na ficha vai à URL", () => {
  it("de ida e volta", () => {
    const rota = `${BASE}/pesquisas/${PESQUISA}`;
    expect(fichaDaRota(rota)).toEqual({
      colaboradorId: ID,
      aba: "pesquisas",
      pesquisa: PESQUISA,
    });
    expect(
      rotaDaFicha({ colaboradorId: ID, aba: "pesquisas", pesquisa: PESQUISA }),
    ).toBe(rota);
  });

  it("id fora do formato ou em outra aba não é rota", () => {
    expect(fichaDaRota(`${BASE}/pesquisas/nao-e-id`)).toBeNull();
    expect(fichaDaRota(`${BASE}/salarios/${PESQUISA}`)).toBeNull();
  });

  it("fora da aba Pesquisas, a pesquisa não vai à URL", () => {
    expect(
      rotaDaFicha({ colaboradorId: ID, aba: "dados", pesquisa: PESQUISA }),
    ).toBe(`${BASE}/dados`);
  });
});
