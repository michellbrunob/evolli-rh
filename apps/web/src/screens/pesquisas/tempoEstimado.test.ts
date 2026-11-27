import { describe, expect, it } from "vitest";
import { minutosEstimados } from "./tempoEstimado";

describe("T216 — tempo estimado (regra única)", () => {
  it("20 segundos por pergunta, arredondado, no mínimo 1 minuto", () => {
    expect(minutosEstimados(0)).toBe(1);
    expect(minutosEstimados(1)).toBe(1);
    expect(minutosEstimados(4)).toBe(1);
    expect(minutosEstimados(5)).toBe(2);
    expect(minutosEstimados(11)).toBe(4);
    expect(minutosEstimados(30)).toBe(10);
  });
});
