import "@testing-library/jest-dom/vitest";
import { instalarMatchMedia } from "./viewport";
import { definirDuracaoMinimaDaAbertura } from "../app/abertura/duracaoDaAbertura";

// O jsdom não tem `matchMedia`, e o shell precisa dele para saber se está no
// modo gaveta (T159, R1). Instalado uma vez por ambiente; a largura começa no
// padrão do jsdom (desktop) e só muda por `definirLarguraDaJanela`.
instalarMatchMedia();

// T209 — o Radix (menu, diálogo, painel lateral, tooltip) usa APIs que o
// jsdom não tem: `ResizeObserver` (posicionamento), `PointerEvent` (abrir o
// menu no ponteiro), captura de ponteiro e `scrollIntoView`. Substitutos
// mínimos, só no ambiente de teste.
if (!("ResizeObserver" in globalThis)) {
  class ResizeObserverDeTeste {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Object.assign(globalThis, { ResizeObserver: ResizeObserverDeTeste });
}
if (!("PointerEvent" in globalThis)) {
  class PointerEventDeTeste extends MouseEvent {
    readonly pointerId: number;
    readonly pointerType: string;
    constructor(tipo: string, init: PointerEventInit = {}) {
      super(tipo, init);
      this.pointerId = init.pointerId ?? 1;
      this.pointerType = init.pointerType ?? "mouse";
    }
  }
  Object.assign(globalThis, { PointerEvent: PointerEventDeTeste });
}
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

// T209 — as suítes do shell rodam sem a duração mínima da tela de abertura
// (ela só evita o piscar no navegador); as da abertura a religam.
definirDuracaoMinimaDaAbertura(0);
