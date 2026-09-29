import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
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
import { SolicitacaoPessoaService } from "./solicitacao-pessoa.service";
import {
  ListarSolicitacoesPessoaQueryDto,
  RegistrarSolicitacaoPessoaDto,
  TransicionarSolicitacaoPessoaDto,
} from "./dto/solicitacoes-pessoas.dto";

/**
 * Central de Solicitações de Pessoas. Registrar, consultar, transicionar e ler
 * o histórico — nunca executar a operação trabalhista, que segue no fluxo
 * próprio do RH.
 *
 * Param `:solicitacaoId`, nunca `:id`: `:id` faria o `AuthorizationGuard`
 * tentar carregar um `AccessUser` com esse identificador.
 *
 * Toda mutação passa por `CsrfGuard` antes do `AuthorizationGuard`.
 */
@ApiTags("solicitacoes-pessoas")
@Controller("solicitacoes-pessoas")
@UseGuards(SessionGuard)
export class SolicitacaoPessoaController {
  constructor(private readonly service: SolicitacaoPessoaService) {}

  @Get()
  @UseGuards(AuthorizationGuard)
  @RequirePermission("solicitacao_pessoa", "read")
  @ApiOperation({
    summary: "Lista solicitacoes de pessoas da empresa do ator",
  })
  async listar(
    @Query() query: ListarSolicitacoesPessoaQueryDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.listar(query, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }

  @Get(":solicitacaoId")
  @UseGuards(AuthorizationGuard)
  @RequirePermission("solicitacao_pessoa", "read")
  @ApiOperation({ summary: "Detalha uma solicitacao de pessoas" })
  async detalhar(
    @Param("solicitacaoId", ParseUUIDPipe) solicitacaoId: string,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.detalhar(solicitacaoId, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }

  @Get(":solicitacaoId/historico")
  @UseGuards(AuthorizationGuard)
  @RequirePermission("solicitacao_pessoa", "read")
  @ApiOperation({
    summary: "Historico auditavel da solicitacao, em ordem cronologica",
  })
  async historico(
    @Param("solicitacaoId", ParseUUIDPipe) solicitacaoId: string,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.historico(solicitacaoId, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }

  @Post()
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("solicitacao_pessoa", "create")
  @ApiOperation({
    summary:
      "Registra uma solicitacao em rascunho (sem anexo e sem efeito operacional)",
  })
  async registrar(
    @Body() dto: RegistrarSolicitacaoPessoaDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.registrar(dto, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }

  @Post(":solicitacaoId/transicoes")
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("solicitacao_pessoa", "alter")
  @ApiOperation({
    summary:
      "Executa uma transicao aprovada; encaminhar NAO executa operacao trabalhista",
  })
  async transicionar(
    @Param("solicitacaoId", ParseUUIDPipe) solicitacaoId: string,
    @Body() dto: TransicionarSolicitacaoPessoaDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.transicionar(solicitacaoId, dto, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }
}
