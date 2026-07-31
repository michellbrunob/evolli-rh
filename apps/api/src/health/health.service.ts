import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../database/prisma.service";
import { HealthResponseDto } from "./dto/health-response.dto";
import { HealthReadyResponseDto } from "./dto/health-ready-response.dto";

@Injectable()
export class HealthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  check(): HealthResponseDto {
    return {
      status: "ok",
      version: this.configService.get<string>("APP_VERSION", "0.0.0"),
      timestamp: new Date().toISOString(),
    };
  }

  async checkReadiness(): Promise<HealthReadyResponseDto> {
    await this.pingDatabase();
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * SELECT 1 com timeout curto. Nunca propaga a exceção original do driver
   * (pode conter host/porta/mensagem do PostgreSQL) — quem chama só recebe
   * sucesso ou falha genérica.
   */
  private async pingDatabase(): Promise<void> {
    const timeoutMs = this.configService.get<number>(
      "DB_READY_TIMEOUT_MS",
      2000,
    );

    let timeoutHandle: NodeJS.Timeout;
    const timeout = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(
        () => reject(new Error("database readiness timeout")),
        timeoutMs,
      );
    });

    // A query pode perder a corrida contra o timeout e só rejeitar bem
    // depois (o driver ainda tentando conectar em segundo plano). Sem este
    // catch, essa rejeição tardia vira um unhandled rejection do processo.
    const queryPromise = this.prisma.$queryRaw`SELECT 1`;
    queryPromise.catch(() => undefined);

    try {
      await Promise.race([queryPromise, timeout]);
    } finally {
      clearTimeout(timeoutHandle!);
    }
  }
}
