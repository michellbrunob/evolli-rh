/**
 * Contexto empresarial ativo (T163) — cliente.
 *
 * Duas rotas, e nenhuma invenção:
 *
 * - `GET /v1/auth/contexto/empresas` devolve **só** as empresas que o servidor
 *   autoriza para esta conta, e responde **403** a papel sem poder de seleção.
 *   O frontend não decide quem seleciona; ele reage ao que o servidor diz.
 * - `POST /v1/auth/contexto/empresa` troca a empresa ativa **da sessão**.
 *
 * Nada aqui usa `localStorage`, `sessionStorage`, query string ou cookie
 * escrito por script para guardar a empresa. A empresa ativa vive em
 * `access_session` e chega pelo `GET /v1/users/me` como `companyId`. É por
 * isso que não existe neste arquivo nenhuma função do tipo "definir empresa
 * localmente": ela não poderia existir sem transformar o navegador em
 * autoridade, que é exatamente o que a regra de negócio proíbe.
 *
 * O arquivo é autocontido — mesmo padrão dos dez outros clientes de `src/api`,
 * cada um com seu `apiFetch` local.
 */
import {
  clearCsrfToken,
  descartarTokenSeDesatualizado,
  getCsrfToken,
  refreshCsrfToken,
} from "./csrfClient";

const BASE = "/v1";

export class ContextoApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ContextoApiError";
  }
}

export interface EmpresaDoContextoApi {
  id: string;
  codigo: string;
  nome: string;
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
    throw new ContextoApiError(
      res.status,
      body.message ?? "Erro na requisição.",
    );
  }
  return res.json() as Promise<T>;
}

/**
 * As empresas que o ator pode escolher.
 *
 * **403 é resposta esperada**, não falha: significa "este perfil não
 * seleciona empresa". Quem chama trata isso como ausência de seletor, e não
 * como erro na tela — a distinção importa porque, sem ela, um gestor veria
 * uma mensagem de erro por simplesmente ser gestor.
 */
export async function listarEmpresasDoContexto(): Promise<
  EmpresaDoContextoApi[]
> {
  const res = await apiFetch("/auth/contexto/empresas");
  const pagina = await jsonOrThrow<{ itens: EmpresaDoContextoApi[] }>(res);
  return pagina.itens;
}

/**
 * Troca a empresa ativa da sessão.
 *
 * Empresa inexistente, não autorizada ou revogada respondem **404**, todas
 * iguais: o servidor não confirma a existência de empresa fora do escopo.
 */
export async function trocarEmpresaDoContexto(
  empresaId: string,
): Promise<EmpresaDoContextoApi> {
  const enviar = async () =>
    apiFetch("/auth/contexto/empresa", {
      method: "POST",
      headers: { "x-csrf-token": await getCsrf() },
      body: JSON.stringify({ empresaId }),
    });
  let res = await enviar();
  // T189 — 403 `csrf_invalido`: a sessão vale, mas outra aba renovou o token
  // desta sessão — justamente o cenário de várias abas que a troca de empresa
  // envolve. A troca é idempotente (trocar duas vezes para a mesma empresa dá
  // no mesmo), então descartar o token, renovar e repetir UMA vez é seguro.
  await descartarTokenSeDesatualizado(res);
  if (res.status === 403 && getCsrfToken() === null) {
    res = await enviar();
  }
  const corpo = await jsonOrThrow<{ empresaAtiva: EmpresaDoContextoApi }>(res);
  return corpo.empresaAtiva;
}
