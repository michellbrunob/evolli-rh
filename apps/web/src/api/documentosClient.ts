import { clearCsrfToken, getCsrfToken, refreshCsrfToken } from "./csrfClient";

/**
 * Cliente do módulo de Documentos (T133) — consome EXCLUSIVAMENTE os contratos
 * reais já existentes de `apps/api/src/documentos/`:
 *
 * - `GET  /v1/tipos-documento`                       — catálogo (leitura).
 * - `GET  /v1/documentos`                            — metadados (leitura).
 * - `GET  /v1/documentos/:documentoId`               — detalhe do metadado.
 * - `POST /v1/documentos`                            — registra metadado (sem conteúdo).
 * - `POST /v1/documentos/:documentoId/substituicoes` — substitui (corrige o tipo).
 * - `GET  /v1/solicitacoes-documento`                — solicitações (leitura).
 * - `GET  /v1/solicitacoes-documento/:solicitacaoId` — detalhe da solicitação.
 * - `POST /v1/solicitacoes-documento`                — solicita (pedido, sem conteúdo).
 *
 * NÃO há upload, download, conteúdo, link, storage, DELETE ou transição de
 * estado além do que o backend implementa: metadado só transita para
 * `substituido` via substituição; solicitação permanece `pendente`. O escopo e
 * o RBAC vivem no backend — o `empresaId` enviado é sempre reconferido contra a
 * sessão (divergência → 404 anti-enumeração), nunca é fonte de autorização.
 */

const BASE = "/v1";

export type EstadoDocumento = "upload_desabilitado" | "substituido";
export type EstadoSolicitacao = "pendente";
export type ClassificacaoDocumento = "restrito" | string;

/** Espelha o catálogo de tipos (rótulo + código técnico; sem dado pessoal). */
export interface TipoDocumentoApi {
  id: string;
  empresaId: string;
  codigo: string;
  nome: string;
  classificacao: ClassificacaoDocumento;
  criadoEm: string;
  atualizadoEm: string;
}

/**
 * Metadado do documento — **sem conteúdo** (ADR 0011). Só identificadores
 * técnicos, estado e datas; nunca byte, caminho, URL ou endereço de storage.
 */
export interface DocumentoMetadadoApi {
  id: string;
  empresaId: string;
  colaboradorId: string;
  tipoDocumentoId: string;
  estado: EstadoDocumento;
  substituiDocumentoId: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

/** Solicitação (pedido) — permanece `pendente` na V1. */
export interface SolicitacaoDocumentoApi {
  id: string;
  empresaId: string;
  colaboradorId: string;
  tipoDocumentoId: string;
  estado: EstadoSolicitacao;
  solicitanteUserId: string;
  solicitadaEm: string;
  criadoEm: string;
  atualizadoEm: string;
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
      Accept: "application/json",
      ...(init.headers as Record<string, string>),
    },
  });
  if (res.status === 401) {
    clearCsrfToken();
  }
  return res;
}

/**
 * Nunca repassa o corpo de erro do servidor — só o status. A tela decide a
 * mensagem (genérica, sem expor estado interno; 404 anti-enumeração e 409 de
 * conflito são traduzidos por quem chama).
 */
async function jsonOrThrow<T>(res: Response, fallback: string): Promise<T> {
  if (!res.ok) {
    throw new ApiError(res.status, fallback);
  }
  return res.json() as Promise<T>;
}

function montarQuery(
  params: Record<string, string | number | undefined>,
): string {
  const usp = new URLSearchParams();
  for (const [chave, valor] of Object.entries(params)) {
    if (valor !== undefined && valor !== "") usp.set(chave, String(valor));
  }
  const qs = usp.toString();
  return qs ? `?${qs}` : "";
}

// --------------------------------------------------------------------------
// Tipos documentais (catálogo) — leitura, para popular seletores e resolver
// nomes. A criação/alteração do catálogo NÃO faz parte desta tela.
// --------------------------------------------------------------------------

export interface ListarTiposDocumentoQuery {
  pagina?: number;
  tamanhoPagina?: number;
}

export async function listarTiposDocumento(
  query: ListarTiposDocumentoQuery = {},
): Promise<ResultadoPaginado<TipoDocumentoApi>> {
  const res = await apiFetch(
    `/tipos-documento${montarQuery({
      pagina: query.pagina,
      tamanhoPagina: query.tamanhoPagina,
    })}`,
  );
  return jsonOrThrow(res, "Não foi possível carregar os tipos de documento.");
}

