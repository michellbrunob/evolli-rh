/**
 * T209 — padrão de divisões sutis entre blocos. Tokens semânticos sobre os
 * valores de borda que já existiam (nenhuma cor nova), usados primeiro na
 * estrutura compartilhada do shell. Telas ainda não revisadas não recebem
 * divisões novas: cada módulo as recebe quando for aberto para evolução
 * (rollout no dossiê da T209).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const ler = (caminho: string) =>
  readFileSync(caminho, "utf8").replace(/\r\n/g, "\n");

const tokens = ler("src/app/tokens.css");
const shell = ler("src/app/app-shell.css");
const navegacao = ler("src/app/PainelNavigation.css");
const seletor = ler("src/app/SeletorEmpresaAtiva.css");

/** O corpo da primeira regra cujo seletor casa exatamente com `seletor`. */
function regra(css: string, seletorDaRegra: string): string {
  const escapado = seletorDaRegra.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const achado = new RegExp(`(^|\\n)${escapado}\\s*\\{([^}]*)\\}`).exec(css);
  if (!achado) throw new Error(`regra ${seletorDaRegra} não existe`);
  return achado[2] ?? "";
}

describe("T209 — tokens de divisão", () => {
  it.each([
    ["--divisor-cor", "var(--divider-soft)"],
    ["--divisor-cor-forte", "var(--hairline)"],
    ["--divisor-cor-sobre-marinho", "var(--evolli-marinho-divisa)"],
    ["--borda-espessura", "1px"],
    ["--divisor", "var(--borda-espessura) solid var(--divisor-cor)"],
    [
      "--divisor-forte",
      "var(--borda-espessura) solid var(--divisor-cor-forte)",
    ],
    ["--secao-espaco", "var(--space-lg)"],
    ["--secao-espaco-compacto", "var(--space-md)"],
    ["--borda-card", "var(--divisor-forte)"],
    ["--borda-tabela", "var(--divisor)"],
    ["--borda-painel", "var(--divisor-forte)"],
    ["--estado-hover-superficie", "var(--surface-pearl)"],
    ["--estado-ativo-cor", "var(--color-action)"],
    ["--estado-ativo-espessura", "3px"],
    ["--estado-selecao-superficie", "var(--status-info-surface)"],
    ["--foco-anel", "var(--focus-width) solid var(--color-action)"],
  ])("%s = %s", (nome, valor) => {
    expect(tokens).toContain(`  ${nome}: ${valor};`);
  });

  it("nenhuma cor nova: os tokens de divisão só apontam para os que já existiam", () => {
    const inicio = tokens.indexOf("/* T209 — divisões");
    expect(inicio).toBeGreaterThan(-1);
    const bloco = tokens.slice(inicio, tokens.indexOf("}", inicio));
    expect(bloco).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(bloco).not.toMatch(/\brgba?\(|\bhsla?\(/);
  });
});

describe("T209 — divisões na estrutura compartilhada do shell", () => {
  it("cabeçalho superior separado do conteúdo pelo divisor", () => {
    expect(regra(shell, ".app-shell__topbar")).toMatch(
      /border-bottom: var\(--divisor\);/,
    );
  });

  it("menu lateral separado do conteúdo (na cor do marinho, como já era)", () => {
    expect(regra(shell, ".app-shell__sidebar")).toMatch(
      /border-right: var\(--divisor\);/,
    );
  });

  it("rodapé técnico separado pelo divisor forte", () => {
    expect(regra(shell, ".app-shell__footer")).toMatch(
      /border-top: var\(--divisor-forte\);/,
    );
  });

  it("utilidades no pé do menu (conta e demonstração) separadas por divisor", () => {
    expect(regra(navegacao, ".painel-nav__modulos--secundario")).toMatch(
      /border-top: var\(--divisor\);/,
    );
    expect(regra(navegacao, ".painel-nav__modulos--conta")).toMatch(
      /border-top: var\(--divisor\);/,
    );
    expect(
      regra(
        navegacao,
        ".painel-nav .painel-nav__modulos--secundario,\n.painel-nav .painel-nav__modulos--conta",
      ),
    ).toMatch(/border-top-color: var\(--divisor-cor-sobre-marinho\);/);
  });

  it("seletor de empresa do menu separado da navegação por um divisor sobre o marinho", () => {
    const corpo = regra(seletor, ".seletor-empresa--menu");
    expect(corpo).toMatch(/padding-bottom: var\(--secao-espaco-compacto\);/);
    expect(corpo).toMatch(
      /border-bottom: var\(--borda-espessura\) solid var\(--divisor-cor-sobre-marinho\);/,
    );
  });

  it("no trilho (menu recolhido), o divisor do seletor continua sem alargar nada", () => {
    expect(regra(seletor, ".seletor-empresa--menu")).toMatch(/min-width: 0;/);
  });
});
