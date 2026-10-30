import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import {
  ListarColaboradoresQueryDto,
  normalizarBusca,
} from "../dto/pessoas.dto";
import {
  VinculoAtivoResumido,
  VinculoListado,
  contadoresVazios,
  distribuirAtivosPorTipo,
  escaparCuringas,
  filtroDeGrupo,
  filtroDeLotacaoVigente,
  ordenarVinculosListados,
} from "./colaborador.service";

/**
 * T178 — peças puras da listagem da porta principal de Colaboradores: a busca
 * (normalização, limites e curingas) e a ordem dos vínculos, de que depende o
 * "vínculo principal" mostrado na linha. O escopo, a situação na empresa e os
 * contadores ficam no E2E, com PostgreSQL real.
 */

const OPCOES = { whitelist: true, forbidNonWhitelisted: true };

async function erros(query: Record<string, unknown>): Promise<string[]> {
  const dto = plainToInstance(ListarColaboradoresQueryDto, query);
  return (await validate(dto, OPCOES)).map((e) => e.property);
}

function vinculo(
  matricula: string,
  situacao: VinculoListado["situacao"],
  dataAdmissao: string,
): VinculoListado {
  return {
    id: `v-${matricula}`,
    empresaId: "e-1",
    matricula,
    tipo: "clt",
    situacao,
    dataAdmissao: new Date(`${dataAdmissao}T00:00:00.000Z`),
    dataDesligamento: null,
    lotacaoVigente: null,
    vigenciasDeJornada: [],
  };
}

describe("T178 — busca da listagem", () => {
  it("apara e colapsa espaços; vazia vale como ausente", () => {
    expect(normalizarBusca("  Ana   Silva ")).toBe("Ana Silva");
    expect(normalizarBusca("   ")).toBeUndefined();
    expect(normalizarBusca("")).toBeUndefined();
    expect(normalizarBusca(42)).toBe(42);
  });

  it("aceita até 160 caracteres e recusa acima disso", async () => {
    expect(await erros({ busca: "a".repeat(160) })).toEqual([]);
    expect(await erros({ busca: "a".repeat(161) })).toEqual(["busca"]);
  });

  it("recusa caractere de controle", async () => {
    expect(await erros({ busca: "a\u0007b" })).toEqual(["busca"]);
    expect(await erros({ busca: "linha\nquebrada" })).toEqual(["busca"]);
  });

  it("busca só de espaços não é erro: some da consulta", async () => {
    const dto = plainToInstance(ListarColaboradoresQueryDto, { busca: "  " });
    expect(await validate(dto, OPCOES)).toEqual([]);
    expect(dto.busca).toBeUndefined();
  });

  it("curingas do LIKE valem literalmente", () => {
    expect(escaparCuringas("100%")).toBe("100\\%");
    expect(escaparCuringas("MAT_1")).toBe("MAT\\_1");
    expect(escaparCuringas("a\\b")).toBe("a\\\\b");
    expect(escaparCuringas("Ana Silva")).toBe("Ana Silva");
  });
});

describe("T178 — vínculo principal da linha", () => {
  it("ativo primeiro, depois previsto, depois encerrado", () => {
    const ordenados = ordenarVinculosListados([
      vinculo("ENC", "encerrado", "2026-06-01"),
      vinculo("PRE", "previsto", "2026-05-01"),
      vinculo("ATV", "ativo", "2026-01-05"),
    ]);
    expect(ordenados.map((v) => v.matricula)).toEqual(["ATV", "PRE", "ENC"]);
  });

  it("na mesma situação, a admissão mais recente vem antes", () => {
    const ordenados = ordenarVinculosListados([
      vinculo("ANTIGO", "encerrado", "2025-01-02"),
      vinculo("RECENTE", "encerrado", "2026-02-03"),
    ]);
    expect(ordenados.map((v) => v.matricula)).toEqual(["RECENTE", "ANTIGO"]);
  });

  it("não altera a lista recebida", () => {
    const original = [
      vinculo("B", "previsto", "2026-01-05"),
      vinculo("A", "ativo", "2026-01-05"),
    ];
    ordenarVinculosListados(original);
    expect(original.map((v) => v.matricula)).toEqual(["B", "A"]);
  });
});

