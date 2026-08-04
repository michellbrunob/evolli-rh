import { IsIn, IsOptional, IsString } from "class-validator";
import { ACCESS_ROLES } from "../access-roles.const";

export class UpdateUserRoleDto {
  @IsIn(ACCESS_ROLES)
  role!: (typeof ACCESS_ROLES)[number];

  @IsOptional()
  @IsString()
  companyId?: string;

  @IsOptional()
  @IsString()
  unitId?: string;

  @IsOptional()
  @IsString()
  teamId?: string;
}
