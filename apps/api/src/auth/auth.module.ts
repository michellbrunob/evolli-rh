import { forwardRef, Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { PasswordHashService } from "./password/password-hash.service";
import { PasswordPolicyService } from "./password/password-policy.service";
import { SessionService } from "./session/session.service";
import { SessionGuard } from "./session/session.guard";
import { CsrfGuard } from "./csrf/csrf.guard";
import { RateLimitService } from "./rate-limit/rate-limit.service";
import { AuthorizationGuard } from "./authorization/authorization.guard";
import { CREDENTIAL_VERIFIER } from "./credential/credential-verifier.interface";
import { LocalCredentialVerifier } from "./credential/local-credential-verifier.service";
import { EMAIL_NOTIFIER } from "./email/email-notifier.interface";
import { NoopEmailNotifier } from "./email/noop-email-notifier.service";
import { MfaController } from "./mfa/mfa.controller";
import { MfaService } from "./mfa/mfa.service";
import { TotpSecretCipher } from "./mfa/crypto/totp-secret-cipher";
import { AuditModule } from "../audit/audit.module";

@Module({
  imports: [forwardRef(() => AuditModule)],
  controllers: [AuthController, MfaController],
  providers: [
    AuthService,
    PasswordHashService,
    PasswordPolicyService,
    SessionService,
    SessionGuard,
    CsrfGuard,
    RateLimitService,
    AuthorizationGuard,
    // T125 — MFA TOTP no mesmo módulo (sem dependência circular): `MfaService`
    // usa Session/PasswordHash/Audit já presentes aqui; `AuthService` usa
    // `MfaService` no login.
    MfaService,
    TotpSecretCipher,
    { provide: CREDENTIAL_VERIFIER, useClass: LocalCredentialVerifier },
    { provide: EMAIL_NOTIFIER, useClass: NoopEmailNotifier },
  ],
  exports: [
    PasswordHashService,
    PasswordPolicyService,
    SessionService,
    SessionGuard,
    CsrfGuard,
    AuthorizationGuard,
    RateLimitService,
    // Exportado para o `UsersModule` expor a rota de reset administrativo.
    MfaService,
  ],
})
export class AuthModule {}
