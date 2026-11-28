/**
 * T216 — cliente das rotas PÚBLICAS de Pesquisas (responder pelo link).
 *
 *   GET  /v1/publico/pesquisas/:token              abertura e estrutura
 *   POST /v1/publico/pesquisas/:token/identificar  CPF + data de nascimento
 *   POST /v1/publico/pesquisas/:token/respostas    envio das respostas
 *
 * Quem responde não tem sessão no Evolli. Por isso este cliente:
 *
 * - nunca envia cookie (`credentials: "omit"`): um RH logado no mesmo
 *   navegador não "empresta" a sessão dele à resposta;
 * - nunca envia nem lê token CSRF (as rotas públicas não usam sessão);
 * - não guarda nada: o passe da identificação vive só na memória da tela.
 *
 * O `fetch` é injetável (`criarClientePesquisaPublica`) para os testes e
 * para a tela receber um cliente pronto.
 */

export type Identificacao = "identificada" | "confidencial" | "anonima";

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
  /** Perfil comportamental (DISC): escolher 1 de 4 frases. */
  | "escolha_forcada";

/** O fator DISC de uma frase (só nos blocos de escolha forçada). */
export type FatorDisc = "D" | "I" | "S" | "C";

export interface Opcao {
  readonly id: string;
  readonly texto: string;
  readonly fator?: FatorDisc;
}

export interface ConfigPergunta {
  readonly opcoes?: readonly Opcao[];
  readonly outro?: boolean;
  readonly maximo?: number;
  readonly respostaBoa?: "sim" | "nao" | null;
  readonly enps?: boolean;
  readonly lnps?: boolean;
  readonly minimo?: number;
  readonly rotuloMinimo?: string | null;
  readonly rotuloMaximo?: string | null;
  /** Escala: o rótulo de cada ponto, do mínimo ao máximo. */
  readonly rotulos?: readonly string[] | null;
  readonly inteiro?: boolean;
  /** Escala com `rotulos`: mostra só os rótulos, em lista (sem os números). */
  readonly somenteRotulos?: boolean;
}

export interface Pergunta {
  readonly id: string;
  /** O item do modelo (ex.: o comentário de uma dimensão). */
  readonly chave?: string | null;
  readonly tipo: TipoPergunta;
  readonly texto: string;
  readonly descricao: string | null;
  readonly obrigatoria: boolean;
  readonly config: ConfigPergunta;
  readonly condicao: {
    readonly perguntaId: string;
    readonly opcaoId: string;
  } | null;
}

export interface Secao {
  readonly id: string;
  readonly titulo: string | null;
  readonly descricao: string | null;
  readonly perguntas: readonly Pergunta[];
}

/** Campo pelo qual a anônima separa as respostas (ampliação de 27/11). */
export type CampoGrupo = "departamento" | "centroCusto" | "unidade";

/** Um campo de separação que quem responde escolhe antes das perguntas. */
export interface GrupoPublico {
  readonly campo: CampoGrupo;
  readonly rotulo: string;
  readonly opcoes: readonly { readonly id: string; readonly nome: string }[];
}

/** Modelo da pesquisa: a Personalizada mostra uma seção por vez. */
export type ModeloPublico =
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

export interface PesquisaPublica {
  /** Ausente numa API que ainda não o devolve: uma pergunta por tela. */
  readonly modelo?: ModeloPublico;
  readonly empresa: string;
  readonly nome: string;
  readonly boasVindas: string | null;
  readonly identificacao: Identificacao;
  readonly totalPerguntas: number;
  readonly minutosEstimados: number;
  readonly secoes: readonly Secao[];
  /** Só na anônima com separação; ausente numa API anterior à ampliação. */
  readonly grupos?: readonly GrupoPublico[];
}

/**
 * Por que o link não aceita resposta. `encerrada`: o prazo (`encerraEm`)
 * terminou; `finalizada`: o RH finalizou a pesquisa.
 */
export type MotivoIndisponivel =
  "pausada" | "encerrada" | "finalizada" | "cancelada" | "inexistente";

export type AberturaPublica =
  PesquisaPublica | { readonly indisponivel: MotivoIndisponivel };

export interface DadosDeIdentificacao {
  /** Só os 11 dígitos. */
  readonly cpf: string;
  /** `AAAA-MM-DD`. */
  readonly dataNascimento: string;
}

export interface Identificado {
  readonly passe: string;
  readonly primeiroNome: string;
}

/** Valor de uma resposta, na forma do contrato (tabela dos 11 tipos). */
export type ValorResposta =
  | string
  | number
  | { readonly opcao: string }
  | { readonly outro: string }
  | { readonly opcoes: readonly string[]; readonly outro?: string };

export interface RespostaDaPergunta {
  readonly perguntaId: string;
  readonly valor: ValorResposta;
}

export interface EnvioDeRespostas {
  readonly passe?: string;
  /** Escolha de cada grupo; `null` = prefere não informar. */
  readonly grupos?: Partial<Record<CampoGrupo, string | null>>;
  readonly respostas: readonly RespostaDaPergunta[];
  /** T216 — onboarding: vai para a rota da rodada (`null` = a do convite). */
  readonly onboarding?: { readonly rodada: number | null };
}

export interface ErroDeCampo {
  readonly campo: string;
  readonly motivo: string;
}

