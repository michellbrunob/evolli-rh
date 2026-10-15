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
import { PrismaService } from "../database/prisma.service";

@ApiTags("users")
@Controller("users")
@UseGuards(SessionGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly mfaService: MfaService,
    private readonly mfaConfig: MfaConfigService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * O ator da sessão, como o SPA o enxerga.
   *
   * T163 — três coisas aqui mudaram de significado ou nasceram:
   *
   * - `companyId` é a empresa **ATIVA** desta sessão, não mais a coluna fixa
   *   da conta: o ator já chega com o contexto resolvido pelo `SessionGuard`;
   * - `empresaAtiva` traz **nome e código** dessa empresa. Existe para matar a
   *   ressalva R-2 da T162: o Hub lia `GET /v1/empresas` a cada montagem só
   *   para descobrir o nome, e aquela rota chama `registrarConsultaAmpla` —
   *   um registro de auditoria por visita ao Hub. Aqui a leitura é direta, por
   *   id, sem auditoria de consulta ampla, e acontece numa rota que o SPA já
   *   chamava de qualquer forma;
   * - `podeTrocarEmpresa` diz se o Hub deve desenhar seletor.
   *
   * A **lista** de empresas continua fora daqui, em
   * `GET /v1/auth/contexto/empresas`, que recusa papel sem poder de seleção.
   * Assim quem não seleciona nunca recebe nomes de outras empresas — nem por
   * engano, nem por campo esquecido nesta projeção.
   */
  @Get("me")
  async getMe(@CurrentUser() user: AccessUser) {
    const comContexto = user as AccessUser & { podeTrocarEmpresa?: boolean };

    const empresaAtiva =
      user.companyId === null
        ? null
        : await this.prisma.empresa.findUnique({
            where: { id: user.companyId },
            select: { id: true, codigo: true, nome: true },
          });

    return {
      ...toSafeUser(user),
      mfaAvailable: this.mfaConfig.isEnabled(),
      podeTrocarEmpresa: comContexto.podeTrocarEmpresa === true,
      empresaAtiva,
    };
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
