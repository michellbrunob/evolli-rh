/**
 * T208 — foto de perfil da própria conta (ADR 0018), unidade.
 *
 * O servidor é a autoridade: formato pelo conteúdo, limites de bytes e de
 * pixels, decodificação estrita e regravação em JPEG 256 × 256 sem
 * metadados. Também: o leitor de corpo com teto, o serviço (versão,
 * conflito, remoção, desativação, auditoria sem dado da imagem) e as
 * permissões das rotas. O banco real fica na suíte e2e `foto-perfil`.
 */
import "reflect-metadata";
import { PassThrough } from "node:stream";
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  PayloadTooLargeException,
} from "@nestjs/common";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import { AccessUser } from "@prisma/client";
import type { Request } from "express";
import sharp from "sharp";
import {
  FotoRecusada,
  formatoPeloConteudo,
  lerCorpoLimitado,
  normalizarFotoDePerfil,
} from "./foto-perfil.processamento";
import { UsersController, versaoLida } from "../users.controller";
import { UsersService } from "../users.service";
import { PERMISSION_METADATA_KEY } from "../../auth/authorization/require-permission.decorator";
import { CsrfGuard } from "../../auth/csrf/csrf.guard";
import { AuthorizationGuard } from "../../auth/authorization/authorization.guard";

/** Imagem sintética de cor sólida. */
function imagem(
  largura: number,
  altura: number,
  formato: "jpeg" | "png" | "webp",
  alfa = false,
): Promise<Buffer> {
  return sharp({
    create: {
      width: largura,
      height: altura,
      channels: alfa ? 4 : 3,
      background: alfa
        ? { r: 10, g: 120, b: 200, alpha: 0.5 }
        : { r: 10, g: 120, b: 200 },
    },
  })
    .toFormat(formato)
    .toBuffer();
}

/** CRC-32 dos chunks PNG (para forjar um cabeçalho de dimensões). */
function crc32(dados: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of dados) {
    crc ^= byte;
    for (let k = 0; k < 8; k++)
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Imagem-bomba: um PNG pequeno de verdade, com o cabeçalho (IHDR) reescrito
 * para declarar `largura × altura` — o arquivo continua minúsculo.
 */
async function pngComCabecalho(largura: number, altura: number) {
  const png = Buffer.from(await imagem(200, 200, "png"));
  // Assinatura (8) + tamanho (4) + "IHDR" (4) → largura e altura em 16..23.
  png.writeUInt32BE(largura, 16);
  png.writeUInt32BE(altura, 20);
  png.writeUInt32BE(crc32(png.subarray(12, 29)), 29);
  return png;
}

async function recusa(bytes: Buffer) {
  try {
    await normalizarFotoDePerfil(bytes);
  } catch (erro) {
    if (erro instanceof FotoRecusada) return erro.motivo;
    throw erro;
  }
  return "aceita";
}

describe("T208 — formato reconhecido pelo conteúdo", () => {
  it("JPEG, PNG e WebP pela assinatura", async () => {
    expect(formatoPeloConteudo(await imagem(10, 10, "jpeg"))).toBe("jpeg");
    expect(formatoPeloConteudo(await imagem(10, 10, "png"))).toBe("png");
    expect(formatoPeloConteudo(await imagem(10, 10, "webp"))).toBe("webp");
  });

  it("qualquer outra coisa é recusada, seja qual for o nome ou o tipo declarado", async () => {
    const gif = await sharp({
      create: { width: 200, height: 200, channels: 3, background: "#000" },
    })
      .gif()
      .toBuffer();
    expect(formatoPeloConteudo(gif)).toBeNull();
    expect(
      formatoPeloConteudo(Buffer.from("<svg xmlns='x'></svg>")),
    ).toBeNull();
    expect(
      formatoPeloConteudo(Buffer.from("<html><script>x</script>")),
    ).toBeNull();
    expect(formatoPeloConteudo(Buffer.alloc(0))).toBeNull();
    expect(await recusa(gif)).toBe("foto_formato_invalido");
    expect(
      await recusa(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>")),
    ).toBe("foto_formato_invalido");
  });
});

describe("T208 — a foto gravada é sempre uma imagem nova do servidor", () => {
  it.each(["jpeg", "png", "webp"] as const)(
    "%s retangular vira JPEG quadrado 256 × 256",
    async (formato) => {
      const saida = await normalizarFotoDePerfil(
        await imagem(640, 400, formato),
      );
      const meta = await sharp(saida).metadata();
      expect(meta.format).toBe("jpeg");
      expect([meta.width, meta.height]).toEqual([256, 256]);
      expect(saida.subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]));
    },
  );

  it("PNG com transparência é achatado sobre fundo, sem canal alfa", async () => {
    const saida = await normalizarFotoDePerfil(
      await imagem(300, 300, "png", true),
    );
    const meta = await sharp(saida).metadata();
    expect(meta.hasAlpha).toBe(false);
  });

  it("metadados do arquivo (EXIF, XMP, ICC) não passam para a foto gravada", async () => {
    const comMetadados = await sharp(await imagem(400, 300, "jpeg"))
      .withExif({ IFD0: { Copyright: "Dado Particular", Artist: "Pessoa" } })
      .withXmp(
        '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"/></x:xmpmeta>',
      )
      .withIccProfile("srgb")
      .jpeg()
      .toBuffer();
    const antes = await sharp(comMetadados).metadata();
    expect(antes.exif).toBeDefined();
    const saida = await normalizarFotoDePerfil(comMetadados);
    const meta = await sharp(saida).metadata();
    expect(meta.exif).toBeUndefined();
    expect(meta.xmp).toBeUndefined();
    expect(meta.icc).toBeUndefined();
    expect(saida.includes(Buffer.from("Dado Particular"))).toBe(false);
  });

  it("os bytes enviados nunca são devolvidos como estão", async () => {
    const enviado = await imagem(256, 256, "jpeg");
    const saida = await normalizarFotoDePerfil(enviado);
    expect(saida.equals(enviado)).toBe(false);
  });
});

