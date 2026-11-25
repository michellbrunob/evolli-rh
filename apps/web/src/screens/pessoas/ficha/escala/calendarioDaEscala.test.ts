import { describe, expect, it } from "vitest";
import {
  type PadraoDeEscala,
  diasNoMes,
  diasUteisDoMes,
  formatarHoras,
  horasPorSemana,
  minutosDoTurno,
  proximosDias,
  trabalhoNoDia,
  jornadaPorSemana,
  limiteLegalSemanal,
  avisosDaJornada,
} from "./calendarioDaEscala";
import { MODELOS_DE_ESCALA, modeloDe } from "./modelosDeEscala";
import { FERIADOS_ESTADUAIS, feriadoEstadualDe } from "./calendarioDaEscala";

const DIAS_UTEIS = ["segunda", "terca", "quarta", "quinta", "sexta"];
/** 09:00–18:00 com 1 h de intervalo: 8 h por dia. */
const COMERCIAL = DIAS_UTEIS.flatMap((dia) => [
  { dia, inicio: "09:00", fim: "12:00" },
  { dia, inicio: "13:00", fim: "18:00" },
]);
/** 09:00–15:00 com 15 min de intervalo: 5 h 45 por dia. */
const ESTAGIO = DIAS_UTEIS.flatMap((dia) => [
  { dia, inicio: "09:00", fim: "12:00" },
  { dia, inicio: "12:15", fim: "15:00" },
]);

const VALE = "2026-11-24";

function padrao(modelo: string, extra: Partial<PadraoDeEscala> = {}) {
  const tipo = modeloDe(modelo)!.tipo;
  return {
    modelo,
    turno: COMERCIAL,
    turnoNoite: null,
    folgaSemanal: modelo === "6x1" ? 7 : null,
    diasTrabalho: modelo === "outra" ? [1, 2, 3, 4, 5] : [],
    inicioCiclo:
      tipo === "revezamento" || tipo === "plantao" || tipo === "embarque"
        ? VALE
        : null,
    vigenciaInicio: VALE,
    ...extra,
  } satisfies PadraoDeEscala;
}

