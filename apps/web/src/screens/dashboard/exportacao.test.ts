/**
 * T207 — CSV dos blocos do Dashboard: o conteúdo é preservado como texto, e
 * nenhuma célula vira fórmula ao abrir numa planilha.
 */
import { describe, expect, it } from "vitest";
import { INDISPONIVEL_NO_CSV, montarCsv, nomeDoArquivo } from "./exportacao";

const BOM = String.fromCharCode(0xfeff);

/** As células de cada linha, sem o BOM e sem o fim de linha final. */
function linhas(csv: string): string[] {
  return csv.replace(BOM, "").replace(/\r\n$/, "").split("\r\n");
}

describe("T207 — montarCsv", () => {
  it("BOM, ponto e vírgula, CRLF, e indisponível como '—'", () => {
    const csv = montarCsv(
      ["Mês", "Ativos no fim"],
      [["Janeiro de 2026", null]],
    );
    expect(csv.startsWith(BOM)).toBe(true);
    expect(csv.endsWith("\r\n")).toBe(true);
    expect(linhas(csv)).toEqual([
      "Mês;Ativos no fim",
      `Janeiro de 2026;${INDISPONIVEL_NO_CSV}`,
    ]);
  });

  it.each([
    ["=1+1", "'=1+1"],
    ["+55 11", "'+55 11"],
    ["-Diretoria", "'-Diretoria"],
    ["@SOMA(A1)", "'@SOMA(A1)"],
    ["\tTabulado", "'\tTabulado"],
  ])(
    "texto que começa com caractere de fórmula vira texto: %j",
    (entrada, saida) => {
      expect(linhas(montarCsv(["Grupo"], [[entrada]]))[1]).toBe(saida);
    },
  );

  it("CR no início: neutralizado e entre aspas (quebra de linha)", () => {
    expect(montarCsv(["Grupo"], [["\rX"]])).toContain(`"'\rX"`);
  });

  it("fórmula com ponto e vírgula e aspas: neutralizada e escapada", () => {
    expect(linhas(montarCsv(["Grupo"], [['=HYPERLINK("x";"abrir")']]))[1]).toBe(
      `"'=HYPERLINK(""x"";""abrir"")"`,
    );
  });

  it("números, percentuais, '—' e textos comuns ficam como estão", () => {
    expect(
      linhas(
        montarCsv(["A", "B", "C", "D"], [["Operações", 5, "50%", null]]),
      )[1],
    ).toBe("Operações;5;50%;—");
  });
});

describe("T207 — nomeDoArquivo", () => {
  it("sem acentos, em minúsculas, com hífens", () => {
    expect(
      nomeDoArquivo(
        ["Quadro de colaboradores", "Empresa Ágil (sintética)", 2026],
        "csv",
      ),
    ).toBe("quadro-de-colaboradores-empresa-agil-sintetica-2026.csv");
  });
});
