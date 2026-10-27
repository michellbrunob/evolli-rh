import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import {
  ListarColaboradoresQueryDto,
  normalizarBusca,
} from "../dto/pessoas.dto";
import {
  VinculoListado,
  escaparCuringas,
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
