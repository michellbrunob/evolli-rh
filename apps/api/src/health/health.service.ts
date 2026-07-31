import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { HealthResponseDto } from "./dto/health-response.dto";

@Injectable()
export class HealthService {
  constructor(private readonly configService: ConfigService) {}

  check(): HealthResponseDto {
    return {
      status: "ok",
      version: this.configService.get<string>("APP_VERSION", "0.0.0"),
      timestamp: new Date().toISOString(),
    };
  }
}
