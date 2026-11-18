import { cnpjValido, normalizarCnpj } from "./cnpj";

/**
 * T209 — CNPJ da empresa: 14 posições, as 12 primeiras numéricas ou (desde
 * 2026) alfanuméricas em maiúsculas, e 2 dígitos verificadores calculados
 * pelo módulo 11, com o valor de cada caractere = código ASCII − 48.
 */
describe("T209 — CNPJ", () => {
  it.each([
    ["11.222.333/0001-81", "11222333000181"],
    ["11222333000181", "11222333000181"],
    [" 11.222.333/0001-81 ", "11222333000181"],
    ["12.abc.345/01de-35", "12ABC34501DE35"],
  ])("normaliza %p → %p", (entrada, esperado) => {
    expect(normalizarCnpj(entrada)).toBe(esperado);
  });

  it.each(["", "abc", "11.222.333/0001", "11222333000181X", "11222333#00181"])(
    "formato inválido %p → null",
    (entrada) => {
      expect(normalizarCnpj(entrada)).toBeNull();
    },
  );

  it.each(["11222333000181", "12ABC34501DE35", "00000000000191"])(
    "dígitos verificadores corretos: %p",
    (cnpj) => {
      expect(cnpjValido(cnpj)).toBe(true);
    },
  );

  it.each([
    "11222333000182",
    "12ABC34501DE36",
    // Todos iguais passam no módulo 11, mas não são CNPJ.
    "00000000000000",
    "11111111111111",
    // Letra no verificador nunca vale.
    "12ABC34501DEA5",
  ])("recusado: %p", (cnpj) => {
    expect(cnpjValido(cnpj)).toBe(false);
  });
});
