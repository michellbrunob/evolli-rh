import {
  type RegrasDaPolitica,
  REGRAS_VAZIAS,
  principaisRegras,
  violacoesDaPolitica,
} from "./politica-ferias";

/**
 * T215 — Políticas de férias (como a referência, 2026-11-26): o que cada
 * regra confere num pedido de férias. Só aponta o que não segue; quem
 * registra decide (com motivo). Dias civis `AAAA-MM-DD`.
 */
describe("T215 — política de férias: o que não segue", () => {
  const base = {
    hoje: "2026-11-26",
    saldoDepois: 10,
    outrasFerias: [] as { inicio: string; fim: string }[],
    foraNaEquipe: 0,
  };
  const regras = (parcial: Partial<RegrasDaPolitica>): RegrasDaPolitica => ({
    ...REGRAS_VAZIAS,
    ...parcial,
  });

  it("sem regra nenhuma, nada a apontar", () => {
    expect(
      violacoesDaPolitica({
        ...base,
        regras: REGRAS_VAZIAS,
        inicio: "2026-11-27",
        fim: "2026-11-28",
      }),
    ).toEqual([]);
  });

  it("antecedência mínima e máxima", () => {
    expect(
      violacoesDaPolitica({
        ...base,
        regras: regras({ antecedenciaMinimaDias: 30 }),
        inicio: "2026-12-21",
        fim: "2026-12-30",
      }),
    ).toEqual([{ regra: "antecedencia_minima", dias: 25, minimo: 30 }]);
    expect(
      violacoesDaPolitica({
        ...base,
        regras: regras({ antecedenciaMinimaDias: 30 }),
        inicio: "2026-12-26",
        fim: "2027-01-04",
      }),
    ).toEqual([]);
    expect(
      violacoesDaPolitica({
        ...base,
        regras: regras({ antecedenciaMaximaMeses: 6 }),
        inicio: "2027-06-01",
        fim: "2027-06-10",
      }),
    ).toEqual([{ regra: "antecedencia_maxima", meses: 6, maximo: 6 }]);
  });

  it("duração de cada período", () => {
    const r = regras({ duracaoMinimaDias: 10, duracaoMaximaDias: 20 });
    expect(
      violacoesDaPolitica({
        ...base,
        regras: r,
        inicio: "2027-02-01",
        fim: "2027-02-04",
      }),
    ).toEqual([{ regra: "duracao_minima", dias: 4, minimo: 10 }]);
    expect(
      violacoesDaPolitica({
        ...base,
        regras: r,
        inicio: "2027-02-01",
        fim: "2027-02-21",
      }),
    ).toEqual([{ regra: "duracao_maxima", dias: 21, maximo: 20 }]);
  });

  it("períodos por ano, um maior e o intervalo entre eles", () => {
    const outras = [
      { inicio: "2027-01-04", fim: "2027-01-13" },
      { inicio: "2027-03-01", fim: "2027-03-10" },
    ];
    expect(
      violacoesDaPolitica({
        ...base,
        regras: regras({
          periodosPorAno: 2,
          periodoMaiorDias: 15,
          intervaloDias: 30,
        }),
        inicio: "2027-03-20",
        fim: "2027-03-29",
        outrasFerias: outras,
      }),
    ).toEqual([
      { regra: "periodos_por_ano", ordem: 3, maximo: 2 },
      { regra: "periodo_maior", minimo: 15 },
      { regra: "intervalo", dias: 9, minimo: 30 },
    ]);
  });

  it("o início não pode cair: 2 dias antes de folga ou feriado; fim de semana ou feriado", () => {
    expect(
      violacoesDaPolitica({
        ...base,
        regras: regras({ inicioNaoAntesDeDescanso: true }),
        // Sexta-feira.
        inicio: "2026-12-04",
        fim: "2026-12-13",
      }),
    ).toEqual([
      {
        regra: "inicio_antes_de_descanso",
        antesDe: "domingo",
        dia: "2026-12-06",
      },
    ]);
    expect(
      violacoesDaPolitica({
        ...base,
        regras: regras({ inicioNaoNoFimDeSemana: true }),
        // Sábado.
        inicio: "2026-12-05",
        fim: "2026-12-14",
      }),
    ).toEqual([{ regra: "inicio_no_descanso", dia: "2026-12-05" }]);
  });

  it("a volta não pode cair: sexta-feira ou véspera de feriado", () => {
    // Fim na quinta 03/12: volta na sexta 04/12.
    expect(
      violacoesDaPolitica({
        ...base,
        regras: regras({ voltaNaoNaSexta: true }),
        inicio: "2026-11-30",
        fim: "2026-12-03",
      }),
    ).toEqual([{ regra: "volta_na_sexta", dia: "2026-12-04" }]);
    // Fim em 23/12: volta em 24/12, véspera do Natal.
    expect(
      violacoesDaPolitica({
        ...base,
        regras: regras({ voltaNaoNaVespera: true }),
        inicio: "2026-12-14",
        fim: "2026-12-23",
      }),
    ).toEqual([{ regra: "volta_na_vespera", dia: "2026-12-24" }]);
  });

  it("períodos bloqueados: datas fixas e todo ano", () => {
    const bloqueio = {
      nome: "Fechamento",
      inicio: "2025-12-20",
      fim: "2025-12-31",
      todoAno: true,
    };
    expect(
      violacoesDaPolitica({
        ...base,
        regras: regras({ bloqueios: [bloqueio] }),
        inicio: "2026-12-28",
        fim: "2027-01-06",
      }),
    ).toEqual([
      {
        regra: "bloqueio",
        nome: "Fechamento",
        inicio: "2026-12-20",
        fim: "2026-12-31",
      },
    ]);
    expect(
      violacoesDaPolitica({
        ...base,
        regras: regras({ bloqueios: [{ ...bloqueio, todoAno: false }] }),
        inicio: "2026-12-28",
        fim: "2027-01-06",
      }),
    ).toEqual([]);
  });

  it("além do saldo e gente demais fora ao mesmo tempo", () => {
    expect(
      violacoesDaPolitica({
        ...base,
        regras: regras({ alemDoSaldo: "nao_aceitar" }),
        inicio: "2027-02-01",
        fim: "2027-02-10",
        saldoDepois: -2,
      }),
    ).toEqual([{ regra: "alem_do_saldo" }]);
    expect(
      violacoesDaPolitica({
        ...base,
        regras: regras({ alemDoSaldo: "aceitar" }),
        inicio: "2027-02-01",
        fim: "2027-02-10",
        saldoDepois: -2,
      }),
    ).toEqual([]);
    expect(
      violacoesDaPolitica({
        ...base,
        regras: regras({ foraAoMesmoTempo: 2 }),
        inicio: "2027-02-01",
        fim: "2027-02-10",
        foraNaEquipe: 2,
      }),
    ).toEqual([{ regra: "equipe", fora: 2, maximo: 2 }]);
  });
});

describe("T215 — política de férias: principais regras (a coluna da lista)", () => {
  it("antecedência, divisão e as demais, como a referência", () => {
    expect(
      principaisRegras({
        ...REGRAS_VAZIAS,
        antecedenciaMinimaDias: 30,
        duracaoMinimaDias: 10,
        duracaoMaximaDias: 20,
        periodosPorAno: 2,
        alemDoSaldo: "nao_aceitar",
        voltaNaoNaSexta: true,
        bloqueios: [
          {
            nome: "Fechamento",
            inicio: "2026-12-20",
            fim: "2026-12-31",
            todoAno: true,
          },
        ],
      }),
    ).toEqual({
      primeira: "Antecedência de 30 dias",
      segunda: "Até 2 períodos",
      mais: 4,
    });
    // Sem regra própria: o padrão "não aceita além do saldo" é a única.
    expect(principaisRegras(REGRAS_VAZIAS)).toEqual({
      primeira: "Não aceita além do saldo",
      segunda: null,
      mais: 0,
    });
    expect(
      principaisRegras({ ...REGRAS_VAZIAS, alemDoSaldo: "aceitar" }),
    ).toEqual({ primeira: "Só os pisos da lei", segunda: null, mais: 0 });
  });
});
