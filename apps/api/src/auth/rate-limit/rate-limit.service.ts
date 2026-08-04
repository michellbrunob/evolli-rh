import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { normalizeEmail } from "../normalize-email.util";

// Parâmetro inicial fechado (spec): no máximo 5 tentativas inválidas por
// combinação de e-mail normalizado + IP em 15 minutos. Sem bloqueio
// permanente de conta — a janela sempre expira.
export const RATE_LIMIT_MAX_ATTEMPTS = 5;
export const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

@Injectable()
export class RateLimitService {
  constructor(private readonly prisma: PrismaService) {}

  async assertNotRateLimited(key: string, ip: string | null): Promise<void> {
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
      // Mensagem pública fixa via AllExceptionsFilter — nunca revela
      // contagem/janela restante.
      throw new HttpException(
        "Muitas requisições.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
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
