/**
 * T212 — planilha `.xlsx`: o modelo gerado no navegador a partir da mesma
 * definição de colunas do importador, e a leitura da aba Colaboradores para
 * a mesma estrutura do CSV (e, daí, a mesma conferência).
 */
import { describe, expect, it } from "vitest";
import {
  COLUNAS_DO_MODELO,
  LIMITE_DE_LINHAS,
  NOME_DA_LINHA_DE_EXEMPLO,
  TIPOS_ACEITOS,
  conferirPlanilha,
  lerPlanilha,
  lerSalarioDaPlanilha,
  type Referencias,
} from "./planilhaColaboradores";
import {
  ABA_COLABORADORES,
  ABA_EXEMPLOS,
  ABA_INSTRUCOES,
  NOME_DO_MODELO_XLSX,
  gerarModeloXlsx,
  lerAbasXlsx,
  lerPlanilhaXlsx,
  montarXlsx,
  type CelulaXlsx,
} from "./planilhaXlsx";

const CABECALHO: readonly string[] = [
  "nome",
  "tipo_vinculo",
  "data_admissao",
  "data_nascimento",
  "departamento_codigo",
  "cargo_codigo",
  "salario",
  "matricula",
  "unidade_codigo",
];

const REFERENCIAS: Referencias = {
  departamentos: [{ id: "dep-1", codigo: "ADM" }],
  cargos: [{ id: "car-1", codigo: "ANALISTA" }],
  unidades: [{ id: "uni-1", codigo: "SEDE" }],
};

const LINHA_VALIDA: readonly string[] = [
  "Pessoa Sintética Um",
  "clt",
  "01/12/2026",
  "15/05/1990",
  "ADM",
  "ANALISTA",
  "1.621,00",
  "",
  "SEDE",
];

/** Uma pasta com a aba Colaboradores e as linhas dadas. */
function pasta(
  linhas: ReadonlyArray<ReadonlyArray<CelulaXlsx>>,
  opcoes: Parameters<typeof montarXlsx>[1] = {},
): Uint8Array {
  return montarXlsx([{ nome: ABA_COLABORADORES, linhas }], opcoes);
}

async function erroDe(bytes: Uint8Array): Promise<string> {
  const lida = await lerPlanilhaXlsx(bytes);
  if (!("erro" in lida)) throw new Error("esperava erro de arquivo");
  return lida.erro;
}

