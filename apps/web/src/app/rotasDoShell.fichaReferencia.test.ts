import { describe, expect, it } from "vitest";
import { ABAS_DA_FICHA, fichaDaRota, rotaDaFicha } from "./rotasDoShell";

/**
 * T215 — a ficha no desenho da referência: as nove abas na URL. As abas que
 * saíram da ficha (decisão de 2026-11-23) levam a Dados; "jornada" vira
 * Escala. Endereços salvos não quebram.
 */
const ID = "8f0c2a4e-1b2c-4d3e-8f4a-5b6c7d8e9f01";
const BASE = `#/pessoas/colaboradores/${ID}`;

describe("T215 — abas da ficha na URL", () => {
  it("as nove abas, na ordem da referência", () => {
    expect(ABAS_DA_FICHA).toEqual([
      "dados",
      "salarios",
      "ferias",
      "escala",
      "beneficios",
      "pesquisas",
      "documentos",
      "desenvolvimento",
      "comentarios",
    ]);
  });

  it.each(ABAS_DA_FICHA)("%s, de ida e volta", (aba) => {
    const rota = `${BASE}/${aba}`;
    expect(fichaDaRota(rota)).toEqual({ colaboradorId: ID, aba });
    expect(rotaDaFicha({ colaboradorId: ID, aba })).toBe(rota);
  });

  it.each([
    ["vida-funcional", "dados"],
    ["contratuais", "dados"],
    ["ponto", "dados"],
    ["ponto/2026-11", "dados"],
    ["solicitacoes", "dados"],
    ["jornada", "escala"],
  ])("endereço antigo …/%s abre %s", (antigo, aba) => {
    expect(fichaDaRota(`${BASE}/${antigo}`)).toEqual({
      colaboradorId: ID,
      aba,
    });
  });

  it("sem aba, Dados; aba desconhecida não é rota", () => {
    expect(fichaDaRota(BASE)).toEqual({ colaboradorId: ID, aba: "dados" });
    expect(fichaDaRota(`${BASE}/salario`)).toBeNull();
  });
});
