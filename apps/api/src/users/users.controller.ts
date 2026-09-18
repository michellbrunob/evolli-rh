import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Request } from "express";
import { AccessUser } from "@prisma/client";
import { UsersService } from "./users.service";
import { CreateUserDto } from "../auth/dto/create-user.dto";
import { UpdateUserRoleDto } from "../auth/dto/update-user-role.dto";
import { ListarUsuariosQueryDto } from "./dto/listar-usuarios-query.dto";
import { SessionGuard } from "../auth/session/session.guard";
import { CsrfGuard } from "../auth/csrf/csrf.guard";
import { AuthorizationGuard } from "../auth/authorization/authorization.guard";
import { RequirePermission } from "../auth/authorization/require-permission.decorator";
import { CurrentUser } from "../auth/session/current-user.decorator";
import { toSafeUser } from "../auth/safe-user.util";
import { extractRequestMetadata } from "../auth/request-metadata.util";
import { MfaService } from "../auth/mfa/mfa.service";
import { MfaConfigService } from "../auth/mfa/mfa-config.service";
import { MfaEnabledGuard } from "../auth/mfa/mfa-enabled.guard";

@ApiTags("users")
@Controller("users")
@UseGuards(SessionGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly mfaService: MfaService,
    private readonly mfaConfig: MfaConfigService,
  ) {}

  @Get("me")
  getMe(@CurrentUser() user: AccessUser) {
    // `mfaAvailable` reflete o interruptor de servidor do MFA (T131). É a fonte
    // que o SPA usa para exibir/ocultar as ações de MFA — mas o servidor
    // continua autoritativo: as rotas de MFA respondem 404 quando desativado,
    // independentemente do que a interface decidir mostrar.
    return { ...toSafeUser(user), mfaAvailable: this.mfaConfig.isEnabled() };
  }

  /**
   * Listagem paginada de contas de acesso (T120). Leitura — sem CSRF.
   * `master_tecnico`: escopo global (aceita filtro `companyId`). `rh`/`dp`:
   * só a própria empresa (qualquer `companyId` de query é ignorado). Demais
   * papéis: negado pelo `AuthorizationGuard` antes de chegar aqui.
   */
  @Get()
  @UseGuards(AuthorizationGuard)
  @RequirePermission("other_account", "read")
  @ApiOperation({
    summary:
      "Lista contas de acesso — escopo global (master_tecnico) ou da própria empresa (rh/dp)",
  })
  async listar(
    @Query() query: ListarUsuariosQueryDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.usersService.listar(query, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }

  @Post()
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("user_role", "create")
  async create(
    @Body() dto: CreateUserDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.usersService.createUser(dto, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }

  @Patch(":id/role")
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("user_role", "alter")
  async updateRole(
    @Param("id") targetUserId: string,
    @Body() dto: UpdateUserRoleDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.usersService.updateRole(targetUserId, dto.role, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }

  @Post(":id/disable")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("other_account", "manage")
  async disable(
    @Param("id") targetUserId: string,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ): Promise<void> {
    await this.usersService.disable(targetUserId, {
      actor,
      metadata: extractRequestMetadata(req),
    });
  }

  /**
   * Redefinição administrativa de MFA (T125). Capacidade `mfa`/`reset`: só
   * `master_tecnico` (global) e `rh` (própria empresa) — `dp` e demais recebem
   * negação (403 dentro do escopo; 404 anti-enumeração para alvo de outra
   * empresa, aplicado pelo `AuthorizationGuard`). Remove o fator, invalida
   * challenges, apaga códigos de recuperação e revoga as sessões do alvo,
   * obrigando nova configuração. Nunca lê nem expõe segredo/códigos.
   */
  @Post(":id/mfa/reset")
  @HttpCode(HttpStatus.NO_CONTENT)
  // T131 — `MfaEnabledGuard` primeiro: com o MFA desativado por configuração, o
  // reset administrativo responde 404 (indisponível de forma coerente), antes
  // de CSRF/autorização.
  @UseGuards(MfaEnabledGuard, CsrfGuard, AuthorizationGuard)
  @RequirePermission("mfa", "reset")
  async resetMfa(
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ): Promise<void> {
    // O alvo já foi resolvido e validado (existência + escopo) pelo
    // AuthorizationGuard a partir do `:id` de rota — nunca de um id do corpo.
    const targetUser = req.authorizationTargetUser;
    if (!targetUser) {
      return;
    }
    await this.mfaService.resetForUser(targetUser, actor, {
      ...extractRequestMetadata(req),
    });
  }
}
