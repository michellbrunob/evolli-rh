/**
 * T216 — Pesquisa de Clima: 60 afirmações de concordância (1 a 5) em 5
 * dimensões × 3 subdimensões × 4 afirmações, e 2 perguntas abertas.
 *
 * As perguntas são editáveis: o RH muda o texto, remove e acrescenta
 * afirmações (numa dimensão) ou perguntas de texto livre. A API confere só
 * a chave e o tipo de cada pergunta (`conferirEstruturaDoClima`).
 */
import type { ErroDeCampo } from "../../../common/erros/recusa-por-campo";
import type { Secao } from "../../pesquisas.types";

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

export type DimensaoClima = (typeof DIMENSOES_CLIMA)[number]["chave"];

const CHAVES_DAS_DIMENSOES: readonly string[] = DIMENSOES_CLIMA.map(
  (d) => d.chave,
);

const FIXAS = new Map(AFIRMACOES_CLIMA.map((a) => [a.chave, a]));

/** Afirmação acrescentada pelo RH: `clima_<dimensão>_<sufixo>`. */
const ACRESCENTADA = /^clima_([a-z]+)_[A-Za-z0-9-]+$/;

/** Pergunta aberta (as 2 do modelo e as de texto livre acrescentadas). */
export const PREFIXO_DAS_ABERTAS = "clima_aberta_";

/**
 * A dimensão (e a subdimensão, nas 60 do modelo) de uma afirmação pela
 * chave; `null` quando a chave não é de afirmação do Clima.
 */
export function afirmacaoDaChave(
  chave: string | null | undefined,
): { dimensao: string; subdimensao: string | null } | null {
  if (!chave) return null;
  const fixa = FIXAS.get(chave);
  if (fixa) return { dimensao: fixa.dimensao, subdimensao: fixa.subdimensao };
  if (chave.startsWith(PREFIXO_DAS_ABERTAS)) return null;
  const m = ACRESCENTADA.exec(chave);
  return m && CHAVES_DAS_DIMENSOES.includes(m[1]!)
    ? { dimensao: m[1]!, subdimensao: null }
    : null;
}

/** As afirmações da pesquisa, na ordem em que aparecem. */
export function afirmacoesDaPesquisa(secoes: readonly Secao[]): {
  chave: string;
  dimensao: string;
  subdimensao?: string;
}[] {
  const saida: { chave: string; dimensao: string; subdimensao?: string }[] = [];
  for (const s of secoes) {
    for (const p of s.perguntas) {
      const a = p.tipo === "concordancia" ? afirmacaoDaChave(p.chave) : null;
      if (!a) continue;
      saida.push({
        chave: p.chave!,
        dimensao: a.dimensao,
        ...(a.subdimensao ? { subdimensao: a.subdimensao } : {}),
      });
    }
  }
  return saida;
}

/**
 * Perguntas editáveis: cada pergunta tem uma chave do Clima, uma vez só,
 * com o tipo dela (afirmação → concordância de 1 a 5; aberta → texto
 * livre), e há pelo menos uma afirmação. Erro único em `secoes`.
 */
export function conferirEstruturaDoClima(
  secoes: readonly Secao[],
): ErroDeCampo[] {
  const recusa: ErroDeCampo[] = [
    { campo: "secoes", motivo: "estrutura_do_modelo" },
  ];
  const vistas = new Set<string>();
  let afirmacoes = 0;
  for (const s of secoes) {
    for (const p of s.perguntas) {
      const chave = p.chave ?? null;
      if (!chave || vistas.has(chave)) return recusa;
      vistas.add(chave);
      if (chave.startsWith(PREFIXO_DAS_ABERTAS)) {
        if (p.tipo !== "paragrafo") return recusa;
      } else if (afirmacaoDaChave(chave)) {
        if (p.tipo !== "concordancia") return recusa;
        afirmacoes += 1;
      } else {
        return recusa;
      }
    }
  }
  return afirmacoes > 0 ? [] : recusa;
}
