/**
 * Cliente mínimo para o endpoint GET /v1/auth/csrf (ADR 0009, decisões 3 e 4).
 *
 * O token nunca é persistido em localStorage, sessionStorage, cookie legível
 * por script ou qualquer outro armazenamento do navegador — vive somente
 * nesta variável de módulo, em memória, pelo tempo de vida da aba. Chamar
 * `refreshCsrfToken` novamente substitui o token anterior (a API já o
 * invalida do lado do servidor a cada rotação).
 */

const CSRF_ENDPOINT = "/v1/auth/csrf";

export class CsrfSessionExpiredError extends Error {
  constructor() {
    super("Sessão expirada ou ausente.");
    this.name = "CsrfSessionExpiredError";
  }
}

export class CsrfRequestError extends Error {
  readonly requestId: string | undefined;

  constructor(message: string, requestId?: string) {
    super(message);
    this.name = "CsrfRequestError";
    this.requestId = requestId;
  }
}

/**
 * T179 — `codigo` que o `CsrfGuard` põe no corpo do 403 quando o token CSRF
 * falta ou não vale mais (sessão expirada). O 403 de permissão vem sem ele.
 */
export const CODIGO_CSRF_INVALIDO = "csrf_invalido";

/**
 * T179 — a gravação falhou porque a sessão expirou, e o servidor NÃO a
 * aceitou: 401 da própria chamada, `CsrfSessionExpiredError` na renovação do
 * token (o pedido nem saiu) ou 403 com `codigo: "csrf_invalido"`. Não é envio
 * incerto. `status` e `codigo` são lidos por forma: valem com o `ApiError` de
 * qualquer cliente e com os automockados dos testes.
 */
export function falhaPorSessaoExpirada(erro: unknown): boolean {
  if (erro instanceof CsrfSessionExpiredError) return true;
  if (typeof erro !== "object" || erro === null) return false;
  const { status, codigo } = erro as { status?: unknown; codigo?: unknown };
  return status === 401 || (status === 403 && codigo === CODIGO_CSRF_INVALIDO);
}

/**
 * T179 — a gravação nem saiu: a renovação do token CSRF falhou por rede ou
 * 5xx (`CsrfRequestError`), antes do pedido de gravação. Não é envio incerto.
 */
export function falhaAoPrepararEnvio(erro: unknown): boolean {
  return erro instanceof CsrfRequestError;
}

let csrfTokenInMemory: string | null = null;

/** Token CSRF corrente, se algum já foi obtido nesta aba. Nunca lido de storage. */
export function getCsrfToken(): string | null {
  return csrfTokenInMemory;
}

/** Descarta o token em memória (ex.: logout, 401 recebido em outra chamada). */
export function clearCsrfToken(): void {
  csrfTokenInMemory = null;
}

/**
 * Guarda em memória um token CSRF já obtido por outra chamada — usado após
 * login bem-sucedido, cuja própria resposta de `POST /v1/auth/login` já traz
 * o token da sessão nova. Evita um round-trip extra a `GET /v1/auth/csrf`,
 * que rotacionaria (e invalidaria) esse token à toa. Mesma garantia das
 * demais funções deste módulo: nunca grava em localStorage, sessionStorage
 * ou qualquer armazenamento do navegador.
 */
export function setCsrfToken(token: string): void {
  csrfTokenInMemory = token;
}

/**
 * Busca um token CSRF novo para a sessão corrente e o guarda em memória.
 * Nunca grava em localStorage/sessionStorage/cookie; a resposta é lida sem
 * permitir cache do navegador (`cache: "no-store"`), reforçando o
 * `Cache-Control: no-store` que a API já envia.
 */
export async function refreshCsrfToken(
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const response = await fetchImpl(CSRF_ENDPOINT, {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store",
    headers: { Accept: "application/json" },
  });

  if (response.status === 401) {
    clearCsrfToken();
    throw new CsrfSessionExpiredError();
  }

  if (!response.ok) {
    throw new CsrfRequestError(
      "Não foi possível obter o token CSRF.",
      await readRequestId(response),
    );
  }

  const body = (await response.json()) as { csrfToken?: string };
  if (!body.csrfToken) {
    throw new CsrfRequestError("Resposta do servidor não contém token CSRF.");
  }

  csrfTokenInMemory = body.csrfToken;
  return csrfTokenInMemory;
}

/**
 * T179 — o token para uma GRAVAÇÃO: o da memória ou um novo. A falha de rede
 * na renovação vira `CsrfRequestError`, como o 5xx: o pedido de gravação nem
 * saiu, e quem chama não pode confundi-la com a rede caindo no meio da
 * gravação (envio incerto). O 401 segue como `CsrfSessionExpiredError`.
 */
export async function tokenCsrfParaGravacao(
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const atual = getCsrfToken();
  if (atual) return atual;
  try {
    return await refreshCsrfToken(fetchImpl);
  } catch (erro) {
    if (
      erro instanceof CsrfSessionExpiredError ||
      erro instanceof CsrfRequestError
    ) {
      throw erro;
    }
    throw new CsrfRequestError("Não foi possível obter o token CSRF.");
  }
}

async function readRequestId(response: Response): Promise<string | undefined> {
  try {
    const body = (await response.json()) as { request_id?: string };
    return body.request_id;
  } catch {
    // Corpo ausente ou não-JSON: segue sem request_id, nunca expõe detalhe interno.
    return undefined;
  }
}
