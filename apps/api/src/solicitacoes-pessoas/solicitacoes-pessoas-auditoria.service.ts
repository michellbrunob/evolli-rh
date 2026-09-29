import { Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, Prisma } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { AuditResource } from "../audit/audit.types";
import { SolicitacoesPessoasAuditContext } from "./solicitacoes-pessoas.types";

/** Único recurso auditável desta Central (ver `permission.types.ts`). */
const RECURSO: AuditResource = "solicitacao_pessoa";

/**
 * Ponte entre a Central de Solicitações de Pessoas e a trilha formal
 * (ADR 0004). Não duplica o mecanismo: `AuditService` continua sendo o ponto
 * único de escrita.
 *
 * **O evento carrega ator, papel, empresa, ação e o identificador técnico da
 * solicitação — nada mais.** Em particular nunca carrega:
 *
 * - o **tipo** da solicitação: `atestado` revelaria condição de saúde por
 *   inferência, exatamente o vazamento que a ADR 0011 evita ao proibir o
 *   rótulo documental na trilha;
 * - o **vínculo/colaborador**: o sujeito é alcançável pela solicitação, e
 *   repeti-lo no evento ampliaria a superfície de dado pessoal sem necessidade;
 * - o **motivo codificado**: ele é a decisão de negócio e vive no histórico da
 *   própria solicitação, que tem controle de acesso próprio.
 */
@Injectable()
export class SolicitacoesPessoasAuditoriaService {
  constructor(private readonly auditService: AuditService) {}

  /**
   * Evento de mutação, **dentro da transação da alteração** (ADR 0004 §2): ou a
   * alteração e o evento persistem juntos, ou nenhum dos dois. Falha de
   * auditoria obrigatória aborta a transição.
   */
  async registrarMutacao(
    tx: Prisma.TransactionClient,
    ctx: SolicitacoesPessoasAuditContext,
    action: AuditAction,
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
        resource: RECURSO,
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
   * Evento de **leitura**, gravado de forma **fail-safe** (`recordOrThrow`,
   * mesmo critério de `ponto_consultado` e `horarios_consultado`): saber quem
   * consultou as solicitações de uma pessoa é por si um dado de interesse, e a
   * auditoria é o que torna a leitura aceitável — ela não pode ser best-effort.
   *
   * `resourceId` é `null` na listagem e o id técnico no detalhe/histórico.
   */
  async registrarLeitura(
    ctx: SolicitacoesPessoasAuditContext,
    resourceId: string | null,
    // `null` na leitura GLOBAL do Master: a consulta atravessa empresas.
    empresaId: string | null,
  ): Promise<void> {
    await this.auditService.recordOrThrow({
      actorType: "user",
      actorUserId: ctx.actor.id,
      actorRole: ctx.actor.role,
      companyId: empresaId,
      action: "pessoas_solicitacao_consultada",
      resource: RECURSO,
      resourceId,
      ip: ctx.metadata.ip,
      userAgent: ctx.metadata.userAgent,
      result: "success",
      requestId: ctx.metadata.requestId,
    });
  }

  /**
   * Tentativa negada, **incluindo tentativa fora do escopo de empresa**. A
   * resposta pública é sempre **404**: um 403 confirmaria que existe uma
   * solicitação com aquele id — vazamento por inferência sem entregar um byte
   * (ADR 0006, 404 anti-enumeração).
   *
   * Registro **best-effort** (ADR 0004 §2): a negação já foi decidida e não é
   * revertida se o evento não puder ser gravado.
   */
  async negarAcesso(
    ctx: SolicitacoesPessoasAuditContext,
    resourceId: string | null,
    empresaIdTentada: string | null,
  ): Promise<never> {
    await this.auditService.record({
      actorType: "user",
      actorUserId: ctx.actor.id,
      actorRole: ctx.actor.role,
      companyId: empresaIdTentada,
      action: "authorization_denied",
      resource: RECURSO,
      resourceId,
      ip: ctx.metadata.ip,
      userAgent: ctx.metadata.userAgent,
      result: "denied",
      requestId: ctx.metadata.requestId,
    });

    throw new NotFoundException();
  }
}
