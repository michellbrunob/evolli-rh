import { Injectable, UnprocessableEntityException } from "@nestjs/common";
import { AccessRole } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import { PasswordHashService } from "../auth/password/password-hash.service";
import { PasswordPolicyService } from "../auth/password/password-policy.service";
import { SessionService } from "../auth/session/session.service";
import { normalizeEmail } from "../auth/normalize-email.util";
import { toSafeUser, SafeAccessUser } from "../auth/safe-user.util";

export interface CreateUserInput {
  email: string;
  password: string;
  role: AccessRole;
  companyId?: string;
  unitId?: string;
  teamId?: string;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordHashService: PasswordHashService,
    private readonly passwordPolicyService: PasswordPolicyService,
    private readonly sessionService: SessionService,
  ) {}

  async createUser(input: CreateUserInput): Promise<SafeAccessUser> {
    // Autorização já aplicada pelo AuthorizationGuard (RequirePermission
    // "user_role"/"create") antes deste método rodar.
    if (!this.passwordPolicyService.isValid(input.password)) {
      throw new UnprocessableEntityException();
    }

    const passwordHash = await this.passwordHashService.hash(input.password);

    const user = await this.prisma.accessUser.create({
      data: {
        email: normalizeEmail(input.email),
        passwordHash,
        role: input.role,
        companyId: input.companyId ?? null,
        unitId: input.unitId ?? null,
        teamId: input.teamId ?? null,
      },
    });

    return toSafeUser(user);
  }

  async updateRole(
    targetUserId: string,
    role: AccessRole,
    companyId?: string,
    unitId?: string,
    teamId?: string,
  ): Promise<SafeAccessUser> {
    // Autorização já aplicada pelo AuthorizationGuard (RequirePermission
    // "user_role"/"alter") antes deste método rodar.
    const user = await this.prisma.accessUser.update({
      where: { id: targetUserId },
      data: {
        role,
        companyId: companyId ?? null,
        unitId: unitId ?? null,
        teamId: teamId ?? null,
      },
    });
    return toSafeUser(user);
  }

  async disable(targetUserId: string): Promise<void> {
    await this.prisma.accessUser.update({
      where: { id: targetUserId },
      data: { status: "disabled" },
    });
    await this.sessionService.revokeAllForUser(
      targetUserId,
      "account_disabled",
    );
  }
}
