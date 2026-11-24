import {
  Controller,
  Delete,
  Get,
  Header,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
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
import { ANEXO_AUSENCIA_LIMITE_BYTES } from "./anexo-ausencia.arquivo";
import { AnexoAusenciaService } from "./anexo-ausencia.service";

export const CABECALHO_TIPO_DO_ANEXO = "x-evolli-anexo-tipo";
export const CABECALHO_EXTENSAO_DO_ANEXO = "x-evolli-anexo-extensao";

/**
 * T215 — anexo da ausência (atestado ou documento):
 *
 * - `POST /ausencias/:ausenciaId/anexo`: corpo `application/octet-stream`
 *   (até 10 MB), tipo e extensão nos cabeçalhos; o nome do arquivo não vai.
 * - `GET /ausencias/:ausenciaId/anexo/arquivo`: download privado.
 * - `DELETE /ausencias/:ausenciaId/anexo`: remoção lógica.
 *
 * Parâmetros nunca se chamam `id` (o `AuthorizationGuard` o trataria como
 * conta de acesso).
 */
@ApiTags("pessoas")
@Controller("ausencias/:ausenciaId/anexo")
@UseGuards(SessionGuard)
export class AnexoAusenciaController {
  constructor(private readonly service: AnexoAusenciaService) {}

  @Post()
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("ausencia", "alter")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Anexa atestado ou documento a uma ausencia" })
  async enviar(
    @Param("ausenciaId", ParseUUIDPipe) ausenciaId: string,
    @Headers(CABECALHO_TIPO_DO_ANEXO) tipoDeclarado: string | undefined,
    @Headers(CABECALHO_EXTENSAO_DO_ANEXO) extensao: string | undefined,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    const tipo = String(req.headers["content-type"] ?? "").split(";")[0] ?? "";
    if (tipo.trim().toLowerCase() !== "application/octet-stream") {
      req.resume();
      throw new UnsupportedMediaTypeException();
    }
    const bytes = await lerCorpoLimitado(req, ANEXO_AUSENCIA_LIMITE_BYTES);
    return this.service.enviar(
      ausenciaId,
      {
        bytes,
        tipoDeclarado: tipoDeclarado ?? "",
        extensao: extensao ?? "",
      },
      { actor, metadata: extractRequestMetadata(req) },
    );
  }

  @Get("arquivo")
  @UseGuards(AuthorizationGuard)
  @RequirePermission("ausencia", "read")
  @ApiOperation({ summary: "Baixa o anexo da ausencia (privado)" })
  async baixar(
    @Param("ausenciaId", ParseUUIDPipe) ausenciaId: string,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const arquivo = await this.service.baixar(ausenciaId, {
      actor,
      metadata: extractRequestMetadata(req),
    });
    res.set({
      "Content-Type": arquivo.tipo,
      "Content-Length": String(arquivo.bytes.length),
      // Dado de saúde: nada em cache compartilhado nem em disco.
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": `attachment; filename="${arquivo.nome}"`,
      "Content-Security-Policy": "default-src 'none'; sandbox",
    });
    res.status(200).end(arquivo.bytes);
  }

  @Delete()
  @HttpCode(200)
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("ausencia", "alter")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Remove (logicamente) o anexo da ausencia" })
  async remover(
    @Param("ausenciaId", ParseUUIDPipe) ausenciaId: string,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.remover(ausenciaId, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }
}
