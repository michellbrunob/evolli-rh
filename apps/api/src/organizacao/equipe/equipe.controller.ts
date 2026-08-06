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
import { EquipeService } from "./equipe.service";
import {
  AtualizarNoOrganizacionalDto,
  CriarEquipeDto,
  ListarEquipesQueryDto,
} from "../dto/organizacao.dto";

/** Sem rota `DELETE` (spec R6). Ver `EmpresaController` para o padrão. */
@ApiTags("organizacao")
@Controller("equipes")
@UseGuards(SessionGuard)
export class EquipeController {
  constructor(private readonly service: EquipeService) {}

  @Get()
  @UseGuards(AuthorizationGuard)
  @RequirePermission("equipe", "read")
  @ApiOperation({ summary: "Lista equipes do escopo do ator" })
  async listar(
    @Query() query: ListarEquipesQueryDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.listar(query, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }

  @Get(":equipeId")
  @UseGuards(AuthorizationGuard)
  @RequirePermission("equipe", "read")
  @ApiOperation({ summary: "Detalha uma equipe" })
  async detalhar(
    @Param("equipeId", ParseUUIDPipe) equipeId: string,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.detalhar(equipeId, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }

  @Post()
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("equipe", "create")
  @ApiOperation({
    summary:
      "Cria equipe sob um departamento (obrigatorio) e unidade (opcional)",
  })
  async criar(
    @Body() dto: CriarEquipeDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.criar(dto, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }

  @Patch(":equipeId")
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("equipe", "alter")
  @ApiOperation({ summary: "Altera o nome da equipe (codigo e imutavel)" })
  async atualizar(
    @Param("equipeId", ParseUUIDPipe) equipeId: string,
    @Body() dto: AtualizarNoOrganizacionalDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.atualizar(equipeId, dto, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }

  @Post(":equipeId/inativar")
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("equipe", "manage")
  @ApiOperation({ summary: "Inativa a equipe" })
  async inativar(
    @Param("equipeId", ParseUUIDPipe) equipeId: string,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.inativar(equipeId, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }
}
