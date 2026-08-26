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
import { TabelaHorarioService } from "./tabela-horario.service";
import {
  CriarTabelaHorarioDto,
  ListarTabelasHorarioQueryDto,
} from "../dto/horarios.dto";

/**
 * Tabelas de horário (grade semanal reutilizável por empresa).
 *
 * **Sem `DELETE`, sem `PATCH` de definição** — e isso não é omissão: a
 * definição (períodos) é imutável (revisão = nova tabela), e não há exclusão
 * física (T037). O único estado mutável é `ativo`, alterado por
 * `.../desativar` e `.../reativar`.
 */
@ApiTags("horarios")
@Controller("horarios")
@UseGuards(SessionGuard)
export class TabelaHorarioController {
  constructor(private readonly service: TabelaHorarioService) {}

  @Post()
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("tabela_horario", "create")
  @ApiOperation({
    summary: "Cria uma tabela de horario semanal na propria empresa (RH)",
  })
  async criar(
    @Body() dto: CriarTabelaHorarioDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.criar(dto, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }

  @Get()
  @UseGuards(AuthorizationGuard)
  @RequirePermission("tabela_horario", "read")
  @ApiOperation({
    summary: "Lista tabelas de horario da propria empresa; filtro por ativo",
  })
  async listar(
    @Query() query: ListarTabelasHorarioQueryDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.listar(query, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }

  @Get(":tabelaId")
  @UseGuards(AuthorizationGuard)
  @RequirePermission("tabela_horario", "read")
  @ApiOperation({ summary: "Detalha uma tabela de horario e seus periodos" })
  async detalhar(
    @Param("tabelaId", ParseUUIDPipe) tabelaId: string,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.detalhar(tabelaId, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }

  @Post(":tabelaId/desativar")
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("tabela_horario", "alter")
  @ApiOperation({
    summary:
      "Desativa logicamente uma tabela (nao pode mais ser vinculada); sem exclusao fisica",
  })
  async desativar(
    @Param("tabelaId", ParseUUIDPipe) tabelaId: string,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.desativar(tabelaId, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }

  @Post(":tabelaId/reativar")
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("tabela_horario", "alter")
  @ApiOperation({ summary: "Reativa uma tabela de horario desativada" })
  async reativar(
    @Param("tabelaId", ParseUUIDPipe) tabelaId: string,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.reativar(tabelaId, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }
}
