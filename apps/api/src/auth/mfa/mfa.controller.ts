import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Request, Response } from "express";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { AccessUser } from "@prisma/client";
import { MfaService } from "./mfa.service";
import { MfaEnabledGuard } from "./mfa-enabled.guard";
import { MfaConfirmDto, MfaVerifyDto } from "./dto/mfa.dto";
import { SessionGuard } from "../session/session.guard";
import { CsrfGuard } from "../csrf/csrf.guard";
import { CurrentUser } from "../session/current-user.decorator";
import { setSessionCookie } from "../session/session-cookie.util";
import { extractRequestMetadata } from "../request-metadata.util";

/**
 * MFA TOTP (T125) — cadastro autenticado e verificação do 2º fator no login.
 *
 * - `enroll`/`confirm`: exigem sessão + CSRF (o ator configura o PRÓPRIO MFA;
 *   escopo derivado da sessão, nunca de id do navegador).
 * - `verify`: NÃO exige sessão nem CSRF — não há sessão ainda, e a credencial
 *   é o `challengeToken` opaco (que um atacante cross-site não possui), mesmo
 *   modelo do `login`. Emite a sessão plena só após o 2º fator.
 *
 * O segredo/URI de provisionamento saem do servidor SÓ no `enroll`; os códigos
 * de recuperação, SÓ no `confirm`. Nunca reexibidos depois.
 */
@ApiTags("auth")
@Controller("auth/mfa")
// T131 — quando o MFA está desativado por configuração de servidor, TODAS as
// rotas de MFA respondem 404 (o portão roda antes de Session/CSRF). Ativado,
// os fluxos T125/T126 valem integralmente.
@UseGuards(MfaEnabledGuard)
export class MfaController {
  constructor(
    private readonly mfaService: MfaService,
    private readonly configService: ConfigService,
  ) {}

  @Post("totp/enroll")
  @UseGuards(SessionGuard, CsrfGuard)
  @ApiOperation({
    summary:
      "Inicia o cadastro do fator TOTP e devolve o material de provisionamento",
  })
  async enroll(@CurrentUser() actor: AccessUser, @Req() req: Request) {
    return this.mfaService.startEnrollment(actor, extractRequestMetadata(req));
  }

  @Post("totp/confirm")
  @UseGuards(SessionGuard, CsrfGuard)
  @ApiOperation({
    summary:
      "Confirma um código TOTP, ativa o fator e retorna 10 códigos de recuperação (exibição única)",
  })
  async confirm(
    @Body() dto: MfaConfirmDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.mfaService.confirmEnrollment(
      actor,
      dto.code,
      extractRequestMetadata(req),
    );
  }

  @Post("verify")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      "Verifica o 2º fator (TOTP ou código de recuperação) e emite a sessão plena",
  })
  async verify(
    @Body() dto: MfaVerifyDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const issued = await this.mfaService.completeMfaLogin(
      dto.challengeToken,
      dto.code,
      extractRequestMetadata(req),
    );
    setSessionCookie(res, issued.token, this.configService);
    return { csrfToken: issued.csrfToken };
  }
}