describe("T208 — limites contra arquivo inadequado", () => {
  it("menor lado abaixo de 128 px é recusado; 128 × 128 passa", async () => {
    expect(await recusa(await imagem(127, 400, "png"))).toBe("foto_pequena");
    expect(await recusa(await imagem(128, 128, "png"))).toBe("aceita");
  });

  it("imagem-bomba (cabeçalho declara 30 milhões de pixels num arquivo minúsculo) é recusada antes de decodificar", async () => {
    const bomba = await pngComCabecalho(6000, 5000);
    expect(bomba.length).toBeLessThan(10_000);
    expect(await recusa(bomba)).toBe("foto_grande_demais");
  });

  it("25 milhões de pixels é o teto: 5000 × 5000 passa pelo cabeçalho, 5000 × 5001 não", async () => {
    expect(await recusa(await pngComCabecalho(5000, 5001))).toBe(
      "foto_grande_demais",
    );
    // No teto, o cabeçalho passa; o arquivo forjado não decodifica: inválido,
    // nunca "grande demais".
    expect(await recusa(await pngComCabecalho(5000, 5000))).toBe(
      "foto_invalida",
    );
  });

  it("arquivo malformado ou truncado é recusado", async () => {
    const jpeg = await imagem(400, 400, "jpeg");
    expect(await recusa(jpeg.subarray(0, Math.floor(jpeg.length / 2)))).toBe(
      "foto_invalida",
    );
    expect(
      await recusa(
        Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(500, 7)]),
      ),
    ).toBe("foto_invalida");
    const webpFalso = Buffer.concat([
      Buffer.from("RIFF"),
      Buffer.alloc(4),
      Buffer.from("WEBP"),
      Buffer.alloc(200, 1),
    ]);
    expect(await recusa(webpFalso)).toBe("foto_invalida");
  });

  it("conteúdo de outro formato com assinatura de JPEG (poliglota) é recusado", async () => {
    const png = await imagem(300, 300, "png");
    const poliglota = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), png]);
    expect(await recusa(poliglota)).toBe("foto_invalida");
  });
});

function corpo(conteudo: Buffer[], contentLength?: number, terminar = true) {
  const fluxo = new PassThrough() as unknown as Request & PassThrough;
  (fluxo as unknown as { headers: Record<string, string> }).headers =
    contentLength === undefined
      ? {}
      : { "content-length": String(contentLength) };
  setImmediate(() => {
    for (const parte of conteudo) fluxo.write(parte);
    if (terminar) fluxo.end();
  });
  return fluxo;
}

