import {
  DOCUMENTO_LIMITE_BYTES,
  DocumentoRecusado,
  conferirArquivoDoDocumento,
  NOME_ORIGINAL_MAXIMO,
  conferirCategoriaENome,
  nomeDoDownload,
  nomeOriginalDoCabecalho,
} from "./documento-colaborador.arquivo";

/** Arquivos sintéticos mínimos, válidos na estrutura que é conferida. */
const PDF = Buffer.concat([
  Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n"),
  Buffer.from("%%EOF\n"),
]);
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(16, 1),
  // Chunk IEND: tamanho 0, tipo, CRC.
  Buffer.from([0, 0, 0, 0, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]),
]);
const JPG = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
  Buffer.alloc(16, 2),
  Buffer.from([0xff, 0xd9]),
]);

/** T217 — Word antigo (OLE): cabeçalho, o fluxo "WordDocument" e setores de 512. */
const utf16 = (texto: string) => Buffer.from(texto, "utf16le");
const ASSINATURA_OLE = Buffer.from([
  0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1,
]);
const ole = (...conteudo: Buffer[]) => {
  const corpo = Buffer.concat([ASSINATURA_OLE, ...conteudo]);
  const total = Math.max(1536, Math.ceil(corpo.length / 512) * 512);
  return Buffer.concat([corpo, Buffer.alloc(total - corpo.length)]);
};
const DOC = ole(Buffer.alloc(504), utf16("WordDocument"));

/** T217 — Word atual (ZIP): o índice de tipos, o corpo e o fim do diretório. */
const zip = (...nomes: string[]) =>
  Buffer.concat([
    Buffer.from([0x50, 0x4b, 0x03, 0x04]),
    Buffer.alloc(26),
    ...nomes.map((n) => Buffer.from(n, "latin1")),
    Buffer.alloc(32, 3),
    Buffer.from([0x50, 0x4b, 0x05, 0x06]),
    Buffer.alloc(18),
  ]);
const DOCX = zip("[Content_Types].xml", "word/document.xml");

/** T217 — WebP: RIFF com o tamanho certo e a marca WEBP. */
const webp = (corpo: Buffer, tamanhoDeclarado = corpo.length + 4) => {
  const tamanho = Buffer.alloc(4);
  tamanho.writeUInt32LE(tamanhoDeclarado);
  return Buffer.concat([
    Buffer.from("RIFF", "latin1"),
    tamanho,
    Buffer.from("WEBP", "latin1"),
    corpo,
  ]);
};
const WEBP = webp(
  Buffer.concat([Buffer.from("VP8 ", "latin1"), Buffer.alloc(12, 4)]),
);

const TIPO_DOC = "application/msword";
const TIPO_DOCX =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const motivo = (fn: () => unknown) => {
  try {
    fn();
  } catch (erro) {
    if (erro instanceof DocumentoRecusado) return erro.motivo;
    throw erro;
  }
  return null;
};

