import { clearCsrfToken, getCsrfToken, refreshCsrfToken } from "./csrfClient";

const BASE = "/v1";

/**
 * Espelha `TipoMovimentacao` do backend. `admissao` pode aparecer na
 * listagem/linha do tempo (a movimentação nasce junto do vínculo — ver
 * `ColaboradoresScreen`/T111), mas **nunca** é criável por aqui: o backend
 * recusa `tipo: "admissao"` em `RegistrarMovimentacaoDto` (só os três valores
 * de `TipoMovimentacaoRegistravel`).
 */
export type TipoMovimentacaoRegistravel =
  "transferencia_organizacional" | "mudanca_cargo" | "desligamento";

export type TipoMovimentacao = TipoMovimentacaoRegistravel | "admissao";

/**
 * `aprovada`/`rejeitada` não existem: não há workflow de aprovação nesta V1
 * (Baseline V1, item 7) — RH/DP registram e efetivam diretamente.
 */
export type StatusMovimentacao =
  "solicitada" | "programada" | "efetivada" | "cancelada" | "retificada";

/** Catálogo controlado — nunca texto livre (Baseline V1, item 11). */
export type MotivoMovimentacao =
  | "admissao_inicial"
  | "reestruturacao_organizacional"
  | "realocacao_interna"
  | "promocao"
  | "correcao_cadastral"
  | "encerramento_de_vinculo"
  | "outro_controlado";

export interface MovimentacaoApi {
  id: string;
  vinculoId: string;
  empresaId: string;
  tipo: TipoMovimentacao;
  status: StatusMovimentacao;
  motivoCodigo: MotivoMovimentacao;
  registradaEm: string;
  solicitanteUserId: string;
  vigenciaInicio: string;
  efetivadaEm: string | null;
  executorUserId: string | null;
  /** Aponta para a movimentação original quando ESTA é uma correção. */
  retificaId: string | null;
  destinoUnidadeOrganizacionalId: string | null;
  destinoDepartamentoId: string | null;
  destinoAreaId: string | null;
  destinoEquipeId: string | null;
  destinoCargoId: string | null;
  destinoCentroCustoId: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

/**
 * Destino organizacional. Todos opcionais no tipo — a exigência de "ao menos
 * uma referência" (exceto para `desligamento`, que não aceita nenhuma) é do
 * backend (`assertDestinoCoerente`); o cliente só envia o que o formulário
 * selecionou.
 */
export interface DestinoOrganizacionalDto {
  unidadeOrganizacionalId?: string;
  departamentoId?: string;
  areaId?: string;
  equipeId?: string;
  cargoId?: string;
  centroCustoId?: string;
}

/** Movimentação sobre vínculo existente. Admissão não passa por aqui. */
export interface RegistrarMovimentacaoDto extends DestinoOrganizacionalDto {
  vinculoId: string;
  tipo: TipoMovimentacaoRegistravel;
  motivoCodigo: MotivoMovimentacao;
  vigenciaInicio: string;
}

/**
 * Retificação (spec §4.10): cria movimentação nova apontando para a
 * original, que transita para `retificada` e permanece na linha do tempo.
 * `tipo` não é escolhido aqui — o backend herda o da movimentação original.
 */
export interface RetificarMovimentacaoDto extends DestinoOrganizacionalDto {
  motivoCodigo: MotivoMovimentacao;
  vigenciaInicio: string;
}

export interface ListarMovimentacoesQuery {
  vinculoId?: string;
  tipo?: TipoMovimentacao;
  status?: StatusMovimentacao;
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

export async function listarMovimentacoes(
  query: ListarMovimentacoesQuery = {},
): Promise<ResultadoPaginado<MovimentacaoApi>> {
  const params = new URLSearchParams();
  if (query.vinculoId) params.set("vinculoId", query.vinculoId);
  if (query.tipo) params.set("tipo", query.tipo);
  if (query.status) params.set("status", query.status);
  if (query.pagina !== undefined) params.set("pagina", String(query.pagina));
  if (query.tamanhoPagina !== undefined)
    params.set("tamanhoPagina", String(query.tamanhoPagina));
  const qs = params.toString();
  const res = await apiFetch(`/movimentacoes${qs ? `?${qs}` : ""}`);
  return jsonOrThrow(res);
}

/**
 * Histórico completo de um vínculo — inclusive `cancelada` e `retificada`:
 * a tentativa recusada e o registro corrigido fazem parte do histórico e
 * NUNCA são omitidos (RI-M6, RI-M2). Endpoint de leitura do domínio de
 * vínculos (`GET /vinculos/:id/linha-do-tempo`), reaproveitado como está.
 */
export async function buscarLinhaDoTempo(
  vinculoId: string,
): Promise<MovimentacaoApi[]> {
  const res = await apiFetch(`/vinculos/${vinculoId}/linha-do-tempo`);
  return jsonOrThrow(res);
}

export async function registrarMovimentacao(
  dto: RegistrarMovimentacaoDto,
): Promise<MovimentacaoApi> {
  const token = await getCsrf();
  const res = await apiFetch("/movimentacoes", {
    method: "POST",
    headers: { "x-csrf-token": token },
    body: JSON.stringify(dto),
  });
  return jsonOrThrow(res);
}

export async function cancelarMovimentacao(
  id: string,
): Promise<MovimentacaoApi> {
  const token = await getCsrf();
  const res = await apiFetch(`/movimentacoes/${id}/cancelar`, {
    method: "POST",
    headers: { "x-csrf-token": token },
  });
  return jsonOrThrow(res);
}

export async function efetivarMovimentacao(
  id: string,
): Promise<MovimentacaoApi> {
  const token = await getCsrf();
  const res = await apiFetch(`/movimentacoes/${id}/efetivar`, {
    method: "POST",
    headers: { "x-csrf-token": token },
  });
  return jsonOrThrow(res);
}

export async function retificarMovimentacao(
  id: string,
  dto: RetificarMovimentacaoDto,
): Promise<MovimentacaoApi> {
  const token = await getCsrf();
  const res = await apiFetch(`/movimentacoes/${id}/retificar`, {
    method: "POST",
    headers: { "x-csrf-token": token },
    body: JSON.stringify(dto),
  });
  return jsonOrThrow(res);
}
