import { describe, expect, it } from "vitest";
import {
  ABAS_DA_LISTAGEM,
  ESTADO_INICIAL_DA_LISTAGEM,
  FILTROS_VAZIOS,
  type FiltrosDaListagem,
  quantidadeDeFiltros,
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
const DEP2 = "33333333-3333-4333-8333-333333333333";
const ARE = "44444444-4444-4444-8444-444444444444";
const CEN = "55555555-5555-4555-8555-555555555555";
const UNI = "66666666-6666-4666-8666-666666666666";
const ROTA = "#/pessoas/colaboradores";

/** T215 — filtros da gaveta: vazios, com o que o caso pede. */
const f = (parcial: Partial<FiltrosDaListagem> = {}): FiltrosDaListagem => ({
  ...FILTROS_VAZIOS,
  ...parcial,
});

describe("T199 — listagemDaRota", () => {
  it("a rota pura é o estado inicial: Ativos, página 1, sem filtros", () => {
    expect(listagemDaRota(ROTA)).toEqual(ESTADO_INICIAL_DA_LISTAGEM);
    expect(ESTADO_INICIAL_DA_LISTAGEM).toEqual({
      aba: "ativos",
      pagina: 1,
      tamanho: 20,
      filtros: {
        departamentos: [],
        areas: [],
        centrosCusto: [],
        unidades: [],
        cargos: [],
        niveis: [],
        tipos: [],
        generos: [],
      },
    });
  });

  it("lê aba, página, departamento, cargo e tipo (a URL de antes vira listas de um)", () => {
    expect(
      listagemDaRota(
        `${ROTA}?aba=todos&pagina=3&departamento=${DEP}&cargo=${CAR}&tipo=pj`,
      ),
    ).toEqual({
      aba: "todos",
      pagina: 3,
      tamanho: 20,
      filtros: f({ departamentos: [DEP], cargos: [CAR], tipos: ["pj"] }),
    });
  });

  it("T215 — lê todos os grupos da gaveta, em lista separada por vírgula", () => {
    expect(
      listagemDaRota(
        `${ROTA}?departamento=${DEP},${DEP2}&area=${ARE}&centro=${CEN}&unidade=${UNI}&cargo=${CAR}&nivel=pleno,senior&tipo=clt,pj&genero=feminino,outro`,
      )?.filtros,
    ).toEqual({
      departamentos: [DEP, DEP2],
      areas: [ARE],
      centrosCusto: [CEN],
      unidades: [UNI],
      cargos: [CAR],
      niveis: ["pleno", "senior"],
      tipos: ["clt", "pj"],
      generos: ["feminino", "outro"],
    });
  });

  it("T215 — valor inválido sai da lista; repetido entra uma vez; o resto fica", () => {
    expect(
      listagemDaRota(
        `${ROTA}?departamento=${DEP},1,${DEP},,${DEP2}&nivel=pleno,estagiario,pleno&tipo=autonomo,clt&genero=Feminino,masculino`,
      )?.filtros,
    ).toEqual(
      f({
        departamentos: [DEP, DEP2],
        niveis: ["pleno"],
        tipos: ["clt"],
        generos: ["masculino"],
      }),
    );
  });

  it("T215 — no máximo 50 valores por grupo (o teto da API)", () => {
    const ids = Array.from(
      { length: 60 },
      (_, i) => `11111111-1111-4111-8111-${100_000_000_000 + i}`,
    );
    const lidos = listagemDaRota(`${ROTA}?departamento=${ids.join(",")}`)
      ?.filtros.departamentos;
    expect(lidos).toHaveLength(50);
    expect(lidos).toEqual(ids.filter((_, i) => i < 50));
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
    ["departamento que não é UUID", "departamento=1", {}],
    ["cargo que não é UUID", "cargo=x'or'1", {}],
    ["tipo fora dos controlados", "tipo=autonomo", {}],
    ["nível fora da lista", "nivel=estagiario", {}],
    ["gênero fora da lista", "genero=nao_binario", {}],
    ["tamanho fora dos controlados", "tamanho=37", { tamanho: 20 }],
    ["tamanho acima do teto", "tamanho=200", { tamanho: 20 }],
    ["tamanho com zero à esquerda", "tamanho=050", { tamanho: 20 }],
    ["tamanho não numérico", "tamanho=tudo", { tamanho: 20 }],
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
      listagemDaRota(`${ROTA}?departamento=${DEP.toUpperCase()}`)?.filtros
        .departamentos,
    ).toEqual([DEP]);
  });

  it("lotação só onde ela existe: Em admissão e Desligados ficam só com tipo e gênero", () => {
    for (const aba of ["em-admissao", "desligados"]) {
      expect(
        listagemDaRota(
          `${ROTA}?aba=${aba}&departamento=${DEP}&area=${ARE}&centro=${CEN}&unidade=${UNI}&cargo=${CAR}&nivel=pleno&tipo=clt&genero=feminino`,
        ),
      ).toEqual({
        ...ESTADO_INICIAL_DA_LISTAGEM,
        aba,
        filtros: f({ tipos: ["clt"], generos: ["feminino"] }),
      });
    }
  });

  it("a aba Jornada não leva página, lotação, tipo nem gênero", () => {
    expect(
      listagemDaRota(
        `${ROTA}?aba=jornada&pagina=4&departamento=${DEP}&tipo=pj&genero=outro`,
      ),
    ).toEqual({ ...ESTADO_INICIAL_DA_LISTAGEM, aba: "jornada" });
  });

  it("T215 — a aba Férias e ausências também não leva página, lotação nem tipo", () => {
    expect(
      listagemDaRota(`${ROTA}?aba=ferias&pagina=4&departamento=${DEP}&tipo=pj`),
    ).toEqual({ ...ESTADO_INICIAL_DA_LISTAGEM, aba: "ferias" });
    expect(
      rotaDaListagem({ ...ESTADO_INICIAL_DA_LISTAGEM, aba: "ferias" }),
    ).toBe(`${ROTA}?aba=ferias`);
  });

  it("T215 — a ordem das abas: Ativos, Em admissão, Férias e ausências, Escala de trabalho, Desligados, Todos", () => {
    expect([...ABAS_DA_LISTAGEM]).toEqual([
      "ativos",
      "em-admissao",
      "ferias",
      "jornada",
      "desligados",
      "todos",
    ]);
  });
});