describe("T190 — filtros por Departamento e Cargo", () => {
  const DEP = "11111111-1111-4111-8111-111111111111";
  const CAR = "22222222-2222-4222-8222-222222222222";
  const EMPRESA = "33333333-3333-4333-8333-333333333333";

  it("aceita UUID e recusa o que não for UUID", async () => {
    expect(await erros({ departamentoId: DEP, cargoId: CAR })).toEqual([]);
    expect(await erros({ departamentoId: "abc" })).toEqual(["departamentoId"]);
    expect(await erros({ cargoId: "1" })).toEqual(["cargoId"]);
  });

  it("sem departamento nem cargo, o filtro não entra na consulta", () => {
    expect(
      filtroDeLotacaoVigente({ empresaId: EMPRESA }, undefined, undefined),
    ).toBeNull();
  });

  it("departamento: vínculo ATIVO do escopo com alocação ABERTA naquele departamento", () => {
    expect(
      filtroDeLotacaoVigente({ empresaId: EMPRESA }, DEP, undefined),
    ).toEqual({
      vinculos: {
        some: {
          empresaId: EMPRESA,
          situacao: "ativo",
          alocacoes: { some: { vigenteAte: null, departamentoId: DEP } },
        },
      },
    });
  });

  it("os dois juntos valem na MESMA alocação aberta", () => {
    expect(filtroDeLotacaoVigente({ empresaId: EMPRESA }, DEP, CAR)).toEqual({
      vinculos: {
        some: {
          empresaId: EMPRESA,
          situacao: "ativo",
          alocacoes: {
            some: { vigenteAte: null, departamentoId: DEP, cargoId: CAR },
          },
        },
      },
    });
  });

  it("escopo global (master sem empresa ativa): sem empresa no filtro", () => {
    expect(filtroDeLotacaoVigente({}, undefined, CAR)).toEqual({
      vinculos: {
        some: {
          situacao: "ativo",
          alocacoes: { some: { vigenteAte: null, cargoId: CAR } },
        },
      },
    });
  });
});

// ---------------------------------------------------------------------------
// T199 — grupos das abas (N-1), tipo no vínculo do grupo (N-5) e
// distribuição dos ativos por tipo (N-2). O comportamento com PostgreSQL real
// (readmitido, previsto + encerrado, isolamento) fica no E2E.
// ---------------------------------------------------------------------------
describe("T199 — grupo e tipo de vínculo na consulta", () => {
  const EMPRESA = "33333333-3333-4333-8333-333333333333";
  const escopo = { empresaId: EMPRESA };

  it("aceita só os grupos e os tipos controlados", async () => {
    expect(await erros({ grupo: "ativos" })).toEqual([]);
    expect(await erros({ grupo: "em_admissao" })).toEqual([]);
    expect(await erros({ grupo: "desligados" })).toEqual([]);
    expect(await erros({ grupo: "inativos" })).toEqual(["grupo"]);
    expect(await erros({ grupo: "ATIVOS" })).toEqual(["grupo"]);
    for (const tipo of [
      "clt",
      "estagio",
      "pj",
      "temporario",
      "outro_controlado",
    ]) {
      expect(await erros({ tipoVinculo: tipo })).toEqual([]);
    }
    expect(await erros({ tipoVinculo: "CLT" })).toEqual(["tipoVinculo"]);
    expect(await erros({ tipoVinculo: "aprendiz" })).toEqual(["tipoVinculo"]);
    expect(await erros({ tipoVinculo: "" })).toEqual(["tipoVinculo"]);
  });

  it("sem grupo nem tipo, nada entra na consulta", () => {
    expect(filtroDeGrupo(escopo, undefined)).toBeNull();
  });

  it("ativos: tem vínculo ativo no escopo — o readmitido (ativo + encerrado) entra aqui", () => {
    expect(filtroDeGrupo(escopo, "ativos")).toEqual({
      vinculos: { some: { empresaId: EMPRESA, situacao: "ativo" } },
    });
  });

  it("em admissão: sem ativo e com previsto no escopo — previsto + encerrado entra aqui, não em desligados", () => {
    expect(filtroDeGrupo(escopo, "em_admissao")).toEqual({
      AND: [
        { vinculos: { none: { empresaId: EMPRESA, situacao: "ativo" } } },
        { vinculos: { some: { empresaId: EMPRESA, situacao: "previsto" } } },
      ],
    });
  });

  it("desligados: sem ativo nem previsto, com encerrado no escopo", () => {
    expect(filtroDeGrupo(escopo, "desligados")).toEqual({
      AND: [
        { vinculos: { none: { empresaId: EMPRESA, situacao: "ativo" } } },
        { vinculos: { none: { empresaId: EMPRESA, situacao: "previsto" } } },
        { vinculos: { some: { empresaId: EMPRESA, situacao: "encerrado" } } },
      ],
    });
  });

  it("o tipo vale para o MESMO vínculo que define o grupo, nunca para as exclusões", () => {
    expect(filtroDeGrupo(escopo, "ativos", "pj")).toEqual({
      vinculos: { some: { empresaId: EMPRESA, situacao: "ativo", tipo: "pj" } },
    });
    expect(filtroDeGrupo(escopo, "em_admissao", "estagio")).toEqual({
      AND: [
        { vinculos: { none: { empresaId: EMPRESA, situacao: "ativo" } } },
        {
          vinculos: {
            some: { empresaId: EMPRESA, situacao: "previsto", tipo: "estagio" },
          },
        },
      ],
    });
    expect(filtroDeGrupo(escopo, "desligados", "clt")).toEqual({
      AND: [
        { vinculos: { none: { empresaId: EMPRESA, situacao: "ativo" } } },
        { vinculos: { none: { empresaId: EMPRESA, situacao: "previsto" } } },
        {
          vinculos: {
            some: { empresaId: EMPRESA, situacao: "encerrado", tipo: "clt" },
          },
        },
      ],
    });
  });

  it("sem grupo, o tipo vale para qualquer vínculo do escopo", () => {
    expect(filtroDeGrupo(escopo, undefined, "temporario")).toEqual({
      vinculos: { some: { empresaId: EMPRESA, tipo: "temporario" } },
    });
  });

  it("isolamento: toda condição (inclusive as exclusões) fica presa ao escopo", () => {
    // Um vínculo ativo em OUTRA empresa não tira ninguém de "Em admissão" ou
    // "Desligados" desta: o `none` também é só do escopo.
    for (const grupo of ["ativos", "em_admissao", "desligados"] as const) {
      const json = JSON.stringify(filtroDeGrupo(escopo, grupo, "clt"));
      const condicoes = json.match(/"situacao":"[a-z]+"/g) ?? [];
      const comEmpresa = json.match(/"empresaId":"[^"]+","situacao"/g) ?? [];
      expect(comEmpresa).toHaveLength(condicoes.length);
    }
    // Escopo global (master sem empresa ativa): sem filtro de empresa.
    expect(filtroDeGrupo({}, "ativos")).toEqual({
      vinculos: { some: { situacao: "ativo" } },
    });
  });
});

