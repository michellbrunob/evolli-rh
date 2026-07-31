import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

/**
 * Conectado ao ciclo de vida do Nest (OnModuleInit/OnModuleDestroy), mas a
 * falha ao conectar na inicialização NÃO derruba o bootstrap da aplicação:
 * liveness (`GET /v1/health`) não depende do banco, só readiness
 * (`GET /v1/health/ready`) depende — ver ADR 0002. Uma tentativa de conexão
 * malsucedida aqui não impede novas tentativas sob demanda (o client Prisma
 * reconecta automaticamente na próxima query).
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
    } catch {
      // Mensagem fixa — nunca logar a exceção original: pode conter host,
      // porta ou trecho da connection string do driver. O client Prisma
      // tenta se reconectar sozinho na próxima query (ex.: readiness).
      this.logger.warn(
        "Falha ao conectar ao banco na inicialização; novas tentativas ocorrerão sob demanda.",
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
