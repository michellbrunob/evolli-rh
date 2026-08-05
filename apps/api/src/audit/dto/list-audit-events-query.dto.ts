import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";
import { AuditAction } from "@prisma/client";
import { AUDIT_ACTIONS } from "../audit.types";
import {
  AUDIT_EVENTS_DEFAULT_PAGE_SIZE,
  AUDIT_EVENTS_MAX_PAGE_SIZE,
} from "../audit.service";

/**
 * Filtros seguros de consulta (spec §9) — nenhum filtro aceita texto livre
 * que vire injeção ou reflexão de dado sensível; `action`/pagina são
 * validados contra lista fechada/limites.
 */
export class ListAuditEventsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(AUDIT_EVENTS_MAX_PAGE_SIZE)
  pageSize: number = AUDIT_EVENTS_DEFAULT_PAGE_SIZE;

  @IsOptional()
  @IsISO8601()
  occurredFrom?: string;

  @IsOptional()
  @IsISO8601()
  occurredTo?: string;

  @IsOptional()
  @IsString()
  actorUserId?: string;

  @IsOptional()
  @IsIn(AUDIT_ACTIONS)
  action?: AuditAction;

  @IsOptional()
  @IsString()
  resource?: string;

  @IsOptional()
  @IsString()
  companyId?: string;
}
