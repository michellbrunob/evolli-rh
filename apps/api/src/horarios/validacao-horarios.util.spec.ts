import { UnprocessableEntityException } from "@nestjs/common";
import {
  diaParaNumero,
  formatarHora,
  minutosDe,
  normalizarPeriodos,
  numeroParaDia,
} from "./validacao-horarios.util";

describe("validacao-horarios.util", () => {
  describe("mapeamento de dia e hora", () => {
    it("mapeia dia <-> numero 1..7", () => {
      expect(diaParaNumero("segunda")).toBe(1);
      expect(diaParaNumero("domingo")).toBe(7);
      expect(numeroParaDia(1)).toBe("segunda");
      expect(numeroParaDia(6)).toBe("sabado");
    });

    it("converte HH:MM <-> minutos", () => {
      expect(minutosDe("00:00")).toBe(0);
      expect(minutosDe("08:30")).toBe(510);
      expect(minutosDe("18:18")).toBe(1098);
      expect(formatarHora(0)).toBe("00:00");
      expect(formatarHora(510)).toBe("08:30");
      expect(formatarHora(1098)).toBe("18:18");
    });
  });

  describe("normalizarPeriodos", () => {
    it("normaliza uma grade valida com dois periodos no mesmo dia", () => {
      const resultado = normalizarPeriodos([
        { dia: "segunda", inicio: "08:00", fim: "12:00" },
        { dia: "segunda", inicio: "13:00", fim: "18:00" },
      ]);
      expect(resultado).toEqual([
        { diaSemana: 1, inicioMinuto: 480, fimMinuto: 720 },
        { diaSemana: 1, inicioMinuto: 780, fimMinuto: 1080 },
      ]);
    });

    it("aceita lista vazia (tabela sem jornada prevista)", () => {
      expect(normalizarPeriodos([])).toEqual([]);
    });

    it("aceita periodos adjacentes no mesmo dia (fim == inicio seguinte)", () => {
      expect(() =>
        normalizarPeriodos([
          { dia: "terca", inicio: "08:00", fim: "12:00" },
          { dia: "terca", inicio: "12:00", fim: "13:00" },
        ]),
      ).not.toThrow();
    });

    it("rejeita saida antes ou igual a entrada", () => {
      expect(() =>
        normalizarPeriodos([{ dia: "quarta", inicio: "12:00", fim: "08:00" }]),
      ).toThrow(UnprocessableEntityException);
      expect(() =>
        normalizarPeriodos([{ dia: "quarta", inicio: "12:00", fim: "12:00" }]),
      ).toThrow(UnprocessableEntityException);
    });

    it("rejeita sobreposicao de periodos do mesmo dia", () => {
      expect(() =>
        normalizarPeriodos([
          { dia: "quinta", inicio: "08:00", fim: "12:00" },
          { dia: "quinta", inicio: "11:00", fim: "15:00" },
        ]),
      ).toThrow(UnprocessableEntityException);
    });

    it("nao confunde sobreposicao entre dias diferentes", () => {
      expect(() =>
        normalizarPeriodos([
          { dia: "sexta", inicio: "08:00", fim: "12:00" },
          { dia: "sabado", inicio: "08:00", fim: "12:00" },
        ]),
      ).not.toThrow();
    });

    it("detecta sobreposicao independente da ordem de entrada", () => {
      expect(() =>
        normalizarPeriodos([
          { dia: "segunda", inicio: "13:00", fim: "18:00" },
          { dia: "segunda", inicio: "08:00", fim: "14:00" },
        ]),
      ).toThrow(UnprocessableEntityException);
    });
  });
});