/**
 * Recusa com o status real. A mensagem é fixa: quem decide o texto da tela é
 * a tela, pelo status — o corpo do servidor nunca vai direto para quem
 * responde. `erros` traz os erros por pergunta de um 422; `indisponivel`, o
 * motivo de um 410, quando o servidor o informa.
 */
export class ErroPesquisaPublica extends Error {
  constructor(
    readonly status: number,
    readonly erros: readonly ErroDeCampo[] = [],
    readonly indisponivel: MotivoIndisponivel | null = null,
  ) {
    super(`Pesquisa pública recusada (${status}).`);
    this.name = "ErroPesquisaPublica";
  }
}

export interface ClientePesquisaPublica {
  abrir(token: string): Promise<AberturaPublica>;
  identificar(
    token: string,
    dados: DadosDeIdentificacao,
  ): Promise<Identificado>;
  enviarRespostas(token: string, envio: EnvioDeRespostas): Promise<void>;
}

const BASE = "/v1/publico/pesquisas";

const MOTIVOS: readonly MotivoIndisponivel[] = [
  "pausada",
  "encerrada",
  "finalizada",
  "cancelada",
  "inexistente",
];

function rota(token: string, sufixo = ""): string {
  return `${BASE}/${encodeURIComponent(token)}${sufixo}`;
}

function motivoValido(valor: unknown): MotivoIndisponivel | null {
  return typeof valor === "string" &&
    (MOTIVOS as readonly string[]).includes(valor)
    ? (valor as MotivoIndisponivel)
    : null;
}

async function lerCorpo(res: Response): Promise<Record<string, unknown>> {
  const corpo: unknown = await res.json().catch(() => null);
  return corpo !== null && typeof corpo === "object"
    ? (corpo as Record<string, unknown>)
    : {};
}

async function erroDe(res: Response): Promise<ErroPesquisaPublica> {
  const corpo = await lerCorpo(res);
  const erros = Array.isArray(corpo["erros"])
    ? (corpo["erros"] as unknown[]).flatMap((e) => {
        if (e === null || typeof e !== "object") return [];
        const { campo, motivo } = e as Record<string, unknown>;
        return typeof campo === "string"
          ? [{ campo, motivo: typeof motivo === "string" ? motivo : "" }]
          : [];
      })
    : [];
  return new ErroPesquisaPublica(
    res.status,
    erros,
    motivoValido(corpo["indisponivel"]),
  );
}

/** Pedido sem cookie, sem CSRF e sem cache. */
function opcoes(metodo: "GET" | "POST", corpo?: unknown): RequestInit {
  const init: RequestInit = {
    method: metodo,
    credentials: "omit",
    cache: "no-store",
    headers:
      corpo === undefined
        ? { Accept: "application/json" }
        : { Accept: "application/json", "Content-Type": "application/json" },
  };
  if (corpo !== undefined) init.body = JSON.stringify(corpo);
  return init;
}

export function criarClientePesquisaPublica(
  // Lido na hora da chamada: os testes que trocam o `fetch` global valem.
  buscar: typeof fetch = (...args) => fetch(...args),
): ClientePesquisaPublica {
  return {
    async abrir(token) {
      const res = await buscar(rota(token), opcoes("GET"));
      // Pesquisa inexistente, excluída ou de link errado: o mesmo aviso.
      if (res.status === 404) return { indisponivel: "inexistente" };
      if (res.status === 410) {
        const erro = await erroDe(res);
        return { indisponivel: erro.indisponivel ?? "encerrada" };
      }
      if (!res.ok) throw await erroDe(res);
      const corpo = await lerCorpo(res);
      const motivo = motivoValido(corpo["indisponivel"]);
      if (motivo) return { indisponivel: motivo };
      return corpo as unknown as PesquisaPublica;
    },

    async identificar(token, dados) {
      const res = await buscar(
        rota(token, "/identificar"),
        opcoes("POST", {
          cpf: dados.cpf,
          dataNascimento: dados.dataNascimento,
        }),
      );
      if (!res.ok) throw await erroDe(res);
      const corpo = await lerCorpo(res);
      if (typeof corpo["passe"] !== "string") {
        throw new ErroPesquisaPublica(res.status);
      }
      return {
        passe: corpo["passe"],
        primeiroNome:
          typeof corpo["primeiroNome"] === "string"
            ? corpo["primeiroNome"]
            : "",
      };
    },

    async enviarRespostas(token, envio) {
      const corpo: {
        passe?: string;
        grupos?: Partial<Record<CampoGrupo, string | null>>;
        respostas: readonly RespostaDaPergunta[];
      } = { respostas: envio.respostas };
      if (envio.passe !== undefined) corpo.passe = envio.passe;
      if (envio.grupos !== undefined) corpo.grupos = envio.grupos;
      const res = await buscar(
        rota(token, envio.onboarding ? "/onboarding/respostas" : "/respostas"),
        opcoes(
          "POST",
          envio.onboarding?.rodada != null
            ? { ...corpo, rodada: envio.onboarding.rodada }
            : corpo,
        ),
      );
      if (!res.ok) throw await erroDe(res);
    },
  };
}

/** O cliente de produção, com o `fetch` do navegador. */
export const clientePesquisaPublica = criarClientePesquisaPublica();