describe("conferirArquivoDoDocumento (T213)", () => {
  it.each([
    ["pdf", "application/pdf", PDF, "pdf"],
    ["PDF", "application/pdf", PDF, "pdf"],
    ["png", "image/png", PNG, "png"],
    ["jpg", "image/jpeg", JPG, "jpg"],
    ["jpeg", "image/jpeg", JPG, "jpg"],
    ["doc", TIPO_DOC, DOC, "doc"],
    ["DOC", TIPO_DOC, DOC, "doc"],
    ["docx", TIPO_DOCX, DOCX, "docx"],
    ["webp", "image/webp", WEBP, "webp"],
  ] as const)(
    "%s com %s e conteúdo coerente: aceito como %s",
    (extensao, tipo, bytes, formato) => {
      const conferido = conferirArquivoDoDocumento({
        bytes,
        extensao,
        tipoDeclarado: tipo,
      });
      expect(conferido.formato).toBe(formato);
      expect(conferido.tamanhoBytes).toBe(bytes.length);
      expect(conferido.hashSha256).toMatch(/^[0-9a-f]{64}$/);
    },
  );

  it("vazio: recusado", () => {
    expect(
      motivo(() =>
        conferirArquivoDoDocumento({
          bytes: Buffer.alloc(0),
          extensao: "pdf",
          tipoDeclarado: "application/pdf",
        }),
      ),
    ).toBe("documento_arquivo_vazio");
  });

  it("acima de 10 MB: recusado", () => {
    const grande = Buffer.concat([PDF, Buffer.alloc(DOCUMENTO_LIMITE_BYTES)]);
    expect(
      motivo(() =>
        conferirArquivoDoDocumento({
          bytes: grande,
          extensao: "pdf",
          tipoDeclarado: "application/pdf",
        }),
      ),
    ).toBe("documento_arquivo_grande_demais");
  });

  it.each([
    ["extensão fora da lista", "heic", "image/heic", PDF],
    ["extensão DOCX com conteúdo PDF", "docx", TIPO_DOCX, PDF],
    ["extensão DOC com conteúdo DOCX", "doc", TIPO_DOC, DOCX],
    ["extensão WebP com conteúdo PNG", "webp", "image/webp", PNG],
    [
      "ZIP que não é documento de texto",
      "docx",
      TIPO_DOCX,
      zip("[Content_Types].xml", "xl/workbook.xml"),
    ],
    [
      "OLE que não é documento de texto",
      "doc",
      TIPO_DOC,
      ole(utf16("Workbook")),
    ],
    [
      "RIFF que não é WebP",
      "webp",
      "image/webp",
      Buffer.concat([
        Buffer.from("RIFF", "latin1"),
        Buffer.from([16, 0, 0, 0]),
        Buffer.from("WAVE", "latin1"),
        Buffer.alloc(12),
      ]),
    ],
    ["tipo declarado fora da lista", "pdf", "application/zip", PDF],
    ["extensão diz PNG, conteúdo é PDF", "png", "image/png", PDF],
    ["tipo diz PDF, conteúdo é PNG", "png", "application/pdf", PNG],
    ["conteúdo desconhecido", "pdf", "application/pdf", Buffer.from("MZ...")],
  ])("%s: recusado como formato inválido", (_, extensao, tipo, bytes) => {
    expect(
      motivo(() =>
        conferirArquivoDoDocumento({ bytes, extensao, tipoDeclarado: tipo }),
      ),
    ).toBe("documento_formato_invalido");
  });

  it.each([
    ["PDF sem %%EOF", "pdf", "application/pdf", PDF.subarray(0, 20)],
    ["PNG sem IEND", "png", "image/png", PNG.subarray(0, 20)],
    ["JPEG sem fim de imagem", "jpg", "image/jpeg", JPG.subarray(0, 10)],
    ["DOC cortado fora do setor", "doc", TIPO_DOC, DOC.subarray(0, 1000)],
    [
      "DOC com menos de três setores",
      "doc",
      TIPO_DOC,
      ole(utf16("WordDocument")).subarray(0, 1024),
    ],
    [
      "DOCX sem fim do diretório",
      "docx",
      TIPO_DOCX,
      DOCX.subarray(0, DOCX.length - 22),
    ],
    ["WebP cortado", "webp", "image/webp", WEBP.subarray(0, WEBP.length - 4)],
    [
      "WebP com tamanho maior que o arquivo",
      "webp",
      "image/webp",
      webp(Buffer.alloc(16), 40),
    ],
    [
      "WebP com bytes além do tamanho declarado",
      "webp",
      "image/webp",
      Buffer.concat([WEBP, Buffer.alloc(4)]),
    ],
    [
      "DOC com bytes além do último setor",
      "doc",
      TIPO_DOC,
      Buffer.concat([DOC, Buffer.alloc(10)]),
    ],
  ])("%s: recusado como malformado", (_, extensao, tipo, bytes) => {
    expect(
      motivo(() =>
        conferirArquivoDoDocumento({ bytes, extensao, tipoDeclarado: tipo }),
      ),
    ).toBe("documento_arquivo_malformado");
  });
});

describe("documento com macro (T217)", () => {
  it.each([
    [
      "DOCX com projeto de macro",
      "docx",
      TIPO_DOCX,
      zip("[Content_Types].xml", "word/document.xml", "word/vbaProject.bin"),
    ],
    [
      "DOCX com macro fora da pasta word",
      "docx",
      TIPO_DOCX,
      zip("[Content_Types].xml", "word/document.xml", "custom/vbaProject.bin"),
    ],
    [
      "DOC com fluxo de macro",
      "doc",
      TIPO_DOC,
      ole(Buffer.alloc(504), utf16("WordDocument"), utf16("_VBA_PROJECT")),
    ],
    [
      "DOC com pasta de macros",
      "doc",
      TIPO_DOC,
      ole(Buffer.alloc(504), utf16("WordDocument"), utf16("Macros")),
    ],
    [
      "DOC com pasta VBA",
      "doc",
      TIPO_DOC,
      ole(Buffer.alloc(504), utf16("WordDocument"), utf16("VBA")),
    ],
  ])("%s: recusado", (_, extensao, tipo, bytes) => {
    expect(
      motivo(() =>
        conferirArquivoDoDocumento({ bytes, extensao, tipoDeclarado: tipo }),
      ),
    ).toBe("documento_com_macro");
  });
});

