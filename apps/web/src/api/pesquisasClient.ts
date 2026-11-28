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

import type {
  GrupoDoEnps,
  ResultadoDoModelo,
  ResultadoIndividualDoModelo,
  ResumoDaRespostaDoModelo,
} from "./resultadosDosModelos";

export type * from "./resultadosDosModelos";

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
  | "personalizada"
  | "pulso_clima"
  | "tad"
  | "copsoq"
  | "isfb"
  | "avaliacao90"
  | "avaliacao180"
  | "disc";
/** Campos que a anônima pode pedir para separar as respostas. */
export type CampoGrupo = "departamento" | "centroCusto" | "unidade";

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
  | "numero"
  | "concordancia_4"
  | "satisfacao_4"
  /** Perfil comportamental (DISC): bloco de 4 frases, uma por fator. */
  | "escolha_forcada";

/** O fator DISC de uma frase (só nos blocos de escolha forçada). */
export type FatorDisc = "D" | "I" | "S" | "C";

/** `id` gerado no navegador (até 40 caracteres). */
export interface Opcao {
  id: string;
  texto: string;
  fator?: FatorDisc;
}

export interface ConfigPergunta {
  opcoes?: Opcao[];
  outro?: boolean;
  /** Escolhas: máximo de marcações; escala e número: o teto. */
  maximo?: number | null;
  respostaBoa?: "sim" | "nao" | null;
  enps?: boolean;
  /** Nota 0–10 de recomendação da liderança direta (LNPS). */
  lnps?: boolean;
  minimo?: number | null;
  rotuloMinimo?: string | null;
  rotuloMaximo?: string | null;
  /** Escala: o rótulo de cada ponto, do mínimo ao máximo. */
  rotulos?: string[] | null;
  inteiro?: boolean;
  /** Escala com `rotulos`: mostra só os rótulos, em lista (sem os números). */
  somenteRotulos?: boolean;
  /** Escala com `rotulos`: os pontos aparecem do maior para o menor. */
  decrescente?: boolean;
}

export interface CondicaoPergunta {
  perguntaId: string;
  /** Para `sim_nao`, `"sim"` ou `"nao"`. */
  opcaoId: string;
}

export interface Pergunta {
  /** Gerado no navegador (uuid); estável entre gravações. */
  id: string;
  /** O item do modelo (dimensão, pilar, regra de pontuação). */
  chave?: string | null;
  tipo: TipoPergunta;
  texto: string;
  descricao: string | null;
  obrigatoria: boolean;
  config: ConfigPergunta;
  condicao: CondicaoPergunta | null;
  /** Rótulo curto (até 40) para as tabelas de análise. */
  rotulo?: string | null;
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
  /** Só na anônima: até 2 campos que quem responde escolhe antes. */
  separarPor?: CampoGrupo[];
}

export interface PesquisaResumo {
  id: string;
  nome: string;
  modelo: ModeloPesquisa;
  identificacao: Identificacao;
  /** Já considera `encerraEm` vencido (finalizada). */
  status: StatusPesquisa;
  /** `null` na anônima (quem tiver o link responde). */
  participantes: number | null;
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
  /** Centro de custo e unidade da lotação vigente (API ampliada). */
  centroCusto?: string | null;
  unidade?: string | null;
  /** `null` na anônima; na confidencial, só `true`/`false`. */
  respondeu: boolean | null;
  /**
   * Tem CPF e data de nascimento na ficha (consegue confirmar quem é no
   * link); sempre `true` na anônima. Ausente em respostas antigas da API.
   */
  identificavel?: boolean;
}

export interface PesquisaDetalhe extends PesquisaResumo {
  boasVindas: string | null;
  secoes: Secao[];
  minimoPorGrupo: number;
  todos: boolean;
  participantesLista: ParticipanteDaPesquisa[];
  temRespostas: boolean;
  /**
   * Quantos participantes não conseguem se identificar no link (sem CPF ou
   * sem data de nascimento). Ausente = sem aviso.
   */
  naoIdentificaveis?: number;
  separarPor?: CampoGrupo[];
  /** Totais de quem foi convidado (API ampliada). */
  participantesTotal?: number;
  responderam?: number;
  pendentes?: number;
}

