/**
 * T216 — volta a página ao topo (troca de etapa do assistente, tela final):
 * a pessoa recomeça a leitura pelo título, não no meio da etapa nova.
 */
export function voltarAoTopo(): void {
  const raiz = document.scrollingElement ?? document.documentElement;
  if (typeof raiz.scrollTo === "function") raiz.scrollTo({ top: 0 });
  else raiz.scrollTop = 0;
}
