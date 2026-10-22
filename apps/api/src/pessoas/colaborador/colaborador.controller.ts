import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { AccessUser } from "@prisma/client";
import { Request, Response } from "express";
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
 * T179 — chave de idempotência do envio da admissão. Opcional na API (a tela
 * sempre a envia); quando vem, é um UUID, e a mesma chave do mesmo ator na
 * mesma empresa nunca cria duas admissões. O reenvio responde como a admissão
 * original, com `Idempotent-Replayed: true`.
 */
export const CABECALHO_IDEMPOTENCIA = "idempotency-key";
export const CABECALHO_REENVIO = "Idempotent-Replayed";
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Chave ausente vale como envio sem idempotência; fora da forma, 400. */
export function chaveDeIdempotencia(valor: unknown): string | undefined {
  if (valor === undefined) return undefined;
  if (typeof valor !== "string" || !UUID.test(valor)) {
    throw new BadRequestException();
  }
  return valor.toLowerCase();
}

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
    @Res({ passthrough: true }) res: Response,
    @Headers(CABECALHO_IDEMPOTENCIA) chaveRecebida?: string,
  ) {
    const { admissao, reenvio } = await this.service.admitirIdempotente(
      dto,
      { actor, metadata: extractRequestMetadata(req) },
      chaveDeIdempotencia(chaveRecebida),
    );
    if (reenvio) {
      res.setHeader(CABECALHO_REENVIO, "true");
    }
    return admissao;
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
