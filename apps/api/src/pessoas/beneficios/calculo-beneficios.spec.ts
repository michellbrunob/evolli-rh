import {
  type PessoaDoCalculo,
  type RegrasDoBeneficio,
  calcularPessoa,
  faixaDaIdade,
  idadeNaCompetencia,
  limitePat,
  regrasAns,
} from "./calculo-beneficios";

/**
 * T215 — Benefícios (como a referência, 2026-11-26): o valor de cada pessoa
 * no mês, a parte da empresa e o desconto no holerite, por tipo de valor e
 * pelas regras da lei (PAT, vale-transporte, ANS, estágio). Centavos inteiros.
 */

const PESSOA: PessoaDoCalculo = {
  tipoVinculo: "clt",
  salarioBase: 3200,
  nascimento: "1990-03-15",
  dependentes: [],
  dias: { uteis: 19, escala: 22, origemEscala: "escala" },
  planoId: null,
  valorIndividual: null,
  ajuste: null,
};

const BASE: RegrasDoBeneficio = {
  categoria: "alimentacao",
  folha: "desconto",
  tipoValor: "fixo",
  valorMensal: 600,
  valorDia: null,
  diasModo: "uteis",
  individualModo: "livre",
  planos: [],
  faixas: [],
  colaboradorPaga: { calculo: "percentual", titular: 0, dependente: 0 },
  coparticipacao: false,
  quemPaga: { modo: "empresa_parte", calculo: "percentual", empresa: 80 },
  vt: { percentualSalario: 6, empresaCusteiaTudo: false },
  antecipacao: null,
};

const calc = (
  r: Partial<RegrasDoBeneficio>,
  p: Partial<PessoaDoCalculo> = {},
  competencia = "2026-11",
) => calcularPessoa({ ...BASE, ...r }, { ...PESSOA, ...p }, competencia);

describe("T215 — cálculo dos benefícios: valor fixo e quem paga", () => {
  it("fixo, empresa paga 80%: 600 → empresa 480, desconto 120", () => {
    expect(calc({})).toMatchObject({
      valor: 60000,
      empresa: 48000,
      desconto: 12000,
      adicional: 0,
      pendencia: null,
    });
  });

  it("fixo: o valor digitado no mês (importado) vale por cima da regra", () => {
    expect(calc({}, { ajuste: { valorMes: 500 } })).toMatchObject({
      valor: 50000,
      empresa: 40000,
      desconto: 10000,
    });
  });

  it("empresa paga R$ por mês (limitado ao valor) e colaborador paga tudo", () => {
    expect(
      calc({
        quemPaga: { modo: "empresa_parte", calculo: "valor", empresa: 450 },
      }),
    ).toMatchObject({ empresa: 45000, desconto: 15000 });
    expect(
      calc({
        quemPaga: { modo: "empresa_parte", calculo: "valor", empresa: 900 },
      }),
    ).toMatchObject({ empresa: 60000, desconto: 0 });
    expect(
      calc({
        quemPaga: {
          modo: "colaborador_tudo",
          calculo: "percentual",
          empresa: 0,
        },
      }),
    ).toMatchObject({ empresa: 0, desconto: 60000 });
  });

  it("arredonda centavos (meio para cima)", () => {
    expect(
      calc({
        valorMensal: 100.05,
        quemPaga: { modo: "empresa_parte", calculo: "percentual", empresa: 50 },
      }),
    ).toMatchObject({ valor: 10005, empresa: 5003, desconto: 5002 });
  });

  it("adicional no salário: a empresa paga tudo, junto com o salário", () => {
    expect(
      calc({ folha: "adicional", categoria: "trabalho_remoto" }),
    ).toMatchObject({
      valor: 60000,
      empresa: 60000,
      desconto: 0,
      adicional: 60000,
    });
  });

  it("não entra na folha: nada é descontado; a parte do colaborador é só registrada", () => {
    expect(
      calc({ folha: "fora_da_folha", categoria: "seguro_vida" }),
    ).toMatchObject({
      empresa: 48000,
      desconto: 0,
      parteColaborador: 12000,
    });
  });

  it("estágio: sem desconto (Lei 11.788); a empresa paga tudo", () => {
    expect(calc({}, { tipoVinculo: "estagio" })).toMatchObject({
      empresa: 60000,
      desconto: 0,
      observacao: "estagio_sem_desconto",
    });
  });
});

