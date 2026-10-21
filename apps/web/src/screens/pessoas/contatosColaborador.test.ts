import { describe, expect, it } from "vitest";
import {
  normalizarContatos,
  normalizarTelefone,
  validarContatos,
} from "./contatosColaborador";

/** T169 — a regra do cliente espelha a do servidor (ficha, §3). */
describe("contatos do colaborador — regra no cliente", () => {
  const validos = {
    emailPessoal: "ana@example.test",
    celular: "+55 (11) 98765-0001",
    telefone: "1133330001",
  };

  it("valores válidos não têm erro", () => {
    expect(validarContatos(validos)).toEqual({});
  });

  it("normaliza como o servidor: e-mail aparado e minúsculo, telefone em +55 + DDD + número", () => {
    expect(
      normalizarContatos({
        emailPessoal: "  Ana@EXAMPLE.test ",
        celular: "+55 (11) 98765-0001",
        telefone: "(11) 3333.0001",
      }),
    ).toEqual({
      emailPessoal: "ana@example.test",
      celular: "+5511987650001",
      telefone: "+551133330001",
    });
  });

  it.each([
    ["(11) 98765-4321", "+5511987654321"],
    ["11987654321", "+5511987654321"],
    ["5511987654321", "+5511987654321"],
    ["+55 11 98765-4321", "+5511987654321"],
    ["(11) 3000-0000", "+551130000000"],
    ["551130000000", "+551130000000"],
    // Com 10 ou 11 dígitos, o 55 do começo é DDD (Rio Grande do Sul).
    ["5598765432", "+555598765432"],
  ])("T179 — telefone %p vira %p", (entrada, esperado) => {
    expect(normalizarTelefone(entrada)).toBe(esperado);
  });

  it("T179 — o que não tem forma brasileira volta aparado, sem chute", () => {
    expect(normalizarTelefone(" +44 20 7946 0958 ")).toBe("+44 20 7946 0958");
    expect(normalizarTelefone("1234567")).toBe("1234567");
    expect(normalizarTelefone("119876543210")).toBe("119876543210");
  });

  it("os três são obrigatórios", () => {
    expect(
      Object.keys(
        validarContatos({ emailPessoal: " ", celular: "", telefone: "" }),
      ).sort(),
    ).toEqual(["celular", "emailPessoal", "telefone"]);
  });

  it.each(["sem-arroba", "a@b", "a b@c.test", "a@b@c.test"])(
    "e-mail %p é recusado",
    (emailPessoal) => {
      expect(validarContatos({ ...validos, emailPessoal })).toHaveProperty(
        "emailPessoal",
      );
    },
  );

  it("e-mail acima de 254 caracteres é recusado", () => {
    expect(
      validarContatos({
        ...validos,
        emailPessoal: `${"a".repeat(250)}@example.test`,
      }),
    ).toHaveProperty("emailPessoal");
  });

  it.each([
    ["1234567", /precisa do DDD e do número/],
    ["(11) 9876-543", /precisa do DDD e do número/],
    ["+1 212 555 0123", /só número brasileiro/],
    ["11 9876-ABCD", /só dígitos/],
    ["55+11987654321", /só dígitos/],
    // DDD com zero, celular sem o 9, fixo começando por 1.
    ["(10) 98765-4321", /não é um número brasileiro válido/],
    ["(11) 88765-4321", /não é um número brasileiro válido/],
    ["(11) 1000-0000", /não é um número brasileiro válido/],
  ])("telefone %p é recusado com a explicação certa", (telefone, motivo) => {
    expect(validarContatos({ ...validos, telefone }).telefone).toMatch(motivo);
  });

  it("T179 — celular de 11 dígitos e fixo de 10, com ou sem +55, são aceitos", () => {
    expect(
      validarContatos({
        ...validos,
        celular: "(21) 99999-0000",
        telefone: "+55 21 2222-0000",
      }),
    ).toEqual({});
  });
});
