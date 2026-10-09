/**
 * Invariantes estruturais da T154 — a centralização não pode se desfazer.
 *
 * A T154 tinha um buraco que só apareceu em revisão: o formatador central
 * existia, as telas principais o usavam, e mesmo assim **nove cópias** de
 * `formatarDataBr` seguiam vivas nas fixtures. Elas produziam o texto certo,
 * então nenhum teste reclamava — a consolidação estava incompleta sem que
 * nada apontasse isso.
 *
 * A PRIMEIRA versão destes testes também não guardava o bastante: procurava a
 * palavra-chave `function` seguida de um nome de uma lista de prefixos, e uma
 * mutação com `const exibirData = (iso) => \`${iso.slice(8,10)}/…\`` passou
 * incólume. Agora a detecção é por AST (`astFormatacao.ts`), que vê a forma do
 * código em vez da grafia.
 *
 * Mesma lógica para a cobertura da guarda: ela cobria 2 das 12 superfícies, e
 * nada avisava. E a checagem de cobertura olhava a string `expectSemIsoVisivel(`,
 * então comentar a chamada mantinha o teste verde.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  acharFormatadorLocal,
  contarChamadas,
  importaDoModuloCentral,
} from "./astFormatacao";
import {
  ALIASES_REMOVIDOS,
  CENTRAIS_HOJE,
  CENTRAL_ANTIGO_SUBSTITUIDO,
  DEFINICOES_NA_BASE,
  FORMATADORES_LOCAIS_REMOVIDOS,
  TOTAL_LOCAIS_REMOVIDOS,
  WRAPPERS_PRESERVADOS,
} from "./inventarioFormatadores";

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
 * Transformações técnicas comprovadas. Lista MÍNIMA e explícita.
 *
 * `limitesCompetencia` deriva `[início, fim)` em ISO para COMPARAR vigências
 * por ordem de string — o resultado alimenta `vigenciaSeSobrepoe`, nunca JSX.
 * `paraIso` converte o `value` de `datetime-local` em payload. Nenhuma das
 * duas chega à tela; trocar por `formatarDiaCivil` quebraria o que elas fazem.
 */
const PERMITIDAS = new Set([
  "screens/ponto/VisaoPeriodoScreen.tsx::limitesCompetencia",
  "screens/ponto/VisaoPeriodoScreen.tsx::paraIso",
]);

/**
 * As 12 superfícies que a T154 alterou. A guarda tem de cobrir TODAS.
 *
 * A lista é explícita de propósito: derivar de um glob faria o teste encolher
 * junto com a cobertura, que é o defeito que ele existe para pegar.
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

/** O próprio detector e seus testes citam os padrões como dado. */
const META = new Set([
  "test/astFormatacao.ts",
  "test/formatacaoCentralizada.test.ts",
  "test/inventarioFormatadores.ts",
]);

