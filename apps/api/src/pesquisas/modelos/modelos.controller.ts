import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
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
import { AvaliacaoService } from "./avaliacao/avaliacao.service";
import { OnboardingService } from "./onboarding/onboarding.service";
import {
  AvaliacaoDto,
  OnboardingDto,
  PasseDto,
  PerguntasDoOnboardingDto,
  PublicoDoOnboardingDto,
  RespostaDaAvaliacaoDto,
  RespostaDoOnboardingDto,
  ResultadosDoOnboardingQueryDto,
} from "./modelos.dto";

const ctx = (actor: AccessUser, req: Request) => ({
  actor,
  metadata: extractRequestMetadata(req),
});

/**
 * T216 — rotas próprias da Avaliação 90°/180° e do Onboarding automático
 * (as demais — criar, publicar, status, excluir — são as da pesquisa).
 */
@ApiTags("pesquisas")
@Controller("pesquisas")
@UseGuards(SessionGuard)
export class ModelosDePesquisasController {
  constructor(
    private readonly avaliacao: AvaliacaoService,
    private readonly onboarding: OnboardingService,
  ) {}

  @Get("avaliacoes/organograma")
  @UseGuards(AuthorizationGuard)
  @RequirePermission("pesquisa", "read")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Avaliação: quem avalia quem pela liderança" })
  organograma(@CurrentUser() actor: AccessUser, @Req() req: Request) {
    return this.avaliacao.organograma(ctx(actor, req));
  }

  @Post("onboarding/publico")
  @HttpCode(200)
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("pesquisa", "read")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Onboarding: quem está no público hoje" })
  publicoDoOnboarding(
    @Body() dto: PublicoDoOnboardingDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.onboarding.previaDoPublico(dto, ctx(actor, req));
  }

  @Get(":pesquisaId/avaliacao")
  @UseGuards(AuthorizationGuard)
  @RequirePermission("pesquisa", "read")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Avaliação: times, configuração e andamento" })
  obterAvaliacao(
    @Param("pesquisaId", ParseUUIDPipe) id: string,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.avaliacao.obter(id, ctx(actor, req));
  }

  @Put(":pesquisaId/avaliacao")
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("pesquisa", "alter")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Avaliação: grava os times e a configuração" })
  salvarAvaliacao(
    @Param("pesquisaId", ParseUUIDPipe) id: string,
    @Body() dto: AvaliacaoDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.avaliacao.salvar(id, dto, ctx(actor, req));
  }

  @Get(":pesquisaId/avaliacao/resultados")
  @UseGuards(AuthorizationGuard)
  @RequirePermission("resposta_pesquisa", "read")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Avaliação: resultado do time (nominal)" })
  resultadosDaAvaliacao(
    @Param("pesquisaId", ParseUUIDPipe) id: string,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.avaliacao.resultados(id, ctx(actor, req));
  }

  @Get(":pesquisaId/avaliacao/pessoas/:colaboradorId")
  @UseGuards(AuthorizationGuard)
  @RequirePermission("resposta_pesquisa", "read")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Avaliação: o resultado de uma pessoa" })
  pessoaDaAvaliacao(
    @Param("pesquisaId", ParseUUIDPipe) id: string,
    @Param("colaboradorId", ParseUUIDPipe) colaboradorId: string,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.avaliacao.pessoa(id, colaboradorId, ctx(actor, req));
  }

  @Get(":pesquisaId/onboarding")
  @UseGuards(AuthorizationGuard)
  @RequirePermission("pesquisa", "read")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Onboarding: o envio e o público" })
  obterOnboarding(
    @Param("pesquisaId", ParseUUIDPipe) id: string,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.onboarding.obter(id, ctx(actor, req));
  }

  @Put(":pesquisaId/onboarding")
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("pesquisa", "alter")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Onboarding: grava a configuração do envio" })
  salvarOnboarding(
    @Param("pesquisaId", ParseUUIDPipe) id: string,
    @Body() dto: OnboardingDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.onboarding.salvar(id, dto, ctx(actor, req));
  }

