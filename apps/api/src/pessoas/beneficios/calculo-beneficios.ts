/**
 * T215 — Benefícios (como a referência, 2026-11-26): o cálculo de cada
 * pessoa no mês (competência `AAAA-MM`), em funções puras. Valores das
 * regras em reais; o resultado em CENTAVOS inteiros (meio centavo arredonda
 * para cima).
 *
 * - **valor**: o que o benefício custa no mês para a pessoa (o que o
 *   fornecedor cobra), com dependentes e coparticipação;
 * - **empresa**: a parte da empresa;
 * - **desconto**: o que sai do holerite do colaborador;
 * - **adicional**: o que entra no holerite junto com o salário;
 * - **parteColaborador**: fora da folha, a parte do colaborador só é
 *   registrada (não desconta).
 *
 * Regras da lei: estágio não tem desconto (Lei 11.788); vale-transporte
 * desconta até N% do salário base (6% pela Lei 7.418/85), nunca mais que o
 * próprio VT, e sem salário a pessoa fica pendente; plano por faixa etária
 * segue as 10 faixas da ANS (RN 63/2003), mudando de faixa no mês seguinte
 * ao aniversário; no PAT o colaborador paga até 20% (só aviso).
 */

export type Dia = string;

export const CATEGORIAS = [
  "alimentacao",
  "mobilidade",
  "saude",
  "odontologico",
  "seguro_vida",
  "bem_estar",
  "saude_mental",
  "educacao",
  "trabalho_remoto",
  "multibeneficios",
  "antecipacao",
  "outros",
] as const;
export type Categoria = (typeof CATEGORIAS)[number];

export const FOLHAS = ["desconto", "adicional", "fora_da_folha"] as const;
export type Folha = (typeof FOLHAS)[number];

export const TIPOS_DE_VALOR = [
  "fixo",
  "dia_util",
  "individual",
  "faixa_etaria",
  "antecipacao",
] as const;
export type TipoDeValor = (typeof TIPOS_DE_VALOR)[number];

export interface QuemPaga {
  /** "empresa_tudo" só fora da folha (ou adicional, implícito). */
  modo: "empresa_parte" | "colaborador_tudo" | "empresa_tudo";
  /** A parte da empresa: em % do valor ou em R$ (por mês; no dia útil, por dia). */
  calculo: "percentual" | "valor";
  empresa: number;
}

export interface PlanoDoBeneficio {
  id: string;
  nome: string;
  valor: number;
}

export interface AntecipacaoDoBeneficio {
  /** Mensalidade por pessoa (por vida); `null` = sem mensalidade. */
  mensalidade: number | null;
  mensalidadeQuemPaga: "empresa" | "colaborador";
  /** "variavel": o RH informa o valor de cada mês; "percentual": % do salário. */
  modo: "variavel" | "percentual";
  percentual: number | null;
  diaDesconto: number | null;
}

export interface RegrasDoBeneficio {
  categoria: Categoria;
  folha: Folha;
  tipoValor: TipoDeValor;
  valorMensal: number | null;
  valorDia: number | null;
  diasModo: "uteis" | "escala";
  individualModo: "plano" | "livre";
  planos: PlanoDoBeneficio[];
  /** As 10 mensalidades da ANS, da faixa 0 a 18 à de 59 anos ou mais. */
  faixas: number[];
  /** Faixa etária: quanto o colaborador paga do titular e de cada dependente. */
  colaboradorPaga: {
    calculo: "percentual" | "valor";
    titular: number;
    dependente: number;
  };
  coparticipacao: boolean;
  quemPaga: QuemPaga;
  /** Vale-transporte: % do salário base descontado (até 6). */
  vt: { percentualSalario: number; empresaCusteiaTudo: boolean };
  antecipacao: AntecipacaoDoBeneficio | null;
}

/** O que foi digitado para a pessoa no mês (por cima da regra). */
export interface AjusteDoMes {
  dias?: number | null;
  valorDia?: number | null;
  valorMes?: number | null;
  coparticipacao?: number | null;
  antecipado?: number | null;
}

export interface PessoaDoCalculo {
  tipoVinculo: string;
  /** Salário base vigente (reais); `null` = sem salário no cadastro. */
  salarioBase: number | null;
  nascimento: Dia | null;
  /** Os dependentes NO PLANO (faixa etária). */
  dependentes: { nascimento: Dia | null }[];
  /** Dias do mês: úteis; e pela escala (publicada ou do cadastro). */
  dias: { uteis: number; escala: number; origemEscala: "escala" | "catalogo" };
  planoId: string | null;
  valorIndividual: number | null;
  ajuste: AjusteDoMes | null;
}

