/**
 * T215 — Dados profissionais do "Editar colaborador": o corpo do `PUT` do
 * contrato, a validação antes de enviar e as recusas do servidor na voz da
 * tela. Dados sintéticos.
 */
import { describe, expect, it } from "vitest";
import {
  type ValoresProfissionais,
  dtoDoContrato,
  errosDaRecusaDoContrato,
  validarProfissionais,
} from "./dadosProfissionais";

const VALORES: ValoresProfissionais = {
  nivel: "pleno",
  gestorDiretoId: "",
  jornadaSemanalHoras: "44",
  escala: "5x2",
  matricula: "MAT-0042",
  salarioBruto: "5.000,00",
  conselhoProfissional: "",
  registroProfissional: "",
  dependentesIrrf: "",
  pensaoAlimenticiaPercentual: "",
};

describe("T215 — corpo do contrato", () => {
  it("não leva o salário: ele muda pela aba Salários, com data", () => {
    const dto = dtoDoContrato({ ...VALORES, salarioBruto: "9.999,00" });
    expect("salarioBruto" in dto).toBe(false);
    expect(dto).toMatchObject({ nivel: "pleno", matricula: "MAT-0042" });
  });

  it("matrícula vai em maiúsculas, sem espaços nas pontas", () => {
    expect(dtoDoContrato({ ...VALORES, matricula: " mat-7 " }).matricula).toBe(
      "MAT-7",
    );
  });
});

describe("T215 — matrícula com a regra da API", () => {
  it.each(["AB", "MAT-0042", "0042", "A_B-9", "A".repeat(32), "mat-7"])(
    "%s é aceita",
    (matricula) => {
      expect(validarProfissionais({ ...VALORES, matricula }).matricula).toBe(
        undefined,
      );
    },
  );

  it.each(["A", "A".repeat(33), "MAT 42", "MAT.42", "JOSÉ", "MAT/1"])(
    "%s é recusada com mensagem no campo",
    (matricula) => {
      expect(validarProfissionais({ ...VALORES, matricula }).matricula).toBe(
        "Use de 2 a 32 caracteres: letras sem acento, números, hífen ou sublinhado.",
      );
    },
  );

  it("vazia é aceita (apaga a matrícula)", () => {
    expect(
      validarProfissionais({ ...VALORES, matricula: "  " }).matricula,
    ).toBe(undefined);
  });
});

describe("T215 — recusas do servidor no campo", () => {
  it.each([
    [
      "nao_se_aplica",
      "O salário mudou na aba Salários depois que esta página abriu. Recarregue para ver o valor atual.",
    ],
    [
      "obrigatorio",
      "O salário não pode ficar vazio. Para mudar, registre uma alteração na aba Salários.",
    ],
    ["invalido", "Confira o salário na aba Salários."],
  ])("salário %s: %s", (motivo, texto) => {
    expect(
      errosDaRecusaDoContrato([{ campo: "salarioBruto", motivo }]).salarioBruto,
    ).toBe(texto);
  });

  it("matrícula em uso e gestor indisponível continuam com mensagem", () => {
    expect(
      errosDaRecusaDoContrato([
        { campo: "matricula", motivo: "em_uso" },
        { campo: "gestorDiretoId", motivo: "indisponivel" },
      ]),
    ).toEqual({
      matricula: "Esta matrícula já é usada por outra pessoa da empresa.",
      gestorDiretoId: "Escolha outra pessoa como gestor direto.",
    });
  });
});
