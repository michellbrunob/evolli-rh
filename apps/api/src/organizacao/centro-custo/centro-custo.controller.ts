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
import { CentroCustoService } from "./centro-custo.service";
import {
  AtualizarNoOrganizacionalDto,
  CriarCentroCustoDto,
  ListarReferenciasQueryDto,
} from "../dto/organizacao.dto";

/** Sem rota `DELETE` (spec R6). Ver `EmpresaController` para o padrão. */
@ApiTags("organizacao")
@Controller("centros-de-custo")
@UseGuards(SessionGuard)
export class CentroCustoController {
  constructor(private readonly service: CentroCustoService) {}

  @Get()
  @UseGuards(AuthorizationGuard)
  @RequirePermission("centro_custo", "read")
  @ApiOperation({ summary: "Lista centros de custo do escopo do ator" })
  async listar(
    @Query() query: ListarReferenciasQueryDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.listar(query, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }

  @Get(":centroCustoId")
  @UseGuards(AuthorizationGuard)
  @RequirePermission("centro_custo", "read")
  @ApiOperation({ summary: "Detalha um centro de custo" })
  async detalhar(
    @Param("centroCustoId", ParseUUIDPipe) centroCustoId: string,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.detalhar(centroCustoId, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }

  @Post()
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("centro_custo", "create")
  @ApiOperation({ summary: "Cria centro de custo sob uma empresa" })
  async criar(
    @Body() dto: CriarCentroCustoDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.criar(dto, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }

  @Patch(":centroCustoId")
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("centro_custo", "alter")
  @ApiOperation({
    summary: "Altera o nome do centro de custo (codigo e imutavel)",
  })
  async atualizar(
    @Param("centroCustoId", ParseUUIDPipe) centroCustoId: string,
    @Body() dto: AtualizarNoOrganizacionalDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.atualizar(centroCustoId, dto, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }

  @Post(":centroCustoId/inativar")
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("centro_custo", "manage")
  @ApiOperation({ summary: "Inativa o centro de custo" })
  async inativar(
    @Param("centroCustoId", ParseUUIDPipe) centroCustoId: string,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.inativar(centroCustoId, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }

  @Post(":centroCustoId/reativar")
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("centro_custo", "manage")
  @ApiOperation({ summary: "Reativa o centro de custo; exige empresa ativa" })
  async reativar(
    @Param("centroCustoId", ParseUUIDPipe) centroCustoId: string,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.reativar(centroCustoId, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }
}
