import { ORDEM_DAS_MOVIMENTACOES } from "./movimentacao.service";

/**
 * T190 (O2 da T188) — a ordem da listagem paginada é total: vigência e
 * registro, do mais novo ao mais antigo, e o `id` (único) como último
 * critério. A prova com banco real, de que não há repetição nem lacuna entre
 * páginas com data e horário iguais, está no E2E de Pessoas.
 */
describe("T190 (O2) — ordem estável das movimentações", () => {
  it("vigência, registro e, por último, o id", () => {
    expect(ORDEM_DAS_MOVIMENTACOES).toEqual([
      { vigenciaInicio: "desc" },
      { registradaEm: "desc" },
      { id: "desc" },
    ]);
  });
});
