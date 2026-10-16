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

  it("normaliza como o servidor: e-mail aparado e minúsculo, telefone só com dígitos", () => {
    expect(
      normalizarContatos({
        emailPessoal: "  Ana@EXAMPLE.test ",
        celular: "+55 (11) 98765-0001",
        telefone: "(11) 3333.0001",
      }),
    ).toEqual({
      emailPessoal: "ana@example.test",
      celular: "+5511987650001",
      telefone: "1133330001",
    });
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
    ["1234567", /8 a 15 dígitos/],
    ["+1234567890123456", /8 a 15 dígitos/],
    ["11 9876-ABCD", /só dígitos/],
    ["55+11987654321", /só dígitos/],
  ])("telefone %p é recusado com a explicação certa", (telefone, motivo) => {
    expect(validarContatos({ ...validos, telefone }).telefone).toMatch(motivo);
  });

  it("8 e 15 dígitos são os limites aceitos, sem presumir país", () => {
    expect(
      validarContatos({
        ...validos,
        celular: "12345678",
        telefone: "+123456789012345",
      }),
    ).toEqual({});
    expect(normalizarTelefone("+44 20.7946.0958")).toBe("+442079460958");
  });
});
