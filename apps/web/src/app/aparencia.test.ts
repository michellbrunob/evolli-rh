/**
 * T210 — os quatro temas da Aparência e a aplicação no <html>.
 */
import { afterEach, describe, expect, it } from "vitest";
import { TEMAS, aplicarTema, temaDaConta } from "./aparencia";

afterEach(() => document.documentElement.removeAttribute("data-theme"));

describe("T210 — temas", () => {
  it("quatro temas fechados, o padrão primeiro", () => {
    expect(TEMAS.map((t) => [t.codigo, t.nome])).toEqual([
      ["azul_institucional", "Azul Institucional"],
      ["evolli_claro", "Evolli Claro"],
      ["verde_petroleo", "Verde Petróleo"],
      ["alto_contraste", "Alto Contraste"],
    ]);
    for (const t of TEMAS) expect(t.descricao.length).toBeGreaterThan(10);
  });

  it("valor ausente ou desconhecido vira o padrão", () => {
    expect(temaDaConta(null)).toBe("azul_institucional");
    expect(temaDaConta(undefined)).toBe("azul_institucional");
    expect(temaDaConta("roxo")).toBe("azul_institucional");
    expect(temaDaConta("evolli_claro")).toBe("evolli_claro");
  });

  it("aplicar: o padrão tira o atributo; os outros o põem", () => {
    aplicarTema("verde_petroleo");
    expect(document.documentElement.getAttribute("data-theme")).toBe(
      "verde_petroleo",
    );
    aplicarTema("azul_institucional");
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
    aplicarTema("alto_contraste");
    aplicarTema(null);
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
  });
});
