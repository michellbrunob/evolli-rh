/**
 * T209 — empresas da conta (Configurações › Empresas) e Nova empresa.
 *
 * - `GET /v1/empresas/da-conta`: as empresas que a conta alcança, a principal
 *   primeiro, com CNPJ, cidade e colaboradores ativos.
 * - `POST /v1/empresas/cadastro`: cria a empresa com CNPJ (RH e master). O
 *   código sai do nome no servidor; quem cria pelo RH ganha acesso na hora.
 *
 * Autocontido, como os demais clientes de `src/api`. Nada aqui guarda dado no
 * navegador.
 */
import {
  clearCsrfToken,
  descartarTokenSeDesatualizado,
  getCsrfToken,
  refreshCsrfToken,
} from "./csrfClient";

const BASE = "/v1";

/** Faixas de pessoas no CNPJ, como o servidor as aceita. */
export type PorteDeEmpresa =
  "1_10" | "11_50" | "51_200" | "201_500" | "501_1000" | "mais_de_1000";

export interface EnderecoDaEmpresaApi {
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
}

export interface CadastrarEmpresaDto {
  cnpj: string;
  nome: string;
  porte?: PorteDeEmpresa;
  endereco?: EnderecoDaEmpresaApi;
}

export interface EmpresaCadastradaApi {
  id: string;
  codigo: string;
  nome: string;
  cnpj: string | null;
  porte: PorteDeEmpresa | null;
}

export interface EmpresaDaContaApi {
  id: string;
  codigo: string;
  nome: string;
  cnpj: string | null;
  porte: PorteDeEmpresa | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  principal: boolean;
  colaboradoresAtivos: number;
}

/** Erro de campo, sem o valor (ADR 0016). */
export interface ErroDeCampoApi {
  campo: string;
  motivo: string;
}

export class EmpresasApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly erros: readonly ErroDeCampoApi[] = [],
  ) {
    super(message);
    this.name = "EmpresasApiError";
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
  if (res.status === 401) clearCsrfToken();
  return res;
}

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as {
      message?: string;
      erros?: unknown;
    };
    const erros = Array.isArray(body.erros)
      ? body.erros.filter(
          (e): e is ErroDeCampoApi =>
            typeof e === "object" &&
            e !== null &&
            typeof (e as ErroDeCampoApi).campo === "string" &&
            typeof (e as ErroDeCampoApi).motivo === "string",
        )
      : [];
    throw new EmpresasApiError(
      res.status,
      body.message ?? "Erro na requisição.",
      erros,
    );
  }
  return res.json() as Promise<T>;
}

/** As empresas da conta, a principal primeiro. */
export async function listarEmpresasDaConta(): Promise<EmpresaDaContaApi[]> {
  const res = await apiFetch("/empresas/da-conta");
  return (await jsonOrThrow<{ itens: EmpresaDaContaApi[] }>(res)).itens;
}

/**
 * Cria a empresa. 422 `cnpj/invalido` e 409 `cnpj/em_uso` chegam em
 * `erros`. Um 403 `csrf_invalido` (token renovado por outra aba) é recusado
 * antes de qualquer gravação, então repetir UMA vez com token novo é seguro.
 */
export async function cadastrarEmpresa(
  dto: CadastrarEmpresaDto,
): Promise<EmpresaCadastradaApi> {
  const enviar = async () =>
    apiFetch("/empresas/cadastro", {
      method: "POST",
      headers: { "x-csrf-token": await getCsrf() },
      body: JSON.stringify(dto),
    });
  let res = await enviar();
  await descartarTokenSeDesatualizado(res);
  if (res.status === 403 && getCsrfToken() === null) res = await enviar();
  return jsonOrThrow<EmpresaCadastradaApi>(res);
}

/**
 * T209 — edita a empresa (painel lateral de Configurações › Empresas): nome,
 * CNPJ, porte e endereço, substituídos por inteiro. 404 para empresa fora da
 * conta; `cnpj` em `erros` como no cadastro.
 */
export async function atualizarEmpresa(
  empresaId: string,
  dto: CadastrarEmpresaDto,
): Promise<EmpresaCadastradaApi> {
  const enviar = async () =>
    apiFetch(`/empresas/${encodeURIComponent(empresaId)}/cadastro`, {
      method: "PATCH",
      headers: { "x-csrf-token": await getCsrf() },
      body: JSON.stringify(dto),
    });
  let res = await enviar();
  await descartarTokenSeDesatualizado(res);
  if (res.status === 403 && getCsrfToken() === null) res = await enviar();
  return jsonOrThrow<EmpresaCadastradaApi>(res);
}
