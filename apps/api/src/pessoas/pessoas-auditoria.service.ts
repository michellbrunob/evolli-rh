import { Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, Prisma } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { AuditResource } from "../audit/audit.types";
import { PessoasAuditContext } from "./pessoas.types";

/**
 * Ponte entre o módulo de pessoas e a trilha formal (ADR 0004). Não duplica o
 * mecanismo: `AuditService` continua sendo o ponto único de escrita.
 *
 * **Nenhum dado pessoal entra no evento** (ADR 0004 §5, reforçado pela
 * ADR 0007): nem `nome`, nem `matricula`, nem valor antes/depois de campo
 * nenhum. O evento carrega ator, escopo de empresa, ação e o identificador
 * técnico do recurso — e nada mais. A trilha registra *que* houve retificação
 * de cadastro, nunca *qual valor* mudou.
 */
@Injectable()
export class PessoasAuditoriaService {
  constructor(private readonly auditService: AuditService) {}

  /**
   * Evento de mutação, **dentro da transação da alteração** (ADR 0004 §2): ou
   * a alteração e o evento persistem juntos, ou nenhum dos dois. Vale para
   * toda mutação desta fatia, sem exceção — uma admissão registrada sem
   * evento de auditoria é pior que uma admissão que falhou.
   */
  async registrarMutacao(
    tx: Prisma.TransactionClient,
    ctx: PessoasAuditContext,
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
        // Escopo da entidade afetada — a empresa do vínculo, sempre.
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
   * Tentativa negada sobre recurso de pessoas, **incluindo tentativa fora do
   * escopo de empresa**.
   *
   * A resposta pública é sempre **404**. Aqui isso é mais crítico que na
   * Fatia 1: um 403 confirmaria a existência de uma *pessoa* naquela empresa.
   * A trilha interna registra `denied`, que é o que torna uma varredura entre
   * empresas detectável depois.
   *
   * Registro **best-effort** (ADR 0004 §2): a negação já foi decidida e não é
   * revertida se o evento não puder ser gravado.
   *
   * `resourceId` recebe o identificador **técnico** tentado — nunca matrícula,
   * nome ou qualquer dado pessoal.
   */
  async negarAcesso(
    ctx: PessoasAuditContext,
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
