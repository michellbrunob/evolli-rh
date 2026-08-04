import { AuthorizationSubject, AuthorizationTarget } from "./permission.types";

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
      return false;
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