  @Put(":pesquisaId/onboarding/perguntas")
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("pesquisa", "alter")
  @Header("Cache-Control", "no-store")
  @ApiOperation({
    summary: "Onboarding: altera as perguntas (nova versão se já respondidas)",
  })
  alterarPerguntasDoOnboarding(
    @Param("pesquisaId", ParseUUIDPipe) id: string,
    @Body() dto: PerguntasDoOnboardingDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.onboarding.alterarPerguntas(id, dto, ctx(actor, req));
  }

  @Post(":pesquisaId/onboarding/ativar")
  @HttpCode(200)
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("pesquisa", "alter")
  @Header("Cache-Control", "no-store")
  @ApiOperation({
    summary: "Onboarding: ativa (agora, agendado ou automático)",
  })
  ativarOnboarding(
    @Param("pesquisaId", ParseUUIDPipe) id: string,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.onboarding.ativar(id, ctx(actor, req));
  }

  @Get(":pesquisaId/onboarding/envios")
  @UseGuards(AuthorizationGuard)
  @RequirePermission("pesquisa", "read")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Onboarding: os convites por pessoa" })
  enviosDoOnboarding(
    @Param("pesquisaId", ParseUUIDPipe) id: string,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.onboarding.envios(id, ctx(actor, req));
  }

  @Post(":pesquisaId/onboarding/envios/:envioId/pular")
  @HttpCode(204)
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("pesquisa", "alter")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Onboarding: pula um convite agendado" })
  async pularEnvio(
    @Param("pesquisaId", ParseUUIDPipe) id: string,
    @Param("envioId", ParseUUIDPipe) envioId: string,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ): Promise<void> {
    await this.onboarding.pular(id, envioId, ctx(actor, req));
  }

  @Get(":pesquisaId/onboarding/resultados")
  @UseGuards(AuthorizationGuard)
  @RequirePermission("pesquisa", "read")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Onboarding: resultado por rodada" })
  resultadosDoOnboarding(
    @Param("pesquisaId", ParseUUIDPipe) id: string,
    @Query() q: ResultadosDoOnboardingQueryDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    const filtro =
      q.campo && q.grupoId ? { campo: q.campo, grupoId: q.grupoId } : null;
    return this.onboarding.resultados(id, filtro, ctx(actor, req));
  }
}

/** T216 — aba da ficha: as avaliações 90°/180° sobre a pessoa. */
@ApiTags("pesquisas")
@Controller("colaboradores/:colaboradorId/avaliacoes")
@UseGuards(SessionGuard)
export class AvaliacoesDoColaboradorController {
  constructor(private readonly avaliacao: AvaliacaoService) {}

  @Get()
  @UseGuards(AuthorizationGuard)
  @RequirePermission("resposta_pesquisa", "read")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Avaliações 90°/180° sobre a pessoa" })
  listar(
    @Param("colaboradorId", ParseUUIDPipe) colaboradorId: string,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.avaliacao.daFicha(colaboradorId, ctx(actor, req));
  }
}

/** T216 — o link público da avaliação e do onboarding (sem sessão). */
@ApiTags("pesquisas")
@Controller("publico/pesquisas/:token")
export class ModelosPublicosController {
  constructor(
    private readonly avaliacao: AvaliacaoService,
    private readonly onboarding: OnboardingService,
  ) {}

  @Post("avaliacao/pendentes")
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Avaliação: quem a pessoa avalia" })
  pendentes(@Param("token") token: string, @Body() dto: PasseDto) {
    return this.avaliacao.pendentes(token, dto.passe);
  }

  @Post("avaliacao/pares/:parId")
  @HttpCode(201)
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Avaliação: envia a avaliação de uma pessoa" })
  responderAvaliacao(
    @Param("token") token: string,
    @Param("parId", ParseUUIDPipe) parId: string,
    @Body() dto: RespostaDaAvaliacaoDto,
    @Req() req: Request,
  ) {
    return this.avaliacao.responder(
      token,
      parId,
      dto,
      extractRequestMetadata(req),
    );
  }

  @Post("onboarding/respostas")
  @HttpCode(201)
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Onboarding: envia a resposta da rodada" })
  responderOnboarding(
    @Param("token") token: string,
    @Body() dto: RespostaDoOnboardingDto,
    @Req() req: Request,
  ) {
    return this.onboarding.responder(token, dto, extractRequestMetadata(req));
  }
}
