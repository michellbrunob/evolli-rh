import {
  type PadraoDoDia,
  resolverDiaDoPadrao,
  trabalhoNoDia,
} from "./dia-do-padrao";
import {
  type EntradaDosDiasDeTrabalho,
  diasDeTrabalhoNoMes,
} from "./dias-de-trabalho";

/**
 * T215 — dias de trabalho do mês, dia a dia, com a regra da célula do
 * quadro: o publicado por cima do padrão, a troca de escala no meio do mês,
 * a ausência aprovada e, sem padrão, a escala do cadastro. Novembro/2026:
 * 30 dias, começa num domingo (5 domingos), 21 dias de semana, Finados (2)
 * e Consciência Negra (20) em dias de semana.
 */
const TURNO = {
  id: "turno-1",
  intervaloMinutos: 60,
  periodos: [{ dia: "segunda", inicio: "09:00", fim: "18:00" }],
};

function padrao(p: Partial<PadraoDoDia> & { modelo: string }): PadraoDoDia {
  return {
    turno: TURNO,
    turnoNoite: null,
    folgaSemanal: null,
    diasTrabalho: [],
    inicioCiclo: null,
    vigenciaInicio: "2026-01-01",
    vigenciaFim: null,
    ...p,
  };
}

function entrada(
  e: Partial<EntradaDosDiasDeTrabalho> = {},
): EntradaDosDiasDeTrabalho {
  return {
    competencia: "2026-11",
    escalas: [],
    publicados: new Map(),
    ausencias: [],
    escalaDoCadastro: null,
    uf: null,
    feriadosMunicipais: [],
    admissao: null,
    desligamento: null,
    ...e,
  };
}

const SEIS_POR_UM = padrao({ modelo: "6x1", folgaSemanal: 7 });

describe("T215 — dia pelo padrão (a mesma regra da célula do quadro)", () => {
  it("6x1: trabalho com o turno; o domingo escolhido é DSR", () => {
    expect(resolverDiaDoPadrao([SEIS_POR_UM], "2026-11-03")).toEqual({
      tipo: "trabalho",
      tabelaHorarioId: "turno-1",
      periodos: [{ inicio: "09:00", fim: "18:00" }],
      intervaloMinutos: 60,
    });
    expect(resolverDiaDoPadrao([SEIS_POR_UM], "2026-11-01")?.tipo).toBe("dsr");
  });

  it("sem padrão no dia: null (sem escala); vigência [início, fim)", () => {
    const p = padrao({
      modelo: "5x2",
      vigenciaInicio: "2026-11-10",
      vigenciaFim: "2026-11-12",
    });
    expect(resolverDiaDoPadrao([p], "2026-11-09")).toBeNull();
    expect(resolverDiaDoPadrao([p], "2026-11-11")?.tipo).toBe("trabalho");
    expect(resolverDiaDoPadrao([p], "2026-11-12")).toBeNull();
  });

  it("sem turno fixo: trabalho sem horário; turno que não tem o dia: folga", () => {
    expect(
      resolverDiaDoPadrao(
        [padrao({ modelo: "5x2", turno: null })],
        "2026-11-03",
      ),
    ).toMatchObject({ tipo: "trabalho", periodos: [] });
    const porDia = {
      id: "t2",
      intervaloMinutos: 0,
      periodos: [
        { dia: "segunda", inicio: "08:00", fim: "12:00" },
        { dia: "terca", inicio: "13:00", fim: "17:00" },
      ],
    };
    // Quarta: a jornada não tem período → folga do turno.
    expect(
      resolverDiaDoPadrao(
        [padrao({ modelo: "5x2", turno: porDia })],
        "2026-11-04",
      )?.tipo,
    ).toBe("folga");
  });

  it("12x36 com turno da noite: um mês de dia, o seguinte de noite", () => {
    const p = padrao({
      modelo: "12x36",
      inicioCiclo: "2026-10-01",
      turnoNoite: { ...TURNO, id: "noite" },
    });
    expect(trabalhoNoDia(p, "2026-10-01")).toBe("dia");
    expect(trabalhoNoDia(p, "2026-10-02")).toBeNull();
    expect(trabalhoNoDia(p, "2026-11-02")).toBe("noite");
  });
});

