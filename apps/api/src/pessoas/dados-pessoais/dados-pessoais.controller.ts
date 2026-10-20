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
import { DadosPessoaisColaboradorService } from "./dados-pessoais.service";
import { RegistrarDadosPessoaisDto } from "./dados-pessoais.dto";

/**
 * Dados pessoais e endereço do colaborador (T177, Módulo 1) — rotas PRÓPRIAS,
 * aninhadas no colaborador, no mesmo desenho dos contatos (T169).
 *
 * Nenhum valor destas categorias entra na listagem, no detalhe do colaborador,
 * no Hub, no portal ou na projeção do gestor: só estas rotas e a resposta da
 * admissão que os criou. Sem `DELETE` e sem exportação. Parâmetro nunca se
 * chama `id` (o `AuthorizationGuard` o trataria como conta de acesso).
 * `no-store`: dado pessoal não fica em cache.
 */
@ApiTags("pessoas")
@Controller("colaboradores/:colaboradorId/dados-pessoais")
@UseGuards(SessionGuard)
export class DadosPessoaisColaboradorController {
  constructor(private readonly service: DadosPessoaisColaboradorService) {}

  @Get()
  @UseGuards(AuthorizationGuard)
  @RequirePermission("dados_pessoais_colaborador", "read")
  @Header("Cache-Control", "no-store")
  @ApiOperation({
    summary:
      "Le os dados pessoais e o endereco do colaborador na empresa ativa; leitura auditada",
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
  @RequirePermission("dados_pessoais_colaborador", "alter")
  @Header("Cache-Control", "no-store")
  @ApiOperation({
    summary:
      "Grava os dados pessoais e/ou o endereco do colaborador (cada bloco substitui o registro); auditado com os campos afetados, nunca valores",
  })
  async registrar(
    @Param("colaboradorId", ParseUUIDPipe) colaboradorId: string,
    @Body() dto: RegistrarDadosPessoaisDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.registrar(colaboradorId, dto, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }
}
