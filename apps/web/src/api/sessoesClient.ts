import { clearCsrfToken, getCsrfToken, refreshCsrfToken } from "./csrfClient";

const BASE = "/v1";
const SESSIONS_ENDPOINT = `${BASE}/auth/sessions`;

/**
 * Espelha exatamente a projeção de `GET /v1/auth/sessions` — nunca inclui
 * token, hash, cookie ou qualquer segredo (o backend já projeta só estes
 * campos; este cliente não acrescenta nem lê nada além deles).
 */
export interface SessaoApi {
  id: string;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  ip: string | null;
  userAgent: string | null;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
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

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as {
      message?: string | string[];
    };
    const msg = Array.isArray(body.message)
      ? (body.message[0] ?? "Erro na requisição.")
      : (body.message ?? "Erro na requisição.");
    throw new ApiError(res.status, msg);
  }
  return res.json() as Promise<T>;
}

/**
 * Lista só as sessões ATIVAS da própria conta autenticada
 * (`SessionService.listActiveForUser`, escopado ao `CurrentUser` da sessão
 * corrente — nunca aceita ou expõe id de outro usuário). Não existe
 * paginação neste endpoint; a lista inteira vem de uma vez.
 */
export async function listarSessoesAtivas(): Promise<SessaoApi[]> {
  const res = await apiFetch(SESSIONS_ENDPOINT);
  return jsonOrThrow(res);
}

/**
 * Revoga uma sessão por `id` — sempre um `id` que já veio de
 * `listarSessoesAtivas()` (portanto sempre da própria conta). Este cliente
 * nunca aceita um id digitado ou de origem externa; a tela que o chama
 * também não oferece esse caminho, por desenho (nunca revogar sessão de
 * outra pessoa pela UI, ainda que o backend aceite isso para um ator com
 * papel administrativo — capacidade que esta tela nunca exerce).
 */
export async function revogarSessao(id: string): Promise<void> {
  const token = await getCsrf();
  const res = await apiFetch(`${SESSIONS_ENDPOINT}/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { "x-csrf-token": token },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as {
      message?: string | string[];
    };
    const msg = Array.isArray(body.message)
      ? (body.message[0] ?? "Não foi possível encerrar a sessão.")
      : (body.message ?? "Não foi possível encerrar a sessão.");
    throw new ApiError(res.status, msg);
  }
}
