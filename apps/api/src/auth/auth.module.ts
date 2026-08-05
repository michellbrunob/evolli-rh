import { Module } from "@nestjs/common";
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

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordHashService,
    PasswordPolicyService,
    SessionService,
    SessionGuard,
    CsrfGuard,
    RateLimitService,
    AuthorizationGuard,
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
  ],
})
export class AuthModule {}
