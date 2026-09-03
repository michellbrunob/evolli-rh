import { HttpException, HttpStatus } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { AuditService } from "../../audit/audit.service";
import {
  RATE_LIMIT_MAX_ATTEMPTS,
  RateLimitService,
} from "./rate-limit.service";

function createPrismaMock() {
  return {
    accessLoginAttempt: {
      count: jest.fn(),
      create: jest.fn(),
    },
  } as unknown as PrismaService & {
    accessLoginAttempt: { count: jest.Mock; create: jest.Mock };
  };
}

function createAuditServiceMock() {
  return { record: jest.fn() } as unknown as AuditService & {
    record: jest.Mock;
  };
}

describe("RateLimitService", () => {
  describe("assertNotRateLimited (regra de falha de login — inalterada)", () => {
    it("conta SOMENTE tentativas com succeeded: false", async () => {
      const prisma = createPrismaMock();
      prisma.accessLoginAttempt.count.mockResolvedValue(0);
      const service = new RateLimitService(prisma, createAuditServiceMock());

      await service.assertNotRateLimited(
        "vitima@empresa.test",
        "1.2.3.4",
        "req",
      );

      const where = prisma.accessLoginAttempt.count.mock.calls[0][0].where;
      expect(where.succeeded).toBe(false);
      expect(where.emailAttempted).toBe("vitima@empresa.test");
      expect(where.ip).toBe("1.2.3.4");
    });

    it("não bloqueia abaixo do limite", async () => {
      const prisma = createPrismaMock();
      prisma.accessLoginAttempt.count.mockResolvedValue(
        RATE_LIMIT_MAX_ATTEMPTS - 1,
      );
      const service = new RateLimitService(prisma, createAuditServiceMock());

      await expect(
        service.assertNotRateLimited("a@b.test", "1.1.1.1", "req"),
      ).resolves.toBeUndefined();
    });
  });

  describe("assertRequestRateNotExceeded (limite de recuperação de senha)", () => {
    it("conta TODAS as solicitações da janela, sem filtrar por succeeded", async () => {
      const prisma = createPrismaMock();
      prisma.accessLoginAttempt.count.mockResolvedValue(0);
      const service = new RateLimitService(prisma, createAuditServiceMock());

      await service.assertRequestRateNotExceeded(
        "reset:vitima@empresa.test",
        "1.2.3.4",
        "req",
      );

      const where = prisma.accessLoginAttempt.count.mock.calls[0][0].where;
      // A ausência do filtro `succeeded` é o cerne da correção P2: cada
      // solicitação conta, mesmo as gravadas como "bem-sucedidas".
      expect(where).not.toHaveProperty("succeeded");
      expect(where.emailAttempted).toBe("reset:vitima@empresa.test");
      expect(where.ip).toBe("1.2.3.4");
      expect(where.createdAt).toHaveProperty("gte");
    });

    it("normaliza a chave (caixa/espaço) antes de contar", async () => {
      const prisma = createPrismaMock();
      prisma.accessLoginAttempt.count.mockResolvedValue(0);
      const service = new RateLimitService(prisma, createAuditServiceMock());

      await service.assertRequestRateNotExceeded(
        "  RESET:Vitima@Empresa.TEST  ",
        "1.2.3.4",
        "req",
      );

      const where = prisma.accessLoginAttempt.count.mock.calls[0][0].where;
      expect(where.emailAttempted).toBe("reset:vitima@empresa.test");
    });

    it("bloqueia com 429 e audita quando atinge o limite", async () => {
      const prisma = createPrismaMock();
      prisma.accessLoginAttempt.count.mockResolvedValue(
        RATE_LIMIT_MAX_ATTEMPTS,
      );
      const audit = createAuditServiceMock();
      const service = new RateLimitService(prisma, audit);

      await expect(
        service.assertRequestRateNotExceeded(
          "reset:a@b.test",
          "9.9.9.9",
          "req",
        ),
      ).rejects.toMatchObject({
        status: HttpStatus.TOO_MANY_REQUESTS,
      });

      expect(audit.record).toHaveBeenCalledTimes(1);
      expect(audit.record.mock.calls[0][0]).toMatchObject({
        action: "rate_limit_blocked",
        result: "denied",
      });
    });

    it("a mensagem pública do bloqueio é fixa e não revela contagem/janela", async () => {
      const prisma = createPrismaMock();
      prisma.accessLoginAttempt.count.mockResolvedValue(
        RATE_LIMIT_MAX_ATTEMPTS + 3,
      );
      const service = new RateLimitService(prisma, createAuditServiceMock());

      const erro = await service
        .assertRequestRateNotExceeded("reset:a@b.test", "9.9.9.9", "req")
        .catch((e: unknown) => e);

      expect(erro).toBeInstanceOf(HttpException);
      expect((erro as HttpException).message).toBe("Muitas requisições.");
    });
  });
});
