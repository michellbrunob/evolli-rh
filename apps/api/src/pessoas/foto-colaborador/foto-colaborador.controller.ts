import {
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Put,
  Query,
  Req,
  Res,
  UnsupportedMediaTypeException,
  UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { AccessUser } from "@prisma/client";
import type { Request, Response } from "express";
import { SessionGuard } from "../../auth/session/session.guard";
import { CsrfGuard } from "../../auth/csrf/csrf.guard";
import { AuthorizationGuard } from "../../auth/authorization/authorization.guard";
import { RequirePermission } from "../../auth/authorization/require-permission.decorator";
import { CurrentUser } from "../../auth/session/current-user.decorator";
import { extractRequestMetadata } from "../../auth/request-metadata.util";
import { lerCorpoLimitado } from "../../users/perfil/foto-perfil.processamento";
import { RecusaDeNegocioException } from "../../common/erros/recusa-por-campo";
import { FotoColaboradorService } from "./foto-colaborador.service";
import {
  TAMANHOS_DA_FOTO,
  type TamanhoDaFoto,
} from "./foto-colaborador.processamento";

/** Tipo declarado do arquivo escolhido (PNG ou JPEG). */
export const CABECALHO_TIPO_DA_FOTO = "x-evolli-foto-tipo";
/** Extensão do arquivo escolhido (png, jpg, jpeg) — o nome não é enviado. */
export const CABECALHO_EXTENSAO_DA_FOTO = "x-evolli-foto-extensao";

/**
 * T209 — foto do colaborador (ADR 0020). Rota própria, autenticada; o
 * navegador nunca fala com o armazenamento.
 *
 * - `PUT`: corpo `application/octet-stream` (até 5 MB), com o tipo declarado
 *   e a extensão nos cabeçalhos; o servidor confere os três contra o
 *   conteúdo, processa e grava só versões WebP.
 * - `GET ?tamanho=96|256|512`: os bytes, depois de autorizar.
 * - `DELETE`: remove a foto e as versões.
 */
@ApiTags("pessoas")
@Controller("colaboradores/:colaboradorId/foto")
@UseGuards(SessionGuard)
export class FotoColaboradorController {
  constructor(private readonly service: FotoColaboradorService) {}

  @Get()
  @UseGuards(AuthorizationGuard)
  @RequirePermission("dados_pessoais_colaborador", "read")
  @ApiOperation({ summary: "Foto do colaborador (bytes WebP, privada)" })
  async ler(
    @Param("colaboradorId", ParseUUIDPipe) colaboradorId: string,
    @Query("tamanho") tamanhoBruto: string | undefined,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const tamanho = Number(tamanhoBruto ?? 256) as TamanhoDaFoto;
    if (!(TAMANHOS_DA_FOTO as readonly number[]).includes(tamanho)) {
      throw new RecusaDeNegocioException("foto_tamanho_invalido");
    }
    const { bytes } = await this.service.ler(colaboradorId, tamanho, {
      actor,
      metadata: extractRequestMetadata(req),
    });
    res.set({
      "Content-Type": "image/webp",
      "Content-Length": String(bytes.length),
      // Dado pessoal: nada em cache compartilhado nem em disco.
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
      "Content-Security-Policy": "default-src 'none'",
    });
    res.status(200).end(bytes);
  }

  @Put()
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("dados_pessoais_colaborador", "alter")
  @ApiOperation({ summary: "Envia ou substitui a foto do colaborador" })
  async enviar(
    @Param("colaboradorId", ParseUUIDPipe) colaboradorId: string,
    @Headers(CABECALHO_TIPO_DA_FOTO) tipoDeclarado: string | undefined,
    @Headers(CABECALHO_EXTENSAO_DA_FOTO) extensao: string | undefined,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    const tipo = String(req.headers["content-type"] ?? "").split(";")[0] ?? "";
    if (tipo.trim().toLowerCase() !== "application/octet-stream") {
      req.resume();
      throw new UnsupportedMediaTypeException();
    }
    const bytes = await lerCorpoLimitado(req);
    return this.service.enviar(
      colaboradorId,
      {
        bytes,
        tipoDeclarado: tipoDeclarado ?? "",
        extensao: extensao ?? "",
      },
      { actor, metadata: extractRequestMetadata(req) },
    );
  }

  @Delete()
  @HttpCode(204)
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("dados_pessoais_colaborador", "alter")
  @ApiOperation({ summary: "Remove a foto do colaborador" })
  async remover(
    @Param("colaboradorId", ParseUUIDPipe) colaboradorId: string,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    await this.service.remover(colaboradorId, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }
}
