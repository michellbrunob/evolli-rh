import {
  MotivoAfastamento,
  MotivoReinicioPeriodo,
  StatusAusencia,
  TipoAusencia,
} from "@prisma/client";
import { Transform, Type } from "class-transformer";
import {
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
} from "class-validator";
import { LIMITE_BUSCA, normalizarBusca } from "../dto/pessoas.dto";
import { TAMANHO_PAGINA_MAXIMO, TAMANHO_PAGINA_PADRAO } from "../pessoas.types";

/** T215 — listas fechadas de Férias e ausências (as mesmas da migration). */
export const TIPOS_AUSENCIA: readonly TipoAusencia[] = [
  "ferias",
  "licenca_medica",
  "licenca_maternidade",
  "licenca_paternidade",
  "afastamento",
  "falta_justificada",
  "falta_sem_justificativa",
  "day_off",
  "home_office",
];

export const MOTIVOS_AFASTAMENTO: readonly MotivoAfastamento[] = [
  "auxilio_doenca",
  "acidente_trabalho",
  "licenca_nao_remunerada",
  "licenca_remunerada",
  "outro",
];

export const STATUS_AUSENCIA: readonly StatusAusencia[] = [
  "aguardando_gestor",
  "aguardando_rh",
  "aprovada",
  "cancelamento_pedido",
  "ajuste_sugerido",
  "recusada",
  "cancelada",
];

/** Filtro "Período" da lista (recortes de hoje). */
export const PERIODOS_DA_LISTA = [
  "em_ferias_agora",
  "licencas_afastamentos",
  "faltas_mes",
  "proximas_ferias",
] as const;
export type PeriodoDaLista = (typeof PERIODOS_DA_LISTA)[number];

/** Filtro "Tipo" da lista: grupos de tipos. */
export const GRUPOS_DE_TIPO = [
  "ferias",
  "licencas",
  "afastamentos",
  "faltas",
  "day_off",
  "home_office",
] as const;
export type GrupoDeTipo = (typeof GRUPOS_DE_TIPO)[number];

/** Filtro "Status": os status, mais "aguardando você" (quem consulta decide). */
export const FILTROS_DE_STATUS = [
  ...STATUS_AUSENCIA,
  "aguardando_voce",
] as const;
export type FiltroDeStatus = (typeof FILTROS_DE_STATUS)[number];

const DIA_CIVIL = /^\d{4}-\d{2}-\d{2}$/;
// eslint-disable-next-line no-control-regex
const SEM_CONTROLE_COM_LINHA = /^[^\u0000-\u0009\u000B-\u001F\u007F]*$/;

/** Texto opcional: aparado; vazio vira ausente. */
function textoOpcional(valor: unknown): unknown {
  if (typeof valor !== "string") return valor;
  const limpo = valor.trim();
  return limpo === "" ? undefined : limpo;
}

export class ListarAusenciasQueryDto {
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

  /** Pelo nome do colaborador, com a normalização da listagem. */
  @Transform(({ value }) => normalizarBusca(value))
  @IsOptional()
  @IsString()
  @MaxLength(LIMITE_BUSCA)
  // eslint-disable-next-line no-control-regex
  @Matches(/^[^\u0000-\u001F\u007F]*$/)
  busca?: string;

  @IsOptional()
  @IsIn(PERIODOS_DA_LISTA)
  periodo?: PeriodoDaLista;

  @IsOptional()
  @IsIn(GRUPOS_DE_TIPO)
  tipo?: GrupoDeTipo;

  @IsOptional()
  @IsIn(FILTROS_DE_STATUS)
  status?: FiltroDeStatus;
}

export class RegistrarAusenciaDto {
  @IsUUID()
  colaboradorId!: string;

  @IsIn(TIPOS_AUSENCIA)
  tipo!: TipoAusencia;

  /** Só no afastamento, e obrigatório nele (conferido no serviço). */
  @IsOptional()
  @IsIn(MOTIVOS_AFASTAMENTO)
  motivoAfastamento?: MotivoAfastamento;

  @Matches(DIA_CIVIL)
  @IsDateString({ strict: true })
  inicio!: string;

