import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from "class-validator";
import { ACCESS_ROLES } from "../access-roles.const";

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;

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
