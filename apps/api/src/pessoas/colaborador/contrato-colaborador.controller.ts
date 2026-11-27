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
import { SessionGuard } from "../../auth/session/session.guard";
import { CsrfGuard } from "../../auth/csrf/csrf.guard";
import { AuthorizationGuard } from "../../auth/authorization/authorization.guard";
import { RequirePermission } from "../../auth/authorization/require-permission.decorator";
import { CurrentUser } from "../../auth/session/current-user.decorator";
import { extractRequestMetadata } from "../../auth/request-metadata.util";
import { ContratoColaboradorService } from "./contrato-colaborador.service";
import { RegistrarContratoColaboradorDto } from "./contrato-colaborador.dto";

/**
 * T215 — o contrato do vínculo principal na edição do colaborador ("Dados
 * profissionais"): nível, gestor direto, jornada semanal, escala, salário
 * bruto, conselho e registro, dependentes para IRRF, pensão e a matrícula.
 *
 * Rotas próprias, aninhadas no colaborador: o salário não sai pelas rotas do
 * vínculo nem do detalhe. Sem `DELETE`. Parâmetro nunca se chama `id` (o
 * `AuthorizationGuard` o trataria como conta de acesso). `no-store`.
 */
@ApiTags("pessoas")
@Controller("colaboradores/:colaboradorId/contrato")
@UseGuards(SessionGuard)
export class ContratoColaboradorController {
  constructor(private readonly service: ContratoColaboradorService) {}

  @Get()
  @UseGuards(AuthorizationGuard)
  @RequirePermission("contrato_vinculo", "read")
  @Header("Cache-Control", "no-store")
  @ApiOperation({
    summary:
      "Le o contrato do vinculo principal do colaborador na empresa ativa",
  })
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

  @Put()
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("contrato_vinculo", "alter")
  @Header("Cache-Control", "no-store")
  @ApiOperation({
    summary:
      "Grava o contrato do vinculo principal (substitui o bloco) e a matricula; auditado sem valores",
  })
  async registrar(
    @Param("colaboradorId", ParseUUIDPipe) colaboradorId: string,
    @Body() dto: RegistrarContratoColaboradorDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.registrar(colaboradorId, dto, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }
}
