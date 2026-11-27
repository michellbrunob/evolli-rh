/**
 * T215 — Políticas de férias (como a referência): o contrato de
 * `/v1/politicas-ferias`. Escritas com CSRF; nada se apaga (desativar).
 */
import { ApiError } from "./colaboradoresClient";
import {
  clearCsrfToken,
  descartarTokenSeDesatualizado,
  getCsrfToken,
  refreshCsrfToken,
} from "./csrfClient";

const BASE = "/v1/politicas-ferias";

export type TipoDeContratoDaPolitica =
  | "clt"
  | "estagio"
  | "aprendiz"
  | "pj"
  | "temporario"
  | "outro_controlado"
  | "part_time"
  | "freelancer"
  | "trainee";

export interface BloqueioDaPoliticaApi {
  nome: string;
  inicio: string;
  fim: string;
  todoAno: boolean;
}

export interface RegrasDaPoliticaApi {
  antecedenciaMinimaDias: number | null;
  antecedenciaMaximaMeses: number | null;
  alemDoSaldo: "nao_aceitar" | "aceitar";
  duracaoMinimaDias: number | null;
  duracaoMaximaDias: number | null;
  periodosPorAno: number | null;
  periodoMaiorDias: number | null;
  intervaloDias: number | null;
  inicioNaoAntesDeDescanso: boolean;
  inicioNaoNoFimDeSemana: boolean;
  voltaNaoNaSexta: boolean;
  voltaNaoNaVespera: boolean;
  bloqueios: BloqueioDaPoliticaApi[];
  foraAoMesmoTempo: number | null;
}

export interface AprovacaoDaPoliticaApi {
  quem: "rh" | "gestor_rh" | "gestor";
  lembreteDias: number | null;
  foraDaPolitica: "avisar" | "bloquear";
}

export interface AlvoDaPoliticaApi {
  tipo: "departamento" | "unidade" | "pessoa";
  id: string;
}

export interface PoliticaFeriasDto {
  nome: string;
  descricao?: string;
  textoColaborador?: string;
  tiposVinculo: TipoDeContratoDaPolitica[];
  abrangencia: "todos" | "algumas";
  alvos: AlvoDaPoliticaApi[];
  valeAPartirDe: string;
  regras: RegrasDaPoliticaApi;
  aprovacao: AprovacaoDaPoliticaApi;
  rascunho?: boolean;
}

export interface PoliticaFeriasApi extends Omit<
  PoliticaFeriasDto,
  "alvos" | "descricao" | "textoColaborador"
> {
  id: string;
  descricao: string | null;
  textoColaborador: string | null;
  alvos: (AlvoDaPoliticaApi & { nome: string })[];
  rascunho: boolean;
  ativa: boolean;
}

export interface LinhaDePoliticaApi {
  id: string;
  nome: string;
  ativa: boolean;
  rascunho: boolean;
  tiposVinculo: TipoDeContratoDaPolitica[];
  abrangencia: "todos" | "algumas";
  pessoas: number;
  principaisRegras: { primeira: string; segunda: string | null; mais: number };
  foraDaPolitica: "avisar" | "bloquear";
}

export interface ListaDePoliticasApi {
  politicas: LinhaDePoliticaApi[];
  semPolitica: {
    total: number;
    pessoas: { id: string; nome: string; contrato: TipoDeContratoDaPolitica }[];
  };
}

async function pedir<T>(
  caminho: string,
  metodo: "GET" | "POST" | "PUT",
  corpo?: unknown,
): Promise<T> {
  const escrita = metodo !== "GET";
  const res = await fetch(`${BASE}${caminho}`, {
    method: metodo,
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      ...(corpo !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(escrita
        ? { "x-csrf-token": getCsrfToken() ?? (await refreshCsrfToken()) }
        : {}),
    },
    ...(corpo !== undefined ? { body: JSON.stringify(corpo) } : {}),
  });
  if (res.status === 401) clearCsrfToken();
  if (escrita) await descartarTokenSeDesatualizado(res);
  if (!res.ok) {
    const erro: unknown = await res.json().catch(() => ({}));
    throw new ApiError(res.status, "Erro na requisição.", erro);
  }
  return res.json() as Promise<T>;
}

export const listarPoliticasFerias = () =>
  pedir<ListaDePoliticasApi>("", "GET");
export const obterPoliticaFerias = (id: string) =>
  pedir<PoliticaFeriasApi>(`/${encodeURIComponent(id)}`, "GET");
export const criarPoliticaFerias = (dto: PoliticaFeriasDto) =>
  pedir<PoliticaFeriasApi>("", "POST", dto);
export const alterarPoliticaFerias = (id: string, dto: PoliticaFeriasDto) =>
  pedir<PoliticaFeriasApi>(`/${encodeURIComponent(id)}`, "PUT", dto);
export const desativarPoliticaFerias = (id: string) =>
  pedir<PoliticaFeriasApi>(`/${encodeURIComponent(id)}/desativar`, "POST");
export const reativarPoliticaFerias = (id: string) =>
  pedir<PoliticaFeriasApi>(`/${encodeURIComponent(id)}/reativar`, "POST");
