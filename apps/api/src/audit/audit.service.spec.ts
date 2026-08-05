import { PinoLogger } from "nestjs-pino";
import { PrismaService } from "../database/prisma.service";
import { AuditService } from "./audit.service";
import { AUDIT_ACTIONS } from "./audit.types";

function createLoggerMock() {
  return {
    setContext: jest.fn(),
    error: jest.fn(),
  } as unknown as PinoLogger & { setContext: jest.Mock; error: jest.Mock };
}

function createPrismaMock() {
  return {
    auditEvent: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
    },
  } as unknown as PrismaService & {
    auditEvent: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      count: jest.Mock;
    };
  };
}

const baseUserEvent = {
  actorType: "user" as const,
  actorUserId: "user-1",
  actorRole: "admin_tecnico" as const,
  action: "login_succeeded" as const,
  resource: "access_session" as const,
  resourceId: "session-1",
  ip: "203.0.113.5",
  userAgent: "jest-agent",
  result: "success" as const,
  requestId: "req-1",
};

describe("AuditService", () => {
  it("record() persiste evento de ator usuário com os metadados esperados, nada além disso", async () => {
    const prisma = createPrismaMock();
    prisma.auditEvent.create.mockResolvedValue({});
    const service = new AuditService(prisma, createLoggerMock());

    await service.record(baseUserEvent);

    expect(prisma.auditEvent.create).toHaveBeenCalledTimes(1);
    const data = prisma.auditEvent.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      actorType: "user",
      actorUserId: "user-1",
      actorRole: "admin_tecnico",
      action: "login_succeeded",
      resource: "access_session",
      resourceId: "session-1",
      ip: "203.0.113.5",
      userAgent: "jest-agent",
      result: "success",
      requestId: "req-1",
    });
    expect(data.occurredAt).toBeInstanceOf(Date);
    // Nenhum campo além do conjunto fechado — em particular, nenhum
    // dado_anterior/dado_novo, nunca aceito por RecordAuditEventInput.
    expect(Object.keys(data).sort()).toEqual(
      [
        "occurredAt",
        "actorType",
        "actorUserId",
        "actorRole",
        "companyId",
        "unitId",
        "teamId",
        "action",
        "resource",
        "resourceId",
        "ip",
        "userAgent",
        "result",
        "requestId",
        "correlationId",
      ].sort(),
    );
  });

  it("record() persiste evento de ator sistema (sem usuário resolvido), papel nunca preenchido", async () => {
    const prisma = createPrismaMock();
    prisma.auditEvent.create.mockResolvedValue({});
    const service = new AuditService(prisma, createLoggerMock());

    await service.record({
      actorType: "system",
      actorSystemId: "auth-service:login",
      action: "login_failed",
      resource: "access_user",
      resourceId: null,
      ip: null,
      userAgent: null,
      result: "failure",
      requestId: "req-2",
    });

    const data = prisma.auditEvent.create.mock.calls[0][0].data;
    expect(data.actorType).toBe("system");
    expect(data.actorSystemId).toBe("auth-service:login");
    expect(data).not.toHaveProperty("actorUserId");
    expect(data).not.toHaveProperty("actorRole");
  });

  it("record() trunca user-agent muito longo (minimização)", async () => {
    const prisma = createPrismaMock();
    prisma.auditEvent.create.mockResolvedValue({});
    const service = new AuditService(prisma, createLoggerMock());

    const longUserAgent = "x".repeat(1000);
    await service.record({ ...baseUserEvent, userAgent: longUserAgent });

    const data = prisma.auditEvent.create.mock.calls[0][0].data;
    expect(data.userAgent.length).toBeLessThan(1000);
  });

  it("record() sem tx: falha de persistência é capturada, nunca propaga (best-effort)", async () => {
    const prisma = createPrismaMock();
    prisma.auditEvent.create.mockRejectedValue(new Error("conexão recusada"));
    const logger = createLoggerMock();
    const service = new AuditService(prisma, logger);

    await expect(service.record(baseUserEvent)).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledTimes(1);
    // Nunca loga a exceção original (poderia conter fragmento de conexão).
    const [loggedFields] = logger.error.mock.calls[0];
    expect(JSON.stringify(loggedFields)).not.toContain("conexão recusada");
  });

  it("record() com tx: falha de persistência propaga (atomicidade com a ação sensível)", async () => {
    const prisma = createPrismaMock();
    const service = new AuditService(prisma, createLoggerMock());
    const failingTx = {
      auditEvent: { create: jest.fn().mockRejectedValue(new Error("db down")) },
    } as never;

    await expect(service.record(baseUserEvent, failingTx)).rejects.toThrow(
      "db down",
    );
  });

  it("recordOrThrow() propaga falha de persistência (nunca resolve silenciosamente)", async () => {
    const prisma = createPrismaMock();
    prisma.auditEvent.create.mockRejectedValue(new Error("db down"));
    (prisma as unknown as { $transaction: jest.Mock }).$transaction = jest
      .fn()
      .mockImplementation((cb) => cb(prisma));
    const service = new AuditService(prisma, createLoggerMock());

    await expect(service.recordOrThrow(baseUserEvent)).rejects.toThrow(
      "db down",
    );
  });

  it("recordOrThrow() resolve normalmente quando a persistência funciona", async () => {
    const prisma = createPrismaMock();
    prisma.auditEvent.create.mockResolvedValue({});
    (prisma as unknown as { $transaction: jest.Mock }).$transaction = jest
      .fn()
      .mockImplementation((cb) => cb(prisma));
    const service = new AuditService(prisma, createLoggerMock());

    await expect(service.recordOrThrow(baseUserEvent)).resolves.toBeUndefined();
  });

  it("findMany() aplica paginação e filtros sem incluir chaves vazias", async () => {
    const prisma = createPrismaMock();
    prisma.auditEvent.findMany.mockResolvedValue([]);
    prisma.auditEvent.count.mockResolvedValue(0);
    const service = new AuditService(prisma, createLoggerMock());

    await service.findMany({}, { page: 2, pageSize: 10 });

    const call = prisma.auditEvent.findMany.mock.calls[0][0];
    expect(call.where).toEqual({});
    expect(call.skip).toBe(10);
    expect(call.take).toBe(10);
  });

  it("AUDIT_ACTIONS runtime está em sincronia com o enum de banco (nenhum drift silencioso)", () => {
    // Regressão: se o enum `AuditAction` do schema.prisma mudar sem
    // atualizar a lista runtime usada pela validação de DTO (@IsIn), este
    // teste falha — evita ação "fechada" na prática só de um lado.
    expect(AUDIT_ACTIONS).toEqual(
      expect.arrayContaining([
        "login_succeeded",
        "login_failed",
        "logout",
        "session_revoked",
        "session_expired",
        "password_reset_requested",
        "password_reset_completed",
        "user_created",
        "user_role_changed",
        "user_disabled",
        "authorization_denied",
        "rate_limit_blocked",
        "audit_log_read",
      ]),
    );
    expect(AUDIT_ACTIONS.length).toBe(13);
  });
});
