import { Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, Prisma } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { AuditResource } from "../audit/audit.types";
import { PontoAuditContext } from "./ponto.types";

/**
 * Ponte entre o módulo de ponto e a trilha formal (ADR 0004). Não duplica o
 * mecanismo: `AuditService` continua sendo o ponto único de escrita.
 *
 * **Nenhum dado pessoal entra no evento** (ADR 0004 §5): nem nome, nem
 * matrícula, nem — e isto é específico deste módulo — o **horário** registrado.
 * Um evento de auditoria que dissesse "entrada às 08:03" estaria copiando o
 * próprio dado de presença para dentro da trilha, sem necessidade: a ação
 * (`ponto.evento.registrado`) e o `resource_id` já respondem "o quê" e "sobre
 * qual registro". A trilha rastreia o ato, nunca o conteúdo do ato.
 */
@Injectable()
export class PontoAuditoriaService {
  constructor(private readonly auditService: AuditService) {}

  /**
   * Evento de mutação, **dentro da transação da escrita** (ADR 0004 §2): ou o
   * registro e o evento persistem juntos, ou nenhum dos dois. Uma marcação de
   * ponto gravada sem rastro de quem a gravou é pior que uma marcação que
   * falhou — sobretudo num módulo onde o registro é sempre manual.
   */
  async registrarMutacao(
    tx: Prisma.TransactionClient,
    ctx: PontoAuditContext,
    action: AuditAction,
    resource: AuditResource,
    resourceId: string,
    empresaId: string,
  ): Promise<void> {
    await this.auditService.record(
      {
        actorType: "user",
        actorUserId: ctx.actor.id,
        actorRole: ctx.actor.role,
        companyId: empresaId,
        action,
        resource,
        resourceId,
        ip: ctx.metadata.ip,
        userAgent: ctx.metadata.userAgent,
        result: "success",
        requestId: ctx.metadata.requestId,
      },
      tx,
    );
  }

  /**
   * Consulta bem-sucedida a dado de ponto.
   *
   * **Por que leitura é auditada aqui, se em pessoas não é.** A spec da Etapa 3
   * (§5.5) argumenta que ver jornada/presença de terceiro é, por si, ação
   * sensível — mesmo critério que já faz `audit_log_read` registrar toda
   * leitura da trilha (ADR 0004, decisão 6).
   *
   * **Regime: fail-safe (melhor esforço), não fail-closed.** A leitura já foi
   * autorizada; recusá-la porque a trilha está momentaneamente indisponível
   * transformaria uma indisponibilidade de auditoria em indisponibilidade de
   * negócio. É o mesmo regime de `organizacao.estrutura.consultada` (Fatia 1);
   * o fail-closed da ADR 0004 é reservado à leitura da **própria trilha**, onde
   * a consulta é o próprio objeto auditado.
   *
   * **Consequência assumida:** volume. Leitura de ponto é operação de rotina de
   * DP, e cada uma gera uma linha em `audit_event` — tabela que ainda não tem
   * política de retenção (ADR 0004, decisão 4; DP-3J-11). Registrado como
   * consequência conhecida, a reavaliar junto da retenção.
   */
  async registrarConsulta(
    ctx: PontoAuditContext,
    resource: AuditResource,
    resourceId: string | null,
    empresaId: string,
  ): Promise<void> {
    await this.auditService.record({
      actorType: "user",
      actorUserId: ctx.actor.id,
      actorRole: ctx.actor.role,
      companyId: empresaId,
      action: "ponto_consultado",
      resource,
      resourceId,
      ip: ctx.metadata.ip,
      userAgent: ctx.metadata.userAgent,
      result: "success",
      requestId: ctx.metadata.requestId,
    });
  }

  /**
   * Tentativa negada sobre recurso de ponto, **incluindo tentativa fora do
   * escopo de empresa**.
   *
   * A resposta pública é sempre **404**, nunca 403: um 403 confirmaria que
   * aquele vínculo/registro existe naquela empresa. A trilha interna registra
   * `denied`, que é o que torna uma varredura entre empresas detectável depois.
   *
   * Registro **best-effort** (ADR 0004 §2): a negação já foi decidida e não é
   * revertida se o evento não puder ser gravado.
   *
   * `resourceId` recebe o identificador **técnico** tentado — nunca matrícula,
   * nome, horário ou qualquer dado pessoal.
   */
  async negarAcesso(
    ctx: PontoAuditContext,
    resource: AuditResource,
    resourceId: string | null,
    empresaIdTentada: string | null,
  ): Promise<never> {
    await this.auditService.record({
      actorType: "user",
      actorUserId: ctx.actor.id,
      actorRole: ctx.actor.role,
      companyId: empresaIdTentada,
      action: "authorization_denied",
      resource,
      resourceId,
      ip: ctx.metadata.ip,
      userAgent: ctx.metadata.userAgent,
      result: "denied",
      requestId: ctx.metadata.requestId,
    });

    throw new NotFoundException();
  }
}