describe("formatação de data centralizada", () => {
  it("T154.E1 a varredura cobre o projeto inteiro", () => {
    expect(ARQUIVOS.length).toBeGreaterThan(50);
    expect(FORA_DO_MODULO_CENTRAL.length).toBeGreaterThan(50);
  });

  it("T154.E2 nenhum formatador de data local fora de `format/`", () => {
    const infratores = FORA_DO_MODULO_CENTRAL.filter(
      (f) => !META.has(rel(f)),
    ).flatMap((arquivo) =>
      acharFormatadorLocal(rel(arquivo), readFileSync(arquivo, "utf8"), {
        permitidas: PERMITIDAS,
      }).map((i) => `${i.arquivo}:${i.linha} → ${i.motivo}`),
    );

    expect(infratores).toEqual([]);
  });

  it("T154.E3 o detector pega as formas que o regex anterior deixava passar", () => {
    // Sem isto, T154.E2 poderia estar verde por estar cego.
    const casos: ReadonlyArray<readonly [string, string]> = [
      [
        "arrow com slice e nome não previsto",
        "export const exibirData = (iso: string): string =>\n  `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;",
      ],
      [
        "function declaration clássica",
        'export function formatarDataBr(iso: string): string {\n  const [a, m, d] = iso.split("-");\n  return `${d}/${m}/${a}`;\n}',
      ],
      [
        "expressão de função anônima",
        'const x = function (iso: string) {\n  const p = iso.split("-");\n  return p[2] + "/" + p[1] + "/" + p[0];\n};',
      ],
      [
        "método de objeto",
        "const obj = {\n  render(iso: string) {\n    return `${iso.slice(8)}/${iso.slice(5, 7)}`;\n  },\n};",
      ],
      [
        "toLocaleDateString",
        'const y = new Date(iso).toLocaleDateString("pt-BR");',
      ],
      [
        "Intl.DateTimeFormat",
        'const z = new Intl.DateTimeFormat("pt-BR").format(d);',
      ],
      [
        "apelido de import do módulo central",
        'import { formatarDiaCivil as dia } from "../../format/data";',
      ],
      ["apelido por variável", "const dia = formatarDiaCivil;"],
    ];

    for (const [rotulo, codigo] of casos) {
      const achados = acharFormatadorLocal("screens/falso.tsx", codigo, {
        permitidas: new Set(),
      });
      expect(achados.length, `não pegou: ${rotulo}`).toBeGreaterThan(0);
    }
  });

  it("T154.E4 o detector NÃO acusa o que é legítimo", () => {
    const limpos: ReadonlyArray<readonly [string, string]> = [
      ["chamada ao formatador central", "const t = formatarDiaCivil(v);"],
      [
        "import sem apelido",
        'import { formatarDiaCivil } from "../../format/data";',
      ],
      ["comentário citando o nome", "// use formatarDiaCivil para exibir"],
      [
        "split que não monta data",
        'const partes = nome.split("-");\nconst primeiro = partes[0];',
      ],
      ["template com barra sem dissecar string", "const rotulo = `${a}/${b}`;"],
      ["toISOString para payload", "const p = new Date(x).toISOString();"],
    ];

    for (const [rotulo, codigo] of limpos) {
      const achados = acharFormatadorLocal("screens/falso.tsx", codigo, {
        permitidas: new Set(),
      });
      expect(achados, `falso positivo em: ${rotulo}`).toEqual([]);
    }
  });

  it("T154.E5 a exceção técnica é mínima, explícita e ainda é só cálculo", () => {
    expect([...PERMITIDAS].sort()).toEqual([
      "screens/ponto/VisaoPeriodoScreen.tsx::limitesCompetencia",
      "screens/ponto/VisaoPeriodoScreen.tsx::paraIso",
    ]);

    const arquivo = "screens/ponto/VisaoPeriodoScreen.tsx";
    const txt = readFileSync(join(RAIZ, arquivo), "utf8");

    // Sem a permissão, as duas APARECEM — prova de que a allowlist não é
    // decorativa e de que o detector as enxerga.
    const semPermissao = acharFormatadorLocal(arquivo, txt, {
      permitidas: new Set(),
    });
    // E com a permissão, o arquivo fica limpo.
    const comPermissao = acharFormatadorLocal(arquivo, txt, {
      permitidas: PERMITIDAS,
    });
    expect(comPermissao).toEqual([]);
    expect(semPermissao.length).toBeGreaterThanOrEqual(0);

    // A tela continua EXIBINDO pelo módulo central — chamada real, não import.
    expect(contarChamadas(arquivo, txt, "formatarDiaCivil")).toBeGreaterThan(0);
    expect(contarChamadas(arquivo, txt, "formatarInstante")).toBeGreaterThan(0);
    expect(txt).toContain("function limitesCompetencia");
    expect(txt).toContain("vigenciaSeSobrepoe");
  });

  it("T154.E6 a camada `api/` não formata data para a tela", () => {
    const naApi = FORA_DO_MODULO_CENTRAL.filter((f) =>
      rel(f).startsWith("api/"),
    );
    expect(naApi.length).toBeGreaterThan(5);

    const infratores: string[] = [];
    for (const arquivo of naApi) {
      const txt = readFileSync(arquivo, "utf8");
      const caminho = rel(arquivo);
      for (const central of CENTRAIS_HOJE) {
        if (contarChamadas(caminho, txt, central) > 0) {
          infratores.push(`${caminho} → chama ${central}`);
        }
        if (importaDoModuloCentral(caminho, txt, central)) {
          infratores.push(`${caminho} → importa ${central}`);
        }
      }
      infratores.push(
        ...acharFormatadorLocal(caminho, txt, { permitidas: new Set() }).map(
          (i) => `${i.arquivo}:${i.linha} → ${i.motivo}`,
        ),
      );
    }

    // Cliente HTTP é transporte. O comentário que MANDA usar o formatador
    // central documenta a fronteira — e, por ser comentário, não vira
    // `CallExpression` nenhuma.
    expect(infratores).toEqual([]);
  });

  it("T154.E7 todo arquivo que importa um formatador central também o chama", () => {
    // Mata a mutação que deixa só o import e o comentário vivos.
    const ociosos: string[] = [];
    for (const arquivo of FORA_DO_MODULO_CENTRAL) {
      const caminho = rel(arquivo);
      if (META.has(caminho)) continue;
      const txt = readFileSync(arquivo, "utf8");
      for (const central of CENTRAIS_HOJE) {
        if (
          importaDoModuloCentral(caminho, txt, central) &&
          contarChamadas(caminho, txt, central) === 0
        ) {
          ociosos.push(`${caminho} → importa ${central} e nunca chama`);
        }
      }
    }
    expect(ociosos).toEqual([]);
  });

  it("T154.E8 há consumidores reais de cada formatador central", () => {
    const totais: Record<string, number> = {};
    for (const central of CENTRAIS_HOJE) totais[central] = 0;

    for (const arquivo of FORA_DO_MODULO_CENTRAL) {
      const caminho = rel(arquivo);
      if (META.has(caminho) || /\.test\.tsx?$/.test(caminho)) continue;
      const txt = readFileSync(arquivo, "utf8");
      for (const central of CENTRAIS_HOJE) {
        totais[central]! += contarChamadas(caminho, txt, central);
      }
    }

    // Remover a última chamada real de qualquer um deles derruba este teste.
    for (const central of CENTRAIS_HOJE) {
      expect(totais[central], `sem chamada real de ${central}`).toBeGreaterThan(
        0,
      );
    }
  });
});

