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
import { VinculoHorarioService } from "./vinculo-horario.service";
import {
  AtribuirJornadaDto,
  CriarVinculoHorarioDto,
  EncerrarVinculoHorarioDto,
  ListarVinculosHorarioQueryDto,
} from "../dto/horarios.dto";

/**
 * Vínculo histórico de uma tabela de horário a um colaborador, com vigência.
 *
 * Base de rota `horarios/vinculos` (não `horarios/:id`) para não colidir com o
 * detalhe de tabela. Registrado antes de `TabelaHorarioController` no módulo.
 *
 * **Sem `DELETE`** — a "troca" fecha o vínculo aberto (`.../encerrar`) e cria o
 * próximo; o histórico nunca é apagado (T037).
 */
@ApiTags("horarios")
@Controller("horarios/vinculos")
@UseGuards(SessionGuard)
export class VinculoHorarioController {
  constructor(private readonly service: VinculoHorarioService) {}

  @Post()
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("vinculo_horario", "create")
  @ApiOperation({
    summary:
      "Vincula uma tabela de horario a um colaborador da propria empresa, com vigencia (RH)",
  })
  async criar(
    @Body() dto: CriarVinculoHorarioDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.criar(dto, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }

  /**
   * T183 — atribui ou troca a jornada vigente do colaborador numa operação
   * só (encerra a vigente no novo início e cria a nova). Só RH, empresa da
   * sessão.
   */
  @Post("atribuicoes")
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("vinculo_horario", "create")
  @ApiOperation({
    summary:
      "Atribui ou troca a jornada vigente de um colaborador da propria empresa, a partir de uma data (RH)",
  })
  async atribuir(
    @Body() dto: AtribuirJornadaDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.atribuir(dto, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }

  @Get()
  @UseGuards(AuthorizationGuard)
  @RequirePermission("vinculo_horario", "read")
  @ApiOperation({
    summary:
      "Lista vinculos de horario da propria empresa; filtros por colaborador e tabela",
  })
  async listar(
    @Query() query: ListarVinculosHorarioQueryDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.listar(query, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }

  @Get(":vinculoId")
  @UseGuards(AuthorizationGuard)
  @RequirePermission("vinculo_horario", "read")
  @ApiOperation({ summary: "Detalha um vinculo de horario" })
  async detalhar(
    @Param("vinculoId", ParseUUIDPipe) vinculoId: string,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.detalhar(vinculoId, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }

  @Post(":vinculoId/encerrar")
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("vinculo_horario", "alter")
  @ApiOperation({
    summary:
      "Encerra a vigencia de um vinculo aberto (troca de horario); preserva o historico",
  })
  async encerrar(
    @Param("vinculoId", ParseUUIDPipe) vinculoId: string,
    @Body() dto: EncerrarVinculoHorarioDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.encerrar(vinculoId, dto, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }
}
