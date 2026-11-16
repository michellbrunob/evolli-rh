import { BadRequestException } from "@nestjs/common";
import { LIMITE_DO_VALOR, filtrarDadosDoRascunho } from "./dados-do-rascunho";

/**
 * T209 — o servidor só guarda, no rascunho da Nova admissão, os campos do
 * contrato atual da admissão. Qualquer outra coisa (CPF, foto, campo
 * desconhecido, valor que não é texto) recusa o rascunho inteiro.
 */
describe("filtrarDadosDoRascunho", () => {
  const recusa = (entrada: unknown) =>
    expect(() => filtrarDadosDoRascunho(entrada)).toThrow(BadRequestException);

  it("guarda só os grupos e campos conhecidos, sem os vazios", () => {
    expect(
      filtrarDadosDoRascunho({
        etapa: 2,
        campos: { nome: "Pessoa Sintética", tipo: "clt", matricula: "" },
        perfil: { dataNascimento: "1990-05-15", estadoCivil: "" },
        endereco: { pais: "Brasil", cep: "01001-000" },
        contatos: { emailPessoal: "pessoa@example.test" },
        referencias: {
          departamento: {
            id: "11111111-1111-4111-8111-111111111111",
            codigo: "ADM",
            nome: "Administrativo",
          },
        },
      }),
    ).toEqual({
      etapa: 2,
      campos: { nome: "Pessoa Sintética", tipo: "clt" },
      perfil: { dataNascimento: "1990-05-15" },
      endereco: { pais: "Brasil", cep: "01001-000" },
      contatos: { emailPessoal: "pessoa@example.test" },
      referencias: {
        departamento: {
          id: "11111111-1111-4111-8111-111111111111",
          codigo: "ADM",
          nome: "Administrativo",
        },
      },
    });
  });

  it("rascunho vazio vale (só a etapa)", () => {
    expect(filtrarDadosDoRascunho({ etapa: 0 })).toEqual({ etapa: 0 });
  });

  it.each([
    ["grupo desconhecido", { documentos: { cpf: "000" } }],
    ["campo desconhecido num grupo", { perfil: { cpf: "000" } }],
    ["foto no rascunho", { campos: { foto: "data:image/png;base64,AAAA" } }],
    ["valor que não é texto", { campos: { nome: 42 } }],
    ["objeto aninhado como valor", { campos: { nome: { a: 1 } } }],
    ["etapa fora de 0 a 3", { etapa: 4 }],
    ["etapa não inteira", { etapa: 1.5 }],
    ["caractere de controle", { campos: { nome: "Pessoa\u0007" } }],
    [
      "texto longo demais",
      { campos: { nome: "a".repeat(LIMITE_DO_VALOR + 1) } },
    ],
    [
      "referência sem id válido",
      { referencias: { cargo: { id: "x", codigo: "C", nome: "C" } } },
    ],
    [
      "referência desconhecida",
      {
        referencias: {
          empresa: {
            id: "11111111-1111-4111-8111-111111111111",
            codigo: "E",
            nome: "E",
          },
        },
      },
    ],
    ["corpo que não é objeto", ["lista"]],
    ["nulo", null],
  ])("recusa %s", (_caso, entrada) => {
    recusa(entrada);
  });

  it("a mensagem de recusa nunca repete o valor", () => {
    try {
      filtrarDadosDoRascunho({ perfil: { cpf: "123.456.789-00" } });
      throw new Error("deveria recusar");
    } catch (erro) {
      expect(
        JSON.stringify((erro as BadRequestException).getResponse()),
      ).not.toContain("123.456");
    }
  });
});
