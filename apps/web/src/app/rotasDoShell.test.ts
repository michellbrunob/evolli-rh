import { describe, expect, it } from "vitest";
import {
  ESTADO_INICIAL_DA_LISTAGEM,
  destinoDaRota,
  listagemDaRota,
  normalizarEstadoDaListagem,
  rotaDaListagem,
} from "./rotasDoShell";

/**
 * T199 — o estado do dashboard de Colaboradores na URL (D-3): aba, página e
 * ids de filtros; nunca a busca. Valor inválido cai no padrão seguro (N-6).
 */

const DEP = "11111111-1111-4111-8111-111111111111";
const CAR = "22222222-2222-4222-8222-222222222222";
const ROTA = "#/pessoas/colaboradores";

describe("T199 — listagemDaRota", () => {
  it("a rota pura é o estado inicial: Ativos, página 1, sem filtros", () => {
    expect(listagemDaRota(ROTA)).toEqual(ESTADO_INICIAL_DA_LISTAGEM);
    expect(ESTADO_INICIAL_DA_LISTAGEM).toEqual({
      aba: "ativos",
      pagina: 1,
      departamentoId: null,
      cargoId: null,
      tipo: null,
    });
  });

  it("lê aba, página, departamento, cargo e tipo", () => {
    expect(
      listagemDaRota(
        `${ROTA}?aba=todos&pagina=3&departamento=${DEP}&cargo=${CAR}&tipo=pj`,
      ),
    ).toEqual({
      aba: "todos",
      pagina: 3,
      departamentoId: DEP,
      cargoId: CAR,
      tipo: "pj",
    });
  });

  it("não é a rota da listagem: devolve null (a ficha, outro destino)", () => {
    expect(listagemDaRota(`${ROTA}/${DEP}`)).toBeNull();
    expect(listagemDaRota("#/pessoas/colaboradoresx")).toBeNull();
    expect(listagemDaRota("#/ponto")).toBeNull();
    expect(listagemDaRota("")).toBeNull();
  });

  it.each([
    ["aba desconhecida", "aba=inativos", { aba: "ativos" }],
    ["página zero", "pagina=0", { pagina: 1 }],
    ["página negativa", "pagina=-2", { pagina: 1 }],
    ["página com zero à esquerda", "pagina=02", { pagina: 1 }],
    ["página fracionária", "pagina=1.5", { pagina: 1 }],
    ["página não numérica", "pagina=abc", { pagina: 1 }],
    ["página acima do teto", "pagina=999999", { pagina: 1 }],
    ["departamento que não é UUID", "departamento=1", { departamentoId: null }],
    ["cargo que não é UUID", "cargo=x'or'1", { cargoId: null }],
    ["tipo fora dos controlados", "tipo=autonomo", { tipo: null }],
  ])("%s cai no padrão seguro", (_caso, query, esperado) => {
    expect(listagemDaRota(`${ROTA}?${query}`)).toEqual({
      ...ESTADO_INICIAL_DA_LISTAGEM,
      ...esperado,
    });
  });

  it("ignora a busca e qualquer outro parâmetro colado na URL", () => {
    expect(
      listagemDaRota(`${ROTA}?aba=desligados&busca=Maria&q=MAT-1&cpf=1`),
    ).toEqual({ ...ESTADO_INICIAL_DA_LISTAGEM, aba: "desligados" });
  });

  it("UUID em maiúsculas vira minúsculas (a mesma URL para o mesmo filtro)", () => {
    expect(
      listagemDaRota(`${ROTA}?departamento=${DEP.toUpperCase()}`)
        ?.departamentoId,
    ).toBe(DEP);
  });

  it("lotação só onde ela existe: Em admissão e Desligados descartam os ids", () => {
    for (const aba of ["em-admissao", "desligados"]) {
      expect(
        listagemDaRota(
          `${ROTA}?aba=${aba}&departamento=${DEP}&cargo=${CAR}&tipo=clt`,
        ),
      ).toEqual({
        ...ESTADO_INICIAL_DA_LISTAGEM,
        aba,
        tipo: "clt",
      });
    }
  });

  it("a aba Jornada não leva página, lotação nem tipo", () => {
    expect(
      listagemDaRota(
        `${ROTA}?aba=jornada&pagina=4&departamento=${DEP}&tipo=pj`,
      ),
    ).toEqual({ ...ESTADO_INICIAL_DA_LISTAGEM, aba: "jornada" });
  });
});

describe("T199 — rotaDaListagem", () => {
  it("o estado inicial é a rota pura, sem query", () => {
    expect(rotaDaListagem(ESTADO_INICIAL_DA_LISTAGEM)).toBe(ROTA);
  });

  it("só o que difere do padrão, sempre na mesma ordem", () => {
    expect(
      rotaDaListagem({
        tipo: "estagio",
        cargoId: CAR,
        departamentoId: DEP,
        pagina: 2,
        aba: "todos",
      }),
    ).toBe(
      `${ROTA}?aba=todos&pagina=2&departamento=${DEP}&cargo=${CAR}&tipo=estagio`,
    );
    expect(rotaDaListagem({ ...ESTADO_INICIAL_DA_LISTAGEM, tipo: "pj" })).toBe(
      `${ROTA}?tipo=pj`,
    );
  });

  it("ida e volta: a URL escrita é lida no mesmo estado", () => {
    const estados = [
      { ...ESTADO_INICIAL_DA_LISTAGEM, aba: "em-admissao" as const, pagina: 7 },
      {
        ...ESTADO_INICIAL_DA_LISTAGEM,
        departamentoId: DEP,
        tipo: "outro_controlado" as const,
      },
      { ...ESTADO_INICIAL_DA_LISTAGEM, aba: "jornada" as const },
    ];
    for (const estado of estados) {
      expect(listagemDaRota(rotaDaListagem(estado))).toEqual(estado);
    }
  });

  it("normaliza antes de escrever: lotação fora de Ativos/Todos não vai à URL", () => {
    expect(
      rotaDaListagem({
        aba: "desligados",
        pagina: 1,
        departamentoId: DEP,
        cargoId: CAR,
        tipo: null,
      }),
    ).toBe(`${ROTA}?aba=desligados`);
    expect(
      normalizarEstadoDaListagem({
        aba: "jornada",
        pagina: 5,
        departamentoId: DEP,
        cargoId: null,
        tipo: "pj",
      }),
    ).toEqual({ ...ESTADO_INICIAL_DA_LISTAGEM, aba: "jornada" });
  });

  it("a URL nunca carrega a busca: o estado nem tem onde guardá-la", () => {
    expect(Object.keys(ESTADO_INICIAL_DA_LISTAGEM).sort()).toEqual([
      "aba",
      "cargoId",
      "departamentoId",
      "pagina",
      "tipo",
    ]);
  });
});

describe("T199 — destinoDaRota com o estado do dashboard", () => {
  it("a listagem com query pertence a Pessoas", () => {
    expect(destinoDaRota(`${ROTA}?aba=desligados&pagina=2`)).toBe("pessoas");
    expect(destinoDaRota(`${ROTA}?aba=qualquer`)).toBe("pessoas");
    expect(destinoDaRota(ROTA)).toBe("pessoas");
  });
});