describe("calendário da escala (mesmos números da referência)", () => {
  it("os 25 modelos, em 5 grupos, com nome e descrição", () => {
    expect(MODELOS_DE_ESCALA).toHaveLength(25);
    expect(modeloDe("semana_espanhola")).toMatchObject({
      nome: "Semana espanhola",
      tipo: "semanal",
    });
    expect(modeloDe("12x36")).toMatchObject({
      tipo: "plantao",
      trabalho: 12,
      folga: 36,
    });
    expect(modeloDe("14x21")).toMatchObject({
      tipo: "embarque",
      trabalho: 14,
      folga: 21,
    });
    expect(modeloDe("x")).toBeNull();
  });

  it("minutos do turno: jornada igual em todo dia vale para qualquer dia", () => {
    expect(minutosDoTurno(COMERCIAL, "2026-11-28")).toBe(480); // sábado
    expect(minutosDoTurno(ESTAGIO, "2026-11-24")).toBe(345);
    expect(minutosDoTurno(null, "2026-11-24")).toBe(0);
    // Jornada que muda por dia: o dia sem período é folga do turno.
    const variada = [
      { dia: "segunda", inicio: "08:00", fim: "12:00" },
      { dia: "terca", inicio: "08:00", fim: "17:00" },
    ];
    expect(minutosDoTurno(variada, "2026-11-23")).toBe(240);
    expect(minutosDoTurno(variada, "2026-11-25")).toBe(0);
  });

  it.each([
    ["5x2", "40 h"],
    ["6x1", "48 h"],
    ["semana_espanhola", "44 h"],
    ["4x3", "32 h"],
    ["fim_de_semana", "16 h"],
    ["5x1", "48 h"],
    ["6x2", "44 h"],
    ["4x2", "40 h"],
    ["2x2", "28 h"],
    ["3x3", "30 h"],
    ["4x4", "32 h"],
    ["12x36", "28 h"],
    ["12x60", "20 h"],
    ["12x72", "16 h"],
    ["18x36", "26 h"],
    ["24x48", "20 h"],
    ["24x72", "14 h"],
    ["7x7", "28 h"],
    ["14x14", "28 h"],
    ["14x21", "28 h"],
    ["15x15", "30 h"],
    ["20x10", "40 h"],
    ["21x21", "42 h"],
    ["28x28", "56 h"],
    ["outra", "40 h"],
  ])("horas por semana em %s: %s", (modelo, esperado) => {
    expect(formatarHoras(horasPorSemana(padrao(modelo), VALE))).toBe(esperado);
  });

  it("12x36 com turno da noite: um mês de dia, o seguinte de noite", () => {
    const p = padrao("12x36", { turnoNoite: ESTAGIO });
    expect(trabalhoNoDia(p, "2026-11-24")).toBe("dia");
    expect(trabalhoNoDia(p, "2026-11-25")).toBeNull();
    expect(trabalhoNoDia(p, "2026-12-02")).toBe("noite");
    expect(trabalhoNoDia(p, "2027-01-03")).toBe("dia");
    expect(formatarHoras(horasPorSemana(p, VALE))).toBe("22 h 23");
    expect(
      formatarHoras(horasPorSemana(padrao("12x36", { turno: ESTAGIO }), VALE)),
    ).toBe("20 h 08");
    expect(
      formatarHoras(
        horasPorSemana(
          padrao("12x36", { turno: null, turnoNoite: ESTAGIO }),
          VALE,
        ),
      ),
    ).toBe("14 h 23");
  });

  it("6x1: a folga cai no dia escolhido; outra: só os dias marcados", () => {
    const seis = padrao("6x1", { folgaSemanal: 3 });
    expect(trabalhoNoDia(seis, "2026-11-25")).toBeNull(); // quarta
    expect(trabalhoNoDia(seis, "2026-11-29")).toBe("dia"); // domingo
    const outra = padrao("outra", { diasTrabalho: [1, 3, 5] });
    expect(trabalhoNoDia(outra, "2026-11-23")).toBe("dia");
    expect(trabalhoNoDia(outra, "2026-11-24")).toBeNull();
    expect(formatarHoras(horasPorSemana(outra, VALE))).toBe("24 h");
  });

  it("revezamento e plantão seguem o início do ciclo, inclusive para trás", () => {
    const p = padrao("4x2", { inicioCiclo: "2026-11-24" });
    expect(
      [
        "2026-11-22",
        "2026-11-23",
        "2026-11-24",
        "2026-11-28",
        "2026-11-30",
      ].map((d) => trabalhoNoDia(p, d)),
    ).toEqual([null, null, "dia", null, "dia"]);
    const plantao = padrao("12x72", { inicioCiclo: "2026-11-24" });
    expect(trabalhoNoDia(plantao, "2026-11-27")).toBe("dia"); // +3,5 dias
    expect(trabalhoNoDia(plantao, "2026-11-26")).toBeNull();
  });

  it("semana espanhola: sábado sim, sábado não, a partir da semana da vigência", () => {
    const p = padrao("semana_espanhola");
    expect(trabalhoNoDia(p, "2026-11-28")).toBe("dia");
    expect(trabalhoNoDia(p, "2026-12-05")).toBeNull();
    expect(trabalhoNoDia(p, "2026-12-12")).toBe("dia");
    expect(trabalhoNoDia(p, "2026-11-29")).toBeNull();
  });

  it.each([
    ["5x2", 19],
    ["6x1", 26],
    ["semana_espanhola", 24],
    ["4x3", 17],
    ["fim_de_semana", 9],
    ["5x1", 25],
    ["6x2", 23],
    ["4x2", 20],
    ["2x2", 15],
    ["12x36", 15],
    ["12x60", 10],
    ["12x72", 9],
    ["18x36", 13],
    ["24x48", 10],
    ["24x72", 8],
    ["14x21", 12],
    ["20x10", 20],
    ["outra", 19],
  ])("dias para benefícios em nov./2026 com %s: %i", (modelo, dias) => {
    expect(diasNoMes(padrao(modelo).modelo, "2026-11")).toBe(dias);
  });

  it("dias úteis do mês: segunda a sexta sem os feriados nacionais fixos", () => {
    expect(diasUteisDoMes("2026-11")).toBe(19);
    expect(diasUteisDoMes("2020-01")).toBe(22);
  });

  it("horas: inteiras ou com minutos de dois dígitos", () => {
    expect(formatarHoras(40 * 60)).toBe("40 h");
    expect(formatarHoras(20 * 60 + 8)).toBe("20 h 08");
    expect(formatarHoras(0)).toBe("0 h");
  });

  it("próximos dias: trabalho ou folga, com o turno do dia", () => {
    const dias = proximosDias(padrao("2x2"), "2026-11-24", 5);
    expect(dias.map((d) => [d.dia, d.trabalho])).toEqual([
      ["2026-11-24", "dia"],
      ["2026-11-25", "dia"],
      ["2026-11-26", null],
      ["2026-11-27", null],
      ["2026-11-28", "dia"],
    ]);
  });
});

