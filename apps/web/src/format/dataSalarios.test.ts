import { describe, expect, it } from "vitest";
import { diaCivilDeHoje, formatarMesAbreviado } from "./data";

describe("T215 — datas da aba Salários", () => {
  it("dia civil de hoje no fuso de negócio (São Paulo)", () => {
    // 02:30 UTC de 24/11 ainda é 23/11 em São Paulo (UTC-3).
    expect(diaCivilDeHoje(new Date("2026-11-24T02:30:00Z"))).toBe("2026-11-23");
    expect(diaCivilDeHoje(new Date("2026-11-24T15:00:00Z"))).toBe("2026-11-24");
  });

  it("mês abreviado com ano em dois dígitos; data inválida vira traço", () => {
    expect(formatarMesAbreviado("2026-11-16")).toBe("nov/26");
    expect(formatarMesAbreviado("2024-01-05")).toBe("jan/24");
    expect(formatarMesAbreviado("2026-02-30")).toBe("—");
    expect(formatarMesAbreviado(null)).toBe("—");
  });
});
