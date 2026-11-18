import { act, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TelaDeAbertura } from "./TelaDeAbertura";
import { carregarAnimacaoOficial } from "./animacaoOficial";
import type { DadosDaAnimacao } from "./AnimacaoLottie";

// O player do Lottie é simulado: o teste afirma COMO ele é chamado (SVG,
// autoplay, quadro parado, destruição), não desenha nada.
const animacao = {
  totalFrames: 60,
  destroy: vi.fn(),
  goToAndStop: vi.fn(),
};
const loadAnimation = vi.fn((_opcoes: Record<string, unknown>) => animacao);
vi.mock("lottie-web/build/player/lottie_light", () => ({
  default: { loadAnimation: (o: Record<string, unknown>) => loadAnimation(o) },
}));

/** JSON sintético, mínimo, só para o teste (nenhuma animação real). */
const DADOS_SINTETICOS: DadosDaAnimacao = {
  v: "5.12.0",
  fr: 30,
  ip: 0,
  op: 60,
  w: 64,
  h: 64,
  layers: [],
};

const comMovimentoReduzido = (reduzido: boolean) => {
  const original = window.matchMedia;
  window.matchMedia = ((consulta: string) => {
    if (!consulta.includes("prefers-reduced-motion")) return original(consulta);
    return {
      matches: reduzido,
      media: consulta,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    } as unknown as MediaQueryList;
  }) as typeof window.matchMedia;
  return () => {
    window.matchMedia = original;
  };
};

let restaurar: () => void = () => undefined;

beforeEach(() => {
  loadAnimation.mockClear();
  animacao.destroy.mockClear();
  animacao.goToAndStop.mockClear();
});
afterEach(() => {
  restaurar();
  restaurar = () => undefined;
});

describe("T209 — TelaDeAbertura", () => {
  it("sem animação oficial aprovada: só a marca do Evolli, sem carregar o Lottie", async () => {
    expect(carregarAnimacaoOficial).toBeNull();
    render(<TelaDeAbertura mensagem="Verificando sessão…" />);
    expect(screen.getByRole("status")).toHaveTextContent("Verificando sessão…");
    const marca = document.querySelector(".tela-abertura__marca")!;
    expect(marca).toHaveAttribute("aria-hidden", "true");
    // T210 — a assinatura vertical oficial (arquivo local), decorativa.
    const img = marca.querySelector("img")!;
    expect(img).toHaveAttribute("alt", "");
    expect(img.getAttribute("src")).toMatch(/evolli-vertical\.svg$/);
    expect(document.querySelector(".tela-abertura__lottie")).toBeNull();
    await act(async () => undefined);
    expect(loadAnimation).not.toHaveBeenCalled();
  });

  it("T210 — o nome vem na assinatura (sem texto 'Evolli RH'), mensagem como status e nada focável", () => {
    render(<TelaDeAbertura mensagem="Carregando seu acesso…" />);
    expect(document.querySelector(".tela-abertura__nome")).toBeNull();
    expect(document.body.textContent).not.toContain("Evolli RH");
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(
      document.querySelectorAll(
        ".tela-abertura button, .tela-abertura a, .tela-abertura [tabindex]",
      ),
    ).toHaveLength(0);
  });

  it("com a animação conectada: desenha em SVG, em laço, e a marca sai quando ela aparece", async () => {
    restaurar = comMovimentoReduzido(false);
    const carregar = vi.fn(async () => ({ default: DADOS_SINTETICOS }));
    render(
      <TelaDeAbertura
        mensagem="Carregando seu acesso…"
        carregarAnimacao={carregar}
      />,
    );
    // Até a animação chegar, a marca estática é a reserva.
    expect(
      document.querySelector(".tela-abertura__marca-estatica"),
    ).not.toBeNull();
    await waitFor(() => expect(loadAnimation).toHaveBeenCalledTimes(1));
    const opcoes = loadAnimation.mock.calls[0]![0];
    expect(opcoes).toMatchObject({
      renderer: "svg",
      loop: true,
      autoplay: true,
      animationData: DADOS_SINTETICOS,
    });
    expect(opcoes.container).toBe(
      document.querySelector(".tela-abertura__lottie"),
    );
    await waitFor(() =>
      expect(
        document.querySelector(".tela-abertura__marca-estatica"),
      ).toBeNull(),
    );
    expect(animacao.goToAndStop).not.toHaveBeenCalled();
  });

  it("movimento reduzido: a animação não toca e fica parada no último quadro", async () => {
    restaurar = comMovimentoReduzido(true);
    render(
      <TelaDeAbertura
        mensagem="Carregando seu acesso…"
        carregarAnimacao={async () => DADOS_SINTETICOS}
      />,
    );
    expect(document.querySelector(".tela-abertura")).toHaveAttribute(
      "data-movimento",
      "reduzido",
    );
    await waitFor(() => expect(loadAnimation).toHaveBeenCalledTimes(1));
    expect(loadAnimation.mock.calls[0]![0]).toMatchObject({
      loop: false,
      autoplay: false,
    });
    expect(animacao.goToAndStop).toHaveBeenCalledWith(59, true);
  });

  it("ao sair da tela, a animação é destruída", async () => {
    restaurar = comMovimentoReduzido(false);
    const { unmount } = render(
      <TelaDeAbertura
        mensagem="Carregando seu acesso…"
        carregarAnimacao={async () => DADOS_SINTETICOS}
      />,
    );
    await waitFor(() => expect(loadAnimation).toHaveBeenCalledTimes(1));
    unmount();
    expect(animacao.destroy).toHaveBeenCalledTimes(1);
  });

  it("se o JSON não carregar, a marca estática fica e nada de erro aparece", async () => {
    restaurar = comMovimentoReduzido(false);
    render(
      <TelaDeAbertura
        mensagem="Carregando seu acesso…"
        carregarAnimacao={() => Promise.reject(new Error("sem arquivo"))}
      />,
    );
    await act(async () => undefined);
    expect(loadAnimation).not.toHaveBeenCalled();
    expect(
      document.querySelector(".tela-abertura__marca-estatica"),
    ).not.toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("T209 — contrato de CSS da abertura", () => {
  const css = readFileSync(
    "src/app/abertura/TelaDeAbertura.css",
    "utf8",
  ).replace(/\r\n/g, "\n");

  it("só tokens: sem hexadecimal, sem rgb/hsl, sem sombra nem gradiente", () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(css).not.toMatch(/\brgba?\(|\bhsla?\(/);
    expect(css.replace(/\/\*[\s\S]*?\*\//g, "")).not.toMatch(
      /box-shadow|gradient/,
    );
  });

  it("transição curta de entrada e nenhuma com movimento reduzido", () => {
    expect(css).toMatch(
      /\.tela-abertura__marca \{[^}]*animation: tela-abertura-entra 320ms/,
    );
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\) \{[^@]*\.tela-abertura__marca \{\s*animation: none;/,
    );
  });

  it("tela inteira, também no celular (svh), sem largura fixa que alargue a página", () => {
    expect(css).toMatch(/\.tela-abertura \{[^}]*min-height: 100svh;/);
    expect(css).not.toMatch(/\bwidth: \d{3,}px/);
  });
});
