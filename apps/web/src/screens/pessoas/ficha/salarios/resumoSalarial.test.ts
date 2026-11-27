import { describe, expect, it } from "vitest";
import type { AlteracaoSalarialApi } from "../../../../api/salariosClient";
import {
  duracaoDoPeriodo,
  formatarPercentual,
  idsDeReajuste,
  mesCurto,
  mesesEntre,
  percentualSobreAnterior,
  pontosDoGrafico,
  resumoSalarial,
  tempoCurto,
  variacaoEmDecimos,
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
  it("percentual sobre o período anterior, em décimos de ponto; o primeiro não tem", () => {
    const p = percentualSobreAnterior(TRES);
    expect(p.get("adm")).toBeNull();
    expect(p.get("b")).toBe(250);
    expect(p.get("c")).toBe(200);
  });

  it("resumo com reajustes: acumulado do primeiro ao vigente, média e contagem", () => {
    const r = resumoSalarial(TRES, "2026-06-15");
    expect(r.reajustes).toBe(2);
    expect(r.aumentoAcumulado).toBe(500);
    expect(r.mediaPorReajuste).toBe(225);
    expect(r.mesesNoSalarioAtual).toBe(5);
  });

  it.each([
    ["2045.00", "2000.00", 23], // 2,25% → 2,3% (meio para cima)
    ["2000.00", "2045.00", -22], // -2,2004…%
    ["1955.00", "2000.00", -23], // -2,25% → -2,3% (longe do zero)
    ["3000.00", "2500.00", 200],
    ["2000.01", "2000.00", 0], // 0,0005% arredonda a zero
    ["1621.00", "1621.00", 0],
    ["9999999999.99", "0.01", 999999999998000], // sem estouro
  ])("variação de %s sobre %s: %i décimos", (novo, antigo, decimos) => {
    expect(variacaoEmDecimos(novo, antigo)).toBe(decimos);
  });

  it.each([
    [23, "+2,3%"],
    [-22, "-2,2%"],
    [200, "+20,0%"],
    [5, "+0,5%"],
    [0, "0,0%"],
  ])("percentual de %i décimos: %s", (decimos, texto) => {
    expect(formatarPercentual(decimos)).toBe(texto);
  });

  it("reajuste é só quando o salário sobe: redução e troca só de cargo são alteração", () => {
    const linhas = [
      alt("d", "2026-06-01", "2400.00"), // só troca de cargo
      alt("c", "2026-03-01", "2400.00", "2026-05-31"), // redução
      alt("b", "2025-03-01", "2500.00", "2026-02-28"), // reajuste
      alt("adm", "2024-01-05", "2000.00", "2025-02-28"),
    ];
    expect([...idsDeReajuste(linhas)]).toEqual(["b"]);
    const r = resumoSalarial(linhas, "2026-06-15");
    expect(r.reajustes).toBe(1);
    expect(r.mediaPorReajuste).toBe(250);
    expect(r.aumentoAcumulado).toBe(200);
  });

  it("só reduções: nenhum reajuste, sem média; o acumulado mostra a queda", () => {
    const r = resumoSalarial(
      [
        alt("b", "2025-03-01", "1800.00"),
        alt("adm", "2024-01-05", "2000.00", "2025-02-28"),
      ],
      "2026-06-15",
    );
    expect(r).toMatchObject({
      reajustes: 0,
      mediaPorReajuste: null,
      aumentoAcumulado: -100,
    });
  });

  it("tempo no salário atual conta o dia de hoje; admissão futura: vazio", () => {
    expect(
      resumoSalarial([alt("adm", "2025-03-01", "2000.00")], "2025-12-31")
        .mesesNoSalarioAtual,
    ).toBe(10);
    expect(
      resumoSalarial([alt("adm", "2026-12-01", "2000.00")], "2026-11-26")
        .mesesNoSalarioAtual,
    ).toBeNull();
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
    ["2025-03-01", "2025-12-31", "10 meses"],
    ["2025-01-01", "2025-12-31", "1 ano"],
    ["2024-01-05", "2025-02-28", "1 ano e 1 mês"],
    ["2026-11-16", "2026-11-24", "Menos de 1 mês"],
  ])("duração de %s até %s (inclusive): %s", (inicio, ultimoDia, texto) => {
    expect(duracaoDoPeriodo(inicio, ultimoDia)).toBe(texto);
  });

  it.each([
    [0, "Menos de 1 mês"],
    [1, "1 mês"],
    [7, "7 meses"],
    [12, "1 ano"],
    [14, "1 ano e 2 meses"],
    [25, "2 anos e 1 mês"],
  ])("duração de %i meses: %s", (meses, texto) => {
    // O último dia do período é a véspera do 1º dia do mês seguinte.
    const fim = new Date(Date.UTC(2020, meses, 0)).toISOString().slice(0, 10);
    expect(
      duracaoDoPeriodo("2020-01-01", meses === 0 ? "2020-01-20" : fim),
    ).toBe(texto);
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
