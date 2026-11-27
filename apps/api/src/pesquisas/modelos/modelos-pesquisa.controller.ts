import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Put,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { AccessUser } from "@prisma/client";
import { IsIn, IsOptional } from "class-validator";
import { Request } from "express";
import { AuthorizationGuard } from "../../auth/authorization/authorization.guard";
import { RequirePermission } from "../../auth/authorization/require-permission.decorator";
import { CsrfGuard } from "../../auth/csrf/csrf.guard";
import { extractRequestMetadata } from "../../auth/request-metadata.util";
import { CurrentUser } from "../../auth/session/current-user.decorator";
import { SessionGuard } from "../../auth/session/session.guard";
import { CAMPOS_GRUPO, type CampoGrupo } from "../pesquisas.types";
import { ModelosPesquisaService } from "./modelos-pesquisa.service";

const ctx = (actor: AccessUser, req: Request) => ({
  actor,
  metadata: extractRequestMetadata(req),
});

export class ResultadoDoModeloQueryDto {
  @IsOptional()
  @IsIn(CAMPOS_GRUPO)
  campo?: CampoGrupo;
}

/**
 * T216 — resultados dos modelos com cálculo próprio e o acompanhamento da
 * NR-1. Mesmas permissões dos resultados (leitura de pesquisa), das
 * respostas individuais (`resposta_pesquisa`) e da edição (CSRF).
 */
@ApiTags("pesquisas")
@Controller("pesquisas/:pesquisaId/modelo")
@UseGuards(SessionGuard)
export class ModelosPesquisaController {
  constructor(private readonly service: ModelosPesquisaService) {}

  @Get("resultado")
  @UseGuards(AuthorizationGuard)
  @RequirePermission("pesquisa", "read")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Resultado próprio do modelo (time e recortes)" })
  resultado(
    @Param("pesquisaId", ParseUUIDPipe) id: string,
    @Query() q: ResultadoDoModeloQueryDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.resultado(id, q.campo ?? null, ctx(actor, req));
  }

  @Get("respostas/:respostaId")
  @UseGuards(AuthorizationGuard)
  @RequirePermission("resposta_pesquisa", "read")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Resultado do modelo de uma resposta" })
  individual(
    @Param("pesquisaId", ParseUUIDPipe) id: string,
    @Param("respostaId", ParseUUIDPipe) respostaId: string,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.individual(id, respostaId, ctx(actor, req));
  }

  @Get("acompanhamento")
  @UseGuards(AuthorizationGuard)
  @RequirePermission("pesquisa", "read")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Conformidade com a NR-1: etapas e plano" })
  acompanhamento(
    @Param("pesquisaId", ParseUUIDPipe) id: string,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.acompanhamento(id, ctx(actor, req));
  }

  @Put("acompanhamento")
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("pesquisa", "alter")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Grava as etapas da NR-1 e o plano de ação" })
  gravarAcompanhamento(
    @Param("pesquisaId", ParseUUIDPipe) id: string,
    @Body() corpo: Record<string, unknown>,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.gravarAcompanhamento(id, corpo, ctx(actor, req));
  }
}
