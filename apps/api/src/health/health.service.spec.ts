import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../database/prisma.service";
import { HealthService } from "./health.service";

function createConfigService(
  overrides: Record<string, unknown> = {},
): ConfigService {
  const values: Record<string, unknown> = {
    APP_VERSION: "1.2.3",
    DB_READY_TIMEOUT_MS: 50,
    ...overrides,
  };
  return {
    get: (key: string, fallback?: unknown) => values[key] ?? fallback,
  } as unknown as ConfigService;
}

describe("HealthService", () => {
  it("check() retorna status ok, versão da config e timestamp ISO em UTC, sem consultar o banco", () => {
    const prisma = { $queryRaw: jest.fn() } as unknown as PrismaService;
    const service = new HealthService(createConfigService(), prisma);

    const result = service.check();

    expect(result.status).toBe("ok");
    expect(result.version).toBe("1.2.3");
    expect(result.timestamp).toBe(new Date(result.timestamp).toISOString());
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it("checkReadiness() resolve quando o SELECT 1 responde a tempo", async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ "?column?": 1 }]),
    } as unknown as PrismaService;
    const service = new HealthService(createConfigService(), prisma);

    const result = await service.checkReadiness();

    expect(result.status).toBe("ok");
    expect(result.timestamp).toBe(new Date(result.timestamp).toISOString());
  });

  it("checkReadiness() rejeita sem detalhe interno quando o banco não responde a tempo", async () => {
    const prisma = {
      $queryRaw: jest.fn().mockImplementation(() => new Promise(() => {})),
    } as unknown as PrismaService;
    const service = new HealthService(
      createConfigService({ DB_READY_TIMEOUT_MS: 10 }),
      prisma,
    );

    await expect(service.checkReadiness()).rejects.toThrow();
  });

  it("checkReadiness() rejeita quando o driver falha (sanitização da resposta HTTP acontece no controller)", async () => {
    const prisma = {
      $queryRaw: jest
        .fn()
        .mockRejectedValue(
          new Error(
            "Can't reach database server at `db-interno.evolli.local:5432`",
          ),
        ),
    } as unknown as PrismaService;
    const service = new HealthService(createConfigService(), prisma);

    await expect(service.checkReadiness()).rejects.toThrow();
  });
});
