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
import { AreaService } from "./area.service";
import {
  AtualizarNoOrganizacionalDto,
  CriarAreaDto,
  ListarAreasQueryDto,
} from "../dto/organizacao.dto";

/** Sem rota `DELETE` (spec R6). Ver `EmpresaController` para o padrão. */
@ApiTags("organizacao")
@Controller("areas")
@UseGuards(SessionGuard)
export class AreaController {
  constructor(private readonly service: AreaService) {}

  @Get()
  @UseGuards(AuthorizationGuard)
  @RequirePermission("area", "read")
  @ApiOperation({ summary: "Lista areas do escopo do ator" })
  async listar(
    @Query() query: ListarAreasQueryDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.listar(query, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }

  @Get(":areaId")
  @UseGuards(AuthorizationGuard)
  @RequirePermission("area", "read")
  @ApiOperation({ summary: "Detalha uma area" })
  async detalhar(
    @Param("areaId", ParseUUIDPipe) areaId: string,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.detalhar(areaId, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }

  @Post()
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("area", "create")
  @ApiOperation({ summary: "Cria area como subdivisao de um departamento" })
  async criar(
    @Body() dto: CriarAreaDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.criar(dto, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }

  @Patch(":areaId")
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("area", "alter")
  @ApiOperation({ summary: "Altera o nome da area (codigo e imutavel)" })
  async atualizar(
    @Param("areaId", ParseUUIDPipe) areaId: string,
    @Body() dto: AtualizarNoOrganizacionalDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.atualizar(areaId, dto, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }

  @Post(":areaId/inativar")
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("area", "manage")
  @ApiOperation({ summary: "Inativa a area" })
  async inativar(
    @Param("areaId", ParseUUIDPipe) areaId: string,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.inativar(areaId, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }

  @Post(":areaId/reativar")
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("area", "manage")
  @ApiOperation({ summary: "Reativa a area; exige departamento ativo" })
  async reativar(
    @Param("areaId", ParseUUIDPipe) areaId: string,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.reativar(areaId, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }
}
