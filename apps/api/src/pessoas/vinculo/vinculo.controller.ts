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
import { VinculoService } from "./vinculo.service";
import { CriarVinculoDto, SituacaoEmDataQueryDto } from "../dto/pessoas.dto";

/** Sem rota `DELETE` e sem `PATCH`: vida funcional muda por movimentação. */
@ApiTags("pessoas")
@Controller("vinculos")
@UseGuards(SessionGuard)
export class VinculoController {
  constructor(private readonly service: VinculoService) {}

  @Post()
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("vinculo_funcional", "create")
  @ApiOperation({
    summary:
      "Cria novo vinculo (readmissao) para colaborador ja visivel no escopo",
  })
  async criar(
    @Body() dto: CriarVinculoDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.criar(dto, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }

  @Get(":vinculoId/alocacoes")
  @UseGuards(AuthorizationGuard)
  @RequirePermission("alocacao_organizacional", "read")
  @ApiOperation({
    summary: "Historico completo de alocacoes; nenhuma linha e omitida",
  })
  async listarAlocacoes(
    @Param("vinculoId", ParseUUIDPipe) vinculoId: string,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.listarAlocacoes(vinculoId, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }

  @Get(":vinculoId/situacao")
  @UseGuards(AuthorizationGuard)
  @RequirePermission("alocacao_organizacional", "read")
  @ApiOperation({
    summary:
      "Situacao organizacional numa data de referencia; nao projeta movimentacao nao efetivada",
  })
  async situacaoEmData(
    @Param("vinculoId", ParseUUIDPipe) vinculoId: string,
    @Query() query: SituacaoEmDataQueryDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.situacaoEmData(vinculoId, query.dataReferencia, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }

  @Get(":vinculoId/linha-do-tempo")
  @UseGuards(AuthorizationGuard)
  @RequirePermission("movimentacao_funcional", "read")
  @ApiOperation({
    summary: "Movimentacoes do vinculo, inclusive canceladas e retificadas",
  })
  async linhaDoTempo(
    @Param("vinculoId", ParseUUIDPipe) vinculoId: string,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.linhaDoTempo(vinculoId, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }
}
