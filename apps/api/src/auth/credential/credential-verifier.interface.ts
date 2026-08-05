import { AccessUser } from "@prisma/client";

export interface CredentialVerificationResult {
  outcome: "valid" | "invalid" | "account_disabled" | "account_locked";
  user?: AccessUser;
}

/**
 * Interface mínima de verificação de credencial (ADR 0003 §2). A sessão e o
 * avaliador RBAC/ABAC operam sobre o `AccessUser` já resolvido — trocar
 * e-mail/senha por OIDC/SSO no futuro é implementar esta interface de novo,
 * sem tocar sessão nem autorização. Nenhuma implementação além de
 * `LocalCredentialVerifier` (e-mail/senha) existe nesta fatia.
 */
export const CREDENTIAL_VERIFIER = Symbol("CREDENTIAL_VERIFIER");

export interface CredentialVerifier {
  verify(
    email: string,
    plaintextSecret: string,
  ): Promise<CredentialVerificationResult>;
}
