import { createHash } from "node:crypto";
import {
  ANEXO_AUSENCIA_LIMITE_BYTES,
  AnexoRecusado,
  EXTENSAO_DO_FORMATO_ANEXO,
  FORMATOS_ANEXO_AUSENCIA,
  TIPO_DO_FORMATO_ANEXO,
  conferirArquivoDoAnexo,
  formatoDoAnexoPeloConteudo,
  type FormatoAnexoAusencia,
} from "./anexo-ausencia.arquivo";

/**
 * T215 — conferência do arquivo do anexo da ausência (atestado ou
 * documento). Todos os bytes são sintéticos, montados aqui.
 */

const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(16, 1),
  Buffer.from([0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]),
]);
const JPG = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
  Buffer.alloc(32, 2),
  Buffer.from([0xff, 0xd9]),
]);

function webp(tamanhoDeclarado?: number): Buffer {
  const corpo = Buffer.concat([
    Buffer.from("WEBP"),
    Buffer.from("VP8 "),
    Buffer.alloc(20, 3),
  ]);
  const cabeca = Buffer.alloc(8);
  cabeca.write("RIFF", 0, "latin1");
  cabeca.writeUInt32LE(tamanhoDeclarado ?? corpo.length, 4);
  return Buffer.concat([cabeca, corpo]);
}

function ftyp(marca: string, compativeis: string[] = []): Buffer {
  const conteudo = Buffer.concat([
    Buffer.from("ftyp"),
    Buffer.from(marca),
    Buffer.alloc(4, 0),
    ...compativeis.map((c) => Buffer.from(c)),
  ]);
  const tamanho = Buffer.alloc(4);
  tamanho.writeUInt32BE(conteudo.length + 4, 0);
  return Buffer.concat([tamanho, conteudo, Buffer.alloc(64, 4)]);
}

function docx(extras: string[] = []): Buffer {
  const nomes = ["[Content_Types].xml", "word/document.xml", ...extras];
  return Buffer.concat([
    Buffer.from([0x50, 0x4b, 0x03, 0x04]),
    Buffer.alloc(40, 5),
    // Diretório central (só os nomes importam para a conferência).
    ...nomes.map((n) =>
      Buffer.concat([Buffer.from([0x50, 0x4b, 0x01, 0x02]), Buffer.from(n)]),
    ),
    Buffer.from([0x50, 0x4b, 0x05, 0x06]),
    Buffer.alloc(18, 0),
  ]);
}

function doc(extra?: string): Buffer {
  return Buffer.concat([
    Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
    Buffer.alloc(600, 6),
    Buffer.from("WordDocument", "utf16le"),
    ...(extra ? [Buffer.from(extra, "utf16le")] : []),
    Buffer.alloc(64, 7),
  ]);
}

const VALIDOS: ReadonlyArray<
  readonly [FormatoAnexoAusencia, Buffer, string, string]
