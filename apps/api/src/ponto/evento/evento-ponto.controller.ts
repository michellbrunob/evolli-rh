import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
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
import { EventoPontoService } from "./evento-ponto.service";
import {
  ListarPontosQueryDto,
  RegistrarAjustePontoDto,
  RegistrarEventoPontoDto,
} from "../dto/ponto.dto";

/**
 * Marcações de ponto.
 *
 * **Sem `DELETE`, sem `PATCH`, sem `PUT`** — e isso não é omissão a corrigir
 * depois: o evento é imutável (Baseline Jornada V1, decisão 4), e a única
 * forma de corrigi-lo é `POST .../ajustes`. Adicionar aqui um verbo de
 * alteração falharia no banco de qualquer forma, porque `evolli_app` não tem
 * `UPDATE`/`DELETE` nestas tabelas.
 */
@ApiTags("ponto")
@Controller("pontos")
@UseGuards(SessionGuard)
export class EventoPontoController {
  constructor(private readonly service: EventoPontoService) {}

  @Post()
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("evento_ponto", "create")
  @ApiOperation({
    summary: "Registra marcacao manual de ponto para um vinculo da empresa",
  })
  async registrar(
    @Body() dto: RegistrarEventoPontoDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.registrar(dto, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }

  @Get()
  @UseGuards(AuthorizationGuard)
  @RequirePermission("evento_ponto", "read")
  @ApiOperation({
    summary:
      "Lista marcacoes da propria empresa; filtros por vinculo, competencia e tipo",
  })
  async listar(
    @Query() query: ListarPontosQueryDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.listar(query, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }

  @Get(":pontoId")
  @UseGuards(AuthorizationGuard)
  @RequirePermission("evento_ponto", "read")
  @ApiOperation({
    summary:
      "Detalha uma marcacao: registro original, ajustes e o valor efetivo",
  })
  async detalhar(
    @Param("pontoId", ParseUUIDPipe) pontoId: string,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.detalhar(pontoId, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }

  @Post(":pontoId/ajustes")
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("ajuste_ponto", "create")
  @ApiOperation({
    summary:
      "Corrige ou anula uma marcacao por registro posterior; o original permanece intacto",
  })
  async registrarAjuste(
    @Param("pontoId", ParseUUIDPipe) pontoId: string,
    @Body() dto: RegistrarAjustePontoDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.registrarAjuste(pontoId, dto, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }

  @Get(":pontoId/ajustes")
  @UseGuards(AuthorizationGuard)
  @RequirePermission("ajuste_ponto", "read")
  @ApiOperation({
    summary: "Historico de ajustes da marcacao; nenhuma linha e omitida",
  })
  async listarAjustes(
    @Param("pontoId", ParseUUIDPipe) pontoId: string,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.listarAjustes(pontoId, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }
}
