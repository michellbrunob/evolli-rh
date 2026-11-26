import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
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
import {
  AlterarAusenciaDto,
  ListarAusenciasQueryDto,
  RecusarAusenciaDto,
  RegistrarAusenciaDto,
  SimularAusenciaQueryDto,
} from "./ausencias.dto";
import { AusenciasService } from "./ausencias.service";

/**
 * T215 — Férias e ausências da empresa ativa: lista com indicadores,
 * simulação, registro e decisões. `rh` e `dp` fazem tudo; o
 * `master_tecnico` só lê (com empresa ativa). Escritas com CSRF; respostas
 * `no-store`. Parâmetro nunca se chama `id` (o `AuthorizationGuard` o
 * trataria como conta de acesso).
 */
@ApiTags("pessoas")
@Controller("ausencias")
@UseGuards(SessionGuard)
export class AusenciasController {
  constructor(private readonly service: AusenciasService) {}

  @Get()
  @UseGuards(AuthorizationGuard)
  @RequirePermission("ausencia", "read")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Lista as ausências da empresa ativa" })
  async listar(
    @Query() query: ListarAusenciasQueryDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.listar(query, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }

  @Get("simulacao")
  @UseGuards(AuthorizationGuard)
  @RequirePermission("ausencia", "read")
  @Header("Cache-Control", "no-store")
  @ApiOperation({
    summary: "Simula o registro: dias, dias úteis, volta e saldo de férias",
  })
  async simular(
    @Query() query: SimularAusenciaQueryDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.simular(query, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }

  @Post()
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("ausencia", "create")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Registra uma ausência" })
  async registrar(
    @Body() dto: RegistrarAusenciaDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.registrar(dto, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }

  @Patch(":ausenciaId")
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("ausencia", "alter")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Edita a ausência (as mesmas regras do registro)" })
  async alterar(
    @Param("ausenciaId", ParseUUIDPipe) ausenciaId: string,
    @Body() dto: AlterarAusenciaDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.alterar(ausenciaId, dto, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }

  @Delete(":ausenciaId")
  @HttpCode(204)
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("ausencia", "alter")
  @Header("Cache-Control", "no-store")
  @ApiOperation({
    summary: "Exclui a ausência: sai de tudo; o registro fica marcado",
  })
  async excluir(
    @Param("ausenciaId", ParseUUIDPipe) ausenciaId: string,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ): Promise<void> {
    await this.service.excluir(ausenciaId, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }

  @Post(":ausenciaId/aprovar")
  @HttpCode(200)
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("ausencia", "alter")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Aprova a ausência pendente" })
  async aprovar(
    @Param("ausenciaId", ParseUUIDPipe) ausenciaId: string,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.decidir(ausenciaId, "aprovar", undefined, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }

  @Post(":ausenciaId/recusar")
  @HttpCode(200)
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("ausencia", "alter")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Recusa a ausência pendente" })
  async recusar(
    @Param("ausenciaId", ParseUUIDPipe) ausenciaId: string,
    @Body() dto: RecusarAusenciaDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.decidir(ausenciaId, "recusar", dto.motivo, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }

  @Post(":ausenciaId/cancelar")
  @HttpCode(200)
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("ausencia", "alter")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Cancela a ausência (nada é apagado)" })
  async cancelar(
    @Param("ausenciaId", ParseUUIDPipe) ausenciaId: string,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.decidir(ausenciaId, "cancelar", undefined, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }
}

/** T215 — o saldo de férias e o histórico de ausências da ficha. */
@ApiTags("pessoas")
@Controller("colaboradores/:colaboradorId/ferias")
@UseGuards(SessionGuard)
export class FeriasDoColaboradorController {
  constructor(private readonly service: AusenciasService) {}

  @Get()
  @UseGuards(AuthorizationGuard)
  @RequirePermission("ausencia", "read")
  @Header("Cache-Control", "no-store")
  @ApiOperation({
    summary: "Saldo de férias, próxima ausência e histórico do colaborador",
  })
  async consultar(
    @Param("colaboradorId", ParseUUIDPipe) colaboradorId: string,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.feriasDoColaborador(colaboradorId, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }
}
