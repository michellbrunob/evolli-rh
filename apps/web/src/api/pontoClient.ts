import { clearCsrfToken, getCsrfToken, refreshCsrfToken } from "./csrfClient";

const BASE = "/v1";

export type TipoEventoPonto =
  "entrada" | "saida" | "inicio_pausa" | "fim_pausa";

export type MotivoAjustePonto =
  | "erro_de_digitacao"
  | "registro_duplicado"
  | "registro_indevido"
  | "outro_controlado";

/** Valor efetivo já resolvido pela API — o original com os ajustes aplicados. */
export interface ValorEfetivoPonto {
  tipo: TipoEventoPonto;
  momento: string;
  anulado: boolean;
  totalAjustes: number;
}

export interface AjustePontoApi {
  id: string;
  motivoCodigo: MotivoAjustePonto;
  anula: boolean;
  momentoCorrigido: string | null;
  tipoCorrigido: TipoEventoPonto | null;
  registradoPorUserId: string;
  registradoEm: string;
}

export interface EventoPontoApi {
  id: string;
  vinculoId: string;
  empresaId: string;
  tipo: TipoEventoPonto;
  momento: string;
  competencia: string;
  registradoPorUserId: string;
  registradoEm: string;
  efetivo: ValorEfetivoPonto;
}

export interface EventoPontoDetalhadoApi extends EventoPontoApi {
  ajustes: AjustePontoApi[];
}

export interface ResultadoPaginado<T> {
  itens: T[];
  pagina: number;
  tamanhoPagina: number;
  total: number;
}

export interface ListarPontosQuery {
  vinculoId?: string;
  competencia?: string;
  tipo?: TipoEventoPonto;
  pagina?: number;
  tamanhoPagina?: number;
}

/** Espelha `RegistrarEventoPontoDto`. `momento` é ISO date-time com fuso. */
export interface RegistrarEventoPontoDto {
  vinculoId: string;
  tipo: TipoEventoPonto;
  momento: string;
}

/**
 * Espelha `RegistrarAjustePontoDto`. Correção aditiva OU anulação — nunca
 * edita o evento original. `anula: true` é terminal; correção informa
 * `momentoCorrigido` e/ou `tipoCorrigido`. Motivo vem do catálogo fechado.
 */
export interface RegistrarAjustePontoDto {
  motivoCodigo: MotivoAjustePonto;
  anula?: boolean;
  momentoCorrigido?: string;
  tipoCorrigido?: TipoEventoPonto;
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

export async function listarPontos(
  query: ListarPontosQuery = {},
): Promise<ResultadoPaginado<EventoPontoApi>> {
  const params = new URLSearchParams();
  if (query.vinculoId) params.set("vinculoId", query.vinculoId);
  if (query.competencia) params.set("competencia", query.competencia);
  if (query.tipo) params.set("tipo", query.tipo);
  if (query.pagina !== undefined) params.set("pagina", String(query.pagina));
  if (query.tamanhoPagina !== undefined)
    params.set("tamanhoPagina", String(query.tamanhoPagina));
  const qs = params.toString();
  const res = await apiFetch(`/pontos${qs ? `?${qs}` : ""}`);
  return jsonOrThrow(res);
}

export async function buscarPonto(
  id: string,
): Promise<EventoPontoDetalhadoApi> {
  const res = await apiFetch(`/pontos/${id}`);
  return jsonOrThrow(res);
}

export async function registrarPonto(
  dto: RegistrarEventoPontoDto,
): Promise<EventoPontoApi> {
  const token = await getCsrf();
  const res = await apiFetch("/pontos", {
    method: "POST",
    headers: { "x-csrf-token": token },
    body: JSON.stringify(dto),
  });
  return jsonOrThrow(res);
}

export async function registrarAjustePonto(
  pontoId: string,
  dto: RegistrarAjustePontoDto,
): Promise<AjustePontoApi> {
  const token = await getCsrf();
  const res = await apiFetch(`/pontos/${pontoId}/ajustes`, {
    method: "POST",
    headers: { "x-csrf-token": token },
    body: JSON.stringify(dto),
  });
  return jsonOrThrow(res);
}
