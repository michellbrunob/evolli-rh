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
import { DepartamentoService } from "./departamento.service";
import {
  AtualizarNoOrganizacionalDto,
  CriarDepartamentoDto,
  ListarPorEmpresaQueryDto,
} from "../dto/organizacao.dto";

/** Sem rota `DELETE` (spec R6). Ver `EmpresaController` para o padrão. */
@ApiTags("organizacao")
@Controller("departamentos")
@UseGuards(SessionGuard)
export class DepartamentoController {
  constructor(private readonly service: DepartamentoService) {}

  @Get()
  @UseGuards(AuthorizationGuard)
  @RequirePermission("departamento", "read")
  @ApiOperation({ summary: "Lista departamentos do escopo do ator" })
  async listar(
    @Query() query: ListarPorEmpresaQueryDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.listar(query, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }

  @Get(":departamentoId")
  @UseGuards(AuthorizationGuard)
  @RequirePermission("departamento", "read")
  @ApiOperation({ summary: "Detalha um departamento" })
  async detalhar(
    @Param("departamentoId", ParseUUIDPipe) departamentoId: string,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.detalhar(departamentoId, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }

  @Post()
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("departamento", "create")
  @ApiOperation({ summary: "Cria departamento sob uma empresa" })
  async criar(
    @Body() dto: CriarDepartamentoDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.criar(dto, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }

  @Patch(":departamentoId")
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("departamento", "alter")
  @ApiOperation({
    summary: "Altera o nome do departamento (codigo e imutavel)",
  })
  async atualizar(
    @Param("departamentoId", ParseUUIDPipe) departamentoId: string,
    @Body() dto: AtualizarNoOrganizacionalDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.atualizar(departamentoId, dto, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }

  @Post(":departamentoId/inativar")
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("departamento", "manage")
  @ApiOperation({
    summary: "Inativa o departamento; recusa se houver area ou equipe ativa",
  })
  async inativar(
    @Param("departamentoId", ParseUUIDPipe) departamentoId: string,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.inativar(departamentoId, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }
}
