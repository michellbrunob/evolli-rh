import { Type } from "class-transformer";
import {
  IsDateString,
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
import {
  MotivoMovimentacao,
  SituacaoColaborador,
  SituacaoVinculo,
  StatusMovimentacao,
  TipoMovimentacao,
  TipoVinculo,
} from "@prisma/client";
import { TAMANHO_PAGINA_MAXIMO, TAMANHO_PAGINA_PADRAO } from "../pessoas.types";

/**
 * Matrícula: identificador **funcional**, único dentro da empresa
 * (Baseline V1, item 2). Restrita a maiúsculas, dígitos, `-` e `_` — nunca
 * é, nem deriva de, documento pessoal (RI-C1).
 */
const MATRICULA_PATTERN = /^[A-Z0-9_-]{2,32}$/;

const TIPOS_VINCULO = [
  "clt",
  "estagio",
  "pj",
  "temporario",
  "outro_controlado",
] as const satisfies readonly TipoVinculo[];

const TIPOS_MOVIMENTACAO = [
  "admissao",
  "transferencia_organizacional",
  "mudanca_cargo",
  "desligamento",
] as const satisfies readonly TipoMovimentacao[];

/**
 * Catálogo controlado (Baseline V1, item 11). **Não há campo de texto livre
 * para motivo** — é justamente o que impede dado sensível (ex.: diagnóstico
 * médico) de entrar por um campo de observação não classificado.
 */
const MOTIVOS = [
  "admissao_inicial",
  "reestruturacao_organizacional",
  "realocacao_interna",
  "promocao",
  "correcao_cadastral",
  "encerramento_de_vinculo",
  "outro_controlado",
] as const satisfies readonly MotivoMovimentacao[];

const SITUACOES_VINCULO = [
  "previsto",
  "ativo",
  "encerrado",
] as const satisfies readonly SituacaoVinculo[];

const SITUACOES_COLABORADOR = [
  "ativo",
  "inativo",
] as const satisfies readonly SituacaoColaborador[];

const STATUS_MOVIMENTACAO = [
  "solicitada",
  "programada",
  "efetivada",
  "cancelada",
  "retificada",
] as const satisfies readonly StatusMovimentacao[];

/**
 * Destino organizacional de uma movimentação. Todos opcionais: qual campo é
 * individualmente obrigatório segue pendente de validação com RH (DP-28,
 * resolvido apenas no nível "a alocação precisa existir"). O que **é**
 * exigido: ao menos uma referência, e `areaId` sempre acompanhado de
 * `departamentoId` (ver `assertDestinoCoerente`).
 */
export class DestinoOrganizacionalDto {
  @IsOptional()
  @IsUUID()
  unidadeOrganizacionalId?: string;

  @IsOptional()
  @IsUUID()
  departamentoId?: string;

  @IsOptional()
  @IsUUID()
  areaId?: string;

  @IsOptional()
  @IsUUID()
  equipeId?: string;

  @IsOptional()
  @IsUUID()
  cargoId?: string;

  @IsOptional()
  @IsUUID()
  centroCustoId?: string;
}

/**
 * Admissão: cria colaborador + primeiro vínculo + movimentação `admissao`.
 *
 * O cadastro **não** é criado sozinho de propósito. Colaborador não tem
 * `empresa_id` (a empresa é do vínculo), então um cadastro sem vínculo ficaria
 * fora de qualquer escopo de autorização — invisível a todos, inclusive a
 * quem o criou.
 */
export class AdmitirColaboradorDto extends DestinoOrganizacionalDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(160)
  nome!: string;

  @IsUUID()
  empresaId!: string;

  @Matches(MATRICULA_PATTERN)
  matricula!: string;

  @IsIn(TIPOS_VINCULO)
  tipo!: TipoVinculo;

  @IsDateString({ strict: true })
  dataAdmissao!: string;

  @IsIn(MOTIVOS)
  motivoCodigo!: MotivoMovimentacao;
}

/**
 * Novo vínculo para colaborador **já visível no escopo do ator** (readmissão
 * na mesma empresa). Reaproveitar uma pessoa cujo único vínculo esteja em
 * outra empresa não é possível nesta V1 — sem identificador pessoal, o sistema
 * não tem como reconhecê-la, e inventar um seria introduzir dado não aprovado.
 */
export class CriarVinculoDto extends DestinoOrganizacionalDto {
  @IsUUID()
  colaboradorId!: string;

  @IsUUID()
  empresaId!: string;

  @Matches(MATRICULA_PATTERN)
  matricula!: string;

  @IsIn(TIPOS_VINCULO)
  tipo!: TipoVinculo;

  @IsDateString({ strict: true })
  dataAdmissao!: string;

  @IsIn(MOTIVOS)
  motivoCodigo!: MotivoMovimentacao;
}

/**
 * Retificação de cadastro: **só o nome**.
 *
 * Não é "editar o colaborador": matrícula vive no vínculo e é imutável;
 * situação é derivada dos vínculos; e nenhum outro campo pessoal existe nesta
 * fatia. Alterar a vida funcional é movimentação, nunca `PATCH`.
 */
export class RetificarColaboradorDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(160)
  nome!: string;
}

/** Movimentação sobre vínculo existente. Admissão não passa por aqui. */
export class RegistrarMovimentacaoDto extends DestinoOrganizacionalDto {
  @IsUUID()
  vinculoId!: string;

  @IsIn(TIPOS_MOVIMENTACAO.filter((tipo) => tipo !== "admissao"))
  tipo!: Exclude<TipoMovimentacao, "admissao">;

  @IsIn(MOTIVOS)
  motivoCodigo!: MotivoMovimentacao;

  @IsDateString({ strict: true })
  vigenciaInicio!: string;
}

/**
 * Retificação de movimentação efetivada (spec §4.10): cria movimentação nova
 * apontando para a original, que transita para `retificada` e **permanece**
 * na linha do tempo. Nada é apagado nem reescrito.
 */
export class RetificarMovimentacaoDto extends DestinoOrganizacionalDto {
  @IsIn(MOTIVOS)
  motivoCodigo!: MotivoMovimentacao;

  @IsDateString({ strict: true })
  vigenciaInicio!: string;
}

/** Paginação e ordenação fixas no servidor — nada vem do cliente. */
export class ListarPaginadoQueryDto {
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

export class ListarColaboradoresQueryDto extends ListarPaginadoQueryDto {
  /** Filtro, nunca concessão de escopo: é interseccionado com o da sessão. */
  @IsOptional()
  @IsUUID()
  empresaId?: string;

  @IsOptional()
  @IsIn(SITUACOES_COLABORADOR)
  situacao?: SituacaoColaborador;

  @IsOptional()
  @IsIn(SITUACOES_VINCULO)
  situacaoVinculo?: SituacaoVinculo;
}

export class ListarMovimentacoesQueryDto extends ListarPaginadoQueryDto {
  @IsOptional()
  @IsUUID()
  empresaId?: string;

  @IsOptional()
  @IsUUID()
  vinculoId?: string;

  @IsOptional()
  @IsIn(TIPOS_MOVIMENTACAO)
  tipo?: TipoMovimentacao;

  @IsOptional()
  @IsIn(STATUS_MOVIMENTACAO)
  status?: StatusMovimentacao;
}

/** Consulta da situação numa data de referência (spec §1, §4.8). */
export class SituacaoEmDataQueryDto {
  @IsDateString({ strict: true })
  dataReferencia!: string;
}
