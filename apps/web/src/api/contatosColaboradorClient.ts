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

/**
 * T179 — os três contatos são OPCIONAIS (decisão da proprietária de
 * 2026-10-21): cada um pode vir `null`, que é "não informado".
 */
export interface ContatosApi {
  emailPessoal: string | null;
  celular: string | null;
  telefone: string | null;
  atualizadoEm: string;
}

export interface ContatosDoColaboradorApi {
  colaboradorId: string;
  empresaId: string;
  situacao: SituacaoContatosApi;
  contatos: ContatosApi | null;
}

/**
 * T179 — `removido`: o `PUT` com os três vazios (ou `null`) para quem TINHA
 * contatos inativa o registro; a resposta volta `sem_registro`, com
 * `contatos: null`, como a de quem nunca teve contato. Os três vazios para
 * quem já não tem registro voltam `sem_registro` e `sem_alteracao`.
 */
export interface ContatosRegistradosApi extends ContatosDoColaboradorApi {
  resultado: "criado" | "atualizado" | "sem_alteracao" | "removido";
}

/**
 * T179 — cada campo é opcional; `null` grava "não informado" (é assim que a
 * ficha apaga um contato). A tela envia os três, vazio como `null`.
 */
export interface RegistrarContatosDto {
  emailPessoal?: string | null;
  celular?: string | null;
  telefone?: string | null;
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
    // T179 — o corpo segue junto: o 409 de e-mail em uso traz `erros`.
    throw new ApiError(res.status, msg, body);
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
