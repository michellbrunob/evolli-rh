import { clearCsrfToken, getCsrfToken, refreshCsrfToken } from "./csrfClient";

const BASE = "/v1";
const ENROLL_ENDPOINT = `${BASE}/auth/mfa/totp/enroll`;
const CONFIRM_ENDPOINT = `${BASE}/auth/mfa/totp/confirm`;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Material de provisionamento do cadastro TOTP (T125). Entregue SÓ nesta etapa
 * pelo backend — nunca reexibido após a confirmação. `secretBase32` é a chave
 * de entrada manual (compatível com Google/Microsoft Authenticator e apps
 * equivalentes); `otpauthUri` é o payload `otpauth://` que os apps também
 * aceitam. Mantidos apenas em memória enquanto o painel está aberto.
 */
export interface MaterialEnrollmentMfa {
  secretBase32: string;
  otpauthUri: string;
}

async function getCsrf(): Promise<string> {
  return getCsrfToken() ?? refreshCsrfToken();
}

async function apiFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const res = await fetch(path, {
    credentials: "same-origin",
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.headers as Record<string, string>),
    },
  });
  if (res.status === 401) {
    clearCsrfToken();
  }
  return res;
}

async function jsonOrThrow<T>(res: Response, fallback: string): Promise<T> {
  if (!res.ok) {
    // Nunca repassa o corpo de erro do servidor — só o status, mensagem
    // genérica decidida pela tela (anti-enumeração/sem estado interno).
    throw new ApiError(res.status, fallback);
  }
  return res.json() as Promise<T>;
}

/**
 * Inicia o cadastro do fator TOTP (`POST /v1/auth/mfa/totp/enroll`) — sessão +
 * CSRF. Devolve o material de provisionamento (chave manual + otpauth URI),
 * que a tela mostra só durante o cadastro. `409` significa "já configurado".
 */
export async function iniciarEnrollmentMfa(): Promise<MaterialEnrollmentMfa> {
  const token = await getCsrf();
  const res = await apiFetch(ENROLL_ENDPOINT, {
    method: "POST",
    headers: { "x-csrf-token": token },
  });
  return jsonOrThrow(res, "Não foi possível iniciar a configuração.");
}

/**
 * Confirma o cadastro com um código TOTP (`POST /v1/auth/mfa/totp/confirm`) —
 * sessão + CSRF. Em sucesso, ativa o fator e devolve os 10 códigos de
 * recuperação (exibição única). Este cliente nunca persiste os códigos: só os
 * repassa para a tela mostrar uma vez.
 */
export async function confirmarEnrollmentMfa(
  code: string,
): Promise<{ recoveryCodes: string[] }> {
  const token = await getCsrf();
  const res = await apiFetch(CONFIRM_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-csrf-token": token,
    },
    body: JSON.stringify({ code }),
  });
  return jsonOrThrow(res, "Não foi possível confirmar o código.");
}