export type ContagensDePesquisas = Record<"todas" | StatusPesquisa, number>;

export interface ListaDePesquisasApi {
  itens: PesquisaResumo[];
  pagina: number;
  tamanhoPagina: number;
  total: number;
  contagens: ContagensDePesquisas;
}

/**
 * Por que um grupo não mostra números: abaixo do mínimo, ou escondido para
 * proteger um grupo menor (sem ele, daria para deduzir o menor pelo total).
 */
export type MotivoOculto = "minimo" | "protege_grupo_menor";

export interface DepartamentoDoResultado {
  id: string;
  nome: string;
  respostas: number;
  visivel: boolean;
  oculto?: MotivoOculto | null;
}

interface ResultadoBase {
  perguntaId: string;
  tipo: TipoPergunta;
  respondidas: number;
  viram: number;
}

/** Escalas, estrelas, nota e número. */
/** Quantas respostas caem em cada terço da escala. */
export interface FaixasDaEscala {
  baixa: number;
  media: number;
  alta: number;
}

export type ZonaEnps =
  "critica" | "aperfeicoamento" | "qualidade" | "excelencia";

export interface ResultadoNumerico extends ResultadoBase {
  media: number | null;
  distribuicao: { valor: number; quantidade: number }[];
  /** % de respostas favoráveis (0–100). */
  favoravel?: number | null;
  faixas?: FaixasDaEscala;
}