describe("T215 — EC 141/2026 e intervalo do turno", () => {
  it.each([
    ["2026-12-15", 44],
    ["2026-12-16", 42],
    ["2027-12-15", 42],
    ["2027-12-16", 40],
  ])("limite legal em %s: %i h", (dia, horas) => {
    expect(limiteLegalSemanal(dia)).toBe(horas);
  });

  it("jornada por semana: o menor entre o contrato e o limite; sem contrato, o limite", () => {
    expect(jornadaPorSemana(44, "2026-11-24")).toBe(44 * 60);
    expect(jornadaPorSemana(44, "2026-12-16")).toBe(42 * 60);
    expect(jornadaPorSemana(30, "2027-12-16")).toBe(30 * 60);
    expect(jornadaPorSemana(null, "2026-11-24")).toBe(44 * 60);
    expect(jornadaPorSemana(0, "2026-11-24")).toBe(44 * 60);
  });

  it("um período corrido desconta o intervalo; com dois períodos, não", () => {
    const corrido = [{ dia: "segunda", inicio: "08:00", fim: "17:00" }];
    expect(minutosDoTurno(corrido, "2026-11-23", 60)).toBe(480);
    expect(minutosDoTurno(corrido, "2026-11-23")).toBe(540);
    const dois = [
      { dia: "segunda", inicio: "08:00", fim: "12:00" },
      { dia: "segunda", inicio: "13:00", fim: "17:00" },
    ];
    expect(minutosDoTurno(dois, "2026-11-23", 60)).toBe(480);
  });
});