> = [
  ["pdf", PDF, "pdf", "application/pdf"],
  ["jpg", JPG, "jpg", "image/jpeg"],
  ["jpg", JPG, "jpeg", "image/jpg"],
  ["png", PNG, "png", "image/png"],
  ["webp", webp(), "webp", "image/webp"],
  ["heic", ftyp("heic"), "heic", "image/heic"],
  ["heic", ftyp("mif1", ["heic"]), "heic", "image/heic"],
  ["heic", ftyp("heix"), "heic", "application/octet-stream"],
  ["heif", ftyp("mif1"), "heif", "image/heif"],
  ["heif", ftyp("msf1"), "heif", "application/octet-stream"],
  ["doc", doc(), "doc", "application/msword"],
  [
    "docx",
    docx(),
    "docx",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
];

function motivo(fn: () => unknown): string {
  try {
    fn();
  } catch (erro) {
    if (erro instanceof AnexoRecusado) return erro.motivo;
    throw erro;
  }
  throw new Error("não recusou");
}

describe("T215 — anexo da ausência: conferência do arquivo", () => {
  it("formatos, tipos e extensões da referência", () => {
    expect([...FORMATOS_ANEXO_AUSENCIA]).toEqual([
      "pdf",
      "jpg",
      "png",
      "webp",
      "heic",
      "heif",
      "doc",
      "docx",
    ]);
    expect(ANEXO_AUSENCIA_LIMITE_BYTES).toBe(10 * 1024 * 1024);
    expect(TIPO_DO_FORMATO_ANEXO).toEqual({
      pdf: "application/pdf",
      jpg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
      heic: "image/heic",
      heif: "image/heif",
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    for (const f of FORMATOS_ANEXO_AUSENCIA) {
      expect(EXTENSAO_DO_FORMATO_ANEXO[f]).toBe(f);
    }
  });

  it.each(VALIDOS)(
    "aceita %s (.%s, %s)",
    (formato, bytes, extensao, tipoDeclarado) => {
      expect(formatoDoAnexoPeloConteudo(bytes)).toBe(formato);
      expect(
        conferirArquivoDoAnexo({ bytes, extensao, tipoDeclarado }),
      ).toEqual({
        formato,
        tamanhoBytes: bytes.length,
        hashSha256: createHash("sha256").update(bytes).digest("hex"),
      });
    },
  );

  it("extensão com ponto e maiúsculas, tipo com espaços: aceitos", () => {
    expect(
      conferirArquivoDoAnexo({
        bytes: PDF,
        extensao: ".PDF",
        tipoDeclarado: " Application/PDF ",
      }).formato,
    ).toBe("pdf");
  });

  it("vazio: anexo_arquivo_vazio", () => {
    expect(
      motivo(() =>
        conferirArquivoDoAnexo({
          bytes: Buffer.alloc(0),
          extensao: "pdf",
          tipoDeclarado: "application/pdf",
        }),
      ),
    ).toBe("anexo_arquivo_vazio");
  });

  it("acima de 10 MB: anexo_arquivo_grande_demais", () => {
    const grande = Buffer.concat([
      PDF,
      Buffer.alloc(ANEXO_AUSENCIA_LIMITE_BYTES),
    ]);
    expect(
      motivo(() =>
        conferirArquivoDoAnexo({
          bytes: grande,
          extensao: "pdf",
          tipoDeclarado: "application/pdf",
        }),
      ),
    ).toBe("anexo_arquivo_grande_demais");
  });

  it.each([
    ["extensão de outro formato", PDF, "png", "application/pdf"],
    ["tipo de outro formato", PDF, "pdf", "image/png"],
    ["extensão desconhecida", PDF, "exe", "application/pdf"],
    ["tipo desconhecido", PDF, "pdf", "text/html"],
    ["conteúdo de outro formato", PNG, "pdf", "application/pdf"],
    [
      "conteúdo desconhecido",
      Buffer.from("<html></html>"),
      "pdf",
      "application/pdf",
    ],
    ["octet-stream fora de heic/heif", PDF, "pdf", "application/octet-stream"],
    ["heic declarado, conteúdo heif", ftyp("mif1"), "heic", "image/heic"],
    ["ftyp de mp4 (isom)", ftyp("isom", ["mp41"]), "heic", "image/heic"],
    ["docx com extensão doc", docx(), "doc", "application/msword"],
  ])("%s: anexo_formato_invalido", (_r, bytes, extensao, tipoDeclarado) => {
    expect(
      motivo(() => conferirArquivoDoAnexo({ bytes, extensao, tipoDeclarado })),
    ).toBe("anexo_formato_invalido");
  });

  it.each([
    [
      "PDF sem %%EOF",
      Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\n"),
      "pdf",
      "application/pdf",
    ],
    ["PNG cortado", PNG.subarray(0, PNG.length - 4), "png", "image/png"],
    ["JPG sem fim", JPG.subarray(0, JPG.length - 2), "jpg", "image/jpeg"],
    ["WEBP com tamanho incoerente", webp(9999), "webp", "image/webp"],
    [
      "DOCX sem documento do Word",
      docx().subarray(0, 60),
      "docx",
      TIPO_DO_FORMATO_ANEXO.docx,
    ],
    [
      "DOCX sem fim do diretório central",
      docx().subarray(0, docx().length - 22),
      "docx",
      TIPO_DO_FORMATO_ANEXO.docx,
    ],
    ["DOC curto demais", doc().subarray(0, 300), "doc", "application/msword"],
  ])("%s: anexo_arquivo_malformado", (_r, bytes, extensao, tipoDeclarado) => {
    expect(
      motivo(() => conferirArquivoDoAnexo({ bytes, extensao, tipoDeclarado })),
    ).toBe("anexo_arquivo_malformado");
  });

  it.each([
    [
      "DOCX com vbaProject.bin",
      docx(["word/vbaProject.bin"]),
      "docx",
      TIPO_DO_FORMATO_ANEXO.docx,
    ],
    ["DOC com _VBA_PROJECT", doc("_VBA_PROJECT"), "doc", "application/msword"],
    ["DOC com Macros", doc("Macros"), "doc", "application/msword"],
    ["DOC com VBA", doc("VBA"), "doc", "application/msword"],
  ])("%s: anexo_com_macro", (_r, bytes, extensao, tipoDeclarado) => {
    expect(
      motivo(() => conferirArquivoDoAnexo({ bytes, extensao, tipoDeclarado })),
    ).toBe("anexo_com_macro");
  });

  it("o conteúdo decide: bytes de outro formato não viram formato aceito", () => {
    expect(formatoDoAnexoPeloConteudo(Buffer.from("PK"))).toBeNull();
    expect(formatoDoAnexoPeloConteudo(Buffer.from("RIFF0000AVI "))).toBeNull();
    expect(formatoDoAnexoPeloConteudo(ftyp("isom"))).toBeNull();
  });
});
