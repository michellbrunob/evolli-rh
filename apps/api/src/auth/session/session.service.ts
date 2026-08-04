import { Injectable } from "@nestjs/common";
import { AccessSession, AccessUser } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import {
  generateOpaqueToken,
  hashOpaqueToken,
} from "../crypto/opaque-token.util";
import {
  SESSION_ABSOLUTE_TTL_MS,
  SESSION_INACTIVITY_TTL_MS,
} from "./session.constants";

export interface IssuedSession {
  session: AccessSession;
  token: string;
  csrfToken: string;
}

export interface ValidatedSession {
  session: AccessSession;
  user: AccessUser;
}

export interface SessionRequestMetadata {
  ip: string | null;
  userAgent: string | null;
}

/**
 * `AccessSession.id` (chave interna) nunca é usado para autenticar — só o
 * token opaco do cookie, rehashado e comparado contra `token_hash`
 * (ADR 0003 §5). Todo método aqui recebe/retorna o token bruto só na
 * emissão; nunca o persiste.
 */
@Injectable()
export class SessionService {
  constructor(private readonly prisma: PrismaService) {}

  async issue(
    userId: string,
    metadata: SessionRequestMetadata,
  ): Promise<IssuedSession> {
    const token = generateOpaqueToken();
    const csrfToken = generateOpaqueToken();
    const now = Date.now();

    const session = await this.prisma.accessSession.create({
      data: {
        userId,
        tokenHash: hashOpaqueToken(token),
        csrfTokenHash: hashOpaqueToken(csrfToken),
        expiresAt: new Date(now + SESSION_ABSOLUTE_TTL_MS),
        ip: metadata.ip ?? null,
        userAgent: metadata.userAgent ?? null,
      },
    });

    return { session, token, csrfToken };
  }

  /**
   * Valida o token do cookie e "toca" a sessão (atualiza last_seen_at) se
   * ainda estiver dentro da janela de inatividade. Sessão expirada por
   * inatividade ou por TTL absoluto é tratada como inválida (e marcada
   * revogada, para auditoria).
   */
  async validateAndTouch(token: string): Promise<ValidatedSession | null> {
    const tokenHash = hashOpaqueToken(token);
    const session = await this.prisma.accessSession.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!session || session.revokedAt) {
      return null;
    }

    const now = new Date();

    if (session.expiresAt <= now) {
      await this.revokeById(session.id, "expired_absolute");
      return null;
    }

    const inactiveSince = now.getTime() - session.lastSeenAt.getTime();
    if (inactiveSince > SESSION_INACTIVITY_TTL_MS) {
      await this.revokeById(session.id, "expired_inactivity");
      return null;
    }

    const { user } = session;
    if (user.status !== "active") {
      return null;
    }

    const touched = await this.prisma.accessSession.update({
      where: { id: session.id },
      data: { lastSeenAt: now },
    });

    return { session: touched, user };
  }

  /** Rotação pós-login/MFA (ADR 0003 §5): emite sessão nova, revoga a velha. */
  async rotate(
    previousSessionId: string,
    userId: string,
    metadata: SessionRequestMetadata,
  ): Promise<IssuedSession> {
    const issued = await this.issue(userId, metadata);
    await this.revokeById(previousSessionId, "rotated");
    return issued;
  }

  async findByIdWithUser(
    sessionId: string,
  ): Promise<(AccessSession & { user: AccessUser }) | null> {
    return this.prisma.accessSession.findUnique({
      where: { id: sessionId },
      include: { user: true },
    });
  }

  async listActiveForUser(userId: string): Promise<AccessSession[]> {
    return this.prisma.accessSession.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });
  }

  async revokeById(sessionId: string, reason: string): Promise<void> {
    await this.prisma.accessSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
  }

  async revokeAllForUser(
    userId: string,
    reason: string,
    exceptSessionId?: string,
  ): Promise<void> {
    await this.prisma.accessSession.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
      },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
  }
}
