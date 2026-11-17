/**
 * T209 — CNPJ na tela: máscara progressiva 00.000.000/0000-00 (as 12
 * primeiras posições aceitam letra, formato de 2026), verificadores pelo
 * módulo 11 (caractere = ASCII − 48) e exibição.
 */
import { describe, expect, it } from "vitest";
import { cnpjValido, formatarCnpj, mascararCnpj } from "./cnpj";

describe("T209 — CNPJ na tela", () => {
  it.each([
    ["", ""],
    ["11", "11"],
    ["112", "11.2"],
    ["11222333", "11.222.333"],
    ["112223330001", "11.222.333/0001"],
    ["11222333000181", "11.222.333/0001-81"],
    ["11.222.333/0001-81", "11.222.333/0001-81"],
    ["112223330001819", "11.222.333/0001-81"],
    ["12abc34501de35", "12.ABC.345/01DE-35"],
    // Letra só nas 12 primeiras: no verificador, é descartada.
    ["12ABC34501DEX5", "12.ABC.345/01DE-5"],
    ["11 222 333 0001 81", "11.222.333/0001-81"],
  ])("máscara: %p → %p", (entrada, esperado) => {
    expect(mascararCnpj(entrada)).toBe(esperado);
  });

  it.each(["11.222.333/0001-81", "12.ABC.345/01DE-35", "00.000.000/0001-91"])(
    "válido: %p",
    (cnpj) => {
      expect(cnpjValido(cnpj)).toBe(true);
    },
  );

  it.each([
    "11.222.333/0001-82",
    "11.222.333/0001",
    "00.000.000/0000-00",
    "11.111.111/1111-11",
    "",
  ])("inválido: %p", (cnpj) => {
    expect(cnpjValido(cnpj)).toBe(false);
  });

  it("exibe o CNPJ gravado (sem máscara) com a máscara", () => {
    expect(formatarCnpj("11222333000181")).toBe("11.222.333/0001-81");
    expect(formatarCnpj("12ABC34501DE35")).toBe("12.ABC.345/01DE-35");
  });
});
