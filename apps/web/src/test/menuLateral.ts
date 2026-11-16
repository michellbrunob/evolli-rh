/**
 * T209 — o menu expandido abre com a seção Operação e o módulo Demonstração
 * fechados (para caber numa tela). Os testes que navegam pelos itens deles —
 * escritos quando tudo começava aberto — abrem os dois antes de procurar o
 * item, como a pessoa faria. O padrão fechado em si é coberto por
 * `App.menuCompleto.test.tsx`.
 *
 * No trilho recolhido nada é aberto: lá o cabeçalho de módulo expande o menu
 * inteiro, e a seção Operação já aparece em ícones.
 */
import {
  fireEvent,
  render,
  screen,
  within,
  type RenderResult,
} from "@testing-library/react";
import type { ReactElement } from "react";

const FECHADOS_POR_PADRAO = ["Operação", "Demonstração"] as const;

export function abrirSecoesFechadasDoMenu(): void {
  const menus = screen.queryAllByRole("navigation", {
    name: "Navegação do painel",
  });
  for (const menu of menus) {
    if (menu.classList.contains("painel-nav--trilho")) continue;
    for (const nome of FECHADOS_POR_PADRAO) {
      const botao = within(menu).queryByRole("button", {
        name: nome,
        expanded: false,
      });
      if (botao) fireEvent.click(botao);
    }
  }
}

/** `render` seguido da abertura de Operação e Demonstração. */
export function renderComMenuAberto(ui: ReactElement): RenderResult {
  const resultado = render(ui);
  abrirSecoesFechadasDoMenu();
  return resultado;
}
