import {
  Body,
  Controller,
  Delete,
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
import { GravarAlteracaoSalarialDto } from "./historico-salarial.dto";
import { HistoricoSalarialService } from "./historico-salarial.service";

/**
 * T215 — Salários: a linha do tempo salarial do vínculo principal (aba
 * Salários da ficha). Mesma permissão do contrato (`contrato_vinculo`).
 * Toda resposta devolve a linha do tempo inteira, já reorganizada.
 *
 * Parâmetros nunca se chamam `id` (o `AuthorizationGuard` o trataria como
 * conta de acesso). `no-store`.
 */
@ApiTags("pessoas")
@Controller("colaboradores/:colaboradorId/salarios")
@UseGuards(SessionGuard)
export class HistoricoSalarialController {
  constructor(private readonly service: HistoricoSalarialService) {}

  @Get()
  @UseGuards(AuthorizationGuard)
  @RequirePermission("contrato_vinculo", "read")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Le a linha do tempo salarial do colaborador" })
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
  @RequirePermission("contrato_vinculo", "alter")
  @Header("Cache-Control", "no-store")
  @ApiOperation({
    summary: "Registra uma alteracao salarial; auditado sem valores",
  })
  async registrar(
    @Param("colaboradorId", ParseUUIDPipe) colaboradorId: string,
    @Body() dto: GravarAlteracaoSalarialDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.registrar(colaboradorId, dto, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }

  @Put(":alteracaoId")
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("contrato_vinculo", "alter")
  @Header("Cache-Control", "no-store")
  @ApiOperation({
    summary: "Edita uma alteracao salarial; auditado sem valores",
  })
  async atualizar(
    @Param("colaboradorId", ParseUUIDPipe) colaboradorId: string,
    @Param("alteracaoId", ParseUUIDPipe) alteracaoId: string,
    @Body() dto: GravarAlteracaoSalarialDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.atualizar(colaboradorId, alteracaoId, dto, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }

  @Delete(":alteracaoId")
  @HttpCode(200)
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("contrato_vinculo", "alter")
  @Header("Cache-Control", "no-store")
  @ApiOperation({
    summary:
      "Remove (logicamente) uma alteracao salarial; a da admissao nao se remove",
  })
  async remover(
    @Param("colaboradorId", ParseUUIDPipe) colaboradorId: string,
    @Param("alteracaoId", ParseUUIDPipe) alteracaoId: string,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.remover(colaboradorId, alteracaoId, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }
}