export type OrigemDosDias = "uteis" | "escala" | "catalogo" | "digitado";
export type Pendencia =
  "sem_nascimento" | "sem_salario" | "sem_plano" | "sem_valor";
export type Observacao = "estagio_sem_desconto" | "limitado_ao_vt";

export interface CalculoDaPessoa {
  dias: number | null;
  origemDias: OrigemDosDias | null;
  valorDia: number | null;
  faixa: string | null;
  dependentesNoPlano: number;
  valor: number;
  empresa: number;
  desconto: number;
  adicional: number;
  parteColaborador: number;
  pendencia: Pendencia | null;
  observacao: Observacao | null;
}

/** Reais → centavos (meio centavo para cima). */
export function centavos(reais: number | null | undefined): number {
  if (reais === null || reais === undefined || !Number.isFinite(reais))
    return 0;
  return Math.round(Math.round(reais * 1000) / 10);
}

/** Uma fração de centavos (meio centavo para cima). */
function parte(totalCentavos: number, percentual: number): number {
  return Math.round((totalCentavos * percentual) / 100 + 1e-9);
}

const ROTULOS_DAS_FAIXAS = [
  "0 a 18",
  "19 a 23",
  "24 a 28",
  "29 a 33",
  "34 a 38",
  "39 a 43",
  "44 a 48",
  "49 a 53",
  "54 a 58",
  "59 anos ou mais",
] as const;
export const FAIXAS_DA_ANS = ROTULOS_DAS_FAIXAS;

/**
 * A idade que vale na competência: a completada até o último dia do mês
 * anterior (a pessoa muda de faixa no mês seguinte ao aniversário).
 */
export function idadeNaCompetencia(
  nascimento: Dia,
  competencia: string,
): number {
  const [ano, mes] = competencia.split("-").map(Number) as [number, number];
  // Último dia do mês anterior.
  const ref = new Date(Date.UTC(ano, mes - 1, 0));
  const [na, nm, nd] = nascimento.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  let idade = ref.getUTCFullYear() - na;
  const mesRef = ref.getUTCMonth() + 1;
  const diaRef = ref.getUTCDate();
  if (mesRef < nm || (mesRef === nm && diaRef < nd)) idade -= 1;
  return idade;
}

export function faixaDaIdade(idade: number): {
  indice: number;
  rotulo: string;
} {
  const indice =
    idade <= 18 ? 0 : idade >= 59 ? 9 : Math.floor((idade - 19) / 5) + 1;
  return { indice, rotulo: ROTULOS_DAS_FAIXAS[indice]! };
}

const ZERO: Omit<CalculoDaPessoa, "pendencia" | "observacao"> = {
  dias: null,
  origemDias: null,
  valorDia: null,
  faixa: null,
  dependentesNoPlano: 0,
  valor: 0,
  empresa: 0,
  desconto: 0,
  adicional: 0,
  parteColaborador: 0,
};

/** O valor do mês (centavos) e o que o tipo de valor informa. */
function valorDoMes(
  r: RegrasDoBeneficio,
  p: PessoaDoCalculo,
): Pick<CalculoDaPessoa, "dias" | "origemDias" | "valorDia"> & {
  valor: number;
  pendencia: Pendencia | null;
} {
  const ajuste = p.ajuste ?? {};
  switch (r.tipoValor) {
    case "fixo":
      return {
        valor: centavos(r.valorMensal),
        dias: null,
        origemDias: null,
        valorDia: null,
        pendencia: null,
      };
    case "dia_util": {
      const digitado =
        ajuste.dias !== null && ajuste.dias !== undefined ? ajuste.dias : null;
      const dias =
        digitado ?? (r.diasModo === "escala" ? p.dias.escala : p.dias.uteis);
      const origemDias: OrigemDosDias =
        digitado !== null
          ? "digitado"
          : r.diasModo === "escala"
            ? p.dias.origemEscala
            : "uteis";
      const valorDia = centavos(
        ajuste.valorDia !== null && ajuste.valorDia !== undefined
          ? ajuste.valorDia
          : r.valorDia,
      );
      return {
        valor: valorDia * dias,
        dias,
        origemDias,
        valorDia,
        pendencia: null,
      };
    }
    case "individual": {
      if (r.individualModo === "plano") {
        const plano = r.planos.find((pl) => pl.id === p.planoId);
        return {
          valor: plano ? centavos(plano.valor) : 0,
          dias: null,
          origemDias: null,
          valorDia: null,
          pendencia: plano ? null : "sem_plano",
        };
      }
      const valor =
        ajuste.valorMes !== null && ajuste.valorMes !== undefined
          ? ajuste.valorMes
          : p.valorIndividual;
      return {
        valor: centavos(valor),
        dias: null,
        origemDias: null,
        valorDia: null,
        pendencia: valor === null || valor === undefined ? "sem_valor" : null,
      };
    }
    default:
      return {
        valor: 0,
        dias: null,
        origemDias: null,
        valorDia: null,
        pendencia: null,
      };
  }
}

