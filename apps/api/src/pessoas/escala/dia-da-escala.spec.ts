import { conferirDia } from "./dia-da-escala";

const p = (inicio: string, fim: string) => ({ inicio, fim });

describe("T215 — forma do dia do quadro da escala", () => {
  it("trabalho de um período, com intervalo e turno: aceito", () => {
    expect(
      conferirDia({
        tipo: "trabalho",
        tabelaHorarioId: "t",
        periodos: [p("09:00", "18:00")],
        intervaloMinutos: 60,
      }),
    ).toEqual([]);
  });

  it("trabalho que cruza a meia-noite e turno partido em sequência: aceitos", () => {
    expect(
      conferirDia({ tipo: "trabalho", periodos: [p("22:00", "06:00")] }),
    ).toEqual([]);
    expect(
      conferirDia({
        tipo: "trabalho",
        periodos: [p("08:00", "12:00"), p("14:00", "18:00")],
      }),
    ).toEqual([]);
    // O segundo período depois da meia-noite, depois de um turno da noite.
    expect(
      conferirDia({
        tipo: "trabalho",
        periodos: [p("18:00", "23:00"), p("01:00", "03:00")],
      }),
    ).toEqual([]);
    // Encostado no fim do primeiro.
    expect(
      conferirDia({
        tipo: "trabalho",
        periodos: [p("08:00", "12:00"), p("12:00", "13:00")],
      }),
    ).toEqual([]);
  });

  it("períodos: obrigatório, no máximo 2, início diferente do fim, sem sobrepor", () => {
    expect(conferirDia({ tipo: "trabalho", periodos: [] })).toEqual([
      { campo: "periodos", motivo: "obrigatorio" },
    ]);
    expect(
      conferirDia({
        tipo: "trabalho",
        periodos: [
          p("01:00", "02:00"),
          p("03:00", "04:00"),
          p("05:00", "06:00"),
        ],
      }),
    ).toEqual([{ campo: "periodos", motivo: "invalido" }]);
    expect(
      conferirDia({ tipo: "trabalho", periodos: [p("09:00", "09:00")] }),
    ).toEqual([{ campo: "periodos", motivo: "invalido" }]);
    expect(
      conferirDia({
        tipo: "trabalho",
        periodos: [p("08:00", "12:00"), p("11:00", "15:00")],
      }),
    ).toEqual([{ campo: "periodos", motivo: "sobreposta" }]);
    // 22:00–10:00 e 08:00–09:00: o segundo cai dentro do primeiro (dia seguinte).
    expect(
      conferirDia({
        tipo: "trabalho",
        periodos: [p("22:00", "10:00"), p("08:00", "09:00")],
      }),
    ).toEqual([{ campo: "periodos", motivo: "sobreposta" }]);
  });

  it("intervalo só nos valores do painel", () => {
    expect(
      conferirDia({
        tipo: "trabalho",
        periodos: [p("09:00", "18:00")],
        intervaloMinutos: 20,
      }),
    ).toEqual([{ campo: "intervaloMinutos", motivo: "invalido" }]);
    for (const intervalo of [0, 15, 30, 45, 60, 90, 120]) {
      expect(
        conferirDia({
          tipo: "trabalho",
          periodos: [p("09:00", "18:00")],
          intervaloMinutos: intervalo,
        }),
      ).toEqual([]);
    }
  });

  it("sobreaviso depois do turno: começa no fim do trabalho ou depois; um só", () => {
    expect(
      conferirDia({
        tipo: "trabalho",
        periodos: [p("09:00", "18:00")],
        sobreaviso: [p("18:00", "09:00")],
      }),
    ).toEqual([]);
    // Turno da noite: o sobreaviso de manhã é do dia seguinte.
    expect(
      conferirDia({
        tipo: "trabalho",
        periodos: [p("22:00", "06:00")],
        sobreaviso: [p("06:00", "14:00")],
      }),
    ).toEqual([]);
    expect(
      conferirDia({
        tipo: "trabalho",
        periodos: [p("09:00", "18:00")],
        sobreaviso: [p("17:00", "20:00")],
      }),
    ).toEqual([{ campo: "sobreaviso", motivo: "sobreposta" }]);
    expect(
      conferirDia({
        tipo: "trabalho",
        periodos: [p("09:00", "18:00")],
        sobreaviso: [p("18:00", "20:00"), p("21:00", "22:00")],
      }),
    ).toEqual([{ campo: "sobreaviso", motivo: "invalido" }]);
  });

  it("folga e DSR: só a observação", () => {
    expect(conferirDia({ tipo: "folga", observacao: "Troca" })).toEqual([]);
    expect(
      conferirDia({
        tipo: "dsr",
        tabelaHorarioId: "t",
        periodos: [p("09:00", "18:00")],
        intervaloMinutos: 60,
        sobreaviso: [p("18:00", "20:00")],
        unidadeOrganizacionalId: "u",
      }),
    ).toEqual([
      { campo: "tabelaHorarioId", motivo: "nao_se_aplica" },
      { campo: "periodos", motivo: "nao_se_aplica" },
      { campo: "intervaloMinutos", motivo: "nao_se_aplica" },
      { campo: "sobreaviso", motivo: "nao_se_aplica" },
      { campo: "unidadeOrganizacionalId", motivo: "nao_se_aplica" },
    ]);
  });

  it("sobreaviso: períodos sem turno, intervalo nem sobreaviso", () => {
    expect(
      conferirDia({
        tipo: "sobreaviso",
        periodos: [p("18:00", "06:00")],
        unidadeOrganizacionalId: "u",
      }),
    ).toEqual([]);
    expect(
      conferirDia({
        tipo: "sobreaviso",
        tabelaHorarioId: "t",
        periodos: [p("18:00", "06:00")],
        intervaloMinutos: 60,
        sobreaviso: [p("06:00", "07:00")],
      }),
    ).toEqual([
      { campo: "tabelaHorarioId", motivo: "nao_se_aplica" },
      { campo: "intervaloMinutos", motivo: "nao_se_aplica" },
      { campo: "sobreaviso", motivo: "nao_se_aplica" },
    ]);
  });
});
