import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Put,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { AccessUser } from "@prisma/client";
import { IsObject } from "class-validator";
import { Request } from "express";
import { SessionGuard } from "../../auth/session/session.guard";
import { CsrfGuard } from "../../auth/csrf/csrf.guard";
import { AuthorizationGuard } from "../../auth/authorization/authorization.guard";
import { RequirePermission } from "../../auth/authorization/require-permission.decorator";
import { CurrentUser } from "../../auth/session/current-user.decorator";
import { extractRequestMetadata } from "../../auth/request-metadata.util";
import { RascunhoAdmissaoService } from "./rascunho-admissao.service";

/** O corpo: só `dados`; o conteúdo é filtrado campo a campo no serviço. */
export class SalvarRascunhoAdmissaoDto {
  @IsObject()
  dados!: Record<string, unknown>;
}

/**
 * T209 — rascunho da Nova admissão da própria conta, na empresa ativa.
 * Rota própria (fora de `colaboradores/:colaboradorId`): rascunho não é
 * colaborador e não cria nenhum.
 */
@ApiTags("pessoas")
@Controller("admissoes/rascunho")
@UseGuards(SessionGuard)
export class RascunhoAdmissaoController {
  constructor(private readonly service: RascunhoAdmissaoService) {}

  @Get()
  @UseGuards(AuthorizationGuard)
  @RequirePermission("colaborador", "create")
  @ApiOperation({ summary: "Rascunho da Nova admissao da propria conta" })
  obter(@CurrentUser() actor: AccessUser, @Req() req: Request) {
    return this.service.obter({ actor, metadata: extractRequestMetadata(req) });
  }

  @Put()
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("colaborador", "create")
  @ApiOperation({
    summary: "Salva o rascunho da Nova admissao (nao admite ninguem)",
  })
  salvar(
    @Body() dto: SalvarRascunhoAdmissaoDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.salvar(dto.dados, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }

  @Delete()
  @HttpCode(204)
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("colaborador", "create")
  @ApiOperation({ summary: "Descarta o rascunho da Nova admissao" })
  async descartar(@CurrentUser() actor: AccessUser, @Req() req: Request) {
    await this.service.descartar({
      actor,
      metadata: extractRequestMetadata(req),
    });
  }
}
