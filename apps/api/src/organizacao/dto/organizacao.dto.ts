import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { StatusOrganizacional } from "@prisma/client";
import {
  TAMANHO_PAGINA_MAXIMO,
  TAMANHO_PAGINA_PADRAO,
} from "../organizacao.types";

/**
 * Código estável e imutável de um nó organizacional (spec R1). Restrito a
 * maiúsculas, dígitos e `_`: sem acento, sem espaço, sem hífen interno e sem
 * caractere especial, conforme a decisão de nomenclatura (ADR 0006,
 * Emenda 1). Comprimento limitado para evitar entrada abusiva.
 */
const CODIGO_PATTERN = /^[A-Z0-9_]{2,32}$/;

const STATUS_ORGANIZACIONAL = [
  "ativo",
  "inativo",
] as const satisfies readonly StatusOrganizacional[];

export class CodigoNomeDto {
  @Matches(CODIGO_PATTERN)
  codigo!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(160)
  nome!: string;
}

/**
 * Atualização de nó organizacional: **só o nome**.
 *
 * `codigo` é imutável (R1) e a empresa é imutável (R7). As referências
 * estruturais (departamento, unidade) também não mudam aqui: reclassificar um
 * nó para outro pai é exatamente o fluxo de transferência que a Baseline V1
 * (item 7) declarou futuro, fora desta fatia.
 */
export class AtualizarNoOrganizacionalDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(160)
  nome!: string;
}

export class CriarEmpresaDto extends CodigoNomeDto {}

export class CriarUnidadeOrganizacionalDto extends CodigoNomeDto {
  @IsUUID()
  empresaId!: string;
}

export class CriarDepartamentoDto extends CodigoNomeDto {
  @IsUUID()
  empresaId!: string;
}

export class CriarAreaDto extends CodigoNomeDto {
  @IsUUID()
  departamentoId!: string;
}

export class CriarEquipeDto extends CodigoNomeDto {
  /** Obrigatório: equipe sempre pertence a um departamento (Baseline V1, 3). */
  @IsUUID()
  departamentoId!: string;

  /** Opcional: vínculo com unidade é facultativo (Baseline V1, 3). */
  @IsOptional()
  @IsUUID()
  unidadeOrganizacionalId?: string;
}

export class CriarCargoDto extends CodigoNomeDto {
  @IsUUID()
  empresaId!: string;
}

export class CriarCentroCustoDto extends CodigoNomeDto {
  @IsUUID()
  empresaId!: string;
}

/**
 * Filtros de listagem. Apenas o necessário e autorizado (spec §10): sem texto
 * livre, sem ordenação vinda do cliente. A ordenação é fixa por `codigo` no
 * service, e o escopo de empresa é sempre interseccionado com o da sessão —
 * `empresaId` aqui é filtro, nunca concessão de escopo.
 */
export class ListarNosOrganizacionaisQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(TAMANHO_PAGINA_MAXIMO)
  tamanhoPagina: number = TAMANHO_PAGINA_PADRAO;

  @IsOptional()
  @IsIn(STATUS_ORGANIZACIONAL)
  status?: StatusOrganizacional;
}

export class ListarPorEmpresaQueryDto extends ListarNosOrganizacionaisQueryDto {
  @IsOptional()
  @IsUUID()
  empresaId?: string;
}

export class ListarAreasQueryDto extends ListarNosOrganizacionaisQueryDto {
  @IsOptional()
  @IsUUID()
  departamentoId?: string;
}

export class ListarEquipesQueryDto extends ListarPorEmpresaQueryDto {
  @IsOptional()
  @IsUUID()
  departamentoId?: string;

  @IsOptional()
  @IsUUID()
  unidadeOrganizacionalId?: string;
}
