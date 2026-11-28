import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Put,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { AccessUser } from "@prisma/client";
import { Request } from "express";
import { AuthorizationGuard } from "../../auth/authorization/authorization.guard";
import { RequirePermission } from "../../auth/authorization/require-permission.decorator";
import { CsrfGuard } from "../../auth/csrf/csrf.guard";
import { extractRequestMetadata } from "../../auth/request-metadata.util";
import { CurrentUser } from "../../auth/session/current-user.decorator";
import { SessionGuard } from "../../auth/session/session.guard";
import { AcompanhamentoService } from "./acompanhamento.service";

const ctx = (actor: AccessUser, req: Request) => ({
  actor,
  metadata: extractRequestMetadata(req),
});

/**
 * T216 — o acompanhamento da NR-1 (etapas e plano de ação). Leitura com a
 * permissão de pesquisa; gravação com CSRF e a permissão de alterar.
 */
@ApiTags("pesquisas")
@Controller("pesquisas/:pesquisaId/modelo/acompanhamento")
@UseGuards(SessionGuard)
export class AcompanhamentoController {
  constructor(private readonly service: AcompanhamentoService) {}

  @Get()
  @UseGuards(AuthorizationGuard)
  @RequirePermission("pesquisa", "read")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Conformidade com a NR-1: etapas e plano" })
  obter(
    @Param("pesquisaId", ParseUUIDPipe) id: string,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.obter(id, ctx(actor, req));
  }

  @Put()
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("pesquisa", "alter")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Grava as etapas da NR-1 e o plano de ação" })
  gravar(
    @Param("pesquisaId", ParseUUIDPipe) id: string,
    @Body() corpo: Record<string, unknown>,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.gravar(id, corpo, ctx(actor, req));
  }
}
