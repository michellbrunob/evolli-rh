/**
 * T216 — Perfil comportamental (DISC): o contrato de
 * `GET /v1/pesquisas/:id/perfil-comportamental` e a chamada.
 */
import {
  pedir,
  type CampoGrupo,
  type DepartamentoDoResultado,
  type FatorDisc,
  type RecorteDosResultados,
} from "../../../../api/pesquisasClient";

export type Pontos = Record<FatorDisc, number>;
export type Intensidade = "puro" | "acentuado" | "moderado" | "equilibrado";
export const INTENSIDADES: readonly Intensidade[] = [
  "puro",
  "acentuado",
  "moderado",
  "equilibrado",
];

export interface ClasseDisc {
  tipo: "mono" | "bi" | "tri";
  fatores: FatorDisc[];
  codigo: string;
  intensidade: Intensidade;
}

export interface PerfilDisc {
  pontos: Pontos;
  total: number;
  percentuais: Pontos;
  predominante: FatorDisc;
  classe: ClasseDisc;
  posicao: { x: number; y: number; area: number };
}

export type FaixaDeDiversidade =
  "pouco_diverso" | "moderado" | "equilibrado" | "altamente_diverso";

export type TipoDoPar = "mesma_linguagem" | "complementar" | "pede_atencao";

export interface PessoaDisc {
  respostaId: string;
  numero: number;
  nome: string | null;
  departamento: string | null;
  respondidaEm: string;
  perfil: PerfilDisc;
}

export interface ResultadoDisc {
  pesquisaId: string;
  respostas: number;
  recortes: CampoGrupo[];
  grupos: Partial<Record<CampoGrupo, DepartamentoDoResultado[]>>;
  filtro: {
    campo: CampoGrupo | null;
    grupoId: string | null;
    respostas: number;
    visivel: boolean;
  };
  perfil: PerfilDisc | null;
  totalDePessoas: number;
  porPredominante: Pontos;
  intensidades: Record<Intensidade, number>;
  areas: { area: number; pessoas: number }[];
  diversidade: {
    score: number;
    faixa: FaixaDeDiversidade;
    ausentes: FatorDisc[];
  };
  lacunas: FatorDisc[];
  compatibilidade: {
    matriz: {
      a: FatorDisc;
      b: FatorDisc;
      relacao: "sinergia" | "neutro" | "atrito";
      tipo: TipoDoPar;
      pares: number;
    }[];
    totalDePares: number;
    porTipo: Record<TipoDoPar, { pares: number; percentual: number }>;
    maiorAtencao: { a: FatorDisc; b: FatorDisc; pares: number } | null;
  };
  pontos: { x: number; y: number; area: number; fator: FatorDisc }[];
  pessoas: PessoaDisc[];
}

export const perfilComportamental = (
  pesquisaId: string,
  recorte?: RecorteDosResultados | null,
) =>
  pedir<ResultadoDisc>(
    `/pesquisas/${encodeURIComponent(pesquisaId)}/perfil-comportamental${
      recorte
        ? `?campo=${encodeURIComponent(recorte.campo)}&grupoId=${encodeURIComponent(recorte.grupoId)}`
        : ""
    }`,
    "GET",
  );

export type CarregarPerfil = typeof perfilComportamental;
