import { AccessRole, AuditAction, AuditResult } from "@prisma/client";

/** Runtime array dos valores do enum `AuditAction`, para validação (`@IsIn`). */
export const AUDIT_ACTIONS = [
  "login_succeeded",
  "login_failed",
  "logout",
  "session_revoked",
  "session_expired",
  "password_reset_requested",
  "password_reset_completed",
  "user_created",
  "user_role_changed",
  "user_disabled",
  "authorization_denied",
  "rate_limit_blocked",
  "audit_log_read",

  // Etapa 1 — Fatia 1: Núcleo Organizacional. O valor **persistido** segue a
  // convenção aprovada em português separada por ponto
  // (`organizacao.empresa.criada`); o identificador abaixo é o nome Prisma do
  // mesmo valor, com `_` porque a linguagem não aceita `.` em identificador
  // (ver `@map` no enum `AuditAction` em schema.prisma, ADR 0006 Emenda 1).
  "organizacao_empresa_criada",
  "organizacao_empresa_atualizada",
  "organizacao_empresa_inativada",
  "organizacao_empresa_reativada",
  "organizacao_unidade_organizacional_criada",
  "organizacao_unidade_organizacional_atualizada",
  "organizacao_unidade_organizacional_inativada",
  "organizacao_unidade_organizacional_reativada",
  "organizacao_departamento_criado",
  "organizacao_departamento_atualizado",
  "organizacao_departamento_inativado",
  "organizacao_departamento_reativado",
  "organizacao_area_criada",
  "organizacao_area_atualizada",
  "organizacao_area_inativada",
  "organizacao_area_reativada",
  "organizacao_equipe_criada",
  "organizacao_equipe_atualizada",
  "organizacao_equipe_inativada",
  "organizacao_equipe_reativada",
  "organizacao_cargo_criado",
  "organizacao_cargo_atualizado",
  "organizacao_cargo_inativado",
  "organizacao_cargo_reativado",
  "organizacao_centro_custo_criado",
  "organizacao_centro_custo_atualizado",
  "organizacao_centro_custo_inativado",
  "organizacao_centro_custo_reativado",
  "organizacao_estrutura_consultada",

  // Etapa 1 — Fatia 2: Colaboradores e vida funcional (ADR 0007). Mesma
  // convenção da Fatia 1: valor persistido em português separado por ponto
  // (`pessoas.colaborador.criado`), identificador Prisma com `_`.
  //
  // Verbos deliberadamente ausentes, por a capacidade não existir nesta V1:
  // `aprovada`/`rejeitada` (sem workflow, Baseline V1 item 7),
  // `dado_restrito.*` (fora da fatia, item 5) e `colaborador.consultado`
  // (nenhum papel tem escopo amplo neste domínio, então leitura fora do
  // escopo próprio é sempre 404 — nunca leitura a auditar).
  "pessoas_colaborador_criado",
  "pessoas_colaborador_atualizado",
  "pessoas_vinculo_criado",
  "pessoas_vinculo_ativado",
  "pessoas_vinculo_encerrado",
  "pessoas_movimentacao_registrada",
  "pessoas_movimentacao_programada",
  "pessoas_movimentacao_efetivada",
  "pessoas_movimentacao_cancelada",
  "pessoas_movimentacao_retificada",
  "pessoas_alocacao_criada",
  "pessoas_alocacao_encerrada",
] as const satisfies readonly AuditAction[];

/**
 * Tipo do recurso auditado — união de tipos no código, não enum de banco
 * (mesmo padrão de `AuthorizationResource`, ver
 * `auth/authorization/permission.types.ts`): extensível por módulo futuro
 * sem exigir migration. `action`/`result` são fechados por enum de banco
 * (ADR 0004 §5) porque representam a semântica de segurança do evento;
 * `resource` é só a etiqueta do tipo de dado afetado.
 */
export type AuditResource =
  | "access_user"
  | "access_session"
  | "access_password_reset_token"
  | "access_login_attempt"
  | "audit_event"
  // Etapa 1 — Fatia 1: entram sem migration, exatamente por `resource` ser
  // união no código. `estrutura_organizacional` identifica a leitura de
  // escopo amplo (spec §9, RI-2), não uma tabela.
  | "empresa"
  | "unidade_organizacional"
  | "departamento"
  | "area"
  | "equipe"
  | "cargo"
  | "centro_custo"
  | "estrutura_organizacional"
  // Etapa 1 — Fatia 2: entram sem migration, pelo mesmo motivo. Não há
  // `dado_restrito_colaborador`: essa categoria ficou fora da fatia
  // (Baseline V1, item 5), e etiquetar um recurso inexistente na trilha
  // sugeriria uma capacidade que o sistema não tem.
  | "colaborador"
  | "vinculo_funcional"
  | "movimentacao_funcional"
  | "alocacao_organizacional";

export type RecordAuditEventInput =
  | {
      actorType: "user";
      actorUserId: string;
      actorRole: AccessRole;
      companyId?: string | null;
      unitId?: string | null;
      teamId?: string | null;
      action: AuditAction;
      resource: AuditResource;
      resourceId?: string | null;
      ip: string | null;
      userAgent: string | null;
      result: AuditResult;
      requestId: string;
      correlationId?: string | null;
    }
  | {
      actorType: "system";
      /** Identificador técnico fixo da origem, ex.: "auth-service:login". */
      actorSystemId: string;
      companyId?: string | null;
      unitId?: string | null;
      teamId?: string | null;
      action: AuditAction;
      resource: AuditResource;
      resourceId?: string | null;
      ip: string | null;
      userAgent: string | null;
      result: AuditResult;
      requestId: string;
      correlationId?: string | null;
    };
