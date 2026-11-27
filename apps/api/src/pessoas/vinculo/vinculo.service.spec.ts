import "reflect-metadata";
import { AccessUser } from "@prisma/client";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CamposRecusadosException } from "../../common/erros/recusa-por-campo";
import { PrismaService } from "../../database/prisma.service";
import { CriarVinculoDto } from "../dto/pessoas.dto";
import { PessoasAuditoriaService } from "../pessoas-auditoria.service";
import { VinculoService } from "./vinculo.service";

/**
 * T215 — readmissão (`POST /v1/vinculos`): como na Nova admissão, ninguém é
 * admitido sem o primeiro salário, e ele abre a linha do tempo salarial do
 * vínculo NOVO (tag Admissão, na data de admissão, com o cargo da
 * contratação). Sem banco: o E2E prova o mesmo de ponta a ponta.
 *
 * **Valores sintéticos.**
 */

const EMPRESA = "11111111-1111-4111-8111-111111111111";
const COLABORADOR = "22222222-2222-4222-8222-222222222222";
const DEPARTAMENTO = "33333333-3333-4333-8333-333333333333";
const CARGO = "55555555-5555-4555-8555-555555555555";

const ctx = {
  actor: {
    id: "ator-rh",
    role: "rh",
    companyId: EMPRESA,
  } as unknown as AccessUser,
  metadata: { ip: null, userAgent: null, requestId: "req-t215" },
};

const CORPO = {
  colaboradorId: COLABORADOR,
  empresaId: EMPRESA,
  matricula: "MAT-T215-R",
  tipo: "clt",
  dataAdmissao: "2026-10-01",
  motivoCodigo: "admissao_inicial",
  departamentoId: DEPARTAMENTO,
  cargoId: CARGO,
};

function montar() {
  const tx = {
    departamento: { count: jest.fn(async () => 1) },
    cargo: {
      count: jest.fn(async () => 1),
      findFirst: jest.fn(async () => ({ nome: "Analista" })),
    },
    vinculoFuncional: {
      create: jest.fn(async () => ({
        id: "vin-novo",
        dataAdmissao: new Date("2026-10-01T00:00:00.000Z"),
      })),
    },
    movimentacaoFuncional: { create: jest.fn(async () => ({ id: "mov-1" })) },
    contratoVinculo: {
      create: jest.fn(async () => ({
        vinculoId: "vin-novo",
        nivel: null,
        gestorDiretoColaboradorId: null,
        jornadaSemanalHoras: null,
        escala: null,
        salarioBruto: { toFixed: () => "2500.00" },
        conselhoProfissional: null,
        registroProfissional: null,
        dependentesIrrf: null,
        pensaoAlimenticiaPercentual: null,
      })),
    },
    alteracaoSalarial: { create: jest.fn(async () => ({ id: "alt-1" })) },
  };
  const prisma = {
    colaborador: { findFirst: jest.fn(async () => ({ id: COLABORADOR })) },
    $transaction: jest.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  const auditoria = {
    registrarMutacao: jest.fn(async () => undefined),
    negarAcesso: jest.fn(async () => {
      throw new Error("negado");
    }),
  };
  const servico = new VinculoService(
    prisma as unknown as PrismaService,
    auditoria as unknown as PessoasAuditoriaService,
  );
  return { servico, prisma, tx };
}

describe("T215 — readmissão com o primeiro salário", () => {
  it("o DTO aceita o bloco contrato (com as mesmas validações da admissão)", async () => {
    const opcoes = { whitelist: true, forbidNonWhitelisted: true };
    expect(
      await validate(
        plainToInstance(CriarVinculoDto, {
          ...CORPO,
          contrato: { salarioBruto: "2500.00" },
        }),
        opcoes,
      ),
    ).toEqual([]);
    const invalido = await validate(
      plainToInstance(CriarVinculoDto, {
        ...CORPO,
        contrato: { salarioBruto: "0" },
      }),
      opcoes,
    );
    expect(invalido.map((e) => e.property)).toEqual(["contrato"]);
  });

  it.each([
    ["sem o bloco contrato", undefined],
    ["contrato sem salário", { nivel: "pleno" }],
  ])(
    "%s: 422 contrato.salarioBruto obrigatorio, antes de gravar",
    async (_caso, contrato) => {
      const { servico, prisma } = montar();
      const dto = plainToInstance(CriarVinculoDto, { ...CORPO, contrato });
      const erro = await servico.criar(dto, ctx).catch((e: unknown) => e);
      expect(erro).toBeInstanceOf(CamposRecusadosException);
      expect((erro as CamposRecusadosException).erros).toEqual([
        { campo: "contrato.salarioBruto", motivo: "obrigatorio" },
      ]);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    },
  );

  it("com salário: grava o contrato e abre a linha da admissão do vínculo novo", async () => {
    const { servico, tx } = montar();
    const dto = plainToInstance(CriarVinculoDto, {
      ...CORPO,
      contrato: { salarioBruto: "2500.00" },
    });
    await servico.criar(dto, ctx);
    expect(tx.contratoVinculo.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        vinculoId: "vin-novo",
        empresaId: EMPRESA,
        salarioBruto: "2500.00",
      }),
    });
    expect(tx.alteracaoSalarial.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        vinculoId: "vin-novo",
        empresaId: EMPRESA,
        origem: "admissao",
        vigenciaInicio: new Date("2026-10-01T00:00:00.000Z"),
        salarioBruto: "2500.00",
        cargo: "Analista",
        registradaPorUserId: "ator-rh",
      }),
      select: { id: true },
    });
  });
});
