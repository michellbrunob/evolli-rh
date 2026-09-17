import { clearCsrfToken, getCsrfToken, setCsrfToken } from "./csrfClient";

const BASE = "/v1";
const LOGIN_ENDPOINT = `${BASE}/auth/login`;
const LOGOUT_ENDPOINT = `${BASE}/auth/logout`;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const MFA_VERIFY_ENDPOINT = `${BASE}/auth/mfa/verify`;

export interface CredenciaisLogin {
  email: string;
  password: string;
}

/**
 * Desfecho do login (T125/T126): ou a sessão plena já foi criada (conta sem
 * MFA — token CSRF guardado em memória), ou a conta tem 2º fator ativo e o
 * backend devolveu um `challengeToken` opaco, SEM criar sessão. No segundo
 * caso, nenhuma sessão existe até `verifyMfa` concluir.
 */
export type ResultadoLogin =
  { mfaRequerido: false } | { mfaRequerido: true; challengeToken: string };

/**
 * Login por e-mail e senha (ADR 0003/0009). O cookie de sessão é HttpOnly e
 * `Secure` fora de desenvolvimento — o navegador o grava e o envia sozinho;
 * este cliente nunca o lê nem o manipula. Para conta sem MFA, a resposta traz
 * o token CSRF novo da sessão, guardado direto em memória (`setCsrfToken`) —
 * nunca em localStorage/sessionStorage. Para conta com MFA ativo, a resposta
 * traz `{ mfaRequired, challengeToken }` e NENHUMA sessão é criada ainda.
 *
 * Mensagem de erro: este cliente NUNCA repassa o texto do corpo de erro do
 * servidor para uma falha de autenticação — só o `status` HTTP, para que
 * quem chama decida a mensagem (sempre genérica: credencial errada, conta
 * inexistente, desativada ou bloqueada respondem todas com o mesmo 401,
 * anti-enumeração por desenho do próprio backend, spec §6).
 */
export async function login(
  credenciais: CredenciaisLogin,
): Promise<ResultadoLogin> {
  const res = await fetch(LOGIN_ENDPOINT, {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(credenciais),
  });

  if (!res.ok) {
    throw new ApiError(res.status, "Não foi possível entrar.");
  }

  const body = (await res.json().catch(() => ({}))) as {
    csrfToken?: string;
    mfaRequired?: boolean;
    challengeToken?: string;
  };

  // Conta com MFA ativo: nenhuma sessão criada; segue para a 2ª etapa.
  if (body.mfaRequired && body.challengeToken) {
    return { mfaRequerido: true, challengeToken: body.challengeToken };
  }

  if (!body.csrfToken) {
    throw new ApiError(
      res.status,
      "Resposta do servidor não contém token CSRF.",
    );
  }
  setCsrfToken(body.csrfToken);
  return { mfaRequerido: false };
}

/**
 * Verificação do 2º fator (T125/T126): envia o `challengeToken` opaco + o
 * código (TOTP de 6 dígitos ou código de recuperação) para
 * `POST /v1/auth/mfa/verify`. Sem sessão nem CSRF ainda — a credencial é o
 * próprio challenge (mesmo modelo do login). Em sucesso, o servidor emite a
 * sessão e devolve o token CSRF novo, guardado em memória. Falha vira
 * `ApiError` com o `status` — a mensagem genérica é decidida por quem chama
 * (nunca revela conta, fator ou estado interno).
 */
export async function verifyMfa(params: {
  challengeToken: string;
  code: string;
}): Promise<void> {
  const res = await fetch(MFA_VERIFY_ENDPOINT, {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    throw new ApiError(res.status, "Não foi possível verificar o código.");
  }

  const body = (await res.json().catch(() => ({}))) as { csrfToken?: string };
  if (!body.csrfToken) {
    throw new ApiError(
      res.status,
      "Resposta do servidor não contém token CSRF.",
    );
  }
  setCsrfToken(body.csrfToken);
}

/**
 * Logout real: revoga a sessão no servidor (`SessionGuard` + `CsrfGuard`) e
 * só então este cliente limpa o token CSRF em memória — em qualquer
 * desfecho, inclusive falha, porque uma sessão que o servidor já não
 * reconhece (401/403) não deve deixar a aba presa numa tela que parece
 * autenticada.
 */
export async function logout(): Promise<void> {
  const token = getCsrfToken();
  try {
    const res = await fetch(LOGOUT_ENDPOINT, {
      method: "POST",
      credentials: "same-origin",
      headers: token ? { "x-csrf-token": token } : {},
    });
    if (!res.ok && res.status !== 401 && res.status !== 403) {
      throw new ApiError(res.status, "Não foi possível encerrar a sessão.");
    }
  } finally {
    clearCsrfToken();
  }
}
