/**
 * T215 — movimento da interface: animações sutis e curtas, desligadas para
 * quem pede movimento reduzido. Aqui, o comportamento dos componentes (a
 * classe e os dados que disparam cada animação) e a garantia do CSS.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AvisoAnimado, Esqueleto, NumeroSuave, Revelar } from "./movimento";
import { animarEntradas, deveEntrar, medirAbas } from "./movimentoDaInterface";

const CSS = readFileSync(join(__dirname, "movimento.css"), "utf8");
const TOKENS = readFileSync(join(__dirname, "..", "app", "tokens.css"), "utf8");

describe("T215 — movimento: tokens e CSS", () => {
  it("os tempos e a curva vêm de tokens", () => {
    for (const token of [
      "--movimento-curva-suave: cubic-bezier(0.22, 1, 0.36, 1)",
      "--movimento-abrir: 250ms",
      "--movimento-fechar: 150ms",
      "--movimento-dica: 150ms",
      "--movimento-numero: 450ms",
      "--movimento-revelar: 400ms",
    ]) {
      expect(TOKENS).toContain(token);
    }
  });

  it("quem pede movimento reduzido não vê animação nem transição", () => {
    const bloco = CSS.slice(
      CSS.indexOf("@media (prefers-reduced-motion: reduce)"),
    );
    expect(bloco).toContain("animation: none !important");
    expect(bloco).toContain("transition: none !important");
  });

  it("campo inválido treme uma vez, só com tokens", () => {
    expect(CSS).toMatch(
      /\[aria-invalid="true"\][^{]*\{[^}]*animation: ev-tremer/,
    );
    expect(CSS).not.toMatch(/#[0-9a-f]{3,6}\b|rgb\(/i);
  });
});

describe("T215 — NumeroSuave", () => {
  it("o primeiro valor aparece parado; a troca anima, para cima ou para baixo", () => {
    const { rerender } = render(<NumeroSuave valor={10} />);
    const numero = () => screen.getByText(/^\d+$/);
    expect(numero()).not.toHaveClass("ev-numero--mudou");
    rerender(<NumeroSuave valor={12} />);
    expect(numero()).toHaveTextContent("12");
    expect(numero()).toHaveClass("ev-numero--mudou");
    expect(numero()).toHaveAttribute("data-direcao", "sobe");
    rerender(<NumeroSuave valor={7} />);
    expect(numero()).toHaveAttribute("data-direcao", "desce");
  });

  it("formata o valor com a função dada", () => {
    render(<NumeroSuave valor={1621} formatar={(v) => `R$ ${v}`} />);
    expect(screen.getByText("R$ 1621")).toBeInTheDocument();
  });
});

describe("T215 — Esqueleto, Revelar e AvisoAnimado", () => {
  it("esqueleto: status ocupado, texto para leitor de tela e as linhas", () => {
    render(<Esqueleto rotulo="Carregando salários…" linhas={3} atrasoMs={0} />);
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(status).toHaveTextContent("Carregando salários…");
    expect(status.querySelectorAll(".ev-esqueleto__linha")).toHaveLength(3);
  });

  it("revelar: envolve o conteúdo na classe que o faz surgir", () => {
    render(
      <Revelar>
        <p>conteúdo</p>
      </Revelar>,
    );
    expect(screen.getByText("conteúdo").parentElement).toHaveClass(
      "ev-revelar",
    );
  });

  it("aviso: anuncia a mensagem; sucesso traz o ✓ desenhado; vazio não ocupa lugar", () => {
    const { rerender } = render(<AvisoAnimado mensagem="" />);
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    rerender(<AvisoAnimado mensagem="Ausência registrada." tipo="sucesso" />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Ausência registrada.");
    expect(status.querySelector(".ev-aviso")).toHaveClass("ev-aviso--sucesso");
    expect(status.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});

describe("T215 — movimento de todas as abas", () => {
  function grupo() {
    document.body.innerHTML = `
      <div role="tablist" aria-label="Seções">
        <button role="tab" id="a1" aria-selected="true" aria-controls="p1">Um</button>
        <button role="tab" id="a2" aria-selected="false" aria-controls="p2">Dois</button>
      </div>
      <section id="p1" role="tabpanel"></section>
      <section id="p2" role="tabpanel"></section>`;
    const lista = document.querySelector<HTMLElement>("[role=tablist]")!;
    const [um, dois] = [...lista.querySelectorAll<HTMLElement>("[role=tab]")];
    Object.defineProperty(um, "offsetLeft", { configurable: true, value: 0 });
    Object.defineProperty(um, "offsetWidth", { configurable: true, value: 40 });
    Object.defineProperty(dois, "offsetLeft", {
      configurable: true,
      value: 64,
    });
    Object.defineProperty(dois, "offsetWidth", {
      configurable: true,
      value: 52,
    });
    return { lista, um: um!, dois: dois! };
  }

  it("qualquer grupo de abas ganha o sublinhado na aba selecionada", () => {
    const { lista } = grupo();
    medirAbas(lista);
    expect(lista).toHaveAttribute("data-abas-animadas");
    expect(lista.style.getPropertyValue("--aba-x")).toBe("0px");
    expect(lista.style.getPropertyValue("--aba-largura")).toBe("40px");
  });

  it("mede a aba já com a lista posicionada (o x conta a partir dela)", () => {
    const { lista, um } = grupo();
    // O offsetLeft só é relativo à lista quando ela já tem o atributo que
    // a deixa com position: relative.
    Object.defineProperty(um, "offsetLeft", {
      configurable: true,
      get: () => (lista.hasAttribute("data-abas-animadas") ? 0 : 312),
    });
    medirAbas(lista);
    expect(lista.style.getPropertyValue("--aba-x")).toBe("0px");
  });

  it("trocar de aba move o sublinhado", () => {
    const { lista, um, dois } = grupo();
    medirAbas(lista);
    um.setAttribute("aria-selected", "false");
    dois.setAttribute("aria-selected", "true");
    medirAbas(lista);
    expect(lista.style.getPropertyValue("--aba-x")).toBe("64px");
    expect(lista.style.getPropertyValue("--aba-largura")).toBe("52px");
  });

  it("o CSS desenha o sublinhado e apaga o fixo de cada tela", () => {
    expect(CSS).toContain('[role="tablist"][data-abas-animadas]::after');
    const regra = CSS.slice(
      CSS.indexOf(
        '[role="tablist"][data-abas-animadas] [role="tab"][aria-selected="true"]',
      ),
    );
    expect(regra).toMatch(/^[^{]+\{\s*border-bottom-color: transparent;/);
  });
});

describe("T215 — entrada suave do conteúdo (o padrão da aba Dados)", () => {
  function bloco(html: string, altura = 300) {
    document.body.innerHTML = html;
    const alvo = document.querySelector<HTMLElement>("[data-alvo]")!;
    Object.defineProperty(alvo, "offsetHeight", {
      configurable: true,
      value: altura,
    });
    return alvo;
  }

  it("bloco grande na área principal entra; pequeno, fora dela, em janela ou linha de lista, não", () => {
    expect(
      deveEntrar(bloco("<main><section data-alvo></section></main>")),
    ).toBe(true);
    expect(
      deveEntrar(bloco("<main><section data-alvo></section></main>", 40)),
    ).toBe(false);
    expect(deveEntrar(bloco("<div><section data-alvo></section></div>"))).toBe(
      false,
    );
    expect(
      deveEntrar(
        bloco('<main><div role="dialog"><form data-alvo></form></div></main>'),
      ),
    ).toBe(false);
    expect(deveEntrar(bloco("<main><ul><li data-alvo></li></ul></main>"))).toBe(
      false,
    );
  });

  it("anima só o bloco do topo de cada inserção", () => {
    const alvo = bloco(
      "<main><section data-alvo><div id=filho></div></section></main>",
    );
    const filho = document.getElementById("filho")!;
    const animarAlvo = vi.fn();
    const animarFilho = vi.fn();
    alvo.animate = animarAlvo as unknown as typeof alvo.animate;
    filho.animate = animarFilho as unknown as typeof filho.animate;
    animarEntradas([alvo, filho]);
    expect(animarAlvo).toHaveBeenCalledTimes(1);
    expect(animarFilho).not.toHaveBeenCalled();
  });
});
