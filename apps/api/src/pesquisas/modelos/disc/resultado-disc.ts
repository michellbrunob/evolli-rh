import { gruposDoCampo } from "../../calculo-resultados";
import type {
  CampoGrupo,
  DepartamentoDoResultado,
  GruposDaResposta,
  Secao,
  ValorRespondido,
} from "../../pesquisas.types";
import {
  type PerfilDisc,
  type ResumoDoTime,
  perfilDe,
  pontosDosValores,
  resumoDoTime,
} from "./calculo-disc";

/**
 * T216 — `GET /pesquisas/:id/perfil-comportamental`: o resultado do modelo
 * DISC (time e, quando permitido, cada pessoa). Função pura.
 *
 * Recorte por grupo com as mesmas regras dos resultados (mínimo por grupo e
 * proteção do grupo menor); na confidencial, a visão geral também exige o
 * mínimo. As pessoas (perfil de cada resposta) só saem para RH e DP, na
 * identificada (com o nome) e na anônima (numeradas); nunca na confidencial.
 */

export interface RespostaDisc {
  id: string;
  respondidaEm: Date;
  valores: readonly ValorRespondido[];
  grupos: GruposDaResposta;
  /** Nome — só na identificada (e para quem pode ver). */
  autor: string | null;
  departamento: string | null;
}

export interface PessoaDisc {
  respostaId: string;
  /** Ordem de chegada (#1 = a primeira). */
  numero: number;
  nome: string | null;
  departamento: string | null;
  respondidaEm: string;
  perfil: PerfilDisc;
}

export interface ResultadoDisc extends ResumoDoTime {
  pesquisaId: string;
  /** Todas as respostas da pesquisa. */
  respostas: number;
  recortes: CampoGrupo[];
  grupos: Partial<Record<CampoGrupo, DepartamentoDoResultado[]>>;
  filtro: {
    campo: CampoGrupo | null;
    grupoId: string | null;
    /** Respostas do recorte (sem filtro, o total). */
    respostas: number;
    visivel: boolean;
  };
  /** Cada ponto do mapa de talentos (sem a pessoa). */
  pontos: {
    x: number;
    y: number;
    area: number;
    fator: PerfilDisc["predominante"];
  }[];
  /** Vazio na confidencial e para quem não lê respostas individuais. */
  pessoas: PessoaDisc[];
}

export interface EntradaDoResultadoDisc {
  pesquisaId: string;
  secoes: readonly Secao[];
  respostas: readonly RespostaDisc[];
  nomesDosGrupos: ReadonlyMap<string, string>;
  minimoPorGrupo: number;
  filtro: { campo: CampoGrupo; grupoId: string } | null;
  recortes: readonly CampoGrupo[];
  minimoNaVisaoGeral: boolean;
  /** RH e DP, na identificada e na anônima. */
  comPessoas: boolean;
}

export function montarResultadoDisc(e: EntradaDoResultadoDisc): ResultadoDisc {
  const grupos: ResultadoDisc["grupos"] = {};
  for (const campo of e.recortes) {
    grupos[campo] = gruposDoCampo(
      campo,
      e.respostas,
      e.nomesDosGrupos,
      e.minimoPorGrupo,
    );
  }
  const f = e.filtro;
  const recorteValido = f === null || e.recortes.includes(f.campo);
  const numeradas = e.respostas.map((r, i) => ({ r, numero: i + 1 }));
  const filtradas = f
    ? numeradas.filter(({ r }) => r.grupos[f.campo] === f.grupoId)
    : numeradas;
  const visivel =
    f === null
      ? !e.minimoNaVisaoGeral || filtradas.length >= e.minimoPorGrupo
      : recorteValido &&
        (grupos[f.campo] ?? []).some((g) => g.id === f.grupoId && g.visivel);

  const perfis = visivel
    ? filtradas
        .map(({ r, numero }) => ({
          r,
          numero,
          perfil: perfilDe(pontosDosValores(e.secoes, r.valores)),
        }))
        // Sem bloco respondido não há perfil (resposta antiga ou vazia).
        .filter((x) => x.perfil.total > 0)
    : [];
  const resumo = resumoDoTime(perfis.map((p) => p.perfil));
  return {
    pesquisaId: e.pesquisaId,
    respostas: e.respostas.length,
    recortes: [...e.recortes],
    grupos,
    filtro: {
      campo: f?.campo ?? null,
      grupoId: f?.grupoId ?? null,
      respostas: recorteValido ? filtradas.length : 0,
      visivel,
    },
    ...resumo,
    // Ordenados pela posição: a ordem de chegada não sai junto.
    pontos: perfis
      .map(({ perfil }) => ({
        x: perfil.posicao.x,
        y: perfil.posicao.y,
        area: perfil.posicao.area,
        fator: perfil.predominante,
      }))
      .sort((a, b) => a.x - b.x || a.y - b.y),
    pessoas: e.comPessoas
      ? perfis.map(({ r, numero, perfil }) => ({
          respostaId: r.id,
          numero,
          nome: r.autor,
          departamento: r.autor === null ? null : r.departamento,
          respondidaEm: r.respondidaEm.toISOString(),
          perfil,
        }))
      : [],
  };
}
