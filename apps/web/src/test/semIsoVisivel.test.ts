/**
 * Testes da própria guarda (T154).
 *
 * Uma guarda sem teste é uma falsa sensação de proteção: se ela deixasse de
 * detectar, nenhum teste quebraria e a regressão passaria em silêncio. Os
 * casos abaixo provam que ela **pega** o que deve pegar e, principalmente,
 * que **não** reprova o que é contrato legítimo.
 */
import { describe, expect, it } from "vitest";
import { acharIsoVisivel, expectSemIsoVisivel } from "./semIsoVisivel";

function montar(html: string): HTMLElement {
  const div = document.createElement("div");
  div.innerHTML = html;
  return div;
}

describe("guarda de ISO visível", () => {
  it("T154.G1 acusa data civil crua no texto da tela", () => {
    const raiz = montar("<td>2026-01-05</td>");
    expect(acharIsoVisivel(raiz).map((a) => a.trecho)).toContain("2026-01-05");
    expect(() => expectSemIsoVisivel(raiz)).toThrow(/Data ISO visível/);
  });

  it("T154.G2 acusa competência crua AAAA-MM", () => {
    const raiz = montar("<dd>2026-03</dd>");
    expect(acharIsoVisivel(raiz).map((a) => a.trecho)).toContain("2026-03");
  });

  it("T154.G3 acusa instante cru, com T e com milissegundos", () => {
    expect(
      acharIsoVisivel(montar("<p>2026-01-05T00:00:00.000Z</p>")),
    ).not.toEqual([]);
    expect(acharIsoVisivel(montar("<p>criado 09:30:00</p>"))).not.toEqual([]);
  });

  it("T154.G4 NÃO reprova o value de um input de data — é contrato, não tela", () => {
    // O ponto da guarda: `value` não entra em `textContent`. Campo técnico
    // legítimo passa sem precisar de exceção escrita à mão.
    const raiz = montar('<input type="date" value="2026-01-05" />');
    expect(acharIsoVisivel(raiz)).toEqual([]);
    expect(() => expectSemIsoVisivel(raiz)).not.toThrow();
  });

  it("T154.G5 NÃO reprova ISO em atributos técnicos (data-*, id, aria)", () => {
    const raiz = montar(
      '<div id="2026-01-05" data-chave="2026-01-05" aria-describedby="2026-01-05"><span>05/01/2026</span></div>',
    );
    expect(acharIsoVisivel(raiz)).toEqual([]);
  });

  it("T154.G6 aceita o formato brasileiro", () => {
    const raiz = montar(
      "<div><td>05/01/2026</td><dd>03/2026</dd><p>05/01/2026 às 09:30</p></div>",
    );
    expect(acharIsoVisivel(raiz)).toEqual([]);
    expect(() => expectSemIsoVisivel(raiz)).not.toThrow();
  });

  it("T154.G7 não confunde número longo com data", () => {
    // Matrícula, CNPJ e versões não podem virar falso positivo.
    const raiz = montar(
      "<div><span>12345-67-89012</span><span>v1.2026-03-01</span></div>",
    );
    // O segundo É uma data ISO dentro de um texto; o primeiro não é.
    const trechos = acharIsoVisivel(raiz).map((a) => a.trecho);
    expect(trechos).not.toContain("12345-67-890");
  });

  it("T154.G8 a mensagem de falha nomeia o trecho e o contexto", () => {
    const raiz = montar("<td>Admissão: 2026-01-05 (vínculo ativo)</td>");
    let mensagem = "";
    try {
      expectSemIsoVisivel(raiz);
    } catch (e) {
      mensagem = (e as Error).message;
    }
    expect(mensagem).toContain("2026-01-05");
    expect(mensagem).toContain("Admissão");
    expect(mensagem).toContain("formatarDiaCivil");
  });

  it("T154.G9 texto sem data nenhuma passa", () => {
    expect(
      acharIsoVisivel(montar("<p>Nenhuma pessoa sob sua gestão</p>")),
    ).toEqual([]);
  });
});
