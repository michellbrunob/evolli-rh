import {
  MODELOS_DE_ESCALA,
  conferirPadrao,
  mesmoPadrao,
} from "./padrao-escala";

describe("T215 — padrão de escala (regras puras)", () => {
  it("os 25 modelos do contrato, em 5 tipos", () => {
    expect(Object.keys(MODELOS_DE_ESCALA)).toHaveLength(25);
    expect(MODELOS_DE_ESCALA["5x2"].tipo).toBe("semanal");
    expect(MODELOS_DE_ESCALA["6x2"].tipo).toBe("revezamento");
    expect(MODELOS_DE_ESCALA["12x36"].tipo).toBe("plantao");
    expect(MODELOS_DE_ESCALA["14x21"].tipo).toBe("embarque");
    expect(MODELOS_DE_ESCALA.outra.tipo).toBe("outra");
  });

  it("semana fixa: sem ciclo, sem folga escolhida, sem dias, sem turno da noite", () => {
    expect(conferirPadrao({ modelo: "5x2" })).toEqual([]);
    expect(
      conferirPadrao({
        modelo: "5x2",
        inicioCiclo: "2026-01-05",
        folgaSemanal: 7,
        diasTrabalho: [1],
        turnoNoiteId: "x",
      }),
    ).toEqual([
      { campo: "turnoNoiteId", motivo: "nao_se_aplica" },
      { campo: "folgaSemanal", motivo: "nao_se_aplica" },
      { campo: "diasTrabalho", motivo: "nao_se_aplica" },
      { campo: "inicioCiclo", motivo: "nao_se_aplica" },
    ]);
  });

  it("6x1: a folga semanal (DSR) é obrigatória", () => {
    expect(conferirPadrao({ modelo: "6x1" })).toEqual([
      { campo: "folgaSemanal", motivo: "obrigatorio" },
    ]);
    expect(conferirPadrao({ modelo: "6x1", folgaSemanal: 3 })).toEqual([]);
  });

  it("outra: ao menos um dia de trabalho, sem repetir", () => {
    expect(conferirPadrao({ modelo: "outra" })).toEqual([
      { campo: "diasTrabalho", motivo: "obrigatorio" },
    ]);
    expect(conferirPadrao({ modelo: "outra", diasTrabalho: [] })).toEqual([
      { campo: "diasTrabalho", motivo: "obrigatorio" },
    ]);
    expect(conferirPadrao({ modelo: "outra", diasTrabalho: [1, 1] })).toEqual([
      { campo: "diasTrabalho", motivo: "invalido" },
    ]);
    expect(
      conferirPadrao({ modelo: "outra", diasTrabalho: [1, 3, 5] }),
    ).toEqual([]);
  });

  it("revezamento, plantão e embarque: início do ciclo obrigatório", () => {
    for (const modelo of ["4x2", "24x48", "14x14"]) {
      expect(conferirPadrao({ modelo })).toEqual([
        { campo: "inicioCiclo", motivo: "obrigatorio" },
      ]);
      expect(conferirPadrao({ modelo, inicioCiclo: "2026-02-01" })).toEqual([]);
    }
  });

  it("turno da noite só no 12x36", () => {
    expect(
      conferirPadrao({
        modelo: "12x36",
        inicioCiclo: "2026-02-01",
        turnoNoiteId: "n",
      }),
    ).toEqual([]);
    expect(
      conferirPadrao({
        modelo: "24x48",
        inicioCiclo: "2026-02-01",
        turnoNoiteId: "n",
      }),
    ).toEqual([{ campo: "turnoNoiteId", motivo: "nao_se_aplica" }]);
  });

  it("mesmo padrão: compara modelo, turnos, folga, dias e ciclo", () => {
    const a = {
      modelo: "outra",
      tabelaHorarioId: "t",
      turnoNoiteId: null,
      folgaSemanal: null,
      diasTrabalho: [5, 1],
      inicioCiclo: null,
    };
    expect(mesmoPadrao(a, { ...a, diasTrabalho: [1, 5] })).toBe(true);
    expect(mesmoPadrao(a, { ...a, tabelaHorarioId: null })).toBe(false);
    expect(mesmoPadrao(a, { ...a, diasTrabalho: [1] })).toBe(false);
  });
});
