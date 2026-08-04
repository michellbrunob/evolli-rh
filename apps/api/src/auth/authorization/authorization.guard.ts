import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Request } from "express";
import { AccessRole } from "@prisma/client";
import "../session/session-request.types";
import { PrismaService } from "../../database/prisma.service";
import { evaluatePermission } from "./rbac.evaluator";
import { AuthorizationTarget } from "./permission.types";
import {
  PERMISSION_METADATA_KEY,
  RequiredPermission,
} from "./require-permission.decorator";

declare module "express" {
  interface Request {
    /** Populado pelo guard quando a permissão exige alvo (`:id` de rota). */
    authorizationTargetUser?: import("@prisma/client").AccessUser;
  }
}

/**
 * Resolve o alvo (usuário referenciado por `:id`, quando existir) e chama o
 * avaliador RBAC/ABAC (spec §5). Sempre nega por padrão — sem metadata de
 * permissão declarada, a rota é bloqueada, não liberada.
 */
@Injectable()
export class AuthorizationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.get<RequiredPermission | undefined>(
      PERMISSION_METADATA_KEY,
      context.getHandler(),
    );

    if (!required) {
      return false;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const subjectUser = request.authUser;
    if (!subjectUser) {
      throw new ForbiddenException();
    }

    const target: AuthorizationTarget = {
      resource: required.resource,
      action: required.action,
    };

    const rawTargetId = request.params?.id;
    const targetId = typeof rawTargetId === "string" ? rawTargetId : undefined;
    if (targetId) {
      const targetUser = await this.prisma.accessUser.findUnique({
        where: { id: targetId },
      });
      if (!targetUser) {
        throw new NotFoundException();
      }
      request.authorizationTargetUser = targetUser;
      target.targetUserId = targetUser.id;
      target.targetCompanyId = targetUser.companyId;
    }

    if (required.resource === "user_role") {
      const body = request.body as { role?: unknown; companyId?: unknown };
      if (typeof body?.role === "string") {
        target.targetNewRole = body.role as AccessRole;
      }
      if (required.action === "create" && typeof body?.companyId === "string") {
        // Criação não tem :id de rota — escopo vem do corpo da requisição.
        target.targetCompanyId = body.companyId;
      }
    }

    const allowed = evaluatePermission(
      {
        userId: subjectUser.id,
        role: subjectUser.role,
        companyId: subjectUser.companyId,
      },
      target,
    );

    if (!allowed) {
      throw new ForbiddenException();
    }

    return true;
  }
}
