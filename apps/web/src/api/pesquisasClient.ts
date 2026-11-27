/**
 * T216 — Pesquisas: o contrato de `/v1/pesquisas` (lista, rascunho,
 * publicação, status, duplicar, excluir, resultados e respostas
 * individuais) e da aba da ficha (`/v1/colaboradores/:id/pesquisas`).
 *
 * Os tipos seguem o apêndice de `docs/decisions/t216-pesquisas.md`. Escritas
 * levam CSRF; leituras que mudam com o tempo não usam cache do navegador.
 * A página pública de resposta tem cliente próprio (fora deste arquivo).
 */
import { ApiError } from "./colaboradoresClient";
import {
  clearCsrfToken,
  descartarTokenSeDesatualizado,
  getCsrfToken,
  refreshCsrfToken,
} from "./csrfClient";

export type Identificacao = "identificada" | "confidencial" | "anonima";
export type StatusPesquisa =
  "rascunho" | "ativa" | "pausada" | "finalizada" | "cancelada";
export type ModeloPesquisa =
  | "pulso"
  | "clima"
  | "enps"
  | "onboarding"
  | "desligamento"
  | "beneficios"
  | "treinamento"
  | "personalizada";
export type TipoPergunta =
  | "texto_curto"
  | "paragrafo"
  | "escolha_unica"
  | "multipla_escolha"
  | "sim_nao"
  | "concordancia"
  | "nota_0_10"
  | "estrelas"
  | "escala"
  | "data"
  | "numero";

/** `id` gerado no navegador (até 40 caracteres). */
export interface Opcao {
  id: string;
  texto: string;
}

export interface ConfigPergunta {
  opcoes?: Opcao[];
  outro?: boolean;
  /** Escolhas: máximo de marcações; escala e número: o teto. */
  maximo?: number;
  respostaBoa?: "sim" | "nao" | null;
  enps?: boolean;
  minimo?: number;
  rotuloMinimo?: string;
  rotuloMaximo?: string;
  inteiro?: boolean;
}

export interface CondicaoPergunta {
  perguntaId: string;
  /** Para `sim_nao`, `"sim"` ou `"nao"`. */
  opcaoId: string;
}

export interface Pergunta {
  /** Gerado no navegador (uuid); estável entre gravações. */
  id: string;
  tipo: TipoPergunta;
  texto: string;
  descricao: string | null;
  obrigatoria: boolean;
  config: ConfigPergunta;
  condicao: CondicaoPergunta | null;
}

export interface Secao {
  id: string;
  titulo: string | null;
  descricao: string | null;
  perguntas: Pergunta[];
}

export type ParticipantesEntrada =
  { todos: true } | { todos: false; colaboradorIds: string[] };

/** Corpo de `POST /pesquisas` e `PUT /pesquisas/:id`. */
export interface PesquisaEntrada {
  nome: string;
  boasVindas: string | null;
  modelo: ModeloPesquisa;
  identificacao: Identificacao;
  secoes: Secao[];
  participantes: ParticipantesEntrada;
  encerraEm: string | null;
  minimoPorGrupo: number;
}

export interface PesquisaResumo {
  id: string;
  nome: string;
  modelo: ModeloPesquisa;
  identificacao: Identificacao;
  /** Já considera `encerraEm` vencido (finalizada). */
  status: StatusPesquisa;
  participantes: number;
  respostas: number;
  criadaEm: string;
  publicadaEm: string | null;
  encerraEm: string | null;
  /** Caminho público `#/p/<token>` (só depois de publicar). */
  link: string | null;
}

export interface ParticipanteDaPesquisa {
  colaboradorId: string;
  nome: string;
  departamento: string | null;
  /** `null` na anônima; na confidencial, só `true`/`false`. */
  respondeu: boolean | null;
}

export interface PesquisaDetalhe extends PesquisaResumo {
  boasVindas: string | null;
  secoes: Secao[];
  minimoPorGrupo: number;
  todos: boolean;
  participantesLista: ParticipanteDaPesquisa[];
  temRespostas: boolean;
}

export type ContagensDePesquisas = Record<"todas" | StatusPesquisa, number>;

export interface ListaDePesquisasApi {
  itens: PesquisaResumo[];
  pagina: number;
  tamanhoPagina: number;
  total: number;
  contagens: ContagensDePesquisas;
}

export interface DepartamentoDoResultado {
  id: string;
  nome: string;
  respostas: number;
  visivel: boolean;
}

interface ResultadoBase {
  perguntaId: string;
  tipo: TipoPergunta;
  respondidas: number;
  viram: number;
}

/** Escalas, estrelas, nota e número. */
export interface ResultadoNumerico extends ResultadoBase {
  media: number | null;
  distribuicao: { valor: number; quantidade: number }[];
}

/** Nota 0–10 marcada como eNPS (com média e distribuição). */
export interface ResultadoEnps extends ResultadoBase {
  enps: {
    promotores: number;
    neutros: number;
    detratores: number;
    indice: number | null;
  };
  media?: number | null;
  distribuicao?: { valor: number; quantidade: number }[];
}

export interface ResultadoEscolha extends ResultadoBase {
  opcoes: { opcaoId: string; quantidade: number }[];
  outros: string[];
}

