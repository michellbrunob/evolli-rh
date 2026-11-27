import type { RegrasDoBeneficio } from "./calculo-beneficios";
import {
  colunasDaImportacao,
  conferirLinhas,
  cpfDaPlanilha,
  lerDias,
  lerNumeroBr,
} from "./importacao-beneficio";

/**
 * T215 — "Importar valores" (como a referência, 2026-11-26): a planilha
 * atualiza, por CPF, os valores do mês. Cada linha sai pronta, sem mudança
 * ou com pendência (CPF inválido, não encontrado, fora do benefício,
 * repetido; valor inválido; nada preenchido). Dados sintéticos.
 */

const REGRAS = {
  categoria: "alimentacao",
  folha: "desconto",
  tipoValor: "dia_util",
  valorMensal: null,
  valorDia: 30,
  diasModo: "uteis",
  individualModo: "livre",
  planos: [],
  faixas: [],
  colaboradorPaga: { calculo: "percentual", titular: 0, dependente: 0 },
  coparticipacao: false,
  quemPaga: { modo: "parte", calculo: "percentual", valor: 80 },
  vt: { percentualSalario: 6, empresaCusteiaTudo: false },
  antecipacao: null,
} as unknown as RegrasDoBeneficio;

describe("colunasDaImportacao", () => {
  it("por tipo de valor", () => {
    expect(colunasDaImportacao(REGRAS)).toEqual(["dias", "valorDia"]);
    expect(colunasDaImportacao({ ...REGRAS, tipoValor: "fixo" })).toEqual([
      "valorMes",
    ]);
    expect(colunasDaImportacao({ ...REGRAS, tipoValor: "individual" })).toEqual(
      ["valorMes"],
    );
    expect(
      colunasDaImportacao({
        ...REGRAS,
        tipoValor: "individual",
        individualModo: "plano",
      }),
    ).toEqual([]);
    expect(
      colunasDaImportacao({
        ...REGRAS,
        tipoValor: "faixa_etaria",
        coparticipacao: true,
      }),
    ).toEqual(["coparticipacao"]);
    expect(
      colunasDaImportacao({ ...REGRAS, tipoValor: "faixa_etaria" }),
    ).toEqual([]);
    expect(
      colunasDaImportacao({
        ...REGRAS,
        tipoValor: "antecipacao",
        antecipacao: {
          mensalidade: null,
          mensalidadeQuemPaga: "empresa",
          modo: "variavel",
          percentual: null,
          diaDesconto: null,
        },
      }),
    ).toEqual(["antecipado"]);
    expect(
      colunasDaImportacao({
        ...REGRAS,
        tipoValor: "antecipacao",
        antecipacao: {
          mensalidade: null,
          mensalidadeQuemPaga: "empresa",
          modo: "percentual",
          percentual: 10,
          diaDesconto: 5,
        },
      }),
    ).toEqual([]);
  });
});

describe("leitura das células", () => {
  it("número em reais, no jeito brasileiro ou do Excel", () => {
    expect(lerNumeroBr("1.234,56")).toBe(1234.56);
    expect(lerNumeroBr("R$ 50,00")).toBe(50);
    expect(lerNumeroBr("50")).toBe(50);
    expect(lerNumeroBr("50.5")).toBe(50.5);
    expect(lerNumeroBr("1.234")).toBe(1234);
    expect(lerNumeroBr("0")).toBe(0);
    expect(lerNumeroBr("")).toBeNull();
    expect(lerNumeroBr("  ")).toBeNull();
    expect(lerNumeroBr(null)).toBeNull();
    expect(lerNumeroBr("abc")).toBe("invalido");
    expect(lerNumeroBr("-5")).toBe("invalido");
    expect(lerNumeroBr("1,2,3")).toBe("invalido");
    // O Excel grava o número cru: 33,30 vira "33.299999999999997".
    expect(lerNumeroBr("33.299999999999997")).toBe(33.3);
    expect(lerNumeroBr("1.234.567")).toBe(1234567);
    expect(lerNumeroBr("1.2345")).toBe(1.23);
  });

  it("dias: inteiro de 0 a 31", () => {
    expect(lerDias("15")).toBe(15);
    expect(lerDias("0")).toBe(0);
    expect(lerDias("31")).toBe(31);
    expect(lerDias("")).toBeNull();
    expect(lerDias("32")).toBe("invalido");
    expect(lerDias("2,5")).toBe("invalido");
    expect(lerDias("x")).toBe("invalido");
  });

  it("CPF: só dígitos; o Excel come os zeros da frente", () => {
    expect(cpfDaPlanilha("111.444.777-35")).toBe("11144477735");
    expect(cpfDaPlanilha("1234567890")).toBe("01234567890");
    expect(cpfDaPlanilha("123")).toBe("123");
  });
});

