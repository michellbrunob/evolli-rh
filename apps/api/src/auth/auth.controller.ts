import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Request, Response } from "express";
import {
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { PasswordForgotDto } from "./dto/password-forgot.dto";
import { PasswordResetDto } from "./dto/password-reset.dto";
import { TrocarEmpresaDto } from "./dto/trocar-empresa.dto";
import { SessionGuard } from "./session/session.guard";
import { CsrfGuard } from "./csrf/csrf.guard";
import { CurrentSession, CurrentUser } from "./session/current-user.decorator";
import {
  clearSessionCookie,
  setSessionCookie,
} from "./session/session-cookie.util";
import { extractRequestMetadata } from "./request-metadata.util";
import { SessionService } from "./session/session.service";
import { evaluatePermission } from "./authorization/rbac.evaluator";
import { AccessSession, AccessUser } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../database/prisma.service";
import { ContextoEmpresarialService } from "./contexto-empresarial.service";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly sessionService: SessionService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
    private readonly prisma: PrismaService,
    private readonly contextoEmpresarial: ContextoEmpresarialService,
  ) {}

  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const metadata = extractRequestMetadata(req);
    const outcome = await this.authService.login(
      dto.email,
      dto.password,
      metadata,
    );
    // T125 — conta com MFA ativo: sem cookie de sessão; devolve o challenge
    // para a 2ª etapa (`POST /v1/auth/mfa/verify`). A resposta não revela
    // fator/estado além do necessário para o cliente prosseguir.
    if (outcome.kind === "mfa_required") {
      return { mfaRequired: true, challengeToken: outcome.challengeToken };
    }
    setSessionCookie(res, outcome.issued.token, this.configService);
    return { csrfToken: outcome.issued.csrfToken };
  }

  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(SessionGuard, CsrfGuard)
  async logout(
    @CurrentSession() session: AccessSession,
    @CurrentUser() user: AccessUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const metadata = extractRequestMetadata(req);

    // Revogação e evento de auditoria na mesma transação (ADR 0004 §2) —
    // ou os dois persistem, ou nenhum. O cookie só é limpo depois do
    // commit, nunca antes.
    await this.prisma.$transaction(async (tx) => {
      await this.sessionService.revokeById(session.id, "logout", tx);
      await this.auditService.record(
        {
          actorType: "user",
          actorUserId: user.id,
          actorRole: user.role,
          companyId: user.companyId,
          action: "logout",
          resource: "access_session",
          resourceId: session.id,
          ip: metadata.ip,
          userAgent: metadata.userAgent,
          result: "success",
          requestId: metadata.requestId,
        },
        tx,
      );
    });

    clearSessionCookie(res, this.configService);
  }

  // Rotação, não leitura (ADR 0009 §4): o banco guarda só o hash do token
  // CSRF, então recuperá-lo após um reload é impossível por desenho. Cada
  // chamada emite um token novo e invalida o anterior desta sessão — uma
  // mutação que ainda carregue o token antigo passa a ser recusada com 403
  // pelo CsrfGuard. Sendo GET, não exige token CSRF para ser chamado.
  @Get("csrf")
  @UseGuards(SessionGuard)
  @Header("Cache-Control", "no-store")
  @ApiOperation({
    summary: "Emite um token CSRF novo para a sessão autenticada",
    description:
      "Exige sessão válida (cookie de sessão HttpOnly). Gera um token CSRF novo, " +
      "persiste somente seu hash e invalida o token anterior da mesma sessão. " +
      "Não altera nenhum dado de RH e não concede autorização.",
  })
  @ApiOkResponse({
    description: "Token CSRF novo, válido para a sessão corrente.",
    schema: {
      type: "object",
      required: ["csrfToken"],
      properties: {
        csrfToken: {
          type: "string",
          description:
            "Enviar no header x-csrf-token das requisições de mudança de estado. " +
            "Manter apenas em memória — nunca em localStorage ou sessionStorage.",
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: "Sessão ausente, expirada ou revogada.",
  })
  async issueCsrfToken(@CurrentSession() session: AccessSession) {
    const csrfToken = await this.sessionService.rotateCsrfToken(session.id);

    if (!csrfToken) {
      throw new UnauthorizedException();
    }

    return { csrfToken };
  }

  @Get("sessions")
  @UseGuards(SessionGuard)
  async listSessions(@CurrentUser() user: AccessUser) {
    const sessions = await this.sessionService.listActiveForUser(user.id);
    return sessions.map((session) => ({
      id: session.id,
      createdAt: session.createdAt,
      lastSeenAt: session.lastSeenAt,
      expiresAt: session.expiresAt,
      ip: session.ip,
      userAgent: session.userAgent,
    }));
  }

  @Delete("sessions/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(SessionGuard, CsrfGuard)
  async revokeSession(
    @Param("id") sessionId: string,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ): Promise<void> {
    const target = await this.sessionService.findByIdWithUser(sessionId);

    if (!target) {
      throw new NotFoundException();
    }

    const isOwnSession = target.userId === actor.id;
    const allowed =
      isOwnSession ||
      evaluatePermission(
        { userId: actor.id, role: actor.role, companyId: actor.companyId },
        {
          resource: "other_account",
          action: "manage",
          targetUserId: target.userId,
          targetCompanyId: target.user.companyId,
        },
      );

    if (!allowed) {
      throw new ForbiddenException();
    }

    const metadata = extractRequestMetadata(req);

    // Revogação e evento de auditoria na mesma transação (ADR 0004 §2).
    await this.prisma.$transaction(async (tx) => {
      await this.sessionService.revokeById(
        sessionId,
        isOwnSession ? "revoked_by_self" : "revoked_by_admin",
        tx,
      );
      await this.auditService.record(
        {
          actorType: "user",
          actorUserId: actor.id,
          actorRole: actor.role,
          companyId: actor.companyId,
          action: "session_revoked",
          resource: "access_session",
          resourceId: sessionId,
          ip: metadata.ip,
          userAgent: metadata.userAgent,
          result: "success",
          requestId: metadata.requestId,
        },
        tx,
      );
    });
  }

  /**
   * T163 — empresas que esta conta pode usar como contexto de trabalho.
   *
   * Leitura, então sem CSRF — mesma disciplina de `GET /auth/sessions`.
   *
   * **Papel sem poder de seleção recebe 403, não lista vazia.** É o princípio
   * 10 aplicado no servidor: empresa autorizada não é exposta a quem não
   * seleciona, e a interface não precisa lembrar de esconder. Gestor e
   * colaborador param aqui mesmo chamando a rota direto.
   */
  @Get("contexto/empresas")
  @UseGuards(SessionGuard)
  @ApiOperation({ summary: "Empresas autorizadas para o contexto de trabalho" })
  async listarEmpresasDoContexto(@CurrentUser() actor: AccessUser) {
    return { itens: await this.contextoEmpresarial.listar(actor) };
  }

  /**
   * T163 — troca o contexto empresarial ativo DESTA sessão.
   *
   * Mutação: exige CSRF. O contexto é gravado em `access_session`, não num
   * cookie escrito pelo frontend nem em storage do navegador — então outra
   * aba da mesma pessoa **não** muda de contexto, e um logout leva a seleção
   * embora junto com a sessão.
   *
   * Empresa inexistente, inativa ou não autorizada respondem **404**, todas
   * iguais: 403 confirmaria a existência da empresa.
   */
  @Post("contexto/empresa")
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionGuard, CsrfGuard)
  @ApiOperation({ summary: "Troca a empresa ativa da sessão" })
  async trocarEmpresaDoContexto(
    @Body() dto: TrocarEmpresaDto,
    @CurrentUser() actor: AccessUser,
    @CurrentSession() session: AccessSession,
    @Req() req: Request,
  ) {
    const empresa = await this.contextoEmpresarial.trocar(
      session.id,
      dto.empresaId,
      {
        actor,
        metadata: extractRequestMetadata(req),
        requestId: req.requestId,
      },
    );
    return { empresaAtiva: empresa };
  }

  @Post("password/forgot")
  @HttpCode(HttpStatus.ACCEPTED)
  async forgotPassword(@Body() dto: PasswordForgotDto, @Req() req: Request) {
    const metadata = extractRequestMetadata(req);
    await this.authService.requestPasswordReset(dto.email, metadata);
    // Resposta genérica sempre — nunca revela se o e-mail existe (spec §6).
    return { status: "ok" };
  }

  @Post("password/reset")
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetPassword(
    @Body() dto: PasswordResetDto,
    @Req() req: Request,
  ): Promise<void> {
    const metadata = extractRequestMetadata(req);
    await this.authService.resetPassword(dto.token, dto.newPassword, metadata);
  }
}
