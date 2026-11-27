/**
 * T216 — alinhamento dos controles: o texto fica no centro de botões, abas,
 * pílulas, itens de menu e células. As regras moram na base (tokens e
 * componentes), nunca em ajuste por tela. A medição na prévia (texto pelo
 * `Range` contra a caixa do elemento) confirmou diferença de até 1 px.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = join(__dirname, "..");
const ler = (relativo: string) =>
  readFileSync(join(RAIZ, relativo), "utf8").replace(/\r\n/g, "\n");

/** O corpo da primeira regra cujo seletor é exatamente `seletor`. */
function regra(css: string, seletor: string): string {
  const inicio = css.indexOf(`\n${seletor} {`);
  expect(inicio, `regra ${seletor}`).toBeGreaterThanOrEqual(0);
  const abre = css.indexOf("{", inicio);
  return css.slice(abre + 1, css.indexOf("}", abre));
}

describe("T216 — alinhamento dos controles", () => {
  it("a entrelinha do sistema divide a sobra da linha por igual (1,47)", () => {
    expect(ler("app/tokens.css")).toMatch(/--leading-body:\s*1\.47;/);
  });

  it("aba sublinhada padrão: a mesma espessura do indicador em cima, transparente", () => {
    const tokens = ler("app/tokens.css");
    expect(tokens).toMatch(/--aba-indicador:\s*3px;/);
    const corpo = regra(tokens, ".evolli-aba.evolli-aba");
    expect(corpo).toMatch(
      /border-top:\s*var\(--aba-indicador\) solid transparent;/,
    );
    expect(corpo).toMatch(/border-bottom-width:\s*var\(--aba-indicador\);/);
    expect(corpo).toMatch(/line-height:\s*var\(--leading-body\);/);
  });

  it("pílula de status: entrelinha do sistema e largura do conteúdo", () => {
    const corpo = regra(ler("components/StatusBadge.css"), ".evolli-badge");
    expect(corpo).toMatch(/line-height:\s*var\(--leading-body\);/);
    expect(corpo).toMatch(/width:\s*fit-content;/);
  });

  it("botão do componente: entrelinha 1 (divide por igual) e rótulo sem quebra", () => {
    const corpo = regra(ler("components/Button.css"), ".evolli-button");
    expect(corpo).toMatch(/line-height:\s*1;/);
    expect(corpo).toMatch(/white-space:\s*nowrap;/);
  });

  it("selos do menu (Beta, Novo): entrelinha do sistema", () => {
    const corpo = regra(
      ler("app/PainelNavigation.css"),
      ".painel-nav .painel-nav__selo",
    );
    expect(corpo).toMatch(/line-height:\s*var\(--leading-body\);/);
  });

  it("tabela padrão: o respiro de baixo desconta a linha divisória de 1 px", () => {
    const corpo = regra(
      ler("components/DataTable.css"),
      ".evolli-datatable__th,\n.evolli-datatable__td",
    );
    expect(corpo).toMatch(
      /padding:\s*var\(--space-sm\) var\(--space-lg\)\s+calc\(var\(--space-sm\) - 1px\);/,
    );
  });
});
