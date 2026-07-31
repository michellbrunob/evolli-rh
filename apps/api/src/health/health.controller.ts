import {
  Controller,
  Get,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { HealthService } from "./health.service";
import { HealthResponseDto } from "./dto/health-response.dto";
import { HealthReadyResponseDto } from "./dto/health-ready-response.dto";

@ApiTags("health")
@Controller("health")
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({
    summary: "Verifica disponibilidade da aplicação (não consulta o banco)",
  })
  @ApiOkResponse({ type: HealthResponseDto })
  check(): HealthResponseDto {
    return this.healthService.check();
  }

  @Get("ready")
  @ApiOperation({
    summary: "Verifica prontidão do banco de dados",
    description:
      "Retorna 503 quando o banco está indisponível, sem detalhes internos.",
  })
  @ApiOkResponse({ type: HealthReadyResponseDto })
  async ready(): Promise<HealthReadyResponseDto> {
    try {
      return await this.healthService.checkReadiness();
    } catch {
      // Mensagem fixa via AllExceptionsFilter — nunca repassar a exceção
      // original (pode conter host/porta/erro do driver).
      this.logger.warn("Readiness check falhou: banco indisponível.");
      throw new ServiceUnavailableException();
    }
  }
}
