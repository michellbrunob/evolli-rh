import { Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, Prisma } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { AuditResource } from "../audit/audit.types";
import { HorariosAuditContext } from "./horarios.types";

/**
 * Ponte entre o módulo de horários e a trilha formal (ADR 0004). Não duplica o
 * mecanismo: `AuditService` continua sendo o ponto único de escrita.
 *
 * **Nenhum dado pessoal ou de configuração entra no evento** (ADR 0004 §5): nem
 * nome/descrição da tabela, nem o dia/hora dos períodos, nem qualquer dado do
 * colaborador vinculado. A ação (`horarios.tabela.criada` etc.) e o
 * `resource_id` já respondem "o quê" e "sobre qual registro". A trilha rastreia
 * o ato, nunca o conteúdo do ato.
 */
@Injectable()
export class HorariosAuditoriaService {
  constructor(private readonly auditService: AuditService) {}

  /**
   * Evento de mutação, **dentro da transação da escrita** (ADR 0004 §2): ou o
   * registro e o evento persistem juntos, ou nenhum dos dois.
   */
  async registrarMutacao(
    tx: Prisma.TransactionClient,
    ctx: HorariosAuditContext,
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
   * Consulta bem-sucedida a dado de horário.
   *
   * **Regime: fail-safe (melhor esforço).** A leitura já foi autorizada; recusá-
   * la porque a trilha está indisponível transformaria indisponibilidade de
   * auditoria em indisponibilidade de negócio — mesmo regime de
   * `ponto.consultado` e `organizacao.estrutura.consultada`.
   */
  async registrarConsulta(
    ctx: HorariosAuditContext,
    resource: AuditResource,
    resourceId: string | null,
    // `null` na leitura GLOBAL do Master: a consulta atravessa empresas.
    empresaId: string | null,
  ): Promise<void> {
    await this.auditService.record({
      actorType: "user",
      actorUserId: ctx.actor.id,
      actorRole: ctx.actor.role,
      companyId: empresaId,
      action: "horarios_consultado",
      resource,
      resourceId,
      ip: ctx.metadata.ip,
      userAgent: ctx.metadata.userAgent,
      result: "success",
      requestId: ctx.metadata.requestId,
    });
  }

  /**
   * Tentativa negada, **incluindo tentativa fora do escopo de empresa**. A
   * resposta pública é sempre **404**, nunca 403: um 403 confirmaria que aquele
   * registro existe naquela empresa. A trilha interna registra `denied`.
   *
   * `resourceId` recebe o identificador **técnico** tentado — nunca nome,
   * descrição, dia/hora ou dado pessoal.
   */
  async negarAcesso(
    ctx: HorariosAuditContext,
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
