import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { TipoDocumentoService } from "./tipo-documento.service";
import {
  AlterarTipoDocumentoDto,
  CriarTipoDocumentoDto,
  ListarTiposDocumentoQueryDto,
} from "../dto/documentos.dto";

/**
 * Catálogo de tipos documentais (ADR 0011, Emenda 1). Sem rota `DELETE`: tipo
 * não é excluído. Param de rota nunca se chama `id` (o `AuthorizationGuard`
 * resolveria `request.params.id` como `AccessUser` alvo) — usa-se
 * `:tipoDocumentoId`, sempre o id técnico.
 */
@ApiTags("documentos")
@Controller("tipos-documento")
@UseGuards(SessionGuard)
export class TipoDocumentoController {
  constructor(private readonly service: TipoDocumentoService) {}

  @Get()
  @UseGuards(AuthorizationGuard)
  @RequirePermission("tipo_documento", "read")
  @ApiOperation({ summary: "Lista tipos documentais da empresa do ator" })
  async listar(
    @Query() query: ListarTiposDocumentoQueryDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.listar(query, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }

  @Get(":tipoDocumentoId")
  @UseGuards(AuthorizationGuard)
  @RequirePermission("tipo_documento", "read")
  @ApiOperation({ summary: "Detalha um tipo documental" })
  async detalhar(
    @Param("tipoDocumentoId", ParseUUIDPipe) tipoDocumentoId: string,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.detalhar(tipoDocumentoId, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }

  @Post()
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("tipo_documento", "create")
  @ApiOperation({
    summary:
      "Cria tipo documental (apenas RH, com aprovacao de DPO registrada). Inicia restrito",
  })
  async criar(
    @Body() dto: CriarTipoDocumentoDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.criar(dto, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }

  @Patch(":tipoDocumentoId")
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("tipo_documento", "alter")
  @ApiOperation({
    summary:
      "Altera nome do tipo documental (apenas RH, com aprovacao de DPO registrada)",
  })
  async alterar(
    @Param("tipoDocumentoId", ParseUUIDPipe) tipoDocumentoId: string,
    @Body() dto: AlterarTipoDocumentoDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.alterar(tipoDocumentoId, dto, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }
}
