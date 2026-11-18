/**
 * T210 — os quatro temas de Configurações › Aparência: as paletas exatas da
 * decisão (docs/decisions/t210-temas-de-aparencia.md), os contrastes WCAG
 * calculados a partir dos próprios tokens e nenhuma cor fixa fora deles.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = join(__dirname, "..");
const tokens = readFileSync(join(RAIZ, "app/tokens.css"), "utf8").replace(
  /\r\n/g,
  "\n",
);

/** As declarações `--nome: valor;` do primeiro bloco com este seletor. */
function bloco(seletor: string): Record<string, string> {
  const inicio = tokens.indexOf(`${seletor} {`);
  expect(inicio, seletor).toBeGreaterThan(-1);
  const fim = tokens.indexOf("\n}", inicio);
  const corpo = tokens.slice(inicio, fim).replace(/\/\*[\s\S]*?\*\//g, "");
  const out: Record<string, string> = {};
  for (const m of corpo.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    out[m[1]!] = m[2]!.trim();
  }
  return out;
}

const PALETAS = {
  azul_institucional: {
    acao: "#0066CC",
    hover: "#004F9E",
    tinta: "#1D1D1F",
    secundario: "#475467",
    canvas: "#FFFFFF",
    neutro: "#F5F5F7",
    clara: "#FAFAFC",
    borda: "#D2D2D7",
    divisor: "#E8E8ED",
    foco: "#0066CC",
    controle: "#86868B",
  },
  evolli_claro: {
    acao: "#B42362",
    hover: "#961C51",
    tinta: "#25151E",
    secundario: "#5D4553",
    canvas: "#FFFDFE",
    neutro: "#F8F7F9",
    clara: "#FFF8FB",
    borda: "#E8DDE4",
    divisor: "#F1E7EC",
    foco: "#B42362",
    controle: "#9A7A8B",
  },
  verde_petroleo: {
    acao: "#006D77",
    hover: "#005963",
    tinta: "#132B2D",
    secundario: "#40595B",
    canvas: "#FCFEFE",
    neutro: "#F2F8F8",
    clara: "#F7FBFB",
    borda: "#CDE0E0",
    divisor: "#E0EEEE",
    foco: "#006D77",
    controle: "#6B8C8E",
  },
  alto_contraste: {
    acao: "#0046AD",
    hover: "#003780",
    tinta: "#000000",
    secundario: "#1A1A1A",
    canvas: "#FFFFFF",
    neutro: "#FFFFFF",
    clara: "#FFFFFF",
    borda: "#1A1A1A",
    divisor: "#666666",
    foco: "#0046AD",
    controle: "#1A1A1A",
  },
} as const;
type Tema = keyof typeof PALETAS;

/** Token semântico → papel na paleta. */
const MAPA = {
  "--color-action": "acao",
  "--color-action-hover": "hover",
  "--color-ink": "tinta",
  "--color-ink-muted": "secundario",
  "--color-ink-subtle": "secundario",
  "--surface-canvas": "canvas",
  "--surface-neutral": "neutro",
  "--surface-pearl": "clara",
  "--hairline": "borda",
  "--divider-soft": "divisor",
  "--focus-color": "foco",
  "--borda-controle": "controle",
} as const;

function seletorDe(tema: Tema): string {
  return tema === "azul_institucional"
    ? ":root"
    : `:root[data-theme="${tema}"]`;
}

function luminancia(hex: string): number {
  const [r, g, b] = [1, 3, 5].map(
    (i) => parseInt(hex.slice(i, i + 2), 16) / 255,
  );
  const f = (c: number) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  return 0.2126 * f(r!) + 0.7152 * f(g!) + 0.0722 * f(b!);
}
function contraste(a: string, b: string): number {
  const [x, y] = [luminancia(a), luminancia(b)].sort((m, n) => n - m);
  return (x! + 0.05) / (y! + 0.05);
}

describe("T210 — paletas dos temas nos tokens", () => {
  for (const tema of Object.keys(PALETAS) as Tema[]) {
    it(`${tema}: cada token semântico com o valor da paleta`, () => {
      const decl = bloco(seletorDe(tema));
      for (const [token, papel] of Object.entries(MAPA)) {
        expect(decl[token]?.toUpperCase(), `${tema} ${token}`).toBe(
          PALETAS[tema][papel],
        );
      }
    });
  }

  it("a marca de interface (--evolli-azul…) segue a ação do tema", () => {
    const raiz = bloco(":root");
    expect(raiz["--evolli-azul"]).toBe("var(--color-action)");
    expect(raiz["--evolli-azul-escuro"]).toBe("var(--color-action-hover)");
    expect(raiz["--evolli-azul-suave"]).toMatch(/color-mix\(/);
  });
});

describe("T210 — contrastes WCAG AA de cada tema", () => {
  for (const tema of Object.keys(PALETAS) as Tema[]) {
    const p = PALETAS[tema];
    const fundos = [p.canvas, p.neutro, p.clara];
    it(`${tema}: texto ≥ 4,5:1; ação, foco e contorno de campo ≥ 3:1; branco sobre a ação ≥ 4,5:1`, () => {
      for (const fundo of fundos) {
        expect(contraste(p.tinta, fundo)).toBeGreaterThanOrEqual(4.5);
        expect(contraste(p.secundario, fundo)).toBeGreaterThanOrEqual(4.5);
        // A ação também é cor de link/texto: 4,5:1.
        expect(contraste(p.acao, fundo)).toBeGreaterThanOrEqual(4.5);
        expect(contraste(p.foco, fundo)).toBeGreaterThanOrEqual(3);
        expect(contraste(p.controle, fundo)).toBeGreaterThanOrEqual(3);
      }
      expect(contraste("#FFFFFF", p.acao)).toBeGreaterThanOrEqual(4.5);
      expect(contraste("#FFFFFF", p.hover)).toBeGreaterThanOrEqual(4.5);
    });
  }

  it("estados semânticos iguais em todos os temas (nenhum tema os redefine)", () => {
    for (const tema of Object.keys(PALETAS) as Tema[]) {
      if (tema === "azul_institucional") continue;
      const decl = bloco(seletorDe(tema));
      expect(
        Object.keys(decl).filter((k) => k.startsWith("--status-")),
      ).toEqual([]);
    }
  });
});

describe("T210 — nenhuma cor fixa fora dos tokens", () => {
  function arquivos(pasta: string): string[] {
    return readdirSync(pasta).flatMap((nome) => {
      const caminho = join(pasta, nome);
      return statSync(caminho).isDirectory() ? arquivos(caminho) : [caminho];
    });
  }
  const fontes = arquivos(RAIZ).filter(
    (f) =>
      /\.(css|tsx)$/.test(f) &&
      !/\.test\.tsx$/.test(f) &&
      !f.endsWith("tokens.css") &&
      !f.includes(join("assets", "brand")),
  );

  it("CSS e TSX das telas usam tokens (sem hex, rgb ou hsl literais)", () => {
    const comCor = fontes.filter((f) => {
      const texto = readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
      return /#[0-9a-fA-F]{3,8}\b(?![\w-])|\brgba?\(|\bhsla?\(/.test(
        texto.replace(/\/\/.*$/gm, ""),
      );
    });
    expect(comCor).toEqual([]);
  });
});
