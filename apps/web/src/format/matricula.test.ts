/**
 * T179 — matrícula opcional: `null` (ou vazia) nunca aparece como "null".
 */
import { describe, expect, it } from "vitest";
import { SEM_MATRICULA, exibirMatricula, trechoDeMatricula } from "./matricula";

describe("exibirMatricula", () => {
  it("mostra a matrícula informada", () => {
    expect(exibirMatricula("MAT-0001")).toBe("MAT-0001");
  });

  it.each([[null], [undefined], [""], ["   "]])(
    "sem matrícula (%j) vira 'Sem matrícula'",
    (valor) => {
      expect(exibirMatricula(valor)).toBe(SEM_MATRICULA);
      expect(exibirMatricula(valor)).toBe("Sem matrícula");
    },
  );
});

describe("trechoDeMatricula", () => {
  it("no meio da frase: 'matrícula X' ou 'sem matrícula'", () => {
    expect(trechoDeMatricula("MAT-0001")).toBe("matrícula MAT-0001");
    expect(trechoDeMatricula(null)).toBe("sem matrícula");
    expect(trechoDeMatricula("")).toBe("sem matrícula");
  });
});
