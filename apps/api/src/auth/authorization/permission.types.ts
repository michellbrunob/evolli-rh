import { AccessRole } from "@prisma/client";

/**
 * Recursos organizacionais da Etapa 1 — Fatia 1 (spec §8, ADR 0006).
 * Nomenclatura em português (ADR 0006, Emenda 1). Departamento e Area
 * aparecem aqui como **recurso** (o que é acessado), nunca como **escopo**
 * (o que delimita o acesso) — o escopo continua sendo só `empresa`
 * (Baseline V1, item 2).
 */
export const ORGANIZATIONAL_RESOURCES = [
  "empresa",
  "unidade_organizacional",
  "departamento",
  "area",
  "equipe",
  "cargo",
  "centro_custo",
] as const;

export type OrganizationalResource = (typeof ORGANIZATIONAL_RESOURCES)[number];

/**
 * Recursos de Colaboradores e Vida Funcional (Etapa 1 — Fatia 2, ADR 0007).
 *
 * `dado_restrito_colaborador` **não** aparece aqui: dado restrito ficou
 * inteiramente fora desta fatia (Baseline V1, item 5), e criar o recurso sem
 * o dado seria conceder superfície de autorização a algo que não existe.
 */
export const PESSOAS_RESOURCES = [
  "colaborador",
  "vinculo_funcional",
  "movimentacao_funcional",
  "alocacao_organizacional",
] as const;

export type PessoasResource = (typeof PESSOAS_RESOURCES)[number];

/**
 * Recursos do Gestor consultivo (T151, ADR 0015).
 *
 * Dois recursos, com atores opostos de proposito:
 *
 * - `gestor_atribuicao` e ADMINISTRACAO: o RH liga conta a colaborador,
 *   atribui equipes e concede excecoes. O proprio gestor NAO acessa este
 *   recurso — quem define o escopo nunca pode ser quem e escopado por ele.
 * - `gestor_equipe` e CONSULTA: o gestor le as pessoas dentro do escopo que o
 *   RH definiu. Acao `read` apenas; nao existe `create`/`alter`/`manage`,
 *   porque `PD-SOL-01` fixou o papel como consultivo e a decisao 7 da
 *   ADR 0015 nao abriu nenhuma mutacao.
 *
 * O ESCOPO de equipe nao cabe no avaliador puro: `AuthorizationSubject` tem
 * tres campos e nenhum deles e equipe. Isso e deliberado e segue a avaliacao
 * em DUAS FASES ja estabelecida — capacidade aqui, escopo no service, sempre
 * a partir da sessao. Conceder `gestor_equipe/read` NAO concede acesso a
 * ninguem: concede o direito de perguntar, e o service responde apenas o que
 * a atribuicao vigente sustenta.
 */
export const GESTOR_RESOURCES = ["gestor_atribuicao", "gestor_equipe"] as const;

export type GestorResource = (typeof GESTOR_RESOURCES)[number];

/**
 * Recursos de Jornada e Ponto (Etapa 3, ADR 0008, Baseline Jornada V1).
 *
 * Só dois. Não existe `periodo_apuracao` nem `fechamento_ponto`: competência é
 * um campo do evento, não uma entidade (decisão 6), e fechamento está fora
 * desta V1 (decisão 7) — criar o recurso de autorização sem a capacidade
 * correspondente sugeriria uma superfície que o sistema não tem.
 */
export const PONTO_RESOURCES = ["evento_ponto", "ajuste_ponto"] as const;

export type PontoResource = (typeof PONTO_RESOURCES)[number];

/**
 * Recursos de Documentos — V1 de METADADOS (Etapa 2, ADR 0011, T008).
 *
 * `versao_documento`/`conteudo_documento` **não** aparecem aqui: conteúdo é
 * Nível 2, não existe, e criar o recurso sem a capacidade seria conceder
 * superfície de autorização a algo inexistente (mesmo critério de
 * `dado_restrito_colaborador` na Fatia 2).
 */
export const DOCUMENTOS_RESOURCES = [
  "tipo_documento",
  "documento_metadado",
  "solicitacao_documento",
] as const;

export type DocumentosResource = (typeof DOCUMENTOS_RESOURCES)[number];

