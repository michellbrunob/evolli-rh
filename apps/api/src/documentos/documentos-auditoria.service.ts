import { Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, Prisma } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { AuditResource } from "../audit/audit.types";
import { DocumentosAuditContext } from "./documentos.types";

/**
 * Ponte entre o módulo de documentos e a trilha formal (ADR 0004). Não duplica
 * o mecanismo: `AuditService` continua sendo o ponto único de escrita.
 *
 * **Nenhum dado pessoal e NENHUM rótulo/tipo documental entra no evento**
 * (ADR 0004 §5; ADR 0011, decisão 10; DP-2E-12). O evento carrega ator, escopo
 * de empresa, ação e o **identificador técnico** do recurso — nada mais. A
 * trilha registra *que* um metadado foi criado/consultado/substituído, nunca
 * *de que tipo* ele é, porque o tipo revelaria categoria sensível por
 * inferência.
 */
@Injectable()
export class DocumentosAuditoriaService {
  constructor(private readonly auditService: AuditService) {}

  /**
   * Evento de mutação, **dentro da transação da alteração** (ADR 0004 §2): ou a
   * alteração e o evento persistem juntos, ou nenhum dos dois.
   */
  async registrarMutacao(
    tx: Prisma.TransactionClient,
    ctx: DocumentosAuditContext,
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
   * Evento de **leitura de metadado**, gravado de forma **fail-safe** (ADR 0011,
   * decisão 7; spec §11): usa `recordOrThrow`, então se o evento não puder ser
   * persistido, o erro **propaga** e a leitura não é reportada como bem-sucedida
   * — "quem viu, e quando" é o risco central deste domínio, e a auditoria é o
   * que torna a leitura aceitável; ela não pode ser best-effort.
   *
   * `resourceId` é `null` na listagem e o id técnico no detalhe. Nunca o tipo
   * documental.
   */
  async registrarLeitura(
    ctx: DocumentosAuditContext,
    action: AuditAction,
    resource: AuditResource,
    resourceId: string | null,
    // `null` na leitura GLOBAL do Master (T030): a consulta atravessa empresas.
    empresaId: string | null,
  ): Promise<void> {
    await this.auditService.recordOrThrow({
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
    });
  }

  /**
   * Consulta em escopo **GLOBAL** do `master_tecnico` (T030), para os recursos
   * cuja leitura escopada de rh/dp não gera evento (catálogo e solicitação). É
   * a leitura ampla — a exceção — que se audita, fail-safe (`recordOrThrow`),
   * com ação, tipo de recurso e id técnico; nunca rótulo documental ou dado
   * pessoal.
   */
  async registrarConsultaGlobal(
    ctx: DocumentosAuditContext,
    resource: AuditResource,
    resourceId: string | null,
  ): Promise<void> {
    await this.auditService.recordOrThrow({
      actorType: "user",
      actorUserId: ctx.actor.id,
      actorRole: ctx.actor.role,
      companyId: null,
      action: "master_consulta_global",
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
   * resposta pública é sempre **404**: um 403 confirmaria a existência de um
   * documento de determinado tipo para determinada pessoa — vazamento por
   * inferência sem entregar um byte (ADR 0011, decisão 5).
   *
   * Registro **best-effort** (ADR 0004 §2): a negação já foi decidida e não é
   * revertida se o evento não puder ser gravado. `resourceId` recebe o
   * identificador **técnico** tentado — nunca dado pessoal nem tipo documental.
   */
  async negarAcesso(
    ctx: DocumentosAuditContext,
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
