import { clearCsrfToken, getCsrfToken, refreshCsrfToken } from "./csrfClient";
import type { EnderecoApi, PerfilPessoalApi } from "./dadosPessoaisClient";

const BASE = "/v1";

export type TipoVinculo =
  "clt" | "estagio" | "pj" | "temporario" | "outro_controlado";

export type SituacaoColaborador = "ativo" | "inativo";

export type SituacaoVinculo = "previsto" | "ativo" | "encerrado";

export interface ColaboradorApi {
  id: string;
  nome: string;
  situacao: SituacaoColaborador;
  criadoEm: string;
  atualizadoEm: string;
}

export interface VinculoApi {
  id: string;
  colaboradorId: string;
  empresaId: string;
  matricula: string;
  tipo: TipoVinculo;
  situacao: SituacaoVinculo;
  dataAdmissao: string;
  dataDesligamento: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

export interface ResultadoPaginado<T> {
  itens: T[];
  pagina: number;
  tamanhoPagina: number;
  total: number;
}

export interface ListarColaboradoresQuery {
  situacao?: SituacaoColaborador;
  situacaoVinculo?: SituacaoVinculo;
  pagina?: number;
  tamanhoPagina?: number;
}

/**
 * Destino organizacional da admissão: ao menos uma referência é exigida pela
 * API, e `areaId` só é aceito acompanhado de `departamentoId` — a mesma regra
 * de `assertDestinoCoerente` no backend. O cliente não escolhe por conta
 * própria: só envia o que o formulário selecionou.
 */
export interface DestinoOrganizacionalDto {
  unidadeOrganizacionalId?: string;
  departamentoId?: string;
  areaId?: string;
  equipeId?: string;
  cargoId?: string;
  centroCustoId?: string;
}

/**
 * Admissão: cria colaborador + primeiro vínculo, em uma única chamada. Espelha
 * `AdmitirColaboradorDto` do backend — `empresaId` é a empresa do próprio ator
 * (obtida via `/v1/empresas`, nunca inventada no cliente) e é conferida contra
 * a sessão no servidor; divergência responde 404, nunca 403.
 */
export interface AdmitirColaboradorDto extends DestinoOrganizacionalDto {
  nome: string;
  empresaId: string;
  matricula: string;
  tipo: TipoVinculo;
  dataAdmissao: string;
  motivoCodigo: "admissao_inicial";
  /**
   * T177 — Módulo 1, gravado na MESMA transação da admissão. Vazio vai como
   * `null`.
   *
   * OBRIGATÓRIOS: `perfilPessoal` com `dataNascimento`, e `contatos` (os três
   * da ficha da T169, juntos). OPCIONAIS: os demais campos do perfil e o
   * `endereco` inteiro.
   */
  perfilPessoal: Record<
    Exclude<keyof PerfilPessoalApi, "atualizadoEm" | "dataNascimento">,
    string | null
  > & { dataNascimento: string };
  endereco?: Record<Exclude<keyof EnderecoApi, "atualizadoEm">, string | null>;
  contatos: { emailPessoal: string; celular: string; telefone: string };
}

/**
 * Resposta da admissão (T167): o colaborador no topo, como antes, mais a
 * confirmação do vínculo e do ato de admissão criados na mesma transação.
 * Projeção fechada no servidor — nenhum dado pessoal além dos aprovados.
 */
export interface AdmissaoRegistradaApi extends ColaboradorApi {
  vinculo: {
    id: string;
    empresaId: string;
    matricula: string;
    tipo: TipoVinculo;
    situacao: SituacaoVinculo;
    dataAdmissao: string;
  };
  movimentacao: {
    id: string;
    tipo: "admissao";
    status: "solicitada" | "programada";
    vigenciaInicio: string;
    destino: Required<{
      [K in keyof DestinoOrganizacionalDto]: string | null;
    }>;
  };
  /**
   * T177 — o que o servidor gravou do Módulo 1. Perfil e contatos são
   * obrigatórios e sempre vêm; endereço é `null` quando nenhum campo veio.
   */
  perfilPessoal: PerfilPessoalApi;
  endereco: EnderecoApi | null;
  contatos: {
    emailPessoal: string;
    celular: string;
    telefone: string;
    atualizadoEm: string;
  };
}

export interface RetificarColaboradorDto {
  nome: string;
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

export async function listarColaboradores(
  query: ListarColaboradoresQuery = {},
): Promise<ResultadoPaginado<ColaboradorApi>> {
  const params = new URLSearchParams();
  if (query.situacao) params.set("situacao", query.situacao);
  if (query.situacaoVinculo)
    params.set("situacaoVinculo", query.situacaoVinculo);
  if (query.pagina !== undefined) params.set("pagina", String(query.pagina));
  if (query.tamanhoPagina !== undefined)
    params.set("tamanhoPagina", String(query.tamanhoPagina));
  const qs = params.toString();
  const res = await apiFetch(`/colaboradores${qs ? `?${qs}` : ""}`);
  return jsonOrThrow(res);
}

export async function buscarColaborador(id: string): Promise<ColaboradorApi> {
  const res = await apiFetch(`/colaboradores/${id}`);
  return jsonOrThrow(res);
}

export async function listarVinculosDoColaborador(
  colaboradorId: string,
): Promise<VinculoApi[]> {
  const res = await apiFetch(`/colaboradores/${colaboradorId}/vinculos`);
  return jsonOrThrow(res);
}

export async function admitirColaborador(
  dto: AdmitirColaboradorDto,
): Promise<AdmissaoRegistradaApi> {
  const token = await getCsrf();
  const res = await apiFetch("/colaboradores", {
    method: "POST",
    headers: { "x-csrf-token": token },
    body: JSON.stringify(dto),
  });
  return jsonOrThrow(res);
}

export async function retificarColaborador(
  id: string,
  dto: RetificarColaboradorDto,
): Promise<ColaboradorApi> {
  const token = await getCsrf();
  const res = await apiFetch(`/colaboradores/${id}`, {
    method: "PATCH",
    headers: { "x-csrf-token": token },
    body: JSON.stringify(dto),
  });
  return jsonOrThrow(res);
}
