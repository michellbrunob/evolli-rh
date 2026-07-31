import { ApiProperty } from "@nestjs/swagger";

export class HealthResponseDto {
  @ApiProperty({ example: "ok", description: "Status geral da aplicação" })
  status!: "ok";

  @ApiProperty({
    example: "0.0.0",
    description: "Versão da aplicação em execução",
  })
  version!: string;

  @ApiProperty({
    example: "2026-07-31T12:00:00.000Z",
    description: "Horário do servidor em UTC (ISO 8601)",
  })
  timestamp!: string;
}
