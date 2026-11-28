import { NotFoundException } from "@nestjs/common";
import {
  CamposRecusadosException,
  IndisponibilidadeException,
  RecusaDeNegocioException,
} from "../../common/erros/recusa-por-campo";
import { VerificadorFalso } from "../../pessoas/documentos-colaborador/verificador-de-arquivos";
import { ArmazenamentoEmMemoria } from "../../pessoas/foto-colaborador/armazenamento-de-objetos";
import { AcompanhamentoService } from "./acompanhamento.service";
import type { PessoasAuditContext } from "../../pessoas/pessoas.types";

/**
 * T216 — arquivos de evidência da NR-1 no serviço: antivírus antes de
 * gravar, armazenamento privado e o registro no acompanhamento. Prisma,
 * pesquisas e auditoria são falsos; nenhum teste fala com o bucket.
 */

const PDF = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n", "latin1");
const PESQUISA = "0b5e8f6a-1d2c-4e3f-9a8b-7c6d5e4f3a2b";
const CTX = {
  actor: { id: "u1", role: "rh", companyId: "emp1" },
  metadata: {},
} as unknown as PessoasAuditContext;

function montar(modelo = "copsoq") {
  const linha: { acompanhamento: unknown } = { acompanhamento: null };
  const tx = {
    $queryRaw: jest.fn(async () => [{ id: PESQUISA }]),
    pesquisa: {
      findFirst: jest.fn(async () => ({
        acompanhamento: linha.acompanhamento,
      })),
      update: jest.fn(
        async ({ data }: { data: { acompanhamento: unknown } }) => {
          linha.acompanhamento = data.acompanhamento;
          return {
            id: PESQUISA,
            identificacao: "anonima",
            publicadaEm: null,
            acompanhamento: linha.acompanhamento,
          };
        },
      ),
    },
  };
  const prisma = {
    $transaction: jest.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
    pesquisaResposta: { count: jest.fn(async () => 1) },
    pesquisaParticipante: { count: jest.fn(async () => 0) },
  };
  const pesquisas = {
    pesquisaDoModelo: jest.fn(async () => ({
      pesquisa: {
        id: PESQUISA,
        modelo,
        identificacao: "anonima",
        publicadaEm: null,
        acompanhamento: linha.acompanhamento,
      },
      empresaId: "emp1",
    })),
  };
  const auditoria = { registrarMutacao: jest.fn(async () => undefined) };
  const armazenamento = new ArmazenamentoEmMemoria();
  const verificador = new VerificadorFalso();
  const service = new AcompanhamentoService(
    prisma as never,
    pesquisas as never,
    auditoria as never,
    armazenamento,
    verificador,
  );
  return { service, armazenamento, verificador, linha, tx, auditoria };
}

const enviar = (s: AcompanhamentoService, etapa = "comunicar", bytes = PDF) =>
  s.enviarEvidencia(
    PESQUISA,
    etapa,
    {
      bytes,
      extensao: "pdf",
      tipoDeclarado: "application/pdf",
      nome: encodeURIComponent("Ata da reunião.pdf"),
    },
    CTX,
  );

const codigo = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    if (e instanceof RecusaDeNegocioException) return e.codigo;
    if (e instanceof IndisponibilidadeException) return e.codigo;
    if (e instanceof CamposRecusadosException) return e.erros[0]!.motivo;
    if (e instanceof NotFoundException) return 404;
    throw e;
  }
  return null;
};

