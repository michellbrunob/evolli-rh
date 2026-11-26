import { conferirBeneficio, tiposDeValorDa } from "./regras-beneficio";

/**
 * T215 — conferência do benefício antes de gravar (como a referência): o tipo
 * de valor que a categoria aceita, os valores obrigatórios, o término dos
 * planos e seguros, a tabela da ANS e os limites (percentuais, VT até 6%).
 */
const BASE = {
  nome: "  VR teste ",
  categoria: "alimentacao",
  folha: "desconto",
  tipoValor: "dia_util",
  inicio: "2026-11-01",
  fim: null,
  observacao: null,
  regras: {
    valorDia: 30,
    diasModo: "uteis",
    quemPaga: { modo: "empresa_parte", calculo: "percentual", empresa: 80 },
  },
};

const conferir = (o: Record<string, unknown>) =>
  conferirBeneficio({ ...BASE, ...o } as never);

describe("T215 — conferência do benefício", () => {
  it("aceita e completa as regras com os padrões", () => {
    const r = conferir({});
    expect(r.erros).toEqual([]);
    expect(r.beneficio).toMatchObject({
      nome: "VR teste",
      regras: {
        categoria: "alimentacao",
        tipoValor: "dia_util",
        valorDia: 30,
        diasModo: "uteis",
        vt: { percentualSalario: 6, empresaCusteiaTudo: false },
      },
    });
  });

  it("tipos de valor por categoria", () => {
    expect(tiposDeValorDa("alimentacao")).toEqual([
      "fixo",
      "dia_util",
      "individual",
    ]);
    expect(tiposDeValorDa("mobilidade")).toEqual([
      "dia_util",
      "fixo",
      "individual",
    ]);
    expect(tiposDeValorDa("saude")).toEqual([
      "fixo",
      "individual",
      "faixa_etaria",
    ]);
    expect(tiposDeValorDa("seguro_vida")).toEqual(["fixo", "individual"]);
    expect(tiposDeValorDa("antecipacao")).toEqual(["antecipacao"]);
    expect(conferir({ categoria: "seguro_vida" }).erros).toContainEqual({
      campo: "tipoValor",
      motivo: "nao_se_aplica",
    });
  });

  it("nome, valor do dia e valor mensal obrigatórios", () => {
    expect(conferir({ nome: "  " }).erros).toContainEqual({
      campo: "nome",
      motivo: "obrigatorio",
    });
    expect(conferir({ regras: { valorDia: 0 } }).erros).toContainEqual({
      campo: "regras.valorDia",
      motivo: "obrigatorio",
    });
    expect(conferir({ tipoValor: "fixo", regras: {} }).erros).toContainEqual({
      campo: "regras.valorMensal",
      motivo: "obrigatorio",
    });
  });

  it("planos e seguros pedem o término; término antes do início é recusado", () => {
    expect(
      conferir({
        categoria: "saude",
        tipoValor: "fixo",
        regras: { valorMensal: 200 },
      }).erros,
    ).toContainEqual({ campo: "fim", motivo: "obrigatorio" });
    expect(conferir({ fim: "2026-10-31" }).erros).toContainEqual({
      campo: "fim",
      motivo: "fim_antes_do_inicio",
    });
  });

  it("percentuais até 100 e vale-transporte até 6% do salário", () => {
    expect(
      conferir({
        regras: {
          valorDia: 30,
          quemPaga: {
            modo: "empresa_parte",
            calculo: "percentual",
            empresa: 120,
          },
        },
      }).erros,
    ).toContainEqual({ campo: "regras.quemPaga", motivo: "invalido" });
    expect(
      conferir({
        categoria: "mobilidade",
        regras: {
          valorDia: 10,
          vt: { percentualSalario: 7, empresaCusteiaTudo: false },
        },
      }).erros,
    ).toContainEqual({ campo: "regras.vt", motivo: "invalido" });
  });

  it("faixa etária: 10 faixas dentro das regras da ANS", () => {
    const saude = (faixas: number[]) =>
      conferir({
        categoria: "saude",
        tipoValor: "faixa_etaria",
        fim: "2027-10-31",
        regras: {
          faixas,
          colaboradorPaga: {
            calculo: "percentual",
            titular: 20,
            dependente: 30,
          },
        },
      }).erros;
    expect(saude([100, 120, 140, 160, 180, 200, 230, 260, 300, 529])).toEqual(
      [],
    );
    expect(
      saude([100, 120, 140, 160, 180, 200, 230, 260, 300, 700]),
    ).toContainEqual({
      campo: "regras.faixas",
      motivo: "fora_das_regras_ans",
    });
    // Só a variação da 7ª à 10ª passa a da 1ª à 7ª (6× ok).
    expect(
      saude([100, 102, 104, 106, 108, 109, 110, 150, 180, 200]),
    ).toContainEqual({
      campo: "regras.faixas",
      motivo: "fora_das_regras_ans",
    });
    expect(saude([100, 120])).toContainEqual({
      campo: "regras.faixas",
      motivo: "obrigatorio",
    });
  });

  it("valor individual por plano pede ao menos um plano com nome", () => {
    expect(
      conferir({
        tipoValor: "individual",
        regras: { individualModo: "plano", planos: [] },
      }).erros,
    ).toContainEqual({ campo: "regras.planos", motivo: "obrigatorio" });
    const ok = conferir({
      tipoValor: "individual",
      regras: {
        individualModo: "plano",
        planos: [{ id: "p1", nome: "Básico", valor: 200 }],
      },
    });
    expect(ok.erros).toEqual([]);
  });

  it("antecipação: % do salário pede o percentual e o dia do desconto", () => {
    expect(
      conferir({
        categoria: "antecipacao",
        tipoValor: "antecipacao",
        regras: {
          antecipacao: {
            mensalidade: null,
            mensalidadeQuemPaga: "empresa",
            modo: "percentual",
            percentual: null,
            diaDesconto: null,
          },
        },
      }).erros,
    ).toContainEqual({ campo: "regras.antecipacao", motivo: "obrigatorio" });
  });

  it("adicional no salário: a empresa paga tudo", () => {
    const r = conferir({
      categoria: "trabalho_remoto",
      folha: "adicional",
      tipoValor: "fixo",
      regras: { valorMensal: 150 },
    });
    expect(r.erros).toEqual([]);
    expect(r.beneficio?.regras.quemPaga).toEqual({
      modo: "empresa_tudo",
      calculo: "percentual",
      empresa: 100,
    });
  });
});