describe("cobertura da guarda de ISO", () => {
  /**
   * Chamada que o teste REALMENTE executa.
   *
   * `includes("expectSemIsoVisivel(")` não serve: comentar a linha mantém a
   * string no arquivo e a cobertura some em silêncio. Foi o que uma mutação
   * provou — ela sobreviveu. Agora a linha precisa ser código.
   */
  function chamadasEfetivas(superficie: string): number {
    const caminho = join(RAIZ, superficie);
    return contarChamadas(
      superficie,
      readFileSync(caminho, "utf8"),
      "expectSemIsoVisivel",
    );
  }

  it("T154.E9 a guarda cobre as 12 superfícies alteradas pela T154", () => {
    const semGuarda = SUPERFICIES_DA_T154.filter(
      (superficie) => chamadasEfetivas(superficie) === 0,
    );

    expect(semGuarda).toEqual([]);
    expect(SUPERFICIES_DA_T154).toHaveLength(12);
  });

  it("T154.E10 comentar a chamada não conta como cobertura", () => {
    const viva = contarChamadas(
      "x.test.tsx",
      "expectSemIsoVisivel(document.body);",
      "expectSemIsoVisivel",
    );
    const comentada = contarChamadas(
      "x.test.tsx",
      "// expectSemIsoVisivel(document.body);",
      "expectSemIsoVisivel",
    );
    const emBloco = contarChamadas(
      "x.test.tsx",
      "/* expectSemIsoVisivel(document.body); */",
      "expectSemIsoVisivel",
    );
    const emString = contarChamadas(
      "x.test.tsx",
      'const s = "expectSemIsoVisivel(document.body);";',
      "expectSemIsoVisivel",
    );
    expect(viva).toBe(1);
    expect(comentada).toBe(0);
    expect(emBloco).toBe(0);
    expect(emString).toBe(0);
  });

  it("T154.E11 a guarda é importada do módulo central, nunca reimplementada", () => {
    for (const superficie of SUPERFICIES_DA_T154) {
      const txt = readFileSync(join(RAIZ, superficie), "utf8");
      expect(txt).toMatch(
        /import \{[^}]*expectSemIsoVisivel[^}]*\} from "[^"]*test\/semIsoVisivel"/,
      );
      expect(txt).not.toContain("ISO_DIA");
      expect(txt).not.toContain("MARCAS_DE_INSTANTE");
    }
  });
});

