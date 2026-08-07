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
import { ColaboradorService } from "./colaborador.service";
import { VinculoService } from "../vinculo/vinculo.service";
import {
  AdmitirColaboradorDto,
  ListarColaboradoresQueryDto,
  RetificarColaboradorDto,
} from "../dto/pessoas.dto";

/**
 * Sem rota `DELETE` (RI-H1): colaborador nunca é excluído, nem no
 * desligamento, nem por erro de cadastro. Erro de cadastro é retificação; fim
 * de relação é encerramento de vínculo.
 *
 * Parâmetro de rota nunca se chama `id` — o `AuthorizationGuard` resolve
 * `request.params.id` como `AccessUser` alvo (lição já registrada nas
 * Fatias 1 e 4). Usa-se sempre o `id` **técnico**, nunca matrícula ou
 * documento (RI-C1).
 */
@ApiTags("pessoas")
@Controller("colaboradores")
@UseGuards(SessionGuard)
export class ColaboradorController {
  constructor(
    private readonly service: ColaboradorService,
    private readonly vinculoService: VinculoService,
  ) {}

  @Get()
  @UseGuards(AuthorizationGuard)
  @RequirePermission("colaborador", "read")
  @ApiOperation({ summary: "Lista colaboradores da empresa do ator" })
  async listar(
    @Query() query: ListarColaboradoresQueryDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.listar(query, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }

  @Get(":colaboradorId")
  @UseGuards(AuthorizationGuard)
  @RequirePermission("colaborador", "read")
  @ApiOperation({ summary: "Detalha o cadastro de um colaborador" })
  async detalhar(
    @Param("colaboradorId", ParseUUIDPipe) colaboradorId: string,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.detalhar(colaboradorId, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }

  @Post()
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("colaborador", "create")
  @ApiOperation({
    summary:
      "Admite: cria colaborador, primeiro vinculo (previsto) e movimentacao de admissao. Nao cria conta de acesso",
  })
  async admitir(
    @Body() dto: AdmitirColaboradorDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.admitir(dto, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }

  @Patch(":colaboradorId")
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("colaborador", "alter")
  @ApiOperation({
    summary: "Retifica o nome do colaborador; nao altera vida funcional",
  })
  async retificar(
    @Param("colaboradorId", ParseUUIDPipe) colaboradorId: string,
    @Body() dto: RetificarColaboradorDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.retificar(colaboradorId, dto, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }

  @Get(":colaboradorId/vinculos")
  @UseGuards(AuthorizationGuard)
  @RequirePermission("vinculo_funcional", "read")
  @ApiOperation({ summary: "Lista os vinculos do colaborador na empresa" })
  async listarVinculos(
    @Param("colaboradorId", ParseUUIDPipe) colaboradorId: string,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.vinculoService.listarPorColaborador(colaboradorId, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }
}
