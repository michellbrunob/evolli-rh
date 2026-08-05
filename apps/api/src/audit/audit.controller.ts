import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Request } from "express";
import { AccessUser } from "@prisma/client";
import { AuditService } from "./audit.service";
import { ListAuditEventsQueryDto } from "./dto/list-audit-events-query.dto";
import { SessionGuard } from "../auth/session/session.guard";
import { AuthorizationGuard } from "../auth/authorization/authorization.guard";
import { RequirePermission } from "../auth/authorization/require-permission.decorator";
import { CurrentUser } from "../auth/session/current-user.decorator";
import { extractRequestMetadata } from "../auth/request-metadata.util";

/**
 * Só consulta (spec §9) — nenhum endpoint de escrita direta de evento é
 * exposto; eventos só são criados internamente via `AuditService.record()`.
 * Sem endpoint de exportação nesta versão (ADR 0004 §4). Leitura restrita a
 * `admin_tecnico`/`auditor`/`dpo` via o recurso `access_log` já existente
 * no avaliador RBAC/ABAC da Fatia 3 — toda consulta bem-sucedida gera, ela
 * mesma, um novo evento de auditoria (spec §7).
 */
@ApiTags("audit")
@Controller("audit")
@UseGuards(SessionGuard, AuthorizationGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get("events")
  @RequirePermission("access_log", "read")
  async list(
    @Query() query: ListAuditEventsQueryDto,
    @CurrentUser() user: AccessUser,
    @Req() req: Request,
  ) {
    const result = await this.auditService.findMany(
      {
        occurredFrom: query.occurredFrom
          ? new Date(query.occurredFrom)
          : undefined,
        occurredTo: query.occurredTo ? new Date(query.occurredTo) : undefined,
        actorUserId: query.actorUserId,
        action: query.action,
        resource: query.resource,
        companyId: query.companyId,
      },
      { page: query.page, pageSize: query.pageSize },
    );

    await this.recordAccess(user, req, null, "success");

    return result;
  }

  // Param nomeado `eventId` (não `id`) de propósito: `AuthorizationGuard`
  // resolve automaticamente `request.params.id` como alvo `AccessUser`
  // (usado por `other_account`/`user_role`, Fatia 3) — aqui o alvo é um
  // `AuditEvent`, não um usuário; usar outro nome evita esse acoplamento.
  @Get("events/:eventId")
  @RequirePermission("access_log", "read")
  async findOne(
    @Param("eventId") eventId: string,
    @CurrentUser() user: AccessUser,
    @Req() req: Request,
  ) {
    const event = await this.auditService.findById(eventId);

    await this.recordAccess(user, req, eventId, event ? "success" : "failure");

    if (!event) {
      throw new NotFoundException();
    }

    return event;
  }

  private async recordAccess(
    user: AccessUser,
    req: Request,
    resourceId: string | null,
    result: "success" | "failure",
  ): Promise<void> {
    const metadata = extractRequestMetadata(req);
    await this.auditService.record({
      actorType: "user",
      actorUserId: user.id,
      actorRole: user.role,
      companyId: user.companyId,
      action: "audit_log_read",
      resource: "audit_event",
      resourceId,
      ip: metadata.ip,
      userAgent: metadata.userAgent,
      result,
      requestId: metadata.requestId,
    });
  }
}
