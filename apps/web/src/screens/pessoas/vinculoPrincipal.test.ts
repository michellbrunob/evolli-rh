import { describe, expect, it } from "vitest";
import { vinculoPrincipal } from "./vinculoPrincipal";
import type { VinculoApi } from "../../api/colaboradoresClient";

/** T187 — mesma ordem da listagem do servidor (`ordenarVinculosListados`). */
function vinculo(
  id: string,
  situacao: VinculoApi["situacao"],
  dataAdmissao: string,
  matricula: string | null = `MAT-${id}`,
): VinculoApi {
  return {
    id,
    colaboradorId: "c-1",
    empresaId: "e-1",
    matricula,
    tipo: "clt",
    situacao,
    dataAdmissao,
    dataDesligamento: null,
    criadoEm: "2025-01-01T12:00:00.000Z",
    atualizadoEm: "2025-01-01T12:00:00.000Z",
  };
}

describe("T187 — vínculo principal da ficha", () => {
  it("sem vínculo: nenhum", () => {
    expect(vinculoPrincipal([])).toBeNull();
  });

  it("ativo antes de previsto e de encerrado, mesmo mais antigo", () => {
    const principal = vinculoPrincipal([
      vinculo("p", "previsto", "2026-05-01"),
      vinculo("e", "encerrado", "2026-01-01"),
      vinculo("a", "ativo", "2020-01-01"),
    ]);
    expect(principal?.id).toBe("a");
  });

  it("previsto antes de encerrado", () => {
    expect(
      vinculoPrincipal([
        vinculo("e", "encerrado", "2026-01-01"),
        vinculo("p", "previsto", "2024-01-01"),
      ])?.id,
    ).toBe("p");
  });

  it("mesma situação: a admissão mais recente", () => {
    expect(
      vinculoPrincipal([
        vinculo("velho", "encerrado", "2019-01-01"),
        vinculo("novo", "encerrado", "2023-01-01T00:00:00.000Z"),
      ])?.id,
    ).toBe("novo");
  });

  it("empate: matrícula informada antes da ausente; entre duas, a ordem alfabética", () => {
    expect(
      vinculoPrincipal([
        vinculo("sem", "previsto", "2026-01-01", null),
        vinculo("b", "previsto", "2026-01-01", "MAT-B"),
        vinculo("a", "previsto", "2026-01-01", "MAT-A"),
      ])?.id,
    ).toBe("a");
  });

  it("não altera a lista recebida", () => {
    const lista = [
      vinculo("e", "encerrado", "2026-01-01"),
      vinculo("a", "ativo", "2020-01-01"),
    ];
    vinculoPrincipal(lista);
    expect(lista.map((v) => v.id)).toEqual(["e", "a"]);
  });
});
