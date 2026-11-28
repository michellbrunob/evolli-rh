/**
 * T216 — "Separar respostas por" com nomes repetidos: o painel diferencia
 * pelo código do cadastro (o mesmo que a página pública recebe da API).
 * Dados sintéticos.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("../../api/organizacaoClient", async (original) => {
  const real = await original<typeof import("../../api/organizacaoClient")>();
  const pagina = <T>(itens: T[]) =>
    Promise.resolve({ itens, total: itens.length, pagina: 1 });
  return {
    ...real,
    listarDepartamentos: vi.fn(() =>
      pagina([
        { id: "d-1", codigo: "D01", nome: "Comercial" },
        { id: "d-2", codigo: "D02", nome: "comercial " },
        { id: "d-3", codigo: "D03", nome: "Financeiro" },
      ]),
    ),
    listarCentrosCusto: vi.fn(() =>
      pagina([{ id: "c-1", codigo: "CC1", nome: "Administrativo" }]),
    ),
    listarUnidades: vi.fn(() =>
      pagina([
        { id: "u-1", codigo: "SP", nome: "Loja" },
        { id: "u-2", codigo: "RJ", nome: "Loja" },
      ]),
    ),
    listarAreas: vi.fn(() => pagina([])),
  };
});

const { distinguirNomesRepetidos } = await import("./nomesDosGrupos");
const { servicoDePesquisasDoServidor } = await import("./servicoDePesquisas");

describe("R3-A-18 — nomes repetidos nos grupos", () => {
  it("o repetido ganha o código; o único fica como está", () => {
    expect(
      distinguirNomesRepetidos([
        { id: "a", nome: "Vendas", codigo: "V1" },
        { id: "b", nome: "Vendas", codigo: "V2" },
        { id: "c", nome: "Suporte", codigo: "S1" },
        { id: "d", nome: "Logística", codigo: null },
      ]),
    ).toEqual([
      { id: "a", nome: "Vendas (V1)" },
      { id: "b", nome: "Vendas (V2)" },
      { id: "c", nome: "Suporte" },
      { id: "d", nome: "Logística" },
    ]);
  });

  it("compara sem acento, maiúsculas e espaços nas pontas", () => {
    expect(
      distinguirNomesRepetidos([
        { id: "a", nome: "Operações", codigo: "O1" },
        { id: "b", nome: "OPERACOES ", codigo: "O2" },
      ]).map((o) => o.nome),
    ).toEqual(["Operações (O1)", "OPERACOES (O2)"]);
  });

  it("o serviço do painel entrega os grupos já diferenciados", async () => {
    const grupos = await servicoDePesquisasDoServidor.listarGrupos();
    expect(grupos.departamento).toEqual([
      { id: "d-1", nome: "Comercial (D01)" },
      { id: "d-2", nome: "comercial (D02)" },
      { id: "d-3", nome: "Financeiro" },
    ]);
    expect(grupos.unidade.map((o) => o.nome)).toEqual([
      "Loja (SP)",
      "Loja (RJ)",
    ]);
    expect(grupos.centroCusto).toEqual([{ id: "c-1", nome: "Administrativo" }]);
  });
});
