import { montarLinhaDoTempo } from "./linha-do-tempo-salarial";

const linha = (
  id: string,
  vigenciaInicio: string,
  salario: string,
  origem: "admissao" | "alteracao" = "alteracao",
) => ({
  id,
  origem,
  vigenciaInicio: new Date(`${vigenciaInicio}T00:00:00Z`),
  salarioBruto: { toFixed: () => salario },
  cargo: null,
  modeloContrato: null,
});

/** Hoje (dia civil de São Paulo) nos testes: depois de todas as linhas. */
const HOJE = "2026-11-26";

describe("T215 — montarLinhaDoTempo", () => {
  it("vazia sem linhas", () => {
    expect(montarLinhaDoTempo([], HOJE)).toEqual([]);
  });

  it("ordena da mais nova para a mais antiga, sem depender da ordem de entrada", () => {
    const r = montarLinhaDoTempo(
      [
        linha("a", "2024-01-05", "2000.00", "admissao"),
        linha("c", "2026-02-01", "3000.00"),
        linha("b", "2025-03-01", "2500.00"),
      ],
      HOJE,
    );
    expect(r.map((a) => a.id)).toEqual(["c", "b", "a"]);
  });

  it("só a mais nova é vigente e fica aberta; cada outra fecha na véspera da seguinte", () => {
    const r = montarLinhaDoTempo(
      [
        linha("a", "2024-01-05", "2000.00", "admissao"),
        linha("b", "2025-03-01", "2500.00"),
        linha("c", "2026-01-01", "3000.00"),
      ],
      HOJE,
    );
    expect(r.map((a) => [a.id, a.vigente, a.vigenciaFim])).toEqual([
      ["c", true, null],
      ["b", false, "2025-12-31"],
      ["a", false, "2025-02-28"],
    ]);
  });

  it("devolve dias civis e o salário em texto com 2 casas", () => {
    const [a] = montarLinhaDoTempo(
      [linha("a", "2024-01-05", "1621.00", "admissao")],
      HOJE,
    );
    expect(a).toEqual({
      id: "a",
      origem: "admissao",
      vigenciaInicio: "2024-01-05",
      vigenciaFim: null,
      salarioBruto: "1621.00",
      cargo: null,
      modeloContrato: null,
      vigente: true,
    });
  });

  it("admissão futura: nenhuma linha é vigente antes do início", () => {
    const [a] = montarLinhaDoTempo(
      [linha("a", "2026-12-01", "2000.00", "admissao")],
      "2026-11-30",
    );
    expect(a).toMatchObject({ vigente: false, vigenciaFim: null });
  });

  it("vigente é a mais nova com início até hoje (inclusive)", () => {
    const r = montarLinhaDoTempo(
      [
        linha("a", "2024-01-05", "2000.00", "admissao"),
        linha("b", "2026-11-26", "2500.00"),
      ],
      "2026-11-26",
    );
    expect(r.map((x) => [x.id, x.vigente])).toEqual([
      ["b", true],
      ["a", false],
    ]);
  });
});
