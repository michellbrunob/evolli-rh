import { describe, expect, it } from "vitest";
import {
  DocumentoPdf,
  bytesWinAnsi,
  cortarTexto,
  larguraDoTexto,
} from "./pdfSimples";

const texto = (b: Uint8Array) => new TextDecoder().decode(b);

describe("T215 — PDF simples", () => {
  it("WinAnsi: acentos do português, travessão e o que não existe", () => {
    expect(bytesWinAnsi("Ação–")).toEqual([0x41, 0xe7, 0xe3, 0x6f, 0x96]);
    expect(bytesWinAnsi("×·")).toEqual([0xd7, 0xb7]);
    expect(bytesWinAnsi("✓")).toEqual([0x3f]);
    // Os controles C1 (0x80 a 0x9F) não são caracteres da WinAnsi.
    expect(bytesWinAnsi("\u0085")).toEqual([0x3f]);
  });

  it("largura pela Helvetica; o corte põe reticências", () => {
    expect(larguraDoTexto("A", 10)).toBeCloseTo(6.67, 2);
    expect(larguraDoTexto("ii", 10)).toBeCloseTo(4.44, 2);
    expect(larguraDoTexto("é", 10)).toBe(larguraDoTexto("e", 10));
    expect(larguraDoTexto("A", 10, true)).toBeGreaterThan(
      larguraDoTexto("A", 10),
    );
    expect(cortarTexto("Curto", 100, 10)).toBe("Curto");
    const cortado = cortarTexto("Maria Fernanda de Souza", 50, 10);
    expect(cortado.endsWith("…")).toBe(true);
    expect(larguraDoTexto(cortado, 10)).toBeLessThanOrEqual(50);
    expect(cortarTexto("Nome", 1, 10)).toBe("");
  });

  it("monta um PDF válido: páginas, fontes, conteúdo e a tabela xref", () => {
    const doc = new DocumentoPdf("Escala (teste)");
    const p = doc.novaPagina(true);
    expect([p.largura, p.altura]).toEqual([841.89, 595.28]);
    p.texto(40, 50, "Escala da semana (Ação)", { tamanho: 14, negrito: true });
    p.texto(40, 70, "a\\b");
    p.retangulo(40, 60, 100, 20, { preenchimento: [0, 102, 204] });
    p.linha(40, 90, 200, 90, [200, 200, 200]);
    p.ponto(45, 100, 3, [255, 0, 0]);
    p.textoADireita(800, 50, "1/1", { tamanho: 8 });
    doc.novaPagina();
    const s = texto(doc.bytes());
    expect(s.startsWith("%PDF-1.4\n")).toBe(true);
    expect(s.trimEnd().endsWith("%%EOF")).toBe(true);
    expect(s).toContain("/Count 2");
    expect(s).toContain("/BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding");
    expect(s).toContain("(Escala da semana \\(A\\347\\343o\\)) Tj");
    expect(s).toContain("0 0.40 0.80 rg");
    expect(s).toContain("(a\\\\b) Tj");
    expect(s).toContain("/Title (Escala \\(teste\\))");
    // y a partir do topo: 50 vira 595.28 - 50.
    expect(s).toContain("40 545.28 Td");
    // Cada entrada da xref aponta para o início do objeto.
    const xref = Number(/startxref\n(\d+)/.exec(s)![1]);
    expect(s.slice(xref, xref + 4)).toBe("xref");
    const posicoes = [...s.slice(xref).matchAll(/^(\d{10}) 00000 n $/gm)].map(
      (m) => Number(m[1]),
    );
    posicoes.forEach((pos, i) => {
      expect(s.slice(pos).startsWith(`${i + 1} 0 obj`)).toBe(true);
    });
    // O comprimento declarado de cada fluxo é o real.
    for (const m of s.matchAll(/<< \/Length (\d+) >>\nstream\n/g)) {
      const inicio = m.index! + m[0].length;
      expect(s.slice(inicio + Number(m[1]), inicio + Number(m[1]) + 10)).toBe(
        "\nendstream",
      );
    }
  });
});
