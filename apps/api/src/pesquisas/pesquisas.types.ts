import type { GrupoDoEnps } from "./modelos/enps/calculo";
import type {
  ResultadoDoModelo,
  ResultadoIndividualDoModelo,
  ResumoDaRespostaDoModelo,
} from "./modelos/tipos";

export type {
  ResultadoDoModelo,
  ResultadoIndividualDoModelo,
  ResumoDaRespostaDoModelo,
} from "./modelos/tipos";

/**
 * T216 — Pesquisas: os tipos do contrato da API (apêndice de
 * `docs/decisions/t216-pesquisas.md`). As telas são feitas contra estes
 * formatos; mudar um campo aqui é mudar o contrato.
 */

export const IDENTIFICACOES = [
  "identificada",
  "confidencial",
  "anonima",
] as const;
export type Identificacao = (typeof IDENTIFICACOES)[number];

export const STATUS_PESQUISA = [
  "rascunho",
  "ativa",
  "pausada",
  "finalizada",
  "cancelada",
] as const;
export type StatusPesquisa = (typeof STATUS_PESQUISA)[number];

export const MODELOS = [
  "pulso",
  "clima",
  "enps",
  "onboarding",
  "desligamento",
  "beneficios",
  "treinamento",
  "personalizada",
  // Modelos da galeria completa (5 categorias): clima e engajamento, saúde e
  // NR-1, desempenho e perfil comportamental.
  "pulso_clima",
  "tad",
  "copsoq",
  "isfb",
  "avaliacao90",
  "avaliacao180",
  "disc",
] as const;
export type Modelo = (typeof MODELOS)[number];

export const TIPOS_PERGUNTA = [
  "texto_curto",
  "paragrafo",
  "escolha_unica",
  "multipla_escolha",
  "sim_nao",
  "concordancia",
  "nota_0_10",
  "estrelas",
  "escala",
  "data",
  "numero",
  // Escalas de 4 pontos, sem ponto neutro (modelo de Onboarding e a
  // Personalizada): concordância e satisfação.
  "concordancia_4",
  "satisfacao_4",
  // Perfil comportamental (DISC): bloco de frases, uma por fator, e a
  // pessoa escolhe a que mais combina com ela. Só existe no modelo `disc`.
  "escolha_forcada",
] as const;
export type TipoPergunta = (typeof TIPOS_PERGUNTA)[number];

/** Campos de separação por grupo (recortes e a escolha na anônima). */
export const CAMPOS_GRUPO = ["departamento", "centroCusto", "unidade"] as const;
export type CampoGrupo = (typeof CAMPOS_GRUPO)[number];

export const ROTULOS_DOS_CAMPOS: Readonly<Record<CampoGrupo, string>> = {
  departamento: "Departamento",
  centroCusto: "Centro de custo",
  unidade: "Unidade",
};

/** Grupos de uma resposta: o id escolhido (ou da lotação), `null` sem grupo. */
export type GruposDaResposta = Partial<Record<CampoGrupo, string | null>>;

export interface Opcao {
  id: string;
  texto: string;
  /** Só nos blocos de escolha forçada: o fator DISC da frase. */
  fator?: "D" | "I" | "S" | "C";
}

export interface ConfigPergunta {
  opcoes?: Opcao[];
  outro?: boolean;
  maximo?: number | null;
  respostaBoa?: "sim" | "nao" | null;
  enps?: boolean;
  /**
   * Nota 0–10 de recomendação da liderança direta (LNPS): mesmo cálculo do
   * eNPS (promotores 9–10 menos detratores 0–6), indicador próprio.
   */
  lnps?: boolean;
  minimo?: number | null;
  /** Escala e nota 0–10: o texto das pontas. */
  rotuloMinimo?: string | null;
  rotuloMaximo?: string | null;
  /** Escala: o rótulo de cada ponto, do mínimo ao máximo (opcional). */
  rotulos?: string[] | null;
  inteiro?: boolean;
  /** Escala com `rotulos`: mostra só os rótulos, em lista (sem os números). */
  somenteRotulos?: boolean;
  /**
   * Escala com `rotulos`: os pontos aparecem do maior para o menor (a saúde
   * da NR-1: "5 Excelente" primeiro). O valor gravado não muda.
   */
  decrescente?: boolean;
}

export interface Condicao {
  perguntaId: string;
  opcaoId: string;
}

