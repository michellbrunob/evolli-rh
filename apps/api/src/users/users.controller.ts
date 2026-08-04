import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AccessUser } from "@prisma/client";
import { UsersService } from "./users.service";
import { CreateUserDto } from "../auth/dto/create-user.dto";
import { UpdateUserRoleDto } from "../auth/dto/update-user-role.dto";
import { SessionGuard } from "../auth/session/session.guard";
import { CsrfGuard } from "../auth/csrf/csrf.guard";
import { AuthorizationGuard } from "../auth/authorization/authorization.guard";
import { RequirePermission } from "../auth/authorization/require-permission.decorator";
import { CurrentUser } from "../auth/session/current-user.decorator";
import { toSafeUser } from "../auth/safe-user.util";

@ApiTags("users")
@Controller("users")
@UseGuards(SessionGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get("me")
  getMe(@CurrentUser() user: AccessUser) {
    return toSafeUser(user);
  }

  @Post()
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("user_role", "create")
  async create(@Body() dto: CreateUserDto) {
    return this.usersService.createUser(dto);
  }

  @Patch(":id/role")
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("user_role", "alter")
  async updateRole(
    @Param("id") targetUserId: string,
    @Body() dto: UpdateUserRoleDto,
  ) {
    return this.usersService.updateRole(
      targetUserId,
      dto.role,
      dto.companyId,
      dto.unitId,
      dto.teamId,
    );
  }

  @Post(":id/disable")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("other_account", "manage")
  async disable(@Param("id") targetUserId: string): Promise<void> {
    await this.usersService.disable(targetUserId);
  }
}