describe("AcompanhamentoService — evidências", () => {
  it("verifica, grava no armazenamento e registra na etapa (sem chave na resposta)", async () => {
    const m = montar();
    const d = await enviar(m.service);
    expect(m.verificador.verificados).toHaveLength(1);
    expect(m.armazenamento.objetos.size).toBe(1);
    const [chave, objeto] = [...m.armazenamento.objetos][0]!;
    expect(chave).toMatch(
      new RegExp(
        `^v1/empresas/emp1/pesquisas/${PESQUISA}/evidencias/comunicar/[0-9a-f-]{36}$`,
      ),
    );
    expect(objeto.tipo).toBe("application/pdf");
    const arquivos = d.etapas.find((e) => e.id === "comunicar")!.arquivos;
    expect(arquivos).toHaveLength(1);
    expect(arquivos[0]).toMatchObject({
      nome: "Ata da reunião.pdf",
      formato: "pdf",
      tamanhoBytes: PDF.length,
    });
    expect(arquivos[0]).not.toHaveProperty("chave");
    expect(arquivos[0]).not.toHaveProperty("hashSha256");
    expect(m.tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(m.auditoria.registrarMutacao).toHaveBeenCalledWith(
      m.tx,
      CTX,
      "pesquisas_pesquisa_alterada",
      "pesquisa",
      PESQUISA,
      "emp1",
    );
  });

  it("antivírus reprova ou fora do ar: nada é gravado", async () => {
    const m = montar();
    const eicar = Buffer.concat([
      Buffer.from("%PDF-1.4\n"),
      Buffer.from(
        [
          "X5O!P%@AP[4\\PZX54(P^)7CC)7}$",
          "EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*",
        ].join(""),
      ),
      Buffer.from("\n%%EOF\n"),
    ]);
    expect(await codigo(enviar(m.service, "comunicar", eicar))).toBe(
      "evidencia_reprovada_antivirus",
    );
    m.verificador.falhar = true;
    expect(await codigo(enviar(m.service))).toBe(
      "evidencia_verificacao_indisponivel",
    );
    expect(m.armazenamento.objetos.size).toBe(0);
    expect(m.linha.acompanhamento).toBeNull();
  });

  it("formato inválido, etapa automática ou desconhecida: recusa antes do antivírus", async () => {
    const m = montar();
    expect(
      await codigo(enviar(m.service, "comunicar", Buffer.from("texto"))),
    ).toBe("evidencia_formato_invalido");
    expect(await codigo(enviar(m.service, "mapear"))).toBe("nao_se_aplica");
    expect(await codigo(enviar(m.service, "../outra"))).toBe(404);
    expect(m.verificador.verificados).toHaveLength(0);
    expect(m.armazenamento.objetos.size).toBe(0);
  });

  it("armazenamento fora do ar ou falha ao registrar: o objeto não fica", async () => {
    const m = montar();
    m.armazenamento.falhar = (op) => op === "gravar";
    expect(await codigo(enviar(m.service))).toBe(
      "evidencia_armazenamento_indisponivel",
    );
    m.armazenamento.falhar = () => false;
    m.tx.pesquisa.update.mockRejectedValueOnce(new Error("banco"));
    await expect(enviar(m.service)).rejects.toThrow("banco");
    expect(m.armazenamento.objetos.size).toBe(0);
  });

  it("outro modelo: 404", async () => {
    const m = montar("isfb");
    expect(await codigo(enviar(m.service))).toBe(404);
  });

  it("baixa o arquivo pelo id e remove da etapa e do armazenamento", async () => {
    const m = montar();
    const d = await enviar(m.service, "validar");
    const id = d.etapas.find((e) => e.id === "validar")!.arquivos[0]!.id;
    const baixado = await m.service.baixarEvidencia(
      PESQUISA,
      "validar",
      id,
      CTX,
    );
    expect(baixado.bytes.equals(PDF)).toBe(true);
    expect(baixado.nome).toBe("Ata da reunião.pdf");
    expect(baixado.tipo).toBe("application/pdf");
    expect(
      await codigo(m.service.baixarEvidencia(PESQUISA, "comunicar", id, CTX)),
    ).toBe(404);

    const depois = await m.service.removerEvidencia(
      PESQUISA,
      "validar",
      id,
      CTX,
    );
    expect(depois.etapas.find((e) => e.id === "validar")!.arquivos).toEqual([]);
    expect(m.armazenamento.objetos.size).toBe(0);
    expect(
      await codigo(m.service.removerEvidencia(PESQUISA, "validar", id, CTX)),
    ).toBe(404);
  });
});