/**
 * Recursos de Cadastros — Horarios (T038).
 *
 * `tabela_horario` é a grade semanal reutilizável por empresa; `vinculo_horario`
 * é a atribuição histórica (com vigência) de uma tabela a um colaborador. Não
 * há recurso de "periodo": período é parte da definição imutável da tabela,
 * criado junto dela — não uma superfície de autorização própria.
 */
export const HORARIOS_RESOURCES = [
  "tabela_horario",
  "vinculo_horario",
] as const;

export type HorariosResource = (typeof HORARIOS_RESOURCES)[number];

/**
 * Recurso da Central de Solicitações de Pessoas (T139, `PD-SOL-01..05`).
 *
 * Um só. Não existe `evento_solicitacao_pessoa`: o histórico é lido pelo mesmo
 * `read` da própria solicitação — quem pode ver a solicitação pode ver como ela
 * chegou ao estado atual, e criar um recurso separado sugeriria uma alçada de
 * leitura que a decisão não criou. Também não existe recurso de "anexo" ou
 * "evidência": conteúdo continua bloqueado pelos portões documentais, e
 * declarar a superfície de autorização antes da capacidade repetiria o erro que
 * `documento_metadado`/`conteudo_documento` evitou na Etapa 2.
 */
export const SOLICITACOES_PESSOAS_RESOURCES = ["solicitacao_pessoa"] as const;

export type SolicitacoesPessoasResource =
  (typeof SOLICITACOES_PESSOAS_RESOURCES)[number];

/**
 * Recursos/ações desta fatia (matriz §3 da spec). Módulos futuros (Etapa 1+)
 * estendem este union — nunca reduzem o que já está aqui.
 */
export type AuthorizationResource =
  | "own_account"
  | "other_account"
  | "access_log"
  | "user_role"
  // T125 — Redefinição administrativa de MFA de OUTRA conta. Capacidade
  // própria (não `other_account`) porque o escopo de atores é diferente: só
  // `master_tecnico` (global) e `rh` (própria empresa) — `dp` é NEGADO aqui,
  // ao contrário de `other_account/manage` (que permite `dp`).
  | "mfa"
  | OrganizationalResource
  | PessoasResource
  | PontoResource
  | DocumentosResource
  | HorariosResource
  | SolicitacoesPessoasResource
  | GestorResource;

export type AuthorizationAction =
  | "read"
  | "manage"
  | "alter"
  | "create"
  // T125 — redefinição administrativa de MFA (só recurso "mfa").
  | "reset";

export interface AuthorizationSubject {
  userId: string;
  role: AccessRole;
  companyId: string | null;
}

export interface AuthorizationTarget {
  resource: AuthorizationResource;
  action: AuthorizationAction;
  targetUserId?: string;
  /**
   * Empresa do alvo. `undefined` significa **alvo ainda não resolvido** — é o
   * estado em que o `AuthorizationGuard` chama o avaliador para recursos
   * organizacionais, já que a entidade só é carregada dentro do service. Ver
   * `evaluateOrganizacao` em rbac.evaluator.ts para o que cada fase decide.
   */
  targetCompanyId?: string | null;
  /** Só relevante para resource "user_role" + action "alter". */
  targetNewRole?: AccessRole;
}

export function isOrganizationalResource(
  resource: AuthorizationResource,
): resource is OrganizationalResource {
  return (ORGANIZATIONAL_RESOURCES as readonly string[]).includes(resource);
}

export function isPessoasResource(
  resource: AuthorizationResource,
): resource is PessoasResource {
  return (PESSOAS_RESOURCES as readonly string[]).includes(resource);
}

export function isGestorResource(
  resource: AuthorizationResource,
): resource is GestorResource {
  return (GESTOR_RESOURCES as readonly string[]).includes(resource);
}

export function isPontoResource(
  resource: AuthorizationResource,
): resource is PontoResource {
  return (PONTO_RESOURCES as readonly string[]).includes(resource);
}

export function isDocumentosResource(
  resource: AuthorizationResource,
): resource is DocumentosResource {
  return (DOCUMENTOS_RESOURCES as readonly string[]).includes(resource);
}

export function isHorariosResource(
  resource: AuthorizationResource,
): resource is HorariosResource {
  return (HORARIOS_RESOURCES as readonly string[]).includes(resource);
}

export function isSolicitacoesPessoasResource(
  resource: AuthorizationResource,
): resource is SolicitacoesPessoasResource {
  return (SOLICITACOES_PESSOAS_RESOURCES as readonly string[]).includes(
    resource,
  );
}
