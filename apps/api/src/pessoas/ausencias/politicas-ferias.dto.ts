import { TipoVinculo } from "@prisma/client";
import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
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
  MinLength,
  ValidateNested,
} from "class-validator";

/** T215 — Políticas de férias: as entradas (as mesmas listas da tela). */
const DIA_CIVIL = /^\d{4}-\d{2}-\d{2}$/;
const SEM_CONTROLE_COM_LINHA = /^[^\u0000-\u0009\u000B-\u001F\u007F]*$/;
const TIPOS: readonly TipoVinculo[] = [
  "clt",
  "estagio",
  "aprendiz",
  "pj",
  "temporario",
  "outro_controlado",
  "part_time",
  "freelancer",
  "trainee",
];

function texto(valor: unknown): unknown {
  if (typeof valor !== "string") return valor;
  const limpo = valor.trim();
  return limpo === "" ? undefined : limpo;
}

export class AlvoDaPoliticaDto {
  @IsIn(["departamento", "unidade", "pessoa"])
  tipo!: "departamento" | "unidade" | "pessoa";

  @IsUUID()
  id!: string;
}

export class BloqueioDaPoliticaDto {
  @Transform(({ value }) => texto(value))
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  @Matches(SEM_CONTROLE_COM_LINHA)
  nome!: string;

  @Matches(DIA_CIVIL)
  @IsDateString({ strict: true })
  inicio!: string;

  @Matches(DIA_CIVIL)
  @IsDateString({ strict: true })
  fim!: string;

  @IsBoolean()
  todoAno!: boolean;
}

export class RegrasDaPoliticaDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  antecedenciaMinimaDias!: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(24)
  antecedenciaMaximaMeses!: number | null;

  @IsIn(["nao_aceitar", "aceitar"])
  alemDoSaldo!: "nao_aceitar" | "aceitar";

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  duracaoMinimaDias!: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  duracaoMaximaDias!: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  periodosPorAno!: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  periodoMaiorDias!: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  intervaloDias!: number | null;

  @IsBoolean()
  inicioNaoAntesDeDescanso!: boolean;

  @IsBoolean()
  inicioNaoNoFimDeSemana!: boolean;

  @IsBoolean()
  voltaNaoNaSexta!: boolean;

  @IsBoolean()
  voltaNaoNaVespera!: boolean;

  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => BloqueioDaPoliticaDto)
  bloqueios!: BloqueioDaPoliticaDto[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  foraAoMesmoTempo!: number | null;
}

export class AprovacaoDaPoliticaDto {
  @IsIn(["rh", "gestor_rh", "gestor"])
  quem!: "rh" | "gestor_rh" | "gestor";

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  lembreteDias!: number | null;

  @IsIn(["avisar", "bloquear"])
  foraDaPolitica!: "avisar" | "bloquear";
}

export class PoliticaFeriasDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  @Matches(SEM_CONTROLE_COM_LINHA)
  nome!: string;

  @Transform(({ value }) => texto(value))
  @IsOptional()
  @IsString()
  @MaxLength(300)
  @Matches(SEM_CONTROLE_COM_LINHA)
  descricao?: string;

  @Transform(({ value }) => texto(value))
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  textoColaborador?: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsIn(TIPOS, { each: true })
  tiposVinculo!: TipoVinculo[];

  @IsIn(["todos", "algumas"])
  abrangencia!: "todos" | "algumas";

  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => AlvoDaPoliticaDto)
  alvos!: AlvoDaPoliticaDto[];

  @Matches(DIA_CIVIL)
  @IsDateString({ strict: true })
  valeAPartirDe!: string;

  @ValidateNested()
  @Type(() => RegrasDaPoliticaDto)
  regras!: RegrasDaPoliticaDto;

  @ValidateNested()
  @Type(() => AprovacaoDaPoliticaDto)
  aprovacao!: AprovacaoDaPoliticaDto;

  @IsOptional()
  @IsBoolean()
  rascunho?: boolean;
}
