import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
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
import { PoliticaFeriasDto } from "./politicas-ferias.dto";
import { PoliticasFeriasService } from "./politicas-ferias.service";

/**
 * T215 — Políticas de férias da empresa ativa (como a referência). `rh` e
 * `dp` criam, alteram, desativam e reativam; o `master_tecnico` só lê.
 * Escritas com CSRF; respostas `no-store`. Nada se apaga.
 */
@ApiTags("pessoas")
@Controller("politicas-ferias")
@UseGuards(SessionGuard)
export class PoliticasFeriasController {
  constructor(private readonly service: PoliticasFeriasService) {}

  @Get()
  @UseGuards(AuthorizationGuard)
  @RequirePermission("ausencia", "read")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Políticas de férias e quem fica sem política" })
  async listar(@CurrentUser() actor: AccessUser, @Req() req: Request) {
    return this.service.listar({
      actor,
      metadata: extractRequestMetadata(req),
    });
  }

  @Get(":politicaId")
  @UseGuards(AuthorizationGuard)
  @RequirePermission("ausencia", "read")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Uma política de férias (para editar ou duplicar)" })
  async obter(
    @Param("politicaId", ParseUUIDPipe) politicaId: string,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.obter(politicaId, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }

  @Post()
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("ausencia", "alter")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Cria uma política de férias" })
  async criar(
    @Body() dto: PoliticaFeriasDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.criar(dto, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }

  @Put(":politicaId")
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("ausencia", "alter")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Altera uma política de férias" })
  async alterar(
    @Param("politicaId", ParseUUIDPipe) politicaId: string,
    @Body() dto: PoliticaFeriasDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.alterar(politicaId, dto, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }

  @Post(":politicaId/desativar")
  @HttpCode(200)
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("ausencia", "alter")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Desativa a política (nada é apagado)" })
  async desativar(
    @Param("politicaId", ParseUUIDPipe) politicaId: string,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.mudarSituacao(politicaId, false, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }

  @Post(":politicaId/reativar")
  @HttpCode(200)
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("ausencia", "alter")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Reativa a política" })
  async reativar(
    @Param("politicaId", ParseUUIDPipe) politicaId: string,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.mudarSituacao(politicaId, true, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }
}
