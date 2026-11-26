import { describe, expect, it } from "vitest";
import {
  formatarCentavos,
  formatarPercentual,
  formatarReaisDoCampo,
  lerReais,
} from "./moeda";
import {
  formatarCompetenciaAbreviada,
  formatarCompetenciaPorExtenso,
} from "./data";

describe("T215 — dinheiro e competência", () => {
  it("centavos → R$ com milhar e centavos", () => {
    expect(formatarCentavos(0)).toBe("R$ 0,00");
    expect(formatarCentavos(57000)).toBe("R$ 570,00");
    expect(formatarCentavos(123456789)).toBe("R$ 1.234.567,89");
    expect(formatarCentavos(-48000)).toBe("− R$ 480,00");
    expect(formatarReaisDoCampo(1621)).toBe("1.621,00");
    expect(formatarReaisDoCampo(null)).toBe("");
  });

  it("lê o campo de reais", () => {
    expect(lerReais("1.234,56")).toBe(1234.56);
    expect(lerReais("30")).toBe(30);
    expect(lerReais("R$ 30,5")).toBe(30.5);
    expect(lerReais("12.50")).toBe(12.5);
    expect(lerReais("")).toBeNull();
    expect(lerReais("abc")).toBeNull();
    expect(lerReais("1,234")).toBeNull();
  });

  it("percentual com vírgula", () => {
    expect(formatarPercentual(20)).toBe("20");
    expect(formatarPercentual(12.5)).toBe("12,5");
  });

  it("competência por extenso e abreviada", () => {
    expect(formatarCompetenciaPorExtenso("2026-11")).toBe("novembro de 2026");
    expect(formatarCompetenciaPorExtenso("2026-03", "barra")).toBe(
      "março/2026",
    );
    expect(formatarCompetenciaAbreviada("2026-11")).toBe("nov/2026");
    expect(formatarCompetenciaPorExtenso("2026-13")).toBe("—");
    expect(formatarCompetenciaAbreviada("2026-11-01")).toBe("—");
  });
});
