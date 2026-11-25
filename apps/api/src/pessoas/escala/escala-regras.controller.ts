import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
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
import {
  CriarFeriadoDto,
  EscalaRegrasService,
  SalvarRegrasDto,
} from "./escala-regras.service";

/**
 * T215 — Regras da escala da empresa ativa e os feriados locais:
 *
 * - `GET /escala/regras` (quem lê o quadro) e `PUT /escala/regras`;
 * - `POST /escala/feriados` e `DELETE /escala/feriados/:feriadoId`.
 *
 * Gravar é de `rh` e `dp`. Toda resposta traz as regras inteiras; `no-store`.
 */
@ApiTags("pessoas")
@Controller("escala")
@UseGuards(SessionGuard)
export class EscalaRegrasController {
  constructor(private readonly service: EscalaRegrasService) {}

  private ctx(actor: AccessUser, req: Request) {
    return { actor, metadata: extractRequestMetadata(req) };
  }

  @Get("regras")
  @UseGuards(AuthorizationGuard)
  @RequirePermission("escala_colaborador", "read")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Le as regras da escala da empresa ativa" })
  async consultar(@CurrentUser() actor: AccessUser, @Req() req: Request) {
    return this.service.consultar(this.ctx(actor, req));
  }

  @Put("regras")
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("escala_colaborador", "alter")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Salva as regras da escala" })
  async salvar(
    @Body() dto: SalvarRegrasDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.salvar(dto, this.ctx(actor, req));
  }

  @Post("feriados")
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("escala_colaborador", "alter")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Cadastra um feriado local" })
  async criarFeriado(
    @Body() dto: CriarFeriadoDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.criarFeriado(dto, this.ctx(actor, req));
  }

  @Delete("feriados/:feriadoId")
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("escala_colaborador", "alter")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Remove um feriado local" })
  async removerFeriado(
    @Param("feriadoId", ParseUUIDPipe) feriadoId: string,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.removerFeriado(feriadoId, this.ctx(actor, req));
  }
}
