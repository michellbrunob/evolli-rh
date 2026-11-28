import { describe, expect, it } from "vitest";
import { dataDigitadaParaIso, mascararDataDigitada } from "./dataDigitada";

describe("T216 — data digitada (dd/mm/aaaa)", () => {
  it("mascara conforme a digitação e ignora o excedente", () => {
    expect(mascararDataDigitada("1")).toBe("1");
    expect(mascararDataDigitada("150")).toBe("15/0");
    expect(mascararDataDigitada("15041990")).toBe("15/04/1990");
    expect(mascararDataDigitada("15/04/19901")).toBe("15/04/1990");
  });

  it("converte só dias que existem", () => {
    expect(dataDigitadaParaIso("29/02/2024")).toBe("2024-02-29");
    expect(dataDigitadaParaIso("29/02/2023")).toBeNull();
    expect(dataDigitadaParaIso("31/04/2024")).toBeNull();
    expect(dataDigitadaParaIso("00/01/2024")).toBeNull();
    expect(dataDigitadaParaIso("01/13/2024")).toBeNull();
    expect(dataDigitadaParaIso("01/01/1899")).toBeNull();
    expect(dataDigitadaParaIso("1/1/2024")).toBeNull();
  });
});
