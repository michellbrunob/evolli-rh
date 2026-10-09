/**
 * Invariantes estruturais da T154 — a centralização não pode se desfazer.
 *
 * A T154 tinha um buraco que só apareceu em revisão: o formatador central
 * existia, as telas principais o usavam, e mesmo assim **nove cópias** de
 * `formatarDataBr` com `iso.split("-")` seguiam vivas nas fixtures. Elas
 * produziam o texto certo, então nenhum teste reclamava — e a consolidação
 * estava incompleta sem que nada apontasse isso.
 *
 * Teste de comportamento não pega esse tipo de defeito, porque o
 * comportamento está correto. O que falha é a ESTRUTURA: um segundo
 * formatador é uma segunda regra, que um dia diverge da primeira. Por isso
 * estas asserções olham o código, e não a tela.
 *
 * Mesma lógica para a cobertura da guarda: ela cobria 2 das 12 superfícies, e
 * nada avisava. Tirar a guarda de uma tela voltava a ser grátis.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = join(process.cwd(), "src");

function arquivosDeOrigem(): string[] {
  const achados: string[] = [];
  const varrer = (dir: string) => {
    for (const entrada of readdirSync(dir, { withFileTypes: true })) {
      const caminho = join(dir, entrada.name);
      if (entrada.isDirectory()) varrer(caminho);
      else if (/\.(ts|tsx)$/.test(entrada.name)) achados.push(caminho);
    }
  };
  varrer(RAIZ);
  return achados;
}

const rel = (f: string) =>
  f
    .slice(RAIZ.length + 1)
    .split("\\")
    .join("/");

const ARQUIVOS = arquivosDeOrigem();
const FORA_DO_MODULO_CENTRAL = ARQUIVOS.filter(
  (f) => !rel(f).startsWith("format/"),
);

/**
 * As 12 superfícies que a T154 alterou. A guarda tem de cobrir TODAS.
 *
 * A lista é explícita de propósito: derivar de um glob faria o teste encolher
 * junto com a cobertura, que é exatamente o defeito que ele existe para pegar.
 */
const SUPERFICIES_DA_T154 = [
  "app/SessoesAtivasPanel.test.tsx",
  "screens/administracao/ContasAcessoScreen.test.tsx",
  "screens/documentos/DocumentosMetadadosScreen.test.tsx",
  "screens/equipe/EquipeScreen.test.tsx",
  "screens/pessoas/ColaboradoresScreen.test.tsx",
  "screens/pessoas/DadosContratuaisScreen.test.tsx",
  "screens/pessoas/HistoricoFuncionalScreen.test.tsx",
  "screens/pessoas/PessoasDocumentosScreen.test.tsx",
  "screens/pessoas/PessoasHorarioScreen.test.tsx",
  "screens/pessoas/SolicitacoesScreen.test.tsx",
  "screens/ponto/VisaoPeriodoScreen.test.tsx",
  "screens/solicitacoes-rh/CentralSolicitacoesRHScreen.test.tsx",
];

/**
 * Exceção técnica única e documentada.
 *
 * `limitesCompetencia` deriva os limites `[início, fim)` da competência em
 * ISO para COMPARAR com `vigenciaInicio`/`vigenciaFim` por ordem de string.
 * Não formata nada para a tela, e trocar por `formatarDiaCivil` quebraria a
 * comparação. Fica, com nome e motivo.
 */
const EXCECAO_TECNICA = "screens/ponto/VisaoPeriodoScreen.tsx";

/**
 * Este próprio arquivo.
 *
 * Os padrões procurados são literais escritos aqui: sem esta exclusão, o
 * scanner é o primeiro infrator que ele encontra. Aconteceu na primeira
 * execução.
 */
const ESTE_ARQUIVO = "test/formatacaoCentralizada.test.ts";

