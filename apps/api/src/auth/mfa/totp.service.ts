import { Injectable } from "@nestjs/common";
import { authenticator } from "otplib";

const ISSUER = "Evolli RH";
// Janela mínima necessária para tolerância de relógio (parâmetro inicial
// desta fatia): ±1 passo de 30s em torno do horário do servidor.
const CLOCK_DRIFT_WINDOW_STEPS = 1;

authenticator.options = { window: CLOCK_DRIFT_WINDOW_STEPS };

@Injectable()
export class TotpService {
  generateSecret(): string {
    return authenticator.generateSecret();
  }

  buildOtpAuthUri(email: string, secret: string): string {
    return authenticator.keyuri(email, ISSUER, secret);
  }

  verify(code: string, secret: string): boolean {
    try {
      return authenticator.check(code, secret);
    } catch {
      return false;
    }
  }
}
