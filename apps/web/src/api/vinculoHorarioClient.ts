import {
  clearCsrfToken,
  descartarTokenSeDesatualizado,
  tokenCsrfParaGravacao,
} from "./csrfClient";
import { ApiError, type ResultadoPaginado } from "./horariosClient";

export { ApiError };
export type { ResultadoPaginado };

const BASE = "/v1";

/**
 * T183 — a jornada do vínculo, como o servidor a projeta: o histórico mostra
 * qual era e se ela foi inativada depois.
 */
export interface JornadaDoVinculoApi {
  id: string;
  codigo: string | null;
  nome: string;
  ativo: boolean;
}

export interface VinculoHorarioApi {
  id: string;
  colaboradorId: string;
  empresaId: string;
  tabelaHorarioId: string;
  /** T183 — a jornada vinculada. */
  tabela: JornadaDoVinculoApi;
  /** Primeiro dia da vigência (`YYYY-MM-DD`). */
  vigenciaInicio: string;
  /** Primeiro dia SEM a jornada (`YYYY-MM-DD`; o fim não conta), ou `null`. */
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

/**
 * T183 — atribui ou TROCA a jornada do colaborador numa operação só: com
 * jornada vigente, o servidor a encerra em `vigenciaInicio` e cria a nova.
 */
export interface AtribuirJornadaDto {
  colaboradorId: string;
  tabelaHorarioId: string;
  vigenciaInicio: string;
}

/**
 * `vigenciaFim` é obrigatório no encerramento — não existe encerramento
 * "imediato". É o primeiro dia SEM a jornada.
 */
export interface EncerrarVinculoHorarioDto {
  vigenciaFim: string;
}

export interface ListarVinculosHorarioQuery {
  colaboradorId?: string;
  tabelaHorarioId?: string;
  pagina?: number;
  tamanhoPagina?: number;
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
  // T183 — 403 `csrf_invalido`: o token desta aba ficou desatualizado;
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
    // T183 — o corpo segue junto: as recusas por campo trazem `erros`.
    throw new ApiError(res.status, msg, body);
  }
  return res.json() as Promise<T>;
}

/** T183 — gravação: token renovado pela regra comum (rede caída não envia). */
async function gravar<T>(path: string, corpo: unknown): Promise<T> {
  const token = await tokenCsrfParaGravacao();
  const res = await apiFetch(path, {
    method: "POST",
    headers: { "x-csrf-token": token },
    body: JSON.stringify(corpo),
  });
  return jsonOrThrow(res);
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
  return gravar("/horarios/vinculos", dto);
}

/** T183 — atribui ou troca a jornada vigente do colaborador. */
export async function atribuirJornada(
  dto: AtribuirJornadaDto,
): Promise<VinculoHorarioApi> {
  return gravar("/horarios/vinculos/atribuicoes", dto);
}

export async function encerrarVinculoHorario(
  id: string,
  dto: EncerrarVinculoHorarioDto,
): Promise<VinculoHorarioApi> {
  return gravar(`/horarios/vinculos/${id}/encerrar`, dto);
}
