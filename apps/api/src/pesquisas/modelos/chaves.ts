import type { Secao, ValorRespondido } from "../pesquisas.types";

/**
 * T216 — os valores de uma resposta pela chave do item do modelo (Q1, Q2…),
 * para os cálculos que trabalham com a chave. Nas perguntas de escolha, a
 * opção marcada vira o id do modelo pela POSIÇÃO (`opcoesPorChave`): os ids
 * gravados são gerados pela tela, a ordem é a da metodologia. Função pura.
 */
export function respostaPorChave(
  secoes: readonly Secao[],
  valores: ReadonlyMap<string, unknown>,
  opcoesPorChave: Readonly<Record<string, readonly string[]>> = {},
): ValorRespondido[] {
  const saida: ValorRespondido[] = [];
  for (const s of secoes) {
    for (const p of s.perguntas) {
      if (!p.chave || !valores.has(p.id)) continue;
      const bruto = valores.get(p.id);
      const ids = opcoesPorChave[p.chave];
      if (!ids) {
        saida.push({ perguntaId: p.chave, valor: bruto });
        continue;
      }
      const doModelo = (id: unknown) => {
        const i = (p.config.opcoes ?? []).findIndex((o) => o.id === id);
        return i >= 0 ? ids[i] : undefined;
      };
      if (bruto && typeof bruto === "object" && "opcao" in bruto) {
        const v = doModelo((bruto as { opcao: unknown }).opcao);
        if (v) saida.push({ perguntaId: p.chave, valor: { opcao: v } });
      } else if (
        bruto &&
        typeof bruto === "object" &&
        Array.isArray((bruto as { opcoes?: unknown }).opcoes)
      ) {
        const marcadas = (bruto as { opcoes: unknown[] }).opcoes
          .map(doModelo)
          .filter((v): v is string => v !== undefined);
        saida.push({ perguntaId: p.chave, valor: { opcoes: marcadas } });
      }
    }
  }
  return saida;
}
