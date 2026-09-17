import { Injectable, UnprocessableEntityException } from "@nestjs/common";
import { AccessRole, AccessUser, Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import { PasswordHashService } from "../auth/password/password-hash.service";
import { PasswordPolicyService } from "../auth/password/password-policy.service";
import {
  SessionRequestMetadata,
  SessionService,
} from "../auth/session/session.service";
import { normalizeEmail } from "../auth/normalize-email.util";
import { toSafeUser, SafeAccessUser } from "../auth/safe-user.util";
import { AuditService } from "../audit/audit.service";
import { ListarUsuariosQueryDto } from "./dto/listar-usuarios-query.dto";
import {
  codificarCursorListagemUsuarios,
  decodificarCursorListagemUsuarios,
  empresaParaAuditoriaListagem,
  filtroEmpresaListagemUsuarios,
  LISTAR_USUARIOS_LIMITE_PADRAO,
  resolverEscopoListagemUsuarios,
} from "./listar-usuarios.util";

export interface ListarUsuariosResultado {
  items: SafeAccessUser[];
  nextCursor: string | null;
}

export interface CreateUserInput {
  email: string;
  password: string;
  role: AccessRole;
  companyId?: string;
  unitId?: string;
  teamId?: string;
}

/** Ator + contexto de requisição para a trilha de auditoria (ADR 0004). */
export interface AuditActorContext {
  actor: AccessUser;
  metadata: SessionRequestMetadata;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordHashService: PasswordHashService,
    private readonly passwordPolicyService: PasswordPolicyService,
    private readonly sessionService: SessionService,
    private readonly auditService: AuditService,
  ) {}

  async createUser(
    input: CreateUserInput,
    auditCtx: AuditActorContext,
  ): Promise<SafeAccessUser> {
    // Autorização já aplicada pelo AuthorizationGuard (RequirePermission
    // "user_role"/"create") antes deste método rodar.
    if (!this.passwordPolicyService.isValid(input.password)) {
      throw new UnprocessableEntityException();
    }

    const passwordHash = await this.passwordHashService.hash(input.password);

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.accessUser.create({
        data: {
          email: normalizeEmail(input.email),
          passwordHash,
          role: input.role,
          companyId: input.companyId ?? null,
          unitId: input.unitId ?? null,
          teamId: input.teamId ?? null,
        },
      });

      // Ação sensível bem-sucedida: alteração e evento de auditoria na
      // mesma transação (ADR 0004 §2).
      await this.auditService.record(
        {
          actorType: "user",
          actorUserId: auditCtx.actor.id,
          actorRole: auditCtx.actor.role,
          companyId: auditCtx.actor.companyId,
          action: "user_created",
          resource: "access_user",
          resourceId: created.id,
          ip: auditCtx.metadata.ip,
          userAgent: auditCtx.metadata.userAgent,
          result: "success",
          requestId: auditCtx.metadata.requestId,
        },
        tx,
      );

      return created;
    });

    return toSafeUser(user);
  }

  async updateRole(
    targetUserId: string,
    role: AccessRole,
    auditCtx: AuditActorContext,
  ): Promise<SafeAccessUser> {
    // Autorização já aplicada pelo AuthorizationGuard (RequirePermission
    // "user_role"/"alter") antes deste método rodar.
    //
    // Escopo IMUTÁVEL (T029): a atualização toca apenas `role`. `companyId`,
    // `unitId` e `teamId` nunca são escritos aqui — o usuário permanece na
    // empresa em que foi criado. Isso impede que um RH/DP transfira, remova ou
    // reatribua o escopo de outra empresa a partir desta rota, mesmo que algo
    // escapasse da validação de entrada (defesa em profundidade). Transferência
    // entre empresas não existe na V1.
    const user = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.accessUser.update({
        where: { id: targetUserId },
        data: {
          role,
        },
      });

      await this.auditService.record(
        {
          actorType: "user",
          actorUserId: auditCtx.actor.id,
          actorRole: auditCtx.actor.role,
          companyId: auditCtx.actor.companyId,
          action: "user_role_changed",
          resource: "access_user",
          resourceId: targetUserId,
          ip: auditCtx.metadata.ip,
          userAgent: auditCtx.metadata.userAgent,
          result: "success",
          requestId: auditCtx.metadata.requestId,
        },
        tx,
      );

      return updated;
    });

    return toSafeUser(user);
  }

  async disable(
    targetUserId: string,
    auditCtx: AuditActorContext,
  ): Promise<void> {
    // Mudança de status, revogação de TODAS as sessões ativas e os dois
    // eventos correspondentes (user_disabled, session_revoked) na mesma
    // transação (ADR 0004 §2) — ou tudo persiste, ou nada.
    await this.prisma.$transaction(async (tx) => {
      await tx.accessUser.update({
        where: { id: targetUserId },
        data: { status: "disabled" },
      });

      await this.auditService.record(
        {
          actorType: "user",
          actorUserId: auditCtx.actor.id,
          actorRole: auditCtx.actor.role,
          companyId: auditCtx.actor.companyId,
          action: "user_disabled",
          resource: "access_user",
          resourceId: targetUserId,
          ip: auditCtx.metadata.ip,
          userAgent: auditCtx.metadata.userAgent,
          result: "success",
          requestId: auditCtx.metadata.requestId,
        },
        tx,
      );

      await this.sessionService.revokeAllForUser(
        targetUserId,
        "account_disabled",
        undefined,
        tx,
      );
      await this.auditService.record(
        {
          actorType: "user",
          actorUserId: auditCtx.actor.id,
          actorRole: auditCtx.actor.role,
          companyId: auditCtx.actor.companyId,
          action: "session_revoked",
          resource: "access_session",
          resourceId: targetUserId,
          ip: auditCtx.metadata.ip,
          userAgent: auditCtx.metadata.userAgent,
          result: "success",
          requestId: auditCtx.metadata.requestId,
        },
        tx,
      );
    });
  }

  /**
   * Listagem paginada de contas de acesso (T120 — `GET /v1/users`).
   *
   * Autorização já aplicada pelo `AuthorizationGuard` (`RequirePermission`
   * "other_account"/"read") antes deste método rodar — a checagem de escopo
   * aqui (`resolverEscopoListagemUsuarios`) é defesa em profundidade, mesmo
   * critério de `resolverEscopoLeituraPonto`.
   *
   * Paginação **keyset** determinística por `(createdAt DESC, id DESC)` —
   * nunca offset: evita duplicar ou pular linha quando contas são criadas
   * entre duas páginas. `query.companyId` só é lido pelo resolver de escopo
   * quando o ator é `master_tecnico`; para `rh`/`dp` a empresa vem sempre da
   * sessão (`actor.companyId`), nunca da requisição.
   */
  async listar(
    query: ListarUsuariosQueryDto,
    auditCtx: AuditActorContext,
  ): Promise<ListarUsuariosResultado> {
    const escopo = resolverEscopoListagemUsuarios(
      auditCtx.actor,
      query.companyId,
    );
    const limite = query.limit ?? LISTAR_USUARIOS_LIMITE_PADRAO;
    const cursor =
      query.cursor !== undefined
        ? decodificarCursorListagemUsuarios(query.cursor)
        : undefined;

    const where: Prisma.AccessUserWhereInput = {
      ...filtroEmpresaListagemUsuarios(escopo),
      ...(query.status !== undefined && { status: query.status }),
      ...(query.role !== undefined && { role: query.role }),
      ...(cursor !== undefined && {
        OR: [
          { createdAt: { lt: cursor.createdAt } },
          { createdAt: cursor.createdAt, id: { lt: cursor.id } },
        ],
      }),
    };

    // `take: limite + 1` — a linha extra (se vier) só serve para saber se há
    // próxima página; nunca é devolvida ao cliente.
    const linhas = await this.prisma.accessUser.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limite + 1,
    });

    const temProximaPagina = linhas.length > limite;
    const pagina = temProximaPagina ? linhas.slice(0, limite) : linhas;
    const ultimaLinha = pagina[pagina.length - 1];
    const nextCursor =
      temProximaPagina && ultimaLinha !== undefined
        ? codificarCursorListagemUsuarios({
            createdAt: ultimaLinha.createdAt,
            id: ultimaLinha.id,
          })
        : null;

    // Regime fail-safe (mesmo critério de `ponto_consultado`): a leitura já
    // autorizada nunca é bloqueada por falha ao gravar o evento. Nenhum
    // e-mail, senha, hash ou token entra na trilha — só ator, papel, empresa
    // de escopo (quando aplicável) e metadado da requisição.
    await this.auditService.record({
      actorType: "user",
      actorUserId: auditCtx.actor.id,
      actorRole: auditCtx.actor.role,
      companyId: empresaParaAuditoriaListagem(escopo),
      action: "users_listed",
      resource: "access_user",
      resourceId: null,
      ip: auditCtx.metadata.ip,
      userAgent: auditCtx.metadata.userAgent,
      result: "success",
      requestId: auditCtx.metadata.requestId,
    });

    return {
      items: pagina.map(toSafeUser),
      nextCursor,
    };
  }
}
