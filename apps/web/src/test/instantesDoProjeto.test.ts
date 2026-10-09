/**
 * Invariante de projeto (T154 / R1) — nenhum instante ambíguo alimenta a tela.
 *
 * `formatarInstante` passou a recusar valor sem fuso, porque
 * `new Date("2026-10-08T15:30:00")` é lido como hora LOCAL do processo e a
 * saída mudaria conforme a máquina. Recusar é o comportamento certo, mas por
 * si só ele é invisível: se alguém passar um valor assim, a tela mostra `—` e
 * ninguém percebe até um usuário reclamar.
 *
 * Este teste fecha a outra ponta. Varre o projeto inteiro atrás de literais
 * com cara de instante e exige que todo ambíguo esteja numa das situações em
 * que ambiguidade é correta — e documentada. Qualquer novo literal ambíguo
 * fora delas quebra aqui, com arquivo e linha.
 *
 * As situações legítimas, e por quê:
 *
 *   `value:` / `value="`   `<input type="datetime-local">` é definido SEM fuso
 *                          pelo HTML. É contrato de campo, não apresentação;
 *                          `paraIso` converte antes de virar payload.
 *   asserção negativa      `not.toHaveTextContent("2026-01-05 10:00")` fixa o
 *                          formato ERRADO antigo, para provar que sumiu.
 *   comentário             prosa explicando o defeito.
 *
 * `format/data.test.ts` fica de fora: o trabalho dele é justamente alimentar
 * valores ambíguos e exigir `—`.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Suíte cujo propósito É alimentar valores ambíguos. */
const SUITE_DE_RECUSA = "data.test.ts";

/** Qualquer coisa com cara de data + hora dentro de aspas duplas. */
const LITERAL_DE_INSTANTE = /"(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}[^"]*)"/g;

/** A forma que `formatarInstante` aceita: `T`, e `Z` ou offset explícito. */
const INEQUIVOCO =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})$/;

function arquivosDeOrigem(raiz: string): string[] {
  const achados: string[] = [];
  const varrer = (dir: string) => {
    for (const entrada of readdirSync(dir, { withFileTypes: true })) {
      const caminho = join(dir, entrada.name);
      if (entrada.isDirectory()) varrer(caminho);
      else if (/\.(ts|tsx)$/.test(entrada.name)) achados.push(caminho);
    }
  };
  varrer(raiz);
  return achados;
}

function ehComentario(linha: string): boolean {
  const t = linha.trim();
  return t.startsWith("//") || t.startsWith("*") || t.startsWith("/*");
}

function ehContratoDeCampo(linha: string): boolean {
  return linha.includes("value:") || linha.includes('value="');
}

function ehAssercaoNegativa(linha: string): boolean {
  return linha.includes("not.") || linha.includes("toBeNull");
}

describe("instantes do projeto", () => {
  const raiz = join(process.cwd(), "src");
  const arquivos = arquivosDeOrigem(raiz);

  it("T154.31 a varredura cobre o projeto inteiro", () => {
    expect(arquivos.length).toBeGreaterThan(50);
  });

  it("T154.32 nenhum literal de instante AMBÍGUO fora das exceções documentadas", () => {
    const infratores: string[] = [];

    for (const arquivo of arquivos) {
      if (arquivo.endsWith(SUITE_DE_RECUSA)) continue;
      const rel = arquivo
        .slice(raiz.length + 1)
        .split("\\")
        .join("/");

      readFileSync(arquivo, "utf8")
        .split(/\r?\n/)
        .forEach((linha, i) => {
          LITERAL_DE_INSTANTE.lastIndex = 0;
          let casado: RegExpExecArray | null;
          while ((casado = LITERAL_DE_INSTANTE.exec(linha)) !== null) {
            const valor = casado[1] as string;
            if (INEQUIVOCO.test(valor)) continue;
            if (ehComentario(linha)) continue;
            if (ehContratoDeCampo(linha)) continue;
            if (ehAssercaoNegativa(linha)) continue;
            infratores.push(`${rel}:${i + 1} → "${valor}"`);
          }
        });
    }

    expect(infratores).toEqual([]);
  });

  it("T154.33 código de PRODUÇÃO não tem literal de instante ambíguo em uso", () => {
    // Em produção a única ambiguidade tolerada é prosa de comentário.
    const infratores: string[] = [];

    for (const arquivo of arquivos) {
      if (/\.test\.tsx?$/.test(arquivo)) continue;
      const rel = arquivo
        .slice(raiz.length + 1)
        .split("\\")
        .join("/");

      readFileSync(arquivo, "utf8")
        .split(/\r?\n/)
        .forEach((linha, i) => {
          LITERAL_DE_INSTANTE.lastIndex = 0;
          let casado: RegExpExecArray | null;
          while ((casado = LITERAL_DE_INSTANTE.exec(linha)) !== null) {
            const valor = casado[1] as string;
            if (INEQUIVOCO.test(valor)) continue;
            if (ehComentario(linha)) continue;
            infratores.push(`${rel}:${i + 1} → "${valor}"`);
          }
        });
    }

    expect(infratores).toEqual([]);
  });

  it("T154.34 a varredura realmente enxerga um literal ambíguo plantado", () => {
    // Sem isto, os dois testes acima passariam mesmo com o regex quebrado.
    //
    // O valor é montado em pedaços de propósito: escrito inteiro, ESTE arquivo
    // viraria o primeiro infrator da própria varredura.
    const plantado = ["2026-10-08", "T", "15:30:00"].join("");
    const linha = `const x = "${plantado}";`;

    LITERAL_DE_INSTANTE.lastIndex = 0;
    const casado = LITERAL_DE_INSTANTE.exec(linha);
    expect(casado?.[1]).toBe(plantado);
    expect(INEQUIVOCO.test(plantado)).toBe(false);
    expect(ehComentario(linha)).toBe(false);
    expect(ehContratoDeCampo(linha)).toBe(false);
    expect(ehAssercaoNegativa(linha)).toBe(false);

    // E a forma correta do mesmo instante passa.
    expect(INEQUIVOCO.test(`${plantado}Z`)).toBe(true);
  });
});
