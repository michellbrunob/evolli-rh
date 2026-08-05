import { Injectable } from "@nestjs/common";
import { AuditAction, AuditEvent, Prisma } from "@prisma/client";
import { PinoLogger } from "nestjs-pino";
import { PrismaService } from "../database/prisma.service";
import { RecordAuditEventInput } from "./audit.types";

const USER_AGENT_MAX_LENGTH = 300;

export const AUDIT_EVENTS_MAX_PAGE_SIZE = 100;
export const AUDIT_EVENTS_DEFAULT_PAGE_SIZE = 20;

export interface ListAuditEventsFilter {
  occurredFrom?: Date | undefined;
  occurredTo?: Date | undefined;
  actorUserId?: string | undefined;
  action?: AuditAction | undefined;
  resource?: string | undefined;
  companyId?: string | undefined;
}

export interface ListAuditEventsPagination {
  page: number;
  pageSize: number;
}

export interface ListAuditEventsResult {
  items: AuditEvent[];
  page: number;
  pageSize: number;
  total: number;
}

/**
 * Único ponto de escrita da trilha de auditoria formal (ADR 0004 §2) —
 * nenhum outro módulo grava em `audit_event` diretamente. Nunca aceita
 * campo de conteúdo livre/antes-depois; só os metadados fechados definidos
 * em `RecordAuditEventInput`.
 *
 * `record()` tem dois modos (ADR 0004 §2):
 * - Sem `tx`: melhor esforço — falha de persistência é capturada e logada
 *   (sem segredo), nunca propaga. A ação de negócio já decidida (permitir,
 *   negar, expirar) nunca é revertida por falha de auditoria.
 * - Com `tx`: participa da transação do chamador — erro propaga, revertendo
 *   a alteração sensível e o evento juntos (atomicidade exigida para ações
 *   sensíveis bem-sucedidas: criação/alteração/desativação de usuário,
 *   conclusão de redefinição de senha).
 */
@Injectable()
export class AuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(AuditService.name);
  }

  async record(
    input: RecordAuditEventInput,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const data = this.toPersistedData(input);
    const client = tx ?? this.prisma;

    if (tx) {
      await client.auditEvent.create({ data });
      return;
    }

    try {
      await client.auditEvent.create({ data });
    } catch (error) {
      // Nunca logar a exceção original (pode conter fragmento de SQL/conexão)
      // — só o nome, mesmo padrão do PrismaService (ADR 0002) e do
      // AllExceptionsFilter (ADR 0001). A ação de negócio já ocorreu (ou foi
      // negada) independentemente desta falha — auditoria nunca bloqueia.
      this.logger.error(
        {
          action: input.action,
          errorName: error instanceof Error ? error.name : "UnknownError",
        },
        "Falha ao persistir evento de auditoria",
      );
    }
  }

  async findMany(
    filter: ListAuditEventsFilter,
    pagination: ListAuditEventsPagination,
  ): Promise<ListAuditEventsResult> {
    const where: Prisma.AuditEventWhereInput = {
      ...(filter.actorUserId !== undefined && {
        actorUserId: filter.actorUserId,
      }),
      ...(filter.action !== undefined && { action: filter.action }),
      ...(filter.resource !== undefined && { resource: filter.resource }),
      ...(filter.companyId !== undefined && { companyId: filter.companyId }),
      ...((filter.occurredFrom !== undefined ||
        filter.occurredTo !== undefined) && {
        occurredAt: {
          ...(filter.occurredFrom !== undefined && {
            gte: filter.occurredFrom,
          }),
          ...(filter.occurredTo !== undefined && { lte: filter.occurredTo }),
        },
      }),
    };

    const skip = (pagination.page - 1) * pagination.pageSize;

    const [items, total] = await Promise.all([
      this.prisma.auditEvent.findMany({
        where,
        orderBy: { occurredAt: "desc" },
        skip,
        take: pagination.pageSize,
      }),
      this.prisma.auditEvent.count({ where }),
    ]);

    return {
      items,
      page: pagination.page,
      pageSize: pagination.pageSize,
      total,
    };
  }

  async findById(id: string): Promise<AuditEvent | null> {
    return this.prisma.auditEvent.findUnique({ where: { id } });
  }

  private toPersistedData(
    input: RecordAuditEventInput,
  ): Prisma.AuditEventUncheckedCreateInput {
    const userAgent = input.userAgent?.slice(0, USER_AGENT_MAX_LENGTH) ?? null;

    if (input.actorType === "user") {
      return {
        occurredAt: new Date(),
        actorType: "user",
        actorUserId: input.actorUserId,
        actorRole: input.actorRole,
        companyId: input.companyId ?? null,
        unitId: input.unitId ?? null,
        teamId: input.teamId ?? null,
        action: input.action,
        resource: input.resource,
        resourceId: input.resourceId ?? null,
        ip: input.ip,
        userAgent,
        result: input.result,
        requestId: input.requestId,
        correlationId: input.correlationId ?? null,
      };
    }

    return {
      occurredAt: new Date(),
      actorType: "system",
      actorSystemId: input.actorSystemId,
      companyId: input.companyId ?? null,
      unitId: input.unitId ?? null,
      teamId: input.teamId ?? null,
      action: input.action,
      resource: input.resource,
      resourceId: input.resourceId ?? null,
      ip: input.ip,
      userAgent,
      result: input.result,
      requestId: input.requestId,
      correlationId: input.correlationId ?? null,
    };
  }
}
