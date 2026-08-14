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

async function readRequestId(response: Response): Promise<string | undefined> {
  try {
    const body = (await response.json()) as { request_id?: string };
    return body.request_id;
  } catch {
    // Corpo ausente ou não-JSON: segue sem request_id, nunca expõe detalhe interno.
    return undefined;
  }
}
