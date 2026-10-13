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

export interface AreaApi {
  id: string;
  departamentoId: string;
  codigo: string;
  nome: string;
  status: string;
  criadoEm: string;
  atualizadoEm: string;
}

export interface ListarAreasQuery {
  pagina?: number;
  tamanhoPagina?: number;
  status?: string;
  departamentoId?: string;
}

export interface CriarAreaDto {
  codigo: string;
  nome: string;
  departamentoId: string;
}

export interface AtualizarAreaDto {
  nome: string;
}

export async function listarDepartamentosParaArea(): Promise<
  ResultadoPaginado<DepartamentoApi>
> {
  const res = await apiFetch("/departamentos?tamanhoPagina=100");
  return jsonOrThrow(res);
}

export async function listarAreas(
  query: ListarAreasQuery = {},
): Promise<ResultadoPaginado<AreaApi>> {
  const params = new URLSearchParams();
  if (query.pagina !== undefined) params.set("pagina", String(query.pagina));
  if (query.tamanhoPagina !== undefined)
    params.set("tamanhoPagina", String(query.tamanhoPagina));
  if (query.status) params.set("status", query.status);
  if (query.departamentoId) params.set("departamentoId", query.departamentoId);
  const qs = params.toString();
  const res = await apiFetch(`/areas${qs ? `?${qs}` : ""}`);
  return jsonOrThrow(res);
}

export async function criarArea(dto: CriarAreaDto): Promise<AreaApi> {
  const token = await getCsrf();
  const res = await apiFetch("/areas", {
    method: "POST",
    headers: { "x-csrf-token": token },
    body: JSON.stringify(dto),
  });
  return jsonOrThrow(res);
}

export async function atualizarArea(
  id: string,
  dto: AtualizarAreaDto,
): Promise<AreaApi> {
  const token = await getCsrf();
  const res = await apiFetch(`/areas/${id}`, {
    method: "PATCH",
    headers: { "x-csrf-token": token },
    body: JSON.stringify(dto),
  });
  return jsonOrThrow(res);
}

export interface EquipeApi {
  id: string;
  empresaId: string;
  departamentoId: string;
  unidadeOrganizacionalId: string | null;
  codigo: string;
  nome: string;
  status: string;
  criadoEm: string;
  atualizadoEm: string;
}

export interface ListarEquipesQuery {
  pagina?: number;
  tamanhoPagina?: number;
  status?: string;
  departamentoId?: string;
  unidadeOrganizacionalId?: string;
}

export interface CriarEquipeDto {
  codigo: string;
  nome: string;
  departamentoId: string;
  unidadeOrganizacionalId?: string;
}

export interface AtualizarEquipeDto {
  nome: string;
}

export async function listarDepartamentosParaEquipe(): Promise<
  ResultadoPaginado<DepartamentoApi>
> {
  const res = await apiFetch("/departamentos?tamanhoPagina=100");
  return jsonOrThrow(res);
}

export async function listarUnidadesParaEquipe(): Promise<
  ResultadoPaginado<UnidadeOrganizacionalApi>
> {
  const res = await apiFetch("/unidades-organizacionais?tamanhoPagina=100");
  return jsonOrThrow(res);
}

export async function listarEquipes(
  query: ListarEquipesQuery = {},
): Promise<ResultadoPaginado<EquipeApi>> {
  const params = new URLSearchParams();
  if (query.pagina !== undefined) params.set("pagina", String(query.pagina));
  if (query.tamanhoPagina !== undefined)
    params.set("tamanhoPagina", String(query.tamanhoPagina));
  if (query.status) params.set("status", query.status);
  if (query.departamentoId) params.set("departamentoId", query.departamentoId);
  if (query.unidadeOrganizacionalId)
    params.set("unidadeOrganizacionalId", query.unidadeOrganizacionalId);
  const qs = params.toString();
  const res = await apiFetch(`/equipes${qs ? `?${qs}` : ""}`);
  return jsonOrThrow(res);
}

export async function criarEquipe(dto: CriarEquipeDto): Promise<EquipeApi> {
  const token = await getCsrf();
  const res = await apiFetch("/equipes", {
    method: "POST",
    headers: { "x-csrf-token": token },
    body: JSON.stringify(dto),
  });
  return jsonOrThrow(res);
}

export async function atualizarEquipe(
  id: string,
  dto: AtualizarEquipeDto,
): Promise<EquipeApi> {
  const token = await getCsrf();
  const res = await apiFetch(`/equipes/${id}`, {
    method: "PATCH",
    headers: { "x-csrf-token": token },
    body: JSON.stringify(dto),
  });
  return jsonOrThrow(res);
}

export interface CentroCustoApi {
  id: string;
  empresaId: string;
  codigo: string;
  nome: string;
  status: string;
  criadoEm: string;
  atualizadoEm: string;
}

export interface ListarCentrosCustoQuery {
  pagina?: number;
  tamanhoPagina?: number;
  status?: string;
}

export interface CriarCentroCustoDto {
  codigo: string;
  nome: string;
  empresaId: string;
}

