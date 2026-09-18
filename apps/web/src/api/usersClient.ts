import { clearCsrfToken, getCsrfToken, refreshCsrfToken } from "./csrfClient";

const BASE = "/v1";
const USERS_ENDPOINT = `${BASE}/users`;

/**
 * Espelha exatamente a projeção `toSafeUser` do backend (T120) — nunca
 * inclui senha, hash, token, cookie ou qualquer segredo. `unitId`/`teamId`
 * são exibidos como vieram (nunca resolvidos para nome — esta tela não tem
 * acesso seguro a um catálogo de unidades/equipes por empresa arbitrária).
 */
export interface SafeAccessUserApi {
  id: string;
  email: string;
  role: string;
  companyId: string | null;
  unitId: string | null;
  teamId: string | null;
  status: string;
  createdAt: string;
  /**
   * T131 — disponibilidade do MFA definida pelo SERVIDOR (`GET /v1/users/me`).
   * A interface usa isto para exibir/ocultar as ações de MFA; o servidor
   * permanece autoritativo (rotas de MFA respondem 404 quando desativado).
   * Opcional para compatibilidade: ausente é tratado como indisponível.
   */
  mfaAvailable?: boolean;
}

/**
 * Papéis comuns atribuíveis por esta tela — exatamente os papéis que
 * `evaluateUserRole` (rbac.evaluator.ts) permite a `master_tecnico`/`rh`
 * atribuir. `master_tecnico`, `admin_tecnico`, `dpo` e `auditor` NUNCA
 * aparecem aqui: são papéis privilegiados/legados que nenhuma rota comum
 * pode conceder (o backend já recusa com 403; esta lista só evita oferecer
 * uma opção que sempre falharia).
 */
export const PAPEIS_COMUNS = [
  "rh",
  "dp",
  "gestor",
  "financeiro",
  "colaborador",
] as const;
export type PapelComum = (typeof PAPEIS_COMUNS)[number];

/** Rótulo amigável por papel — inclui os privilegiados só para EXIBIÇÃO
 * (uma conta `master_tecnico` pode aparecer na listagem do próprio
 * `master_tecnico`; precisa de rótulo, mesmo nunca sendo atribuível aqui). */
export const ROTULO_PAPEL: Record<string, string> = {
  master_tecnico: "Master técnico",
  admin_tecnico: "Admin técnico",
  rh: "RH",
  dp: "DP",
  gestor: "Gestor",
  financeiro: "Financeiro",
  colaborador: "Colaborador",
  auditor: "Auditor",
  dpo: "DPO",
};

export type StatusContaApi = "active" | "disabled" | "locked";

export const ROTULO_STATUS: Record<StatusContaApi, string> = {
  active: "Ativa",
  disabled: "Desativada",
  locked: "Bloqueada",
};

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
 * Perfil do ator autenticado (`GET /v1/users/me`) — usado só para ORIENTAR a
 * interface (quais ações mostrar); o backend continua sendo a autoridade
 * final em toda mutação (cada chamada de escrita é revalidada pelo
 * `AuthorizationGuard`, independentemente do que esta tela decidiu exibir).
 */
export async function obterUsuarioAtual(): Promise<SafeAccessUserApi> {
  const res = await apiFetch(`${USERS_ENDPOINT}/me`);
  return jsonOrThrow(res);
}

export interface ListarUsuariosQuery {
  status?: StatusContaApi;
  /** Só tem efeito quando o ator é `master_tecnico` — para `rh`/`dp` o
   * backend deriva a empresa da sessão e ignora qualquer valor enviado
   * (T120). Esta tela nunca envia este campo para `rh`/`dp`. */
  companyId?: string;
  role?: string;
  cursor?: string;
  limit?: number;
}

export interface ListarUsuariosResultado {
  items: SafeAccessUserApi[];
  nextCursor: string | null;
}

/**
 * Listagem paginada (`GET /v1/users`, T120) — keyset por `nextCursor`, sem
 * `total`, sem offset. Filtros só enumerados (`status`, `role`) — nunca
 * busca por e-mail/substring (o próprio contrato do backend não a
 * implementa).
 */
