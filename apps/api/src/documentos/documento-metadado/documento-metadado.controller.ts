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
import { DocumentoMetadadoService } from "./documento-metadado.service";
import {
  CriarDocumentoMetadadoDto,
  ListarDocumentosMetadadoQueryDto,
  SubstituirDocumentoMetadadoDto,
} from "../dto/documentos.dto";

/**
 * Metadado do documento — **sem conteúdo** (ADR 0011, decisão 1). Não há rota de
 * upload nem de download: elas são bloqueadas por §13 (Nível 2), e não existem
 * aqui por construção. Sem `DELETE`: correção é substituição, que preserva
 * histórico (decisão 8). Param `:documentoId`, nunca `id`.
 */
@ApiTags("documentos")
@Controller("documentos")
@UseGuards(SessionGuard)
export class DocumentoMetadadoController {
  constructor(private readonly service: DocumentoMetadadoService) {}

  @Get()
  @UseGuards(AuthorizationGuard)
  @RequirePermission("documento_metadado", "read")
  @ApiOperation({ summary: "Lista metadados de documento da empresa do ator" })
  async listar(
    @Query() query: ListarDocumentosMetadadoQueryDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.listar(query, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }

  @Get(":documentoId")
  @UseGuards(AuthorizationGuard)
  @RequirePermission("documento_metadado", "read")
  @ApiOperation({
    summary: "Detalha o metadado de um documento (sem conteudo)",
  })
  async detalhar(
    @Param("documentoId", ParseUUIDPipe) documentoId: string,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.detalhar(documentoId, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }

  @Post()
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("documento_metadado", "create")
  @ApiOperation({
    summary:
      "Registra o metadado de um documento para um colaborador (sem conteudo)",
  })
  async criar(
    @Body() dto: CriarDocumentoMetadadoDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.criar(dto, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }

  @Post(":documentoId/substituicoes")
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("documento_metadado", "alter")
  @ApiOperation({
    summary:
      "Substitui o metadado (corrige o tipo) preservando o historico; nao apaga",
  })
  async substituir(
    @Param("documentoId", ParseUUIDPipe) documentoId: string,
    @Body() dto: SubstituirDocumentoMetadadoDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.substituir(documentoId, dto, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }
}
