import { Transform, Type } from "class-transformer";
import {
  EnderecoDto,
  PerfilPessoalDto,
} from "../dados-pessoais/dados-pessoais.dto";
import { RegistrarContatosColaboradorDto } from "../contatos/contato-colaborador.dto";
import {
  IsDateString,
  IsDefined,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
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

/**
 * Motivos aceitos na ADMISSÃO (T167). `POST /v1/colaboradores` sempre cria um
 * colaborador NOVO com o seu PRIMEIRO vínculo, então ficam de fora, pelo
 * próprio sentido do catálogo, os motivos que pressupõem um vínculo que ainda
 * não existe: mudança de lotação (`reestruturacao_organizacional`,
 * `realocacao_interna`), de cargo (`promocao`), correção de um registro
 * anterior (`correcao_cadastral`) e fim de vínculo (`encerramento_de_vinculo`).
 *
 * `outro_controlado` continua aceito: é genérico, não é incompatível pelo nome,
 * e já era aceito antes desta tarefa. Retirá-lo seria decidir o conteúdo do
 * catálogo por tipo, que segue pendente com o RH (DP-29) — fica registrado
 * como decisão do proprietário, não presumido aqui.
 */
export const MOTIVOS_ADMISSAO = [
  "admissao_inicial",
  "outro_controlado",
] as const satisfies readonly MotivoMovimentacao[];

export type MotivoAdmissao = (typeof MOTIVOS_ADMISSAO)[number];

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
 *
 * T179 — obrigatoriedade da Nova admissão (decisões da proprietária de
 * 2026-10-21): a lotação **exige** Departamento e Cargo (`DP-28` só para a
 * admissão); Unidade, Área, Equipe e Centro de custo são opcionais. A
 * matrícula é opcional (quando informada, continua única na empresa) e o bloco
 * de contatos também. Por isso esta classe não herda
 * `DestinoOrganizacionalDto`: o `@IsOptional` herdado valeria também aqui, e
 * a obrigatoriedade sumiria. O novo vínculo de colaborador existente
 * (`CriarVinculoDto`) continua com o destino todo opcional.
 */
export class AdmitirColaboradorDto {
  @IsUUID()
  departamentoId!: string;

  @IsUUID()
  cargoId!: string;

  @IsOptional()
  @IsUUID()
  unidadeOrganizacionalId?: string;

  @IsOptional()
  @IsUUID()
  areaId?: string;

  @IsOptional()
  @IsUUID()
  equipeId?: string;

  @IsOptional()
  @IsUUID()
  centroCustoId?: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(160)
  nome!: string;

  @IsUUID()
  empresaId!: string;

  /**
   * T179 — opcional na Nova admissão; vazio vale como não informada. Quando
   * vem, segue o padrão e é única na empresa.
   */
  @Transform(({ value }) =>
    typeof value === "string" && value.trim() === "" ? undefined : value,
  )
  @IsOptional()
  @Matches(MATRICULA_PATTERN)
  matricula?: string;

  @IsIn(TIPOS_VINCULO)
  tipo!: TipoVinculo;

  @IsDateString({ strict: true })
  dataAdmissao!: string;

  /** Só motivos compatíveis com uma primeira admissão (`MOTIVOS_ADMISSAO`). */
  @IsIn(MOTIVOS_ADMISSAO)
  motivoCodigo!: MotivoAdmissao;

  /**
   * T177 — Módulo 1 do cadastro, gravado na MESMA transação da admissão.
   *
   * OBRIGATÓRIOS: `perfilPessoal` (com `dataNascimento`) e `contatos` (os
   * três campos da ficha da T169). OPCIONAL: `endereco`, e todos os campos
   * dele. Admissão sem eles é 400, antes de qualquer gravação.
   */
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => PerfilPessoalDto)
  perfilPessoal!: PerfilPessoalDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => EnderecoDto)
  endereco?: EnderecoDto;

  /**
   * Os contatos da ficha da T169 — o mesmo DTO da rota própria. T179: o bloco
   * e cada campo são opcionais; sem nenhum valor, nenhum contato é gravado.
   */
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => RegistrarContatosColaboradorDto)
  contatos?: RegistrarContatosColaboradorDto;
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

/** Limite da busca de colaboradores — o tamanho máximo do nome. */
export const LIMITE_BUSCA = 160;

/** Busca normalizada: aparada, espaços colapsados; vazia vira ausente. */
export function normalizarBusca(valor: unknown): unknown {
  if (typeof valor !== "string") return valor;
  const limpo = valor.trim().replace(/\s{2,}/g, " ");
  return limpo === "" ? undefined : limpo;
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

  /**
   * T178 — busca por **nome** ou **matrícula**, no escopo da sessão. Aparada,
   * com espaços repetidos colapsados; vazia vale como ausente. A matrícula só
   * é procurada em vínculos da empresa ativa — procurar em outra empresa
   * revelaria a quem pertence uma matrícula de lá.
   */
  @Transform(({ value }) => normalizarBusca(value))
  @IsOptional()
  @IsString()
  @MaxLength(LIMITE_BUSCA)
  // eslint-disable-next-line no-control-regex
  @Matches(/^[^\u0000-\u001F\u007F]*$/)
  busca?: string;
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