/** Nota 0–10 marcada como eNPS (com média e distribuição). */
export interface ResultadoEnps extends ResultadoBase {
  enps: {
    promotores: number;
    neutros: number;
    detratores: number;
    indice: number | null;
    zona?: ZonaEnps;
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
  filtro: {
    departamentoId: string | null;
    campo?: CampoGrupo | null;
    grupoId?: string | null;
    visivel: boolean;
    /** Respostas do recorte (sem filtro, o total). */
    respostas?: number;
  };
  /** Os grupos de cada recorte disponível (com o motivo do oculto). */
  grupos?: Partial<Record<CampoGrupo, DepartamentoDoResultado[]>>;
  /** Vazio quando `filtro.visivel` é `false`. */
  perguntas: ResultadoPergunta[];
  indicadores?: IndicadoresDosResultados;
  /** Recortes disponíveis (anônima: os de `separarPor`). */
  recortes?: CampoGrupo[];
  /** O resultado próprio do modelo (dimensões, pilares, níveis). */
  modelo?: ResultadoDoModelo | null;
}

export interface IndicadoresDosResultados {
  /** Média das perguntas de escala, na escala 0–10. */
  mediaGeral: number | null;
  perguntasDeEscala: number;
  maiorMedia: { perguntaId: string; media: number } | null;
  menorMedia: { perguntaId: string; media: number } | null;
  enps: {
    indice: number;
    zona: ZonaEnps;
    promotores: number;
    neutros: number;
    detratores: number;
  } | null;
  /** A recomendação da liderança direta (só com pergunta de LNPS). */
  lnps?: {
    indice: number;
    zona: ZonaEnps;
    promotores: number;
    neutros: number;
    detratores: number;
  } | null;
}

/** `GET /pesquisas/:id/analises?campo=`. */
export interface AnalisesPesquisa {
  campo: CampoGrupo;
  colunas: { perguntaId: string; rotulo: string }[];
  /** 1ª linha: "Toda a empresa" (`grupoId` nulo). */
  linhas: {
    grupoId: string | null;
    nome: string;
    respostas: number;
    visivel: boolean;
    oculto?: MotivoOculto | null;
    media: number | null;
    medias: (number | null)[];
  }[];
  evolucao: {
    pesquisaId: string;
    nome: string;
    publicadaEm: string;
    mediaGeral: number | null;
    /** eNPS da pesquisa (só no modelo eNPS). */
    enps?: number | null;
  }[];
}

/** Item de `GET /pesquisas/:id/respostas` (identificada e anônima). */
export interface RespostaResumo {
  id: string;
  numero: number;
  colaboradorId: string | null;
  nome: string | null;
  departamento: string | null;
  respondidaEm: string;
  media: number | null;
  /**
   * Anônima com separar por: o grupo escolhido em cada campo, ou `null` com
   * o motivo quando o grupo está oculto (sem motivo: não informou).
   */
  grupos?: {
    campo: CampoGrupo;
    grupo: string | null;
    oculto: MotivoOculto | null;
  }[];
  /** O resumo da resposta no modelo (ex.: o índice do Clima), se houver. */
  resumoDoModelo?: ResumoDaRespostaDoModelo | null;
  /** Só no modelo eNPS: a nota da pergunta principal e o grupo. */
  enps?: { nota: number; grupo: GrupoDoEnps } | null;
}

/** `GET /pesquisas/:id/respostas/:respostaId`. */
export interface RespostaDetalhe extends RespostaResumo {
  anteriorId: string | null;
  proximaId: string | null;
  posicao: number;
  total: number;
  valores: { perguntaId: string; valor: unknown; mediaTime: number | null }[];
  indicadores: {
    media: number | null;
    mediaTime: number | null;
    recomendacao: number | null;
    enpsTime: number | null;
    maior: { perguntaId: string; valor: number } | null;
    menor: { perguntaId: string; valor: number } | null;
    /**
     * Média geral (0–10) da mesma pessoa nas pesquisas anteriores do mesmo
     * modelo; `null` sem anterior e sempre na anônima.
     */
    mediaUltimosPulsos: number | null;
  };
  /** O resultado da pessoa no modelo (ex.: os pilares da TAD). */
  modelo?: ResultadoIndividualDoModelo | null;
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
  /** Abre o resultado individual da pessoa (API ampliada). */
  respostaId?: string;
}

type Metodo = "GET" | "POST" | "PUT" | "DELETE";

/**
 * Um pedido à API. Escrita com 403 `csrf_invalido` (outra aba renovou o
 * token desta sessão): o pedido não foi aplicado, então descarta o token,
 * renova e repete UMA vez — como a troca de empresa e o perfil.
 */
export async function pedir<T>(
  rota: string,
  metodo: Metodo,
  corpo?: unknown,
): Promise<T> {
  const escrita = metodo !== "GET";
  const enviar = async () =>
    fetch(`/v1${rota}`, {
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
  let res = await enviar();
  if (escrita) {
    await descartarTokenSeDesatualizado(res);
    if (res.status === 403 && getCsrfToken() === null) {
      res = await enviar();
      await descartarTokenSeDesatualizado(res);
    }
  }
  if (res.status === 401) clearCsrfToken();
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

/** `GET /pesquisas/candidatos/contagem`: "Todo o time" sem baixar a lista. */
export interface ContagemDoTime {
  total: number;
  departamentos: {
    departamentoId: string | null;
    departamento: string | null;
    quantidade: number;
  }[];
}

export const contagemDoTime = () =>
  pedir<ContagemDoTime>("/pesquisas/candidatos/contagem", "GET");

/** `GET /pesquisas/candidatos`: um colaborador ativo e a lotação vigente. */
export interface CandidatoPesquisa {
  colaboradorId: string;
  nome: string;
  cargo: string | null;
  departamento: string | null;
  centroCusto: string | null;
  unidade: string | null;
}

export interface ListaDeCandidatos {
  itens: CandidatoPesquisa[];
  pagina: number;
  tamanhoPagina: number;
  total: number;
}

export interface ListarCandidatosQuery {
  /** Parte do nome. */
  busca?: string;
  departamentoId?: string;
  centroCustoId?: string;
  unidadeId?: string;
  pagina?: number;
  /** Até 100. */
  tamanhoPagina?: number;
}

/** Ativos da empresa ativa para "Escolher pessoas" (filtros no servidor). */
export function listarCandidatos(
  query: ListarCandidatosQuery = {},
): Promise<ListaDeCandidatos> {
  const params = new URLSearchParams();
  for (const chave of [
    "busca",
    "departamentoId",
    "centroCustoId",
    "unidadeId",
  ] as const) {
    const valor = query[chave];
    if (valor) params.set(chave, valor);
  }
  if (query.pagina !== undefined) params.set("pagina", String(query.pagina));
  if (query.tamanhoPagina !== undefined)
    params.set("tamanhoPagina", String(query.tamanhoPagina));
  const qs = params.toString();
  return pedir(`/pesquisas/candidatos${qs ? `?${qs}` : ""}`, "GET");
}

export const criarPesquisa = (entrada: PesquisaEntrada) =>
  pedir<PesquisaDetalhe>("/pesquisas", "POST", entrada);

export const obterPesquisa = (pesquisaId: string) =>
  pedir<PesquisaDetalhe>(`/pesquisas/${id(pesquisaId)}`, "GET");

export const alterarPesquisa = (pesquisaId: string, entrada: PesquisaEntrada) =>
  pedir<PesquisaDetalhe>(`/pesquisas/${id(pesquisaId)}`, "PUT", entrada);

export const publicarPesquisa = (
  pesquisaId: string,
  opcoes?: { confirmarSemIdentificaveis?: boolean },
) =>
  pedir<PesquisaDetalhe>(
    `/pesquisas/${id(pesquisaId)}/publicar`,
    "POST",
    opcoes?.confirmarSemIdentificaveis
      ? { confirmarSemIdentificaveis: true }
      : undefined,
  );

export const alterarStatusDaPesquisa = (
  pesquisaId: string,
  status: StatusPesquisa,
) =>
  pedir<PesquisaDetalhe>(`/pesquisas/${id(pesquisaId)}/status`, "POST", {
    status,
  });

/** Duplicar: a cópia nasce ativa, na empresa escolhida (padrão: a mesma). */
export const duplicarPesquisa = (pesquisaId: string, empresaId?: string) =>
  pedir<PesquisaDetalhe>(
    `/pesquisas/${id(pesquisaId)}/duplicar`,
    "POST",
    empresaId ? { empresaId } : {},
  );

export const excluirPesquisa = (pesquisaId: string) =>
  pedir<void>(`/pesquisas/${id(pesquisaId)}`, "DELETE");

/** Recorte: `campo` + `grupoId` (o `departamentoId` antigo segue aceito). */
export interface RecorteDosResultados {
  campo: CampoGrupo;
  grupoId: string;
}

export const resultadosDaPesquisa = (
  pesquisaId: string,
  recorte?: RecorteDosResultados | string | null,
) => {
  const q =
    typeof recorte === "string"
      ? `?departamentoId=${id(recorte)}`
      : recorte
        ? `?campo=${id(recorte.campo)}&grupoId=${id(recorte.grupoId)}`
        : "";
  return pedir<ResultadosPesquisa>(
    `/pesquisas/${id(pesquisaId)}/resultados${q}`,
    "GET",
  );
};

export const analisesDaPesquisa = (pesquisaId: string, campo: CampoGrupo) =>
  pedir<AnalisesPesquisa>(
    `/pesquisas/${id(pesquisaId)}/analises?campo=${id(campo)}`,
    "GET",
  );

/** `GET /pesquisas/:id/evolucao`: a evolução do modelo, sem recorte. */
export const evolucaoDaPesquisa = (pesquisaId: string) =>
  pedir<Pick<AnalisesPesquisa, "evolucao">>(
    `/pesquisas/${id(pesquisaId)}/evolucao`,
    "GET",
  );

export const respostaDaPesquisa = (pesquisaId: string, respostaId: string) =>
  pedir<RespostaDetalhe>(
    `/pesquisas/${id(pesquisaId)}/respostas/${id(respostaId)}`,
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
  comoLista<RespostaResumo>(
    await pedir<unknown>(`/pesquisas/${id(pesquisaId)}/respostas`, "GET"),
  );

export const pesquisasDoColaborador = async (colaboradorId: string) =>
  comoLista<PesquisaDaFicha>(
    await pedir<unknown>(
      `/colaboradores/${id(colaboradorId)}/pesquisas`,
      "GET",
    ),
  );
