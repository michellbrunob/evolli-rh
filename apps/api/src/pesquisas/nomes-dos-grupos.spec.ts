import { distinguirNomesRepetidos } from "./nomes-dos-grupos";
import { catalogoAtivo, nomesDosGrupos } from "./pessoas-da-pesquisa";

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

describe("T216 — nomesDosGrupos (resultados, análises e exportações)", () => {
  type Item = { id: string; nome: string; codigo: string };
  const banco = (catalogos: {
    departamento?: Item[];
    centroCusto?: Item[];
    unidade?: Item[];
  }) => {
    const chamado = (itens: Item[] = []) =>
      jest.fn(() => Promise.resolve(itens));
    const departamento = { findMany: chamado(catalogos.departamento) };
    const centroCusto = { findMany: chamado(catalogos.centroCusto) };
    const unidadeOrganizacional = { findMany: chamado(catalogos.unidade) };
    return {
      departamento,
      db: {
        departamento,
        centroCusto,
        unidadeOrganizacional,
      } as unknown as Parameters<typeof nomesDosGrupos>[0],
    };
  };

  it("nome repetido no catálogo ganha o código; os pedidos vêm no mapa", async () => {
    const { db } = banco({
      departamento: [
        { id: "d-1", nome: "Comercial", codigo: "C1" },
        { id: "d-2", nome: "Comercial", codigo: "C2" },
        { id: "d-3", nome: "Suporte", codigo: "S1" },
      ],
      unidade: [{ id: "u-1", nome: "Matriz", codigo: "M1" }],
    });
    const mapa = await nomesDosGrupos(db, "e-1", ["d-1", "d-3", "u-1"]);
    expect([...mapa.entries()]).toEqual([
      ["d-1", "Comercial (C1)"],
      ["d-3", "Suporte"],
      ["u-1", "Matriz"],
    ]);
  });

  it("compara com o catálogo ativo e os grupos pedidos, mesmo inativos", async () => {
    const { db, departamento } = banco({
      departamento: [
        { id: "d-1", nome: "Comercial", codigo: "C1" },
        { id: "d-9", nome: "comercial ", codigo: "C9" },
      ],
    });
    const mapa = await nomesDosGrupos(db, "e-1", ["d-9"]);
    expect(mapa.get("d-9")).toBe("comercial (C9)");
    expect(mapa.has("d-1")).toBe(false);
    expect(departamento.findMany).toHaveBeenCalledWith({
      where: {
        empresaId: "e-1",
        OR: [{ status: "ativo" }, { id: { in: ["d-9"] } }],
      },
      select: { id: true, nome: true, codigo: true },
    });
  });

  it("sem ids, nem consulta o banco", async () => {
    const { db, departamento } = banco({});
    await expect(nomesDosGrupos(db, "e-1", [])).resolves.toEqual(new Map());
    expect(departamento.findMany).not.toHaveBeenCalled();
  });
});
