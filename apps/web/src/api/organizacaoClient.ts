import { clearCsrfToken, getCsrfToken, refreshCsrfToken } from "./csrfClient";

const BASE = "/v1";

export interface EmpresaApi {
  id: string;
  codigo: string;
  nome: string;
  status: string;
}

export interface UnidadeOrganizacionalApi {
  id: string;
  codigo: string;
  nome: string;
  empresaId: string;
  status: string;
  criadoEm: string;
  atualizadoEm: string;
}

export interface ResultadoPaginado<T> {
  itens: T[];
  pagina: number;
  tamanhoPagina: number;
  total: number;
}

export interface ListarUnidadesQuery {
  pagina?: number;
  tamanhoPagina?: number;
  status?: string;
}

export interface CriarUnidadeDto {
  codigo: string;
  nome: string;
  empresaId: string;
}

export interface AtualizarUnidadeDto {
  nome: string;
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
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new ApiError(res.status, body.message ?? "Erro na requisição.");
  }
  return res.json() as Promise<T>;
}

export interface DepartamentoApi {
  id: string;
  codigo: string;
  nome: string;
  empresaId: string;
  status: string;
  criadoEm: string;
  atualizadoEm: string;
}

export interface ListarDepartamentosQuery {
  pagina?: number;
  tamanhoPagina?: number;
  status?: string;
}

export interface CriarDepartamentoDto {
  codigo: string;
  nome: string;
  empresaId: string;
}

export interface AtualizarDepartamentoDto {
  nome: string;
}

export async function listarEmpresas(): Promise<ResultadoPaginado<EmpresaApi>> {
  const res = await apiFetch("/empresas?tamanhoPagina=1");
  return jsonOrThrow(res);
}

export async function listarEmpresasMulti(): Promise<
  ResultadoPaginado<EmpresaApi>
> {
  const res = await apiFetch("/empresas?tamanhoPagina=100");
  return jsonOrThrow(res);
}

export async function listarDepartamentos(
  query: ListarDepartamentosQuery = {},
): Promise<ResultadoPaginado<DepartamentoApi>> {
  const params = new URLSearchParams();
  if (query.pagina !== undefined) params.set("pagina", String(query.pagina));
  if (query.tamanhoPagina !== undefined)
    params.set("tamanhoPagina", String(query.tamanhoPagina));
  if (query.status) params.set("status", query.status);
  const qs = params.toString();
  const res = await apiFetch(`/departamentos${qs ? `?${qs}` : ""}`);
  return jsonOrThrow(res);
}

export async function criarDepartamento(
  dto: CriarDepartamentoDto,
): Promise<DepartamentoApi> {
  const token = await getCsrf();
  const res = await apiFetch("/departamentos", {
    method: "POST",
    headers: { "x-csrf-token": token },
    body: JSON.stringify(dto),
  });
  return jsonOrThrow(res);
}

export async function atualizarDepartamento(
  id: string,
  dto: AtualizarDepartamentoDto,
): Promise<DepartamentoApi> {
  const token = await getCsrf();
  const res = await apiFetch(`/departamentos/${id}`, {
    method: "PATCH",
    headers: { "x-csrf-token": token },
    body: JSON.stringify(dto),
  });
  return jsonOrThrow(res);
}

export async function listarUnidades(
  query: ListarUnidadesQuery = {},
): Promise<ResultadoPaginado<UnidadeOrganizacionalApi>> {
  const params = new URLSearchParams();
  if (query.pagina !== undefined) params.set("pagina", String(query.pagina));
  if (query.tamanhoPagina !== undefined)
    params.set("tamanhoPagina", String(query.tamanhoPagina));
  if (query.status) params.set("status", query.status);
  const qs = params.toString();
  const res = await apiFetch(`/unidades-organizacionais${qs ? `?${qs}` : ""}`);
  return jsonOrThrow(res);
}

export async function criarUnidade(
  dto: CriarUnidadeDto,
): Promise<UnidadeOrganizacionalApi> {
  const token = await getCsrf();
  const res = await apiFetch("/unidades-organizacionais", {
    method: "POST",
    headers: { "x-csrf-token": token },
    body: JSON.stringify(dto),
  });
  return jsonOrThrow(res);
}

export async function atualizarUnidade(
  id: string,
  dto: AtualizarUnidadeDto,
): Promise<UnidadeOrganizacionalApi> {
  const token = await getCsrf();
  const res = await apiFetch(`/unidades-organizacionais/${id}`, {
    method: "PATCH",
    headers: { "x-csrf-token": token },
    body: JSON.stringify(dto),
  });
  return jsonOrThrow(res);
}
