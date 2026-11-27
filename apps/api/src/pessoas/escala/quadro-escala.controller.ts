import { Controller, Get, Header, Query, Req, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { AccessUser } from "@prisma/client";
import { Request } from "express";
import { SessionGuard } from "../../auth/session/session.guard";
import { AuthorizationGuard } from "../../auth/authorization/authorization.guard";
import { RequirePermission } from "../../auth/authorization/require-permission.decorator";
import { CurrentUser } from "../../auth/session/current-user.decorator";
import { extractRequestMetadata } from "../../auth/request-metadata.util";
import { ConsultarQuadroDto } from "./quadro-escala.dto";
import { QuadroEscalaService } from "./quadro-escala.service";

/**
 * T215 — `GET /escala/quadro?inicio=&fim=`: o quadro "Escala de trabalho"
 * da empresa ativa (semana ou mês). Só leitura; `no-store`.
 */
@ApiTags("pessoas")
@Controller("escala/quadro")
@UseGuards(SessionGuard)
export class QuadroEscalaController {
  constructor(private readonly service: QuadroEscalaService) {}

  @Get()
  @UseGuards(AuthorizationGuard)
  @RequirePermission("escala_colaborador", "read")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Le o quadro de escala da empresa ativa" })
  async consultar(
    @Query() dto: ConsultarQuadroDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.consultar(dto, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }
}
