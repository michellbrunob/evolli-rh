import {
  Body,
  Controller,
  Header,
  HttpCode,
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
import { DiaDoQuadroDto, GravarDiaDto } from "./escala-dia.dto";
import { EscalaDiaService } from "./escala-dia.service";

/**
 * T215 — o dia do quadro "Escala de trabalho", no rascunho:
 *
 * - `PUT /escala/dias`: grava o dia (menu da célula e painel do dia);
 * - `POST /escala/dias/limpar`: desfaz a mudança do dia (volta ao padrão).
 *
 * `rh` e `dp` na empresa ativa; `no-store`.
 */
@ApiTags("pessoas")
@Controller("escala/dias")
@UseGuards(SessionGuard)
export class EscalaDiaController {
  constructor(private readonly service: EscalaDiaService) {}

  @Put()
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("escala_colaborador", "alter")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Grava o dia do quadro no rascunho" })
  async gravar(
    @Body() dto: GravarDiaDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.gravar(dto, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }

  @Post("limpar")
  @HttpCode(200)
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("escala_colaborador", "alter")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Desfaz a mudança do dia no rascunho" })
  async limpar(
    @Body() dto: DiaDoQuadroDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.limpar(dto, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }
}