describe("T212 — modelo .xlsx", () => {
  it("o cabeçalho técnico vem da mesma definição de colunas do importador", () => {
    expect([...COLUNAS_DO_MODELO]).toEqual(CABECALHO);
  });

  it("é um ZIP (.xlsx) com as abas Colaboradores, Exemplos e Instruções, nessa ordem", async () => {
    const bytes = gerarModeloXlsx();
    expect([...bytes.slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
    expect(Object.keys(await lerAbasXlsx(bytes))).toEqual([
      ABA_COLABORADORES,
      ABA_EXEMPLOS,
      ABA_INSTRUCOES,
    ]);
    expect(NOME_DO_MODELO_XLSX).toMatch(/\.xlsx$/);
  });

  it("Colaboradores: a 1ª linha é o cabeçalho exato e a 2ª, a linha sintética oficial", async () => {
    const abas = await lerAbasXlsx(gerarModeloXlsx());
    const linhas = abas[ABA_COLABORADORES]!;
    expect(linhas[0]).toEqual(CABECALHO);
    expect(linhas[1]![0]).toBe(NOME_DA_LINHA_DE_EXEMPLO);
    expect(linhas).toHaveLength(2);
    // Nada fora das 9 colunas.
    for (const linha of linhas) expect(linha.length).toBeLessThanOrEqual(9);
  });

  it("a linha sintética é lida e recusada pela conferência (apagar antes de enviar)", async () => {
    const lida = await lerPlanilhaXlsx(gerarModeloXlsx());
    if ("erro" in lida) throw new Error(lida.erro);
    const [linha] = conferirPlanilha(lida, REFERENCIAS, "2026-11-18");
    expect(linha!.admissao).toBeNull();
    expect(linha!.erros).toContainEqual({
      campo: "Nome",
      motivo: "é a linha de exemplo do modelo; apague-a antes de importar",
    });
  });

  it("Exemplos: cabeçalho igual e só linhas fictícias nos 9 campos, com tipos aceitos e salário", async () => {
    const linhas = (await lerAbasXlsx(gerarModeloXlsx()))[ABA_EXEMPLOS]!;
    expect(linhas[0]).toEqual(CABECALHO);
    expect(linhas.length).toBeGreaterThanOrEqual(3);
    const tipos = new Set(TIPOS_ACEITOS.map(([codigo]) => codigo));
    for (const linha of linhas.slice(1)) {
      expect(linha.length).toBeLessThanOrEqual(9);
      expect(linha[0]).toMatch(/Fictíci[oa]/);
      expect(tipos.has(linha[1] as never)).toBe(true);
      expect(lerSalarioDaPlanilha(String(linha[6]))).not.toBeNull();
    }
  });

  it("Instruções: códigos ativos, obrigatórios, tipos, datas, limites, Excel, Google Planilhas e CSV", async () => {
    const abas = await lerAbasXlsx(gerarModeloXlsx());
    const texto = abas[ABA_INSTRUCOES]!.flat().join("\n");
    for (const trecho of [
      /códigos? ativos?/i,
      /obrigatóri/i,
      /DD\/MM\/AAAA/,
      new RegExp(`${LIMITE_DE_LINHAS} linhas`),
      /1 MB/,
      /Excel/,
      /Google Planilhas/,
      /CSV/,
      /apague/i,
      /sal[aá]rio/i,
    ]) {
      expect(texto).toMatch(trecho);
    }
    for (const [, rotulo] of TIPOS_ACEITOS) expect(texto).toContain(rotulo);
  });

  it("nenhum dado proibido: sem CPF, RG, contatos, endereço ou foto (o salário da admissão é obrigatório desde a T215)", async () => {
    const abas = await lerAbasXlsx(gerarModeloXlsx());
    const cabecalhos = [
      abas[ABA_COLABORADORES]![0]!,
      abas[ABA_EXEMPLOS]![0]!,
    ].flat();
    for (const proibido of [
      /cpf/i,
      /\brg\b/i,
      /telefone|e-?mail|contato/i,
      /endere[cç]o|cep/i,
      /foto/i,
    ]) {
      expect(cabecalhos.join(" ")).not.toMatch(proibido);
    }
  });

  it("colunas de texto na aba Colaboradores e lista de tipos em tipo_vinculo", async () => {
    const { arquivos } = await lerAbasXlsx.cru(gerarModeloXlsx());
    const folha = arquivos["xl/worksheets/sheet1.xml"]!;
    expect(folha).toMatch(
      /<dataValidation[^>]*type="list"[^>]*sqref="B2:B201"/,
    );
    for (const [codigo] of TIPOS_ACEITOS) expect(folha).toContain(codigo);
    expect(folha).toMatch(/<pane[^>]*state="frozen"/);
    expect(arquivos["xl/styles.xml"]).toMatch(/numFmtId="49"/);
  });

  it("ida e volta: o que o modelo grava, a leitura devolve", async () => {
    const bytes = pasta([CABECALHO, LINHA_VALIDA]);
    const lida = await lerPlanilhaXlsx(bytes);
    if ("erro" in lida) throw new Error(lida.erro);
    expect(lida.colunas).toEqual(CABECALHO);
    expect(lida.linhas).toEqual([
      {
        numero: 2,
        sobra: false,
        valores: Object.fromEntries(
          CABECALHO.map((coluna, i) => [coluna, LINHA_VALIDA[i]]),
        ),
      },
    ]);
  });
});

describe("T212 — leitura: a mesma conferência do CSV", () => {
  it("a mesma linha em .xlsx e em .csv chega à mesma conferência", async () => {
    const xlsx = await lerPlanilhaXlsx(pasta([CABECALHO, LINHA_VALIDA]));
    const csv = lerPlanilha(
      [CABECALHO.join(";"), LINHA_VALIDA.join(";")].join("\r\n"),
    );
    if ("erro" in xlsx || "erro" in csv) throw new Error("leitura");
    expect(conferirPlanilha(xlsx, REFERENCIAS, "2026-11-18")).toEqual(
      conferirPlanilha(csv, REFERENCIAS, "2026-11-18"),
    );
    expect(
      conferirPlanilha(xlsx, REFERENCIAS, "2026-11-18")[0]!.admissao,
    ).toMatchObject({ departamentoId: "dep-1", cargoId: "car-1" });
  });

  it("erro por linha: código inativo/inexistente recusa só a linha, com campo e motivo", async () => {
    const lida = await lerPlanilhaXlsx(
      pasta([
        CABECALHO,
        LINHA_VALIDA,
        [
          "Pessoa Sintética Dois",
          "clt",
          "01/12/2026",
          "15/05/1991",
          "NAO-EXISTE",
          "ANALISTA",
          "1.621,00",
        ],
      ]),
    );
    if ("erro" in lida) throw new Error(lida.erro);
    const [primeira, segunda] = conferirPlanilha(
      lida,
      REFERENCIAS,
      "2026-11-18",
    );
    expect(primeira!.erros).toEqual([]);
    expect(segunda!.numero).toBe(3);
    expect(segunda!.admissao).toBeNull();
    expect(segunda!.erros.map((e) => e.campo)).toEqual(["Departamento"]);
  });

  it("linhas vazias são ignoradas e o número é a linha da planilha", async () => {
    const lida = await lerPlanilhaXlsx(
      pasta([CABECALHO, [], ["", "", ""], LINHA_VALIDA]),
    );
    if ("erro" in lida) throw new Error(lida.erro);
    expect(lida.linhas.map((l) => l.numero)).toEqual([4]);
  });

  it("datas guardadas como número de data do Excel viram DD/MM/AAAA (1900 e 1904)", async () => {
    // 46357 = 01/12/2026; 32978 = 15/04/1990 no sistema de 1900.
    const linha: CelulaXlsx[] = [...LINHA_VALIDA];
    linha[2] = 46357;
    linha[3] = 32978;
    const lida = await lerPlanilhaXlsx(pasta([CABECALHO, linha]));
    if ("erro" in lida) throw new Error(lida.erro);
    expect(lida.linhas[0]!.valores.data_admissao).toBe("01/12/2026");
    expect(lida.linhas[0]!.valores.data_nascimento).toBe("15/04/1990");

    // Sistema de 1904: o mesmo dia é 1462 a menos.
    linha[2] = 46357 - 1462;
    const em1904 = await lerPlanilhaXlsx(
      pasta([CABECALHO, linha], { datas1904: true }),
    );
    if ("erro" in em1904) throw new Error(em1904.erro);
    expect(em1904.linhas[0]!.valores.data_admissao).toBe("01/12/2026");
  });

  it("matrícula digitada como número vira texto sem casas decimais", async () => {
    const linha: CelulaXlsx[] = [...LINHA_VALIDA];
    linha[7] = 1234;
    const lida = await lerPlanilhaXlsx(pasta([CABECALHO, linha]));
    if ("erro" in lida) throw new Error(lida.erro);
    expect(lida.linhas[0]!.valores.matricula).toBe("1234");
  });

  it("textos compartilhados (como o Excel grava) também são lidos", async () => {
    const lida = await lerPlanilhaXlsx(
      pasta([CABECALHO, LINHA_VALIDA], { textosCompartilhados: true }),
    );
    if ("erro" in lida) throw new Error(lida.erro);
    expect(lida.linhas[0]!.valores.nome).toBe("Pessoa Sintética Um");
  });

  it("só a aba Colaboradores é lida, mesmo que não seja a primeira", async () => {
    const bytes = montarXlsx([
      { nome: ABA_INSTRUCOES, linhas: [["texto qualquer"]] },
      { nome: ABA_COLABORADORES, linhas: [CABECALHO, LINHA_VALIDA] },
    ]);
    const lida = await lerPlanilhaXlsx(bytes);
    if ("erro" in lida) throw new Error(lida.erro);
    expect(lida.linhas).toHaveLength(1);
  });
});

/** CRC32 (só para montar o ZIP comprimido do teste). */
function crc32Teste(dados: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of dados) {
    crc ^= byte;
    for (let k = 0; k < 8; k += 1) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

async function deflate(dados: Uint8Array): Promise<Uint8Array> {
  const fluxo = new CompressionStream("deflate-raw");
  const escritor = fluxo.writable.getWriter();
  void escritor.write(dados as unknown as BufferSource);
  void escritor.close();
  return new Uint8Array(await new Response(fluxo.readable).arrayBuffer());
}

/**
 * O mesmo `.xlsx`, com cada entrada comprimida (método 8), como o Excel e o
 * Google Planilhas gravam.
 */
async function comprimido(bytes: Uint8Array): Promise<Uint8Array> {
  const { arquivos } = await lerAbasXlsx.cru(bytes);
  const partes: Uint8Array[] = [];
  const centrais: Uint8Array[] = [];
  let deslocamento = 0;
  for (const [nome, texto] of Object.entries(arquivos)) {
    const dados = new TextEncoder().encode(texto);
    const comp = await deflate(dados);
    const nomeB = new TextEncoder().encode(nome);
    const local = new Uint8Array(30 + nomeB.length);
    const l = new DataView(local.buffer);
    l.setUint32(0, 0x04034b50, true);
    l.setUint16(4, 20, true);
    l.setUint16(8, 8, true);
    l.setUint32(14, crc32Teste(dados), true);
    l.setUint32(18, comp.length, true);
    l.setUint32(22, dados.length, true);
    l.setUint16(26, nomeB.length, true);
    local.set(nomeB, 30);
    const central = new Uint8Array(46 + nomeB.length);
    const c = new DataView(central.buffer);
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true);
    c.setUint16(6, 20, true);
    c.setUint16(10, 8, true);
    c.setUint32(16, crc32Teste(dados), true);
    c.setUint32(20, comp.length, true);
    c.setUint32(24, dados.length, true);
    c.setUint16(28, nomeB.length, true);
    c.setUint32(42, deslocamento, true);
    central.set(nomeB, 46);
    partes.push(local, comp);
    centrais.push(central);
    deslocamento += local.length + comp.length;
  }
  const tamCentral = centrais.reduce((t, x) => t + x.length, 0);
  const fim = new Uint8Array(22);
  const f = new DataView(fim.buffer);
  f.setUint32(0, 0x06054b50, true);
  f.setUint16(8, centrais.length, true);
  f.setUint16(10, centrais.length, true);
  f.setUint32(12, tamCentral, true);
  f.setUint32(16, deslocamento, true);
  const todas = [...partes, ...centrais, fim];
  const saida = new Uint8Array(todas.reduce((t, x) => t + x.length, 0));
  let i = 0;
  for (const p of todas) {
    saida.set(p, i);
    i += p.length;
  }
  return saida;
}

describe("T212 — .xlsx comprimido (como o Excel grava)", () => {
  it("as entradas DEFLATE são lidas pela API nativa e chegam à mesma conferência", async () => {
    const bytes = await comprimido(
      pasta([CABECALHO, LINHA_VALIDA], { textosCompartilhados: true }),
    );
    const lida = await lerPlanilhaXlsx(bytes);
    if ("erro" in lida) throw new Error(lida.erro);
    expect(lida.linhas[0]!.valores.nome).toBe("Pessoa Sintética Um");
    expect(conferirPlanilha(lida, REFERENCIAS, "2026-11-18")[0]!.erros).toEqual(
      [],
    );
  });

  it("o modelo comprimido continua com as três abas", async () => {
    const abas = await lerAbasXlsx(await comprimido(gerarModeloXlsx()));
    expect(Object.keys(abas)).toEqual([
      ABA_COLABORADORES,
      ABA_EXEMPLOS,
      ABA_INSTRUCOES,
    ]);
  });

  it("entrada comprimida corrompida recusa o arquivo, sem travar", async () => {
    const bytes = await comprimido(pasta([CABECALHO, LINHA_VALIDA]));
    // Estraga os dados comprimidos da primeira entrada.
    const estragado = bytes.slice();
    for (let i = 60; i < 90; i += 1) estragado[i] = 0xff;
    expect(await erroDe(estragado)).toMatch(
      /não é uma planilha \.xlsx|corrompid/i,
    );
  });
});

describe("T212 — recusas do arquivo inteiro", () => {
  it("cabeçalho alterado (nome, ordem ou coluna faltando)", async () => {
    const renomeado = [...CABECALHO];
    renomeado[0] = "nome_completo";
    expect(await erroDe(pasta([renomeado, LINHA_VALIDA]))).toMatch(
      /cabeçalho/i,
    );
    const trocado = [...CABECALHO];
    [trocado[2], trocado[3]] = [trocado[3]!, trocado[2]!];
    expect(await erroDe(pasta([trocado, LINHA_VALIDA]))).toMatch(/cabeçalho/i);
    expect(
      await erroDe(pasta([CABECALHO.slice(0, 7), LINHA_VALIDA.slice(0, 7)])),
    ).toMatch(/cabeçalho/i);
  });

  it("título ou texto antes do cabeçalho", async () => {
    expect(
      await erroDe(
        pasta([["Planilha de colaboradores"], CABECALHO, LINHA_VALIDA]),
      ),
    ).toMatch(/cabeçalho/i);
  });

  it("coluna extra no cabeçalho ou conteúdo fora das 9 colunas", async () => {
    expect(
      await erroDe(
        pasta([
          [...CABECALHO, "cpf"],
          [...LINHA_VALIDA, "x"],
        ]),
      ),
    ).toMatch(/fora do modelo|cabeçalho/i);
    expect(
      await erroDe(pasta([CABECALHO, [...LINHA_VALIDA, "valor a mais"]])),
    ).toMatch(/fora das 9 colunas/i);
  });

  it("fórmula em qualquer célula", async () => {
    const linha: CelulaXlsx[] = [...LINHA_VALIDA];
    linha[2] = { formula: "TODAY()", valor: 46357 };
    expect(await erroDe(pasta([CABECALHO, linha]))).toMatch(/fórmula/i);
  });

  it(`mais de ${LIMITE_DE_LINHAS} linhas de dados`, async () => {
    const linhas = Array.from({ length: LIMITE_DE_LINHAS + 1 }, (_, i) => {
      const linha = [...LINHA_VALIDA];
      linha[0] = `Pessoa Sintética ${i}`;
      return linha;
    });
    expect(await erroDe(pasta([CABECALHO, ...linhas]))).toMatch(
      new RegExp(`${LIMITE_DE_LINHAS} linhas`),
    );
  });

  it("sem linha de dados", async () => {
    expect(await erroDe(pasta([CABECALHO]))).toMatch(/nenhuma linha/i);
  });

  it("sem a aba Colaboradores", async () => {
    const bytes = montarXlsx([{ nome: "Planilha1", linhas: [CABECALHO] }]);
    expect(await erroDe(bytes)).toMatch(/aba Colaboradores/);
  });

  it("protegido por senha (ou .xls antigo): contêiner que não é .xlsx", async () => {
    const cfb = new Uint8Array(1024);
    cfb.set([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    expect(await erroDe(cfb)).toMatch(/senha|\.xls/i);
  });

  it("com macro", async () => {
    const bytes = pasta([CABECALHO, LINHA_VALIDA], {
      arquivosExtras: { "xl/vbaProject.bin": new Uint8Array([1, 2, 3]) },
    });
    expect(await erroDe(bytes)).toMatch(/macro/i);
  });

  it("arquivo que não é planilha (texto, ZIP sem planilha, ZIP corrompido)", async () => {
    expect(await erroDe(new TextEncoder().encode("nome;tipo"))).toMatch(
      /não é uma planilha \.xlsx/i,
    );
    const semPlanilha = montarXlsx([], {});
    expect(await erroDe(semPlanilha)).toMatch(
      /não é uma planilha \.xlsx|aba Colaboradores/i,
    );
    const corrompido = pasta([CABECALHO, LINHA_VALIDA]).slice(0, 200);
    expect(await erroDe(corrompido)).toMatch(
      /não é uma planilha \.xlsx|corrompid/i,
    );
  });
});