describe("T199 — rotaDaListagem", () => {
  it("o estado inicial é a rota pura, sem query", () => {
    expect(rotaDaListagem(ESTADO_INICIAL_DA_LISTAGEM)).toBe(ROTA);
  });

  it("só o que difere do padrão, sempre na mesma ordem", () => {
    expect(
      rotaDaListagem({
        filtros: {
          generos: ["prefiro_nao_informar"],
          tipos: ["estagio", "clt"],
          niveis: ["c_level"],
          cargos: [CAR],
          unidades: [UNI],
          centrosCusto: [CEN],
          areas: [ARE],
          departamentos: [DEP, DEP2],
        },
        tamanho: 50,
        pagina: 2,
        aba: "todos",
      }),
    ).toBe(
      `${ROTA}?aba=todos&pagina=2&tamanho=50&departamento=${DEP},${DEP2}&area=${ARE}&centro=${CEN}&unidade=${UNI}&cargo=${CAR}&nivel=c_level&tipo=estagio,clt&genero=prefiro_nao_informar`,
    );
    expect(
      rotaDaListagem({
        ...ESTADO_INICIAL_DA_LISTAGEM,
        filtros: f({ tipos: ["pj"] }),
      }),
    ).toBe(`${ROTA}?tipo=pj`);
  });

  it("ida e volta: a URL escrita é lida no mesmo estado", () => {
    const estados = [
      { ...ESTADO_INICIAL_DA_LISTAGEM, aba: "em-admissao" as const, pagina: 7 },
      {
        ...ESTADO_INICIAL_DA_LISTAGEM,
        filtros: f({ departamentos: [DEP], tipos: ["outro_controlado"] }),
      },
      {
        ...ESTADO_INICIAL_DA_LISTAGEM,
        aba: "todos" as const,
        filtros: f({
          departamentos: [DEP2, DEP],
          areas: [ARE],
          centrosCusto: [CEN],
          unidades: [UNI],
          cargos: [CAR],
          niveis: ["head", "junior"],
          tipos: ["pj", "clt"],
          generos: ["outro"],
        }),
      },
      { ...ESTADO_INICIAL_DA_LISTAGEM, aba: "jornada" as const },
      { ...ESTADO_INICIAL_DA_LISTAGEM, tamanho: 100 as const, pagina: 3 },
      {
        ...ESTADO_INICIAL_DA_LISTAGEM,
        aba: "desligados" as const,
        tamanho: 50 as const,
        filtros: f({ generos: ["masculino"] }),
      },
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
        tamanho: 20,
        filtros: f({ departamentos: [DEP], cargos: [CAR], niveis: ["pleno"] }),
      }),
    ).toBe(`${ROTA}?aba=desligados`);
    expect(
      normalizarEstadoDaListagem({
        aba: "jornada",
        pagina: 5,
        tamanho: 100,
        filtros: f({ departamentos: [DEP], tipos: ["pj"] }),
      }),
    ).toEqual({ ...ESTADO_INICIAL_DA_LISTAGEM, aba: "jornada" });
  });

  it("a URL nunca carrega a busca: o estado nem tem onde guardá-la", () => {
    expect(Object.keys(ESTADO_INICIAL_DA_LISTAGEM).sort()).toEqual([
      "aba",
      "filtros",
      "pagina",
      "tamanho",
    ]);
    expect(Object.keys(FILTROS_VAZIOS).sort()).toEqual([
      "areas",
      "cargos",
      "centrosCusto",
      "departamentos",
      "generos",
      "niveis",
      "tipos",
      "unidades",
    ]);
  });

  it("T215 — quantos filtros estão aplicados (para o botão Filtrar)", () => {
    expect(quantidadeDeFiltros(FILTROS_VAZIOS)).toBe(0);
    expect(
      quantidadeDeFiltros(
        f({ departamentos: [DEP, DEP2], tipos: ["clt"], generos: ["outro"] }),
      ),
    ).toBe(4);
  });
});

