/**
 * T203 — quem lê as Solicitações de Pessoas na ficha e a correção da rota
 * para quem não lê. Espelha `evaluateSolicitacoesPessoas` (rbac.evaluator.ts):
 * `rh` e `master_tecnico` leem; `dp` e os demais papéis, não.
 */
import { describe, expect, it } from "vitest";
import { fichaParaOPapel, podeLerSolicitacoesPessoas } from "./mapaNavegacao";

const ID = "11111111-1111-4111-8111-111111111111";

describe("T203 — podeLerSolicitacoesPessoas", () => {
  it.each(["rh", "master_tecnico"])("%s lê", (papel) => {
    expect(podeLerSolicitacoesPessoas(papel)).toBe(true);
  });

  it.each([
    "dp",
    "gestor",
    "colaborador",
    "financeiro",
    "admin_tecnico",
    "auditor",
    "dpo",
    null,
  ])("%s não lê", (papel) => {
    expect(podeLerSolicitacoesPessoas(papel)).toBe(false);
  });
});

describe("T203 — fichaParaOPapel", () => {
  it("DP pedindo Solicitações recebe Dados do colaborador", () => {
    expect(
      fichaParaOPapel({ colaboradorId: ID, aba: "solicitacoes" }, "dp"),
    ).toEqual({ colaboradorId: ID, aba: "dados" });
  });

  it("RH e master mantêm Solicitações; outras abas e a listagem não mudam", () => {
    for (const papel of ["rh", "master_tecnico"]) {
      expect(
        fichaParaOPapel({ colaboradorId: ID, aba: "solicitacoes" }, papel),
      ).toEqual({ colaboradorId: ID, aba: "solicitacoes" });
    }
    const ponto = { colaboradorId: ID, aba: "ponto", competencia: "2026-10" };
    expect(fichaParaOPapel(ponto, "dp")).toBe(ponto);
    expect(fichaParaOPapel(null, "dp")).toBeNull();
  });
});
