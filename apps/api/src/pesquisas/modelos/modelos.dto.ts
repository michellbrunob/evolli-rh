import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { CAMPOS_GRUPO, type CampoGrupo } from "../pesquisas.types";
import { RespostaDto } from "../pesquisas.dto";

/**
 * T216 — entradas da Avaliação 90°/180° e do Onboarding automático. A
 * configuração é conferida no serviço (por campo); aqui só a forma.
 */

const nulo = ({ value }: { value: unknown }) => (value === "" ? null : value);

export class TimeDto {
  @IsUUID()
  gestorId!: string;

  @IsArray()
  @ArrayMaxSize(1000)
  @IsUUID("all", { each: true })
  avaliadoIds!: string[];
}

export class AvaliacaoDto {
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @IsArray()
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => TimeDto)
  times!: TimeDto[];
}

export class OnboardingDto {
  @IsObject()
  config!: Record<string, unknown>;
}

export class PublicoDoOnboardingDto {
  @IsOptional()
  @IsObject()
  publico?: Record<string, unknown>;

  @IsOptional()
  soDiasUteis?: boolean;
}

export class ResultadosDoOnboardingQueryDto {
  @IsOptional()
  @IsIn(CAMPOS_GRUPO)
  campo?: CampoGrupo;

  @IsOptional()
  @Transform(nulo)
  @IsUUID()
  grupoId?: string | null;
}

export class PasseDto {
  @IsString()
  @MaxLength(100)
  passe!: string;
}

export class RespostaDaAvaliacaoDto {
  @IsString()
  @MaxLength(100)
  passe!: string;

  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => RespostaDto)
  respostas!: RespostaDto[];

  /** Comentário por competência (conferido no serviço). */
  @IsOptional()
  @IsObject()
  comentarios?: Record<string, unknown>;
}

export class RespostaDoOnboardingDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  passe?: string;

  /** A rodada do link (30, 60 ou 90; 0 = envio único). */
  @IsOptional()
  @IsInt()
  rodada?: number | null;

  @IsOptional()
  @IsObject()
  grupos?: Record<string, unknown>;

  @IsArray()
  @ArrayMaxSize(60)
  @ValidateNested({ each: true })
  @Type(() => RespostaDto)
  respostas!: RespostaDto[];
}
