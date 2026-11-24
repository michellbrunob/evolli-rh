import { describe, expect, it } from "vitest";
import {
  cargaSemanal,
  diasDeTrabalho,
  formatarDuracao,
  gradeDaSemana,
  horarioTipico,
  intervaloTipico,
  resumoDosDias,
} from "./resumoDaEscala";

const COMERCIAL = ["segunda", "terca", "quarta", "quinta", "sexta"].flatMap(
  (dia) => [
    { dia, inicio: "08:00", fim: "12:00" },
    { dia, inicio: "13:00", fim: "17:48" },
  ],
);

describe("resumo da escala (grade semanal da jornada)", () => {
  it("carga semanal em minutos e por extenso", () => {
    expect(cargaSemanal(COMERCIAL)).toBe(44 * 60);
    expect(formatarDuracao(44 * 60)).toBe("44 h");
    expect(formatarDuracao(42 * 60 + 30)).toBe("42 h 30 min");
    expect(formatarDuracao(15)).toBe("15 min");
    expect(formatarDuracao(0)).toBe("0 h");
  });

  it("grade dos 7 dias, de segunda a domingo, com folgas", () => {
    const grade = gradeDaSemana([
      { dia: "sabado", inicio: "08:00", fim: "12:00" },
      ...COMERCIAL,
    ]);
    expect(grade.map((d) => d.dia)).toEqual([
      "segunda",
      "terca",
      "quarta",
      "quinta",
      "sexta",
      "sabado",
      "domingo",
    ]);
    expect(grade[0]).toMatchObject({
      curto: "Seg",
      nome: "Segunda",
      minutos: 528,
      intervalo: 60,
    });
    expect(grade[0]!.periodos).toEqual([
      { inicio: "08:00", fim: "12:00" },
      { inicio: "13:00", fim: "17:48" },
    ]);
    expect(grade[5]).toMatchObject({ curto: "Sáb", minutos: 240 });
    expect(grade[6]).toMatchObject({ curto: "Dom", minutos: 0, periodos: [] });
  });

  it("ordena os períodos do dia mesmo fora de ordem", () => {
    const grade = gradeDaSemana([
      { dia: "segunda", inicio: "13:00", fim: "17:00" },
      { dia: "segunda", inicio: "08:00", fim: "12:00" },
    ]);
    expect(grade[0]!.periodos[0]!.inicio).toBe("08:00");
    expect(grade[0]!.intervalo).toBe(60);
  });

  it("dias de trabalho: sequência vira faixa; salteados viram lista", () => {
    expect(diasDeTrabalho(COMERCIAL)).toBe(5);
    expect(resumoDosDias(COMERCIAL)).toBe("Segunda a sexta");
    expect(
      resumoDosDias([
        { dia: "segunda", inicio: "08:00", fim: "12:00" },
        { dia: "quarta", inicio: "08:00", fim: "12:00" },
        { dia: "sexta", inicio: "08:00", fim: "12:00" },
      ]),
    ).toBe("Seg, Qua e Sex");
    expect(
      resumoDosDias([{ dia: "sabado", inicio: "08:00", fim: "12:00" }]),
    ).toBe("Sábado");
    expect(resumoDosDias([])).toBe("Sem dias de trabalho");
  });

  it("horário típico: igual em todos os dias, ou 'varia por dia'", () => {
    expect(horarioTipico(COMERCIAL)).toBe("08:00–17:48");
    expect(
      horarioTipico([
        ...COMERCIAL,
        { dia: "sabado", inicio: "08:00", fim: "12:00" },
      ]),
    ).toBe("Varia por dia");
    expect(horarioTipico([])).toBeNull();
  });

  it("intervalo típico: igual, sem intervalo, ou 'varia por dia'", () => {
    expect(intervaloTipico(COMERCIAL)).toBe("1 h por dia");
    expect(
      intervaloTipico([{ dia: "segunda", inicio: "08:00", fim: "14:00" }]),
    ).toBe("Sem intervalo");
    expect(
      intervaloTipico([
        ...COMERCIAL,
        { dia: "sabado", inicio: "08:00", fim: "12:00" },
      ]),
    ).toBe("Varia por dia");
    expect(intervaloTipico([])).toBeNull();
  });

  it("dia desconhecido vindo do servidor é ignorado, sem quebrar", () => {
    expect(
      cargaSemanal([
        { dia: "feriado", inicio: "08:00", fim: "12:00" },
        { dia: "segunda", inicio: "08:00", fim: "09:00" },
      ]),
    ).toBe(60);
  });
});
