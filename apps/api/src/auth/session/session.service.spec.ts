import { PrismaService } from "../../database/prisma.service";
import { hashOpaqueToken } from "../crypto/opaque-token.util";
import { SessionService } from "./session.service";
import {
  SESSION_ABSOLUTE_TTL_MS,
  SESSION_INACTIVITY_TTL_MS,
} from "./session.constants";
import { AuditService } from "../../audit/audit.service";

function createPrismaMock() {
  return {
    accessSession: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(),
    },
  } as unknown as PrismaService & {
    accessSession: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
      findMany: jest.Mock;
    };
  };
}

function createAuditServiceMock() {
  return { record: jest.fn() } as unknown as AuditService & {
    record: jest.Mock;
  };
}

describe("SessionService", () => {
  it("issue() gera token opaco e persiste só o hash", async () => {
    const prisma = createPrismaMock();
    prisma.accessSession.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: "session-1", ...data }),
    );
    const service = new SessionService(prisma, createAuditServiceMock());

    const issued = await service.issue("user-1", {
      ip: "1.2.3.4",
      userAgent: "jest",
      requestId: "req-1",
    });

    expect(issued.token).toBeDefined();
    expect(issued.csrfToken).toBeDefined();
    const createCall = prisma.accessSession.create.mock.calls[0][0];
    expect(createCall.data.tokenHash).toBe(hashOpaqueToken(issued.token));
    expect(createCall.data.csrfTokenHash).toBe(
      hashOpaqueToken(issued.csrfToken),
    );
    // nunca persiste o token bruto
    expect(JSON.stringify(createCall.data)).not.toContain(issued.token);
  });

  it("validateAndTouch() aceita token válido e atualiza last_seen_at", async () => {
    const prisma = createPrismaMock();
    const token = "token-de-teste";
    const now = new Date();
    const session = {
      id: "session-1",
      tokenHash: hashOpaqueToken(token),
      revokedAt: null,
      expiresAt: new Date(now.getTime() + 1000 * 60),
      lastSeenAt: now,
      user: { id: "user-1", status: "active" },
    };
    prisma.accessSession.findUnique.mockResolvedValue(session);
    prisma.accessSession.update.mockImplementation(({ data }) =>
      Promise.resolve({ ...session, ...data }),
    );

    const service = new SessionService(prisma, createAuditServiceMock());
    const result = await service.validateAndTouch(token, "req-1");

    expect(result).not.toBeNull();
    expect(result?.user.id).toBe("user-1");
    expect(prisma.accessSession.update).toHaveBeenCalled();
  });

  it("validateAndTouch() rejeita token inexistente", async () => {
    const prisma = createPrismaMock();
    prisma.accessSession.findUnique.mockResolvedValue(null);
    const service = new SessionService(prisma, createAuditServiceMock());

    expect(
      await service.validateAndTouch("token-qualquer", "req-1"),
    ).toBeNull();
  });

  it("validateAndTouch() rejeita sessão revogada", async () => {
    const prisma = createPrismaMock();
    prisma.accessSession.findUnique.mockResolvedValue({
      id: "s1",
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
      lastSeenAt: new Date(),
      user: { id: "u1", status: "active" },
    });
    const service = new SessionService(prisma, createAuditServiceMock());

    expect(await service.validateAndTouch("token", "req-1")).toBeNull();
  });

  it("validateAndTouch() rejeita e revoga sessão expirada (TTL absoluto)", async () => {
    const prisma = createPrismaMock();
    prisma.accessSession.findUnique.mockResolvedValue({
      id: "s1",
      revokedAt: null,
      expiresAt: new Date(Date.now() - 1000),
      lastSeenAt: new Date(),
      ip: null,
      userAgent: null,
      user: {
        id: "u1",
        status: "active",
        role: "colaborador",
        companyId: null,
      },
    });
    prisma.accessSession.updateMany.mockResolvedValue({ count: 1 });
    const auditService = createAuditServiceMock();
    const service = new SessionService(prisma, auditService);

    expect(await service.validateAndTouch("token", "req-1")).toBeNull();
    expect(prisma.accessSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ revokedReason: "expired_absolute" }),
      }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "session_expired" }),
    );
  });

  it("validateAndTouch() rejeita e revoga sessão expirada por inatividade", async () => {
    const prisma = createPrismaMock();
    prisma.accessSession.findUnique.mockResolvedValue({
      id: "s1",
      revokedAt: null,
      expiresAt: new Date(Date.now() + SESSION_ABSOLUTE_TTL_MS),
      lastSeenAt: new Date(Date.now() - SESSION_INACTIVITY_TTL_MS - 1000),
      ip: null,
      userAgent: null,
      user: {
        id: "u1",
        status: "active",
        role: "colaborador",
        companyId: null,
      },
    });
    prisma.accessSession.updateMany.mockResolvedValue({ count: 1 });
    const service = new SessionService(prisma, createAuditServiceMock());

    expect(await service.validateAndTouch("token", "req-1")).toBeNull();
    expect(prisma.accessSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ revokedReason: "expired_inactivity" }),
      }),
    );
  });

  it("issue() com tx: usa o client da transação, não o padrão (ADR 0004 §2)", async () => {
    const prisma = createPrismaMock();
    const txAccessSession = {
      create: jest
        .fn()
        .mockImplementation(({ data }) =>
          Promise.resolve({ id: "session-tx", ...data }),
        ),
    };
    const tx = { accessSession: txAccessSession } as never;
    const service = new SessionService(prisma, createAuditServiceMock());

    await service.issue(
      "user-1",
      { ip: null, userAgent: null, requestId: "req-1" },
      tx,
    );

    expect(txAccessSession.create).toHaveBeenCalledTimes(1);
    expect(prisma.accessSession.create).not.toHaveBeenCalled();
  });

  it("revokeById() com tx: usa o client da transação, não o padrão", async () => {
    const prisma = createPrismaMock();
    const txAccessSession = {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    };
    const tx = { accessSession: txAccessSession } as never;
    const service = new SessionService(prisma, createAuditServiceMock());

    await service.revokeById("session-1", "logout", tx);

    expect(txAccessSession.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.accessSession.updateMany).not.toHaveBeenCalled();
  });

  it("revokeAllForUser() com tx: usa o client da transação, não o padrão", async () => {
    const prisma = createPrismaMock();
    const txAccessSession = {
      updateMany: jest.fn().mockResolvedValue({ count: 2 }),
    };
    const tx = { accessSession: txAccessSession } as never;
    const service = new SessionService(prisma, createAuditServiceMock());

    await service.revokeAllForUser("user-1", "account_disabled", undefined, tx);

    expect(txAccessSession.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.accessSession.updateMany).not.toHaveBeenCalled();
  });

  it("rotateCsrfToken() persiste só o hash do token novo, nunca o valor bruto", async () => {
    const prisma = createPrismaMock();
    prisma.accessSession.updateMany.mockResolvedValue({ count: 1 });
    const service = new SessionService(prisma, createAuditServiceMock());

    const csrfToken = await service.rotateCsrfToken("session-1");

    expect(csrfToken).toEqual(expect.any(String));
    const call = prisma.accessSession.updateMany.mock.calls[0][0];
    expect(call.data.csrfTokenHash).toBe(hashOpaqueToken(csrfToken as string));
    // só a sessão não revogada e ainda não expirada é rotacionada, e o
    // token bruto nunca vai ao banco
    expect(call.where.id).toBe("session-1");
    expect(call.where.revokedAt).toBeNull();
    expect(call.where.expiresAt.gt).toBeInstanceOf(Date);
    expect(JSON.stringify(call)).not.toContain(csrfToken);
  });

  it("rotateCsrfToken() condiciona o UPDATE a revokedAt nulo E expiresAt no futuro", async () => {
    const prisma = createPrismaMock();
    prisma.accessSession.updateMany.mockResolvedValue({ count: 1 });
    const service = new SessionService(prisma, createAuditServiceMock());

    const before = Date.now();
    await service.rotateCsrfToken("session-1");
    const after = Date.now();

    const call = prisma.accessSession.updateMany.mock.calls[0][0];
    // condição atômica no próprio UPDATE, não checagem separada antes dele
    expect(call.where).toMatchObject({
      id: "session-1",
      revokedAt: null,
    });
    const gt = call.where.expiresAt.gt as Date;
    expect(gt.getTime()).toBeGreaterThanOrEqual(before);
    expect(gt.getTime()).toBeLessThanOrEqual(after);
  });

  it("rotateCsrfToken() devolve null para sessão não revogada porém expirada (nenhuma linha afetada)", async () => {
    const prisma = createPrismaMock();
    // o UPDATE não afeta nenhuma linha porque expiresAt <= now, mesmo com
    // revokedAt ainda nulo — simula a janela de corrida entre a validação
    // do SessionGuard e este UPDATE
    prisma.accessSession.updateMany.mockResolvedValue({ count: 0 });
    const service = new SessionService(prisma, createAuditServiceMock());

    expect(await service.rotateCsrfToken("session-expirada")).toBeNull();
    expect(prisma.accessSession.updateMany).toHaveBeenCalledTimes(1);
  });

  it("rotateCsrfToken() emite token diferente a cada chamada (invalida o anterior)", async () => {
    const prisma = createPrismaMock();
    prisma.accessSession.updateMany.mockResolvedValue({ count: 1 });
    const service = new SessionService(prisma, createAuditServiceMock());

    const first = await service.rotateCsrfToken("session-1");
    const second = await service.rotateCsrfToken("session-1");

    expect(first).not.toBe(second);
    // o hash gravado na segunda chamada substitui o da primeira
    const firstHash =
      prisma.accessSession.updateMany.mock.calls[0][0].data.csrfTokenHash;
    const secondHash =
      prisma.accessSession.updateMany.mock.calls[1][0].data.csrfTokenHash;
    expect(secondHash).not.toBe(firstHash);
    expect(secondHash).toBe(hashOpaqueToken(second as string));
  });

  it("rotateCsrfToken() devolve null se a sessão já não estiver ativa", async () => {
    const prisma = createPrismaMock();
    prisma.accessSession.updateMany.mockResolvedValue({ count: 0 });
    const service = new SessionService(prisma, createAuditServiceMock());

    expect(await service.rotateCsrfToken("session-revogada")).toBeNull();
  });

  it("validateAndTouch() rejeita se o usuário não estiver ativo", async () => {
    const prisma = createPrismaMock();
    prisma.accessSession.findUnique.mockResolvedValue({
      id: "s1",
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      lastSeenAt: new Date(),
      user: { id: "u1", status: "disabled" },
    });
    const service = new SessionService(prisma, createAuditServiceMock());

    expect(await service.validateAndTouch("token", "req-1")).toBeNull();
  });
});