describe("T208 — leitura do corpo com teto de 5 MB", () => {
  it("dentro do teto: devolve os bytes", async () => {
    const lido = await lerCorpoLimitado(
      corpo([Buffer.from("abc"), Buffer.from("de")]),
      10,
    );
    expect(lido.toString()).toBe("abcde");
  });

  it("Content-Length acima do teto: 413 antes de ler", async () => {
    await expect(lerCorpoLimitado(corpo([], 11), 10)).rejects.toBeInstanceOf(
      PayloadTooLargeException,
    );
  });

  it("sem Content-Length (ou mentindo): 413 durante a leitura", async () => {
    await expect(
      lerCorpoLimitado(corpo([Buffer.alloc(6), Buffer.alloc(6)]), 10),
    ).rejects.toBeInstanceOf(PayloadTooLargeException);
    await expect(
      lerCorpoLimitado(corpo([Buffer.alloc(20)], 5), 10),
    ).rejects.toBeInstanceOf(PayloadTooLargeException);
  });

  it("acima do teto de descarte, a conexão é cortada (ninguém prende o servidor)", async () => {
    // O cliente NUNCA termina de mandar: só o corte libera a conexão. (Um
    // fluxo que termina se autodestrói e esconderia a falta do corte.)
    const fluxo = corpo([Buffer.alloc(15), Buffer.alloc(15)], undefined, false);
    const cortar = jest.spyOn(fluxo, "destroy");
    await expect(lerCorpoLimitado(fluxo, 10, 20)).rejects.toBeInstanceOf(
      PayloadTooLargeException,
    );
    expect(cortar).toHaveBeenCalled();
  });

  it("o teto padrão é 5 MB", async () => {
    await expect(
      lerCorpoLimitado(corpo([], 5 * 1024 * 1024 + 1)),
    ).rejects.toBeInstanceOf(PayloadTooLargeException);
    const cinco = await lerCorpoLimitado(
      corpo([Buffer.alloc(5 * 1024 * 1024)]),
    );
    expect(cinco.length).toBe(5 * 1024 * 1024);
  });
});

describe("T208 — versão do perfil no cabeçalho", () => {
  it("'nenhuma' é o perfil nunca salvo; ISO exato é a versão", () => {
    expect(versaoLida("nenhuma")).toBeNull();
    expect(versaoLida("2026-11-13T10:00:00.000Z")).toEqual(
      new Date("2026-11-13T10:00:00.000Z"),
    );
  });

  it.each([undefined, "", "ontem", "2026-11-13", "2026-02-30T10:00:00.000Z"])(
    "%s é recusado (400)",
    (valor) => {
      expect(() => versaoLida(valor)).toThrow(BadRequestException);
    },
  );
});

describe("T208 — permissões das rotas da foto", () => {
  it.each([
    ["lerMinhaFoto", "read", [AuthorizationGuard]],
    ["enviarMinhaFoto", "manage", [CsrfGuard, AuthorizationGuard]],
    ["removerMinhaFoto", "manage", [CsrfGuard, AuthorizationGuard]],
  ] as const)("%s: own_account/%s", (metodo, acao, guardas) => {
    const handler = UsersController.prototype[metodo];
    expect(Reflect.getMetadata(PERMISSION_METADATA_KEY, handler)).toEqual({
      resource: "own_account",
      action: acao,
    });
    expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toEqual(guardas);
  });
});

function ator(parcial: Partial<AccessUser> = {}): AccessUser {
  return {
    id: "conta-a",
    email: "pessoa.a@example.test",
    passwordHash: "hash",
    role: "colaborador",
    companyId: "empresa-x",
    unitId: null,
    teamId: null,
    status: "active",
    nomeExibicao: null,
    perfilAtualizadoEm: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...parcial,
  } as AccessUser;
}

