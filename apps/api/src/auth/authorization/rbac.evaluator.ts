import {
  AuthorizationSubject,
  AuthorizationTarget,
  isOrganizationalResource,
} from "./permission.types";

/**
 * Avaliador puro RBAC/ABAC — negação por padrão (spec §5). Nenhuma
 * dependência de banco/HTTP: recebe o sujeito (usuário autenticado) e o
 * alvo (recurso + ação + escopo), decide permitir/negar. Guard/controller
 * resolvem o alvo antes de chamar isto.
 */
export function evaluatePermission(
  subject: AuthorizationSubject,
  target: AuthorizationTarget,
): boolean {
  switch (target.resource) {
    case "own_account":
      return evaluateOwnAccount(subject, target);
    case "other_account":
      return evaluateOtherAccount(subject, target);
    case "access_log":
      return evaluateAccessLog(subject, target);
    case "user_role":
      return evaluateUserRole(subject, target);
    default:
      // Recursos organizacionais (Etapa 1, Fatia 1). Mantém a negação por
      // padrão: qualquer recurso não reconhecido continua bloqueado.
      return isOrganizationalResource(target.resource)
        ? evaluateOrganizacao(subject, target)
        : false;
  }
}

function evaluateOwnAccount(
  subject: AuthorizationSubject,
  target: AuthorizationTarget,
): boolean {
  if (target.action !== "read" && target.action !== "manage") {
    return false;
  }
  // Sem targetUserId explícito, assume-se "a própria conta" (uso típico:
  // GET /users/me). Com targetUserId, só permite se for o próprio.
  return (
    target.targetUserId === undefined || target.targetUserId === subject.userId
  );
}

function evaluateOtherAccount(
  subject: AuthorizationSubject,
  target: AuthorizationTarget,
): boolean {
  if (target.action !== "manage") {
    return false;
  }
  if (target.targetUserId === subject.userId) {
    // Gestão de "outro" usuário nunca é o próprio — negado por padrão aqui;
    // autoatendimento passa por "own_account".
    return false;
  }
  if (subject.role === "admin_tecnico") {
    return true; // escopo: instância inteira
  }
  if (subject.role === "rh" || subject.role === "dp") {
    return isSameCompany(subject, target);
  }
  return false;
}

function evaluateAccessLog(
  subject: AuthorizationSubject,
  target: AuthorizationTarget,
): boolean {
  if (target.action !== "read") {
    return false;
  }
  return (
    subject.role === "admin_tecnico" ||
    subject.role === "auditor" ||
    subject.role === "dpo"
  );
}

function evaluateUserRole(
  subject: AuthorizationSubject,
  target: AuthorizationTarget,
): boolean {
  if (target.action === "alter") {
    if (!target.targetUserId || target.targetUserId === subject.userId) {
      // Ninguém altera o próprio papel/escopo — previne autoelevação.
      return false;
    }
  } else if (target.action !== "create") {
    return false;
  }

  if (subject.role === "admin_tecnico") {
    return true;
  }
  if (subject.role === "rh") {
    if (target.targetNewRole === "admin_tecnico") {
      // RH não pode se auto-promover nem criar/promover terceiro a admin
      // técnico.
      return false;
    }
    return isSameCompany(subject, target);
  }
  return false;
}

/**
 * Estrutura organizacional (Etapa 1 — Fatia 1, spec §8; ADR 0006).
 *
 * Avaliado em **duas fases**, porque o alvo organizacional não é um
 * `AccessUser` e o `AuthorizationGuard` não o carrega:
 *
 * 1. **Capacidade** (`targetCompanyId === undefined`) — roda no guard. Decide
 *    só se o papel pode, em princípio, executar esta ação sobre este tipo de
 *    recurso. Não concede acesso a dado nenhum: a requisição apenas chega ao
 *    service.
 * 2. **Escopo** (`targetCompanyId` definido) — roda no service, depois de
 *    resolver a empresa da entidade. É aqui que a fronteira por empresa é
 *    aplicada.
 *
 * O isolamento não depende de o service lembrar de chamar a fase 2: toda
 * consulta do módulo organizacional já é construída com o filtro de empresa
 * derivado da sessão (ver `escopoEmpresa` em organizacao/escopo.util.ts), de
 * modo que um ator fora do escopo não encontra a linha. A fase 2 é a checagem
 * explícita adicional sobre a entidade carregada.
 *
 * Departamento e Area são recurso, nunca escopo: a fronteira continua sendo
 * `empresa` (Baseline V1, item 2).
 */
function evaluateOrganizacao(
  subject: AuthorizationSubject,
  target: AuthorizationTarget,
): boolean {
  const escopoResolvido = target.targetCompanyId !== undefined;

  switch (subject.role) {
    // Exceção temporária e condicionada aprovada na Emenda 1 da ADR 0005:
    // acesso global ao ambiente interno, sempre auditado. Toda leitura de
    // escopo amplo gera evento (spec §9).
    case "admin_tecnico":
      return true;

    // Matriz §8: lê e administra a estrutura da própria empresa.
    case "rh":
      // Criar uma empresa nova está fora de "própria empresa" — a empresa
      // criada, por definição, não é a do ator, e conceder isso ampliaria o
      // escopo do papel por interpretação. Só escopo global cria empresa.
      if (target.resource === "empresa" && target.action === "create") {
        return false;
      }
      return escopoResolvido
        ? isSameCompany(subject, target)
        : subject.companyId !== null;

    // Matriz §8: leitura na própria empresa, sem escrita.
    case "dp":
      if (target.action !== "read") {
        return false;
      }
      return escopoResolvido
        ? isSameCompany(subject, target)
        : subject.companyId !== null;

    // Matriz §8: "Leitura de `centro_custo` e estrutura mínima". Só a parte
    // inequívoca é concedida — `centro_custo`. "Estrutura mínima" não define
    // quais nós nem em que profundidade; conceder por interpretação seria
    // decidir escopo de acesso por suposição, o que a spec proíbe. Os demais
    // recursos ficam negados até deliberação explícita.
    case "financeiro":
      if (target.action !== "read" || target.resource !== "centro_custo") {
        return false;
      }
      return escopoResolvido
        ? isSameCompany(subject, target)
        : subject.companyId !== null;

    // `gestor`: a matriz marca leitura "restrita", mas o escopo exato é
    // pendência declarada (DP-8) e depende da entidade colaborador, que não
    // existe nesta fatia. Sem escopo definido, conceder leitura seria
    // escolher a fronteira por conta própria — negado por padrão.
    //
    // `auditor` e `dpo`: não são provisionados nesta fatia e seu escopo é
    // pendência declarada (DP-7, Emenda 1 da ADR 0005, item 3). O critério de
    // aceite da spec §12 exige que não sejam provisionáveis por nenhum fluxo
    // desta fatia — negado por padrão. A leitura da trilha de auditoria
    // (`access_log`) que eles já possuem permanece inalterada.
    //
    // `colaborador`: sem acesso à estrutura nesta fatia (matriz §8).
    default:
      return false;
  }
}

function isSameCompany(
  subject: AuthorizationSubject,
  target: AuthorizationTarget,
): boolean {
  return (
    subject.companyId !== null &&
    subject.companyId !== undefined &&
    subject.companyId === target.targetCompanyId
  );
}
