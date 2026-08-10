import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { AccessUser } from "@prisma/client";
import { Request } from "express";
import { SessionGuard } from "../../auth/session/session.guard";
import { AuthorizationGuard } from "../../auth/authorization/authorization.guard";
import { RequirePermission } from "../../auth/authorization/require-permission.decorator";
import { CurrentUser } from "../../auth/session/current-user.decorator";
import { extractRequestMetadata } from "../../auth/request-metadata.util";
import { EventoPontoService } from "./evento-ponto.service";
import { ListarPontosDoVinculoQueryDto } from "../dto/ponto.dto";

/**
 * Leitura de ponto ancorada no vínculo — mesma forma que
 * `/v1/vinculos/:id/alocacoes` já usa na Fatia 2.
 *
 * Convive com o `VinculoController` do módulo de pessoas sob o mesmo prefixo
 * `vinculos` sem colisão de rota: aquele não declara `:vinculoId/pontos`. A
 * separação por módulo é deliberada — o dado de ponto é deste domínio e é
 * autorizado pela matriz deste domínio, não pela de pessoas.
 *
 * Só leitura: registrar continua sendo `POST /v1/pontos`, para que exista um
 * único caminho de escrita a auditar e testar.
 */
@ApiTags("ponto")
@Controller("vinculos")
@UseGuards(SessionGuard)
export class VinculoPontoController {
  constructor(private readonly service: EventoPontoService) {}

  @Get(":vinculoId/pontos")
  @UseGuards(AuthorizationGuard)
  @RequirePermission("evento_ponto", "read")
  @ApiOperation({
    summary: "Marcacoes do vinculo, com filtro opcional por competencia",
  })
  async listarPorVinculo(
    @Param("vinculoId", ParseUUIDPipe) vinculoId: string,
    @Query() query: ListarPontosDoVinculoQueryDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.listarPorVinculo(vinculoId, query, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }
}
