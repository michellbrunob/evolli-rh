import { Type } from "class-transformer";
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Matches,
  Max,
  Min,
} from "class-validator";
import { MotivoAjustePonto, TipoEventoPonto } from "@prisma/client";
import { COMPETENCIA_PATTERN } from "../competencia.util";
import { TAMANHO_PAGINA_MAXIMO, TAMANHO_PAGINA_PADRAO } from "../ponto.types";

/**
 * Catálogo **fechado** de tipos de evento (Baseline Jornada V1, decisão 2).
 * Exatamente quatro. `satisfies` garante, em tempo de compilação, que a lista
 * aceita pela API e o enum do banco não divirjam.
 */
const TIPOS_EVENTO = [
  "entrada",
  "saida",
  "inicio_pausa",
  "fim_pausa",
] as const satisfies readonly TipoEventoPonto[];

/**
 * Catálogo controlado de motivo de ajuste (decisão 4). **Não existe campo de
 * texto livre** — é o que impede dado sensível de entrar por um campo de
 * observação não classificado, mesmo mecanismo do `motivo_codigo` da Fatia 2.
 */
const MOTIVOS_AJUSTE = [
  "erro_de_digitacao",
  "registro_duplicado",
  "registro_indevido",
  "outro_controlado",
] as const satisfies readonly MotivoAjustePonto[];

/**
 * Registro manual de uma marcação (decisão 3: registro manual interno é a
 * **única** origem).
 *
 * Note o que este DTO não tem, e não pode ganhar sem nova decisão de produto:
 * nenhum campo de dispositivo, IP, foto, coordenada, hash biométrico ou
 * identificador de origem externa (decisão 3).
 */
export class RegistrarEventoPontoDto {
  @IsUUID()
  vinculoId!: string;

  @IsIn(TIPOS_EVENTO)
  tipo!: (typeof TIPOS_EVENTO)[number];

  /**
   * Instante da marcação, com fuso. É informado — não é o relógio do servidor:
   * o registro é manual e frequentemente retroativo (alguém esqueceu de bater
   * o ponto ontem).
   */
  @IsDateString()
  momento!: string;
}

/**
 * Correção de um evento já registrado. O evento original **não** é alterado
 * (decisão 4) — este DTO descreve um registro novo que se refere a ele.
 *
 * Anular e corrigir são mutuamente exclusivos, e um ajuste sem nenhum efeito é
 * recusado. Ambas as regras também são garantidas por CHECK no banco
 * (`ajuste_ponto_efeito_coerente`), não só aqui.
 */
export class RegistrarAjustePontoDto {
  @IsIn(MOTIVOS_AJUSTE)
  motivoCodigo!: (typeof MOTIVOS_AJUSTE)[number];

  /** `true` = o evento não deveria existir. Anulação é terminal. */
  @IsOptional()
  @IsBoolean()
  anula?: boolean;

  @IsOptional()
  @IsDateString()
  momentoCorrigido?: string;

  @IsOptional()
  @IsIn(TIPOS_EVENTO)
  tipoCorrigido?: (typeof TIPOS_EVENTO)[number];
}

export class ListarPontosQueryDto {
  @IsOptional()
  @IsUUID()
  vinculoId?: string;

  /** Competência `'YYYY-MM'`. */
  @IsOptional()
  @Matches(COMPETENCIA_PATTERN)
  competencia?: string;

  @IsOptional()
  @IsIn(TIPOS_EVENTO)
  tipo?: (typeof TIPOS_EVENTO)[number];

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

/** Mesma listagem, já escopada a um vínculo pela rota. */
export class ListarPontosDoVinculoQueryDto {
  @IsOptional()
  @Matches(COMPETENCIA_PATTERN)
  competencia?: string;

  @IsOptional()
  @IsIn(TIPOS_EVENTO)
  tipo?: (typeof TIPOS_EVENTO)[number];

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
