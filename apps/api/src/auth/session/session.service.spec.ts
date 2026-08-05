import { PrismaService } from "../../database/prisma.service";
import { hashOpaqueToken } from "../crypto/opaque-token.util";
import { SessionService } from "./session.service";
import {
  SESSION_ABSOLUTE_TTL_MS,
  SESSION_INACTIVITY_TTL_MS,
} from "./session.constants";

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

describe("SessionService", () => {
  it("issue() gera token opaco e persiste só o hash", async () => {
    const prisma = createPrismaMock();
    prisma.accessSession.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: "session-1", ...data }),
    );
    const service = new SessionService(prisma);

    const issued = await service.issue("user-1", {
      ip: "1.2.3.4",
      userAgent: "jest",
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

    const service = new SessionService(prisma);
    const result = await service.validateAndTouch(token);

    expect(result).not.toBeNull();
    expect(result?.user.id).toBe("user-1");
    expect(prisma.accessSession.update).toHaveBeenCalled();
  });

  it("validateAndTouch() rejeita token inexistente", async () => {
    const prisma = createPrismaMock();
    prisma.accessSession.findUnique.mockResolvedValue(null);
    const service = new SessionService(prisma);

    expect(await service.validateAndTouch("token-qualquer")).toBeNull();
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
    const service = new SessionService(prisma);

    expect(await service.validateAndTouch("token")).toBeNull();
  });

  it("validateAndTouch() rejeita e revoga sessão expirada (TTL absoluto)", async () => {
    const prisma = createPrismaMock();
    prisma.accessSession.findUnique.mockResolvedValue({
      id: "s1",
      revokedAt: null,
      expiresAt: new Date(Date.now() - 1000),
      lastSeenAt: new Date(),
      user: { id: "u1", status: "active" },
    });
    prisma.accessSession.updateMany.mockResolvedValue({ count: 1 });
    const service = new SessionService(prisma);

    expect(await service.validateAndTouch("token")).toBeNull();
    expect(prisma.accessSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ revokedReason: "expired_absolute" }),
      }),
    );
  });

  it("validateAndTouch() rejeita e revoga sessão expirada por inatividade", async () => {
    const prisma = createPrismaMock();
    prisma.accessSession.findUnique.mockResolvedValue({
      id: "s1",
      revokedAt: null,
      expiresAt: new Date(Date.now() + SESSION_ABSOLUTE_TTL_MS),
      lastSeenAt: new Date(Date.now() - SESSION_INACTIVITY_TTL_MS - 1000),
      user: { id: "u1", status: "active" },
    });
    prisma.accessSession.updateMany.mockResolvedValue({ count: 1 });
    const service = new SessionService(prisma);

    expect(await service.validateAndTouch("token")).toBeNull();
    expect(prisma.accessSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ revokedReason: "expired_inactivity" }),
      }),
    );
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
    const service = new SessionService(prisma);

    expect(await service.validateAndTouch("token")).toBeNull();
  });
});
