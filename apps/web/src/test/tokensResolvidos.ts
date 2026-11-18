/**
 * T210 — lê um token de cor de `tokens.css` já RESOLVIDO para hex, no tema
 * padrão (Azul Institucional, o `:root`): segue `var(--outro)` e calcula
 * `color-mix(in srgb, A P%, B)`. Os temas redefinem tokens só em blocos
 * `:root[data-theme="…"]`, que esta leitura ignora.
 */
import { readFileSync } from "node:fs";

const css = readFileSync("src/app/tokens.css", "utf8").replace(/\r\n/g, "\n");
const raiz = css.slice(
  css.indexOf(":root {"),
  css.indexOf("\n}", css.indexOf(":root {")),
);

function declarado(nome: string): string {
  const achado = new RegExp(String.raw`--${nome}:\s*([^;]+);`).exec(raiz);
  if (!achado) throw new Error(`token --${nome} não existe`);
  return achado[1]!.replace(/\s+/g, " ").trim();
}

function paraRgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [
    number,
    number,
    number,
  ];
}

function resolver(valor: string): string {
  const v = valor.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v.toLowerCase();
  const variavel = /^var\(--([\w-]+)\)$/.exec(v);
  if (variavel) return resolver(declarado(variavel[1]!));
  const mistura =
    /^color-mix\(\s*in srgb\s*,\s*(.+?)\s+(\d+(?:\.\d+)?)%\s*,\s*(.+)\)$/.exec(
      v,
    );
  if (mistura) {
    const a = paraRgb(resolver(mistura[1]!));
    const b = paraRgb(resolver(mistura[3]!));
    const p = Number(mistura[2]) / 100;
    return (
      "#" +
      a
        .map((c, i) => Math.round(c * p + b[i]! * (1 - p)))
        .map((c) => c.toString(16).padStart(2, "0"))
        .join("")
    );
  }
  throw new Error(`valor não resolvido: ${v}`);
}

/** O hex (minúsculo) do token no tema padrão. */
export function tokenResolvido(nome: string): string {
  return resolver(declarado(nome));
}
