import { Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, Prisma } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { AuditResource } from "../audit/audit.types";
import { OrganizacaoAuditContext } from "./organizacao.types";
import { EscopoOrganizacional } from "./escopo.util";

/**
 * Ponte entre o módulo organizacional e a trilha formal (ADR 0004). Não
 * duplica o mecanismo de auditoria: só padroniza o preenchimento do evento
 * para os nós organizacionais, mantendo `AuditService` como ponto único de
 * escrita.
 *
 * Nada de valor antes/depois é registrado (ADR 0004 §5, inalterado): o evento
 * carrega ator, escopo, ação e identificação do recurso — nunca o conteúdo do
 * campo alterado, nem segredo, cookie ou token.
 */
@Injectable()
export class OrganizacaoAuditoriaService {
  constructor(private readonly auditService: AuditService) {}

  /**
   * Evento de mutação, **dentro da transação da alteração** (ADR 0004 §2):
   * ou a alteração e o evento persistem juntos, ou nenhum dos dois.
   */
  async registrarMutacao(
    tx: Prisma.TransactionClient,
    ctx: OrganizacaoAuditContext,
    action: AuditAction,
    resource: AuditResource,
    resourceId: string,
    empresaId: string | null,
  ): Promise<void> {
    await this.auditService.record(
      {
        actorType: "user",
        actorUserId: ctx.actor.id,
        actorRole: ctx.actor.role,
        // Escopo **efetivo da entidade afetada**, não o do ator: é o que
        // permite auditar uso de acesso amplo sobre empresa de terceiro
        // (RI-2, spec §12).
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
   * Tentativa negada sobre recurso organizacional (spec §9), **incluindo
   * tentativa fora do escopo de empresa**.
   *
   * A resposta pública é sempre **404** — 403 confirmaria a existência do
   * recurso e permitiria enumeração (spec §10) —, mas a trilha interna
   * registra `denied`, que é o que torna uma sondagem entre empresas
   * detectável depois.
   *
   * Registro **best-effort** (ADR 0004 §2): a negação já foi decidida e não
   * é revertida se o evento não puder ser gravado. Mesma postura do
   * `AuthorizationGuard` para 403.
   */
  async negarAcesso(
    ctx: OrganizacaoAuditContext,
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

  /**
   * Consulta com **escopo amplo** (spec §9; mitigação exigida pelo RI-2).
   *
   * Só é registrada quando o ator opera em escopo global — leitura dentro da
   * própria empresa é operação rotineira e não gera evento, sob pena de a
   * trilha virar log de tráfego e perder significado.
   *
   * Usa `recordOrThrow`: aqui a auditoria **é** o controle que torna o acesso
   * amplo aceitável (Emenda 1 da ADR 0005). Se o evento não puder ser
   * persistido, a consulta não pode ser respondida — mesmo comportamento
   * fail-safe já adotado na leitura da própria trilha (Fatia 4).
   */
  async registrarConsultaAmpla(
    escopo: EscopoOrganizacional,
    ctx: OrganizacaoAuditContext,
    resource: AuditResource,
    resourceId: string | null,
    empresaIdConsultada: string | null,
  ): Promise<void> {
    if (!escopo.global) {
      return;
    }

    await this.auditService.recordOrThrow({
      actorType: "user",
      actorUserId: ctx.actor.id,
      actorRole: ctx.actor.role,
      companyId: empresaIdConsultada,
      action: "organizacao_estrutura_consultada",
      resource,
      resourceId,
      ip: ctx.metadata.ip,
      userAgent: ctx.metadata.userAgent,
      result: "success",
      requestId: ctx.metadata.requestId,
    });
  }
}
