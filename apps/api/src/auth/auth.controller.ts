import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Request, Response } from "express";
import { ApiTags } from "@nestjs/swagger";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { PasswordForgotDto } from "./dto/password-forgot.dto";
import { PasswordResetDto } from "./dto/password-reset.dto";
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

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly sessionService: SessionService,
    private readonly configService: ConfigService,
  ) {}

  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const metadata = extractRequestMetadata(req);
    const issued = await this.authService.login(
      dto.email,
      dto.password,
      metadata,
    );
    setSessionCookie(res, issued.token, this.configService);
    return { csrfToken: issued.csrfToken };
  }

  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(SessionGuard, CsrfGuard)
  async logout(
    @CurrentSession() session: AccessSession,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.sessionService.revokeById(session.id, "logout");
    clearSessionCookie(res, this.configService);
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

    await this.sessionService.revokeById(
      sessionId,
      isOwnSession ? "revoked_by_self" : "revoked_by_admin",
    );
  }

  @Post("password/forgot")
  @HttpCode(HttpStatus.ACCEPTED)
  async forgotPassword(@Body() dto: PasswordForgotDto, @Req() req: Request) {
    const { ip } = extractRequestMetadata(req);
    await this.authService.requestPasswordReset(dto.email, ip);
    // Resposta genérica sempre — nunca revela se o e-mail existe (spec §6).
    return { status: "ok" };
  }

  @Post("password/reset")
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetPassword(
    @Body() dto: PasswordResetDto,
    @Req() req: Request,
  ): Promise<void> {
    const { ip } = extractRequestMetadata(req);
    await this.authService.resetPassword(dto.token, dto.newPassword, ip);
  }
}