describe("T215 — cálculo dos benefícios: por dia útil", () => {
  it("dias úteis do mês × valor do dia; empresa 80%", () => {
    expect(
      calc({ tipoValor: "dia_util", valorDia: 30, diasModo: "uteis" }),
    ).toMatchObject({
      dias: 19,
      origemDias: "uteis",
      valorDia: 3000,
      valor: 57000,
      empresa: 45600,
      desconto: 11400,
    });
  });

  it("pela escala de cada pessoa (e a origem dos dias)", () => {
    expect(
      calc({ tipoValor: "dia_util", valorDia: 30, diasModo: "escala" }),
    ).toMatchObject({ dias: 22, origemDias: "escala", valor: 66000 });
    expect(
      calc(
        { tipoValor: "dia_util", valorDia: 30, diasModo: "escala" },
        { dias: { uteis: 19, escala: 26, origemEscala: "catalogo" } },
      ),
    ).toMatchObject({ dias: 26, origemDias: "catalogo" });
  });

  it("dias e valor do dia digitados no mês valem por cima", () => {
    expect(
      calc(
        { tipoValor: "dia_util", valorDia: 30 },
        { ajuste: { dias: 15, valorDia: 25 } },
      ),
    ).toMatchObject({
      dias: 15,
      origemDias: "digitado",
      valorDia: 2500,
      valor: 37500,
    });
  });

  it("empresa paga R$ por dia (limitado ao valor)", () => {
    expect(
      calc({
        tipoValor: "dia_util",
        valorDia: 30,
        quemPaga: { modo: "empresa_parte", calculo: "valor", empresa: 24 },
      }),
    ).toMatchObject({ valor: 57000, empresa: 45600, desconto: 11400 });
  });
});

describe("T215 — cálculo dos benefícios: vale-transporte (Lei 7.418/85)", () => {
  const vt = (
    p: Partial<PessoaDoCalculo>,
    r: Partial<RegrasDoBeneficio> = {},
  ) =>
    calc(
      {
        categoria: "mobilidade",
        tipoValor: "dia_util",
        valorDia: 10,
        diasModo: "uteis",
        ...r,
      },
      { dias: { uteis: 22, escala: 22, origemEscala: "escala" }, ...p },
    );

  it("até 6% do salário base, nunca maior que o próprio VT", () => {
    expect(vt({ salarioBase: 1621 })).toMatchObject({
      valor: 22000,
      desconto: 9726,
      empresa: 12274,
    });
    expect(vt({ salarioBase: 3200 })).toMatchObject({ desconto: 19200 });
    expect(vt({ salarioBase: 6500 })).toMatchObject({
      desconto: 22000,
      empresa: 0,
      observacao: "limitado_ao_vt",
    });
  });

  it("percentual menor (convenção) e empresa custeia 100%", () => {
    expect(
      vt(
        { salarioBase: 3200 },
        { vt: { percentualSalario: 4, empresaCusteiaTudo: false } },
      ),
    ).toMatchObject({ desconto: 12800 });
    expect(
      vt(
        { salarioBase: 3200 },
        { vt: { percentualSalario: 6, empresaCusteiaTudo: true } },
      ),
    ).toMatchObject({ desconto: 0, empresa: 22000 });
  });

  it("estágio sem desconto; sem salário fica pendente e não desconta", () => {
    expect(vt({ tipoVinculo: "estagio" })).toMatchObject({
      desconto: 0,
      observacao: "estagio_sem_desconto",
    });
    expect(vt({ salarioBase: null })).toMatchObject({
      desconto: 0,
      pendencia: "sem_salario",
    });
  });
});

describe("T215 — cálculo dos benefícios: valor individual", () => {
  it("por plano: o valor do plano da pessoa; sem plano, pendente", () => {
    const r: Partial<RegrasDoBeneficio> = {
      tipoValor: "individual",
      individualModo: "plano",
      planos: [
        { id: "p1", nome: "Básico", valor: 200 },
        { id: "p2", nome: "Top", valor: 500 },
      ],
    };
    expect(calc(r, { planoId: "p2" })).toMatchObject({
      valor: 50000,
      empresa: 40000,
    });
    expect(calc(r, { planoId: null })).toMatchObject({
      valor: 0,
      pendencia: "sem_plano",
    });
  });

  it("valor livre: o da pessoa, ou o digitado no mês; sem valor, pendente", () => {
    const r: Partial<RegrasDoBeneficio> = {
      tipoValor: "individual",
      individualModo: "livre",
    };
    expect(calc(r, { valorIndividual: 300 })).toMatchObject({ valor: 30000 });
    expect(
      calc(r, { valorIndividual: 300, ajuste: { valorMes: 150 } }),
    ).toMatchObject({
      valor: 15000,
    });
    expect(calc(r, {})).toMatchObject({ valor: 0, pendencia: "sem_valor" });
  });
});

