import {
  clearCsrfToken,
  descartarTokenSeDesatualizado,
  getCsrfToken,
  refreshCsrfToken,
} from "./csrfClient";

const BASE = "/v1";

export interface EmpresaApi {
  id: string;
  codigo: string;
  nome: string;
  status: string;
}

export interface CargoApi {
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

export interface ListarCargosQuery {
  pagina?: number;
  tamanhoPagina?: number;
  status?: string;
}

export interface CriarCargoDto {
  codigo: string;
  nome: string;
  empresaId: string;
}

export interface AtualizarCargoDto {
  nome: string;
}

export class ApiError extends Error {
  /** T180 — código estável da recusa (ex.: `csrf_invalido`), quando vem. */
  readonly codigo?: string;

  constructor(
    readonly status: number,
    message: string,
    corpo?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
    // T180 — só `codigo` (texto) é lido do corpo, como em `colaboradoresClient`.
    if (typeof corpo === "object" && corpo !== null) {
      const { codigo } = corpo as { codigo?: unknown };
      if (typeof codigo === "string") this.codigo = codigo;
    }
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
  // T180 — 403 `csrf_invalido`: o token desta aba ficou desatualizado;
  // descartado, a próxima gravação pede um novo (como na T179).
  await descartarTokenSeDesatualizado(res);
  return res;
}

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new ApiError(res.status, body.message ?? "Erro na requisição.", body);
  }
  return res.json() as Promise<T>;
}

/**
 * Lista empresas no escopo do ator com tamanhoPagina=100 para suportar atores
 * com múltiplas empresas autorizadas. Não usa tamanhoPagina=1 para evitar
 * associação silenciosa de criação à primeira empresa retornada.
 */
export async function listarEmpresas(): Promise<ResultadoPaginado<EmpresaApi>> {
  const res = await apiFetch("/empresas?tamanhoPagina=100");
  return jsonOrThrow(res);
}

export async function listarCargos(
  query: ListarCargosQuery = {},
): Promise<ResultadoPaginado<CargoApi>> {
  const params = new URLSearchParams();
  if (query.pagina !== undefined) params.set("pagina", String(query.pagina));
  if (query.tamanhoPagina !== undefined)
    params.set("tamanhoPagina", String(query.tamanhoPagina));
  if (query.status) params.set("status", query.status);
  const qs = params.toString();
  const res = await apiFetch(`/cargos${qs ? `?${qs}` : ""}`);
  return jsonOrThrow(res);
}

export async function criarCargo(dto: CriarCargoDto): Promise<CargoApi> {
  const token = await getCsrf();
  const res = await apiFetch("/cargos", {
    method: "POST",
    headers: { "x-csrf-token": token },
    body: JSON.stringify(dto),
  });
  return jsonOrThrow(res);
}

export async function atualizarCargo(
  id: string,
  dto: AtualizarCargoDto,
): Promise<CargoApi> {
  const token = await getCsrf();
  const res = await apiFetch(`/cargos/${id}`, {
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
 * `POST /cargos/:id/inativar` e `POST /cargos/:id/reativar`, existentes desde
 * as T104–T109 e até aqui sem tela. Sem corpo, exigindo `manage` em `cargo` e
 * devolvendo o cargo atualizado. Não existe rota de exclusão.
 *
 * Mora aqui, e não em `organizacaoClient`, porque cargo já tem cliente
 * próprio — e cada módulo de `apps/web/src/api` carrega o seu `apiFetch` e o
 * seu `ApiError`, por convenção vigente no projeto.
 */
async function transicaoCargo(caminho: string): Promise<CargoApi> {
  const token = await getCsrf();
  const res = await apiFetch(caminho, {
    method: "POST",
    headers: { "x-csrf-token": token },
  });
  return jsonOrThrow(res);
}

export async function inativarCargo(id: string): Promise<CargoApi> {
  return transicaoCargo(`/cargos/${encodeURIComponent(id)}/inativar`);
}

export async function reativarCargo(id: string): Promise<CargoApi> {
  return transicaoCargo(`/cargos/${encodeURIComponent(id)}/reativar`);
}
