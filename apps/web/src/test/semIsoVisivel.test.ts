/**
 * Testes da própria guarda (T154).
 *
 * Uma guarda sem teste é uma falsa sensação de proteção: se ela deixasse de
 * detectar, nenhum teste quebraria e a regressão passaria em silêncio. Os
 * casos abaixo provam que ela **pega** o que deve pegar e, principalmente,
 * que **não** reprova o que é contrato legítimo ou identificador técnico.
 *
 * O bloco "fronteira dura" existe por um defeito real encontrado em revisão:
 * a versão anterior reprovava a aba de Banco de Horas por causa do código de
 * apuração `AP-2026-08-11-V001-C`, enquanto a coluna de data ao lado exibia
 * `11/08/2026` corretamente. Uma guarda que acusa o inocente não pode ser
 * estendida às demais telas — então ela não guardava quase nada.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  acharIsoVisivel,
  expectSemIsoVisivel,
  textoVisivel,
} from "./semIsoVisivel";

function montar(html: string): HTMLElement {
  const div = document.createElement("div");
  div.innerHTML = html;
  return div;
}

/**
 * Monta uma LINHA de tabela de verdade.
 *
 * `div.innerHTML = "<tr><td>…"` não funciona: o parser HTML descarta `<tr>`
 * fora de `<table>` e deixa só os nós de texto — que colam entre si e dariam
 * um falso verde. O erro apareceu na primeira execução destes testes.
 */
function montarLinha(celulas: readonly string[]): HTMLElement {
  const div = document.createElement("div");
  div.innerHTML =
    "<table><tbody><tr>" +
    celulas.map((c) => `<td>${c}</td>`).join("") +
    "</tr></tbody></table>";
  return div;
}

const trechos = (html: string) =>
  acharIsoVisivel(montar(html)).map((a) => a.trecho);