  /** Obrigatório, salvo no afastamento sem data de volta. */
  @IsOptional()
  @Matches(DIA_CIVIL)
  @IsDateString({ strict: true })
  fim?: string;

  /** Abono pecuniário: só nas férias. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  diasVendidos?: number;

  /** De que período aquisitivo as férias descontam (ausente: automático). */
  @IsOptional()
  @Matches(DIA_CIVIL)
  @IsDateString({ strict: true })
  periodoAquisitivoInicio?: string;

  /** Já aprovada (entra direto) ou aguardando o RH. O afastamento ignora. */
  @IsBoolean()
  aprovada!: boolean;

  @Transform(({ value }) => textoOpcional(value))
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @Matches(SEM_CONTROLE_COM_LINHA)
  observacao?: string;
}

/**
 * T215 — editar a ausência (como a referência): as mesmas respostas do
 * registro, menos a pessoa (que não muda).
 */
export class AlterarAusenciaDto {
  @IsIn(TIPOS_AUSENCIA)
  tipo!: TipoAusencia;

  @IsOptional()
  @IsIn(MOTIVOS_AFASTAMENTO)
  motivoAfastamento?: MotivoAfastamento;

  @Matches(DIA_CIVIL)
  @IsDateString({ strict: true })
  inicio!: string;

  @IsOptional()
  @Matches(DIA_CIVIL)
  @IsDateString({ strict: true })
  fim?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  diasVendidos?: number;

  @IsOptional()
  @Matches(DIA_CIVIL)
  @IsDateString({ strict: true })
  periodoAquisitivoInicio?: string;

  @IsBoolean()
  aprovada!: boolean;

  @Transform(({ value }) => textoOpcional(value))
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @Matches(SEM_CONTROLE_COM_LINHA)
  observacao?: string;
}

export class RecusarAusenciaDto {
  @Transform(({ value }) => textoOpcional(value))
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Matches(SEM_CONTROLE_COM_LINHA)
  motivo?: string;
}

export class SimularAusenciaQueryDto {
  @IsUUID()
  colaboradorId!: string;

  @IsIn(TIPOS_AUSENCIA)
  tipo!: TipoAusencia;

  @Matches(DIA_CIVIL)
  @IsDateString({ strict: true })
  inicio!: string;

  @IsOptional()
  @Matches(DIA_CIVIL)
  @IsDateString({ strict: true })
  fim?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10)
  diasVendidos?: number;

  @IsOptional()
  @Matches(DIA_CIVIL)
  @IsDateString({ strict: true })
  periodoAquisitivoInicio?: string;

  /** Editando: a própria ausência não conta (sobreposição e saldo). */
  @IsOptional()
  @IsUUID()
  ignorar?: string;
}

/** T215 — "Ajustar período": por que a contagem recomeça. */
export const MOTIVOS_REINICIO: readonly MotivoReinicioPeriodo[] = [
  "ferias_coletivas",
  "perda_direito",
  "outro",
];

/** T215 — reinício da contagem do período aquisitivo (como a referência). */
export class RegistrarReinicioDto {
  @Matches(DIA_CIVIL)
  @IsDateString({ strict: true })
  inicio!: string;

  @IsIn(MOTIVOS_REINICIO)
  motivo!: MotivoReinicioPeriodo;

  /** Em branco, o proporcional (2,5 dias por mês); na perda, 0. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(30)
  diasPeriodoAnterior?: number;

  @Transform(({ value }) => textoOpcional(value))
  @IsOptional()
  @IsString()
  @MaxLength(300)
  @Matches(SEM_CONTROLE_COM_LINHA)
  observacao?: string;
}

/** Sem `inicio`: os períodos de hoje; com ele, como vão ficar. */
export class SimularReinicioQueryDto {
  @IsOptional()
  @Matches(DIA_CIVIL)
  @IsDateString({ strict: true })
  inicio?: string;

  @IsOptional()
  @IsIn(MOTIVOS_REINICIO)
  motivo?: MotivoReinicioPeriodo;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(30)
  dias?: number;
}
