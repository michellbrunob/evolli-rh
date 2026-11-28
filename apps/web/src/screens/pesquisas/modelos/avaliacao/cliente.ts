/**
 * T216 — Avaliação 90°/180°: o contrato das rotas próprias (organograma,
 * times e configuração, resultados do time e da pessoa, aba da ficha) e o
 * link público do gestor e da autoavaliação. Criar, publicar, status e
 * excluir são as rotas da pesquisa (`pesquisasClient`).
 */
import { pedir } from "../../../../api/pesquisasClient";
import type {
  Competencia,
  ModeloDeAvaliacao,
  Nivel,
  Quadrante,
  RegraDeComentarios,
} from "./catalogo";

export interface PessoaResumida {
  id: string;
  nome: string;
  cargo: string | null;
  departamento: string | null;
  /** Tem CPF e nascimento no cadastro (o link exige). */
  identificavel: boolean;
  temEmail: boolean;
}

export type MotivoSemGestor = "sem_gestor" | "gestor_sem_cpf" | "gestor_inativo";

export interface Organograma {
  times: { gestor: PessoaResumida; pessoas: PessoaResumida[] }[];
  semGestor: {
    pessoa: PessoaResumida;
    motivo: MotivoSemGestor;
    gestorNome: string | null;
  }[];
  ativos: PessoaResumida[];
}

export type Lembrete = "7_dias" | "3_dias" | "no_dia" | "depois";

export interface ConfigAvaliacao {
  comentarios: RegraDeComentarios;
  liberarNoPortal: boolean;
  visibilidade: "depois_do_gestor" | "so_rh";
  /** 180°: `AAAA-MM-DDTHH:mm` (Brasília) na entrada; ISO na saída. */
  prazoAutoavaliacao: string | null;
  lembretes: Lembrete[];
  envio: "email" | "link";
}

export interface TimeInformado {
  gestorId: string;
  avaliadoIds: string[];
}

export interface PessoaDoTime extends PessoaResumida {
  gestorRespondeu: boolean;
  autoavaliacao: { respondeu: boolean } | null;
}

export interface AvaliacaoDetalhe {
  pesquisaId: string;
  modelo: ModeloDeAvaliacao;
  config: ConfigAvaliacao;
  prazo: string | null;
  times: { gestor: PessoaResumida; pessoas: PessoaDoTime[] }[];
  totais: {
    gestores: number;
    pessoas: number;
    autoavaliacoes: number;
    respondidas: number;
    pendentes: number;
  };
  lembretes: { lembrete: Lembrete; quando: string }[];
  convites: { aguardandoEmail: number; semEmail: number; enviados: number };
}

export interface NotaDaAvaliacao {
  competencias: Record<Competencia, number | null>;
  geral: number | null;
  entrega: number | null;
  pessoas: number | null;
  nivel: Nivel | null;
  quadrante: Quadrante | null;
  grupo: "destaque" | "esperado" | "apoio" | null;
}

export type Alerta =
  | { tipo: "linha_reta" }
  | { tipo: "extremas_sem_comentario"; competencias: Competencia[] };

export interface PessoaDoResultado {
  colaboradorId: string;
  nome: string;
  cargo: string | null;
  departamento: string | null;
  gestor: { id: string; nome: string };
  gestorRespondeu: boolean;
  temAutoavaliacao: boolean;
  autoavaliacaoRespondida: boolean;
  nota: NotaDaAvaliacao | null;
  autoavaliacao: NotaDaAvaliacao | null;
  diferenca: number | null;
  alinhamento: "acima" | "alinhada" | "abaixo" | null;
  alertas: Alerta[];
  tempoDeCasa: string | null;
}

export interface CompetenciaNoTime {
  competencia: Competencia;
  media: number | null;
  abaixoDe3: string[];
  percentualAbaixoDe3: number;
  menorAfirmacao: { itemId: string; media: number } | null;
}

export interface RecorteDaAvaliacao {
  grupo: string;
  avaliadas: number;
  media: number | null;
  visivel: boolean;
}

export interface ResultadosDaAvaliacao {
  pesquisaId: string;
  modelo: ModeloDeAvaliacao;
  avaliadas: number;
  previstas: number;
  autoavaliacoes: { previstas: number; respondidas: number };
  time: {
    avaliadas: number;
    media: number | null;
    nivel: Nivel | null;
    competencias: CompetenciaNoTime[];
    grupos: Record<"destaque" | "esperado" | "apoio", string[]>;
    mapa: Record<Quadrante, string[]>;
  };
  itens: { itemId: string; media: number | null }[];
  pessoas: PessoaDoResultado[];
  calibracao: {
    avaliadorId: string;
    nome: string;
    avaliadas: number;
    media: number | null;
    diferenca: number | null;
    leitura: "poucas" | "generoso" | "exigente" | "alinhado";
  }[];
  recortes: {
    tempoDeCasa: RecorteDaAvaliacao[];
    departamento: RecorteDaAvaliacao[];
  };
  comparativo: {
    completas: number;
    competencias: {
      competencia: Competencia;
      gestor: number | null;
      autoavaliacao: number | null;
      diferenca: number | null;
    }[];
    acima: number;
    alinhadas: number;
    abaixo: number;
  } | null;
}

export type Leitura =
  | "forca_confirmada"
  | "forca_nao_vista"
  | "ponto_cego"
  | "a_desenvolver"
  | "alinhada";

