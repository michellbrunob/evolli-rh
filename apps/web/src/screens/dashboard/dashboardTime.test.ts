/**
 * T207 — dados do time na Visão Geral: leitura das pessoas ativas de hoje
 * (páginas, teto, repetidos, abandono), distribuição por departamento e tempo
 * de casa — com a regra de privacidade: nenhum grupo com menos de 3 pessoas
 * aparece com nome ou número exato, nem pode ser deduzido pela diferença.
 * Funções puras, sem tela.
 */
import { describe, expect, it, vi } from "vitest";
import {
  FAIXAS_DE_TEMPO_DE_CASA,
  LeituraAbandonada,
  MINIMO_DO_GRUPO,
  TETO_DE_PAGINAS_POR_SERIE,
  calcularTempoDeCasa,
  distribuirPorDepartamento,
  duracaoEmTexto,
  lerTimeDeHoje,
  mesesCompletos,
  type PessoaAtivaDoTime,
} from "./dashboardDados";

/** 9 de novembro de 2026, meio-dia, no relógio do navegador. */
const HOJE = new Date(2026, 10, 9, 12, 0, 0);

let n = 0;
function pessoa(
  dataAdmissao: string | null,
  departamento: string | null = null,
): PessoaAtivaDoTime {
  n += 1;
  return {
    id: `p-${n}`,
    dataAdmissao,
    departamento: departamento
      ? { id: `d-${departamento}`, nome: departamento }
      : null,
  };
}

const varias = (q: number, data: string | null, dep: string | null = null) =>
  Array.from({ length: q }, () => pessoa(data, dep));

function item(id: string, dataAdmissao: string, dep: string | null) {
  return {
    id,
    vinculos: [
      {
        dataAdmissao,
        lotacaoVigente: {
          departamento: dep ? { id: `d-${dep}`, nome: dep } : null,
        },
      },
    ],
  };
}

describe("T207 — lerTimeDeHoje", () => {
  it("pede só ativos, de 100 em 100, até o total; repetido conta uma vez; vínculo principal", async () => {
    const pagina1 = Array.from({ length: 100 }, (_, i) =>
      item(`c-${i}`, "2025-02-01T00:00:00.000Z", "Operações"),
    );
    const pagina2 = [
      item("c-99", "2025-02-01", "Operações"), // repetido entre páginas
      {
        id: "c-100",
        vinculos: [
          { dataAdmissao: "2020-05-10", lotacaoVigente: null },
          {
            dataAdmissao: "2026-01-01",
            lotacaoVigente: { departamento: { id: "d-x", nome: "X" } },
          },
        ],
      },
    ];
    const listar = vi
      .fn()
      .mockResolvedValueOnce({ itens: pagina1, total: 102 })
      .mockResolvedValueOnce({ itens: pagina2, total: 102 });
    const lido = await lerTimeDeHoje(listar);
    expect(listar.mock.calls.map(([q]) => q)).toEqual([
      { grupo: "ativos", pagina: 1, tamanhoPagina: 100 },
      { grupo: "ativos", pagina: 2, tamanhoPagina: 100 },
    ]);
    expect(lido.tipo).toBe("completo");
    if (lido.tipo !== "completo") return;
    expect(lido.pessoas).toHaveLength(101);
    expect(lido.pessoas[0]).toEqual({
      id: "c-0",
      dataAdmissao: "2025-02-01",
      departamento: { id: "d-Operações", nome: "Operações" },
    });
    // Só o vínculo principal (o primeiro): sem lotação vigente, sem departamento.
    expect(lido.pessoas.at(-1)).toEqual({
      id: "c-100",
      dataAdmissao: "2020-05-10",
      departamento: null,
    });
  });

  it("sem vínculo: sem data e sem departamento; página incompleta encerra", async () => {
    const listar = vi
      .fn()
      .mockResolvedValue({ itens: [{ id: "c-1", vinculos: [] }], total: 1 });
    const lido = await lerTimeDeHoje(listar);
    expect(listar).toHaveBeenCalledTimes(1);
    expect(lido).toEqual({
      tipo: "completo",
      pessoas: [{ id: "c-1", dataAdmissao: null, departamento: null }],
    });
  });

  it(`mais de ${TETO_DE_PAGINAS_POR_SERIE} páginas: 'excedido', nenhuma pessoa`, async () => {
    let pedido = 0;
    const listar = vi.fn(async () => {
      pedido += 1;
      return {
        itens: Array.from({ length: 100 }, (_, i) =>
          item(`c-${pedido}-${i}`, "2025-01-01", null),
        ),
        total: 5000,
      };
    });
    expect(await lerTimeDeHoje(listar)).toEqual({ tipo: "excedido" });
    expect(listar).toHaveBeenCalledTimes(TETO_DE_PAGINAS_POR_SERIE);
  });

  it("leitura abandonada: a página seguinte não é pedida", async () => {
    let valendo = true;
    const listar = vi.fn(async () => {
      valendo = false;
      return {
        itens: Array.from({ length: 100 }, (_, i) =>
          item(`c-${i}`, "2025-01-01", null),
        ),
        total: 300,
      };
    });
    await expect(lerTimeDeHoje(listar, () => valendo)).rejects.toBeInstanceOf(
      LeituraAbandonada,
    );
    expect(listar).toHaveBeenCalledTimes(1);
  });
});

