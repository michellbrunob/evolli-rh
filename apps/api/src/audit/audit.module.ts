import { forwardRef, Module } from "@nestjs/common";
import { AuditController } from "./audit.controller";
import { AuditService } from "./audit.service";
import { AuthModule } from "../auth/auth.module";

/**
 * `AuditModule` e `AuthModule` se importam mutuamente (`forwardRef`):
 * `AuditController` exige os guards de `AuthModule` (sessão, CSRF,
 * autorização); `AuthService`/`AuthorizationGuard`/`RateLimitService`
 * (em `AuthModule`) precisam de `AuditService` para gravar eventos. Nenhum
 * dos dois lado tem ciclo de instanciação real — só de tipos de módulo.
 */
@Module({
  imports: [forwardRef(() => AuthModule)],
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
