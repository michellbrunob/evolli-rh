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
import { ContatoColaboradorService } from "./contato-colaborador.service";
import { RegistrarContatosColaboradorDto } from "./contato-colaborador.dto";

/**
 * Contatos do colaborador (T169) — rotas PRÓPRIAS, aninhadas no colaborador.
 *
 * Nenhum valor de contato entra na listagem, no detalhe, na admissão, no Hub,
 * no portal ou na projeção do gestor: só estas duas rotas o leem e gravam.
 *
 * Sem `DELETE` e sem exportação: a ficha audita as duas, mas nenhuma existe
 * nesta fatia. Parâmetro nunca se chama `id` (o `AuthorizationGuard` o
 * trataria como conta de acesso). `no-store`: dado pessoal não fica em cache
 * de navegador nem de intermediário.
 */
@ApiTags("pessoas")
@Controller("colaboradores/:colaboradorId/contatos")
@UseGuards(SessionGuard)
export class ContatoColaboradorController {
  constructor(private readonly service: ContatoColaboradorService) {}

  @Get()
  @UseGuards(AuthorizationGuard)
  @RequirePermission("contato_colaborador", "read")
  @Header("Cache-Control", "no-store")
  @ApiOperation({
    summary:
      "Le os contatos do colaborador (e-mail pessoal, celular, telefone) na empresa do vinculo; leitura auditada",
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
  @RequirePermission("contato_colaborador", "alter")
  @Header("Cache-Control", "no-store")
  @ApiOperation({
    summary:
      "Grava os tres contatos do colaborador (cria ou edita); auditado com os campos afetados, nunca valores",
  })
  async registrar(
    @Param("colaboradorId", ParseUUIDPipe) colaboradorId: string,
    @Body() dto: RegistrarContatosColaboradorDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.registrar(colaboradorId, dto, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }
}
