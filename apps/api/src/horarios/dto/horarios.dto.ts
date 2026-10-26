import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
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
  ValidateIf,
  ValidateNested,
} from "class-validator";
import { DIAS_SEMANA } from "../horarios.types";
import { LIMITE_BUSCA, normalizarBusca } from "../../pessoas/dto/pessoas.dto";
import { HORA_PATTERN } from "../validacao-horarios.util";
import {
  TAMANHO_PAGINA_MAXIMO,
  TAMANHO_PAGINA_PADRAO,
} from "../horarios.types";

/** Um período de trabalho de um dia. Entrada e saída em `"HH:MM"` (24h). */
export class PeriodoHorarioInputDto {
  @IsIn(DIAS_SEMANA)
  dia!: (typeof DIAS_SEMANA)[number];

  @Matches(HORA_PATTERN, { message: "inicio deve estar no formato HH:MM." })
  inicio!: string;

  @Matches(HORA_PATTERN, { message: "fim deve estar no formato HH:MM." })
  fim!: string;
}

/**
 * Cria uma tabela de horário na própria empresa. A empresa NÃO é aceita no
 * corpo — vem sempre da sessão (o RH opera só a própria empresa). A definição
 * de períodos é imutável após a criação (revisão = nova tabela).
 *
 * `periodos` pode ser vazio (tabela sem jornada prevista); dias sem período
 * (sábado/domingo, folga) simplesmente não aparecem na lista.
 */
/**
 * T182 — código da jornada: maiúsculas, dígitos e `_`, de 2 a 32 caracteres,
 * a mesma forma dos códigos de Estrutura. Único na empresa (índice no banco).
 */
export const CODIGO_JORNADA = /^[A-Z0-9_]{2,32}$/;

/** T182 — nome aparado; só espaços vira vazio e é recusado. */
function aparar(valor: unknown): unknown {
  return typeof valor === "string" ? valor.trim() : valor;
}

export class CriarTabelaHorarioDto {
  /** T182 — obrigatório ao criar (decisão da proprietária de 2026-10-23). */
  @IsString()
  @Matches(CODIGO_JORNADA, {
    message: "codigo deve ter de 2 a 32 letras maiusculas, digitos ou _.",
  })
  codigo!: string;

  @Transform(({ value }) => aparar(value))
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  nome!: string;

  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => PeriodoHorarioInputDto)
  periodos!: PeriodoHorarioInputDto[];
}

/**
 * T182 — edição de uma jornada: só NOME e CÓDIGO. Os períodos (dias e
 * horários) são imutáveis desde a T038 — no banco, inclusive —, e um corpo com
 * `periodos` é recusado pelo `forbidNonWhitelisted`. Ao menos um dos dois.
 *
 * Campo AUSENTE (`undefined`) é "não alterar". `null` NÃO é ausência: o
 * `@IsOptional()` pularia a validação de `null`, e a edição apagaria o código
 * (ou quebraria no banco com o nome). Por isso `@ValidateIf` só pula o
 * `undefined`, e `null` é recusado com 400.
 */
export class EditarTabelaHorarioDto {
  @ValidateIf((_, valor) => valor !== undefined)
  @IsString()
  @Matches(CODIGO_JORNADA, {
    message: "codigo deve ter de 2 a 32 letras maiusculas, digitos ou _.",
  })
  codigo?: string;

  @ValidateIf((_, valor) => valor !== undefined)
  @Transform(({ value }) => aparar(value))
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  nome?: string;
}

/** Vincula uma tabela a um colaborador com vigência (início e fim opcional). */
export class CriarVinculoHorarioDto {
  @IsUUID()
  colaboradorId!: string;

  @IsUUID()
  tabelaHorarioId!: string;

  /** Data (YYYY-MM-DD) de início da vigência. */
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: "vigenciaInicio deve estar no formato YYYY-MM-DD.",
  })
  vigenciaInicio!: string;

  /** Data opcional de término da vigência (exclusiva do dia seguinte não). */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: "vigenciaFim deve estar no formato YYYY-MM-DD.",
  })
  vigenciaFim?: string;
}

/** Encerra a vigência de um vínculo aberto (mecanismo de troca de horário). */
export class EncerrarVinculoHorarioDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: "vigenciaFim deve estar no formato YYYY-MM-DD.",
  })
  vigenciaFim!: string;
}

export class ListarTabelasHorarioQueryDto {
  // Query param chega como string: coerção explícita (`@Type(() => Boolean)`
  // trataria "false" como truthy). Só "true"/"false" são aceitos; qualquer
  // outra coisa vira `undefined` (sem filtro) e o `@IsBoolean` não reprova.
  @IsOptional()
  @Transform(({ value }) => {
    if (value === "true" || value === true) {
      return true;
    }
    if (value === "false" || value === false) {
      return false;
    }
    return undefined;
  })
  @IsBoolean()
  ativo?: boolean;

  /**
   * T182 — busca por nome ou código, na empresa da sessão. Aparada, espaços
   * colapsados; vazia vale como ausente (a mesma normalização da listagem de
   * colaboradores).
   */
  @Transform(({ value }) => normalizarBusca(value))
  @IsOptional()
  @IsString()
  @MaxLength(LIMITE_BUSCA)
  busca?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(TAMANHO_PAGINA_MAXIMO)
  tamanhoPagina?: number = TAMANHO_PAGINA_PADRAO;
}

export class ListarVinculosHorarioQueryDto {
  @IsOptional()
  @IsUUID()
  colaboradorId?: string;

  @IsOptional()
  @IsUUID()
  tabelaHorarioId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(TAMANHO_PAGINA_MAXIMO)
  tamanhoPagina?: number = TAMANHO_PAGINA_PADRAO;
}
