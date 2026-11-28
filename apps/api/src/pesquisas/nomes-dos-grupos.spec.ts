import { distinguirNomesRepetidos } from "./nomes-dos-grupos";
import { catalogoAtivo } from "./pessoas-da-pesquisa";

/**
 * T216 — escolha de grupo na anônima: departamentos (centros de custo,
 * unidades) com o mesmo nome ganham o código, para quem responde
 * diferenciar. Dados sintéticos.
 */

describe("T216 — distinguirNomesRepetidos", () => {
  it("nome repetido ganha o código entre parênteses; o único fica como está", () => {
    expect(
      distinguirNomesRepetidos([
        { id: "d-1", nome: "Comercial", codigo: "D01" },
        { id: "d-2", nome: "Comercial", codigo: "D02" },
        { id: "d-3", nome: "Financeiro", codigo: "D03" },
      ]),
    ).toEqual([
      { id: "d-1", nome: "Comercial (D01)" },
      { id: "d-2", nome: "Comercial (D02)" },
      { id: "d-3", nome: "Financeiro" },
    ]);
  });

  it("compara sem maiúsculas, acentos e espaços nas pontas", () => {
    expect(
      distinguirNomesRepetidos([
        { id: "d-1", nome: "Operações", codigo: "OP1" },
        { id: "d-2", nome: " operacoes ", codigo: "OP2" },
      ]).map((o) => o.nome),
    ).toEqual(["Operações (OP1)", "operacoes (OP2)"]);
  });

  it("sem código para mostrar, mantém o nome; nunca devolve o código à parte", () => {
    const saida = distinguirNomesRepetidos([
      { id: "u-1", nome: "Matriz", codigo: "  " },
      { id: "u-2", nome: "Matriz", codigo: "M2" },
    ]);
    expect(saida).toEqual([
      { id: "u-1", nome: "Matriz" },
      { id: "u-2", nome: "Matriz (M2)" },
    ]);
    expect(Object.keys(saida[0]!)).toEqual(["id", "nome"]);
  });
});

describe("T216 — catalogoAtivo (escolha de grupo da página pública)", () => {
  const banco = (itens: { id: string; nome: string; codigo: string }[]) => {
    const findMany = jest.fn(() => Promise.resolve(itens));
    return {
      findMany,
      db: {
        departamento: { findMany },
        centroCusto: { findMany },
        unidadeOrganizacional: { findMany },
      } as unknown as Parameters<typeof catalogoAtivo>[0],
    };
  };

  it.each(["departamento", "centroCusto", "unidade"] as const)(
    "%s: pede o código ao banco e diferencia os nomes repetidos",
    async (campo) => {
      const { db, findMany } = banco([
        { id: "g-1", nome: "Comercial", codigo: "C1" },
        { id: "g-2", nome: "Comercial", codigo: "C2" },
        { id: "g-3", nome: "Suporte", codigo: "S1" },
      ]);
      await expect(catalogoAtivo(db, "e-1", campo)).resolves.toEqual([
        { id: "g-1", nome: "Comercial (C1)" },
        { id: "g-2", nome: "Comercial (C2)" },
        { id: "g-3", nome: "Suporte" },
      ]);
      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { empresaId: "e-1", status: "ativo" },
          select: { id: true, nome: true, codigo: true },
        }),
      );
    },
  );
});
