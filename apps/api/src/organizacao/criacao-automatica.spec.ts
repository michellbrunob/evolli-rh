import "reflect-metadata";
import { BadRequestException, ConflictException } from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { Prisma } from "@prisma/client";
import {
  chaveDoNome,
  codigosCandidatos,
  criarComCodigoAutomatico,
  LIMITE_DE_CODIGOS_CANDIDATOS,
  normalizarNomeDaReferencia,
} from "./criacao-automatica";
import { ConflitoDeReferenciaException } from "../common/erros/recusa-por-campo";
import {
  CriarCargoDto,
  CriarCentroCustoDto,
  CriarDepartamentoDto,
  CriarEmpresaDto,
  CriarUnidadeOrganizacionalDto,
} from "./dto/organizacao.dto";
import { PrismaService } from "../database/prisma.service";

/**
 * T197 — criação inline com código gerado no servidor. Prisma é dublê: aqui
 * se verifica a DECISÃO (nome normalizado, código, recusas, nova tentativa);
 * banco real, concorrência e isolamento ficam no E2E.
 */

const CODIGO_PATTERN = /^[A-Z0-9_]{2,32}$/;
const EMPRESA = "empresa-a";

describe("T197 — normalizarNomeDaReferencia", () => {
  it("apara as extremidades e reduz espaços repetidos, preservando maiúsculas e acentos", () => {
    expect(normalizarNomeDaReferencia("  Ação   Única  ")).toBe("Ação Única");
  });

  it("recusa vazio, só espaços, caractere de controle e mais de 160", () => {
    expect(normalizarNomeDaReferencia("")).toBeNull();
    expect(normalizarNomeDaReferencia("   ")).toBeNull();
    expect(normalizarNomeDaReferencia("a\tb")).toBeNull();
    expect(normalizarNomeDaReferencia("a\u0000b")).toBeNull();
    expect(normalizarNomeDaReferencia("x".repeat(161))).toBeNull();
    expect(normalizarNomeDaReferencia("x".repeat(160))).toBe("x".repeat(160));
  });

  it("a chave não diferencia maiúsculas nem espaços repetidos, mas distingue acento", () => {
    expect(chaveDoNome(" Ação  Única")).toBe(chaveDoNome("AÇÃO ÚNICA"));
    expect(chaveDoNome("Acao")).not.toBe(chaveDoNome("Ação"));
  });
});

describe("T197 — codigosCandidatos", () => {
  it("ASCII em maiúsculas, com _ no lugar de espaços e símbolos", () => {
    expect(codigosCandidatos("Ação & Única-2", "DEP")[0]).toBe("ACAO_UNICA_2");
  });

  it("nome curto ou só símbolos usa o prefixo do tipo", () => {
    expect(codigosCandidatos("x", "CAR")[0]).toBe("CAR_X");
    expect(codigosCandidatos("!!!", "UNI")[0]).toBe("UNI");
    expect(codigosCandidatos("—", "CC")[0]).toBe("CC");
  });

  it("colisões seguem _2, _3… até o limite, todos válidos e com até 32", () => {
    const candidatos = codigosCandidatos("Nome muito longo ".repeat(4), "DEP");
    expect(candidatos).toHaveLength(LIMITE_DE_CODIGOS_CANDIDATOS);
    expect(candidatos[1]).toMatch(/_2$/);
    expect(candidatos[49]).toMatch(/_50$/);
    expect(new Set(candidatos).size).toBe(candidatos.length);
    for (const c of candidatos) expect(c).toMatch(CODIGO_PATTERN);
  });
});

interface Gravada {
  id: string;
  codigo: string;
  nome: string;
  status: "ativo" | "inativo";
  empresaId: string;
}

function erroDeUnicidade() {
  return new Prisma.PrismaClientKnownRequestError("unique", {
    code: "P2002",
    clientVersion: "test",
  });
}

