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
import { CargoService } from "./cargo.service";
import {
  AtualizarNoOrganizacionalDto,
  CriarCargoDto,
  ListarPorEmpresaQueryDto,
} from "../dto/organizacao.dto";

/** Sem rota `DELETE` (spec R6). Ver `EmpresaController` para o padrão. */
@ApiTags("organizacao")
@Controller("cargos")
@UseGuards(SessionGuard)
export class CargoController {
  constructor(private readonly service: CargoService) {}

  @Get()
  @UseGuards(AuthorizationGuard)
  @RequirePermission("cargo", "read")
  @ApiOperation({ summary: "Lista cargos do escopo do ator" })
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

  @Get(":cargoId")
  @UseGuards(AuthorizationGuard)
  @RequirePermission("cargo", "read")
  @ApiOperation({ summary: "Detalha um cargo" })
  async detalhar(
    @Param("cargoId", ParseUUIDPipe) cargoId: string,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.detalhar(cargoId, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }

  @Post()
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("cargo", "create")
  @ApiOperation({ summary: "Cria cargo no catalogo da empresa" })
  async criar(
    @Body() dto: CriarCargoDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.criar(dto, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }

  @Patch(":cargoId")
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("cargo", "alter")
  @ApiOperation({ summary: "Altera o nome do cargo (codigo e imutavel)" })
  async atualizar(
    @Param("cargoId", ParseUUIDPipe) cargoId: string,
    @Body() dto: AtualizarNoOrganizacionalDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.atualizar(cargoId, dto, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }

  @Post(":cargoId/inativar")
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("cargo", "manage")
  @ApiOperation({ summary: "Inativa o cargo" })
  async inativar(
    @Param("cargoId", ParseUUIDPipe) cargoId: string,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.inativar(cargoId, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }
}
