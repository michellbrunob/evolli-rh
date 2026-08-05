export const EMAIL_NOTIFIER = Symbol("EMAIL_NOTIFIER");

/**
 * Envio real de e-mail transacional é integração externa fora de escopo
 * desta fatia (spec §1, §11 — pendência de provedor). Esta interface existe
 * para o fluxo de recuperação de senha funcionar de ponta a ponta em código
 * (gera/valida token) sem acoplar a nenhum provedor; a implementação real
 * (SMTP/SES/SendGrid etc.) é decisão futura.
 */
export interface EmailNotifier {
  notifyPasswordResetRequested(
    email: string,
    resetToken: string,
  ): Promise<void>;
}
