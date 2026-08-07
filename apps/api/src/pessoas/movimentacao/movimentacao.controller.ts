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
import { MovimentacaoService } from "./movimentacao.service";
import {
  ListarMovimentacoesQueryDto,
  RegistrarMovimentacaoDto,
  RetificarMovimentacaoDto,
} from "../dto/pessoas.dto";

/**
 * Sem `/aprovar` e sem `/rejeitar`: não há workflow de aprovação nesta V1
 * (Baseline V1, item 7). Sem `DELETE` e sem `PATCH`: movimentação efetivada é
 * imutável, e a correção é `/retificar` (RI-M1, RI-M2).
 */
@ApiTags("pessoas")
@Controller("movimentacoes")
@UseGuards(SessionGuard)
export class MovimentacaoController {
  constructor(private readonly service: MovimentacaoService) {}

  @Get()
  @UseGuards(AuthorizationGuard)
  @RequirePermission("movimentacao_funcional", "read")
  @ApiOperation({ summary: "Lista movimentacoes da empresa do ator" })
  async listar(
    @Query() query: ListarMovimentacoesQueryDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.listar(query, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }

  @Post()
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("movimentacao_funcional", "create")
  @ApiOperation({
    summary:
      "Registra movimentacao sobre vinculo existente; admissao nasce com o vinculo",
  })
  async registrar(
    @Body() dto: RegistrarMovimentacaoDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.registrar(dto, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }

  @Post(":movimentacaoId/cancelar")
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("movimentacao_funcional", "manage")
  @ApiOperation({ summary: "Cancela movimentacao ainda nao efetivada" })
  async cancelar(
    @Param("movimentacaoId", ParseUUIDPipe) movimentacaoId: string,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.cancelar(movimentacaoId, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }

  @Post(":movimentacaoId/efetivar")
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("movimentacao_funcional", "manage")
  @ApiOperation({
    summary:
      "Efetiva a movimentacao: altera vinculo e sucede a alocacao organizacional",
  })
  async efetivar(
    @Param("movimentacaoId", ParseUUIDPipe) movimentacaoId: string,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.efetivar(movimentacaoId, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }

  @Post(":movimentacaoId/retificar")
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("movimentacao_funcional", "manage")
  @ApiOperation({
    summary:
      "Retifica movimentacao efetivada: cria correcao e preserva a original",
  })
  async retificar(
    @Param("movimentacaoId", ParseUUIDPipe) movimentacaoId: string,
    @Body() dto: RetificarMovimentacaoDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.retificar(movimentacaoId, dto, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }
}
