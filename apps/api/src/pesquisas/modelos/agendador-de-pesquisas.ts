import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import { intervaloDoAgendador } from "./onboarding/automacao-onboarding";
import { ProcessadorDePesquisas } from "./processador-de-pesquisas";

/**
 * T216 — o agendador das pesquisas: roda o processo periódico a cada
 * `PESQUISAS_AGENDADOR_INTERVALO_MS` (padrão 5 minutos; `0` desliga; nos
 * testes, desligado sem a variável). Uma execução por vez nesta instância;
 * entre instâncias, o processo é idempotente.
 */
@Injectable()
export class AgendadorDePesquisas implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger("AgendadorDePesquisas");
  private timer: ReturnType<typeof setInterval> | null = null;
  private rodando = false;

  constructor(private readonly processador: ProcessadorDePesquisas) {}

  onModuleInit(): void {
    const ms = intervaloDoAgendador(process.env);
    if (ms === 0) return;
    this.timer = setInterval(() => void this.rodar(), ms);
    // Não segura o processo vivo só por causa do agendador.
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Uma rodada (pulada se a anterior ainda não terminou). */
  async rodar(agora: Date = new Date()): Promise<number | null> {
    if (this.rodando) return null;
    this.rodando = true;
    try {
      return await this.processador.processar(agora);
    } catch (e) {
      this.logger.error(`Falha no agendador: ${(e as Error).message}`);
      return null;
    } finally {
      this.rodando = false;
    }
  }
}