export function calcularPessoa(
  r: RegrasDoBeneficio,
  p: PessoaDoCalculo,
  competencia: string,
): CalculoDaPessoa {
  const estagio = p.tipoVinculo === "estagio";
  const ajuste = p.ajuste ?? {};

  // Faixa etária (ANS): titular e dependentes no plano.
  if (r.tipoValor === "faixa_etaria") {
    if (!p.nascimento) {
      return { ...ZERO, pendencia: "sem_nascimento", observacao: null };
    }
    const faixa = faixaDaIdade(idadeNaCompetencia(p.nascimento, competencia));
    const titular = centavos(r.faixas[faixa.indice] ?? 0);
    const deps = p.dependentes
      .filter((d) => d.nascimento)
      .map((d) =>
        centavos(
          r.faixas[
            faixaDaIdade(idadeNaCompetencia(d.nascimento!, competencia)).indice
          ] ?? 0,
        ),
      );
    const mensalidade = titular + deps.reduce((a, b) => a + b, 0);
    const c = r.colaboradorPaga;
    let parteColab =
      c.calculo === "percentual"
        ? parte(titular, c.titular) +
          deps.reduce((a, d) => a + parte(d, c.dependente), 0)
        : Math.min(centavos(c.titular), titular) +
          deps.reduce((a, d) => a + Math.min(centavos(c.dependente), d), 0);
    parteColab = Math.min(parteColab, mensalidade);
    const copart = r.coparticipacao ? centavos(ajuste.coparticipacao) : 0;
    const empresa = mensalidade - parteColab;
    const base = {
      ...ZERO,
      faixa: faixa.rotulo,
      dependentesNoPlano: deps.length,
      valor: mensalidade + copart,
    };
    return distribuir(r, base, empresa, parteColab + copart, estagio);
  }

  // Antecipação de salário: o antecipado sempre sai do holerite.
  if (r.tipoValor === "antecipacao") {
    const a = r.antecipacao;
    const mensalidade = centavos(a?.mensalidade ?? 0);
    const antecipado =
      a?.modo === "percentual"
        ? parte(centavos(p.salarioBase), a.percentual ?? 0)
        : centavos(ajuste.antecipado);
    const daEmpresa = a?.mensalidadeQuemPaga === "empresa" ? mensalidade : 0;
    return {
      ...ZERO,
      valor: mensalidade + antecipado,
      empresa: daEmpresa,
      desconto: mensalidade - daEmpresa + antecipado,
      pendencia: null,
      observacao: null,
    };
  }

  const v = valorDoMes(r, p);
  const base = {
    ...ZERO,
    dias: v.dias,
    origemDias: v.origemDias,
    valorDia: v.valorDia,
    valor: v.valor,
  };

  // Vale-transporte: % do salário base, nunca mais que o próprio VT.
  if (r.categoria === "mobilidade" && r.folha === "desconto") {
    if (estagio) {
      return {
        ...base,
        empresa: v.valor,
        pendencia: v.pendencia,
        observacao: "estagio_sem_desconto",
      };
    }
    if (r.vt.empresaCusteiaTudo) {
      return {
        ...base,
        empresa: v.valor,
        pendencia: v.pendencia,
        observacao: null,
      };
    }
    if (p.salarioBase === null) {
      return {
        ...base,
        empresa: v.valor,
        pendencia: "sem_salario",
        observacao: null,
      };
    }
    const seisPorCento = parte(centavos(p.salarioBase), r.vt.percentualSalario);
    const desconto = Math.min(seisPorCento, v.valor);
    return {
      ...base,
      empresa: v.valor - desconto,
      desconto,
      pendencia: v.pendencia,
      observacao: seisPorCento > v.valor ? "limitado_ao_vt" : null,
    };
  }

  // Quem paga (empresa em % ou em R$; no dia útil, R$ por dia).
  const q = r.quemPaga;
  let empresa: number;
  if (r.folha === "adicional" || q.modo === "empresa_tudo") empresa = v.valor;
  else if (q.modo === "colaborador_tudo") empresa = 0;
  else if (q.calculo === "percentual") empresa = parte(v.valor, q.empresa);
  else {
    const porDia = r.tipoValor === "dia_util";
    empresa = Math.min(
      porDia ? centavos(q.empresa) * (v.dias ?? 0) : centavos(q.empresa),
      v.valor,
    );
  }
  return distribuir(
    r,
    { ...base, pendencia: v.pendencia } as CalculoDaPessoa,
    empresa,
    v.valor - empresa,
    estagio,
  );
}

