import {
  Controller,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { AccessUser } from "@prisma/client";
import { Request } from "express";
import { SessionGuard } from "../../auth/session/session.guard";
import { CsrfGuard } from "../../auth/csrf/csrf.guard";
import { AuthorizationGuard } from "../../auth/authorization/authorization.guard";
import { RequirePermission } from "../../auth/authorization/require-permission.decorator";
import { CurrentUser } from "../../auth/session/current-user.decorator";
import { extractRequestMetadata } from "../../auth/request-metadata.util";
import { DesativacaoColaboradorService } from "./desativacao-colaborador.service";

/**
 * T215 — a lixeira do "Editar colaborador": desativar e reativar a pessoa NA
 * EMPRESA ATIVA. Só `rh` e `dp` (`colaborador`/`alter`, a mesma matriz da
 * retificação: o master técnico só lê). Nunca apaga nada; idempotente;
 * `no-store`. Parâmetro nunca se chama `id` (o `AuthorizationGuard` o
 * trataria como conta de acesso).
 */
@ApiTags("pessoas")
@Controller("colaboradores/:colaboradorId")
@UseGuards(SessionGuard)
export class DesativacaoColaboradorController {
  constructor(private readonly service: DesativacaoColaboradorService) {}

  @Post("desativar")
  @HttpCode(200)
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("colaborador", "alter")
  @Header("Cache-Control", "no-store")
  @ApiOperation({
    summary:
      "Desativa o colaborador na empresa ativa (preserva tudo; reversivel)",
  })
  async desativar(
    @Param("colaboradorId", ParseUUIDPipe) colaboradorId: string,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.desativar(colaboradorId, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }

  @Post("reativar")
  @HttpCode(200)
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("colaborador", "alter")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Reativa o colaborador na empresa ativa" })
  async reativar(
    @Param("colaboradorId", ParseUUIDPipe) colaboradorId: string,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.reativar(colaboradorId, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }
}
