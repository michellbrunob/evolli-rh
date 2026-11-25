import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
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
import {
  CriarVisaoDto,
  EscalaVisoesService,
  RenomearVisaoDto,
} from "./escala-visoes.service";

/**
 * T215 — Visões salvas do quadro da escala (só da conta, na empresa ativa):
 *
 * - `GET /escala/visoes` e `POST /escala/visoes`;
 * - `PATCH /escala/visoes/:visaoId` (renomear) e `DELETE`.
 *
 * Quem lê o quadro guarda as próprias visões. Toda resposta traz a lista
 * inteira; `no-store`.
 */
@ApiTags("pessoas")
@Controller("escala/visoes")
@UseGuards(SessionGuard)
export class EscalaVisoesController {
  constructor(private readonly service: EscalaVisoesService) {}

  private ctx(actor: AccessUser, req: Request) {
    return { actor, metadata: extractRequestMetadata(req) };
  }

  @Get()
  @UseGuards(AuthorizationGuard)
  @RequirePermission("escala_colaborador", "read")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Lista as visões salvas do quadro da escala" })
  async consultar(@CurrentUser() actor: AccessUser, @Req() req: Request) {
    return this.service.consultar(this.ctx(actor, req));
  }

  @Post()
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("escala_colaborador", "read")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Salva os filtros do quadro como visão" })
  async criar(
    @Body() dto: CriarVisaoDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.criar(dto, this.ctx(actor, req));
  }

  @Patch(":visaoId")
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("escala_colaborador", "read")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Renomeia uma visão salva" })
  async renomear(
    @Param("visaoId", ParseUUIDPipe) visaoId: string,
    @Body() dto: RenomearVisaoDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.renomear(visaoId, dto, this.ctx(actor, req));
  }

  @Delete(":visaoId")
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("escala_colaborador", "read")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Remove uma visão salva" })
  async remover(
    @Param("visaoId", ParseUUIDPipe) visaoId: string,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.remover(visaoId, this.ctx(actor, req));
  }
}