// --------------------------------------------------------------------------
// Metadados de documento.
// --------------------------------------------------------------------------

export interface ListarDocumentosQuery {
  colaboradorId?: string;
  tipoDocumentoId?: string;
  estado?: EstadoDocumento;
  pagina?: number;
  tamanhoPagina?: number;
}

export async function listarDocumentos(
  query: ListarDocumentosQuery = {},
): Promise<ResultadoPaginado<DocumentoMetadadoApi>> {
  const res = await apiFetch(
    `/documentos${montarQuery({
      colaboradorId: query.colaboradorId,
      tipoDocumentoId: query.tipoDocumentoId,
      estado: query.estado,
      pagina: query.pagina,
      tamanhoPagina: query.tamanhoPagina,
    })}`,
  );
  return jsonOrThrow(res, "Não foi possível carregar os documentos.");
}

export async function detalharDocumento(
  documentoId: string,
): Promise<DocumentoMetadadoApi> {
  const res = await apiFetch(`/documentos/${encodeURIComponent(documentoId)}`);
  return jsonOrThrow(res, "Não foi possível carregar o documento.");
}

export interface CriarDocumentoDto {
  empresaId: string;
  colaboradorId: string;
  tipoDocumentoId: string;
}

export async function criarDocumento(
  dto: CriarDocumentoDto,
): Promise<DocumentoMetadadoApi> {
  const token = await getCsrf();
  const res = await apiFetch("/documentos", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-csrf-token": token },
    body: JSON.stringify(dto),
  });
  return jsonOrThrow(res, "Não foi possível registrar o documento.");
}

export async function substituirDocumento(
  documentoId: string,
  tipoDocumentoId: string,
): Promise<DocumentoMetadadoApi> {
  const token = await getCsrf();
  const res = await apiFetch(
    `/documentos/${encodeURIComponent(documentoId)}/substituicoes`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-csrf-token": token },
      body: JSON.stringify({ tipoDocumentoId }),
    },
  );
  return jsonOrThrow(res, "Não foi possível substituir o documento.");
}

// --------------------------------------------------------------------------
// Solicitações de documento (pedido; sem conteúdo).
// --------------------------------------------------------------------------

export interface ListarSolicitacoesQuery {
  colaboradorId?: string;
  tipoDocumentoId?: string;
  pagina?: number;
  tamanhoPagina?: number;
}

export async function listarSolicitacoesDocumento(
  query: ListarSolicitacoesQuery = {},
): Promise<ResultadoPaginado<SolicitacaoDocumentoApi>> {
  const res = await apiFetch(
    `/solicitacoes-documento${montarQuery({
      colaboradorId: query.colaboradorId,
      tipoDocumentoId: query.tipoDocumentoId,
      pagina: query.pagina,
      tamanhoPagina: query.tamanhoPagina,
    })}`,
  );
  return jsonOrThrow(res, "Não foi possível carregar as solicitações.");
}

export async function detalharSolicitacaoDocumento(
  solicitacaoId: string,
): Promise<SolicitacaoDocumentoApi> {
  const res = await apiFetch(
    `/solicitacoes-documento/${encodeURIComponent(solicitacaoId)}`,
  );
  return jsonOrThrow(res, "Não foi possível carregar a solicitação.");
}

export interface CriarSolicitacaoDto {
  empresaId: string;
  colaboradorId: string;
  tipoDocumentoId: string;
}

export async function criarSolicitacaoDocumento(
  dto: CriarSolicitacaoDto,
): Promise<SolicitacaoDocumentoApi> {
  const token = await getCsrf();
  const res = await apiFetch("/solicitacoes-documento", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-csrf-token": token },
    body: JSON.stringify(dto),
  });
  return jsonOrThrow(res, "Não foi possível registrar a solicitação.");
}

export const ROTULO_ESTADO_DOCUMENTO: Record<EstadoDocumento, string> = {
  upload_desabilitado: "Registrado (sem conteúdo)",
  substituido: "Substituído",
};

export const ROTULO_ESTADO_SOLICITACAO: Record<EstadoSolicitacao, string> = {
  pendente: "Pendente",
};
