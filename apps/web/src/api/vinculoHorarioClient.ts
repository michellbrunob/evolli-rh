import { clearCsrfToken, getCsrfToken, refreshCsrfToken } from "./csrfClient";

const BASE = "/v1";

export interface VinculoHorarioApi {
  id: string;
  colaboradorId: string;
  empresaId: string;
  tabelaHorarioId: string;
  vigenciaInicio: string;
  vigenciaFim: string | null;
  criadoPorUserId: string;
  criadoEm: string;
  atualizadoEm: string;
}

/**
 * Espelha `CriarVinculoHorarioDto` do backend. Não existe `empresaId` aqui —
 * a empresa é sempre resolvida da sessão. `colaboradorId` é o colaborador
 * (não o vínculo funcional): o backend só usa o vínculo funcional como
 * pré-condição de pertencimento à empresa, nunca como referência persistida.
 */
export interface CriarVinculoHorarioDto {
  colaboradorId: string;
  tabelaHorarioId: string;
  vigenciaInicio: string;
  vigenciaFim?: string;
}

/** `vigenciaFim` é obrigatório no encerramento — não existe encerramento "imediato". */
export interface EncerrarVinculoHorarioDto {
  vigenciaFim: string;
}

export interface ListarVinculosHorarioQuery {
  colaboradorId?: string;
  tabelaHorarioId?: string;
  pagina?: number;
  tamanhoPagina?: number;
}

export interface ResultadoPaginado<T> {
  itens: T[];
  pagina: number;
  tamanhoPagina: number;
  total: number;
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
  const res = await fetch(`${BASE}${path}`, {
    credentials: "same-origin",
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

export async function listarVinculosHorario(
  query: ListarVinculosHorarioQuery = {},
): Promise<ResultadoPaginado<VinculoHorarioApi>> {
  const params = new URLSearchParams();
  if (query.colaboradorId) params.set("colaboradorId", query.colaboradorId);
  if (query.tabelaHorarioId)
    params.set("tabelaHorarioId", query.tabelaHorarioId);
  if (query.pagina !== undefined) params.set("pagina", String(query.pagina));
  if (query.tamanhoPagina !== undefined)
    params.set("tamanhoPagina", String(query.tamanhoPagina));
  const qs = params.toString();
  const res = await apiFetch(`/horarios/vinculos${qs ? `?${qs}` : ""}`);
  return jsonOrThrow(res);
}

export async function buscarVinculoHorario(
  id: string,
): Promise<VinculoHorarioApi> {
  const res = await apiFetch(`/horarios/vinculos/${id}`);
  return jsonOrThrow(res);
}

export async function criarVinculoHorario(
  dto: CriarVinculoHorarioDto,
): Promise<VinculoHorarioApi> {
  const token = await getCsrf();
  const res = await apiFetch("/horarios/vinculos", {
    method: "POST",
    headers: { "x-csrf-token": token },
    body: JSON.stringify(dto),
  });
  return jsonOrThrow(res);
}

export async function encerrarVinculoHorario(
  id: string,
  dto: EncerrarVinculoHorarioDto,
): Promise<VinculoHorarioApi> {
  const token = await getCsrf();
  const res = await apiFetch(`/horarios/vinculos/${id}/encerrar`, {
    method: "POST",
    headers: { "x-csrf-token": token },
    body: JSON.stringify(dto),
  });
  return jsonOrThrow(res);
}
