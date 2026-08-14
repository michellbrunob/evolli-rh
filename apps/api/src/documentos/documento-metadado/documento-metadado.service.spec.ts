import { NotFoundException } from "@nestjs/common";
import { AccessUser } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { DocumentosAuditoriaService } from "../documentos-auditoria.service";
import { DocumentosAuditContext } from "../documentos.types";
import { DocumentoMetadadoService } from "./documento-metadado.service";

/**
 * Foco: a **leitura de metadado é fail-safe** (ADR 0011, decisão 7). Se o
 * evento de leitura não puder ser gravado, a leitura NÃO retorna sucesso — o
 * erro propaga. Testado em isolamento, com Prisma e auditoria mockados; o E2E
 * cobre o mesmo contrato ponta a ponta revogando INSERT na trilha.
 */

const EMPRESA_A = "11111111-1111-4111-8111-111111111111";

function contexto(): DocumentosAuditContext {
  const actor = {
    id: "ator-1",
    role: "rh",
    companyId: EMPRESA_A,
  } as unknown as AccessUser;
  return {
    actor,
    metadata: { ip: null, userAgent: null, requestId: "req-1" },
  };
}

function metadadoFake() {
  return {
    id: "doc-1",
    empresaId: EMPRESA_A,
    colaboradorId: "colab-1",
    tipoDocumentoId: "tipo-1",
    estado: "upload_desabilitado",
    substituiDocumentoId: null,
    criadoEm: new Date(0),
    atualizadoEm: new Date(0),
  };
}

describe("DocumentoMetadadoService — leitura auditada fail-safe", () => {
  function montar(overrides: {
    findFirst?: jest.Mock;
    findMany?: jest.Mock;
    count?: jest.Mock;
    registrarLeitura?: jest.Mock;
  }) {
    const prisma = {
      documentoMetadado: {
        findFirst: overrides.findFirst ?? jest.fn(),
        findMany: overrides.findMany ?? jest.fn().mockResolvedValue([]),
        count: overrides.count ?? jest.fn().mockResolvedValue(0),
      },
    } as unknown as PrismaService;

    const auditoria = {
      registrarLeitura:
        overrides.registrarLeitura ?? jest.fn().mockResolvedValue(undefined),
      negarAcesso: jest.fn(async () => {
        throw new NotFoundException();
      }),
    } as unknown as DocumentosAuditoriaService;

    return {
      service: new DocumentoMetadadoService(prisma, auditoria),
      auditoria,
    };
  }

  it("detalhar NÃO retorna dados se o evento de leitura falhar", async () => {
    const { service } = montar({
      findFirst: jest.fn().mockResolvedValue(metadadoFake()),
      registrarLeitura: jest
        .fn()
        .mockRejectedValue(new Error("trilha indisponível")),
    });

    await expect(service.detalhar("doc-1", contexto())).rejects.toThrow();
  });

  it("detalhar audita a leitura bem-sucedida (fail-safe) e retorna o metadado", async () => {
    const registrarLeitura = jest.fn().mockResolvedValue(undefined);
    const { service } = montar({
      findFirst: jest.fn().mockResolvedValue(metadadoFake()),
      registrarLeitura,
    });

    const resultado = await service.detalhar("doc-1", contexto());

    expect(resultado.id).toBe("doc-1");
    expect(registrarLeitura).toHaveBeenCalledTimes(1);
    // A leitura é registrada com o id técnico do recurso — nunca o tipo.
    expect(registrarLeitura).toHaveBeenCalledWith(
      expect.anything(),
      "documentos_documento_metadado_consultado",
      "documento_metadado",
      "doc-1",
      EMPRESA_A,
    );
  });

  it("detalhar responde 404 (negarAcesso) quando o metadado não está no escopo", async () => {
    const { service, auditoria } = montar({
      findFirst: jest.fn().mockResolvedValue(null),
    });

    await expect(service.detalhar("doc-x", contexto())).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(auditoria.negarAcesso).toHaveBeenCalled();
  });

  it("listar NÃO retorna dados se o evento de leitura falhar", async () => {
    const { service } = montar({
      registrarLeitura: jest
        .fn()
        .mockRejectedValue(new Error("trilha indisponível")),
    });

    await expect(
      service.listar({ pagina: 1, tamanhoPagina: 20 }, contexto()),
    ).rejects.toThrow();
  });
});