function montar({ versao = 1, removidas = 1 } = {}) {
  const tx = {
    accessUser: {
      updateMany: jest.fn().mockResolvedValue({ count: versao }),
      update: jest.fn().mockResolvedValue({}),
    },
    accessUserFoto: {
      upsert: jest.fn().mockResolvedValue({}),
      deleteMany: jest.fn().mockResolvedValue({ count: removidas }),
    },
  };
  const prisma = {
    $transaction: jest.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const sessoes = { revokeAllForUser: jest.fn().mockResolvedValue(0) };
  const servico = new UsersService(
    prisma as never,
    {} as never,
    {} as never,
    sessoes as never,
    audit as never,
  );
  return { servico, tx, audit };
}

const METADADOS = { ip: "203.0.113.9", userAgent: "teste", requestId: "req-1" };
const LIDA = new Date("2026-11-13T10:00:00.000Z");

describe("T208 — serviço da foto", () => {
  it("gravar: versão conferida na conta da sessão; grava a imagem; auditoria sem dado da imagem", async () => {
    const { servico, tx, audit } = montar();
    const foto = await normalizarFotoDePerfil(await imagem(300, 300, "jpeg"));
    await servico.gravarFotoPropria(foto, LIDA, {
      actor: ator(),
      metadata: METADADOS,
    });
    expect(tx.accessUser.updateMany.mock.calls[0][0].where).toEqual({
      id: "conta-a",
      perfilAtualizadoEm: LIDA,
    });
    expect(Object.keys(tx.accessUser.updateMany.mock.calls[0][0].data)).toEqual(
      ["perfilAtualizadoEm"],
    );
    const upsert = tx.accessUserFoto.upsert.mock.calls[0][0];
    expect(upsert.where).toEqual({ userId: "conta-a" });
    expect(upsert.update.conteudo).toBe(foto);
    const [evento, transacao] = audit.record.mock.calls[0];
    expect(transacao).toBe(tx);
    expect(evento).toMatchObject({
      action: "conta_foto_enviada",
      resource: "access_user",
      resourceId: "conta-a",
    });
    const texto = JSON.stringify(evento);
    expect(texto).not.toMatch(
      /conteudo|tamanho|hash|largura|altura|jpeg|image/i,
    );
    expect(Object.values(evento).some((v) => Buffer.isBuffer(v))).toBe(false);
  });

  it("gravar com versão desatualizada: 409, nada gravado, nada auditado", async () => {
    const { servico, tx, audit } = montar({ versao: 0 });
    await expect(
      servico.gravarFotoPropria(Buffer.from([0xff, 0xd8, 0xff]), LIDA, {
        actor: ator(),
        metadata: METADADOS,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.accessUserFoto.upsert).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it("remover: apaga os bytes da conta da sessão e audita sem dado da imagem", async () => {
    const { servico, tx, audit } = montar();
    await servico.removerFotoPropria(LIDA, {
      actor: ator(),
      metadata: METADADOS,
    });
    expect(tx.accessUserFoto.deleteMany).toHaveBeenCalledWith({
      where: { userId: "conta-a" },
    });
    expect(audit.record.mock.calls[0][0]).toMatchObject({
      action: "conta_foto_removida",
      resourceId: "conta-a",
    });
  });

  it("remover sem foto: 404 (a transação desfaz a versão); versão velha: 409", async () => {
    const semFoto = montar({ removidas: 0 });
    await expect(
      semFoto.servico.removerFotoPropria(LIDA, {
        actor: ator(),
        metadata: METADADOS,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(semFoto.audit.record).not.toHaveBeenCalled();
    const velha = montar({ versao: 0 });
    await expect(
      velha.servico.removerFotoPropria(LIDA, {
        actor: ator(),
        metadata: METADADOS,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(velha.tx.accessUserFoto.deleteMany).not.toHaveBeenCalled();
  });

  it("desativar a conta apaga a foto na mesma transação e audita a remoção", async () => {
    const { servico, tx, audit } = montar();
    await servico.disable("conta-b", {
      actor: ator({ id: "rh-1", role: "rh" }),
      metadata: METADADOS,
    });
    expect(tx.accessUserFoto.deleteMany).toHaveBeenCalledWith({
      where: { userId: "conta-b" },
    });
    const acoes = audit.record.mock.calls.map(([e]) => e.action);
    expect(acoes).toContain("conta_foto_removida");
    const remocao = audit.record.mock.calls.find(
      ([e]) => e.action === "conta_foto_removida",
    )![0];
    expect(remocao).toMatchObject({
      resourceId: "conta-b",
      actorUserId: "rh-1",
    });
  });

  it("desativar conta sem foto: nenhum evento de remoção de foto", async () => {
    const { servico, audit } = montar({ removidas: 0 });
    await servico.disable("conta-b", {
      actor: ator({ id: "rh-1", role: "rh" }),
      metadata: METADADOS,
    });
    const acoes = audit.record.mock.calls.map(([e]) => e.action);
    expect(acoes).not.toContain("conta_foto_removida");
  });
});
