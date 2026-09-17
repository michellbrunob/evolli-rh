import { Injectable } from "@nestjs/common";
import { AccessSession, AccessUser, Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import {
  generateOpaqueToken,
  hashOpaqueToken,
} from "../crypto/opaque-token.util";
import {
  SESSION_ABSOLUTE_TTL_MS,
  SESSION_INACTIVITY_TTL_MS,
} from "./session.constants";
import { AuditService } from "../../audit/audit.service";

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
  /** Correlação com o log técnico e a trilha de auditoria (ADR 0001/0004). */
  requestId: string;
}

/**
 * `AccessSession.id` (chave interna) nunca é usado para autenticar — só o
 * token opaco do cookie, rehashado e comparado contra `token_hash`
 * (ADR 0003 §5). Todo método aqui recebe/retorna o token bruto só na
 * emissão; nunca o persiste.
 *
 * Métodos que mutam estado (`issue`, `revokeById`, `revokeAllForUser`)
 * aceitam um `Prisma.TransactionClient` opcional (`tx`) — quando fornecido,
 * a operação participa da transação do chamador em vez de abrir a sua
 * própria (ADR 0004 §2): usado por fluxos onde sessão e evento de
 * auditoria correspondente precisam persistir atomicamente (login,
 * logout, revogação explícita, redefinição de senha, desativação de
 * conta). Sem `tx`, o comportamento é idêntico ao anterior — cada chamada
 * usa sua própria conexão via `this.prisma`.
 */
@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async issue(
    userId: string,
    metadata: SessionRequestMetadata,
    tx?: Prisma.TransactionClient,
  ): Promise<IssuedSession> {
    const client = tx ?? this.prisma;
    const token = generateOpaqueToken();
    const csrfToken = generateOpaqueToken();
    const now = Date.now();

    const session = await client.accessSession.create({
      data: {
        userId,
        tokenHash: hashOpaqueToken(token),
        csrfTokenHash: hashOpaqueToken(csrfToken),
        expiresAt: new Date(now + SESSION_ABSOLUTE_TTL_MS),
        ip: metadata.ip ?? null,
        userAgent: metadata.userAgent ?? null,
        // T125 — step-up: emitir sessão É a autenticação mais recente (login
        // por senha para conta sem MFA, ou verificação do 2º fator). Ações
        // sensíveis futuras comparam este carimbo contra `MFA_STEP_UP_TTL_MS`.
        reauthenticatedAt: new Date(now),
      },
    });

    return { session, token, csrfToken };
  }

  async validateAndTouch(
    token: string,
    requestId: string,
  ): Promise<ValidatedSession | null> {
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
      await this.auditExpiry(session, requestId);
      return null;
    }

    const inactiveSince = now.getTime() - session.lastSeenAt.getTime();
    if (inactiveSince > SESSION_INACTIVITY_TTL_MS) {
      await this.revokeById(session.id, "expired_inactivity");
      await this.auditExpiry(session, requestId);
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

  /**
   * Rotação de sessão (ADR 0003 §5): emite sessão nova, revoga a velha.
   * Reutilizável para qualquer elevação de credencial futura (ex.: quando
   * MFA — adiado para a próxima fatia de segurança — for implementado).
   */
  async rotate(
    previousSessionId: string,
    userId: string,
    metadata: SessionRequestMetadata,
    tx?: Prisma.TransactionClient,
  ): Promise<IssuedSession> {
    const issued = await this.issue(userId, metadata, tx);
    await this.revokeById(previousSessionId, "rotated", tx);
    return issued;
  }

  /**
   * Rotação do token CSRF da sessão (ADR 0009 §4): gera um token novo,
   * persiste só o hash — substituindo o anterior — e com isso invalida
   * imediatamente o token CSRF anterior daquela sessão. Nunca lê nem
   * persiste o valor bruto, que só existe em memória e na resposta.
   * Devolve `null` se a sessão já não estiver ativa, para o chamador
   * responder 401 genérico em vez de emitir um token órfão.
   *
   * `SessionGuard` já validou a sessão antes do controller chegar aqui, mas
   * existe uma janela entre essa validação e este `UPDATE` em que a sessão
   * pode expirar (TTL absoluto). O filtro repete `revokedAt: null` e soma
   * `expiresAt` no próprio `UPDATE` — condição atômica, não uma checagem
   * separada — para que a rotação nunca sobreviva a uma sessão expirada
   * nessa janela.
   */
  async rotateCsrfToken(sessionId: string): Promise<string | null> {
    const csrfToken = generateOpaqueToken();
    const { count } = await this.prisma.accessSession.updateMany({
      where: {
        id: sessionId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { csrfTokenHash: hashOpaqueToken(csrfToken) },
    });

    return count === 1 ? csrfToken : null;
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

  /** Best-effort (ADR 0004 §2) — falha ao auditar não afeta a expiração já aplicada. */
  private async auditExpiry(
    session: AccessSession & { user: AccessUser },
    requestId: string,
  ): Promise<void> {
    await this.auditService.record({
      actorType: "user",
      actorUserId: session.user.id,
      actorRole: session.user.role,
      companyId: session.user.companyId,
      action: "session_expired",
      resource: "access_session",
      resourceId: session.id,
      ip: session.ip,
      userAgent: session.userAgent,
      result: "success",
      requestId,
    });
  }

  async revokeById(
    sessionId: string,
    reason: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx ?? this.prisma;
    await client.accessSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
  }

  async revokeAllForUser(
    userId: string,
    reason: string,
    exceptSessionId?: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx ?? this.prisma;
    await client.accessSession.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
      },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
  }
}
