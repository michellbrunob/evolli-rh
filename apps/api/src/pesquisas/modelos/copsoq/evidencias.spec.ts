import {
  EVIDENCIA_LIMITE_BYTES,
  EvidenciaRecusada,
  chaveDaEvidencia,
  conferirArquivoDaEvidencia,
  disposicaoDoDownload,
  formatoDaEvidenciaPeloConteudo,
  nomeDaEvidencia,
} from "./evidencias";

/** T216 — arquivos de evidência da conformidade com a NR-1. */

const PDF = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n", "latin1");
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(8),
  Buffer.from([0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]),
]);
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0xff, 0xd9]);
const WEBP = (() => {
  const b = Buffer.alloc(20);
  b.write("RIFF", 0, "latin1");
  b.writeUInt32LE(12, 4);
  b.write("WEBP", 8, "latin1");
  return b;
})();
/** Um "pptx" mínimo: assinatura de zip, as partes e o fim do diretório. */
function pptx(extra = ""): Buffer {
  return Buffer.concat([
    Buffer.from([0x50, 0x4b, 0x03, 0x04]),
    Buffer.from(`[Content_Types].xml ppt/presentation.xml ${extra}`),
    Buffer.from([0x50, 0x4b, 0x05, 0x06]),
    Buffer.alloc(18),
  ]);
}

const conferir = (bytes: Buffer, extensao: string, tipoDeclarado: string) =>
  conferirArquivoDaEvidencia({ bytes, extensao, tipoDeclarado });

const motivo = (f: () => unknown) => {
  try {
    f();
  } catch (e) {
    return e instanceof EvidenciaRecusada ? e.motivo : "outro";
  }
  return null;
};

describe("conferirArquivoDaEvidencia", () => {
  it("aceita PDF, imagem e apresentação quando extensão, tipo e conteúdo batem", () => {
    expect(conferir(PDF, "pdf", "application/pdf").formato).toBe("pdf");
    expect(conferir(PNG, ".PNG", "image/png").formato).toBe("png");
    expect(conferir(JPG, "jpeg", "image/jpeg").formato).toBe("jpg");
    expect(conferir(WEBP, "webp", "image/webp").formato).toBe("webp");
    const p = conferir(
      pptx(),
      "pptx",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    );
    expect(p.formato).toBe("pptx");
    expect(p.tamanhoBytes).toBe(pptx().length);
    expect(p.hashSha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("recusa formato divergente, desconhecido, vazio ou grande demais", () => {
    expect(motivo(() => conferir(PDF, "png", "application/pdf"))).toBe(
      "evidencia_formato_invalido",
    );
    expect(motivo(() => conferir(PDF, "pdf", "image/png"))).toBe(
      "evidencia_formato_invalido",
    );
    expect(
      motivo(() =>
        conferir(Buffer.from("MZ executável"), "pdf", "application/pdf"),
      ),
    ).toBe("evidencia_formato_invalido");
    // Planilha ou documento (zip) com extensão de apresentação: sem as partes.
    expect(
      motivo(() =>
        conferir(
          Buffer.concat([
            Buffer.from([0x50, 0x4b, 0x03, 0x04]),
            Buffer.from("word/document.xml"),
            Buffer.from([0x50, 0x4b, 0x05, 0x06]),
          ]),
          "pptx",
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        ),
      ),
    ).toBe("evidencia_arquivo_malformado");
    expect(
      motivo(() => conferir(Buffer.alloc(0), "pdf", "application/pdf")),
    ).toBe("evidencia_arquivo_vazio");
    const grande = Buffer.concat([PDF, Buffer.alloc(EVIDENCIA_LIMITE_BYTES)]);
    expect(motivo(() => conferir(grande, "pdf", "application/pdf"))).toBe(
      "evidencia_arquivo_grande_demais",
    );
    // No limite exato, passa.
    const noLimite = Buffer.concat([
      Buffer.from("%PDF-"),
      Buffer.alloc(EVIDENCIA_LIMITE_BYTES - 11),
      Buffer.from("%%EOF\n"),
    ]);
    expect(noLimite.length).toBe(EVIDENCIA_LIMITE_BYTES);
    expect(conferir(noLimite, "pdf", "application/pdf").formato).toBe("pdf");
  });

  it("recusa arquivo cortado e apresentação com macro", () => {
    expect(
      motivo(() => conferir(PDF.subarray(0, 12), "pdf", "application/pdf")),
    ).toBe("evidencia_arquivo_malformado");
    expect(
      motivo(() => conferir(PNG.subarray(0, 12), "png", "image/png")),
    ).toBe("evidencia_arquivo_malformado");
    expect(
      motivo(() =>
        conferir(
          pptx("ppt/vbaProject.bin"),
          "pptx",
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        ),
      ),
    ).toBe("evidencia_com_macro");
  });

  it("reconhece o formato pelo conteúdo", () => {
    expect(formatoDaEvidenciaPeloConteudo(PDF)).toBe("pdf");
    expect(formatoDaEvidenciaPeloConteudo(JPG)).toBe("jpg");
    expect(formatoDaEvidenciaPeloConteudo(Buffer.from("texto"))).toBeNull();
  });
});

describe("nome, chave e download", () => {
  it("limpa o nome enviado e usa a extensão do formato conferido", () => {
    expect(
      nomeDaEvidencia(encodeURIComponent("Ata da reunião.PDF"), "pdf"),
    ).toBe("Ata da reunião.pdf");
    expect(
      nomeDaEvidencia(encodeURIComponent("C:\\pasta\\..\\lista.png"), "png"),
    ).toBe("lista.png");
    expect(nomeDaEvidencia(encodeURIComponent('a"b<c>\u0007.pdf'), "pdf")).toBe(
      "abc.pdf",
    );
    expect(nomeDaEvidencia("%E0%A4%A", "pdf")).toBe("evidencia.pdf");
    expect(nomeDaEvidencia(undefined, "jpg")).toBe("evidencia.jpg");
    expect(nomeDaEvidencia("", "pptx")).toBe("evidencia.pptx");
    const longo = nomeDaEvidencia("x".repeat(300), "pdf");
    expect(longo).toHaveLength(120);
    expect(longo.endsWith(".pdf")).toBe(true);
  });

  it("a chave só tem ids; o download leva o nome ASCII e o UTF-8", () => {
    expect(chaveDaEvidencia("e1", "p1", "comunicar", "a1")).toBe(
      "v1/empresas/e1/pesquisas/p1/evidencias/comunicar/a1",
    );
    expect(disposicaoDoDownload("Ata da reunião.pdf")).toBe(
      `attachment; filename="Ata da reuniao.pdf"; filename*=UTF-8''Ata%20da%20reuni%C3%A3o.pdf`,
    );
  });
});
