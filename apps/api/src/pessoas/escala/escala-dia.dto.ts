import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import { HORA_PATTERN } from "../../horarios/validacao-horarios.util";
import { TIPOS_DE_DIA } from "./dia-da-escala";

const DIA_CIVIL = /^\d{4}-\d{2}-\d{2}$/;

export class PeriodoDoDiaDto {
  @Matches(HORA_PATTERN)
  inicio!: string;

  @Matches(HORA_PATTERN)
  fim!: string;
}

/** A pessoa e o dia do quadro. */
export class DiaDoQuadroDto {
  @IsUUID()
  colaboradorId!: string;

  @Matches(DIA_CIVIL)
  @IsDateString({ strict: true })
  dia!: string;
}

/**
 * T215 — gravar o dia no rascunho (menu da célula e painel do dia). Quais
 * campos cada tipo pede ou recusa é `conferirDia`.
 */
export class GravarDiaDto extends DiaDoQuadroDto {
  @IsIn(TIPOS_DE_DIA)
  tipo!: string;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsUUID()
  tabelaHorarioId?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => PeriodoDoDiaDto)
  periodos?: PeriodoDoDiaDto[];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(120)
  intervaloMinutos?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2)
  @ValidateNested({ each: true })
  @Type(() => PeriodoDoDiaDto)
  sobreaviso?: PeriodoDoDiaDto[];

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsUUID()
  unidadeOrganizacionalId?: string | null;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @MaxLength(300)
  observacao?: string | null;
}

/**
 * T215 — vários dias de uma vez (ações em massa); até 500 por envio (o corpo
 * JSON do servidor tem limite de 100 kB; o cliente manda blocos de 100).
 */
export class GravarLoteDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => GravarDiaDto)
  dias!: GravarDiaDto[];
}

/** T215 — desfazer a mudança de vários dias; até 500 por envio. */
export class LimparLoteDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => DiaDoQuadroDto)
  dias!: DiaDoQuadroDto[];
}
