import { clearCsrfToken, getCsrfToken, refreshCsrfToken } from "./csrfClient";

const BASE = "/v1";

export type DiaSemana =
  "segunda" | "terca" | "quarta" | "quinta" | "sexta" | "sabado" | "domingo";

export interface PeriodoApi {
  dia: string;
  inicio: string;
  fim: string;
}

export interface TabelaHorarioApi {
  id: string;
  empresaId: string;
  nome: string;
  ativo: boolean;
  criadoPorUserId: string;
  criadoEm: string;
  atualizadoEm: string;
  periodos: PeriodoApi[];
}

export interface PeriodoInputDto {
  dia: DiaSemana;
  inicio: string;
  fim: string;
}

export interface CriarTabelaHorarioDto {
  nome: string;
  periodos: PeriodoInputDto[];
}

export interface ListarTabelasHorarioQuery {
  ativo?: boolean;
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

export async function listarTabelasHorario(
  query: ListarTabelasHorarioQuery = {},
): Promise<ResultadoPaginado<TabelaHorarioApi>> {
  const params = new URLSearchParams();
  if (query.ativo !== undefined) params.set("ativo", String(query.ativo));
  if (query.pagina !== undefined) params.set("pagina", String(query.pagina));
  if (query.tamanhoPagina !== undefined)
    params.set("tamanhoPagina", String(query.tamanhoPagina));
  const qs = params.toString();
  const res = await apiFetch(`/horarios${qs ? `?${qs}` : ""}`);
  return jsonOrThrow(res);
}

export async function buscarTabelaHorario(
  id: string,
): Promise<TabelaHorarioApi> {
  const res = await apiFetch(`/horarios/${id}`);
  return jsonOrThrow(res);
}

export async function criarTabelaHorario(
  dto: CriarTabelaHorarioDto,
): Promise<TabelaHorarioApi> {
  const token = await getCsrf();
  const res = await apiFetch("/horarios", {
    method: "POST",
    headers: { "x-csrf-token": token },
    body: JSON.stringify(dto),
  });
  return jsonOrThrow(res);
}

export async function desativarTabelaHorario(
  id: string,
): Promise<TabelaHorarioApi> {
  const token = await getCsrf();
  const res = await apiFetch(`/horarios/${id}/desativar`, {
    method: "POST",
    headers: { "x-csrf-token": token },
  });
  return jsonOrThrow(res);
}

export async function reativarTabelaHorario(
  id: string,
): Promise<TabelaHorarioApi> {
  const token = await getCsrf();
  const res = await apiFetch(`/horarios/${id}/reativar`, {
    method: "POST",
    headers: { "x-csrf-token": token },
  });
  return jsonOrThrow(res);
}