export interface AtualizarCentroCustoDto {
  nome: string;
}

export async function listarEmpresasParaCentroCusto(): Promise<
  ResultadoPaginado<EmpresaApi>
> {
  const res = await apiFetch("/empresas?tamanhoPagina=100");
  return jsonOrThrow(res);
}

export async function listarCentrosCusto(
  query: ListarCentrosCustoQuery = {},
): Promise<ResultadoPaginado<CentroCustoApi>> {
  const params = new URLSearchParams();
  if (query.pagina !== undefined) params.set("pagina", String(query.pagina));
  if (query.tamanhoPagina !== undefined)
    params.set("tamanhoPagina", String(query.tamanhoPagina));
  if (query.status) params.set("status", query.status);
  const qs = params.toString();
  const res = await apiFetch(`/centros-de-custo${qs ? `?${qs}` : ""}`);
  return jsonOrThrow(res);
}

export async function criarCentroCusto(
  dto: CriarCentroCustoDto,
): Promise<CentroCustoApi> {
  const token = await getCsrf();
  const res = await apiFetch("/centros-de-custo", {
    method: "POST",
    headers: { "x-csrf-token": token },
    body: JSON.stringify(dto),
  });
  return jsonOrThrow(res);
}

export async function atualizarCentroCusto(
  id: string,
  dto: AtualizarCentroCustoDto,
): Promise<CentroCustoApi> {
  const token = await getCsrf();
  const res = await apiFetch(`/centros-de-custo/${id}`, {
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

// ---------------------------------------------------------------------------
// Ciclo de vida: inativar e reativar (T158)
// ---------------------------------------------------------------------------

/**
 * Transições de situação dos nós organizacionais.
 *
 * As rotas existem desde as T104–T109 e nenhuma tela as alcançava. Nada aqui
 * é contrato novo: `POST /<recurso>/:id/inativar` e `POST /<recurso>/:id/reativar`,
 * sem corpo, exigindo `manage` no recurso e devolvendo a entidade atualizada.
 *
 * **Não existe exclusão de nó organizacional.** Nenhum dos sete controllers
 * de `organizacao` declara `DELETE`, e nenhuma função deste módulo emite esse
 * método — inativar é transição de estado, e o registro permanece. (O produto
 * tem um `DELETE`, em `sessoesClient`, para revogar sessão: outro domínio,
 * outra decisão, e nada aqui o alcança.)
 *
 * **Sem corpo na requisição.** O servidor não lê payload nestas rotas; mandar
 * um seria inventar contrato. O cabeçalho CSRF continua obrigatório, porque
 * são mutações.
 *
 * **O que o servidor responde, e que a interface não deve reinterpretar:**
 * `409` quando a situação já é a pretendida ou quando a inativação esbarra em
 * dependente ativo — e o servidor **não distingue os dois casos de propósito**,
 * para não revelar o dependente; `422` quando a reativação encontra o nível
 * superior inativo; `404` para inexistente ou fora da empresa, que respondem
 * igual por anti-enumeração.
 */
async function transicao<T>(caminho: string): Promise<T> {
  const token = await getCsrf();
  const res = await apiFetch(caminho, {
    method: "POST",
    headers: { "x-csrf-token": token },
  });
  return jsonOrThrow(res);
}

export async function inativarUnidade(
  id: string,
): Promise<UnidadeOrganizacionalApi> {
  return transicao(
    `/unidades-organizacionais/${encodeURIComponent(id)}/inativar`,
  );
}

export async function reativarUnidade(
  id: string,
): Promise<UnidadeOrganizacionalApi> {
  return transicao(
    `/unidades-organizacionais/${encodeURIComponent(id)}/reativar`,
  );
}

export async function inativarDepartamento(
  id: string,
): Promise<DepartamentoApi> {
  return transicao(`/departamentos/${encodeURIComponent(id)}/inativar`);
}

export async function reativarDepartamento(
  id: string,
): Promise<DepartamentoApi> {
  return transicao(`/departamentos/${encodeURIComponent(id)}/reativar`);
}

export async function inativarArea(id: string): Promise<AreaApi> {
  return transicao(`/areas/${encodeURIComponent(id)}/inativar`);
}

export async function reativarArea(id: string): Promise<AreaApi> {
  return transicao(`/areas/${encodeURIComponent(id)}/reativar`);
}

export async function inativarEquipe(id: string): Promise<EquipeApi> {
  return transicao(`/equipes/${encodeURIComponent(id)}/inativar`);
}

export async function reativarEquipe(id: string): Promise<EquipeApi> {
  return transicao(`/equipes/${encodeURIComponent(id)}/reativar`);
}

export async function inativarCentroCusto(id: string): Promise<CentroCustoApi> {
  return transicao(`/centros-de-custo/${encodeURIComponent(id)}/inativar`);
}

export async function reativarCentroCusto(id: string): Promise<CentroCustoApi> {
  return transicao(`/centros-de-custo/${encodeURIComponent(id)}/reativar`);
}