describe("T207 — distribuirPorDepartamento (privacidade)", () => {
  it(`menos de ${MINIMO_DO_GRUPO} pessoas: nada é distribuído`, () => {
    expect(distribuirPorDepartamento(varias(2, "2025-01-01", "A"))).toEqual({
      tipo: "pouca-gente",
      total: 2,
    });
  });

  it("departamento pequeno e sem departamento vão para o grupo neutro; ordem por tamanho e nome; chave pelo id", () => {
    const d = distribuirPorDepartamento([
      ...varias(3, null, "Vendas"),
      ...varias(5, null, "Operações"),
      ...varias(3, null, "Atendimento"),
      ...varias(2, null, "Jurídico"),
      ...varias(1, null, null),
    ]);
    expect(d).toEqual({
      tipo: "distribuida",
      total: 14,
      grupos: [
        { id: "d-Operações", nome: "Operações", pessoas: 5 },
        { id: "d-Atendimento", nome: "Atendimento", pessoas: 3 },
        { id: "d-Vendas", nome: "Vendas", pessoas: 3 },
      ],
      agrupadas: 3,
    });
    // Nenhum nome de grupo pequeno sai da função.
    expect(JSON.stringify(d)).not.toContain("Jurídico");
  });

  it("grupo neutro de 1 ou 2 pessoas nunca aparece: o menor departamento entra nele", () => {
    // Sem a junção: Operações 5, Vendas 3 e um grupo neutro de 2 — o tamanho
    // exato de um grupo pequeno.
    expect(
      distribuirPorDepartamento([
        ...varias(5, null, "Operações"),
        ...varias(3, null, "Vendas"),
        ...varias(2, null, "Jurídico"),
      ]),
    ).toEqual({
      tipo: "distribuida",
      total: 10,
      grupos: [{ id: "d-Operações", nome: "Operações", pessoas: 5 }],
      agrupadas: 5,
    });
  });

  it("um só departamento grande e 1 pessoa fora dele: tudo no grupo neutro", () => {
    expect(
      distribuirPorDepartamento([
        ...varias(9, null, "Comercial"),
        ...varias(1, null, "Diretoria"),
      ]),
    ).toEqual({ tipo: "distribuida", total: 10, grupos: [], agrupadas: 10 });
  });

  it("a quantidade de departamentos não sai da função (não permite deduzir departamentos pequenos)", () => {
    const d = distribuirPorDepartamento([
      ...varias(5, null, "Operações"),
      ...varias(1, null, "Jurídico"),
      ...varias(1, null, "Diretoria"),
      ...varias(1, null, null),
    ]);
    expect(Object.keys(d).sort()).toEqual([
      "agrupadas",
      "grupos",
      "tipo",
      "total",
    ]);
  });

  it("em qualquer composição: grupos com nome têm 3 ou mais, o neutro tem 0 ou 3 ou mais, e a soma é o total", () => {
    const nomes = ["A", "B", "C", "D"];
    for (let codigo = 0; codigo < 6 ** 4 * 4; codigo += 1) {
      let resto = codigo;
      const pessoas: PessoaAtivaDoTime[] = [];
      for (const nome of nomes) {
        pessoas.push(...varias(resto % 6, null, nome));
        resto = Math.floor(resto / 6);
      }
      pessoas.push(...varias(resto % 4, null, null));
      const d = distribuirPorDepartamento(pessoas);
      if (d.tipo !== "distribuida") continue;
      for (const g of d.grupos) {
        expect(g.pessoas).toBeGreaterThanOrEqual(MINIMO_DO_GRUPO);
      }
      expect(d.agrupadas === 0 || d.agrupadas >= MINIMO_DO_GRUPO).toBe(true);
      expect(d.grupos.reduce((s, g) => s + g.pessoas, 0) + d.agrupadas).toBe(
        d.total,
      );
    }
  });

  it("todos sem departamento: só o grupo neutro", () => {
    expect(distribuirPorDepartamento(varias(4, null, null))).toEqual({
      tipo: "distribuida",
      total: 4,
      grupos: [],
      agrupadas: 4,
    });
  });
});