describe("T215 — cálculo dos benefícios: faixa etária (ANS)", () => {
  const FAIXAS = [100, 120, 140, 160, 180, 200, 230, 260, 300, 529];
  const saude = (
    p: Partial<PessoaDoCalculo>,
    r: Partial<RegrasDoBeneficio> = {},
  ) =>
    calc(
      {
        categoria: "saude",
        tipoValor: "faixa_etaria",
        faixas: FAIXAS,
        colaboradorPaga: { calculo: "percentual", titular: 20, dependente: 30 },
        ...r,
      },
      p,
    );

  it("titular pela faixa da idade; empresa paga o resto", () => {
    expect(saude({})).toMatchObject({
      faixa: "34 a 38",
      valor: 18000,
      desconto: 3600,
      empresa: 14400,
      dependentesNoPlano: 0,
    });
  });

  it("dependentes no plano somam a mensalidade e o desconto de cada um", () => {
    expect(
      saude({ dependentes: [{ nascimento: "2018-05-10" }] }),
    ).toMatchObject({
      valor: 28000,
      desconto: 6600,
      empresa: 21400,
      dependentesNoPlano: 1,
    });
  });

  it("colaborador paga R$ fixo por titular e por dependente", () => {
    expect(
      saude(
        { dependentes: [{ nascimento: "2018-05-10" }] },
        { colaboradorPaga: { calculo: "valor", titular: 50, dependente: 40 } },
      ),
    ).toMatchObject({ desconto: 9000, empresa: 19000 });
  });

  it("coparticipação do mês soma ao valor e ao desconto", () => {
    expect(
      saude({ ajuste: { coparticipacao: 35.5 } }, { coparticipacao: true }),
    ).toMatchObject({ valor: 21550, desconto: 7150, empresa: 14400 });
  });

  it("sem data de nascimento: pendente, nada calculado", () => {
    expect(saude({ nascimento: null })).toMatchObject({
      valor: 0,
      empresa: 0,
      desconto: 0,
      faixa: null,
      pendencia: "sem_nascimento",
    });
  });

  it("muda de faixa no mês seguinte ao aniversário", () => {
    // Faz 19 anos em 10/11/2026: em novembro ainda é 0 a 18; em dezembro, 19 a 23.
    expect(idadeNaCompetencia("2007-11-10", "2026-11")).toBe(18);
    expect(idadeNaCompetencia("2007-11-10", "2026-12")).toBe(19);
    expect(idadeNaCompetencia("2007-10-31", "2026-11")).toBe(19);
    // Aniversário no dia 1º: muda só no mês seguinte.
    expect(idadeNaCompetencia("2007-11-01", "2026-11")).toBe(18);
    expect(idadeNaCompetencia("2007-11-01", "2026-12")).toBe(19);
    expect(faixaDaIdade(18)).toEqual({ indice: 0, rotulo: "0 a 18" });
    expect(faixaDaIdade(19)).toEqual({ indice: 1, rotulo: "19 a 23" });
    expect(faixaDaIdade(58)).toEqual({ indice: 8, rotulo: "54 a 58" });
    expect(faixaDaIdade(59)).toEqual({ indice: 9, rotulo: "59 anos ou mais" });
  });

  it("regras da ANS: última ≤ 6× a primeira; da 7ª à 10ª não sobe mais que da 1ª à 7ª", () => {
    expect(
      regrasAns([100, 120, 140, 160, 180, 200, 230, 260, 300, 700]),
    ).toEqual({
      vezes: 7,
      seisVezesOk: false,
      variacao1a7: 130,
      variacao7a10: 204.35,
      variacaoOk: false,
      maximoUltima: 529,
    });
    expect(regrasAns(FAIXAS)).toMatchObject({
      seisVezesOk: true,
      variacaoOk: true,
    });
    expect(regrasAns([100, 0, 0, 0, 0, 0, 0, 0, 0, 0])).toBeNull();
  });
});

describe("T215 — cálculo dos benefícios: antecipação de salário", () => {
  const ant = (
    a: NonNullable<RegrasDoBeneficio["antecipacao"]>,
    p: Partial<PessoaDoCalculo> = {},
  ) =>
    calc(
      { categoria: "antecipacao", tipoValor: "antecipacao", antecipacao: a },
      p,
    );

  it("valor que muda todo mês: o antecipado é descontado; a mensalidade, de quem paga", () => {
    expect(
      ant(
        {
          mensalidade: 9.9,
          mensalidadeQuemPaga: "empresa",
          modo: "variavel",
          percentual: null,
          diaDesconto: null,
        },
        { ajuste: { antecipado: 500 } },
      ),
    ).toMatchObject({ valor: 50990, empresa: 990, desconto: 50000 });
    expect(
      ant(
        {
          mensalidade: 9.9,
          mensalidadeQuemPaga: "colaborador",
          modo: "variavel",
          percentual: null,
          diaDesconto: null,
        },
        { tipoVinculo: "estagio", ajuste: { antecipado: 100 } },
      ),
    ).toMatchObject({ empresa: 0, desconto: 10990 });
  });

  it("% do salário por mês", () => {
    expect(
      ant({
        mensalidade: null,
        mensalidadeQuemPaga: "empresa",
        modo: "percentual",
        percentual: 10,
        diaDesconto: 20,
      }),
    ).toMatchObject({ valor: 32000, desconto: 32000, empresa: 0 });
  });
});

describe("T215 — limite do PAT (alimentação)", () => {
  it("o colaborador paga até 20%; acima, a sugestão de quanto a empresa paga", () => {
    expect(limitePat(BASE)).toEqual({
      percentualColaborador: 20,
      dentro: true,
    });
    expect(
      limitePat({
        ...BASE,
        quemPaga: {
          modo: "colaborador_tudo",
          calculo: "percentual",
          empresa: 0,
        },
      }),
    ).toEqual({ percentualColaborador: 100, dentro: false });
    expect(limitePat({ ...BASE, categoria: "mobilidade" })).toBeNull();
  });
});