describe("guarda de ISO visível — o que DEVE ser acusado", () => {
  it("T154.G1 ISO cru simples numa célula", () => {
    expect(trechos("<td>2026-01-05</td>")).toContain("2026-01-05");
    expect(() => expectSemIsoVisivel(montar("<td>2026-01-05</td>"))).toThrow(
      /Data ISO visível/,
    );
  });

  it("T154.G2 competência crua AAAA-MM", () => {
    expect(trechos("<dd>2026-03</dd>")).toContain("2026-03");
  });

  it("T154.G3 instante cru, com T e com milissegundos", () => {
    expect(trechos("<p>2026-01-05T00:00:00.000Z</p>")).not.toEqual([]);
    expect(trechos("<p>criado 09:30:00</p>")).not.toEqual([]);
  });

  it("T154.G4 ISO dividido entre spans — é UMA data exibida, tem de ser pega", () => {
    // Inline não quebra o fluxo visual: o usuário lê "2026-10-08".
    expect(trechos("<p><span>2026</span><span>-10-08</span></p>")).toContain(
      "2026-10-08",
    );
    // Três pedaços, mesma linha.
    expect(trechos("<p><b>2026</b><i>-10</i><em>-08</em></p>")).toContain(
      "2026-10-08",
    );
  });

  it("T154.G5 ISO cercada por pontuação comum continua sendo detectada", () => {
    // Pontuação não é caractere de palavra — a fronteira dura NÃO a protege,
    // e é justamente aqui que uma regressão real apareceria.
    for (const html of [
      "<td>(2026-01-05)</td>",
      "<td>Admissão: 2026-01-05.</td>",
      "<td>[2026-01-05]</td>",
      '<td>"2026-01-05"</td>',
      "<td>2026-01-05, 2026-01-06</td>",
      "<td>de 2026-01-05 até hoje</td>",
      "<td>«2026-01-05»</td>",
      "<td>ref. 2026-01-05 — pendente</td>",
    ]) {
      expect(trechos(html)).toContain("2026-01-05");
    }
  });

  it("T154.G6 a mensagem de falha nomeia o trecho e o contexto", () => {
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
});

describe("guarda de ISO visível — fronteira dura, o que NÃO pode ser acusado", () => {
  it("T154.G7 código de apuração com data embutida (o falso positivo real)", () => {
    // Caso medido na aba Banco de Horas: o código é referência técnica e a
    // data ao lado JÁ está correta. Acusar aqui é acusar o inocente.
    const linha = montarLinha(["AP-2026-08-11-V001-C", "11/08/2026"]);
    expect(acharIsoVisivel(linha)).toEqual([]);
    expect(() => expectSemIsoVisivel(linha)).not.toThrow();
  });

  it("T154.G8 protocolo com data embutida", () => {
    for (const codigo of [
      "PROT-2026-10-0042",
      "FER-2026-0001",
      "SOL-2026-03-17-9",
      "DEMO-2026-08-11",
      "2026-08-11-V2",
    ]) {
      expect(acharIsoVisivel(montar(`<td>${codigo}</td>`))).toEqual([]);
    }
  });

  it("T154.G9 UUID, inclusive com sequências só de dígitos", () => {
    for (const uuid of [
      "550e8400-e29b-41d4-a716-446655440000",
      "12345678-1234-1234-1234-123456789012",
      "2026-1005-4a1b-9c2d-000000000000",
      "0f9c1e3a-2026-10-08-abcd",
    ]) {
      expect(acharIsoVisivel(montar(`<td>${uuid}</td>`))).toEqual([]);
    }
  });

  it("T154.G10 matrícula, CEP, telefone, CNPJ e semver", () => {
    for (const valor of [
      "MAT-0001",
      "DEMO-A-0201",
      "01310-100",
      "(11) 98765-4321",
      "12.345.678/0001-95",
      "v1.2.3",
      "1.2026.3",
      "12345-67-89012",
    ]) {
      expect(acharIsoVisivel(montar(`<td>${valor}</td>`))).toEqual([]);
    }
  });

  it("T154.G11 duas células vizinhas que NÃO formam uma data única", () => {
    // `textContent` colaria em "ano 2026-10-08 itens". O usuário não lê isso:
    // são duas células. A quebra de bloco desfaz a colagem.
    const linha = montarLinha(["ano 2026", "-10-08 itens"]);
    expect(linha.textContent).toContain("2026-10-08"); // o defeito que existiria
    expect(textoVisivel(linha)).not.toContain("2026-10-08");
    expect(acharIsoVisivel(linha)).toEqual([]);

    // O mesmo entre dois parágrafos e entre dois itens de lista.
    expect(
      acharIsoVisivel(montar("<div><p>total 2026</p><p>-10-08 ok</p></div>")),
    ).toEqual([]);
    expect(
      acharIsoVisivel(montar("<ul><li>lote 2026</li><li>-03 resto</li></ul>")),
    ).toEqual([]);
  });

  it("T154.G12 o value de um input de data — é contrato, não tela", () => {
    for (const html of [
      '<input type="date" value="2026-01-05" />',
      '<input type="month" value="2026-03" />',
      '<input type="datetime-local" value="2026-01-05T09:30" />',
    ]) {
      expect(acharIsoVisivel(montar(html))).toEqual([]);
      expect(() => expectSemIsoVisivel(montar(html))).not.toThrow();
    }
  });

  it("T154.G13 ISO em atributos técnicos (data-*, id, aria)", () => {
    const raiz = montar(
      '<div id="2026-01-05" data-chave="2026-01-05" aria-describedby="2026-01-05"><span>05/01/2026</span></div>',
    );
    expect(acharIsoVisivel(raiz)).toEqual([]);
  });

  it("T154.G14 texto comum com data brasileira", () => {
    const raiz = montar(
      "<div><td>05/01/2026</td><dd>03/2026</dd><p>05/01/2026 às 09:30</p>" +
        "<p>Admitido em 05/01/2026 e desligado em 31/12/2026.</p></div>",
    );
    expect(acharIsoVisivel(raiz)).toEqual([]);
    expect(() => expectSemIsoVisivel(raiz)).not.toThrow();
  });

  it("T154.G15 texto sem data nenhuma", () => {
    expect(
      acharIsoVisivel(montar("<p>Nenhuma pessoa sob sua gestão</p>")),
    ).toEqual([]);
  });

  it("T154.G16 script e style não contam como texto do usuário", () => {
    expect(
      acharIsoVisivel(
        montar(
          '<div><script>var d="2026-01-05";</script><p>05/01/2026</p></div>',
        ),
      ),
    ).toEqual([]);
  });
});

describe("guarda de ISO visível — isolamento do bundle", () => {
  it("T154.G17 só código de teste importa a guarda; produção não a alcança", () => {
    // `vitest` roda com cwd em `apps/web`. `import.meta.url` daria um caminho
    // de URL (barras invertidas e espaços escapados no Windows).
    const raiz = join(process.cwd(), "src");

    const arquivos: string[] = [];
    const varrer = (dir: string) => {
      for (const entrada of readdirSync(dir, { withFileTypes: true })) {
        const caminho = join(dir, entrada.name);
        if (entrada.isDirectory()) varrer(caminho);
        else if (/\.(ts|tsx)$/.test(entrada.name)) arquivos.push(caminho);
      }
    };
    varrer(raiz);

    const eTeste = (f: string) =>
      /\.test\.tsx?$/.test(f) || /[\\/]test[\\/]/.test(f);

    const infratores = arquivos
      .filter((f) => !eTeste(f))
      .filter((f) => readFileSync(f, "utf8").includes("semIsoVisivel"));

    expect(infratores).toEqual([]);
    // E a varredura realmente olhou o projeto inteiro.
    expect(arquivos.length).toBeGreaterThan(50);
  });
});
