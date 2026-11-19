import {
  DOCUMENTO_LIMITE_BYTES,
  DocumentoRecusado,
  conferirArquivoDoDocumento,
  conferirCategoriaENome,
  nomeDoDownload,
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
    ["extensão fora da lista", "docx", "application/pdf", PDF],
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
  ])("%s: recusado como malformado", (_, extensao, tipo, bytes) => {
    expect(
      motivo(() =>
        conferirArquivoDoDocumento({ bytes, extensao, tipoDeclarado: tipo }),
      ),
    ).toBe("documento_arquivo_malformado");
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
});
