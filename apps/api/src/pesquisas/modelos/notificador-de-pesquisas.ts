import { Injectable, Logger } from "@nestjs/common";

/**
 * T216 — o ponto de notificação das pesquisas (convites e lembretes da
 * Avaliação 90°/180° e do Onboarding). O Evolli ainda não envia e-mail: a
 * implementação padrão não manda nada e devolve `false`, e o convite fica
 * "aguardando e-mail". Quando o provedor entrar, basta trocar o provedor
 * deste token — a chamada e os dados do aviso já estão prontos.
 */

export const NOTIFICADOR_DE_PESQUISAS = Symbol("NOTIFICADOR_DE_PESQUISAS");

export interface AvisoDePesquisa {
  tipo: "convite" | "lembrete";
  pesquisaId: string;
  empresaId: string;
  colaboradorId: string;
  /** Onboarding: 0, 30, 60 ou 90; avaliação: o marco do aviso. */
  rodada: number;
  /** Caminho público da pesquisa (`#/p/<token>`, com a rodada se houver). */
  link: string;
}

export interface NotificadorDePesquisas {
  /** `true` se o aviso saiu. */
  avisar(aviso: AvisoDePesquisa): Promise<boolean>;
}

@Injectable()
export class NotificadorSemEmail implements NotificadorDePesquisas {
  private readonly logger = new Logger("NotificadorDePesquisas");

  async avisar(aviso: AvisoDePesquisa): Promise<boolean> {
    // Sem e-mail, sem pessoa e sem link no log: só que o aviso ficou parado.
    this.logger.debug(
      `Aviso de pesquisa (${aviso.tipo}) aguardando e-mail: nenhum provedor integrado.`,
    );
    return false;
  }
}
