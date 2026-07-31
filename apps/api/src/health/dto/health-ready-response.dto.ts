import { ApiProperty } from "@nestjs/swagger";

export class HealthReadyResponseDto {
  @ApiProperty({ example: "ok", description: "Prontidão do banco de dados" })
  status!: "ok";

  @ApiProperty({
    example: "2026-07-31T12:00:00.000Z",
    description: "Horário do servidor em UTC (ISO 8601)",
  })
  timestamp!: string;
}
