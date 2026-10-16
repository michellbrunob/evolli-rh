import { ApiError } from "./colaboradoresClient";
import { clearCsrfToken, getCsrfToken, refreshCsrfToken } from "./csrfClient";

/**
 * T169 — contatos do colaborador: e-mail pessoal, celular e telefone.
 *
 * Rotas PRÓPRIAS (`/v1/colaboradores/:colaboradorId/contatos`). Nenhum valor de
 * contato vem na listagem, no detalhe ou na admissão, e a empresa NUNCA é
 * enviada: o servidor a resolve pelo vínculo do colaborador.
 *
 * `cache: "no-store"` — dado pessoal não fica no cache do navegador. Nada aqui
 * vai para `localStorage`, URL ou log.
 */

const BASE = "/v1";

export type SituacaoContatosApi = "sem_registro" | "registrado" | "bloqueado";

export interface ContatosApi {
  emailPessoal: string;
  celular: string;
  telefone: string;
  atualizadoEm: string;
}

export interface ContatosDoColaboradorApi {
  colaboradorId: string;
  empresaId: string;
  situacao: SituacaoContatosApi;
  contatos: ContatosApi | null;
}

export interface ContatosRegistradosApi extends ContatosDoColaboradorApi {
  resultado: "criado" | "atualizado" | "sem_alteracao";
}

export interface RegistrarContatosDto {
  emailPessoal: string;
  celular: string;
  telefone: string;
}

async function getCsrf(): Promise<string> {
  return getCsrfToken() ?? refreshCsrfToken();
}

async function apiFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "same-origin",
    cache: "no-store",
    ...init,
    headers: {
      "Content-Type": "application/json",
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

function rota(colaboradorId: string): string {
  return `/colaboradores/${encodeURIComponent(colaboradorId)}/contatos`;
}

export async function consultarContatosDoColaborador(
  colaboradorId: string,
): Promise<ContatosDoColaboradorApi> {
  const res = await apiFetch(rota(colaboradorId));
  return jsonOrThrow(res);
}

export async function registrarContatosDoColaborador(
  colaboradorId: string,
  dto: RegistrarContatosDto,
): Promise<ContatosRegistradosApi> {
  const token = await getCsrf();
  const res = await apiFetch(rota(colaboradorId), {
    method: "PUT",
    headers: { "x-csrf-token": token },
    body: JSON.stringify(dto),
  });
  return jsonOrThrow(res);
}
