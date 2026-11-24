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

/** T215 — as 12 cores de turno do quadro. */
export const CORES_DE_TURNO = [
  "azul",
  "laranja",
  "cinza",
  "verde",
  "verde_agua",
  "roxo",
  "indigo",
  "tangerina",
  "ciano",
  "oliva",
  "mostarda",
  "violeta",
] as const;
export const MODOS_DE_TURNO = ["mesmo_horario", "por_dia"] as const;
export const INTERVALOS_DE_TURNO = [0, 15, 30, 45, 60, 90, 120] as const;
/** T215 — sigla no mês: 1 ou 2 letras ou dígitos. */
export const SIGLA_DE_TURNO = /^[A-Za-zÀ-ÿ0-9]{1,2}$/;

/** T215 — campos de turno, comuns à criação e à edição. */
class CamposDeTurno {
  @IsOptional()
  @IsIn(CORES_DE_TURNO)
  cor?: (typeof CORES_DE_TURNO)[number];

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().toUpperCase() : value,
  )
  @Matches(SIGLA_DE_TURNO)
  sigla?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  unidadeOrganizacionalId?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsInt()
  @Min(0)
  @Max(60)
  toleranciaMinutos?: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsInt()
  @Min(0)
  @Max(999)
  minimoPorDia?: number | null;
}

export class CriarTabelaHorarioDto extends CamposDeTurno {
  /**
   * T182 — código da jornada. T215 — opcional: sem ele, o servidor gera um a
   * partir do nome (o Turno do quadro não pede código). `null` é recusado.
   */
  @ValidateIf((_, v) => v !== undefined)
  @IsString()
  @Matches(CODIGO_JORNADA, {
    message: "codigo deve ter de 2 a 32 letras maiusculas, digitos ou _.",
  })
  codigo?: string;

  @IsOptional()
  @IsIn(MODOS_DE_TURNO)
  modo?: (typeof MODOS_DE_TURNO)[number];

  @IsOptional()
  @IsIn(INTERVALOS_DE_TURNO)
  intervaloMinutos?: number;

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
export class EditarTabelaHorarioDto extends CamposDeTurno {
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

  /**
   * T215 — os horários do turno também mudam (como no quadro da referência):
   * valem para o rascunho a partir de hoje; o que já foi publicado guarda o
   * próprio horário. Com eles, ao menos um período.
   */
  @ValidateIf((_, valor) => valor !== undefined)
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => PeriodoHorarioInputDto)
  periodos?: PeriodoHorarioInputDto[];

  @IsOptional()
  @IsIn(MODOS_DE_TURNO)
  modo?: (typeof MODOS_DE_TURNO)[number];

  @IsOptional()
  @IsIn(INTERVALOS_DE_TURNO)
  intervaloMinutos?: number;
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

/**
 * T183 — atribui ou troca a jornada de um colaborador da empresa ativa, com
 * início de vigência. Sem jornada vigente, cria a vigência; com jornada
 * vigente, encerra a vigente no novo início e cria a nova, na mesma
 * transação. A empresa vem da sessão.
 */
export class AtribuirJornadaDto {
  @IsUUID()
  colaboradorId!: string;

  @IsUUID()
  tabelaHorarioId!: string;

  /** Data (YYYY-MM-DD) do primeiro dia da nova jornada. */
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: "vigenciaInicio deve estar no formato YYYY-MM-DD.",
  })
  @IsDateString({ strict: true })
  vigenciaInicio!: string;
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

  /** T215 — turnos de uma unidade (e os de todas as unidades). */
  @IsOptional()
  @IsUUID()
  unidadeOrganizacionalId?: string;
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
