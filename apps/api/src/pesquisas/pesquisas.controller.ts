import {
  Body,
  Controller,
  Delete,
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
import { SessionGuard } from "../auth/session/session.guard";
import { CsrfGuard } from "../auth/csrf/csrf.guard";
import { AuthorizationGuard } from "../auth/authorization/authorization.guard";
import { RequirePermission } from "../auth/authorization/require-permission.decorator";
import { CurrentUser } from "../auth/session/current-user.decorator";
import { extractRequestMetadata } from "../auth/request-metadata.util";
import {
  AnalisesQueryDto,
  DuplicarDto,
  IdentificarDto,
  ListarPesquisasQueryDto,
  PesquisaDto,
  ResponderDto,
  ResultadosQueryDto,
  StatusDto,
} from "./pesquisas.dto";
import { PesquisasService } from "./pesquisas.service";
import { PesquisaPublicaService } from "./pesquisa-publica.service";

const ctx = (actor: AccessUser, req: Request) => ({
  actor,
  metadata: extractRequestMetadata(req),
});

/**
 * T216 — Pesquisas da empresa ativa. `rh` e `dp` operam; o
 * `master_tecnico` só lê. Escritas com CSRF; respostas `no-store`.
 */
@ApiTags("pesquisas")
@Controller("pesquisas")
@UseGuards(SessionGuard)
export class PesquisasController {
  constructor(private readonly service: PesquisasService) {}

  @Get()
  @UseGuards(AuthorizationGuard)
  @RequirePermission("pesquisa", "read")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Pesquisas da empresa, com contagens por status" })
  listar(
    @Query() q: ListarPesquisasQueryDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.listar(q, ctx(actor, req));
  }

  @Post()
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("pesquisa", "create")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Cria a pesquisa como rascunho" })
  criar(
    @Body() dto: PesquisaDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.criar(dto, ctx(actor, req));
  }

  @Get(":pesquisaId")
  @UseGuards(AuthorizationGuard)
  @RequirePermission("pesquisa", "read")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "A pesquisa: estrutura, participantes e link" })
  obter(
    @Param("pesquisaId", ParseUUIDPipe) id: string,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.obter(id, ctx(actor, req));
  }

  @Put(":pesquisaId")
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("pesquisa", "alter")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Altera a pesquisa (regras de edição)" })
  alterar(
    @Param("pesquisaId", ParseUUIDPipe) id: string,
    @Body() dto: PesquisaDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.alterar(id, dto, ctx(actor, req));
  }

  @Post(":pesquisaId/publicar")
  @HttpCode(200)
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("pesquisa", "alter")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Publica o rascunho (a pesquisa fica ativa)" })
  publicar(
    @Param("pesquisaId", ParseUUIDPipe) id: string,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.publicar(id, ctx(actor, req));
  }

  @Post(":pesquisaId/status")
  @HttpCode(200)
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("pesquisa", "alter")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Pausa, reativa, finaliza ou cancela" })
  status(
    @Param("pesquisaId", ParseUUIDPipe) id: string,
    @Body() dto: StatusDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.alterarStatus(id, dto.status, ctx(actor, req));
  }

  @Post(":pesquisaId/duplicar")
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("pesquisa", "create")
  @Header("Cache-Control", "no-store")
  @ApiOperation({
    summary: "Duplica já ativa (na empresa ativa ou em outra autorizada)",
  })
  duplicar(
    @Param("pesquisaId", ParseUUIDPipe) id: string,
    @Body() dto: DuplicarDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.duplicar(id, dto.empresaId, ctx(actor, req));
  }

  @Delete(":pesquisaId")
  @HttpCode(204)
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("pesquisa", "alter")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Exclui (lógico)" })
  async excluir(
    @Param("pesquisaId", ParseUUIDPipe) id: string,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ): Promise<void> {
    await this.service.excluir(id, ctx(actor, req));
  }

  @Get(":pesquisaId/resultados")
  @UseGuards(AuthorizationGuard)
  @RequirePermission("pesquisa", "read")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Resultados agregados (com o recorte)" })
  resultados(
    @Param("pesquisaId", ParseUUIDPipe) id: string,
    @Query() q: ResultadosQueryDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    // `campo` + `grupoId`; `departamentoId` continua como atalho.
    const filtro =
      q.campo && q.grupoId
        ? { campo: q.campo, grupoId: q.grupoId }
        : q.departamentoId
          ? { campo: "departamento" as const, grupoId: q.departamentoId }
          : null;
    return this.service.resultados(id, filtro, ctx(actor, req));
  }

  @Get(":pesquisaId/analises")
  @UseGuards(AuthorizationGuard)
  @RequirePermission("pesquisa", "read")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Mapa de médias por grupo e a evolução" })
  analises(
    @Param("pesquisaId", ParseUUIDPipe) id: string,
    @Query() q: AnalisesQueryDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.analises(id, q.campo, ctx(actor, req));
  }

  @Get(":pesquisaId/respostas")
  @UseGuards(AuthorizationGuard)
  @RequirePermission("resposta_pesquisa", "read")
  @Header("Cache-Control", "no-store")
  @ApiOperation({
    summary: "Respostas individuais numeradas (identificada e anônima)",
  })
  respostas(
    @Param("pesquisaId", ParseUUIDPipe) id: string,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.respostasIndividuais(id, ctx(actor, req));
  }

  @Get(":pesquisaId/respostas/:respostaId")
  @UseGuards(AuthorizationGuard)
  @RequirePermission("resposta_pesquisa", "read")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Uma resposta comparada com o time" })
  resposta(
    @Param("pesquisaId", ParseUUIDPipe) id: string,
    @Param("respostaId", ParseUUIDPipe) respostaId: string,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.respostaIndividual(id, respostaId, ctx(actor, req));
  }
}

/** T216 — aba Pesquisas da ficha: as identificadas que a pessoa respondeu. */
@ApiTags("pesquisas")
@Controller("colaboradores/:colaboradorId/pesquisas")
@UseGuards(SessionGuard)
export class PesquisasDoColaboradorController {
  constructor(private readonly service: PesquisasService) {}

  @Get()
  @UseGuards(AuthorizationGuard)
  @RequirePermission("resposta_pesquisa", "read")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Pesquisas identificadas respondidas pela pessoa" })
  listar(
    @Param("colaboradorId", ParseUUIDPipe) colaboradorId: string,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.daFicha(colaboradorId, ctx(actor, req));
  }
}

/**
 * T216 — a página pública da pesquisa: sem sessão e sem CSRF (quem responde
 * não tem conta); o token da pesquisa vai na rota.
 */
@ApiTags("pesquisas")
@Controller("publico/pesquisas/:token")
export class PesquisaPublicaController {
  constructor(private readonly service: PesquisaPublicaService) {}

  @Get()
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Abertura e estrutura, ou o aviso" })
  abrir(@Param("token") token: string) {
    return this.service.abrir(token);
  }

  @Post("identificar")
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "CPF + nascimento → passe da resposta" })
  identificar(
    @Param("token") token: string,
    @Body() dto: IdentificarDto,
    @Req() req: Request,
  ) {
    return this.service.identificar(token, dto, extractRequestMetadata(req));
  }

  @Post("respostas")
  @HttpCode(201)
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Envia a resposta" })
  responder(
    @Param("token") token: string,
    @Body() dto: ResponderDto,
    @Req() req: Request,
  ) {
    return this.service.responder(token, dto, extractRequestMetadata(req));
  }
}
