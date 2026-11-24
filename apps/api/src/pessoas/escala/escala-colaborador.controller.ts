import {
  Body,
  Controller,
  Get,
  Header,
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
import { DefinirEscalaDto, EncerrarEscalaDto } from "./escala-colaborador.dto";
import { EscalaColaboradorService } from "./escala-colaborador.service";

/**
 * T215 — Escala do colaborador (aba Escala da ficha):
 *
 * - `GET /colaboradores/:colaboradorId/escalas`: as escalas, da mais nova à
 *   mais antiga, a admissão e a escala do contrato;
 * - `POST /colaboradores/:colaboradorId/escalas`: define (ou troca) o
 *   padrão a partir de uma data;
 * - `POST /colaboradores/:colaboradorId/escalas/:escalaId/encerrar`.
 *
 * Toda gravação devolve a lista inteira. Parâmetros nunca se chamam `id` (o
 * `AuthorizationGuard` o trataria como conta de acesso). `no-store`.
 */
@ApiTags("pessoas")
@Controller("colaboradores/:colaboradorId/escalas")
@UseGuards(SessionGuard)
export class EscalaColaboradorController {
  constructor(private readonly service: EscalaColaboradorService) {}

  @Get()
  @UseGuards(AuthorizationGuard)
  @RequirePermission("escala_colaborador", "read")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Le as escalas do colaborador" })
  async consultar(
    @Param("colaboradorId", ParseUUIDPipe) colaboradorId: string,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.consultar(colaboradorId, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }

  @Post()
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("escala_colaborador", "create")
  @Header("Cache-Control", "no-store")
  @ApiOperation({
    summary: "Define ou troca o padrao de escala a partir de uma data",
  })
  async definir(
    @Param("colaboradorId", ParseUUIDPipe) colaboradorId: string,
    @Body() dto: DefinirEscalaDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.definir(colaboradorId, dto, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }

  @Post(":escalaId/encerrar")
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("escala_colaborador", "alter")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Encerra a escala aberta; preserva o historico" })
  async encerrar(
    @Param("colaboradorId", ParseUUIDPipe) colaboradorId: string,
    @Param("escalaId", ParseUUIDPipe) escalaId: string,
    @Body() dto: EncerrarEscalaDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.encerrar(colaboradorId, escalaId, dto, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }
}