describe("conferirCategoriaENome (T213)", () => {
  it("categoria fixa sem nome: aceita", () => {
    expect(conferirCategoriaENome("rg", undefined)).toEqual({
      categoria: "rg",
      nomeOutros: null,
    });
  });

  it("outros com nome: aceita, sem espaços nas pontas", () => {
    expect(conferirCategoriaENome("outros", "  Contrato  ")).toEqual({
      categoria: "outros",
      nomeOutros: "Contrato",
    });
  });

  it.each([
    [
      "categoria desconhecida",
      "passaporte",
      undefined,
      "documento_categoria_invalida",
    ],
    ["outros sem nome", "outros", "  ", "documento_nome_obrigatorio"],
    [
      "outros com nome longo",
      "outros",
      "x".repeat(61),
      "documento_nome_invalido",
    ],
    [
      "outros com caractere de controle",
      "outros",
      "a\u0007b",
      "documento_nome_invalido",
    ],
    [
      "categoria fixa com nome",
      "cpf",
      "Meu CPF",
      "documento_nome_nao_permitido",
    ],
  ])("%s: recusado", (_, categoria, nome, esperado) => {
    expect(motivo(() => conferirCategoriaENome(categoria, nome))).toBe(
      esperado,
    );
  });
});

describe("nomeDoDownload (T213)", () => {
  it("nome neutro categoria-AAAA-MM-DD.ext, sem nome original nem nome livre", () => {
    const data = new Date("2026-11-19T15:00:00Z");
    expect(nomeDoDownload("comprovante_endereco", "pdf", data)).toBe(
      "comprovante-endereco-2026-11-19.pdf",
    );
    expect(nomeDoDownload("outros", "png", data)).toBe("outros-2026-11-19.png");
  });

  it.each([
    ["doc", "rg-2026-11-19.doc"],
    ["docx", "rg-2026-11-19.docx"],
    ["webp", "rg-2026-11-19.webp"],
  ] as const)("T217 — formato %s: extensão própria", (formato, esperado) => {
    expect(
      nomeDoDownload("rg", formato, new Date("2026-11-19T15:00:00Z")),
    ).toBe(esperado);
  });
});

describe("nomeOriginalDoCabecalho (T217)", () => {
  const codificado = (nome: string) => encodeURIComponent(nome);

  it.each([
    ["simples", "contrato-assinado.pdf", "contrato-assinado.pdf"],
    [
      "acentos e espaços",
      "Comprovante de endereço.pdf",
      "Comprovante de endereço.pdf",
    ],
    ["espaços nas pontas", "  rg frente.png  ", "rg frente.png"],
    ["espaços repetidos", "rg   frente.png", "rg frente.png"],
  ])("%s: guardado", (_, nome, esperado) => {
    expect(nomeOriginalDoCabecalho(codificado(nome))).toBe(esperado);
  });

  it.each([
    ["caminho do Windows", "C:\\pasta\\sub\\rg.pdf", "rg.pdf"],
    ["caminho com barras", "/tmp/a/b/cpf.png", "cpf.png"],
    ["caracteres de controle no meio", "rg\u0000\u0007.pdf", "rg.pdf"],
    ["marca invisível de direção", "rg\u202e.pdf", "rg.pdf"],
  ])("%s: saneado", (_, nome, esperado) => {
    expect(nomeOriginalDoCabecalho(codificado(nome))).toBe(esperado);
  });

  it.each([
    ["ausente", undefined],
    ["vazio", ""],
    ["só espaços", codificado("   ")],
    ["só caminho", codificado("C:\\pasta\\")],
    ["codificação quebrada", "%E0%A4%A"],
  ])("%s: sem nome (null), sem recusar o envio", (_, bruto) => {
    expect(nomeOriginalDoCabecalho(bruto)).toBeNull();
  });

  it("longo demais: cortado no limite, mantendo a extensão", () => {
    const nome = `${"a".repeat(400)}.docx`;
    const guardado = nomeOriginalDoCabecalho(codificado(nome))!;
    expect([...guardado].length).toBe(NOME_ORIGINAL_MAXIMO);
    expect(guardado.endsWith(".docx")).toBe(true);
    expect(guardado.startsWith("aaaa")).toBe(true);
  });

  it("no limite exato: guardado inteiro", () => {
    const nome = `${"b".repeat(NOME_ORIGINAL_MAXIMO - 4)}.pdf`;
    expect(nomeOriginalDoCabecalho(codificado(nome))).toBe(nome);
  });

  it("conta caracteres, não bytes (emoji vale um)", () => {
    const nome = `${"\u{1F600}".repeat(NOME_ORIGINAL_MAXIMO - 4)}.pdf`;
    expect(nomeOriginalDoCabecalho(codificado(nome))).toBe(nome);
  });
});
