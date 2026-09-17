/**
 * Parâmetros do núcleo MFA TOTP (T125) — valores confirmados no ticket. Fixos
 * nesta fatia, não configuráveis por env (mesmo critério de
 * `session.constants.ts`).
 */

/** Challenge de login MFA válido por 5 minutos (uso único). */
export const MFA_CHALLENGE_TTL_MS = 5 * 60 * 1000;

/** Janela de step-up para ações sensíveis: 5 minutos após reautenticação. */
export const MFA_STEP_UP_TTL_MS = 5 * 60 * 1000;

/** Exatamente 10 códigos de recuperação, gerados só na confirmação do fator. */
export const MFA_RECOVERY_CODE_COUNT = 10;

/** Rótulo do emissor no `otpauth://` URI (aparece no app autenticador). */
export const MFA_TOTP_ISSUER = "Evolli RH";
