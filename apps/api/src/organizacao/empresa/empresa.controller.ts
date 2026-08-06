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
import { EmpresaService } from "./empresa.service";
import {
  AtualizarNoOrganizacionalDto,
  CriarEmpresaDto,
  ListarNosOrganizacionaisQueryDto,
} from "../dto/organizacao.dto";

/**
 * Rotas em português, plurais e minúsculas (ADR 0006, Emenda 1).
 *
 * O parâmetro de rota é `:empresaId`, nunca `:id` — o `AuthorizationGuard`
 * resolve `request.params.id` como `AccessUser` alvo, e usar `id` aqui
 * acoplaria a rota organizacional àquele comportamento (lição registrada na
 * Fatia 4).
 *
 * **Nenhuma rota `DELETE`**: exclusão física é proibida (spec R6); "remover"
 * é sempre `POST /:empresaId/inativar`.
 */
@ApiTags("organizacao")
@Controller("empresas")
@UseGuards(SessionGuard)
export class EmpresaController {
  constructor(private readonly empresaService: EmpresaService) {}

  @Get()
  @UseGuards(AuthorizationGuard)
  @RequirePermission("empresa", "read")
  @ApiOperation({ summary: "Lista empresas do escopo do ator, paginado" })
  async listar(
    @Query() query: ListarNosOrganizacionaisQueryDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.empresaService.listar(query, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }

  @Get(":empresaId")
  @UseGuards(AuthorizationGuard)
  @RequirePermission("empresa", "read")
  @ApiOperation({ summary: "Detalha uma empresa do escopo do ator" })
  async detalhar(
    @Param("empresaId", ParseUUIDPipe) empresaId: string,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.empresaService.detalhar(empresaId, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }

  @Post()
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("empresa", "create")
  @ApiOperation({ summary: "Cria empresa (somente escopo administrativo)" })
  async criar(
    @Body() dto: CriarEmpresaDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.empresaService.criar(dto, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }

  @Patch(":empresaId")
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("empresa", "alter")
  @ApiOperation({ summary: "Altera o nome da empresa (codigo e imutavel)" })
  async atualizar(
    @Param("empresaId", ParseUUIDPipe) empresaId: string,
    @Body() dto: AtualizarNoOrganizacionalDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.empresaService.atualizar(empresaId, dto, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }

  @Post(":empresaId/inativar")
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("empresa", "manage")
  @ApiOperation({
    summary: "Inativa a empresa; recusa se houver elemento ativo vinculado",
  })
  async inativar(
    @Param("empresaId", ParseUUIDPipe) empresaId: string,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.empresaService.inativar(empresaId, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }
}