describe("T215 — avisos de legislação da jornada (gaveta)", () => {
  const SEG_SEX = ["segunda", "terca", "quarta", "quinta", "sexta"];
  const grade = (inicio: string, fim: string, pausa?: [string, string]) =>
    SEG_SEX.flatMap((dia) =>
      pausa
        ? [
            { dia, inicio, fim: pausa[0] },
            { dia, inicio: pausa[1], fim },
          ]
        : [{ dia, inicio, fim }],
    );
  const padrao = (
    modelo: string,
    turno: ReturnType<typeof grade>,
    intervaloTurno = 0,
  ) => ({
    modelo,
    turno,
    turnoNoite: null,
    intervaloTurno,
    folgaSemanal: modelo === "6x1" ? 7 : null,
    diasTrabalho: [],
    inicioCiclo: modelo === "12x36" ? "2026-11-02" : null,
    vigenciaInicio: "2026-11-02",
  });

  it("5x2 comercial de 8 h com 1 h de almoço: nenhum aviso", () => {
    expect(
      avisosDaJornada(
        padrao("5x2", grade("08:00", "17:00", ["12:00", "13:00"])),
        44,
        "2026-11-02",
      ),
    ).toEqual([]);
  });

  it("6x1 de 8 h: soma 48 h, acima do limite", () => {
    expect(
      avisosDaJornada(
        padrao("6x1", grade("08:00", "17:00", ["12:00", "13:00"])),
        44,
        "2026-11-02",
      ),
    ).toEqual([
      "Este padrão soma 48 h por semana, acima do limite de 44 h (jornada do contrato e EC 141/2026). O que passar disso é hora extra.",
    ]);
  });

  it("9 h corridas sem intervalo: pede 1 h de intervalo e passa do limite semanal", () => {
    const avisos = avisosDaJornada(
      padrao("5x2", grade("08:00", "17:00")),
      44,
      "2026-11-02",
    );
    expect(avisos).toContain(
      "Turno com mais de 6 h de trabalho precisa de intervalo de 1 h a 2 h (CLT, art. 71).",
    );
    expect(avisos).toContain(
      "Este padrão soma 45 h por semana, acima do limite de 44 h (jornada do contrato e EC 141/2026). O que passar disso é hora extra.",
    );
  });

  it("5 h corridas sem pausa: pede 15 min (art. 71, § 1º)", () => {
    expect(
      avisosDaJornada(padrao("5x2", grade("08:00", "13:00")), 44, "2026-11-02"),
    ).toEqual([
      "Turno de 4 h a 6 h precisa de pausa de 15 min (CLT, art. 71, § 1º).",
    ]);
  });

  it("intervalo acima de 2 h e dia acima de 10 h e descanso curto entre jornadas", () => {
    const avisos = avisosDaJornada(
      padrao("5x2", grade("06:00", "20:00", ["10:00", "13:00"])),
      44,
      "2026-11-02",
    );
    expect(avisos).toContain(
      "Intervalo acima de 2 h só vale com acordo escrito ou convenção coletiva (CLT, art. 71).",
    );
    expect(avisos).toContain(
      "Há dia com 11 h de trabalho: acima de 10 h por dia (8 h normais + 2 h extras, CLT, art. 59).",
    );
    expect(avisos).toContain(
      "Fica menos de 11 h de descanso entre um dia de trabalho e o seguinte (CLT, art. 66).",
    );
  });

  it("12x36 segue o art. 59-A: sem aviso de 12 h nem de limite semanal", () => {
    const doze = [
      "segunda",
      "terca",
      "quarta",
      "quinta",
      "sexta",
      "sabado",
      "domingo",
    ].flatMap((dia) => [{ dia, inicio: "07:00", fim: "19:00" }]);
    expect(
      avisosDaJornada(padrao("12x36", doze, 60), 44, "2026-11-02"),
    ).toEqual([]);
  });

  it("sem turno fixo: nada a avisar", () => {
    expect(
      avisosDaJornada({ ...padrao("5x2", []), turno: null }, 44, "2026-11-02"),
    ).toEqual([]);
  });
});

describe("T215 — feriados estaduais de data fixa", () => {
  it("pelo estado (UF): o nome no dia; outro estado ou sem UF, nenhum", () => {
    expect(feriadoEstadualDe("2026-07-09", "SP")).toBe(
      "Revolução Constitucionalista",
    );
    expect(feriadoEstadualDe("2027-07-09", "SP")).toBe(
      "Revolução Constitucionalista",
    );
    expect(feriadoEstadualDe("2026-07-09", "RJ")).toBeNull();
    expect(feriadoEstadualDe("2026-07-09", null)).toBeNull();
    expect(feriadoEstadualDe("2026-07-09", "XX")).toBeNull();
    expect(feriadoEstadualDe("2026-10-05", "TO")).toBe(
      "Criação do Estado do Tocantins",
    );
    expect(feriadoEstadualDe("2026-09-20", "RS")).toBe("Revolução Farroupilha");
    // Todas as chaves são UF e "MM-DD" válidos.
    for (const [uf, dias] of Object.entries(FERIADOS_ESTADUAIS)) {
      expect(uf).toMatch(/^[A-Z]{2}$/);
      for (const md of Object.keys(dias)) {
        expect(md).toMatch(/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/);
      }
    }
  });
});
