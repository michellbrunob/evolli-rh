import { CanActivate, Injectable, NotFoundException } from "@nestjs/common";
import { MfaConfigService } from "./mfa-config.service";

/**
 * Portão de disponibilidade do MFA (T131).
 *
 * Quando o MFA está DESATIVADO por configuração de servidor (`MFA_ENABLED=false`,
 * padrão do lançamento inicial), as rotas de MFA — cadastro, confirmação,
 * verificação de 2º fator e reset administrativo — respondem `404 Not Found`,
 * como se não existissem. Isso deixa a funcionalidade indisponível de forma
 * coerente, sem revelar implementação interna nem oferecer um caminho que
 * sempre falharia.
 *
 * Declarado ANTES de `SessionGuard`/`CsrfGuard`/`AuthorizationGuard` nas rotas,
 * para que a indisponibilidade seja uniforme (mesmo 404) independentemente de
 * autenticação — evitando distinguir "desativado" de "não autorizado".
 */
@Injectable()
export class MfaEnabledGuard implements CanActivate {
  constructor(private readonly mfaConfig: MfaConfigService) {}

  canActivate(): boolean {
    if (!this.mfaConfig.isEnabled()) {
      throw new NotFoundException();
    }
    return true;
  }
}
