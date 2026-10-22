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
 * desta página falta ou não vale mais. O 403 de permissão vem sem ele.
 *
 * A sessão vencida responde 401 ANTES do CSRF (o guard de sessão roda
 * primeiro): o 403 `csrf_invalido` vem com a sessão VÁLIDA e o token desta
 * aba desatualizado — por exemplo, porque outra aba renovou o token da mesma
 * sessão. Não é sessão expirada.
 */
export const CODIGO_CSRF_INVALIDO = "csrf_invalido";

/** `status` e `codigo` lidos por forma (`ApiError` de qualquer cliente). */
function statusECodigo(erro: unknown): { status?: unknown; codigo?: unknown } {
  return typeof erro === "object" && erro !== null
    ? (erro as { status?: unknown; codigo?: unknown })
    : {};
}

/**
 * T179 — a gravação falhou porque a sessão expirou, e o servidor NÃO a
 * aceitou: 401 da própria chamada ou `CsrfSessionExpiredError` na renovação
 * do token (o pedido nem saiu). Não é envio incerto.
 */
export function falhaPorSessaoExpirada(erro: unknown): boolean {
  if (erro instanceof CsrfSessionExpiredError) return true;
  return statusECodigo(erro).status === 401;
}

/**
 * T179 (revisão definitiva) — 403 `csrf_invalido`: a sessão vale, mas o token
 * desta página ficou desatualizado. O cliente já descartou o token local (ver
 * `descartarTokenSeDesatualizado`); a próxima gravação renova o token e pode
 * reenviar o MESMO pedido. Não é sessão expirada nem envio incerto.
 */
export function falhaPorTokenDesatualizado(erro: unknown): boolean {
  const { status, codigo } = statusECodigo(erro);
  return status === 403 && codigo === CODIGO_CSRF_INVALIDO;
}

/**
 * T179 (revisão definitiva) — chamado pelos clientes com a resposta de uma
 * gravação: num 403 `csrf_invalido`, descarta SÓ o token CSRF em memória,
 * para a próxima gravação pedir um novo. Lê uma cópia do corpo; a resposta
 * original segue intacta para quem chama.
 */
export async function descartarTokenSeDesatualizado(
  res: Response,
): Promise<void> {
  if (res.status !== 403) return;
  const corpo = (await res
    .clone()
    .json()
    .catch(() => null)) as { codigo?: unknown } | null;
  if (corpo?.codigo === CODIGO_CSRF_INVALIDO) clearCsrfToken();
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
