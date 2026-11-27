import { escolherVinculoPrincipal } from "./vinculo-principal";

/**
 * T215 — o vínculo principal do colaborador no servidor, com a MESMA ordem da
 * listagem e da ficha: ativo, previsto, encerrado; depois a admissão mais
 * recente; empate, matrícula informada antes da ausente, em ordem alfabética.
 */
const v = (
  id: string,
  situacao: "ativo" | "previsto" | "encerrado",
  dataAdmissao: string,
  matricula: string | null = null,
) => ({ id, situacao, dataAdmissao: new Date(dataAdmissao), matricula });

describe("escolherVinculoPrincipal (T215)", () => {
  it("sem vínculos: null", () => {
    expect(escolherVinculoPrincipal([])).toBeNull();
  });

  it("ativo vence previsto e encerrado, mesmo mais antigo", () => {
    expect(
      escolherVinculoPrincipal([
        v("e", "encerrado", "2026-10-01"),
        v("p", "previsto", "2026-09-01"),
        v("a", "ativo", "2020-01-01"),
      ])?.id,
    ).toBe("a");
  });

  it("previsto vence encerrado", () => {
    expect(
      escolherVinculoPrincipal([
        v("e", "encerrado", "2026-10-01"),
        v("p", "previsto", "2020-01-01"),
      ])?.id,
    ).toBe("p");
  });

  it("na mesma situação, a admissão mais recente", () => {
    expect(
      escolherVinculoPrincipal([
        v("velho", "ativo", "2020-01-01"),
        v("novo", "ativo", "2024-01-01"),
      ])?.id,
    ).toBe("novo");
  });

  it("empate de data: com matrícula antes de sem; entre duas, a alfabética", () => {
    expect(
      escolherVinculoPrincipal([
        v("sem", "ativo", "2024-01-01", null),
        v("b", "ativo", "2024-01-01", "B2"),
        v("a", "ativo", "2024-01-01", "A1"),
      ])?.id,
    ).toBe("a");
  });

  it("não reordena a lista recebida", () => {
    const lista = [
      v("x", "encerrado", "2020-01-01"),
      v("y", "ativo", "2020-01-01"),
    ];
    escolherVinculoPrincipal(lista);
    expect(lista.map((l) => l.id)).toEqual(["x", "y"]);
  });
});