export async function listarUsuarios(
  query: ListarUsuariosQuery = {},
): Promise<ListarUsuariosResultado> {
  const params = new URLSearchParams();
  if (query.status) params.set("status", query.status);
  if (query.role) params.set("role", query.role);
  if (query.companyId) params.set("companyId", query.companyId);
  if (query.cursor) params.set("cursor", query.cursor);
  if (query.limit !== undefined) params.set("limit", String(query.limit));
  const qs = params.toString();
  const res = await apiFetch(`${USERS_ENDPOINT}${qs ? `?${qs}` : ""}`);
  return jsonOrThrow(res);
}

export interface CriarContaDto {
  email: string;
  password: string;
  role: PapelComum;
  /** Sempre resolvida pela tela antes de chamar — nunca digitada livremente
   * pelo `rh` (que só tem a própria empresa) nem deixada em aberto para o
   * `master_tecnico` (que escolhe entre as empresas reais do backend). */
  companyId: string;
}

/** Cria conta de acesso (`POST /v1/users`). Corpo estritamente igual ao
 * `CreateUserDto` do backend — nunca envia `unitId`/`teamId` (fora do
 * escopo desta tela; a rota aceita omiti-los). */
export async function criarConta(
  dto: CriarContaDto,
): Promise<SafeAccessUserApi> {
  const token = await getCsrf();
  const res = await apiFetch(USERS_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-csrf-token": token,
    },
    body: JSON.stringify(dto),
  });
  return jsonOrThrow(res);
}

/**
 * Altera só o papel (`PATCH /v1/users/:id/role`) — corpo estritamente
 * `{ role }`, igual ao `UpdateUserRoleDto`. Nunca envia `companyId`/
 * `unitId`/`teamId`: o backend recusaria com 400 (escopo imutável por esta
 * rota, T029), e esta tela nunca tenta.
 */
export async function alterarPapel(
  id: string,
  role: PapelComum,
): Promise<SafeAccessUserApi> {
  const token = await getCsrf();
  const res = await apiFetch(
    `${USERS_ENDPOINT}/${encodeURIComponent(id)}/role`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": token,
      },
      body: JSON.stringify({ role }),
    },
  );
  return jsonOrThrow(res);
}

/**
 * Desativa a conta (`POST /v1/users/:id/disable`) — revoga todas as sessões
 * ativas dela no servidor. Sem reativação, sem exclusão: nenhum dos dois
 * endpoints existe no backend.
 */
export async function desativarConta(id: string): Promise<void> {
  const token = await getCsrf();
  const res = await apiFetch(
    `${USERS_ENDPOINT}/${encodeURIComponent(id)}/disable`,
    {
      method: "POST",
      headers: { "x-csrf-token": token },
    },
  );
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as {
      message?: string | string[];
    };
    const msg = Array.isArray(body.message)
      ? (body.message[0] ?? "Não foi possível desativar a conta.")
      : (body.message ?? "Não foi possível desativar a conta.");
    throw new ApiError(res.status, msg);
  }
}

/**
 * Redefinição administrativa de MFA (`POST /v1/users/:id/mfa/reset`, T125).
 * Remove o fator, invalida challenges, apaga os códigos de recuperação e
 * revoga as sessões da conta — obrigando novo cadastro. O RBAC vive no
 * backend (só `master_tecnico` e `rh`; `dp` e demais recebem 403/404); esta
 * função nunca vê, gera ou substitui segredo/códigos. `id` sempre vem da
 * listagem já autorizada, nunca digitado.
 */
export async function resetarMfa(id: string): Promise<void> {
  const token = await getCsrf();
  const res = await apiFetch(
    `${USERS_ENDPOINT}/${encodeURIComponent(id)}/mfa/reset`,
    {
      method: "POST",
      headers: { "x-csrf-token": token },
    },
  );
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as {
      message?: string | string[];
    };
    const msg = Array.isArray(body.message)
      ? (body.message[0] ?? "Não foi possível redefinir o MFA da conta.")
      : (body.message ?? "Não foi possível redefinir o MFA da conta.");
    throw new ApiError(res.status, msg);
  }
}
