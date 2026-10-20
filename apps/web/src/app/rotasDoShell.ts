/**
 * Rotas de URL do shell (T176) — o primeiro destino endereçável por URL.
 *
 * Até a T175 o painel não tinha rota nenhuma: destino era só estado do shell
 * (`mapaNavegacao.ts`). A decisão da proprietária sobre o `DP-FLX-21`
 * (2026-10-20) pôs o cadastro longo de admissão em **página própria**, e uma
 * página própria precisa poder ser aberta, recarregada e deixada pelo botão
 * "voltar" do navegador.
 *
 * A rota usa o fragmento (`#/...`), e não o caminho, de propósito: o fragmento
 * nunca chega ao servidor, então nenhum servidor estático precisa aprender a
 * devolver o `index.html` para um caminho novo. Não há biblioteca de rotas: uma
 * tabela fechada de destino para fragmento basta, e o que não está nela
 * continua sendo estado do shell, como antes.
 *
 * **Não é autorização.** A rota só diz qual destino montar; quem decide se o
 * papel pode abri-lo é `resolverEntrada` no `App`, com a mesma tabela de
 * capacidade de sempre, e o servidor decide cada requisição.
 */

/** Destinos com URL própria. Fechada: destino fora dela não tem rota. */
const ROTA_POR_DESTINO: Readonly<Record<string, string>> = {
  "nova-admissao": "#/pessoas/nova-admissao",
};

/** O fragmento da URL do destino, ou `null` se ele não tem rota própria. */
export function rotaDoDestino(destinoId: string): string | null {
  return ROTA_POR_DESTINO[destinoId] ?? null;
}

/** O destino que o fragmento pede, ou `null` se ele não é rota conhecida. */
export function destinoDaRota(fragmento: string): string | null {
  const entrada = Object.entries(ROTA_POR_DESTINO).find(
    ([, rota]) => rota === fragmento,
  );
  return entrada ? entrada[0] : null;
}
