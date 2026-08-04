import { IsString, MinLength } from "class-validator";

export class PasswordResetDto {
  @IsString()
  token!: string;

  @IsString()
  @MinLength(1)
  newPassword!: string;
}
