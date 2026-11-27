import { within } from "@testing-library/react";

/**
 * Localizador rápido de campo pelo texto do rótulo, para os testes de telas
 * grandes (Nova admissão, contexto empresarial).
 *
 * Por quê: nessas telas, com as quatro etapas montadas e listas longas, cada
 * `getByLabelText` custa ~140 ms no jsdom (ele varre todos os rótulos e todos
 * os `aria-labelledby` do documento a cada chamada). Um teste faz dezenas de
 * buscas; com a bateria em paralelo, isso estourava o tempo limite.
 *
 * Como: procura só os `<label>` cujo texto (espaços normalizados) casa com o
 * padrão e segue a associação real (`label.control`). Se não houver
 * exatamente um campo assim — rótulo por `aria-labelledby`, nenhum ou vários
 * —, cai no `getByLabelText` da Testing Library, com a mesma semântica e as
 * mesmas mensagens de erro. A associação rótulo → campo continua testada.
 */
export function campoPeloRotulo(
  rotulo: RegExp,
  raiz: HTMLElement = document.body,
): HTMLElement {
  const achados = new Set<HTMLElement>();
  for (const label of raiz.querySelectorAll("label")) {
    const texto = (label.textContent ?? "").replace(/\s+/g, " ").trim();
    if (!rotulo.test(texto)) continue;
    const campo = label.control;
    if (campo instanceof HTMLElement) achados.add(campo);
  }
  if (achados.size === 1) return [...achados][0]!;
  return within(raiz).getByLabelText(rotulo);
}
