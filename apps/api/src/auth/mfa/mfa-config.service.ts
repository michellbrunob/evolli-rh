import { Injectable } from "@nestjs/common";

/**
 * Configuração de servidor do MFA (T131).
 *
 * Fonte ÚNICA da verdade: a variável de ambiente `MFA_ENABLED`, validada no
 * boot por `env.validation.ts` (estrita, padrão `false`). NUNCA é controlada
 * pelo navegador, query string, banco de dados ou endpoint administrativo —
 * ligar/desligar o MFA é uma mudança de configuração técnica controlada, não
 * uma ação de UI.
 *
 * Lê `process.env.MFA_ENABLED` diretamente, em tempo de request. Sem parâmetro
 * de construtor (nenhuma dependência a resolver): o `env.validation.ts` já
 * restringe o valor a `"true"`/`"false"` no boot (ou a API não sobe), então
 * aqui basta reconhecer o "ligado" — exatamente a string `"true"`. Qualquer
 * outro valor mantém o MFA DESLIGADO (nunca liga por engano).
 *
 * Enquanto desativado (lançamento inicial), o ecossistema opera sem 2º fator e
 * a chave de cifragem do segredo TOTP não é exigida no boot. Quando ativado, os
 * fluxos T125/T126 voltam a valer integralmente e a chave passa a ser
 * obrigatória (fail-closed).
 */
@Injectable()
export class MfaConfigService {
  /** `true` somente quando `MFA_ENABLED` é exatamente `"true"`. */
  isEnabled(): boolean {
    return process.env.MFA_ENABLED === "true";
  }
}
