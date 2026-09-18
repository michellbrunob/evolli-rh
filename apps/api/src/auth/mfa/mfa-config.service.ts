import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

/**
 * Configuração de servidor do MFA (T131).
 *
 * Fonte ÚNICA da verdade: a variável de ambiente `MFA_ENABLED`, validada no
 * boot por `env.validation.ts` (estrita, padrão `false`). NUNCA é controlada
 * pelo navegador, query string, banco de dados ou endpoint administrativo —
 * ligar/desligar o MFA é uma mudança de configuração técnica controlada, não
 * uma ação de UI.
 *
 * Enquanto desativado (lançamento inicial), o ecossistema opera sem 2º fator e
 * a chave de cifragem do segredo TOTP não é exigida no boot. Quando ativado, os
 * fluxos T125/T126 voltam a valer integralmente e a chave passa a ser
 * obrigatória (fail-closed).
 */
@Injectable()
export class MfaConfigService {
  constructor(private readonly config: ConfigService) {}

  /** `true` somente quando `MFA_ENABLED=true` foi validado no boot. */
  isEnabled(): boolean {
    return this.config.get<boolean>("MFA_ENABLED") === true;
  }
}