describe("formatação de data centralizada", () => {
  it("T154.35 a varredura cobre o projeto inteiro", () => {
    expect(ARQUIVOS.length).toBeGreaterThan(50);
    expect(FORA_DO_MODULO_CENTRAL.length).toBeGreaterThan(50);
  });

  it("T154.36 nenhum formatador de data LOCAL fora de `format/`", () => {
    // Qualquer função cujo nome anuncie formatação de data é uma segunda
    // regra. A camada de apresentação de datas é `format/data.ts`, e só ela.
    const PADRAO =
      /(?:export\s+)?function\s+(formatarData\w*|formatarDia\w*|formatarMomento\w*|formatarInstante\w*|formatarCompetencia\w*|formatarHora\w*)\s*\(/g;

    const infratores: string[] = [];
    for (const arquivo of FORA_DO_MODULO_CENTRAL) {
      const linhas = readFileSync(arquivo, "utf8").split(/\r?\n/);
      linhas.forEach((linha, i) => {
        PADRAO.lastIndex = 0;
        let casado: RegExpExecArray | null;
        while ((casado = PADRAO.exec(linha)) !== null) {
          infratores.push(`${rel(arquivo)}:${i + 1} → ${casado[1]}`);
        }
      });
    }

    expect(infratores).toEqual([]);
  });

  it("T154.37 nenhum `split` de data, `toLocale*` ou `Intl` fora de `format/`", () => {
    const PADROES: ReadonlyArray<readonly [string, RegExp]> = [
      ["split de ISO", /\.split\("-"\)/g],
      ["toLocaleDateString", /toLocaleDateString/g],
      ["toLocaleTimeString", /toLocaleTimeString/g],
      ["toLocaleString", /\.toLocaleString\(/g],
      ["Intl.DateTimeFormat", /Intl\.DateTimeFormat/g],
      ['replace("T"', /replace\("T"/g],
    ];

    const infratores: string[] = [];
    for (const arquivo of FORA_DO_MODULO_CENTRAL) {
      if (rel(arquivo) === EXCECAO_TECNICA) continue;
      if (rel(arquivo) === ESTE_ARQUIVO) continue; // os padrões acima são literais daqui
      const linhas = readFileSync(arquivo, "utf8").split(/\r?\n/);
      for (const [nome, re] of PADROES) {
        linhas.forEach((linha, i) => {
          re.lastIndex = 0;
          if (re.test(linha)) {
            infratores.push(`${rel(arquivo)}:${i + 1} → ${nome}`);
          }
        });
      }
    }

    expect(infratores).toEqual([]);
  });

  it("T154.38 a exceção técnica continua sendo só cálculo de intervalo", () => {
    const txt = readFileSync(join(RAIZ, EXCECAO_TECNICA), "utf8");
    // O único `split("-")` que sobra está dentro de `limitesCompetencia`, e
    // o resultado alimenta comparação de intervalo, nunca a tela.
    expect((txt.match(/\.split\("-"\)/g) ?? []).length).toBe(1);
    expect(txt).toContain("function limitesCompetencia");
    expect(txt).toContain("vigenciaSeSobrepoe");
    // E a tela continua usando o formatador central para exibir.
    expect(txt).toContain("formatarDiaCivil");
    expect(txt).toContain("formatarInstante");
  });

  it("T154.39 a camada `api/` não formata data para a tela", () => {
    const naApi = FORA_DO_MODULO_CENTRAL.filter((f) =>
      rel(f).startsWith("api/"),
    );
    expect(naApi.length).toBeGreaterThan(5);

    // Procura USO, não menção: o cliente de solicitações tem um comentário
    // mandando quem for exibir usar `formatarDiaCivil` — isso DOCUMENTA a
    // fronteira, não a viola. O que não pode é chamar ou importar.
    const USOS: ReadonlyArray<readonly [string, RegExp]> = [
      ["chama formatarDiaCivil", /formatarDiaCivil\s*\(/],
      ["chama formatarInstante", /formatarInstante\s*\(/],
      ["chama formatarMesReferencia", /formatarMesReferencia\s*\(/],
      ["importa de format/", /import\s[^;]*from\s+"[^"]*format\/data"/],
      ["toLocaleDateString", /toLocaleDateString\s*\(/],
      ["split de ISO", /\.split\("-"\)/],
    ];

    const infratores: string[] = [];
    for (const arquivo of naApi) {
      const txt = readFileSync(arquivo, "utf8");
      for (const [nome, re] of USOS) {
        if (re.test(txt)) infratores.push(`${rel(arquivo)} → ${nome}`);
      }
    }

    // Cliente HTTP é transporte. Formatar ali quebra a camada e, pior, some
    // no teste: a tela mocka o cliente inteiro e o formatador vira `undefined`.
    expect(infratores).toEqual([]);
  });

  /**
   * Chamada que o teste REALMENTE executa.
   *
   * `includes("expectSemIsoVisivel(")` não serve: comentar a linha mantém a
   * string no arquivo e a cobertura some em silêncio. Foi o que uma mutação
   * desta rodada provou — ela sobreviveu. Agora a linha precisa ser código.
   */
  function chamadasEfetivas(superficie: string): number {
    return readFileSync(join(RAIZ, superficie), "utf8")
      .split(/\r?\n/)
      .filter((linha) => {
        const t = linha.trim();
        if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) {
          return false;
        }
        return t.includes("expectSemIsoVisivel(");
      }).length;
  }

  it("T154.40 a guarda cobre as 12 superfícies alteradas pela T154", () => {
    const semGuarda = SUPERFICIES_DA_T154.filter(
      (superficie) => chamadasEfetivas(superficie) === 0,
    );

    expect(semGuarda).toEqual([]);
    expect(SUPERFICIES_DA_T154).toHaveLength(12);
  });

  it("T154.42 comentar a chamada não conta como cobertura", () => {
    // Prova direta de que `chamadasEfetivas` ignora código comentado: sem
    // isto, a correção acima seria indistinguível da versão defeituosa.
    const linhas = [
      "    expectSemIsoVisivel(document.body);",
      "    // expectSemIsoVisivel(document.body);",
      "     * expectSemIsoVisivel(document.body);",
    ];
    const efetivas = linhas.filter((linha) => {
      const t = linha.trim();
      if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) {
        return false;
      }
      return t.includes("expectSemIsoVisivel(");
    });
    expect(efetivas).toHaveLength(1);
  });

  it("T154.41 a guarda é importada do módulo central, nunca reimplementada", () => {
    // Doze implementações da mesma regra envelhecem em doze ritmos.
    for (const superficie of SUPERFICIES_DA_T154) {
      const txt = readFileSync(join(RAIZ, superficie), "utf8");
      expect(txt).toMatch(
        /import \{[^}]*expectSemIsoVisivel[^}]*\} from "[^"]*test\/semIsoVisivel"/,
      );
      // Nenhuma cópia local do regex.
      expect(txt).not.toContain("ISO_DIA");
      expect(txt).not.toContain("MARCAS_DE_INSTANTE");
    }
  });
});
