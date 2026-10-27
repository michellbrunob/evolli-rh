/**
 * Rotas de URL do shell (T176, ampliada na T178) — os destinos endereçáveis
 * por URL.
 *
 * Até a T175 o painel não tinha rota nenhuma: destino era só estado do shell
 * (`mapaNavegacao.ts`). A decisão da proprietária sobre o `DP-FLX-21`
 * (2026-10-20) pôs o cadastro longo de admissão em **página própria**, e uma
 * página própria precisa poder ser aberta, recarregada e deixada pelo botão
 * "voltar" do navegador.
 *
 * T178 — a listagem de Colaboradores virou a porta principal de Gestão de
 * Pessoas e ganhou rota também (`#/pessoas/colaboradores`). Sem ela, a Nova
 * admissão era a única página com endereço: recarregar a listagem caía na
 * escolha do Hub, e sair da Nova admissão devolvia a uma URL sem rota. Com as
 * duas, ir da listagem à admissão empilha um endereço, e voltar, cancelar ou
 * concluir devolve à listagem pelo endereço dela.
 *
 * **Limitação conhecida:** a rota abre a área de Pessoas na aba
 * Colaboradores. As demais abas internas de `PessoasScreen` (horário,
 * histórico funcional, dados contratuais...) continuam sendo estado local,
 * sem URL — recarregar numa delas volta à aba Colaboradores.
 *
 * A rota usa o fragmento (`#/...`), e não o caminho, de propósito: o fragmento
 * nunca chega ao servidor, então nenhum servidor estático precisa aprender a
 * devolver o `index.html` para um caminho novo. Não há biblioteca de rotas: uma
 * tabela fechada de destino para fragmento basta, e o que não está nela
 * continua sendo estado do shell, como antes.
 *
 * Só fragmentos que começam com `#/` pertencem às rotas. Os demais
 * (`#conteudo-principal`, do link "Pular para o conteúdo") são âncoras da
 * página e não trocam de destino — ver `ehFragmentoDeRota`.
 *
 * **Não é autorização.** A rota só diz qual destino montar; quem decide se o
 * papel pode abri-lo é `resolverEntrada` no `App`, com a mesma tabela de
 * capacidade de sempre, e o servidor decide cada requisição.
 */

/** Destinos com URL própria. Fechada: destino fora dela não tem rota. */
const ROTA_POR_DESTINO: Readonly<Record<string, string>> = {
  // T178 — o id segue `pessoas` (o contêiner, aberto na aba Colaboradores).
  pessoas: "#/pessoas/colaboradores",
  "nova-admissao": "#/pessoas/nova-admissao",
  // T182 — tela própria do catálogo de jornadas: recarregar volta a ela.
  "jornadas-trabalho": "#/estrutura/jornadas-trabalho",
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

/**
 * T178 — o fragmento pertence ao espaço de rotas? Vazio também conta: é a URL
 * sem rota, para onde o "voltar" pode levar.
 *
 * Um fragmento comum (`#conteudo-principal`) é âncora dentro da página: o
 * navegador o põe na URL e dispara `hashchange`, mas ninguém pediu outro
 * destino. Tratá-lo como "URL sem rota" faria o link "Pular para o conteúdo"
 * tirar a pessoa da tela — e, com Colaboradores roteada, isso aconteceria na
 * tela mais usada do produto.
 */
export function ehFragmentoDeRota(fragmento: string): boolean {
  return fragmento === "" || fragmento === "#" || fragmento.startsWith("#/");
}

/**
 * T189 — para onde o shell volta depois de uma troca de empresa: o MESMO
 * módulo, na tela inicial segura dele.
 *
 * A troca recria a árvore inteira (T163), então a tela inicial do módulo já
 * vem limpa — sem busca, filtro, seleção nem ficha. O que sobra decidir é o
 * destino em si, e só uma página precisa ser reduzida: a Nova admissão é um
 * formulário dentro de Pessoas, e reabri-lo na empresa nova seria começar
 * um cadastro que ninguém pediu. Ela volta para a listagem de Colaboradores,
 * o nível do módulo.
 *
 * Não é autorização: o `App` ainda passa o destino por `resolverEntrada`, e
 * papel que não o abre cai no destino inicial dele.
 */
const DESTINO_SEGURO_APOS_TROCA: Readonly<Record<string, string>> = {
  "nova-admissao": "pessoas",
};

export function destinoAposTrocaDeEmpresa(
  destinoId: string | null,
): string | null {
  if (destinoId === null) return null;
  return DESTINO_SEGURO_APOS_TROCA[destinoId] ?? destinoId;
}
