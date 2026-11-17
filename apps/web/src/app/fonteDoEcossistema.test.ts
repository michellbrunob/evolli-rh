/**
 * T209 — fonte do ecossistema (decisão da proprietária de 2026-11-17):
 * Parkinsans, servida pela própria aplicação (pacote local, sem Google
 * Fonts), só nos pesos usados (400, 500 e 600), com as fontes do sistema
 * como reserva.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = join(__dirname, "..");
const ler = (relativo: string) =>
  readFileSync(join(RAIZ, relativo), "utf8").replace(/\r\n/g, "\n");

function arquivos(pasta: string): string[] {
  return readdirSync(pasta).flatMap((nome) => {
    const caminho = join(pasta, nome);
    return statSync(caminho).isDirectory() ? arquivos(caminho) : [caminho];
  });
}

describe("T209 — fonte do ecossistema", () => {
  it("o token --font-sans começa por Parkinsans e mantém as fontes do sistema como reserva", () => {
    const tokens = ler("app/tokens.css");
    const declaracao = /--font-sans:\s*([^;]+);/.exec(tokens)?.[1] ?? "";
    const familias = declaracao.split(",").map((f) => f.trim());
    expect(familias[0]).toBe('"Parkinsans"');
    expect(familias).toEqual(
      expect.arrayContaining(["system-ui", '"Segoe UI"', "sans-serif"]),
    );
  });

  it("a entrada carrega só os pesos 400, 500 e 600 do pacote local", () => {
    const entrada = ler("main.tsx");
    const importados = [
      ...entrada.matchAll(/import "@fontsource\/parkinsans\/([^"]+)";/g),
    ].map((m) => m[1]);
    expect(importados).toEqual([
      "latin-400.css",
      "latin-500.css",
      "latin-600.css",
    ]);
  });

  it("nenhum arquivo do código busca fontes fora da aplicação", () => {
    const fontesExternas = arquivos(RAIZ)
      .filter((f) => /\.(css|tsx?|html)$/.test(f))
      .filter((f) =>
        /fonts\.(googleapis|gstatic)\.com/.test(readFileSync(f, "utf8")),
      );
    expect(fontesExternas).toEqual([]);
  });
});
