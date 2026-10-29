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
import { UnidadeOrganizacionalService } from "./unidade-organizacional.service";
import {
  AtualizarNoOrganizacionalDto,
  CriarUnidadeOrganizacionalDto,
  ListarReferenciasQueryDto,
} from "../dto/organizacao.dto";

/** Sem rota `DELETE` (spec R6). Ver `EmpresaController` para o padrão. */
@ApiTags("organizacao")
@Controller("unidades-organizacionais")
@UseGuards(SessionGuard)
export class UnidadeOrganizacionalController {
  constructor(private readonly service: UnidadeOrganizacionalService) {}

  @Get()
  @UseGuards(AuthorizationGuard)
  @RequirePermission("unidade_organizacional", "read")
  @ApiOperation({ summary: "Lista unidades organizacionais do escopo do ator" })
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

  @Get(":unidadeId")
  @UseGuards(AuthorizationGuard)
  @RequirePermission("unidade_organizacional", "read")
  @ApiOperation({ summary: "Detalha uma unidade organizacional" })
  async detalhar(
    @Param("unidadeId", ParseUUIDPipe) unidadeId: string,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.detalhar(unidadeId, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }

  @Post()
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("unidade_organizacional", "create")
  @ApiOperation({ summary: "Cria unidade organizacional sob uma empresa" })
  async criar(
    @Body() dto: CriarUnidadeOrganizacionalDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.criar(dto, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }

  @Patch(":unidadeId")
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("unidade_organizacional", "alter")
  @ApiOperation({ summary: "Altera o nome da unidade (codigo e imutavel)" })
  async atualizar(
    @Param("unidadeId", ParseUUIDPipe) unidadeId: string,
    @Body() dto: AtualizarNoOrganizacionalDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.atualizar(unidadeId, dto, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }

  @Post(":unidadeId/inativar")
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("unidade_organizacional", "manage")
  @ApiOperation({
    summary: "Inativa a unidade; recusa se houver equipe ativa vinculada",
  })
  async inativar(
    @Param("unidadeId", ParseUUIDPipe) unidadeId: string,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.inativar(unidadeId, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }

  @Post(":unidadeId/reativar")
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("unidade_organizacional", "manage")
  @ApiOperation({ summary: "Reativa a unidade; exige empresa ativa" })
  async reativar(
    @Param("unidadeId", ParseUUIDPipe) unidadeId: string,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.reativar(unidadeId, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }
}
