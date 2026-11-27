import { Transform, Type } from "class-transformer";
import {
  Allow,
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
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
import {
  TAMANHO_PAGINA_MAXIMO,
  TAMANHO_PAGINA_PADRAO,
} from "../pessoas/pessoas.types";
import {
  CAMPOS_GRUPO,
  type CampoGrupo,
  IDENTIFICACOES,
  type Identificacao,
  MODELOS,
  type Modelo,
  STATUS_PESQUISA,
  type StatusPesquisa,
} from "./pesquisas.types";

/**
 * T216 — Pesquisas: as entradas. A forma das seções e perguntas é conferida
 * pelo serviço (`estrutura-pesquisa.ts`), que responde por campo (o id da
 * pergunta); o valor de cada resposta, por `validacao-respostas.ts`.
 */
/** Data e hora no horário de Brasília (só a data: até 23:59). */
const ENCERRAMENTO = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/;

const nulo = ({ value }: { value: unknown }) => (value === "" ? null : value);

export class ParticipantesDto {
  @IsBoolean()
  todos!: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5000)
  @IsUUID("all", { each: true })
  colaboradorIds?: string[];
}

export class PesquisaDto {
  @IsString()
  @MaxLength(200)
  nome!: string;

  @IsOptional()
  @Transform(nulo)
  @IsString()
  @MaxLength(2000)
  boasVindas?: string | null;

  @IsIn(MODELOS)
  modelo!: Modelo;

  @IsIn(IDENTIFICACOES)
  identificacao!: Identificacao;

  /** Seções e perguntas: conferidas no serviço. */
  @IsArray()
  @ArrayMaxSize(50)
  secoes!: unknown[];

  /** Ignorado na anônima (sem participantes: quem tiver o link responde). */
  @IsOptional()
  @ValidateNested()
  @Type(() => ParticipantesDto)
  participantes?: ParticipantesDto;

  /** Só na anônima: 0 a 2 campos (conferidos no serviço). */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @IsIn(CAMPOS_GRUPO, { each: true })
  separarPor?: CampoGrupo[];

  @IsOptional()
  @Transform(nulo)
  @Matches(ENCERRAMENTO)
  encerraEm?: string | null;

  @Type(() => Number)
  @IsInt()
  @Min(3)
  @Max(10)
  minimoPorGrupo!: number;
}

export class DuplicarDto {
  /** Empresa de destino; sem ela, a empresa ativa. */
  @IsOptional()
  @IsUUID()
  empresaId?: string;
}

export class StatusDto {
  @IsIn(STATUS_PESQUISA)
  status!: StatusPesquisa;
}

export class ListarPesquisasQueryDto {
  @IsOptional()
  @IsIn(["todas", ...STATUS_PESQUISA])
  status?: "todas" | StatusPesquisa;

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
}

const textoDeBusca = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() || undefined : value;

export class CandidatosQueryDto {
  /** Pelo nome, sem diferenciar maiúsculas. */
  @IsOptional()
  @Transform(textoDeBusca)
  @IsString()
  @MaxLength(160)
  busca?: string;

  @IsOptional()
  @IsUUID()
  departamentoId?: string;

  @IsOptional()
  @IsUUID()
  centroCustoId?: string;

  @IsOptional()
  @IsUUID()
  unidadeId?: string;

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
}

export class ResultadosQueryDto {
  /** Atalho antigo para `campo=departamento&grupoId=`. */
  @IsOptional()
  @Transform(nulo)
  @IsUUID()
  departamentoId?: string | null;

  @IsOptional()
  @IsIn(CAMPOS_GRUPO)
  campo?: CampoGrupo;

  @IsOptional()
  @Transform(nulo)
  @IsUUID()
  grupoId?: string | null;
}

export class AnalisesQueryDto {
  @IsIn(CAMPOS_GRUPO)
  campo!: CampoGrupo;
}

export class IdentificarDto {
  @IsString()
  @MaxLength(20)
  cpf!: string;

  @IsString()
  @MaxLength(10)
  dataNascimento!: string;
}

export class RespostaDto {
  @IsString()
  @MaxLength(40)
  perguntaId!: string;

  /** Conferido pelo tipo da pergunta no serviço. */
  @Allow()
  valor!: unknown;
}

export class ResponderDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  passe?: string;

  /** Anônima com separação: o grupo escolhido (`null` = prefere não informar). */
  @IsOptional()
  @IsObject()
  grupos?: Record<string, unknown>;

  @IsArray()
  @ArrayMaxSize(60)
  @ValidateNested({ each: true })
  @Type(() => RespostaDto)
  respostas!: RespostaDto[];
}
