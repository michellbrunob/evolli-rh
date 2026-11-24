import { describe, expect, it } from "vitest";
import type { AlteracaoSalarialApi } from "../../../../api/salariosClient";
import {
  duracaoDoPeriodo,
  mesCurto,
  mesesEntre,
  percentualSobreAnterior,
  pontosDoGrafico,
  resumoSalarial,
  tempoCurto,
} from "./resumoSalarial";

const alt = (
  id: string,
  vigenciaInicio: string,
  salarioBruto: string,
  vigenciaFim: string | null = null,
): AlteracaoSalarialApi => ({
  id,
  origem: id === "adm" ? "admissao" : "alteracao",
  vigenciaInicio,
  vigenciaFim,
  salarioBruto,
  cargo: null,
  modeloContrato: null,
  vigente: vigenciaFim === null,
});

// Da mais nova para a mais antiga, como a API devolve.
const TRES = [
  alt("c", "2026-01-01", "3000.00"),
  alt("b", "2025-03-01", "2500.00", "2025-12-31"),
  alt("adm", "2024-01-05", "2000.00", "2025-02-28"),
];

describe("T215 — resumo salarial", () => {
  it("percentual sobre o período anterior; o primeiro não tem", () => {
    const p = percentualSobreAnterior(TRES);
    expect(p.get("adm")).toBeNull();
    expect(p.get("b")).toBeCloseTo(25, 5);
    expect(p.get("c")).toBeCloseTo(20, 5);
  });

  it("resumo com reajustes: acumulado do primeiro ao vigente, média e contagem", () => {
    const r = resumoSalarial(TRES, "2026-06-15");
    expect(r.reajustes).toBe(2);
    expect(r.aumentoAcumulado).toBeCloseTo(50, 5);
    expect(r.mediaPorReajuste).toBeCloseTo(22.5, 5);
    expect(r.mesesNoSalarioAtual).toBe(5);
  });

  it("sem reajuste: acumulado e média vazios", () => {
    const r = resumoSalarial(
      [alt("adm", "2026-11-16", "1621.00")],
      "2026-11-24",
    );
    expect(r).toEqual({
      reajustes: 0,
      aumentoAcumulado: null,
      mediaPorReajuste: null,
      mesesNoSalarioAtual: 0,
    });
  });

  it("linha do tempo vazia: tudo vazio", () => {
    expect(resumoSalarial([], "2026-11-24")).toEqual({
      reajustes: 0,
      aumentoAcumulado: null,
      mediaPorReajuste: null,
      mesesNoSalarioAtual: null,
    });
  });

  it("meses entre dois dias civis (mês incompleto não conta)", () => {
    expect(mesesEntre("2026-01-31", "2026-02-27")).toBe(0);
    expect(mesesEntre("2026-01-15", "2026-02-15")).toBe(1);
    expect(mesesEntre("2024-01-05", "2026-11-24")).toBe(34);
    expect(mesesEntre("2026-12-01", "2026-11-24")).toBe(0);
  });

  it.each([
    [0, "Menos de 1 mês"],
    [1, "1 mês"],
    [7, "7 meses"],
    [12, "1 ano"],
    [14, "1 ano e 2 meses"],
    [25, "2 anos e 1 mês"],
  ])("duração de %i meses: %s", (meses, texto) => {
    const fim = new Date(Date.UTC(2020, meses, 1)).toISOString().slice(0, 10);
    expect(duracaoDoPeriodo("2020-01-01", fim)).toBe(texto);
  });

  it.each([
    [null, "—"],
    [0, "0m"],
    [5, "5m"],
    [12, "1a"],
    [14, "1a 2m"],
  ])("tempo curto de %s meses: %s", (meses, texto) => {
    expect(tempoCurto(meses)).toBe(texto);
  });

  it("mês curto: nov/26", () => {
    expect(mesCurto("2026-11-16")).toBe("nov/26");
    expect(mesCurto("2024-01-05")).toBe("jan/24");
  });

  it("pontos do gráfico: degraus do mais antigo ao vigente, terminando hoje", () => {
    expect(pontosDoGrafico(TRES, "2026-06-15")).toEqual([
      { dia: "2024-01-05", valor: 2000 },
      { dia: "2025-03-01", valor: 2000 },
      { dia: "2025-03-01", valor: 2500 },
      { dia: "2026-01-01", valor: 2500 },
      { dia: "2026-01-01", valor: 3000 },
      { dia: "2026-06-15", valor: 3000 },
    ]);
  });
});