/** A parte do colaborador vira desconto, adicional ou só registro. */
function distribuir(
  r: RegrasDoBeneficio,
  base: Omit<CalculoDaPessoa, "observacao" | "pendencia"> & {
    pendencia?: Pendencia | null;
  },
  empresa: number,
  colaborador: number,
  estagio: boolean,
): CalculoDaPessoa {
  const pendencia = base.pendencia ?? null;
  if (r.folha === "adicional") {
    return {
      ...base,
      empresa: base.valor,
      desconto: 0,
      adicional: base.valor,
      pendencia,
      observacao: null,
    };
  }
  if (r.folha === "fora_da_folha") {
    return {
      ...base,
      empresa,
      desconto: 0,
      parteColaborador: colaborador,
      pendencia,
      observacao: null,
    };
  }
  if (estagio) {
    return {
      ...base,
      empresa: empresa + colaborador,
      desconto: 0,
      pendencia,
      observacao: colaborador > 0 ? "estagio_sem_desconto" : null,
    };
  }
  return {
    ...base,
    empresa,
    desconto: colaborador,
    pendencia,
    observacao: null,
  };
}

/**
 * As regras da ANS para a tabela (RN 63/2003): a última faixa custa no máximo
 * 6× a primeira, e a variação da 7ª à 10ª não passa a da 1ª à 7ª. `null` com
 * a tabela incompleta. Percentuais com 2 casas.
 */
export function regrasAns(faixas: readonly number[]): {
  vezes: number;
  seisVezesOk: boolean;
  variacao1a7: number;
  variacao7a10: number;
  variacaoOk: boolean;
  maximoUltima: number;
} | null {
  if (faixas.length !== 10 || faixas.some((f) => !(f > 0))) return null;
  const f1 = faixas[0]!;
  const f7 = faixas[6]!;
  const f10 = faixas[9]!;
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const vezes = r2(f10 / f1);
  const variacao1a7 = r2((f7 / f1 - 1) * 100);
  const variacao7a10 = r2((f10 / f7 - 1) * 100);
  return {
    vezes,
    seisVezesOk: vezes <= 6,
    variacao1a7,
    variacao7a10,
    variacaoOk: variacao7a10 <= variacao1a7,
    maximoUltima: r2(Math.min(6 * f1, (f7 * f7) / f1)),
  };
}

/**
 * PAT (alimentação): o colaborador paga até 20% do valor. Quanto ele paga,
 * pelas regras (por mês ou por dia); `null` fora da alimentação, fora do
 * desconto em folha ou sem valor.
 */
export function limitePat(
  r: RegrasDoBeneficio,
): { percentualColaborador: number; dentro: boolean } | null {
  if (r.categoria !== "alimentacao" || r.folha !== "desconto") return null;
  const q = r.quemPaga;
  let pct: number;
  if (q.modo === "colaborador_tudo") pct = 100;
  else if (q.modo === "empresa_tudo") pct = 0;
  else if (q.calculo === "percentual") pct = 100 - q.empresa;
  else {
    const base = r.tipoValor === "dia_util" ? r.valorDia : r.valorMensal;
    if (!base) return null;
    pct = Math.max(0, ((base - q.empresa) / base) * 100);
  }
  const percentualColaborador = Math.round(pct * 100) / 100;
  return { percentualColaborador, dentro: percentualColaborador <= 20 };
}
