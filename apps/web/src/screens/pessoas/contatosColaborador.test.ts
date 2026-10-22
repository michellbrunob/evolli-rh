import { describe, expect, it } from "vitest";
import {
  contatosDaAdmissao,
  contatosParaEdicao,
  contatosParaRegistro,
  contatosVazios,
  normalizarContatos,
  normalizarTelefone,
  telefonesLegados,
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

  it("T179 — os três são opcionais: vazios não têm erro", () => {
    expect(
      validarContatos({ emailPessoal: " ", celular: "", telefone: "" }),
    ).toEqual({});
  });

  it("T179 — um só preenchido é válido, e o formato dele ainda é conferido", () => {
    expect(
      validarContatos({
        emailPessoal: "",
        celular: "",
        telefone: "1133330001",
      }),
    ).toEqual({});
    expect(
      Object.keys(
        validarContatos({
          emailPessoal: "sem-arroba",
          celular: "",
          telefone: "",
        }),
      ),
    ).toEqual(["emailPessoal"]);
    expect(
      Object.keys(
        validarContatos({ emailPessoal: "", celular: "11 9876", telefone: "" }),
      ),
    ).toEqual(["celular"]);
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

/** T179 — contatos opcionais: o que vai no corpo de cada rota. */
describe("contatos do colaborador — corpo enviado (T179)", () => {
  it("admissão: bloco some quando os três estão vazios", () => {
    expect(
      contatosDaAdmissao({ emailPessoal: " ", celular: "", telefone: "" }),
    ).toBeUndefined();
  });

  it("admissão: só os preenchidos, normalizados", () => {
    expect(
      contatosDaAdmissao({
        emailPessoal: "",
        celular: "(11) 98765-0001",
        telefone: "",
      }),
    ).toEqual({ celular: "+5511987650001" });
    expect(
      contatosDaAdmissao({
        emailPessoal: " Ana@EXAMPLE.test ",
        celular: "",
        telefone: "(11) 3333-0001",
      }),
    ).toEqual({ emailPessoal: "ana@example.test", telefone: "+551133330001" });
  });

  it("ficha: os três sempre, vazio como null", () => {
    expect(
      contatosParaRegistro({
        emailPessoal: "",
        celular: "(11) 98765-0001",
        telefone: " ",
      }),
    ).toEqual({
      emailPessoal: null,
      celular: "+5511987650001",
      telefone: null,
    });
  });

  it("gravado nulo vira campo vazio na edição", () => {
    expect(
      contatosParaEdicao({
        emailPessoal: null,
        celular: "+5511987650001",
        telefone: null,
      }),
    ).toEqual({ emailPessoal: "", celular: "(11) 98765-0001", telefone: "" });
  });

  it("contatosVazios só com os três em branco", () => {
    expect(
      contatosVazios({ emailPessoal: " ", celular: "", telefone: "" }),
    ).toBe(true);
    expect(
      contatosVazios({ emailPessoal: "", celular: "", telefone: "1133330001" }),
    ).toBe(false);
  });
});

/** T179 (revisão final) — telefone legado: intacto, nem validado nem enviado. */
describe("contatos do colaborador — telefone legado", () => {
  const gravado = {
    emailPessoal: "ana@example.test",
    celular: "55919876543210",
    telefone: "+551133330001",
  };
  const legados = telefonesLegados(gravado);
  const edicao = contatosParaEdicao(gravado);

  it("só o gravado fora da forma atual é legado, e aparece como veio", () => {
    expect(legados).toEqual({ celular: "55919876543210" });
    expect(telefonesLegados(null)).toEqual({});
    expect(
      telefonesLegados({ ...gravado, celular: null, telefone: "119876543210" }),
    ).toEqual({ telefone: "119876543210" });
    expect(edicao.celular).toBe("55919876543210");
    expect(edicao.telefone).toBe("(11) 3333-0001");
  });

  it("intacto: sem erro e FORA do corpo do PUT", () => {
    expect(validarContatos(edicao, legados)).toEqual({});
    expect(contatosParaRegistro(edicao, legados)).toEqual({
      emailPessoal: "ana@example.test",
      telefone: "+551133330001",
    });
  });

  it("alterado: validado e enviado como os demais", () => {
    expect(
      validarContatos({ ...edicao, celular: "5919876543210" }, legados).celular,
    ).toMatch(/precisa do DDD e do número/);
    expect(
      contatosParaRegistro({ ...edicao, celular: "(11) 98765-0002" }, legados),
    ).toEqual({
      emailPessoal: "ana@example.test",
      celular: "+5511987650002",
      telefone: "+551133330001",
    });
    expect(contatosParaRegistro({ ...edicao, celular: "" }, legados)).toEqual({
      emailPessoal: "ana@example.test",
      celular: null,
      telefone: "+551133330001",
    });
  });

  it("normalizar nunca corta um legado para 11 dígitos", () => {
    for (const bruto of ["+55119876543210", "55919876543210", "119876543210"]) {
      expect(normalizarTelefone(bruto)).toBe(bruto);
      expect(
        validarContatos({ ...edicao, celular: bruto }).celular,
      ).toBeTruthy();
    }
  });
});