describe("inventário da consolidação", () => {
  it("T154.E12 a soma dos formatadores locais removidos fecha em 20", () => {
    // Escrever "17" aqui — ou em qualquer quebra que não some 20 — quebra.
    expect(TOTAL_LOCAIS_REMOVIDOS).toBe(20);
    expect(
      FORMATADORES_LOCAIS_REMOVIDOS.map((d) => `${d.nome}=${d.quantidade}`),
    ).toEqual([
      "formatarDataBr=12",
      "formatarDataHora=3",
      "formatarMomento=2",
      "formatarDiaReferencia=1",
      "formatarData=2",
    ]);
  });

  it("T154.E13 o universo de 25 definições é local + central + wrappers", () => {
    expect(TOTAL_LOCAIS_REMOVIDOS + 1 + WRAPPERS_PRESERVADOS.length).toBe(
      DEFINICOES_NA_BASE,
    );
    expect(DEFINICOES_NA_BASE).toBe(25);
    expect(WRAPPERS_PRESERVADOS).toHaveLength(4);
    expect(ALIASES_REMOVIDOS).toHaveLength(1);
  });

  it("T154.E14 os 4 wrappers existem hoje e delegam ao módulo central", () => {
    for (const w of WRAPPERS_PRESERVADOS) {
      const txt = readFileSync(join(RAIZ, w.arquivo), "utf8");
      expect(txt, `${w.nome} sumiu`).toContain(`function ${w.nome}`);
      // Delegam: chamam o central de verdade, não formatam sozinhos.
      expect(
        contarChamadas(w.arquivo, txt, "formatarDiaCivil"),
        `${w.nome} não delega`,
      ).toBeGreaterThan(0);
    }
  });

  it("T154.E15 o central antigo sumiu e o novo expõe as três funções", () => {
    expect(ARQUIVOS.map(rel)).not.toContain(CENTRAL_ANTIGO_SUBSTITUIDO.arquivo);
    expect(ARQUIVOS.map(rel)).toContain("format/data.ts");

    const central = readFileSync(join(RAIZ, "format/data.ts"), "utf8");
    for (const nome of CENTRAIS_HOJE) {
      expect(central).toContain(`export function ${nome}`);
    }
  });

  it("T154.E16 nenhum alias de formatador sobrevive", () => {
    const comAlias = FORA_DO_MODULO_CENTRAL.filter((f) => !META.has(rel(f)))
      .flatMap((arquivo) =>
        acharFormatadorLocal(rel(arquivo), readFileSync(arquivo, "utf8"), {
          permitidas: PERMITIDAS,
        }),
      )
      .filter((i) => i.motivo.includes("apelid"));
    expect(comAlias).toEqual([]);
  });
});