export interface ResultadoSimNao extends ResultadoBase {
  sim: number;
  nao: number;
}

export interface ResultadoTexto extends ResultadoBase {
  /** `autor` só na identificada. */
  textos: { texto: string; autor: string | null }[];
}

export interface ResultadoData extends ResultadoBase {
  datas: { valor: string; quantidade: number }[];
}

export type ResultadoPergunta =
  | ResultadoNumerico
  | ResultadoEnps
  | ResultadoEscolha
  | ResultadoSimNao
  | ResultadoTexto
  | ResultadoData;

export interface ResultadosPesquisa {
  pesquisaId: string;
  respostas: number;
  participantes: number;
  departamentos: DepartamentoDoResultado[];
  /** `visivel: false`: abaixo do mínimo por grupo (sem números). */
  filtro: { departamentoId: string | null; visivel: boolean };
  /** Vazio quando `filtro.visivel` é `false`. */
  perguntas: ResultadoPergunta[];
}

export interface ValorRespondido {
  perguntaId: string;
  valor: unknown;
}

/** `GET /pesquisas/:id/respostas` (só identificada; auditado). */
export interface RespostaIndividual {
  colaboradorId: string;
  nome: string;
  departamento: string | null;
  respondidaEm: string;
  valores: ValorRespondido[];
}

/** `GET /colaboradores/:id/pesquisas`. */
export interface PesquisaDaFicha {
  pesquisaId: string;
  nome: string;
  modelo: ModeloPesquisa;
  respondidaEm: string;
  secoes: Secao[];
  valores: ValorRespondido[];
}

type Metodo = "GET" | "POST" | "PUT" | "DELETE";

async function pedir<T>(
  rota: string,
  metodo: Metodo,
  corpo?: unknown,
): Promise<T> {
  const escrita = metodo !== "GET";
  const res = await fetch(`/v1${rota}`, {
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
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

const id = encodeURIComponent;

export interface ListarPesquisasQuery {
  /** Ausente: todas. */
  status?: StatusPesquisa;
  pagina?: number;
  tamanhoPagina?: number;
}

export function listarPesquisas(
  query: ListarPesquisasQuery = {},
): Promise<ListaDePesquisasApi> {
  const params = new URLSearchParams();
  if (query.status) params.set("status", query.status);
  if (query.pagina !== undefined) params.set("pagina", String(query.pagina));
  if (query.tamanhoPagina !== undefined)
    params.set("tamanhoPagina", String(query.tamanhoPagina));
  const qs = params.toString();
  return pedir(`/pesquisas${qs ? `?${qs}` : ""}`, "GET");
}

export const criarPesquisa = (entrada: PesquisaEntrada) =>
  pedir<PesquisaDetalhe>("/pesquisas", "POST", entrada);

export const obterPesquisa = (pesquisaId: string) =>
  pedir<PesquisaDetalhe>(`/pesquisas/${id(pesquisaId)}`, "GET");

export const alterarPesquisa = (pesquisaId: string, entrada: PesquisaEntrada) =>
  pedir<PesquisaDetalhe>(`/pesquisas/${id(pesquisaId)}`, "PUT", entrada);

export const publicarPesquisa = (pesquisaId: string) =>
  pedir<PesquisaDetalhe>(`/pesquisas/${id(pesquisaId)}/publicar`, "POST");

export const alterarStatusDaPesquisa = (
  pesquisaId: string,
  status: StatusPesquisa,
) =>
  pedir<PesquisaDetalhe>(`/pesquisas/${id(pesquisaId)}/status`, "POST", {
    status,
  });

export const duplicarPesquisa = (pesquisaId: string) =>
  pedir<PesquisaDetalhe>(`/pesquisas/${id(pesquisaId)}/duplicar`, "POST");

export const excluirPesquisa = (pesquisaId: string) =>
  pedir<void>(`/pesquisas/${id(pesquisaId)}`, "DELETE");

export const resultadosDaPesquisa = (
  pesquisaId: string,
  departamentoId?: string | null,
) =>
  pedir<ResultadosPesquisa>(
    `/pesquisas/${id(pesquisaId)}/resultados${departamentoId ? `?departamentoId=${id(departamentoId)}` : ""}`,
    "GET",
  );

/**
 * O contrato descreve a lista; aceita também a lista embrulhada num objeto
 * (`{ itens }`, `{ respostas }` ou `{ pesquisas }`), sem quebrar a tela.
 */
function comoLista<T>(corpo: unknown): T[] {
  if (Array.isArray(corpo)) return corpo as T[];
  if (typeof corpo === "object" && corpo !== null) {
    for (const chave of ["itens", "respostas", "pesquisas"]) {
      const valor = (corpo as Record<string, unknown>)[chave];
      if (Array.isArray(valor)) return valor as T[];
    }
  }
  return [];
}

export const respostasDaPesquisa = async (pesquisaId: string) =>
  comoLista<RespostaIndividual>(
    await pedir<unknown>(`/pesquisas/${id(pesquisaId)}/respostas`, "GET"),
  );

export const pesquisasDoColaborador = async (colaboradorId: string) =>
  comoLista<PesquisaDaFicha>(
    await pedir<unknown>(
      `/colaboradores/${id(colaboradorId)}/pesquisas`,
      "GET",
    ),
  );
