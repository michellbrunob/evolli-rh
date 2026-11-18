import sharp from "sharp";
import {
  FOTO_COLABORADOR_LIMITE_BYTES,
  FotoDoColaboradorRecusada,
  TAMANHOS_DA_FOTO,
  processarFotoDoColaborador,
} from "./foto-colaborador.processamento";

/**
 * T209 — foto do colaborador: o servidor confere extensão, tipo declarado e
 * conteúdo real, decodifica e gera SÓ versões WebP 96, 256 e 512 px, sem
 * metadados. O arquivo enviado nunca sai daqui. Imagens sintéticas.
 */
async function imagem(
  formato: "png" | "jpeg",
  largura = 640,
  altura = 480,
  orientacao?: number,
): Promise<Buffer> {
  let img = sharp({
    create: {
      width: largura,
      height: altura,
      channels: 3,
      background: { r: 20, g: 120, b: 200 },
    },
  });
  img = formato === "png" ? img.png() : img.jpeg();
  if (orientacao) img = img.withMetadata({ orientation: orientacao });
  return img.toBuffer();
}

async function recusa(promessa: Promise<unknown>, motivo: string) {
  await expect(promessa).rejects.toEqual(
    new FotoDoColaboradorRecusada(motivo as never),
  );
}

describe("processarFotoDoColaborador", () => {
  it("PNG válido vira três WebP quadrados (96, 256, 512), sem metadados", async () => {
    const bytes = await imagem("png");
    const r = await processarFotoDoColaborador({
      bytes,
      tipoDeclarado: "image/png",
      extensao: "png",
    });
    expect(TAMANHOS_DA_FOTO).toEqual([96, 256, 512]);
    for (const tamanho of TAMANHOS_DA_FOTO) {
      const meta = await sharp(r.versoes[tamanho]).metadata();
      expect(meta.format).toBe("webp");
      expect(meta.width).toBe(tamanho);
      expect(meta.height).toBe(tamanho);
      expect(meta.exif).toBeUndefined();
      expect(meta.icc).toBeUndefined();
      expect(meta.xmp).toBeUndefined();
    }
    expect(r.hashSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(r.tamanhoBytes).toBe(r.versoes[512].length);
    // Nada do arquivo original volta.
    expect(r.versoes[512].equals(bytes)).toBe(false);
  });

  it("JPEG com orientação EXIF: corrigida e o metadado some", async () => {
    const bytes = await imagem("jpeg", 300, 200, 6);
    expect((await sharp(bytes).metadata()).orientation).toBe(6);
    const r = await processarFotoDoColaborador({
      bytes,
      tipoDeclarado: "image/jpeg",
      extensao: "jpg",
    });
    const meta = await sharp(r.versoes[256]).metadata();
    expect(meta.orientation).toBeUndefined();
    expect(meta.exif).toBeUndefined();
  });

  it("extensão .jpeg também vale para JPEG", async () => {
    await expect(
      processarFotoDoColaborador({
        bytes: await imagem("jpeg"),
        tipoDeclarado: "image/jpeg",
        extensao: "jpeg",
      }),
    ).resolves.toBeDefined();
  });

  it("MIME enganoso (PNG declarado como JPEG) é recusado", async () => {
    await recusa(
      processarFotoDoColaborador({
        bytes: await imagem("png"),
        tipoDeclarado: "image/jpeg",
        extensao: "jpg",
      }),
      "foto_tipo_divergente",
    );
  });

  it("extensão que não combina com o tipo declarado é recusada", async () => {
    await recusa(
      processarFotoDoColaborador({
        bytes: await imagem("png"),
        tipoDeclarado: "image/png",
        extensao: "jpg",
      }),
      "foto_tipo_divergente",
    );
  });

  it.each([
    ["GIF declarado", "image/gif", "gif"],
    ["WebP declarado", "image/webp", "webp"],
    ["SVG declarado", "image/svg+xml", "svg"],
  ])("%s é recusado (só PNG e JPEG)", async (_caso, tipo, extensao) => {
    await recusa(
      processarFotoDoColaborador({
        bytes: await imagem("png"),
        tipoDeclarado: tipo,
        extensao,
      }),
      "foto_formato_invalido",
    );
  });

  it("arquivo falso (texto com extensão .png) é recusado", async () => {
    await recusa(
      processarFotoDoColaborador({
        bytes: Buffer.from("<svg onload=alert(1)></svg>"),
        tipoDeclarado: "image/png",
        extensao: "png",
      }),
      "foto_tipo_divergente",
    );
  });

  it("PNG truncado (não decodifica) é recusado", async () => {
    const bytes = await imagem("png");
    await recusa(
      processarFotoDoColaborador({
        bytes: bytes.subarray(0, Math.floor(bytes.length / 2)),
        tipoDeclarado: "image/png",
        extensao: "png",
      }),
      "foto_invalida",
    );
  });

  it("acima de 5 MB é recusado antes de decodificar", async () => {
    const grande = Buffer.concat([
      await imagem("png"),
      Buffer.alloc(FOTO_COLABORADOR_LIMITE_BYTES),
    ]);
    await recusa(
      processarFotoDoColaborador({
        bytes: grande,
        tipoDeclarado: "image/png",
        extensao: "png",
      }),
      "foto_grande_demais",
    );
  });

  it("imagem pequena demais é recusada", async () => {
    await recusa(
      processarFotoDoColaborador({
        bytes: await imagem("png", 40, 40),
        tipoDeclarado: "image/png",
        extensao: "png",
      }),
      "foto_pequena",
    );
  });
});