function cenario({
  mesmoNome = [] as Gravada[],
  codigosUsados = [] as string[],
  falhasDeUnicidade = 0,
} = {}) {
  const tx = { $executeRaw: jest.fn().mockResolvedValue(1) };
  const prisma = {
    $transaction: jest.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  let falhas = falhasDeUnicidade;
  const criar = jest.fn(
    async (
      _tx: unknown,
      dados: { empresaId: string; codigo: string; nome: string },
    ) => {
      if (falhas > 0) {
        falhas -= 1;
        throw erroDeUnicidade();
      }
      return { id: "nova", status: "ativo" as const, ...dados };
    },
  );
  const auditar = jest.fn().mockResolvedValue(undefined);
  const porNome = jest.fn().mockResolvedValue(mesmoNome);
  const usados = jest
    .fn()
    .mockResolvedValue(codigosUsados.map((codigo) => ({ codigo })));
  const executar = (nome: string) =>
    criarComCodigoAutomatico<Gravada>({
      prisma: prisma as unknown as PrismaService,
      tipo: "cargo",
      prefixo: "CAR",
      empresaId: EMPRESA,
      nome,
      porNome,
      codigosUsados: usados,
      criar,
      auditar,
    });
  return { tx, prisma, criar, auditar, porNome, usados, executar };
}

describe("T197 — criarComCodigoAutomatico", () => {
  it("cria com o nome normalizado e o primeiro código livre, sob trava, e audita", async () => {
    const c = cenario({ codigosUsados: ["ANALISTA_FISCAL"] });
    const criada = await c.executar("  Analista   Fiscal ");
    expect(criada).toMatchObject({
      nome: "Analista Fiscal",
      codigo: "ANALISTA_FISCAL_2",
      empresaId: EMPRESA,
    });
    expect(c.tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(c.porNome).toHaveBeenCalledWith(c.tx, {
      empresaId: EMPRESA,
      nome: { contains: "Analista", mode: "insensitive" },
    });
    expect(c.auditar).toHaveBeenCalledWith(c.tx, criada);
  });

  it("nome ativo igual (sem diferenciar maiúsculas): 409 nome_em_uso com a existente, sem criar", async () => {
    const existente: Gravada = {
      id: "e1",
      codigo: "AF",
      nome: "analista  FISCAL",
      status: "ativo",
      empresaId: EMPRESA,
    };
    const c = cenario({ mesmoNome: [existente] });
    const erro = await c.executar("Analista Fiscal").catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ConflitoDeReferenciaException);
    expect(erro).toMatchObject({
      codigo: "nome_em_uso",
      referencia: { id: "e1", codigo: "AF", nome: "analista  FISCAL" },
    });
    expect(c.criar).not.toHaveBeenCalled();
    expect(c.auditar).not.toHaveBeenCalled();
  });

  it("só inativa com o nome: 409 nome_inativo, sem reativar nem criar", async () => {
    const c = cenario({
      mesmoNome: [
        {
          id: "i1",
          codigo: "AF",
          nome: "Analista Fiscal",
          status: "inativo",
          empresaId: EMPRESA,
        },
      ],
    });
    await expect(c.executar("Analista Fiscal")).rejects.toMatchObject({
      codigo: "nome_inativo",
      referencia: undefined,
    });
    expect(c.criar).not.toHaveBeenCalled();
  });

  it("nome que só contém o trecho não conta como repetido", async () => {
    const c = cenario({
      mesmoNome: [
        {
          id: "o1",
          codigo: "AFS",
          nome: "Analista Fiscal Sênior",
          status: "ativo",
          empresaId: EMPRESA,
        },
      ],
    });
    await expect(c.executar("Analista Fiscal")).resolves.toMatchObject({
      codigo: "ANALISTA_FISCAL",
    });
  });

  it("sem código livre entre os 50 candidatos: 409 codigo_indisponivel", async () => {
    const c = cenario({ codigosUsados: codigosCandidatos("Analista", "CAR") });
    await expect(c.executar("Analista")).rejects.toMatchObject({
      codigo: "codigo_indisponivel",
    });
    expect(c.criar).not.toHaveBeenCalled();
  });

  it("código tomado por outro pedido na gravação: a transação roda de novo", async () => {
    const c = cenario({ falhasDeUnicidade: 2 });
    await expect(c.executar("Analista")).resolves.toMatchObject({
      codigo: "ANALISTA",
    });
    expect(c.prisma.$transaction).toHaveBeenCalledTimes(3);
  });

  it("unicidade violada em todas as tentativas: 409 genérico, sem laço infinito", async () => {
    const c = cenario({ falhasDeUnicidade: 99 });
    await expect(c.executar("Analista")).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(c.prisma.$transaction).toHaveBeenCalledTimes(5);
  });

  it("nome inválido depois de normalizado: 400, sem transação", async () => {
    const c = cenario();
    await expect(c.executar("  \u0007 ")).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(c.executar("   ")).rejects.toBeInstanceOf(BadRequestException);
    expect(c.prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe("T197 — código opcional só nas quatro referências", () => {
  const base = {
    empresaId: "11111111-1111-4111-8111-111111111111",
    nome: "Nome",
  };

  it.each([
    ["Departamento", CriarDepartamentoDto],
    ["Cargo", CriarCargoDto],
    ["Unidade", CriarUnidadeOrganizacionalDto],
    ["Centro de custo", CriarCentroCustoDto],
  ])(
    "%s: sem código é aceito; vazio, nulo ou fora da regra é recusado",
    async (_n, Dto) => {
      const valida = async (corpo: Record<string, unknown>) =>
        validate(plainToInstance(Dto, corpo), {
          whitelist: true,
          forbidNonWhitelisted: true,
        });
      expect(await valida(base)).toHaveLength(0);
      expect(await valida({ ...base, codigo: "COD_1" })).toHaveLength(0);
      expect(await valida({ ...base, codigo: "" })).not.toHaveLength(0);
      expect(await valida({ ...base, codigo: null })).not.toHaveLength(0);
      expect(await valida({ ...base, codigo: "cod" })).not.toHaveLength(0);
    },
  );

  it("Empresa continua exigindo código", async () => {
    const erros = await validate(
      plainToInstance(CriarEmpresaDto, { nome: "Nome" }),
    );
    expect(erros).not.toHaveLength(0);
  });
});
