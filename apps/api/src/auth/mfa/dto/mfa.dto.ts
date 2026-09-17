import { IsString, Matches, MinLength } from "class-validator";

/** Confirmação de cadastro: um código TOTP de 6 dígitos. */
export class MfaConfirmDto {
  @IsString()
  @Matches(/^\d{6}$/u, { message: "Código inválido." })
  code!: string;
}

/**
 * Verificação de login MFA: o challenge opaco emitido no login + o código
 * (TOTP de 6 dígitos OU código de recuperação `XXXXX-XXXXX`). Aceita ambos os
 * formatos em `code` — o servidor decide qual tentar, sem revelar o tipo.
 */
export class MfaVerifyDto {
  @IsString()
  @MinLength(1)
  challengeToken!: string;

  @IsString()
  @MinLength(1)
  code!: string;
}