describe("conferirLinhas", () => {
  const empresa = new Map([
    ["11144477735", { colaboradorId: "c-1", nome: "Pessoa Um" }],
    ["52998224725", { colaboradorId: "c-2", nome: "Pessoa Dois" }],
  ]);
  const doBeneficio = new Set(["c-1"]);
  const atuais = new Map([["c-1", { dias: 19, valorDia: 30 }]]);
  const conferir = (linhas: Parameters<typeof conferirLinhas>[0]["linhas"]) =>
    conferirLinhas({
      linhas,
      colunas: ["dias", "valorDia"],
      empresa,
      doBeneficio,
      atuais,
    });

  it("pronta: o que muda; sem mudança: igual ao lançado", () => {
    const [a, b] = conferir([
      { linha: 2, cpf: "111.444.777-35", valores: { dias: "15" } },
      {
        linha: 3,
        cpf: "11144477735",
        valores: { dias: "19", valorDia: "30,00" },
      },
    ]);
    expect(a).toMatchObject({
      linha: 2,
      situacao: "pronta",
      colaboradorId: "c-1",
      nome: "Pessoa Um",
      valores: { dias: 15 },
      problemas: [],
    });
    // Só o que muda vai para o lançamento (o igual não congela a escala).
    const [so] = conferir([
      { linha: 2, cpf: "11144477735", valores: { dias: "15", valorDia: "30" } },
    ]);
    expect(so!.valores).toEqual({ dias: 15 });
    expect(b!.situacao).toBe("pendencia");
    expect(b!.problemas).toEqual([{ campo: "cpf", motivo: "duplicado" }]);

    const [c] = conferir([
      { linha: 2, cpf: "11144477735", valores: { dias: "19", valorDia: "30" } },
    ]);
    expect(c!.situacao).toBe("sem_mudanca");
  });

  it("pendências de CPF", () => {
    const r = conferir([
      { linha: 2, cpf: "123", valores: { dias: "10" } },
      { linha: 3, cpf: "390.533.447-05", valores: { dias: "10" } },
      { linha: 4, cpf: "529.982.247-25", valores: { dias: "10" } },
      { linha: 5, cpf: "", valores: { dias: "10" } },
    ]);
    expect(r.map((l) => l.problemas)).toEqual([
      [{ campo: "cpf", motivo: "invalido" }],
      [{ campo: "cpf", motivo: "nao_encontrado" }],
      [{ campo: "cpf", motivo: "nao_recebe" }],
      [{ campo: "cpf", motivo: "obrigatorio" }],
    ]);
    expect(r.every((l) => l.situacao === "pendencia")).toBe(true);
    expect(r[2]!.nome).toBe("Pessoa Dois");
  });

  it("pendências de valor", () => {
    const [a] = conferir([
      { linha: 2, cpf: "11144477735", valores: { dias: "40", valorDia: "x" } },
    ]);
    expect(a!.problemas).toEqual([
      { campo: "dias", motivo: "invalido" },
      { campo: "valorDia", motivo: "invalido" },
    ]);
    const [b] = conferir([{ linha: 3, cpf: "11144477735", valores: {} }]);
    expect(b!.problemas).toEqual([{ campo: "valores", motivo: "obrigatorio" }]);
  });

  it("coluna que não vale para o benefício é ignorada", () => {
    const [a] = conferir([
      {
        linha: 2,
        cpf: "11144477735",
        valores: { dias: "12", coparticipacao: "abc" },
      },
    ]);
    expect(a!.situacao).toBe("pronta");
    expect(a!.valores).toEqual({ dias: 12 });
  });
});
