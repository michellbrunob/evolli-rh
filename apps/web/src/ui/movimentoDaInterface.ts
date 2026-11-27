/**
 * T215 — movimento global da interface, sem configurar tela por tela:
 *
 * - **Abas (todas):** qualquer `[role="tablist"]` ganha o sublinhado que
 *   desliza até a aba selecionada (o `::after` do `movimento.css`, posicionado
 *   por `--aba-x`, `--aba-largura` e `--aba-espessura`).
 * - **Entrada de conteúdo (o padrão da aba Dados):** todo bloco que aparece
 *   na área principal — o painel de uma aba, uma seção da edição, uma etapa,
 *   um formulário aberto, a página nova — sobe 4 px e aparece, em 250 ms.
 *   Ficam de fora o que é pequeno (menos de 120 px de altura), as linhas de
 *   listas e tabelas e as janelas, que têm o movimento delas.
 *
 * Nada é inserido no DOM do React: só variáveis de estilo, um atributo no
 * grupo de abas e animações pela Web Animations API. Quem pede movimento
 * reduzido não vê nada disso.
 */

const ALTURA_MINIMA = 120;
const ENTRADA: Keyframe[] = [
  { opacity: 0, transform: "translateY(4px)" },
  { opacity: 1, transform: "none" },
];
const OPCOES_DA_ENTRADA: KeyframeAnimationOptions = {
  duration: 250,
  easing: "cubic-bezier(0.22, 1, 0.36, 1)",
};

function reduzMovimento(): boolean {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Mede a aba selecionada de um grupo e publica a posição do sublinhado. */
export function medirAbas(lista: HTMLElement): void {
  const aba = lista.querySelector<HTMLElement>(
    '[role="tab"][aria-selected="true"]',
  );
  if (!aba) {
    lista.removeAttribute("data-abas-animadas");
    return;
  }
  // Primeira medida sem transição: o sublinhado não "voa" ao abrir a tela.
  // O atributo vem ANTES da medida: ele deixa a lista com `position:
  // relative`, e o `offsetLeft` da aba passa a contar a partir dela (antes,
  // contava de um ancestral e o sublinhado nascia deslocado).
  if (lista.getAttribute("data-abas-animadas") === null) {
    lista.setAttribute("data-abas-animadas", "inicial");
    window.setTimeout(
      () => lista.setAttribute("data-abas-animadas", "pronto"),
      50,
    );
  }
  lista.style.setProperty("--aba-x", `${aba.offsetLeft}px`);
  lista.style.setProperty("--aba-largura", `${aba.offsetWidth}px`);
  const espessura = parseFloat(getComputedStyle(aba).borderBottomWidth);
  if (espessura > 0) {
    lista.style.setProperty("--aba-espessura", `${espessura}px`);
  }
}

/**
 * O bloco que acabou de entrar merece a entrada suave? Só dentro da área
 * principal, fora de janelas, de listas e de tabelas, e com altura de bloco.
 */
export function deveEntrar(elemento: Element): elemento is HTMLElement {
  if (!(elemento instanceof HTMLElement)) return false;
  if (!elemento.closest("main")) return false;
  if (elemento.closest('[role="dialog"], [role="menu"], [role="listbox"]')) {
    return false;
  }
  const pai = elemento.parentElement;
  if (
    pai &&
    /^(UL|OL|TBODY|THEAD|TABLE|TR|SELECT|DATALIST)$/.test(pai.tagName)
  ) {
    return false;
  }
  return elemento.offsetHeight >= ALTURA_MINIMA;
}

/** Anima a entrada dos blocos novos (só os do topo de cada inserção). */
export function animarEntradas(adicionados: readonly Element[]): void {
  if (reduzMovimento()) return;
  const conjunto = new Set(adicionados);
  for (const elemento of adicionados) {
    // Se um ancestral também entrou agora, a animação dele já cobre este.
    let ancestral = elemento.parentElement;
    let coberto = false;
    while (ancestral) {
      if (conjunto.has(ancestral)) {
        coberto = true;
        break;
      }
      ancestral = ancestral.parentElement;
    }
    if (coberto || !deveEntrar(elemento)) continue;
    if (typeof elemento.animate === "function") {
      elemento.animate(ENTRADA, OPCOES_DA_ENTRADA);
    }
  }
}

/**
 * Liga o movimento global: mede as abas agora, depois de cada mudança na
 * árvore e quando a janela muda de tamanho; anima a entrada dos blocos
 * novos. Devolve o desligamento.
 */
export function iniciarMovimentoDaInterface(
  raiz: HTMLElement = document.body,
): () => void {
  let agendado = false;
  const medirTodas = () => {
    agendado = false;
    raiz
      .querySelectorAll<HTMLElement>('[role="tablist"]')
      .forEach((lista) => medirAbas(lista));
  };
  const agendar = () => {
    if (agendado) return;
    agendado = true;
    // `setTimeout` (e não um quadro de animação): funciona também com a
    // aba do navegador em segundo plano.
    window.setTimeout(medirTodas, 0);
  };
  medirTodas();
  const observador = new MutationObserver((registros) => {
    const adicionados: Element[] = [];
    for (const r of registros) {
      r.addedNodes.forEach((n) => {
        if (n instanceof Element) adicionados.push(n);
      });
    }
    if (adicionados.length > 0) animarEntradas(adicionados);
    agendar();
  });
  observador.observe(raiz, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["aria-selected"],
  });
  window.addEventListener("resize", agendar);
  return () => {
    observador.disconnect();
    window.removeEventListener("resize", agendar);
  };
}
