import { IsDateString, Matches } from "class-validator";

const DIA_CIVIL = /^\d{4}-\d{2}-\d{2}$/;

/**
 * T215 — o período do quadro "Escala de trabalho": do primeiro ao último dia
 * mostrados (os dois contam). Uma semana ou um mês; o serviço recusa período
 * invertido ou maior que 42 dias.
 */
export class ConsultarQuadroDto {
  @Matches(DIA_CIVIL)
  @IsDateString({ strict: true })
  inicio!: string;

  @Matches(DIA_CIVIL)
  @IsDateString({ strict: true })
  fim!: string;
}