export interface Pergunta {
  id: string;
  /**
   * O item do modelo (ex.: `pc_ae_01`): liga a pergunta à dimensão, ao pilar
   * ou à regra de pontuação do modelo. Ausente nas perguntas livres.
   */
  chave?: string | null;
  tipo: TipoPergunta;
  texto: string;
  /** Rótulo curto (até 40) para as tabelas de análise. */
  rotulo: string | null;
  descricao: string | null;
  obrigatoria: boolean;
  config: ConfigPergunta;
  condicao: Condicao | null;
}

export interface Secao {
  id: string;
  titulo: string | null;
  descricao: string | null;
  perguntas: Pergunta[];
}

export interface ValorRespondido {
  perguntaId: string;
  valor: unknown;
}

export interface PesquisaResumo {
  id: string;
  nome: string;
  modelo: Modelo;
  identificacao: Identificacao;
  status: StatusPesquisa;
  /** `null` na anônima (sem participantes: quem tiver o link responde). */
  participantes: number | null;
  respostas: number;
  criadaEm: string;
  publicadaEm: string | null;
  /** Data e hora do encerramento, ISO com o fuso de Brasília (`-03:00`). */
  encerraEm: string | null;
  link: string | null;
}

export interface ParticipanteDaLista {
  colaboradorId: string;
  nome: string;
  departamento: string | null;
  respondeu: boolean | null;
  /** Tem CPF e nascimento no perfil (o link exige); anônima: sempre. */
  identificavel: boolean;
}

export interface PesquisaDetalhe extends PesquisaResumo {
  boasVindas: string | null;
  secoes: Secao[];
  minimoPorGrupo: number;
  /** Só na anônima: os grupos que quem responde escolhe (0 a 2). */
  separarPor: CampoGrupo[];
  todos: boolean;
  participantesLista: ParticipanteDaLista[];
  /** Participantes que não conseguem se identificar pelo link (0 na anônima). */
  naoIdentificaveis: number;
  /** Painel de participantes da edição; `null` na anônima. */
  participantesTotal: number | null;
  responderam: number | null;
  pendentes: number | null;
  temRespostas: boolean;
}

export type ContagensPorStatus = Record<"todas" | StatusPesquisa, number>;

export interface ListaDePesquisas {
  itens: PesquisaResumo[];
  pagina: number;
  tamanhoPagina: number;
  total: number;
  contagens: ContagensPorStatus;
}

export type ZonaEnps =
  "critica" | "aperfeicoamento" | "qualidade" | "excelencia";

export interface Faixas {
  baixa: number;
  media: number;
  alta: number;
}

export type ResultadoPergunta = {
  perguntaId: string;
  tipo: TipoPergunta;
  respondidas: number;
  viram: number;
} & (
  | {
      media: number | null;
      distribuicao: { valor: number; quantidade: number }[];
      /** Escalas, nota e estrelas: % na faixa alta (0–100). */
      favoravel?: number | null;
      faixas?: Faixas;
      enps?: {
        promotores: number;
        neutros: number;
        detratores: number;
        indice: number | null;
        zona: ZonaEnps | null;
      };
    }
  | { opcoes: { opcaoId: string; quantidade: number }[]; outros: string[] }
  | { sim: number; nao: number }
  | { textos: { texto: string; autor: string | null }[] }
  | { datas: { valor: string; quantidade: number }[] }
);

/**
 * Por que um grupo não mostra números: abaixo do mínimo, ou escondido para
 * que o grupo menor não possa ser deduzido pelo total.
 */
export type MotivoOculto = "minimo" | "protege_grupo_menor";

export interface DepartamentoDoResultado {
  id: string;
  nome: string;
  respostas: number;
  visivel: boolean;
  oculto: MotivoOculto | null;
}

export interface IndicadorNps {
  indice: number;
  zona: ZonaEnps;
  promotores: number;
  neutros: number;
  detratores: number;
}

export interface IndicadoresPesquisa {
  /** Média das perguntas de escala, na escala 0–10. */
  mediaGeral: number | null;
  perguntasDeEscala: number;
  maiorMedia: { perguntaId: string; media: number } | null;
  menorMedia: { perguntaId: string; media: number } | null;
  enps: IndicadorNps | null;
  /** A recomendação da liderança direta (perguntas com `lnps`). */
  lnps?: IndicadorNps | null;
}

export interface ResultadosPesquisa {
  pesquisaId: string;
  respostas: number;
  /** `null` na anônima. */
  participantes: number | null;
  departamentos: DepartamentoDoResultado[];
  /** Os grupos de cada recorte disponível (mesmo formato de `departamentos`). */
  grupos: Partial<Record<CampoGrupo, DepartamentoDoResultado[]>>;
  filtro: {
    campo: CampoGrupo | null;
    grupoId: string | null;
    departamentoId: string | null;
    /** Respostas do recorte (sem filtro, o total). */
    respostas: number;
    visivel: boolean;
  };
  indicadores: IndicadoresPesquisa;
  recortes: CampoGrupo[];
  perguntas: ResultadoPergunta[];
  /**
   * O resultado próprio do modelo (dimensões, pilares, níveis), quando o
   * modelo tem cálculo próprio; `null` sem respostas visíveis. Ver
   * `modelos/tipos.ts`.
   */
  modelo?: ResultadoDoModelo | null;
}