describe("T209 — tamanho da página na URL (C-2)", () => {
  it("lê 50 e 100; 20 é o padrão e não vai à URL", () => {
    expect(listagemDaRota(`${ROTA}?tamanho=50`)?.tamanho).toBe(50);
    expect(listagemDaRota(`${ROTA}?tamanho=100`)?.tamanho).toBe(100);
    expect(listagemDaRota(`${ROTA}?tamanho=20`)?.tamanho).toBe(20);
    expect(rotaDaListagem({ ...ESTADO_INICIAL_DA_LISTAGEM, tamanho: 20 })).toBe(
      ROTA,
    );
    expect(
      rotaDaListagem({ ...ESTADO_INICIAL_DA_LISTAGEM, tamanho: 100 }),
    ).toBe(`${ROTA}?tamanho=100`);
  });

  it("a aba Jornada não leva tamanho (paginação própria)", () => {
    expect(listagemDaRota(`${ROTA}?aba=jornada&tamanho=100`)).toEqual({
      ...ESTADO_INICIAL_DA_LISTAGEM,
      aba: "jornada",
    });
    expect(
      rotaDaListagem({
        ...ESTADO_INICIAL_DA_LISTAGEM,
        aba: "jornada",
        tamanho: 50,
      }),
    ).toBe(`${ROTA}?aba=jornada`);
  });

  it("o tamanho segue em todas as abas com tabela, com filtros e página", () => {
    for (const aba of ["ativos", "em-admissao", "desligados", "todos"]) {
      expect(
        listagemDaRota(`${ROTA}?aba=${aba}&pagina=2&tamanho=50&tipo=pj`),
      ).toMatchObject({
        pagina: 2,
        tamanho: 50,
        filtros: f({ tipos: ["pj"] }),
      });
    }
  });
});

describe("T199 — destinoDaRota com o estado do dashboard", () => {
  it("a listagem com query pertence a Pessoas", () => {
    expect(destinoDaRota(`${ROTA}?aba=desligados&pagina=2`)).toBe("pessoas");
    expect(destinoDaRota(`${ROTA}?aba=qualquer`)).toBe("pessoas");
    expect(destinoDaRota(ROTA)).toBe("pessoas");
  });
});