describe("T207 — tempo de casa", () => {
  it("meses completos pelo dia civil de hoje do navegador", () => {
    expect(mesesCompletos("2026-01-09", HOJE)).toBe(10);
    expect(mesesCompletos("2026-01-10", HOJE)).toBe(9);
    expect(mesesCompletos("2026-11-09", HOJE)).toBe(0);
    // Admissão futura não vira tempo negativo.
    expect(mesesCompletos("2026-12-01", HOJE)).toBe(0);
    expect(mesesCompletos("2015-11-09", HOJE)).toBe(132);
  });

  it("duração em texto", () => {
    expect(duracaoEmTexto(0)).toBe("menos de 1 mês");
    expect(duracaoEmTexto(1)).toBe("1 mês");
    expect(duracaoEmTexto(8)).toBe("8 meses");
    expect(duracaoEmTexto(12)).toBe("1 ano");
    expect(duracaoEmTexto(27)).toBe("2 anos e 3 meses");
  });

  it(`menos de ${MINIMO_DO_GRUPO} pessoas com data: não calculado`, () => {
    expect(
      calcularTempoDeCasa(
        [pessoa("2025-01-01"), pessoa("2024-01-01"), pessoa(null)],
        HOJE,
      ),
    ).toEqual({ tipo: "pouca-gente", total: 2 });
  });

  it("mediana (não média) e faixas exatas quando todas têm 0 ou ao menos 3 pessoas", () => {
    const t = calcularTempoDeCasa(
      [
        ...varias(3, "2026-05-09"), // 6 meses
        ...varias(3, "2025-05-09"), // 18 meses
        ...varias(3, "2006-11-09"), // 240 meses
      ],
      HOJE,
    );
    expect(t).toEqual({
      tipo: "calculado",
      total: 9,
      medianaEmMeses: 18,
      faixas: [
        { rotulo: "Menos de 1 ano", pessoas: 3 },
        { rotulo: "1 a 2 anos", pessoas: 3 },
        { rotulo: "2 a 5 anos", pessoas: 0 },
        { rotulo: "5 a 10 anos", pessoas: 0 },
        { rotulo: "10 anos ou mais", pessoas: 3 },
      ],
      semData: 0,
    });
  });

  it("número par: mediana arredondada para baixo entre os dois do meio", () => {
    const t = calcularTempoDeCasa(
      [
        pessoa("2026-10-09"), // 1
        pessoa("2026-08-09"), // 3
        pessoa("2026-06-09"), // 5
        pessoa("2026-04-09"), // 7
      ],
      HOJE,
    );
    expect(t.tipo === "calculado" && t.medianaEmMeses).toBe(4);
  });

  it("faixa com 1 ou 2 pessoas se junta à vizinha: nenhuma faixa pequena, nada deduzível pela diferença", () => {
    // 9 recentes e 1 muito antigo: "menos de 3" ao lado de "9" e do total
    // de 10 entregaria o 1. A faixa antiga se junta às vizinhas até ter 3.
    const t = calcularTempoDeCasa(
      [...varias(9, "2026-05-09"), pessoa("2006-11-09")],
      HOJE,
    );
    expect(t.tipo).toBe("calculado");
    if (t.tipo !== "calculado") return;
    expect(t.faixas).toEqual([
      { rotulo: "Qualquer tempo de casa", pessoas: 10 },
    ]);
  });

  it("junta só o necessário: faixas vizinhas viram um intervalo contínuo", () => {
    const t = calcularTempoDeCasa(
      [
        ...varias(4, "2026-05-09"), // < 1 ano
        ...varias(3, "2025-05-09"), // 1 a 2
        ...varias(2, "2023-11-09"), // 2 a 5 (36 meses)
        ...varias(1, "2019-11-09"), // 5 a 10 (84 meses)
      ],
      HOJE,
    );
    if (t.tipo !== "calculado") throw new Error(t.tipo);
    expect(t.faixas).toEqual([
      { rotulo: "Menos de 1 ano", pessoas: 4 },
      { rotulo: "1 a 2 anos", pessoas: 3 },
      { rotulo: "2 a 10 anos", pessoas: 3 },
      { rotulo: "10 anos ou mais", pessoas: 0 },
    ]);
  });

  it("faixa pequena na ponta curta também se junta à seguinte", () => {
    const t = calcularTempoDeCasa(
      [
        pessoa("2026-05-09"),
        ...varias(3, "2025-05-09"),
        ...varias(3, "2019-11-09"),
      ],
      HOJE,
    );
    if (t.tipo !== "calculado") throw new Error(t.tipo);
    expect(t.faixas).toEqual([
      { rotulo: "Menos de 2 anos", pessoas: 4 },
      { rotulo: "2 a 5 anos", pessoas: 0 },
      { rotulo: "5 a 10 anos", pessoas: 3 },
      { rotulo: "10 anos ou mais", pessoas: 0 },
    ]);
  });

  it("em qualquer composição, toda faixa exibida tem 0 ou ao menos 3 pessoas e a soma é o total", () => {
    // Todas as combinações de 0 a 4 pessoas em cada uma das 5 faixas.
    const datas = [
      "2026-05-09",
      "2025-05-09",
      "2023-11-09",
      "2019-11-09",
      "2006-11-09",
    ];
    const total = FAIXAS_DE_TEMPO_DE_CASA.length;
    for (let codigo = 0; codigo < 5 ** total; codigo += 1) {
      const pessoas: PessoaAtivaDoTime[] = [];
      let resto = codigo;
      for (let f = 0; f < total; f += 1) {
        pessoas.push(...varias(resto % 5, datas[f]!));
        resto = Math.floor(resto / 5);
      }
      const t = calcularTempoDeCasa(pessoas, HOJE);
      if (t.tipo !== "calculado") continue;
      for (const f of t.faixas) {
        expect(f.pessoas === 0 || f.pessoas >= MINIMO_DO_GRUPO).toBe(true);
      }
      expect(t.faixas.reduce((s, f) => s + f.pessoas, 0)).toBe(t.total);
    }
  });

  it("pessoas sem data de admissão ficam fora do cálculo e são contadas à parte", () => {
    const t = calcularTempoDeCasa(
      [...varias(3, "2026-05-09"), pessoa(null)],
      HOJE,
    );
    expect(t.tipo === "calculado" && t.semData).toBe(1);
  });

  it("'hoje' padrão é o relógio do navegador", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(new Date(2027, 10, 9, 12));
      const t = calcularTempoDeCasa(varias(3, "2026-11-09"));
      expect(t.tipo === "calculado" && t.medianaEmMeses).toBe(12);
    } finally {
      vi.useRealTimers();
    }
  });
});
