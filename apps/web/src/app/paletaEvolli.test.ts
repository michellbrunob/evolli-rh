/**
 * T207 (P-1) — paleta Evolli: contraste por par de cores e o escopo da
 * aplicação (menu lateral, Dashboard e seletor de empresa).
 *
 * O contraste é calculado aqui, a partir dos valores declarados em
 * `tokens.css`, pela fórmula de luminância relativa do WCAG 2.x: se alguém
 * trocar um tom por outro que não passa, o teste quebra antes da tela.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const tokens = readFileSync("src/app/tokens.css", "utf8");

function token(nome: string): string {
  const achado = new RegExp(`--${nome}:\\s*(#[0-9a-fA-F]{6})`).exec(tokens);
  if (!achado) throw new Error(`token --${nome} não existe`);
  return achado[1]!;
}

function luminancia(hex: string): number {
  const canal = (i: number) => {
    const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(0) + 0.7152 * canal(1) + 0.0722 * canal(2);
}

function contraste(a: string, b: string): number {
  const [claro, escuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro! + 0.05) / (escuro! + 0.05);
}

const BRANCO = "#ffffff";

describe("T207 — paleta Evolli (P-1): as cores-base", () => {
  it("marinho, azul e verde-água são os da identidade Evolli", () => {
    expect(token("evolli-marinho").toLowerCase()).toBe("#0b2d5b");
    expect(token("evolli-azul").toLowerCase()).toBe("#0066ff");
    expect(token("evolli-verde-agua").toLowerCase()).toBe("#00d4a3");
  });
});

describe("T207 — paleta Evolli (P-1): contraste de texto (4,5:1)", () => {
  it.each([
    ["texto branco sobre o marinho", "evolli-sobre-marinho", "evolli-marinho"],
    [
      "texto suave sobre o marinho",
      "evolli-sobre-marinho-suave",
      "evolli-marinho",
    ],
    [
      "texto suave sobre o marinho realçado (hover)",
      "evolli-sobre-marinho-suave",
      "evolli-marinho-realce",
    ],
    [
      "texto branco sobre o azul (item ativo)",
      "evolli-sobre-marinho",
      "evolli-azul",
    ],
    [
      "marinho sobre o azul suave (resumo)",
      "evolli-marinho",
      "evolli-azul-suave",
    ],
    ["marinho sobre o fundo neutro", "evolli-marinho", "evolli-fundo"],
  ])("%s", (_, frente, fundo) => {
    expect(contraste(token(frente), token(fundo))).toBeGreaterThanOrEqual(4.5);
  });

  it("links e botões de texto em azul escuro sobre o branco", () => {
    expect(
      contraste(token("evolli-azul-escuro"), BRANCO),
    ).toBeGreaterThanOrEqual(4.5);
  });
});

describe("T207 — paleta Evolli (P-1): elementos gráficos e foco (3:1)", () => {
  it("barras de gráfico sobre o branco", () => {
    for (const cor of [
      "evolli-azul",
      "evolli-marinho",
      "evolli-verde-agua-escuro",
      "evolli-ardosia",
    ]) {
      expect(contraste(token(cor), BRANCO), cor).toBeGreaterThanOrEqual(3);
    }
  });

  it("dentro da faixa marinho o foco é branco: o azul de ação ali não chega a 3:1", () => {
    expect(
      contraste(token("color-action"), token("evolli-marinho")),
    ).toBeLessThan(3);
    expect(
      contraste(token("evolli-sobre-marinho"), token("evolli-marinho")),
    ).toBeGreaterThanOrEqual(3);
    const shell = readFileSync("src/app/app-shell.css", "utf8");
    expect(shell).toMatch(
      /\.app-shell__sidebar \.painel-nav :focus-visible[\s\S]*?outline-color: var\(--evolli-sobre-marinho\)/,
    );
  });

  it("o verde-água fica abaixo de 3:1 no branco — por isso nunca é cor de texto", () => {
    expect(contraste(token("evolli-verde-agua"), BRANCO)).toBeLessThan(3);
    for (const arquivo of [
      "src/app/app-shell.css",
      "src/app/PainelNavigation.css",
      "src/app/SeletorEmpresaAtiva.css",
      "src/screens/dashboard/DashboardScreen.css",
    ]) {
      const css = readFileSync(arquivo, "utf8");
      expect(css, arquivo).not.toMatch(
        /(^|[^-])color:\s*var\(--evolli-verde-agua(-suave)?\)/m,
      );
    }
  });
});

describe("T207 — paleta Evolli (P-1): só no menu, no Dashboard e no seletor", () => {
  it("a cor de ação global das demais telas não mudou", () => {
    expect(token("color-action").toLowerCase()).toBe("#0066cc");
  });

  it("a faixa lateral é marinho; o cabeçalho e o conteúdo não usam a paleta", () => {
    const shell = readFileSync("src/app/app-shell.css", "utf8");
    expect(shell).toMatch(
      /\.app-shell__sidebar \{[^}]*background: var\(--evolli-marinho\)/,
    );
    const semFaixa = shell
      .split(/\n(?=[.@])/)
      .filter((bloco) => !bloco.includes(".app-shell__sidebar"))
      .filter((bloco) => !bloco.includes(".app-shell--menu-recolhido"))
      .join("\n");
    expect(semFaixa).not.toMatch(/--evolli-/);
  });

  it("as regras do menu lateral não alcançam fora da navegação (o ícone dos cartões do Hub usa a mesma classe)", () => {
    const css = readFileSync("src/app/PainelNavigation.css", "utf8");
    const regras = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
      seletores: m[1]!
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean),
      corpo: m[2]!,
    }));
    const naRaiz = (seletor: string) =>
      /^\.painel-nav(--trilho)?\s/.test(seletor);
    for (const { seletores, corpo } of regras) {
      for (const seletor of seletores) {
        // A classe do ícone também está no Hub: nenhuma cor sem a raiz.
        if (/\.painel-nav__icone/.test(seletor) && /(^|\s)color:/.test(corpo)) {
          expect(naRaiz(seletor), seletor).toBe(true);
        }
        // Toda regra da paleta no menu fica sob a raiz da navegação.
        if (/--evolli-/.test(corpo)) {
          expect(naRaiz(seletor), seletor).toBe(true);
        }
      }
    }
    // O Hub dá a cor do próprio ícone.
    expect(readFileSync("src/app/HubPosLogin.css", "utf8")).toMatch(
      /\.hub__cartao-icone \{[^}]*color: var\(--color-action\)/,
    );
  });

  it("nenhuma outra tela do produto usa os tokens Evolli", () => {
    for (const arquivo of [
      "src/app/HubPosLogin.css",
      "src/app/LoginScreen.css",
      "src/app/guardaDeSaida.css",
      "src/components/Modal.css",
    ]) {
      expect(readFileSync(arquivo, "utf8"), arquivo).not.toMatch(/--evolli-/);
    }
  });
});