describe("T199 — ativos por tipo, pelo vínculo principal", () => {
  function ativo(
    colaboradorId: string,
    tipo: VinculoAtivoResumido["tipo"],
    dataAdmissao: string,
    matricula: string | null = null,
  ): VinculoAtivoResumido {
    return {
      colaboradorId,
      tipo,
      dataAdmissao: new Date(`${dataAdmissao}T00:00:00.000Z`),
      matricula,
    };
  }

  it("cada colaborador conta uma vez; todos os tipos aparecem, com zero", () => {
    expect(
      distribuirAtivosPorTipo([
        ativo("a", "clt", "2025-01-10"),
        ativo("b", "pj", "2025-02-10"),
        ativo("c", "clt", "2025-03-10"),
      ]),
    ).toEqual({
      clt: 2,
      estagio: 0,
      pj: 1,
      temporario: 0,
      outro_controlado: 0,
    });
    expect(distribuirAtivosPorTipo([])).toEqual({
      clt: 0,
      estagio: 0,
      pj: 0,
      temporario: 0,
      outro_controlado: 0,
    });
  });

  it("dois vínculos ativos: vale o principal — a admissão mais recente", () => {
    const resultado = distribuirAtivosPorTipo([
      ativo("a", "clt", "2024-01-10"),
      ativo("a", "estagio", "2025-06-01"),
    ]);
    expect(resultado.estagio).toBe(1);
    expect(resultado.clt).toBe(0);
    // A soma é o número de colaboradores ativos.
    expect(Object.values(resultado).reduce((s, n) => s + n, 0)).toBe(1);
  });

  it("mesma admissão: desempata pela matrícula, como a listagem", () => {
    expect(
      distribuirAtivosPorTipo([
        ativo("a", "pj", "2025-01-10", "MAT-0002"),
        ativo("a", "clt", "2025-01-10", "MAT-0001"),
      ]).clt,
    ).toBe(1);
    expect(
      distribuirAtivosPorTipo([
        ativo("a", "pj", "2025-01-10", null),
        ativo("a", "temporario", "2025-01-10", "MAT-0003"),
      ]).temporario,
    ).toBe(1);
  });

  it("contadores de um escopo vazio: tudo zero", () => {
    expect(contadoresVazios()).toEqual({
      ativos: 0,
      inativos: 0,
      emAdmissao: 0,
      desligados: 0,
      total: 0,
      ativosPorTipo: {
        clt: 0,
        estagio: 0,
        pj: 0,
        temporario: 0,
        outro_controlado: 0,
      },
    });
  });
});
