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
import { EstadoDocumento } from "@prisma/client";
import {
  TAMANHO_PAGINA_MAXIMO,
  TAMANHO_PAGINA_PADRAO,
} from "../documentos.types";

/**
 * Código do tipo documental: identificador **técnico** estável, único dentro da
 * empresa. Maiúsculas, dígitos, `-` e `_` — nunca texto livre, nunca derivado
 * de dado pessoal. NÃO é o nome de exibição.
 */
const CODIGO_PATTERN = /^[A-Z0-9_-]{2,32}$/;

const ESTADOS_DOCUMENTO = [
  "upload_desabilitado",
  "substituido",
] as const satisfies readonly EstadoDocumento[];

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

// --------------------------------------------------------------------------
// TipoDocumento (catálogo). Apenas RH cria/altera, com aprovação de DPO
// registrada (ADR 0011, Emenda 1). O nome é rótulo de exibição; a
// classificação começa e permanece `restrito` (não é aceita do cliente).
// --------------------------------------------------------------------------

export class CriarTipoDocumentoDto {
  @IsUUID()
  empresaId!: string;

  @Matches(CODIGO_PATTERN)
  codigo!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(160)
  nome!: string;

  /**
   * Evidência da aprovação de DPO exigida para operar o catálogo. Obrigatória e
   * não-vazia: ausência → 400 (o `ValidationPipe` recusa). A verificação de que
   * o DPO de fato a emitiu depende do provisionamento do papel `dpo` (DP-7),
   * pendente — a V1 exige a **presença** da referência e a registra.
   */
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  aprovacaoDpoReferencia!: string;
}

export class AlterarTipoDocumentoDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(160)
  nome!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  aprovacaoDpoReferencia!: string;
}

export class ListarTiposDocumentoQueryDto extends ListarPaginadoQueryDto {
  /** Filtro, nunca concessão de escopo: interseccionado com o da sessão. */
  @IsOptional()
  @IsUUID()
  empresaId?: string;
}

// --------------------------------------------------------------------------
// DocumentoMetadado. Sujeito é o Colaborador; empresa explícita. Sem qualquer
// campo de conteúdo — a ausência é estrutural (ADR 0011, decisão 1).
// --------------------------------------------------------------------------

export class CriarDocumentoMetadadoDto {
  @IsUUID()
  empresaId!: string;

  @IsUUID()
  colaboradorId!: string;

  @IsUUID()
  tipoDocumentoId!: string;
}

/**
 * Substituição corrige o **tipo** do metadado, preservando o histórico: cria um
 * registro novo apontando para o anterior, que transita para `substituido`.
 * Nunca sobrescreve nem apaga (ADR 0011, decisão 8). Empresa e colaborador
 * (o sujeito) não mudam — trocar o sujeito reatribuiria o documento a outra
 * pessoa, o que não é substituição.
 */
export class SubstituirDocumentoMetadadoDto {
  @IsUUID()
  tipoDocumentoId!: string;
}

export class ListarDocumentosMetadadoQueryDto extends ListarPaginadoQueryDto {
  @IsOptional()
  @IsUUID()
  empresaId?: string;

  @IsOptional()
  @IsUUID()
  colaboradorId?: string;

  @IsOptional()
  @IsUUID()
  tipoDocumentoId?: string;

  @IsOptional()
  @IsIn(ESTADOS_DOCUMENTO)
  estado?: EstadoDocumento;
}

// --------------------------------------------------------------------------
// SolicitacaoDocumento (pedido). Solicitar e consultar; sem prazo, sem canal.
// --------------------------------------------------------------------------

export class CriarSolicitacaoDocumentoDto {
  @IsUUID()
  empresaId!: string;

  @IsUUID()
  colaboradorId!: string;

  @IsUUID()
  tipoDocumentoId!: string;
}

export class ListarSolicitacoesDocumentoQueryDto extends ListarPaginadoQueryDto {
  @IsOptional()
  @IsUUID()
  empresaId?: string;

  @IsOptional()
  @IsUUID()
  colaboradorId?: string;

  @IsOptional()
  @IsUUID()
  tipoDocumentoId?: string;
}
