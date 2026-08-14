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
import { SolicitacaoDocumentoService } from "./solicitacao-documento.service";
import {
  CriarSolicitacaoDocumentoDto,
  ListarSolicitacoesDocumentoQueryDto,
} from "../dto/documentos.dto";

/**
 * Solicitação de documento. Solicitar e consultar; sem alteração e sem
 * exclusão. Param `:solicitacaoId`, nunca `id`.
 */
@ApiTags("documentos")
@Controller("solicitacoes-documento")
@UseGuards(SessionGuard)
export class SolicitacaoDocumentoController {
  constructor(private readonly service: SolicitacaoDocumentoService) {}

  @Get()
  @UseGuards(AuthorizationGuard)
  @RequirePermission("solicitacao_documento", "read")
  @ApiOperation({
    summary: "Lista solicitacoes de documento da empresa do ator",
  })
  async listar(
    @Query() query: ListarSolicitacoesDocumentoQueryDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.listar(query, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }

  @Get(":solicitacaoId")
  @UseGuards(AuthorizationGuard)
  @RequirePermission("solicitacao_documento", "read")
  @ApiOperation({ summary: "Detalha uma solicitacao de documento" })
  async detalhar(
    @Param("solicitacaoId", ParseUUIDPipe) solicitacaoId: string,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.detalhar(solicitacaoId, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }

  @Post()
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("solicitacao_documento", "create")
  @ApiOperation({
    summary: "Solicita um documento a um colaborador (pedido; sem conteudo)",
  })
  async solicitar(
    @Body() dto: CriarSolicitacaoDocumentoDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.solicitar(dto, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }
}
