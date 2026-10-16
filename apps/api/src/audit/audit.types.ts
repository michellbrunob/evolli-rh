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

  // T163 — contexto empresarial ativo. A troca e um ato sensivel: muda o
  // escopo de TODA leitura e mutacao seguinte da sessao, entao deixa trilha.
  // Mesma convencao de valor persistido em portugues separado por ponto.
  "acesso_contexto_empresa_trocado",
  "acesso_empresa_autorizada_concedida",
  "acesso_empresa_autorizada_revogada",

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

  // Etapa 3 — Jornada e Ponto Rastreável (ADR 0008). Mesma convenção.
  //
  // Verbos deliberadamente ausentes: `ponto.evento.alterado`/`.excluido` (o
  // evento é imutável — não há caminho de alteração a auditar) e
  // `ponto.periodo.fechado`/`.aprovado` (fechamento e aprovação estão fora
  // desta V1).
  //
  // `ponto_consultado` existe aqui, ao contrário de `pessoas.*`: ver dado de
  // jornada/presença é ação sensível por si (spec Etapa 3 §5.5), mesmo
  // critério de `audit_log_read` (ADR 0004, decisão 6).
  "ponto_evento_registrado",
  "ponto_ajuste_registrado",
  "ponto_consultado",

  // Etapa 2 — Documentos (metadados, sem conteúdo; ADR 0011, T008). Valor
  // persistido em português por ponto (`documentos.documento_metadado.criado`),
  // identificador Prisma com `_`. A trilha registra a ação e o id técnico do
  // recurso — nunca o rótulo/tipo documental (ADR 0011, decisão 10; DP-2E-12).
  "documentos_tipo_documento_criado",
  "documentos_tipo_documento_atualizado",
  "documentos_documento_metadado_criado",
  "documentos_documento_metadado_consultado",
  "documentos_documento_metadado_substituido",
  "documentos_solicitacao_documento_criada",

  // T030 — Perfil global `master_tecnico`. Registra toda consulta em escopo
  // GLOBAL do Master (fail-safe, como `organizacao_estrutura_consultada`), com
  // ação + tipo de recurso + id técnico — nunca dado pessoal.
  "master_consulta_global",

  // T038 — Cadastros: Horarios. Mesma convenção. A trilha registra ação + tipo
  // de recurso + id técnico — nunca o nome/descrição da tabela, o dia/hora
  // configurados, nem qualquer dado pessoal do colaborador vinculado.
  //
  // `horarios_consultado` existe (como `ponto_consultado`) porque saber qual
  // horário um colaborador cumpre é dado sensível de presença/jornada — leitura
  // auditada em regime fail-safe.
  "horarios_tabela_criada",
  "horarios_tabela_desativada",
  "horarios_tabela_reativada",
  "horarios_vinculo_criado",
  "horarios_vinculo_encerrado",
  "horarios_consultado",

  // T120 — Listagem paginada de contas de acesso (`GET /v1/users`). Regime
  // fail-safe (mesmo critério de `ponto_consultado`): a leitura já autorizada
  // nunca é bloqueada por falha de auditoria. Nunca registra e-mail, senha,
  // hash, token ou filtro sensível.
  "users_listed",

  // T125 — MFA TOTP. Nunca registra segredo, URI otpauth, QR, código digitado,
  // código de recuperação, token de challenge, hash nem material que permita
  // reconstruí-los (ADR 0004 §5) — só ator, papel, empresa e id técnico.
  "mfa_enrollment_started",
  "mfa_confirmed",
  "mfa_challenge_succeeded",
  "mfa_challenge_failed",
  "mfa_recovery_code_used",
  "mfa_reset_by_admin",

  // T139 — Central de Solicitações de Pessoas. Convenção pontilhada de Pessoas
  // (`pessoas.*`), uma ação por transição, como em `pessoas.movimentacao.*`:
  // uma única ação genérica esconderia, na trilha, qual decisão o RH tomou.
  //
  // O evento carrega ator, papel, empresa e o id TÉCNICO da solicitação —
  // nunca o tipo da solicitação (`atestado` revelaria dado de saúde por
  // inferência), nunca o vínculo/colaborador, nunca o motivo codificado e
  // nunca conteúdo, que aliás não existe nesta fundação.
  //
  // `pessoas_solicitacao_consultada` existe (como `ponto_consultado` e
  // `horarios_consultado`) porque saber que alguém consultou as solicitações de
  // uma pessoa é por si um dado de interesse — leitura auditada em regime
  // fail-safe.
  "pessoas_solicitacao_criada",
  "pessoas_solicitacao_enviada",
  "pessoas_solicitacao_cancelada",
  "pessoas_solicitacao_revisao_iniciada",
  "pessoas_solicitacao_informacao_solicitada",
  "pessoas_solicitacao_revisao_retomada",
  "pessoas_solicitacao_encaminhada",
  "pessoas_solicitacao_recusada",
  "pessoas_solicitacao_reaberta",
  "pessoas_solicitacao_consultada",

  // T151 — Gestor consultivo (ADR 0015). As quatro primeiras registram a
  // CONFIGURACAO do escopo pelo RH; `gestor_equipe_consultada` registra a
  // leitura feita dentro dele, em regime fail-safe, como `ponto_consultado`.
  // Nenhuma carrega nome, matricula ou a justificativa em texto.
  "gestor_conta_vinculada",
  "gestor_conta_desvinculada",
  "gestor_atribuicao_criada",
  "gestor_atribuicao_encerrada",
  "gestor_excecao_criada",
  "gestor_excecao_encerrada",
  "gestor_equipe_consultada",

  // T169 — Contatos do colaborador (ficha aprovada em 2026-10-16). TODA
  // consulta e auditada, com valor devolvido ou nao, alem de criacao e edicao;
  // tentativa recusada leva `result` diferente de `success`. Nenhum evento
  // carrega e-mail, celular ou telefone: resultado e NOMES de campos vivem em
  // `contato_colaborador_evento`, correlacionados por `request_id`.
  "pessoas_contato_criado",
  "pessoas_contato_atualizado",
  "pessoas_contato_consultado",
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
  // T151 — Gestor consultivo (ADR 0015). Entram sem migration, por `resource`
  // ser uniao no codigo. Identificam a CONFIGURACAO de escopo e a consulta
  // feita dentro dele — nunca a pessoa consultada.
  | "access_user_colaborador"
  | "atribuicao_gestor_equipe"
  | "excecao_acesso_gestor"
  | "gestor_equipe"
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
  | "alocacao_organizacional"
  // Etapa 3 — Jornada e Ponto. Não há `periodo_apuracao`: competência é campo
  // do evento, não entidade (Baseline Jornada V1, decisão 6).
  | "evento_ponto"
  | "ajuste_ponto"
  // Etapa 2 — Documentos: rótulos TÉCNICOS do tipo de recurso, nunca o
  // tipo/rótulo documental (ADR 0011, decisão 10; DP-2E-12).
  | "tipo_documento"
  | "documento_metadado"
  | "solicitacao_documento"
  // T038 — Cadastros: Horarios. Rótulos técnicos; nunca o nome/descrição da
  // tabela nem o dia/hora configurados.
  | "tabela_horario"
  | "vinculo_horario"
  // T125 — MFA TOTP: rótulo técnico do recurso. Nunca segredo/URI/código.
  | "access_mfa"
  // T139 — Central de Solicitações de Pessoas: rótulo técnico do recurso.
  // Nunca o tipo da solicitação, o motivo codificado ou o vínculo. Não há
  // rótulo para o evento de histórico: ele é parte da própria solicitação.
  | "solicitacao_pessoa"
  // T169 — Contatos do colaborador: rotulo tecnico do recurso. Nos eventos de
  // tratamento e nas negacoes produzidas pelo servico de contatos, o
  // `resourceId` e o id do COLABORADOR, inclusive sem contato gravado. As
  // negacoes genericas do `AuthorizationGuard` seguem o padrao transversal
  // existente e podem registrar `resourceId: null`. Nunca o valor de e-mail,
  // celular ou telefone.
  | "contato_colaborador";

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
