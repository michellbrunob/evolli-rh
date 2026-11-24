import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Matches,
  Max,
  Min,
  ValidateIf,
} from "class-validator";
import { CODIGOS_DE_MODELO } from "./padrao-escala";

const DIA_CIVIL = /^\d{4}-\d{2}-\d{2}$/;

/**
 * T215 — "Definir padrão de escala": o modelo, o turno (`null` = sem turno
 * fixo), o turno da noite (12x36), a folga semanal (6x1), os dias de
 * trabalho ("outra"), o início do ciclo e a data em que vale. Quais campos
 * cada modelo pede ou recusa é regra do serviço (`conferirPadrao`).
 */
export class DefinirEscalaDto {
  @IsIn(CODIGOS_DE_MODELO)
  modelo!: string;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsUUID()
  tabelaHorarioId?: string | null;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsUUID()
  turnoNoiteId?: string | null;

  /** 1 = segunda … 7 = domingo. */
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsInt()
  @Min(1)
  @Max(7)
  folgaSemanal?: number | null;

  /** 1 = segunda … 7 = domingo. */
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsArray()
  @ArrayMaxSize(7)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(7, { each: true })
  diasTrabalho?: number[] | null;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @Matches(DIA_CIVIL)
  @IsDateString({ strict: true })
  inicioCiclo?: string | null;

  @Matches(DIA_CIVIL)
  @IsDateString({ strict: true })
  vigenciaInicio!: string;
}

/** O PRIMEIRO dia sem a escala (o fim não conta). */
export class EncerrarEscalaDto {
  @Matches(DIA_CIVIL)
  @IsDateString({ strict: true })
  vigenciaFim!: string;
}
