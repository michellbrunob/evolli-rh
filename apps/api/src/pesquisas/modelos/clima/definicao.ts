/**
 * T216 — Pesquisa de Clima: 60 afirmações de concordância (1 a 5) em 5
 * dimensões × 3 subdimensões × 4 afirmações, e 2 perguntas abertas.
 * Metodologia fixa: a API confere os itens.
 */
import type { EstruturaFixa, ItemFixo } from "../tipos";

export const DIMENSOES_CLIMA = [
  {
    chave: "credibilidade",
    rotulo: "Credibilidade",
    subdimensoes: [
      { chave: "comunicacao", rotulo: "Comunicação" },
      { chave: "competencia", rotulo: "Competência" },
      { chave: "integridade", rotulo: "Integridade" },
    ],
  },
  {
    chave: "respeito",
    rotulo: "Respeito",
    subdimensoes: [
      { chave: "apoio", rotulo: "Apoio" },
      { chave: "colaboracao", rotulo: "Colaboração" },
      { chave: "cuidado", rotulo: "Cuidado" },
    ],
  },
  {
    chave: "imparcialidade",
    rotulo: "Imparcialidade",
    subdimensoes: [
      { chave: "equidade", rotulo: "Equidade" },
      { chave: "imparcialidade", rotulo: "Imparcialidade" },
      { chave: "justica", rotulo: "Justiça" },
    ],
  },
  {
    chave: "orgulho",
    rotulo: "Orgulho",
    subdimensoes: [
      { chave: "trabalho", rotulo: "Trabalho" },
      { chave: "time", rotulo: "Time" },
      { chave: "empresa", rotulo: "Empresa" },
    ],
  },
  {
    chave: "camaradagem",
    rotulo: "Camaradagem",
    subdimensoes: [
      { chave: "proximidade", rotulo: "Proximidade" },
      { chave: "acolhimento", rotulo: "Acolhimento" },
      { chave: "comunidade", rotulo: "Comunidade" },
    ],
  },
] as const;

const doisDigitos = (n: number) => String(n).padStart(2, "0");

/**
 * As 60 afirmações, na ordem: `clima_01` a `clima_60`, 4 por subdimensão,
 * subdimensões na ordem de cada dimensão.
 */
export const AFIRMACOES_CLIMA: readonly {
  chave: string;
  dimensao: string;
  subdimensao: string;
}[] = DIMENSOES_CLIMA.flatMap((d, i) =>
  d.subdimensoes.flatMap((s, j) =>
    [1, 2, 3, 4].map((k) => ({
      chave: `clima_${doisDigitos(i * 12 + j * 4 + k)}`,
      dimensao: d.chave,
      subdimensao: s.chave,
    })),
  ),
);

export const ABERTAS_CLIMA = ["clima_aberta_01", "clima_aberta_02"] as const;

export const ESTRUTURA_CLIMA: EstruturaFixa = {
  itens: AFIRMACOES_CLIMA.map((a): ItemFixo => ({
    chave: a.chave,
    tipo: "concordancia",
  })),
  opcionais: ABERTAS_CLIMA.map((chave): ItemFixo => ({
    chave,
    tipo: "paragrafo",
  })),
};
