import {
  clearCsrfToken,
  descartarTokenSeDesatualizado,
  tokenCsrfParaGravacao,
} from "./csrfClient";

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
  /** T182 — `null` nas tabelas criadas antes do código existir. */
  codigo: string | null;
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
  /** T182 — obrigatório, único na empresa. */
  codigo: string;
  nome: string;
  periodos: PeriodoInputDto[];
}

/**
 * T182 — edição de uma jornada: só nome e código. Os períodos são imutáveis
 * desde a T038 (no banco, inclusive).
 */
export interface EditarTabelaHorarioDto {
  codigo?: string;
  nome?: string;
}

export interface ListarTabelasHorarioQuery {
  ativo?: boolean;
  /** T182 — busca por nome ou código, na empresa da sessão. */
  busca?: string;
  pagina?: number;
  tamanhoPagina?: number;
}

export interface ResultadoPaginado<T> {
  itens: T[];
  pagina: number;
  tamanhoPagina: number;
  total: number;
}

/** T182 — campo recusado pelo servidor, sem o valor (ex.: código em uso). */
export interface ErroDeCampoApi {
  campo: string;
  motivo: string;
}

export class ApiError extends Error {
  /** T182 — campos recusados, quando o servidor os informa. */
  readonly erros?: readonly ErroDeCampoApi[];
  /** T182 — código estável da recusa, quando o servidor o informa. */
  readonly codigo?: string;

  /**
   * `corpo` é o corpo JSON do erro, ou nada. Só `erros` (lista de
   * `{campo, motivo}` em texto) e `codigo` (texto) são lidos.
   */
  constructor(
    readonly status: number,
    message: string,
    corpo?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
    if (typeof corpo === "object" && corpo !== null) {
      const { erros, codigo } = corpo as { erros?: unknown; codigo?: unknown };
      if (Array.isArray(erros)) {
        this.erros = erros.filter(
          (e): e is ErroDeCampoApi =>
            typeof e === "object" &&
            e !== null &&
            typeof (e as { campo?: unknown }).campo === "string" &&
            typeof (e as { motivo?: unknown }).motivo === "string",
        );
      }
      if (typeof codigo === "string") this.codigo = codigo;
    }
  }
}

/**
 * T182 — o token da gravação, como nos clientes de pessoas: rede caída ao
 * renová-lo vira `CsrfRequestError`, e a gravação nem sai.
 */
async function getCsrf(): Promise<string> {
  return tokenCsrfParaGravacao();
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
  // T182 — 403 `csrf_invalido`: o token desta aba ficou desatualizado;
  // descartado, a próxima gravação pede um novo.
  await descartarTokenSeDesatualizado(res);
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
    // T182 — o corpo segue junto: o 409 de código em uso traz `erros`.
    throw new ApiError(res.status, msg, body);
  }
  return res.json() as Promise<T>;
}

export async function listarTabelasHorario(
  query: ListarTabelasHorarioQuery = {},
): Promise<ResultadoPaginado<TabelaHorarioApi>> {
  const params = new URLSearchParams();
  if (query.ativo !== undefined) params.set("ativo", String(query.ativo));
  if (query.busca) params.set("busca", query.busca);
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

/** T182 — edita nome e/ou código de uma jornada da própria empresa (RH). */
export async function editarTabelaHorario(
  id: string,
  dto: EditarTabelaHorarioDto,
): Promise<TabelaHorarioApi> {
  const token = await getCsrf();
  const res = await apiFetch(`/horarios/${id}`, {
    method: "PATCH",
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
