import {
  BadRequestException,
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
import { SessionGuard } from "../auth/session/session.guard";
import { CsrfGuard } from "../auth/csrf/csrf.guard";
import { AuthorizationGuard } from "../auth/authorization/authorization.guard";
import { RequirePermission } from "../auth/authorization/require-permission.decorator";
import { CurrentUser } from "../auth/session/current-user.decorator";
import { extractRequestMetadata } from "../auth/request-metadata.util";
import { GestorAdminService } from "./gestor-admin.service";
import { GestorConsultaService } from "./gestor-consulta.service";
import {
  ConsultaEquipeQueryDto,
  CriarAtribuicaoDto,
  CriarExcecaoDto,
  EncerrarVigenciaDto,
  ListarAtribuicoesQueryDto,
  ListarExcecoesQueryDto,
  VincularContaDto,
  ehDiaIso,
} from "./dto/gestor.dto";

/**
 * Administração do escopo do gestor — RH (T151, ADR 0015, decisões 6 e 9).
 *
 * Sem rota `DELETE`: encerrar é transição de vigência, nunca exclusão. O
 * histórico de quem respondeu pelo quê e quando é a própria evidência que a
 * decisão 8 exige, e apagá-lo destruiria a auditoria junto.
 *
 * Nenhum parâmetro de rota se chama `id` — o `AuthorizationGuard` resolve
 * `request.params.id` como `AccessUser` alvo (lição já registrada nas
 * Fatias 1 e 4).
 */
@ApiTags("gestor")
@Controller("gestor/administracao")
@UseGuards(SessionGuard)
export class GestorAdminController {
  constructor(private readonly service: GestorAdminService) {}

  private contexto(actor: AccessUser, req: Request) {
    return { actor, metadata: extractRequestMetadata(req) };
  }

  private exigirDia(...valores: (string | undefined)[]): void {
    if (!valores.every(ehDiaIso)) {
      throw new BadRequestException(
        "Datas devem ser informadas como YYYY-MM-DD, sem hora.",
      );
    }
  }

  @Post("ligacoes")
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("gestor_atribuicao", "create")
  @ApiOperation({
    summary: "Liga uma conta de acesso a um colaborador (DP-23)",
  })
  async vincularConta(
    @Body() dto: VincularContaDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    this.exigirDia(dto.vigenciaInicio);
    return this.service.vincularConta(this.contexto(actor, req), dto);
  }

  @Patch("ligacoes/:ligacaoId/encerrar")
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("gestor_atribuicao", "alter")
  @ApiOperation({ summary: "Encerra a ligação conta-colaborador" })
  async desvincularConta(
    @Param("ligacaoId", ParseUUIDPipe) ligacaoId: string,
    @Body() dto: EncerrarVigenciaDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    this.exigirDia(dto.vigenciaFim);
    return this.service.desvincularConta(
      this.contexto(actor, req),
      ligacaoId,
      dto.vigenciaFim,
    );
  }

  @Get("ligacoes")
  @UseGuards(AuthorizationGuard)
  @RequirePermission("gestor_atribuicao", "read")
  @ApiOperation({ summary: "Lista ligações conta-colaborador da empresa" })
  async listarLigacoes(@CurrentUser() actor: AccessUser, @Req() req: Request) {
    return this.service.listarLigacoes(this.contexto(actor, req));
  }

  @Post("atribuicoes")
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("gestor_atribuicao", "create")
  @ApiOperation({ summary: "Atribui um gestor a uma equipe, com vigência" })
  async criarAtribuicao(
    @Body() dto: CriarAtribuicaoDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    this.exigirDia(dto.vigenciaInicio, dto.vigenciaFim);
    return this.service.criarAtribuicao(this.contexto(actor, req), dto);
  }

  @Patch("atribuicoes/:atribuicaoId/encerrar")
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("gestor_atribuicao", "alter")
  @ApiOperation({ summary: "Encerra a atribuição de um gestor a uma equipe" })
  async encerrarAtribuicao(
    @Param("atribuicaoId", ParseUUIDPipe) atribuicaoId: string,
    @Body() dto: EncerrarVigenciaDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    this.exigirDia(dto.vigenciaFim);
    return this.service.encerrarAtribuicao(
      this.contexto(actor, req),
      atribuicaoId,
      dto.vigenciaFim,
    );
  }

  @Get("atribuicoes")
  @UseGuards(AuthorizationGuard)
  @RequirePermission("gestor_atribuicao", "read")
  @ApiOperation({ summary: "Lista atribuições de gestor da empresa" })
  async listarAtribuicoes(
    @Query() query: ListarAtribuicoesQueryDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.listarAtribuicoes(
      this.contexto(actor, req),
      query.equipeId,
    );
  }

  @Post("excecoes")
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("gestor_atribuicao", "create")
  @ApiOperation({ summary: "Concede exceção individual, com prazo e motivo" })
  async criarExcecao(
    @Body() dto: CriarExcecaoDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    this.exigirDia(dto.vigenciaInicio, dto.vigenciaFim);
    return this.service.criarExcecao(this.contexto(actor, req), dto);
  }

  @Patch("excecoes/:excecaoId/encerrar")
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("gestor_atribuicao", "alter")
  @ApiOperation({ summary: "Revoga uma exceção individual antes do prazo" })
  async encerrarExcecao(
    @Param("excecaoId", ParseUUIDPipe) excecaoId: string,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.encerrarExcecao(this.contexto(actor, req), excecaoId);
  }

  @Get("excecoes")
  @UseGuards(AuthorizationGuard)
  @RequirePermission("gestor_atribuicao", "read")
  @ApiOperation({ summary: "Lista exceções individuais da empresa" })
  async listarExcecoes(
    @Query() query: ListarExcecoesQueryDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.listarExcecoes(
      this.contexto(actor, req),
      query.gestorColaboradorId,
    );
  }
}

/**
 * Consulta consultiva — o gestor (T151, ADR 0015, decisões 1, 2, 3 e 7).
 *
 * **Só `GET`.** Não existe `POST`, `PATCH` nem `DELETE` neste controller, e
 * isso não é omissão: `PD-SOL-01` fixou o papel como consultivo e a ADR 0015
 * não abriu nenhuma mutação. O RBAC reforça concedendo apenas `read` em
 * `gestor_equipe`, de modo que a ausência de rota e a ausência de permissão
 * se confirmam mutuamente.
 */
@ApiTags("gestor")
@Controller("gestor/equipe")
@UseGuards(SessionGuard)
export class GestorConsultaController {
  constructor(private readonly service: GestorConsultaService) {}

  private contexto(actor: AccessUser, req: Request) {
    return { actor, metadata: extractRequestMetadata(req) };
  }

  @Get()
  @UseGuards(AuthorizationGuard)
  @RequirePermission("gestor_equipe", "read")
  @ApiOperation({
    summary: "Lista os colaboradores dentro do escopo do gestor na data",
  })
  async listar(
    @Query() query: ConsultaEquipeQueryDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    if (!ehDiaIso(query.dataReferencia)) {
      throw new BadRequestException(
        "dataReferencia deve ser YYYY-MM-DD, sem hora.",
      );
    }
    return this.service.listarEquipe(
      this.contexto(actor, req),
      query.dataReferencia,
    );
  }

  @Get("vinculos/:vinculoId")
  @UseGuards(AuthorizationGuard)
  @RequirePermission("gestor_equipe", "read")
  @ApiOperation({
    summary: "Detalha um vínculo do escopo; 404 fora dele",
  })
  async detalhar(
    @Param("vinculoId", ParseUUIDPipe) vinculoId: string,
    @Query() query: ConsultaEquipeQueryDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    if (!ehDiaIso(query.dataReferencia)) {
      throw new BadRequestException(
        "dataReferencia deve ser YYYY-MM-DD, sem hora.",
      );
    }
    return this.service.detalharVinculo(
      this.contexto(actor, req),
      vinculoId,
      query.dataReferencia,
    );
  }
}
