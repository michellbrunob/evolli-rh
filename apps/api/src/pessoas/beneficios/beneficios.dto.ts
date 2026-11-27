import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

/**
 * T215 — Benefícios: as entradas. A forma das regras (valores, faixas,
 * planos, quem paga) é conferida pelo serviço (`regras-beneficio.ts`), que
 * responde por campo.
 */
const COMPETENCIA = /^\d{4}-(0[1-9]|1[0-2])$/;
const DIA = /^\d{4}-\d{2}-\d{2}$/;
const VALOR = { maxDecimalPlaces: 2 } as const;

const nulo = ({ value }: { value: unknown }) => (value === "" ? null : value);

export class PessoaDoBeneficioDto {
  @IsUUID()
  colaboradorId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  planoId?: string | null;

  @IsOptional()
  @IsNumber(VALOR)
  @Min(0)
  @Max(10_000_000)
  valorIndividual?: number | null;
}

export class BeneficioDto {
  @IsString()
  @MaxLength(200)
  nome!: string;

  @IsString()
  @MaxLength(40)
  categoria!: string;

  @IsString()
  @MaxLength(40)
  folha!: string;

  @IsString()
  @MaxLength(40)
  tipoValor!: string;

  @Matches(DIA)
  inicio!: string;

  @IsOptional()
  @Transform(nulo)
  @Matches(DIA)
  fim?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(600)
  observacao?: string | null;

  @IsObject()
  regras!: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5000)
  @ValidateNested({ each: true })
  @Type(() => PessoaDoBeneficioDto)
  pessoas?: PessoaDoBeneficioDto[];

  /** Editar configuração: a partir de qual competência a mudança vale. */
  @IsOptional()
  @Matches(COMPETENCIA)
  aPartirDe?: string;
}

/** A prévia aceita o formulário incompleto (cada etapa pede a sua). */
export class PreviaBeneficioDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  nome!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  categoria!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  folha!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  tipoValor!: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  inicio!: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  fim?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(600)
  observacao?: string | null;

  @IsOptional()
  @IsObject()
  regras!: Record<string, unknown>;

  @IsOptional()
  @Matches(COMPETENCIA)
  competencia?: string;

  @IsOptional()
  @IsBoolean()
  incluirDesligados?: boolean;

  /** As pessoas marcadas, com o plano ou o valor de cada uma. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5000)
  @ValidateNested({ each: true })
  @Type(() => PessoaDoBeneficioDto)
  pessoas?: PessoaDoBeneficioDto[];
}

export class CompetenciaQueryDto {
  @IsOptional()
  @Matches(COMPETENCIA)
  competencia?: string;

  @IsOptional()
  @Transform(({ value }) => value === "true" || value === true)
  @IsBoolean()
  incluirDesligados?: boolean;
}

export class AdicionarPessoasDto {
  @Matches(COMPETENCIA)
  aPartirDe!: string;

  @IsArray()
  @ArrayMaxSize(5000)
  @ValidateNested({ each: true })
  @Type(() => PessoaDoBeneficioDto)
  pessoas!: PessoaDoBeneficioDto[];
}

export class LinhaDeValoresDto {
  @IsUUID()
  colaboradorId!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(31)
  dias?: number | null;

  @IsOptional()
  @IsNumber(VALOR)
  @Min(0)
  @Max(10_000_000)
  valorDia?: number | null;

  @IsOptional()
  @IsNumber(VALOR)
  @Min(0)
  @Max(10_000_000)
  valorMes?: number | null;

  @IsOptional()
  @IsNumber(VALOR)
  @Min(0)
  @Max(10_000_000)
  coparticipacao?: number | null;

  @IsOptional()
  @IsNumber(VALOR)
  @Min(0)
  @Max(10_000_000)
  antecipado?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  planoId?: string | null;

  @IsOptional()
  @IsNumber(VALOR)
  @Min(0)
  @Max(10_000_000)
  valorIndividual?: number | null;
}

export class SalvarValoresDto {
  @Matches(COMPETENCIA)
  competencia!: string;

  @IsOptional()
  @IsIn(["tela", "importacao"])
  origem?: "tela" | "importacao";

  @IsArray()
  @ArrayMaxSize(5000)
  @ValidateNested({ each: true })
  @Type(() => LinhaDeValoresDto)
  linhas!: LinhaDeValoresDto[];
}

export class AlterarEmLoteDto {
  @Matches(COMPETENCIA)
  competencia!: string;

  @IsIn(["todos", "selecionados", "grupo"])
  para!: "todos" | "selecionados" | "grupo";

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5000)
  @IsUUID("all", { each: true })
  colaboradorIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  escalas?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID("all", { each: true })
  departamentoIds?: string[];

  @IsOptional()
  @IsNumber(VALOR)
  @Min(0)
  @Max(10_000_000)
  valorDia?: number | null;

  @IsOptional()
  @IsNumber(VALOR)
  @Min(-100)
  @Max(1000)
  reajustePercentual?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(31)
  dias?: number | null;

  @IsIn(["mes", "em_diante"])
  duracao!: "mes" | "em_diante";
}

export class SuspenderDto {
  @Matches(COMPETENCIA)
  aPartirDe!: string;
}

export class DependentesNoPlanoDto {
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID("all", { each: true })
  dependenteIds!: string[];

  @Matches(COMPETENCIA)
  aPartirDe!: string;
}

/** Uma linha da planilha de valores: o texto de cada célula. */
export class LinhaDaPlanilhaDto {
  @IsInt()
  @Min(2)
  @Max(100_000)
  linha!: number;

  @IsString()
  @MaxLength(30)
  cpf!: string;

  @IsObject()
  valores!: Record<string, string | null>;
}

export class ConferirImportacaoDto {
  @Matches(COMPETENCIA)
  competencia!: string;

  @IsArray()
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => LinhaDaPlanilhaDto)
  linhas!: LinhaDaPlanilhaDto[];
}

export class DependenteDto {
  @IsString()
  @MaxLength(200)
  nome!: string;

  @IsString()
  @MaxLength(20)
  parentesco!: string;

  @IsOptional()
  @Transform(nulo)
  @IsString()
  @MaxLength(10)
  dataNascimento?: string | null;

  @IsOptional()
  @Transform(nulo)
  @IsString()
  @MaxLength(20)
  cpf?: string | null;

  @IsOptional()
  @Transform(nulo)
  @IsString()
  @MaxLength(30)
  telefone?: string | null;

  @IsOptional()
  @Transform(nulo)
  @IsString()
  @MaxLength(254)
  email?: string | null;
}
