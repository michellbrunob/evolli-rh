import { clearCsrfToken } from "./csrfClient";

/**
 * Leitura contratual do vínculo (T134) — expõe o endpoint real de **alocações
 * organizacionais** do vínculo, ainda não coberto pelos demais clientes:
 *
 * - `GET /v1/vinculos/:vinculoId/alocacoes` — histórico completo de alocações
 *   (cargo + lotação por vigência); nenhuma linha é omitida.
 *
 * Somente leitura. Sem CSRF (não há mutação). `credentials: "same-origin"`. O
 * escopo/RBAC e o 404 anti-enumeração são decididos pelo backend — este cliente
 * nunca envia `empresaId` nem interpreta autorização. A alocação **vigente** é a
 * que tem `vigenteAte === null` (campo do backend, não recálculo).
 *
 * As demais leituras contratuais já têm cliente próprio e são reaproveitadas:
 * `colaboradoresClient` (colaboradores/vínculos), `movimentacaoClient`
 * (linha do tempo), `vinculoHorarioClient` (horário), `cargoClient` e
 * `organizacaoClient` (catálogos para resolver nomes).
 */

const BASE = "/v1";

export interface AlocacaoOrganizacionalApi {
  id: string;
  vinculoId: string;
  empresaId: string;
  unidadeOrganizacionalId: string | null;
  departamentoId: string | null;
  areaId: string | null;
  equipeId: string | null;
  cargoId: string | null;
  centroCustoId: string | null;
  vigenteDe: string;
  vigenteAte: string | null;
  movimentacaoOrigemId: string;
  criadoEm: string;
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

async function apiFetch(path: string): Promise<Response> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });
  if (res.status === 401) {
    clearCsrfToken();
  }
  return res;
}

async function jsonOrThrow<T>(res: Response, fallback: string): Promise<T> {
  if (!res.ok) {
    // Nunca repassa o corpo do servidor — só o status; a tela decide a mensagem.
    throw new ApiError(res.status, fallback);
  }
  return res.json() as Promise<T>;
}

/** Alocações organizacionais do vínculo (histórico + vigente por `vigenteAte`). */
export async function listarAlocacoesVinculo(
  vinculoId: string,
): Promise<AlocacaoOrganizacionalApi[]> {
  const res = await apiFetch(
    `/vinculos/${encodeURIComponent(vinculoId)}/alocacoes`,
  );
  return jsonOrThrow(res, "Não foi possível carregar as alocações do vínculo.");
}
