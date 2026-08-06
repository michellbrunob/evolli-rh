import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { AccessRole, AccessUser } from "@prisma/client";
import { DepartamentoService } from "./departamento.service";
import { OrganizacaoAuditoriaService } from "../organizacao-auditoria.service";
import { PrismaService } from "../../database/prisma.service";

/**
 * Regras de integridade, escopo e auditoria do Núcleo Organizacional
 * (spec §4/§5/§9). Prisma é dublê: aqui se verifica a **decisão** do service,
 * não o comportamento do banco — as garantias de banco (FK composta,
 * unicidade, append-only) são provadas nos testes e2e contra PostgreSQL real.
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

const metadata = {
  ip: null,
  userAgent: null,
  requestId: "req-1",
};

function contexto(actor: AccessUser = ator()) {
  return { actor, metadata };
}

interface PrismaDuble {
  empresa: { findFirst: jest.Mock };
  departamento: {
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
  };
  area: { count: jest.Mock };
  equipe: { count: jest.Mock };
  $transaction: jest.Mock;
}

function criarPrisma(): PrismaDuble {
  const duble: PrismaDuble = {
    empresa: { findFirst: jest.fn() },
    departamento: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    area: { count: jest.fn().mockResolvedValue(0) },
    equipe: { count: jest.fn().mockResolvedValue(0) },
    // Executa o callback com o próprio dublê, imitando o client de transação.
    $transaction: jest.fn(async (cb: (tx: unknown) => Promise<unknown>) =>
      cb(duble),
    ),
  };
  return duble;
}

function criarAuditoria() {
  return {
    registrarMutacao: jest.fn().mockResolvedValue(undefined),
    registrarConsultaAmpla: jest.fn().mockResolvedValue(undefined),
    // Espelha o contrato real: registra o evento `denied` e responde 404.
    negarAcesso: jest.fn().mockImplementation(() => {
      throw new NotFoundException();
    }),
  } as unknown as jest.Mocked<OrganizacaoAuditoriaService>;
}

function montar(prisma: PrismaDuble, auditoria = criarAuditoria()) {
  const service = new DepartamentoService(
    prisma as unknown as PrismaService,
    auditoria,
  );
  return { service, auditoria };
}

const DEPARTAMENTO_ATIVO = {
  id: "dep-1",
  empresaId: "empresa-a",
  codigo: "FIN",
  nome: "Financeiro",
  status: "ativo" as const,
  criadoEm: new Date(),
  atualizadoEm: new Date(),
};

describe("DepartamentoService", () => {
  describe("criar", () => {
    it("recusa empresa fora do escopo do ator com 404, nunca 403", async () => {
      const prisma = criarPrisma();
      // Escopo do ator é empresa-a; a consulta com AND não encontra empresa-b.
      prisma.empresa.findFirst.mockResolvedValue(null);
      const { service } = montar(prisma);

      await expect(
        service.criar(
          { empresaId: "empresa-b", codigo: "FIN", nome: "Financeiro" },
          contexto(),
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("recusa criação sob empresa inativa (R-INA-3)", async () => {
      const prisma = criarPrisma();
      prisma.empresa.findFirst.mockResolvedValue({
        id: "empresa-a",
        status: "inativo",
      });
      const { service } = montar(prisma);

      await expect(
        service.criar(
          { empresaId: "empresa-a", codigo: "FIN", nome: "Financeiro" },
          contexto(),
        ),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it("persiste alteração e evento de auditoria na MESMA transação", async () => {
      const prisma = criarPrisma();
      prisma.empresa.findFirst.mockResolvedValue({
        id: "empresa-a",
        status: "ativo",
      });
      prisma.departamento.create.mockResolvedValue(DEPARTAMENTO_ATIVO);
      const { service, auditoria } = montar(prisma);

      await service.criar(
        { empresaId: "empresa-a", codigo: "FIN", nome: "Financeiro" },
        contexto(),
      );

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(auditoria.registrarMutacao).toHaveBeenCalledTimes(1);
      // Primeiro argumento é o client de transação — prova de atomicidade.
      expect(auditoria.registrarMutacao.mock.calls[0]?.[0]).toBe(prisma);
      expect(auditoria.registrarMutacao.mock.calls[0]?.[2]).toBe(
        "organizacao_departamento_criado",
      );
      // Escopo do evento é a empresa da entidade afetada (RI-2).
      expect(auditoria.registrarMutacao.mock.calls[0]?.[5]).toBe("empresa-a");
    });

    it("nega papel sem permissão de escrita mesmo com empresa no escopo", async () => {
      const prisma = criarPrisma();
      prisma.empresa.findFirst.mockResolvedValue({
        id: "empresa-a",
        status: "ativo",
      });
      const { service } = montar(prisma);

      await expect(
        service.criar(
          { empresaId: "empresa-a", codigo: "FIN", nome: "Financeiro" },
          contexto(ator({ role: "dp" as AccessRole })),
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.departamento.create).not.toHaveBeenCalled();
    });
  });

  describe("inativar", () => {
    it("bloqueia quando há área ativa vinculada — sem cascata (R-INA-2)", async () => {
      const prisma = criarPrisma();
      prisma.departamento.findFirst.mockResolvedValue(DEPARTAMENTO_ATIVO);
      prisma.area.count.mockResolvedValue(1);
      const { service } = montar(prisma);

      await expect(
        service.inativar("dep-1", contexto()),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.departamento.update).not.toHaveBeenCalled();
    });

    it("bloqueia quando há equipe ativa vinculada", async () => {
      const prisma = criarPrisma();
      prisma.departamento.findFirst.mockResolvedValue(DEPARTAMENTO_ATIVO);
      prisma.equipe.count.mockResolvedValue(2);
      const { service } = montar(prisma);

      await expect(
        service.inativar("dep-1", contexto()),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.departamento.update).not.toHaveBeenCalled();
    });

    it("inativa quando não há filho ativo, com evento atômico", async () => {
      const prisma = criarPrisma();
      prisma.departamento.findFirst.mockResolvedValue(DEPARTAMENTO_ATIVO);
      prisma.departamento.update.mockResolvedValue({
        ...DEPARTAMENTO_ATIVO,
        status: "inativo",
      });
      const { service, auditoria } = montar(prisma);

      const resultado = await service.inativar("dep-1", contexto());

      expect(resultado.status).toBe("inativo");
      expect(prisma.departamento.update).toHaveBeenCalledWith({
        where: { id: "dep-1" },
        data: { status: "inativo" },
      });
      expect(auditoria.registrarMutacao.mock.calls[0]?.[2]).toBe(
        "organizacao_departamento_inativado",
      );
    });

    it("recusa inativar o que já está inativo", async () => {
      const prisma = criarPrisma();
      prisma.departamento.findFirst.mockResolvedValue({
        ...DEPARTAMENTO_ATIVO,
        status: "inativo",
      });
      const { service } = montar(prisma);

      await expect(
        service.inativar("dep-1", contexto()),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it("nunca inativa em cascata: só a própria entidade é atualizada", async () => {
      const prisma = criarPrisma();
      prisma.departamento.findFirst.mockResolvedValue(DEPARTAMENTO_ATIVO);
      prisma.departamento.update.mockResolvedValue({
        ...DEPARTAMENTO_ATIVO,
        status: "inativo",
      });
      const { service } = montar(prisma);

      await service.inativar("dep-1", contexto());

      expect(prisma.departamento.update).toHaveBeenCalledTimes(1);
      // Nenhum update em área ou equipe existe sequer como capacidade aqui.
      expect(Object.keys(prisma.area)).toEqual(["count"]);
      expect(Object.keys(prisma.equipe)).toEqual(["count"]);
    });
  });

  describe("escopo", () => {
    it("ator sem empresa e sem papel global é recusado", async () => {
      const prisma = criarPrisma();
      const { service } = montar(prisma);

      await expect(
        service.listar(
          { pagina: 1, tamanhoPagina: 20 },
          contexto(ator({ companyId: null })),
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("ator escopado filtra sempre pela própria empresa", async () => {
      const prisma = criarPrisma();
      const { service } = montar(prisma);

      await service.listar({ pagina: 1, tamanhoPagina: 20 }, contexto());

      expect(prisma.departamento.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ empresaId: "empresa-a" }),
          orderBy: { codigo: "asc" },
        }),
      );
    });

    it("ator escopado pedindo outra empresa recebe página vazia, não erro", async () => {
      const prisma = criarPrisma();
      const { service } = montar(prisma);

      const resultado = await service.listar(
        { pagina: 1, tamanhoPagina: 20, empresaId: "empresa-b" },
        contexto(),
      );

      expect(resultado).toEqual({
        itens: [],
        pagina: 1,
        tamanhoPagina: 20,
        total: 0,
      });
      expect(prisma.departamento.findMany).not.toHaveBeenCalled();
    });

    it("detalhe fora do escopo responde 404 (anti-enumeração)", async () => {
      const prisma = criarPrisma();
      prisma.departamento.findFirst.mockResolvedValue(null);
      const { service } = montar(prisma);

      await expect(
        service.detalhar("dep-de-outra-empresa", contexto()),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("a tentativa fora do escopo é registrada como denied na trilha", async () => {
      const prisma = criarPrisma();
      prisma.departamento.findFirst.mockResolvedValue(null);
      const { service, auditoria } = montar(prisma);

      await expect(
        service.detalhar("dep-de-outra-empresa", contexto()),
      ).rejects.toBeInstanceOf(NotFoundException);

      // Resposta pública é 404, mas a trilha interna registra a sondagem
      // (spec §9/§10) — é isso que torna varredura entre empresas detectável.
      expect(auditoria.negarAcesso).toHaveBeenCalledWith(
        expect.objectContaining({
          actor: expect.objectContaining({ id: "user-1" }),
        }),
        "departamento",
        "dep-de-outra-empresa",
        null,
      );
    });

    it("consulta ampla é auditada só quando o escopo é global", async () => {
      const prisma = criarPrisma();
      const { service, auditoria } = montar(prisma);

      await service.listar({ pagina: 1, tamanhoPagina: 20 }, contexto());
      const escopoEscopado =
        auditoria.registrarConsultaAmpla.mock.calls[0]?.[0];
      expect(escopoEscopado).toEqual({ global: false, empresaId: "empresa-a" });

      await service.listar(
        { pagina: 1, tamanhoPagina: 20 },
        contexto(
          ator({ role: "admin_tecnico" as AccessRole, companyId: null }),
        ),
      );
      const escopoGlobal = auditoria.registrarConsultaAmpla.mock.calls[1]?.[0];
      expect(escopoGlobal).toEqual({ global: true });
    });
  });

  describe("atualização", () => {
    it("altera apenas o nome — codigo e empresa permanecem imutáveis", async () => {
      const prisma = criarPrisma();
      prisma.departamento.findFirst.mockResolvedValue(DEPARTAMENTO_ATIVO);
      prisma.departamento.update.mockResolvedValue({
        ...DEPARTAMENTO_ATIVO,
        nome: "Financeiro e Controladoria",
      });
      const { service } = montar(prisma);

      await service.atualizar(
        "dep-1",
        { nome: "Financeiro e Controladoria" },
        contexto(),
      );

      expect(prisma.departamento.update).toHaveBeenCalledWith({
        where: { id: "dep-1" },
        data: { nome: "Financeiro e Controladoria" },
      });
    });
  });
});
