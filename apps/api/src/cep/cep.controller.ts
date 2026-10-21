import { Controller, Get, Header, Param, Req, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { AccessUser } from "@prisma/client";
import { Request } from "express";
import { SessionGuard } from "../auth/session/session.guard";
import { AuthorizationGuard } from "../auth/authorization/authorization.guard";
import { RequirePermission } from "../auth/authorization/require-permission.decorator";
import { CurrentUser } from "../auth/session/current-user.decorator";
import { CepService } from "./cep.service";
import { EnderecoSugerido } from "./cep.types";

/**
 * T178 — rota interna de consulta de CEP. O navegador fala só com o Evolli;
 * o Evolli fala com o fornecedor.
 *
 * Quem consulta: quem admite (`colaborador`/`create` — `rh` e `dp`, na
 * própria empresa). Não é capacidade nova: a consulta só serve ao cadastro de
 * endereço da Nova admissão. CEP não é dado de empresa, então não há escopo
 * de empresa a aplicar além de exigir quem admite.
 *
 * Respostas: 200 com a sugestão; 400 CEP fora da forma (8 dígitos); 404 CEP
 * inexistente; 429 limite de consultas; 503 fornecedor indisponível ou lento.
 */
@ApiTags("enderecos")
@Controller("cep")
@UseGuards(SessionGuard)
export class CepController {
  constructor(private readonly service: CepService) {}

  @Get(":cep")
  @UseGuards(AuthorizationGuard)
  @RequirePermission("colaborador", "create")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Sugere endereço para um CEP brasileiro" })
  consultar(
    @Param("cep") cep: string,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ): Promise<EnderecoSugerido> {
    return this.service.consultar(cep, actor.id, req.requestId);
  }
}
