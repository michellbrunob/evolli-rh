import {
  diasPeloModelo,
  diasUteisDoMes,
  feriadoEstadualFixo,
} from "./dias-beneficio";

/**
 * T215 — dias do mês para os benefícios pagos por dia (como a referência):
 * dias úteis = segunda a sexta, sem feriados nacionais, os do estado da
 * empresa e os municipais da empresa; pela escala do cadastro, a proporção
 * de trabalho do modelo sobre os dias do mês (12x36 = 15, 6x1 = 26).
 */
describe("T215 — dias úteis do mês", () => {
  it("novembro/2026: 21 dias de semana, menos Finados e Consciência Negra = 19", () => {
    expect(diasUteisDoMes("2026-11", null, [])).toBe(19);
  });

  it("dezembro/2026: 22 (Natal numa sexta)", () => {
    expect(diasUteisDoMes("2026-12", "SP", [])).toBe(22);
  });

  it("feriado do estado da empresa conta; o de outro estado, não", () => {
    // 09/07/2026 (quinta): Revolução Constitucionalista (SP).
    expect(diasUteisDoMes("2026-07", "SP", [])).toBe(22);
    expect(diasUteisDoMes("2026-07", "RJ", [])).toBe(23);
    expect(feriadoEstadualFixo("2026-07-09", "SP")).toBe(true);
    expect(feriadoEstadualFixo("2026-07-09", "RJ")).toBe(false);
  });

  it("feriado municipal em dia de semana tira um dia; no fim de semana, não", () => {
    expect(diasUteisDoMes("2026-11", null, ["2026-11-10"])).toBe(18);
    expect(diasUteisDoMes("2026-11", null, ["2026-11-14"])).toBe(19);
    // Repetido com um nacional: conta uma vez só.
    expect(diasUteisDoMes("2026-11", null, ["2026-11-02"])).toBe(19);
  });
});

describe("T215 — dias pela escala do cadastro", () => {
  it("12x36 = 15 e 6x1 = 26 num mês de 30 dias", () => {
    expect(diasPeloModelo("12x36", "2026-11")).toBe(15);
    expect(diasPeloModelo("6x1", "2026-11")).toBe(26);
  });

  it("revezamento, embarque e semanais", () => {
    expect(diasPeloModelo("2x2", "2026-11")).toBe(15);
    expect(diasPeloModelo("14x14", "2026-11")).toBe(15);
    expect(diasPeloModelo("4x3", "2026-11")).toBe(17);
    expect(diasPeloModelo("fim_de_semana", "2026-11")).toBe(9);
    expect(diasPeloModelo("semana_espanhola", "2026-11")).toBe(24);
  });

  it("5x2, outra e sem escala: os dias úteis (null aqui)", () => {
    expect(diasPeloModelo("5x2", "2026-11")).toBeNull();
    expect(diasPeloModelo("outra", "2026-11")).toBeNull();
    expect(diasPeloModelo(null, "2026-11")).toBeNull();
    expect(diasPeloModelo("desconhecida", "2026-11")).toBeNull();
  });
});
