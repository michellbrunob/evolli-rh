import {
  comDesativacaoVigente,
  grupoExcluiDesativados,
  semDesativacaoVigente,
} from "./desativacao";

/**
 * T215 — desativação do colaborador NA EMPRESA (lixeira do "Editar
 * colaborador"): só a desativação VIGENTE (`reativadoEm` nulo) conta. Na
 * empresa ativa, a da empresa; sem empresa (master global), qualquer uma.
 */
const EMPRESA = "0d9f8e7c-6b5a-4f3e-8d2c-1b0a9f8e7d6c";

describe("T215 — filtros da desativação", () => {
  it("escopado: só a desativação vigente da empresa", () => {
    expect(semDesativacaoVigente(EMPRESA)).toEqual({
      desativacoes: { none: { empresaId: EMPRESA, reativadoEm: null } },
    });
    expect(comDesativacaoVigente(EMPRESA)).toEqual({
      desativacoes: { some: { empresaId: EMPRESA, reativadoEm: null } },
    });
  });

  it("global: a desativação vigente em qualquer empresa", () => {
    expect(semDesativacaoVigente(undefined)).toEqual({
      desativacoes: { none: { reativadoEm: null } },
    });
    expect(comDesativacaoVigente(undefined)).toEqual({
      desativacoes: { some: { reativadoEm: null } },
    });
  });

  it("Ativos, Em admissão e Desligados excluem o desativado; Todos (sem grupo) não", () => {
    expect(grupoExcluiDesativados("ativos")).toBe(true);
    expect(grupoExcluiDesativados("em_admissao")).toBe(true);
    expect(grupoExcluiDesativados("desligados")).toBe(true);
    expect(grupoExcluiDesativados(undefined)).toBe(false);
  });
});
