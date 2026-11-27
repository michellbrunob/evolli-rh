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
] as const;
export type TipoPergunta = (typeof TIPOS_PERGUNTA)[number];

export interface Opcao {
  id: string;
  texto: string;
}

export interface ConfigPergunta {
  opcoes?: Opcao[];
  outro?: boolean;
  maximo?: number | null;
  respostaBoa?: "sim" | "nao" | null;
  enps?: boolean;
  minimo?: number | null;
  rotuloMinimo?: string | null;
  rotuloMaximo?: string | null;
  inteiro?: boolean;
}

export interface Condicao {
  perguntaId: string;
  opcaoId: string;
}

export interface Pergunta {
  id: string;
  tipo: TipoPergunta;
  texto: string;
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
  participantes: number;
  respostas: number;
  criadaEm: string;
  publicadaEm: string | null;
  encerraEm: string | null;
  link: string | null;
}

export interface ParticipanteDaLista {
  colaboradorId: string;
  nome: string;
  departamento: string | null;
  respondeu: boolean | null;
}

export interface PesquisaDetalhe extends PesquisaResumo {
  boasVindas: string | null;
  secoes: Secao[];
  minimoPorGrupo: number;
  todos: boolean;
  participantesLista: ParticipanteDaLista[];
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

export type ResultadoPergunta = {
  perguntaId: string;
  tipo: TipoPergunta;
  respondidas: number;
  viram: number;
} & (
  | {
      media: number | null;
      distribuicao: { valor: number; quantidade: number }[];
      enps?: {
        promotores: number;
        neutros: number;
        detratores: number;
        indice: number | null;
      };
    }
  | { opcoes: { opcaoId: string; quantidade: number }[]; outros: string[] }
  | { sim: number; nao: number }
  | { textos: { texto: string; autor: string | null }[] }
  | { datas: { valor: string; quantidade: number }[] }
);

export interface DepartamentoDoResultado {
  id: string;
  nome: string;
  respostas: number;
  visivel: boolean;
}

export interface ResultadosPesquisa {
  pesquisaId: string;
  respostas: number;
  participantes: number;
  departamentos: DepartamentoDoResultado[];
  filtro: { departamentoId: string | null; visivel: boolean };
  perguntas: ResultadoPergunta[];
}

export interface RespostaIndividual {
  colaboradorId: string;
  nome: string;
  departamento: string | null;
  respondidaEm: string;
  valores: ValorRespondido[];
}

export interface PesquisaDaFicha {
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
  identificacao: Identificacao;
  totalPerguntas: number;
  minutosEstimados: number;
  secoes: Secao[];
}

export type MotivoIndisponivel =
  "pausada" | "encerrada" | "cancelada" | "inexistente";

export type AberturaPublica =
  PesquisaPublica | { indisponivel: MotivoIndisponivel };
