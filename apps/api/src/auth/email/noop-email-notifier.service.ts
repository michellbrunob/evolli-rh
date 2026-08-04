import { Injectable } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import { EmailNotifier } from "./email-notifier.interface";

/**
 * Implementação padrão desta fatia: não envia e-mail nenhum (nenhum
 * provedor externo integrado — pendência registrada em
 * docs/modules/etapa0-fatia3-identidade-acesso.md §11). Só registra que o
 * fluxo foi acionado, sem e-mail nem token no log.
 */
@Injectable()
export class NoopEmailNotifier implements EmailNotifier {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(NoopEmailNotifier.name);
  }

  async notifyPasswordResetRequested(): Promise<void> {
    this.logger.warn(
      "Recuperação de senha solicitada, mas nenhum provedor de e-mail está " +
        "integrado nesta fatia (pendência documentada) — nenhum e-mail foi enviado.",
    );
  }
}
