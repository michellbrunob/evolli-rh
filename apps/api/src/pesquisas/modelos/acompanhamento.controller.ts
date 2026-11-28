import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Req,
  Res,
  UnsupportedMediaTypeException,
  UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { AccessUser } from "@prisma/client";
import type { Request, Response } from "express";
import { lerCorpoLimitado } from "../../users/perfil/foto-perfil.processamento";
import {
  EVIDENCIA_LIMITE_BYTES,
  disposicaoDoDownload,
} from "./copsoq/evidencias";
import { AuthorizationGuard } from "../../auth/authorization/authorization.guard";
import { RequirePermission } from "../../auth/authorization/require-permission.decorator";
import { CsrfGuard } from "../../auth/csrf/csrf.guard";
import { extractRequestMetadata } from "../../auth/request-metadata.util";
import { CurrentUser } from "../../auth/session/current-user.decorator";
import { SessionGuard } from "../../auth/session/session.guard";
import { AcompanhamentoService } from "./acompanhamento.service";

const ctx = (actor: AccessUser, req: Request) => ({
  actor,
  metadata: extractRequestMetadata(req),
});

export const CABECALHO_TIPO_DA_EVIDENCIA = "x-evolli-evidencia-tipo";
export const CABECALHO_EXTENSAO_DA_EVIDENCIA = "x-evolli-evidencia-extensao";
/** O nome do arquivo, codificado para URL (`encodeURIComponent`). */
export const CABECALHO_NOME_DA_EVIDENCIA = "x-evolli-evidencia-nome";

/**
 * T216 — o acompanhamento da NR-1 (etapas e plano de ação). Leitura com a
 * permissão de pesquisa; gravação com CSRF e a permissão de alterar.
 *
 * Arquivos de evidência de uma etapa (RH e DP):
 * - `POST evidencias/:etapa`: corpo `application/octet-stream` (até 20 MB),
 *   tipo, extensão e nome nos cabeçalhos;
 * - `GET evidencias/:etapa/:arquivoId`: download privado;
 * - `DELETE evidencias/:etapa/:arquivoId`: tira da etapa e do armazenamento.
 */
@ApiTags("pesquisas")
@Controller("pesquisas/:pesquisaId/modelo/acompanhamento")
@UseGuards(SessionGuard)
export class AcompanhamentoController {
  constructor(private readonly service: AcompanhamentoService) {}

  @Get()
  @UseGuards(AuthorizationGuard)
  @RequirePermission("pesquisa", "read")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Conformidade com a NR-1: etapas e plano" })
  obter(
    @Param("pesquisaId", ParseUUIDPipe) id: string,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.obter(id, ctx(actor, req));
  }

  @Put()
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("pesquisa", "alter")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Grava as etapas da NR-1 e o plano de ação" })
  gravar(
    @Param("pesquisaId", ParseUUIDPipe) id: string,
    @Body() corpo: Record<string, unknown>,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.gravar(id, corpo, ctx(actor, req));
  }

  @Post("evidencias/:etapa")
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("pesquisa", "alter")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Anexa um arquivo de evidência a uma etapa" })
  async enviarEvidencia(
    @Param("pesquisaId", ParseUUIDPipe) id: string,
    @Param("etapa") etapa: string,
    @Headers(CABECALHO_TIPO_DA_EVIDENCIA) tipoDeclarado: string | undefined,
    @Headers(CABECALHO_EXTENSAO_DA_EVIDENCIA) extensao: string | undefined,
    @Headers(CABECALHO_NOME_DA_EVIDENCIA) nome: string | undefined,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    const tipo = String(req.headers["content-type"] ?? "").split(";")[0] ?? "";
    if (tipo.trim().toLowerCase() !== "application/octet-stream") {
      req.resume();
      throw new UnsupportedMediaTypeException();
    }
    const bytes = await lerCorpoLimitado(req, EVIDENCIA_LIMITE_BYTES);
    return this.service.enviarEvidencia(
      id,
      etapa,
      {
        bytes,
        tipoDeclarado: tipoDeclarado ?? "",
        extensao: extensao ?? "",
        nome,
      },
      ctx(actor, req),
    );
  }

  @Get("evidencias/:etapa/:arquivoId")
  @UseGuards(AuthorizationGuard)
  @RequirePermission("pesquisa", "read")
  @ApiOperation({ summary: "Baixa um arquivo de evidência (privado)" })
  async baixarEvidencia(
    @Param("pesquisaId", ParseUUIDPipe) id: string,
    @Param("etapa") etapa: string,
    @Param("arquivoId", ParseUUIDPipe) arquivoId: string,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const arquivo = await this.service.baixarEvidencia(
      id,
      etapa,
      arquivoId,
      ctx(actor, req),
    );
    res.set({
      "Content-Type": arquivo.tipo,
      "Content-Length": String(arquivo.bytes.length),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": disposicaoDoDownload(arquivo.nome),
      "Content-Security-Policy": "default-src 'none'; sandbox",
    });
    res.status(200).end(arquivo.bytes);
  }

  @Delete("evidencias/:etapa/:arquivoId")
  @HttpCode(200)
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("pesquisa", "alter")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Remove um arquivo de evidência da etapa" })
  removerEvidencia(
    @Param("pesquisaId", ParseUUIDPipe) id: string,
    @Param("etapa") etapa: string,
    @Param("arquivoId", ParseUUIDPipe) arquivoId: string,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.removerEvidencia(id, etapa, arquivoId, ctx(actor, req));
  }
}
