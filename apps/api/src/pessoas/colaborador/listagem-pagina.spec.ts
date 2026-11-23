import {
  clausulasDeBusca,
  diasDeFechamentoDaSerie,
  indicadoresDoEscopo,
  type VinculoParaIndicadores,
} from "./listagem-pagina";

/**
 * T215 — peças puras da página inicial de Colaboradores: a busca ampliada
 * (nome, matrícula, CPF, e-mail pessoal e id) e os indicadores do cartão
 * (admitidos no mês, desligados no ano e a série de ativos dos 6 meses).
 */

const EMPRESA = "11111111-1111-4111-8111-111111111111";
const ID = "8f0c2a4e-1b2c-4d3e-8f4a-5b6c7d8e9f01";

function v(
  colaboradorId: string,
  situacao: VinculoParaIndicadores["situacao"],
  admissao: string,
  desligamento: string | null = null,
): VinculoParaIndicadores {
  return {
    colaboradorId,
    situacao,
    dataAdmissao: new Date(`${admissao}T00:00:00.000Z`),
    dataDesligamento: desligamento
      ? new Date(`${desligamento}T00:00:00.000Z`)
      : null,
  };
}

describe("T215 — clausulasDeBusca", () => {
  const base = {
    noEscopo: { empresaId: EMPRESA },
    empresaId: EMPRESA,
    podeCpf: true,
    podeEmail: true,
  };

  it("sempre nome e matrícula (como antes)", () => {
    const ou = clausulasDeBusca("ana", base);
    expect(ou[0]).toEqual({ nome: { contains: "ana", mode: "insensitive" } });
    expect(ou[1]).toEqual({
      vinculos: {
        some: {
          empresaId: EMPRESA,
          matricula: { contains: "ana", mode: "insensitive" },
        },
      },
    });
  });

  it.each(["529.982", "52998", "529.982.247-25", "52998224725"])(
    "CPF por prefixo dos dígitos, com ou sem máscara (%s), só de quem é operacional na empresa",
    (termo) => {
      const digitos = termo.replace(/\D/g, "");
      const ou = clausulasDeBusca(termo, base);
      expect(ou).toContainEqual({
        AND: [
          {
            perfisPessoais: {
              some: { empresaId: EMPRESA, cpf: { startsWith: digitos } },
            },
          },
          {
            vinculos: {
              some: {
                empresaId: EMPRESA,
                situacao: { in: ["previsto", "ativo"] },
              },
            },
          },
        ],
      });
    },
  );

  it("menos de 3 dígitos, ou texto, não procura CPF", () => {
    for (const termo of ["52", "ana", "ana 529"]) {
      expect(JSON.stringify(clausulasDeBusca(termo, base))).not.toContain(
        "perfisPessoais",
      );
    }
  });

  it("e-mail pessoal contém o termo, no contato ativo de quem é operacional", () => {
    const ou = clausulasDeBusca("Ana@Example", base);
    expect(ou).toContainEqual({
      AND: [
        {
          contatos: {
            some: {
              empresaId: EMPRESA,
              ativo: true,
              emailPessoal: { contains: "Ana@Example", mode: "insensitive" },
            },
          },
        },
        {
          vinculos: {
            some: {
              empresaId: EMPRESA,
              situacao: { in: ["previsto", "ativo"] },
            },
          },
        },
      ],
    });
  });

  it("id exato quando o termo é UUID", () => {
    expect(clausulasDeBusca(ID, base)).toContainEqual({ id: ID });
    expect(
      JSON.stringify(clausulasDeBusca("8f0c2a4e-1b2c", base)),
    ).not.toContain('"id"');
  });

  it("sem a permissão, nem CPF nem e-mail entram na busca", () => {
    const texto = JSON.stringify(
      clausulasDeBusca("529.982@x", {
        ...base,
        podeCpf: false,
        podeEmail: false,
      }),
    );
    expect(texto).not.toContain("perfisPessoais");
    expect(texto).not.toContain("contatos");
  });

  it("global (sem empresa ativa): CPF e e-mail em qualquer empresa", () => {
    const ou = clausulasDeBusca("52998", {
      noEscopo: {},
      empresaId: undefined,
      podeCpf: true,
      podeEmail: true,
    });
    expect(ou).toContainEqual({
      perfisPessoais: { some: { cpf: { startsWith: "52998" } } },
    });
  });

  it("curingas do LIKE escapados no nome, na matrícula e no e-mail", () => {
    const texto = JSON.stringify(clausulasDeBusca("a%b_c", base));
    expect(texto).toContain("a\\\\%b\\\\_c");
  });
});

describe("T215 — diasDeFechamentoDaSerie", () => {
  it("o último dia de cada um dos 6 meses; o atual fecha hoje", () => {
    expect(diasDeFechamentoDaSerie("2026-11-23")).toEqual([
      "2026-06-30",
      "2026-07-31",
      "2026-08-31",
      "2026-09-30",
      "2026-10-31",
      "2026-11-23",
    ]);
  });

  it("vira o ano e respeita fevereiro bissexto", () => {
    expect(diasDeFechamentoDaSerie("2028-03-10")).toEqual([
      "2027-10-31",
      "2027-11-30",
      "2027-12-31",
      "2028-01-31",
      "2028-02-29",
      "2028-03-10",
    ]);
  });
});

describe("T215 — indicadoresDoEscopo", () => {
  it("admitidos no mês: ativos com admissão no mês civil de hoje, uma vez por pessoa", () => {
    const r = indicadoresDoEscopo(
      [
        v("a", "ativo", "2026-11-01"),
        v("a", "ativo", "2026-11-10"), // mesma pessoa, dois vínculos
        v("b", "ativo", "2026-11-30"),
        v("c", "ativo", "2026-10-31"), // mês anterior
        v("d", "previsto", "2026-11-05"), // não admitido ainda
        v("e", "encerrado", "2026-11-02", "2026-11-20"), // já saiu
      ],
      "2026-11-23",
    );
    expect(r.admitidosNoMes).toBe(2);
  });

  it("desligados no ano: desligamento no ano civil de hoje", () => {
    const r = indicadoresDoEscopo(
      [
        v("a", "encerrado", "2024-01-01", "2026-01-01"),
        v("b", "encerrado", "2024-01-01", "2026-12-31"),
        v("c", "encerrado", "2024-01-01", "2025-12-31"),
        v("d", "ativo", "2024-01-01"),
      ],
      "2026-11-23",
    );
    expect(r.desligadosNoAno).toBe(2);
  });

  it("série: ativos ao fim de cada mês, pela admissão e pelo desligamento", () => {
    const r = indicadoresDoEscopo(
      [
        v("a", "ativo", "2026-01-10"), // todos os meses
        v("b", "ativo", "2026-09-15"), // de setembro em diante
        v("c", "encerrado", "2026-03-01", "2026-08-31"), // até julho
        v("d", "encerrado", "2026-03-01", "2026-09-01"), // até agosto
        v("e", "previsto", "2026-07-01"), // nunca conta
        v("f", "ativo", "2026-11-24"), // admissão depois de hoje: não conta
      ],
      "2026-11-23",
    );
    // jun, jul, ago, set, out, nov(hoje)
    expect(r.serieAtivos).toEqual([3, 3, 2, 2, 2, 2]);
  });

  it("escopo vazio: zeros, com a série de 6 meses", () => {
    expect(indicadoresDoEscopo([], "2026-11-23")).toEqual({
      admitidosNoMes: 0,
      desligadosNoAno: 0,
      serieAtivos: [0, 0, 0, 0, 0, 0],
    });
  });
});
