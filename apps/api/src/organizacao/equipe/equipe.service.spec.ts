import {
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { AccessRole, AccessUser } from "@prisma/client";
import { EquipeService } from "./equipe.service";
import { OrganizacaoAuditoriaService } from "../organizacao-auditoria.service";
import { PrismaService } from "../../database/prisma.service";

/**
 * Equipe é o único nó com **dois** pais (departamento obrigatório, unidade
 * opcional) e, por isso, o único onde uma referência poderia cruzar empresas
 * (spec R5). Aqui se prova a recusa na aplicação; a recusa no banco, via FK
 * composta, é provada nos testes e2e.
 */

function ator(overrides: Partial<AccessUser> = {}): AccessUser {
  return {
    id: "user-1",
    email: "rh@example.test",
    passwordHash: "hash",
    role: "rh" as AccessRole,
    companyId: "empresa-a",
    unitId: null,
    teamId: null,
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as AccessUser;
}

const contexto = (actor: AccessUser = ator()) => ({
  actor,
  metadata: { ip: null, userAgent: null, requestId: "req-1" },
});

interface PrismaDuble {
  departamento: { findFirst: jest.Mock };
  unidadeOrganizacional: { findFirst: jest.Mock };
  equipe: {
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
  };
  $transaction: jest.Mock;
}

function criarPrisma(): PrismaDuble {
  const duble: PrismaDuble = {
    departamento: { findFirst: jest.fn() },
    unidadeOrganizacional: { findFirst: jest.fn() },
    equipe: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    $transaction: jest.fn(async (cb: (tx: unknown) => Promise<unknown>) =>
      cb(duble),
    ),
  };
  return duble;
}

function montar(prisma: PrismaDuble) {
  const auditoria = {
    registrarMutacao: jest.fn().mockResolvedValue(undefined),
    registrarConsultaAmpla: jest.fn().mockResolvedValue(undefined),
    // Espelha o contrato real: registra o evento `denied` e responde 404.
    negarAcesso: jest.fn().mockImplementation(() => {
      throw new NotFoundException();
    }),
  } as unknown as jest.Mocked<OrganizacaoAuditoriaService>;
  const service = new EquipeService(
    prisma as unknown as PrismaService,
    auditoria,
  );
  return { service, auditoria };
}

const DEPARTAMENTO = {
  id: "dep-1",
  empresaId: "empresa-a",
  status: "ativo" as const,
};

const EQUIPE_CRIADA = {
  id: "eq-1",
  empresaId: "empresa-a",
  departamentoId: "dep-1",
  unidadeOrganizacionalId: null,
  codigo: "SQUAD1",
  nome: "Squad 1",
  status: "ativo" as const,
  criadoEm: new Date(),
  atualizadoEm: new Date(),
};

describe("EquipeService", () => {
  it("deriva empresaId do departamento, nunca do corpo da requisição", async () => {
    const prisma = criarPrisma();
    prisma.departamento.findFirst.mockResolvedValue(DEPARTAMENTO);
    prisma.equipe.create.mockResolvedValue(EQUIPE_CRIADA);
    const { service } = montar(prisma);

    await service.criar(
      { departamentoId: "dep-1", codigo: "SQUAD1", nome: "Squad 1" },
      contexto(),
    );

    expect(prisma.equipe.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        empresaId: "empresa-a",
        departamentoId: "dep-1",
        unidadeOrganizacionalId: null,
      }),
    });
  });

  it("recusa unidade de outra empresa (R5) com 422, não 404", async () => {
    const prisma = criarPrisma();
    prisma.departamento.findFirst.mockResolvedValue(DEPARTAMENTO);
    // Unidade existe e está no escopo do ator, mas é de outra empresa.
    prisma.unidadeOrganizacional.findFirst.mockResolvedValue({
      id: "uni-9",
      empresaId: "empresa-b",
      status: "ativo",
    });
    const { service } = montar(prisma);

    await expect(
      service.criar(
        {
          departamentoId: "dep-1",
          unidadeOrganizacionalId: "uni-9",
          codigo: "SQUAD1",
          nome: "Squad 1",
        },
        contexto(),
      ),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(prisma.equipe.create).not.toHaveBeenCalled();
  });

  it("recusa departamento inativo como pai (R-INA-3)", async () => {
    const prisma = criarPrisma();
    prisma.departamento.findFirst.mockResolvedValue({
      ...DEPARTAMENTO,
      status: "inativo",
    });
    const { service } = montar(prisma);

    await expect(
      service.criar(
        { departamentoId: "dep-1", codigo: "SQUAD1", nome: "Squad 1" },
        contexto(),
      ),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it("recusa unidade inativa como pai (R-INA-3)", async () => {
    const prisma = criarPrisma();
    prisma.departamento.findFirst.mockResolvedValue(DEPARTAMENTO);
    prisma.unidadeOrganizacional.findFirst.mockResolvedValue({
      id: "uni-1",
      empresaId: "empresa-a",
      status: "inativo",
    });
    const { service } = montar(prisma);

    await expect(
      service.criar(
        {
          departamentoId: "dep-1",
          unidadeOrganizacionalId: "uni-1",
          codigo: "SQUAD1",
          nome: "Squad 1",
        },
        contexto(),
      ),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it("recusa departamento fora do escopo com 404 (anti-enumeração)", async () => {
    const prisma = criarPrisma();
    prisma.departamento.findFirst.mockResolvedValue(null);
    const { service } = montar(prisma);

    await expect(
      service.criar(
        { departamentoId: "dep-de-outra", codigo: "SQUAD1", nome: "Squad 1" },
        contexto(),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("atualização não move a equipe de departamento nem de unidade", async () => {
    const prisma = criarPrisma();
    prisma.equipe.findFirst.mockResolvedValue(EQUIPE_CRIADA);
    prisma.equipe.update.mockResolvedValue({
      ...EQUIPE_CRIADA,
      nome: "Squad Um",
    });
    const { service } = montar(prisma);

    await service.atualizar("eq-1", { nome: "Squad Um" }, contexto());

    expect(prisma.equipe.update).toHaveBeenCalledWith({
      where: { id: "eq-1" },
      data: { nome: "Squad Um" },
    });
  });
});
