/**
 * T216 — Onboarding automático: o contrato das rotas próprias (envio,
 * público, ativação, convites e resultado por rodada). Criar, editar
 * perguntas, status e excluir são as rotas da pesquisa.
 */
import type { CampoGrupo } from "../../../../api/pesquisasClient";
import { pedir } from "../../../../api/pesquisasClient";
import type { Faixa, RodadaAutomatica } from "./envio";

export type CampoDoPublico =
  "departamento" | "cargo" | "unidade" | "centroCusto";

export type Publico =
  | { tipo: "todos" }
  | {
      tipo: "grupo";
      condicoes: {
        campo: CampoDoPublico;
        operador: "e" | "uma_destas";
        valores: string[];
      }[];
    }
  | { tipo: "pessoas"; colaboradorIds: string[] };

export interface ConfigOnboarding {
  modo: "agora" | "agendar" | "automatizar";
  rodadas: RodadaAutomatica[];
  horario: string;
  agendadoPara: string | null;
  prazoDias: 3 | 5 | 7 | 10 | 15;
  lembreteDias: 2 | 3 | 5 | null;
  soDiasUteis: boolean;
  incluirAtrasados: boolean;
  publico: Publico;
  email: {
    modelo: "padrao" | "personalizado";
    assunto: string | null;
    titulo: string | null;
    mensagem: string | null;
    /** Personalizado: a cor principal (`#rrggbb`); sem ela, a do Evolli. */
    corPrincipal?: string | null;
    /** Personalizado: a cor de fundo, sempre clara (`#rrggbb`). */
    corFundo?: string | null;
  };
}

export interface Funil {
  noPublico: number;
  semEmail: number;
  aguardandoEmail: number;
  enviados: number;
  responderam: number;
  pulados: number;
  agendados: number;
}

export interface OnboardingDetalhe {
  pesquisaId: string;
  config: ConfigOnboarding;
  ativa: boolean;
  ativadaEm: string | null;
  publico: { total: number; semEmail: number };
  proximas: Record<RodadaAutomatica, number>;
  funil: Funil;
  proximoEnvio: { data: string; horario: string; pessoas: number } | null;
  link: string | null;
}

export interface PessoaDoPublico {
  colaboradorId: string;
  nome: string;
  cargo: string | null;
  departamento: string | null;
  unidade: string | null;
  temEmail: boolean;
  noPublico: boolean;
}

export interface PreviaDoPublico {
  total: number;
  semEmail: number;
  proximas: Record<RodadaAutomatica, number>;
  pessoas: PessoaDoPublico[];
}

export type SituacaoDoEnvio =
  | "agendado"
  | "aguardando_email"
  | "enviado"
  | "sem_email"
  | "respondido"
  | "pulado";

export interface EnvioDoOnboarding {
  id: string;
  colaboradorId: string;
  nome: string;
  rodada: number;
  dataPrevista: string;
  prazo: string;
  situacao: SituacaoDoEnvio;
  enviadoEm: string | null;
  lembreteEm: string | null;
}

/** Identificada: o cadastro e os convites de cada pessoa, por rodada. */
export interface JornadaDoOnboarding {
  colaboradorId: string;
  nome: string;
  admissao: string | null;
  cargo: string | null;
  unidade: string | null;
  rodadas: { rodada: number; dataPrevista: string; situacao: string }[];
  respondidas: number;
}

export interface EnviosDoOnboarding {
  identificacao: "identificada" | "confidencial" | "anonima";
  horario: string;
  /** Só na identificada; `null` nas outras. */
  jornadas?: JornadaDoOnboarding[] | null;
  itens: EnvioDoOnboarding[];
}

export interface Distribuicao {
  opcaoId: string;
  quantidade: number;
  percentual: number;
}

export interface ResultadoDaRodada {
  rodada: number;
  respostas: number;
  visivel: boolean;
  faltam: number;
  indice: number | null;
  faixa: Faixa | null;
  blocos: {
    id: string;
    titulo: string | null;
    indice: number | null;
    faixa: Faixa | null;
    perguntas: { perguntaId: string; indice: number | null }[];
  }[];
  intencao: { opcoes: Distribuicao[]; querContinuar: number | null } | null;
  motivos: { opcoes: Distribuicao[]; outros: string[] } | null;
  recomendacao: {
    respostas: number;
    media: number | null;
    indice: number | null;
    promotores: number;
    neutros: number;
    detratores: number;
  } | null;
}

export interface ResultadosDoOnboarding {
  pesquisaId: string;
  identificacao: "identificada" | "confidencial" | "anonima";
  respostas: number;
  filtro: { campo: CampoGrupo; grupoId: string } | null;
  rodadas: ResultadoDaRodada[];
  comparacoes: {
    de: number;
    para: number;
    blocos: {
      id: string;
      antes: number | null;
      depois: number | null;
      mudou: number | null;
    }[];
    geral: {
      antes: number | null;
      depois: number | null;
      mudou: number | null;
    };
  }[];
  peso: {
    suficiente: boolean;
    blocos: {
      id: string;
      titulo: string | null;
      indice: number | null;
      peso: number | null;
      prioridade: boolean;
    }[];
  };
  fluxo: {
    de: number;
    para: number;
    pessoas: number;
    visivel: boolean;
    fluxos: { de: string; para: string; quantidade: number }[];
  } | null;
  contatos: string[];
  melhorar: string[];
  gosta: string[];
  funil: Funil;
  grupos: Partial<Record<CampoGrupo, { id: string; nome: string }[]>>;
}

const id = encodeURIComponent;

export const clienteDoOnboarding = {
  obter: (pesquisaId: string) =>
    pedir<OnboardingDetalhe>(`/pesquisas/${id(pesquisaId)}/onboarding`, "GET"),
  salvar: (pesquisaId: string, config: ConfigOnboarding) =>
    pedir<OnboardingDetalhe>(`/pesquisas/${id(pesquisaId)}/onboarding`, "PUT", {
      config,
    }),
  previaDoPublico: (publico: Publico, soDiasUteis: boolean) =>
    pedir<PreviaDoPublico>("/pesquisas/onboarding/publico", "POST", {
      publico,
      soDiasUteis,
    }),
  ativar: (pesquisaId: string) =>
    pedir<OnboardingDetalhe>(
      `/pesquisas/${id(pesquisaId)}/onboarding/ativar`,
      "POST",
    ),
  envios: (pesquisaId: string) =>
    pedir<EnviosDoOnboarding>(
      `/pesquisas/${id(pesquisaId)}/onboarding/envios`,
      "GET",
    ),
  pular: (pesquisaId: string, envioId: string) =>
    pedir<void>(
      `/pesquisas/${id(pesquisaId)}/onboarding/envios/${id(envioId)}/pular`,
      "POST",
    ),
  resultados: (
    pesquisaId: string,
    recorte?: { campo: CampoGrupo; grupoId: string } | null,
  ) =>
    pedir<ResultadosDoOnboarding>(
      `/pesquisas/${id(pesquisaId)}/onboarding/resultados${
        recorte
          ? `?campo=${id(recorte.campo)}&grupoId=${id(recorte.grupoId)}`
          : ""
      }`,
      "GET",
    ),
};

export type ClienteDoOnboarding = typeof clienteDoOnboarding;
