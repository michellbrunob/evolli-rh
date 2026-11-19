import {
  Controller,
  Delete,
  Get,
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
import { RecusaDeNegocioException } from "../../common/erros/recusa-por-campo";
import {
  CABECALHO_IDEMPOTENCIA,
  CABECALHO_REENVIO,
  chaveDeIdempotencia,
} from "../colaborador/colaborador.controller";
import { DOCUMENTO_LIMITE_BYTES } from "./documento-colaborador.arquivo";
import {
  DocumentoColaboradorService,
  type ResultadoDoEnvio,
} from "./documento-colaborador.service";

/** Categoria do documento (rg, cpf, comprovante_endereco, …, outros). */
export const CABECALHO_CATEGORIA_DO_DOCUMENTO = "x-evolli-documento-categoria";
/** Nome curto de "outros", codificado com `encodeURIComponent`. */
export const CABECALHO_NOME_DO_DOCUMENTO = "x-evolli-documento-nome";
/** Tipo declarado do arquivo escolhido. */
export const CABECALHO_TIPO_DO_DOCUMENTO = "x-evolli-documento-tipo";
/** Extensão do arquivo escolhido — o nome original nunca é enviado. */
export const CABECALHO_EXTENSAO_DO_DOCUMENTO = "x-evolli-documento-extensao";

function decodificarNome(bruto: string | undefined): string | undefined {
  if (bruto === undefined) return undefined;
  try {
    return decodeURIComponent(bruto);
  } catch {
    throw new RecusaDeNegocioException("documento_nome_invalido");
  }
}

/**
 * T213 — documentos do colaborador com arquivo (ADR 0021). Rotas próprias e
 * autenticadas: o navegador nunca fala com o armazenamento.
 *
 * - `GET /documentos`: lista e estado.
 * - `POST /documentos`: novo documento (corpo `application/octet-stream`, até
 *   10 MB, categoria, nome de "outros", tipo e extensão nos cabeçalhos;
 *   `Idempotency-Key` opcional).
 * - `POST /documentos/:id/versoes`: troca (versão nova).
 * - `POST /documentos/:id/verificacao`: nova tentativa do antivírus.
 * - `DELETE /documentos/:id`: remoção lógica.
 * - `GET /documentos/:id/arquivo`: download da versão aprovada.
 */
@ApiTags("pessoas")
@Controller("colaboradores/:colaboradorId/documentos")
@UseGuards(SessionGuard)
export class DocumentoColaboradorController {
  constructor(private readonly service: DocumentoColaboradorService) {}

  @Get()
  @UseGuards(AuthorizationGuard)
  @RequirePermission("documento_colaborador", "read")
  @ApiOperation({ summary: "Documentos do colaborador (lista e estado)" })
  listar(
    @Param("colaboradorId", ParseUUIDPipe) colaboradorId: string,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.listar(colaboradorId, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }

  @Post()
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("documento_colaborador", "create")
  @ApiOperation({ summary: "Envia um documento do colaborador" })
  async enviar(
    @Param("colaboradorId", ParseUUIDPipe) colaboradorId: string,
    @Headers(CABECALHO_CATEGORIA_DO_DOCUMENTO) categoria: string | undefined,
    @Headers(CABECALHO_NOME_DO_DOCUMENTO) nome: string | undefined,
    @Headers(CABECALHO_TIPO_DO_DOCUMENTO) tipoDeclarado: string | undefined,
    @Headers(CABECALHO_EXTENSAO_DO_DOCUMENTO) extensao: string | undefined,
    @Headers(CABECALHO_IDEMPOTENCIA) chave: string | undefined,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const chaveValida = chaveDeIdempotencia(chave);
    const bytes = await this.lerArquivo(req);
    const resultado = await this.service.enviar(
      colaboradorId,
      {
        categoria,
        nome: decodificarNome(nome),
        arquivo: {
          bytes,
          tipoDeclarado: tipoDeclarado ?? "",
          extensao: extensao ?? "",
        },
      },
      chaveValida,
      { actor, metadata: extractRequestMetadata(req) },
    );
    return this.responder(resultado, res);
  }

  @Post(":documentoId/versoes")
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("documento_colaborador", "alter")
  @ApiOperation({ summary: "Troca o arquivo (cria versão nova)" })
  async trocar(
    @Param("colaboradorId", ParseUUIDPipe) colaboradorId: string,
    @Param("documentoId", ParseUUIDPipe) documentoId: string,
    @Headers(CABECALHO_TIPO_DO_DOCUMENTO) tipoDeclarado: string | undefined,
    @Headers(CABECALHO_EXTENSAO_DO_DOCUMENTO) extensao: string | undefined,
    @Headers(CABECALHO_IDEMPOTENCIA) chave: string | undefined,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const chaveValida = chaveDeIdempotencia(chave);
    const bytes = await this.lerArquivo(req);
    const resultado = await this.service.trocar(
      colaboradorId,
      documentoId,
      { bytes, tipoDeclarado: tipoDeclarado ?? "", extensao: extensao ?? "" },
      chaveValida,
      { actor, metadata: extractRequestMetadata(req) },
    );
    return this.responder(resultado, res);
  }

  @Post(":documentoId/verificacao")
  @HttpCode(200)
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("documento_colaborador", "alter")
  @ApiOperation({ summary: "Nova tentativa da verificação antivírus" })
  verificarDeNovo(
    @Param("colaboradorId", ParseUUIDPipe) colaboradorId: string,
    @Param("documentoId", ParseUUIDPipe) documentoId: string,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.verificarDeNovo(colaboradorId, documentoId, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }

  @Delete(":documentoId")
  @HttpCode(204)
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("documento_colaborador", "alter")
  @ApiOperation({ summary: "Remove o documento (remoção lógica)" })
  async remover(
    @Param("colaboradorId", ParseUUIDPipe) colaboradorId: string,
    @Param("documentoId", ParseUUIDPipe) documentoId: string,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    await this.service.remover(colaboradorId, documentoId, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }

  @Get(":documentoId/arquivo")
  @UseGuards(AuthorizationGuard)
  @RequirePermission("conteudo_documento_colaborador", "read")
  @ApiOperation({ summary: "Baixa o arquivo aprovado (privado)" })
  async baixar(
    @Param("colaboradorId", ParseUUIDPipe) colaboradorId: string,
    @Param("documentoId", ParseUUIDPipe) documentoId: string,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const arquivo = await this.service.baixar(colaboradorId, documentoId, {
      actor,
      metadata: extractRequestMetadata(req),
    });
    res.set({
      "Content-Type": arquivo.tipo,
      "Content-Length": String(arquivo.bytes.length),
      // Dado pessoal: nada em cache compartilhado nem em disco.
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": `attachment; filename="${arquivo.nome}"`,
      "Content-Security-Policy": "default-src 'none'; sandbox",
    });
    res.status(200).end(arquivo.bytes);
  }

  private async lerArquivo(req: Request): Promise<Buffer> {
    const tipo = String(req.headers["content-type"] ?? "").split(";")[0] ?? "";
    if (tipo.trim().toLowerCase() !== "application/octet-stream") {
      req.resume();
      throw new UnsupportedMediaTypeException();
    }
    return lerCorpoLimitado(req, DOCUMENTO_LIMITE_BYTES);
  }

  private responder(resultado: ResultadoDoEnvio, res: Response) {
    if (resultado.reenvio) res.setHeader(CABECALHO_REENVIO, "true");
    res.status(resultado.reenvio ? 200 : 201);
    return resultado.documento;
  }
}
