/**
 * T216 — Perfil comportamental (DISC): o resultado que a própria pessoa vê
 * logo depois de enviar (página pública), calculado no navegador com a
 * mesma regra da API: 1 ponto por bloco no fator da frase escolhida,
 * percentual `round(pontos ÷ blocos respondidos × 100)` e o predominante
 * pelo maior número de pontos (empate: D, I, S, C). Nada é gravado.
 */
import type { Secao } from "../../../../api/pesquisaPublicaClient";
import { FATORES, type FatorDisc } from "./fatores";
import type { Pontos } from "./tiposDisc";

export interface PerfilLocal {
  readonly pontos: Pontos;
  readonly total: number;
  readonly percentuais: Pontos;
  readonly predominante: FatorDisc;
}

/** `escolhas`: id do bloco → id da frase escolhida. */
export function perfilDasEscolhas(
  secoes: readonly Secao[],
  escolhas: Readonly<Record<string, unknown>>,
): PerfilLocal | null {
  const pontos: Pontos = { D: 0, I: 0, S: 0, C: 0 };
  for (const p of secoes.flatMap((s) => s.perguntas)) {
    if (p.tipo !== "escolha_forcada") continue;
    const id = escolhas[p.id];
    const frase = p.config.opcoes?.find((o) => o.id === id);
    if (frase?.fator) pontos[frase.fator] += 1;
  }
  const total = FATORES.reduce((t, f) => t + pontos[f], 0);
  if (total === 0) return null;
  const percentuais: Pontos = { D: 0, I: 0, S: 0, C: 0 };
  for (const f of FATORES) {
    percentuais[f] = Math.round((pontos[f] / total) * 100);
  }
  const predominante = [...FATORES].sort(
    (a, b) => pontos[b] - pontos[a] || FATORES.indexOf(a) - FATORES.indexOf(b),
  )[0]!;
  return { pontos, total, percentuais, predominante };
}