export interface LadoDaAvaliacao {
  respondidaEm: string;
  nota: NotaDaAvaliacao;
  notas: Record<string, number>;
  comentarios: Partial<Record<Competencia, string>>;
  alertas: Alerta[];
}

export interface ResultadoDaPessoa {
  pesquisaId: string;
  pesquisa: string;
  modelo: ModeloDeAvaliacao;
  colaboradorId: string;
  nome: string;
  cargo: string | null;
  departamento: string | null;
  gestor: { id: string; nome: string };
  temAutoavaliacao: boolean;
  gestorAvaliacao: LadoDaAvaliacao | null;
  autoavaliacao: LadoDaAvaliacao | null;
  comparativo: {
    competencias: {
      competencia: Competencia;
      gestor: number | null;
      autoavaliacao: number | null;
      diferenca: number | null;
      leitura: Leitura | null;
    }[];
    gestor: number | null;
    autoavaliacao: number | null;
    diferenca: number | null;
    alinhamento: "acima" | "alinhada" | "abaixo" | null;
  } | null;
  roteiro:
    | {
        passo:
          | "forcas_confirmadas"
          | "forcas_nao_vistas"
          | "pontos_cegos"
          | "a_desenvolver"
          | "plano";
        competencias: Competencia[];
      }[]
    | null;
  desenvolver: Competencia[];
  time: { media: number | null; competencias: Record<string, number | null> };
}

export interface AvaliacaoDaFicha {
  pesquisaId: string;
  nome: string;
  modelo: string;
  respondidaEm: string;
  gestor: string | null;
  geral: number | null;
  nivel: Nivel | null;
  autoavaliacao: number | null;
}

const id = encodeURIComponent;

export const clienteDaAvaliacao = {
  organograma: () => pedir<Organograma>("/pesquisas/avaliacoes/organograma", "GET"),
  obter: (pesquisaId: string) =>
    pedir<AvaliacaoDetalhe>(`/pesquisas/${id(pesquisaId)}/avaliacao`, "GET"),
  salvar: (
    pesquisaId: string,
    corpo: { config: Partial<ConfigAvaliacao>; times: TimeInformado[] },
  ) =>
    pedir<AvaliacaoDetalhe>(
      `/pesquisas/${id(pesquisaId)}/avaliacao`,
      "PUT",
      corpo,
    ),
  resultados: (pesquisaId: string) =>
    pedir<ResultadosDaAvaliacao>(
      `/pesquisas/${id(pesquisaId)}/avaliacao/resultados`,
      "GET",
    ),
  pessoa: (pesquisaId: string, colaboradorId: string) =>
    pedir<ResultadoDaPessoa>(
      `/pesquisas/${id(pesquisaId)}/avaliacao/pessoas/${id(colaboradorId)}`,
      "GET",
    ),
  daFicha: (colaboradorId: string) =>
    pedir<AvaliacaoDaFicha[]>(
      `/colaboradores/${id(colaboradorId)}/avaliacoes`,
      "GET",
    ),
};

export type ClienteDaAvaliacao = typeof clienteDaAvaliacao;

// ---------------------------------------------------------------------------
// Link público (sem cookie, sem CSRF)

export interface ItemPendente {
  parId: string;
  papel: "gestor" | "autoavaliacao";
  avaliado: { nome: string; cargo: string | null };
  respondida: boolean;
  aberta: boolean;
  comparativo: {
    gestor: Record<Competencia, number>;
    autoavaliacao: Record<Competencia, number>;
  } | null;
}

export interface Pendentes {
  modelo: ModeloDeAvaliacao;
  comentarios: RegraDeComentarios;
  prazo: string | null;
  prazoAutoavaliacao: string | null;
  itens: ItemPendente[];
}

export class ErroDaAvaliacaoPublica extends Error {
  constructor(
    readonly status: number,
    readonly erros: readonly { campo: string; motivo: string }[] = [],
  ) {
    super(`Avaliação recusada (${status}).`);
    this.name = "ErroDaAvaliacaoPublica";
  }
}

async function publico<T>(rota: string, corpo: unknown): Promise<T> {
  const res = await fetch(`/v1/publico/pesquisas/${rota}`, {
    method: "POST",
    credentials: "omit",
    cache: "no-store",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(corpo),
  });
  if (!res.ok) {
    const c = (await res.json().catch(() => ({}))) as { erros?: unknown };
    const erros = Array.isArray(c.erros)
      ? (c.erros as { campo: string; motivo: string }[])
      : [];
    throw new ErroDaAvaliacaoPublica(res.status, erros);
  }
  return res.json() as Promise<T>;
}

export const clientePublicoDaAvaliacao = {
  pendentes: (token: string, passe: string) =>
    publico<Pendentes>(`${id(token)}/avaliacao/pendentes`, { passe }),
  responder: (
    token: string,
    parId: string,
    corpo: {
      passe: string;
      respostas: { perguntaId: string; valor: number }[];
      comentarios: Partial<Record<Competencia, string>>;
    },
  ) =>
    publico<{ ok: true; restantes: number }>(
      `${id(token)}/avaliacao/pares/${id(parId)}`,
      corpo,
    ),
};

export type ClientePublicoDaAvaliacao = typeof clientePublicoDaAvaliacao;
