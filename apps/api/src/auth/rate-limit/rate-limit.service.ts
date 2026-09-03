import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { normalizeEmail } from "../normalize-email.util";
import { AuditService } from "../../audit/audit.service";

// Parâmetro inicial fechado (spec): no máximo 5 tentativas inválidas por
// combinação de e-mail normalizado + IP em 15 minutos. Sem bloqueio
// permanente de conta — a janela sempre expira.
export const RATE_LIMIT_MAX_ATTEMPTS = 5;
export const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

@Injectable()
export class RateLimitService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async assertNotRateLimited(
    key: string,
    ip: string | null,
    requestId: string,
  ): Promise<void> {
    const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
    const failedCount = await this.prisma.accessLoginAttempt.count({
      where: {
        emailAttempted: normalizeEmail(key),
        ip: ip ?? null,
        succeeded: false,
        createdAt: { gte: since },
      },
    });

    if (failedCount >= RATE_LIMIT_MAX_ATTEMPTS) {
      await this.blockAndAudit(ip, requestId);
    }
  }

  /**
   * Limite específico de RECUPERAÇÃO DE SENHA: conta TODAS as solicitações da
   * janela por chave (e-mail normalizado) + IP, independentemente de terem
   * "sucesso" — diferente do `assertNotRateLimited`, que conta só falhas de
   * login. Cada disparo de `POST /auth/password/forgot` grava exatamente uma
   * tentativa; contá-las todas garante que o fluxo seja limitado mesmo quando
   * a conta não existe, o e-mail não é enviado ou o fluxo é tratado como
   * bem-sucedido (proteção anti-enumeração é preservada: a resposta pública
   * segue uniforme). Reaproveita a mesma tabela e os mesmos parâmetros de
   * janela/limite — sem novo schema.
   */
  async assertRequestRateNotExceeded(
    key: string,
    ip: string | null,
    requestId: string,
  ): Promise<void> {
    const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
    const totalCount = await this.prisma.accessLoginAttempt.count({
      where: {
        emailAttempted: normalizeEmail(key),
        ip: ip ?? null,
        createdAt: { gte: since },
      },
    });

    if (totalCount >= RATE_LIMIT_MAX_ATTEMPTS) {
      await this.blockAndAudit(ip, requestId);
    }
  }

  /**
   * Registra o evento de bloqueio (best-effort — falha ao gravar nunca reverte
   * o bloqueio já decidido, ADR 0004 §2) e lança o 429 com mensagem pública
   * fixa via AllExceptionsFilter, que nunca revela contagem/janela restante.
   */
  private async blockAndAudit(
    ip: string | null,
    requestId: string,
  ): Promise<never> {
    await this.auditService.record({
      actorType: "system",
      actorSystemId: "rate-limit-service",
      action: "rate_limit_blocked",
      resource: "access_login_attempt",
      resourceId: null,
      ip,
      userAgent: null,
      result: "denied",
      requestId,
    });

    throw new HttpException(
      "Muitas requisições.",
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  async recordAttempt(
    key: string,
    ip: string | null,
    succeeded: boolean,
  ): Promise<void> {
    await this.prisma.accessLoginAttempt.create({
      data: {
        emailAttempted: normalizeEmail(key),
        ip: ip ?? null,
        succeeded,
      },
    });
  }
}
