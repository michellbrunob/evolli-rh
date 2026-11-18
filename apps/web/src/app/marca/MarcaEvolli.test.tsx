/**
 * T210 — a marca Evolli: só os SVGs locais da pasta de marca, a versão
 * certa por contexto, o nome acessível "Evolli" (sem leitura dupla), nenhuma
 * imagem quebrada e o símbolo legível a partir de 24 px.
 */
import { render, screen } from "@testing-library/react";
import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { describe, expect, it } from "vitest";
import { MarcaEvolli } from "./MarcaEvolli";

const PASTA = join(__dirname, "..", "..", "assets", "brand");

function imagem() {
  return screen.getByRole("img", { name: "Evolli" }) as HTMLImageElement;
}
/** O arquivo por trás do `src` (o Vite serve a própria pasta de marca). */
function arquivo(img: HTMLImageElement): string {
  return basename(decodeURIComponent(new URL(img.src).pathname));
}

describe("T210 — MarcaEvolli", () => {
  it.each([
    ["horizontal", "azul", "evolli-horizontal.svg"],
    ["horizontal", "branco", "evolli-horizontal-branco.svg"],
    ["simbolo", "azul", "evolli-symbol.svg"],
    ["simbolo", "branco", "evolli-symbol-branco.svg"],
    ["vertical", "azul", "evolli-vertical.svg"],
    ["vertical", "branco", "evolli-vertical-branco.svg"],
  ] as const)("%s %s → %s, arquivo existente", (variante, tom, nome) => {
    render(<MarcaEvolli variante={variante} tom={tom} />);
    const img = imagem();
    expect(arquivo(img)).toBe(nome);
    expect(existsSync(join(PASTA, nome))).toBe(true);
  });

  it("nome acessível 'Evolli'; decorativa quando o nome já está ao lado", () => {
    const { rerender } = render(<MarcaEvolli />);
    expect(imagem()).toHaveAttribute("alt", "Evolli");
    rerender(<MarcaEvolli decorativa />);
    expect(screen.queryByRole("img", { name: "Evolli" })).toBeNull();
    expect(document.querySelector("img")).toHaveAttribute("alt", "");
  });

  it("proporção do arquivo preservada (sem distorção), sem filtro nem sombra", () => {
    for (const [variante, svg] of [
      ["horizontal", "evolli-horizontal.svg"],
      ["simbolo", "evolli-symbol.svg"],
      ["vertical", "evolli-vertical.svg"],
    ] as const) {
      const { unmount } = render(
        <MarcaEvolli variante={variante} altura={64} />,
      );
      const img = imagem();
      const caixa = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(
        readFileSync(join(PASTA, svg), "utf8"),
      )!;
      const proporcao = Number(caixa[1]) / Number(caixa[2]);
      expect(Number(img.getAttribute("width"))).toBe(
        Math.round(64 * proporcao),
      );
      expect(img.getAttribute("height")).toBe("64");
      expect(img.getAttribute("style") ?? "").not.toMatch(/filter|shadow/);
      unmount();
    }
  });

  it("símbolo nunca abaixo de 24 px; horizontal nunca abaixo de 156 px de largura", () => {
    const { rerender } = render(<MarcaEvolli variante="simbolo" altura={16} />);
    expect(imagem()).toHaveAttribute("height", "24");
    rerender(<MarcaEvolli variante="horizontal" altura={20} />);
    expect(Number(imagem().getAttribute("width"))).toBeGreaterThanOrEqual(156);
  });

  it("os arquivos brancos têm a mesma geometria dos oficiais (só o preenchimento muda)", () => {
    for (const nome of ["horizontal", "symbol", "vertical"]) {
      const oficial = readFileSync(join(PASTA, `evolli-${nome}.svg`), "utf8");
      const branco = readFileSync(
        join(PASTA, `evolli-${nome}-branco.svg`),
        "utf8",
      );
      expect(oficial).toMatch(/fill="#0066CC"/);
      expect(branco).not.toMatch(/#0066CC/);
      expect(branco.replace(/#FFFFFF/g, "#0066CC")).toBe(oficial);
    }
  });

  it("a CSS da marca não recolore, filtra, sombreia nem distorce", () => {
    const css = readFileSync(join(__dirname, "MarcaEvolli.css"), "utf8");
    expect(css).not.toMatch(/filter|shadow|gradient|object-fit:\s*fill/);
    expect(css).toMatch(/object-fit:\s*contain/);
  });
});
