/**
 * T209 — salário líquido da etapa 2 do Novo colaborador: INSS 2026
 * progressivo, pensão sobre (bruto − INSS), dependentes e IRRF com o redutor
 * de 2026. Casos conferidos à mão contra as tabelas públicas.
 */
import { describe, expect, it } from "vitest";
import {
  calcularSalarioLiquido,
  inssMensal,
  formatarReais,
  lerValorEmReais,
} from "./salarioLiquido";

describe("T209 — salário líquido", () => {
  it.each([
    [1500, 0, 0, 1387.5],
    [3000, 0, 0, 2751.4],
    [5000, 0, 0, 4498.49],
    [6000, 0, 0, 4973.39],
    [7000, 0, 0, 5463.75],
    [8000, 0, 0, 6040.64],
    [15000, 0, 0, 11067.36],
    [8000, 1, 0, 6092.77],
    [8000, 2, 0, 6144.91],
    [8000, 0, 10, 5527.44],
    [8000, 1, 10, 5579.58],
    [5000, 0, 10, 4048.64],
  ])(
    "bruto %d, %d dependente(s), pensão %d%% → %d",
    (bruto, dependentes, pensao, esperado) => {
      expect(
        calcularSalarioLiquido({
          bruto,
          dependentes,
          pensaoPercentual: pensao,
        }),
      ).toBeCloseTo(esperado, 2);
    },
  );

  it("INSS respeita o teto", () => {
    expect(inssMensal(8475.55)).toBeCloseTo(988.09, 2);
    expect(inssMensal(20000)).toBeCloseTo(988.09, 2);
  });

  it("sem bruto, não há líquido", () => {
    expect(
      calcularSalarioLiquido({ bruto: 0, dependentes: 0, pensaoPercentual: 0 }),
    ).toBeNull();
  });

  it("lê o valor digitado em reais (milhar com ponto, centavos com vírgula)", () => {
    expect(lerValorEmReais("5.000,00")).toBe(5000);
    expect(lerValorEmReais("1.234,5")).toBe(1234.5);
    expect(lerValorEmReais("")).toBeNull();
    expect(lerValorEmReais("abc")).toBeNull();
  });

  it("formata em reais sem depender da localidade", () => {
    expect(formatarReais(5000)).toBe("5.000,00");
    expect(formatarReais(1234567.8)).toBe("1.234.567,80");
    expect(formatarReais(0.5)).toBe("0,50");
  });
});