describe("T215 — dias de trabalho no mês", () => {
  it("6x1 com só a terça publicada: o mês inteiro pelo padrão (25), não 1", () => {
    const r = diasDeTrabalhoNoMes(
      entrada({
        escalas: [SEIS_POR_UM],
        publicados: new Map([["2026-11-03", "trabalho"]]),
      }),
    );
    expect(r).toEqual({ dias: 25, origem: "escala" });
  });

  it("uma folga publicada tira só aquele dia (24), não zera o mês", () => {
    const r = diasDeTrabalhoNoMes(
      entrada({
        escalas: [SEIS_POR_UM],
        publicados: new Map([["2026-11-03", "folga"]]),
      }),
    );
    expect(r.dias).toBe(24);
  });

  it("trabalho publicado no DSR conta", () => {
    expect(
      diasDeTrabalhoNoMes(
        entrada({
          escalas: [SEIS_POR_UM],
          publicados: new Map([["2026-11-08", "trabalho"]]),
        }),
      ).dias,
    ).toBe(26);
  });

  it("troca de escala no meio do mês: 5x2 até 15/11, 6x1 depois", () => {
    const r = diasDeTrabalhoNoMes(
      entrada({
        escalas: [
          padrao({ modelo: "5x2", vigenciaFim: "2026-11-16" }),
          padrao({
            modelo: "6x1",
            folgaSemanal: 7,
            vigenciaInicio: "2026-11-16",
          }),
        ],
      }),
    );
    // 1–15: 10 dias de semana; 16–30: 15 dias menos 2 domingos = 13.
    expect(r.dias).toBe(23);
  });

  it("ausência aprovada desconta (férias de 09 a 13/11 num 5x2)", () => {
    const r = diasDeTrabalhoNoMes(
      entrada({
        escalas: [padrao({ modelo: "5x2" })],
        ausencias: [{ inicio: "2026-11-09", fim: "2026-11-13" }],
      }),
    );
    expect(r.dias).toBe(21 - 5);
    // Afastamento sem data de volta: até o fim do mês.
    expect(
      diasDeTrabalhoNoMes(
        entrada({
          escalas: [padrao({ modelo: "5x2" })],
          ausencias: [{ inicio: "2026-11-23", fim: null }],
        }),
      ).dias,
    ).toBe(15);
  });

  it("sem padrão nem publicado: a proporção do modelo do cadastro (12x36 = 15, 6x1 = 26)", () => {
    expect(diasDeTrabalhoNoMes(entrada({ escalaDoCadastro: "12x36" }))).toEqual(
      { dias: 15, origem: "catalogo" },
    );
    expect(diasDeTrabalhoNoMes(entrada({ escalaDoCadastro: "6x1" })).dias).toBe(
      26,
    );
  });

  it("sem escala, 5x2 e outra no cadastro: os dias úteis (feriados do estado e da cidade saem)", () => {
    expect(diasDeTrabalhoNoMes(entrada()).dias).toBe(19);
    expect(
      diasDeTrabalhoNoMes(
        entrada({
          escalaDoCadastro: "5x2",
          feriadosMunicipais: ["2026-11-10"],
        }),
      ).dias,
    ).toBe(18);
    // 30/11 (segunda): Dia do Evangélico no DF.
    expect(diasDeTrabalhoNoMes(entrada({ uf: "DF" })).dias).toBe(18);
  });

  it("padrão só a partir de 16/11: o começo do mês pelo cadastro (12x36 = metade)", () => {
    const r = diasDeTrabalhoNoMes(
      entrada({
        escalaDoCadastro: "12x36",
        escalas: [padrao({ modelo: "5x2", vigenciaInicio: "2026-11-16" })],
      }),
    );
    // 15 dias × 1/2 = 7,5 + 11 dias de semana de 16 a 30 = 18,5 → 19.
    expect(r).toEqual({ dias: 19, origem: "escala" });
  });

  it("fora do vínculo não conta (admissão e desligamento no mês)", () => {
    expect(
      diasDeTrabalhoNoMes(
        entrada({
          escalas: [padrao({ modelo: "5x2" })],
          admissao: "2026-11-16",
        }),
      ).dias,
    ).toBe(11);
    expect(
      diasDeTrabalhoNoMes(
        entrada({
          escalas: [padrao({ modelo: "5x2" })],
          desligamento: "2026-11-06",
        }),
      ).dias,
    ).toBe(5);
  });
});