export interface AnalisesPesquisa {
  campo: CampoGrupo;
  colunas: { perguntaId: string; rotulo: string }[];
  linhas: {
    grupoId: string | null;
    nome: string;
    respostas: number;
    visivel: boolean;
    oculto: MotivoOculto | null;
    media: number | null;
    medias: (number | null)[];
  }[];
  evolucao: {
    pesquisaId: string;
    nome: string;
    publicadaEm: string;
    mediaGeral: number | null;
    /** eNPS da pesquisa (só no modelo eNPS; `null` sem nota ou oculto). */
    enps?: number | null;
  }[];
}

export interface RespostaResumo {
  id: string;
  numero: number;
  colaboradorId: string | null;
  nome: string | null;
  departamento: string | null;
  respondidaEm: string;
  /** Média da resposta nas perguntas de escala (0–10). */
  media: number | null;
  /**
   * Anônima com separação: o grupo escolhido em cada campo — o nome, ou
   * `null` com o motivo quando o grupo está oculto (ou `null` sem motivo
   * quando a pessoa não informou). Vazio nas demais.
   */
  grupos: {
    campo: CampoGrupo;
    grupo: string | null;
    oculto: MotivoOculto | null;
  }[];
  /** O resumo da resposta no modelo (ex.: o índice do Clima), se houver. */
  resumoDoModelo?: ResumoDaRespostaDoModelo | null;
  /** Só no modelo eNPS: a nota da pergunta principal e o grupo. */
  enps?: { nota: number; grupo: GrupoDoEnps } | null;
}

export interface RespostaDetalhe extends RespostaResumo {
  anteriorId: string | null;
  proximaId: string | null;
  posicao: number;
  total: number;
  valores: { perguntaId: string; valor: unknown; mediaTime: number | null }[];
  indicadores: {
    media: number | null;
    mediaTime: number | null;
    /**
     * Média geral (0–10) da MESMA pessoa nas pesquisas anteriores do mesmo
     * modelo (publicadas antes desta). Só na identificada; `null` sem
     * anterior e sempre na anônima.
     */
    mediaUltimosPulsos: number | null;
    recomendacao: number | null;
    enpsTime: number | null;
    maior: { perguntaId: string; valor: number } | null;
    menor: { perguntaId: string; valor: number } | null;
  };
  /** O resultado da pessoa no modelo (ex.: os pilares da TAD), se houver. */
  modelo?: ResultadoIndividualDoModelo | null;
}

/** `GET /pesquisas/candidatos`: um colaborador ativo e a lotação vigente. */
export interface CandidatoPesquisa {
  colaboradorId: string;
  nome: string;
  cargo: string | null;
  departamento: string | null;
  centroCusto: string | null;
  unidade: string | null;
}

/** `GET /pesquisas/candidatos/contagem`: o "Todo o time". */
export interface ContagemDoTime {
  total: number;
  /** Por departamento da lotação vigente; `null` = sem departamento. */
  departamentos: {
    departamentoId: string | null;
    departamento: string | null;
    quantidade: number;
  }[];
}

export interface PesquisaDaFicha {
  respostaId: string;
  pesquisaId: string;
  nome: string;
  modelo: Modelo;
  respondidaEm: string;
  secoes: Secao[];
  valores: ValorRespondido[];
}

export interface PesquisaPublica {
  empresa: string;
  nome: string;
  boasVindas: string | null;
  /** O modelo (a personalizada mostra uma seção por vez). */
  modelo: Modelo;
  identificacao: Identificacao;
  totalPerguntas: number;
  /** 20 s por pergunta, arredondado ao minuto mais próximo; mínimo 1. */
  minutosEstimados: number;
  secoes: Secao[];
  /** Anônima com separação: o que escolher antes das perguntas. */
  grupos: {
    campo: CampoGrupo;
    rotulo: string;
    opcoes: { id: string; nome: string }[];
  }[];
}

export type MotivoIndisponivel =
  "pausada" | "finalizada" | "encerrada" | "cancelada" | "inexistente";

export type AberturaPublica =
  PesquisaPublica | { indisponivel: MotivoIndisponivel };
